#!/usr/bin/env python3
"""Publier des images testées et revenir à la configuration précédente si nécessaire.

Les images précédentes restent locales. Aucune restauration de base automatique :
elle effacerait les écritures reçues depuis la sauvegarde.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE = Path.home() / '.local/state/wilayadz-releases'


def run(*args, capture=False):
    result = subprocess.run([str(x) for x in args], cwd=ROOT, check=True,
                            text=True, stdout=subprocess.PIPE if capture else None,
                            timeout=600)
    return result.stdout if capture else None


def compose(config, *args):
    return run('docker', 'compose', '-p', 'deploy', '-f', config, *args)


def smoke(revision=None, base='http://127.0.0.1:8099'):
    with urllib.request.urlopen(base + '/api/health', timeout=10) as r:
        if json.load(r).get('ok') is not True:
            raise RuntimeError('API invalide à travers nginx')
    request = urllib.request.Request(base + '/', headers={'Accept-Encoding': 'gzip'})
    with urllib.request.urlopen(request, timeout=10) as r:
        if r.headers.get('Content-Encoding') != 'gzip':
            raise RuntimeError('Compression absente')
        if len(r.read()) > 1_600_000:
            raise RuntimeError('Budget de transfert initial dépassé (1,6 Mo)')
    if revision:
        with urllib.request.urlopen(base + '/release.json', timeout=10) as r:
            if json.load(r).get('revision') != revision:
                raise RuntimeError('La version servie diffère de la version attendue')


def activate(config, previous, revision):
    try:
        compose(config, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '90')
        smoke(revision)
    except Exception:
        if previous:
            print('Publication échouée : retour aux images et à la configuration précédentes.', flush=True)
            compose(previous, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '90')
            smoke()
        raise


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('revision', help='SHA Git exact (40 caractères)')
    p.add_argument('--check-only', action='store_true', help='Construire et éprouver sans sauvegarde ni publication')
    args = p.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.revision):
        p.error('SHA Git complet requis')
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    current = STATE / 'current.json'
    if not current.is_file():
        raise RuntimeError('Initialiser current.json depuis le déploiement existant avant publication')
    # Construire avant de toucher aux services en ligne, avec tags par révision.
    raw = run('docker', 'compose', '-f', 'deploy/docker-compose.yml', 'config', '--format', 'json', capture=True)
    config = json.loads(raw)
    for service, label in (('wilaya-web', 'web'), ('wilaya-api', 'api')):
        config['services'][service]['image'] = 'wilayadz-' + label + ':' + args.revision
        config['services'][service]['build']['args'] = {'APP_REVISION': args.revision}
    target = STATE / (args.revision + '.json')
    target.write_text(json.dumps(config))
    compose(target, 'build')
    # Valider les deux images sur un réseau jetable, sans volume de production.
    with tempfile.TemporaryDirectory(prefix='wilayadz-release-') as tmp:
        preview = json.loads(json.dumps(config))
        preview['name'] = 'wilayadz-candidate'
        preview.pop('networks', None)
        preview.pop('volumes', None)
        for service in preview['services'].values():
            for key in ('container_name', 'networks', 'volumes', 'extra_hosts', 'ports'):
                service.pop(key, None)
            service.pop('build', None)
        preview['services']['wilaya-api']['environment'] = {'APP_URL': 'http://127.0.0.1'}
        preview['services']['wilaya-web']['ports'] = ['127.0.0.1::8080']
        test_config = Path(tmp) / 'candidate.json'
        test_config.write_text(json.dumps(preview))
        cmd = ('docker', 'compose', '-p', 'wilayadz-candidate', '-f', test_config)
        try:
            run(*cmd, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '90')
            address = run(*cmd, 'port', 'wilaya-web', '8080', capture=True).strip()
            smoke(args.revision, 'http://' + address)
        finally:
            run(*cmd, 'down')
    if args.check_only:
        print('Images éprouvées sans modifier la production : ' + args.revision)
        return
    # systemctl attend la fin du oneshot et renvoie son échec : sans sauvegarde
    # vérifiée sur NAS, la version actuelle reste en place.
    run('sudo', '-n', 'systemctl', 'start', 'wilayadz-backup.service')
    activate(target, current, args.revision)
    previous = STATE / 'previous.json'
    previous.write_bytes(current.read_bytes())
    pending = STATE / 'current.partial'
    pending.write_bytes(target.read_bytes())
    pending.replace(current)
    print('Publication vérifiée : ' + args.revision)


if __name__ == '__main__':
    main()
