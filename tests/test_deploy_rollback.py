"""Essai Docker manuel sur bigpc, uniquement avec images déjà construites.

python3 tests/test_deploy_rollback.py <SHA-candidat>
Ne monte aucun volume et ne touche jamais au projet Compose de production.
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT / 'deploy/release.py')
release = importlib.util.module_from_spec(spec); spec.loader.exec_module(release)
PROJECT = 'wilayadz-rollback-test'


def run(*args):
    return subprocess.check_output([str(x) for x in args], text=True, timeout=120)


def live_ids():
    return run('docker', 'inspect', '-f', '{{.Id}}', 'wilaya-web', 'wilaya-api')


def main():
    revision = sys.argv[1]
    state = Path.home() / '.local/state/wilayadz-releases'
    current = json.loads((state / 'current.json').read_text())
    candidate = json.loads((state / (revision + '.json')).read_text())
    before = live_ids()
    with tempfile.TemporaryDirectory(prefix=PROJECT) as tmp:
        paths = []
        for label, config in [('old', current), ('new', candidate)]:
            config['name'] = PROJECT
            config.pop('networks', None); config.pop('volumes', None)
            for service in config['services'].values():
                for key in ('container_name', 'networks', 'volumes', 'extra_hosts', 'ports', 'build'):
                    service.pop(key, None)
            config['services']['wilaya-api']['environment'] = {'APP_URL': 'http://127.0.0.1'}
            config['services']['wilaya-web']['ports'] = ['127.0.0.1::8080']
            path = Path(tmp) / (label + '.json'); path.write_text(json.dumps(config)); paths.append(path)
        old, new = paths
        def compose(config, *args):
            return run('docker', 'compose', '-p', PROJECT, '-f', config, *args)
        smoke = release.smoke
        def isolated_smoke(revision=None):
            address = compose(new, 'port', 'wilaya-web', '8080').strip()
            return smoke(revision, 'http://' + address)
        release.compose = compose; release.smoke = isolated_smoke
        try:
            try:
                release.activate(new, old, 'deliberate-version-mismatch')
            except RuntimeError as error:
                if 'version servie' not in str(error): raise
            else:
                raise AssertionError('La mauvaise version aurait dû échouer')
            for service in ('wilaya-web', 'wilaya-api'):
                container = compose(old, 'ps', '-q', service).strip()
                actual = run('docker', 'inspect', '-f', '{{.Image}}', container).strip()
                expected = run('docker', 'image', 'inspect', '-f', '{{.Id}}', current['services'][service]['image']).strip()
                assert actual == expected, 'Image précédente non restaurée'
            assert live_ids() == before, 'Les services de production ont changé'
            print('Retour réel aux deux images précédentes : OK. Production inchangée.')
        finally:
            compose(new, 'down')


if __name__ == '__main__':
    main()
