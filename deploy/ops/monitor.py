#!/usr/bin/env python3
"""Surveillance locale sans compte de test ni requête qui modifie la base."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

STATE = Path('/var/lib/wilayadz-ops')


def check():
    errors = []
    for name in ('wilaya-web', 'wilaya-api'):
        try:
            data = json.loads(subprocess.check_output(
                ['docker', 'inspect', name], timeout=10))[0]['State']
            if data.get('Health', {}).get('Status') != 'healthy' or data.get('OOMKilled'):
                errors.append(name + ': unhealthy/OOM')
        except Exception:
            errors.append(name + ': indisponible')
    try:
        with urllib.request.urlopen('http://127.0.0.1:8099/api/health', timeout=8) as r:
            if json.load(r).get('ok') is not True:
                errors.append('API: réponse invalide')
    except Exception:
        errors.append('API inaccessible à travers nginx')
    try:
        status = json.loads((STATE / 'backup-status.json').read_text())
        if not status.get('restore_verified') or time.time() - status['completed_at'] > 30 * 3600:
            errors.append('Sauvegarde vérifiée trop ancienne')
    except Exception:
        errors.append('Aucune sauvegarde vérifiée')
    if not os.path.ismount('/mnt/qnap'):
        errors.append('NAS non monté')
    disk = shutil.disk_usage(STATE)
    if disk.free < 2 * 1024**3 or disk.free / disk.total < .1:
        errors.append('Espace disque insuffisant')
    report = {'ok': not errors, 'checked_at': time.time(), 'errors': errors}
    previous = {}
    path = STATE / 'health-status.json'
    if path.exists():
        previous = json.loads(path.read_text())
    tmp = path.with_suffix('.partial')
    tmp.write_text(json.dumps(report) + '\n')
    tmp.replace(path)
    # Journal uniquement sur changement d'état ou panne persistante.
    if errors or previous.get('errors') != errors:
        print(json.dumps(report), flush=True)
    return 1 if errors else 0


if __name__ == '__main__':
    os.umask(0o077)
    raise SystemExit(check())
