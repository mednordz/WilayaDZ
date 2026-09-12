#!/usr/bin/env python3
"""Archive chiffrée sur Google Drive, relue et restaurée avant validation."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
from backup import crypt, digest, inspect_db
from export_backup import export

STATE = Path('/var/lib/wilayadz-ops')
KEY = Path('/etc/wilayadz/backup.key')
CONFIG = Path('/etc/wilayadz/drive.json')
SOURCE = Path('/var/lib/docker/volumes/deploy_wilaya-data/_data/wilayadz.sqlite3')
NAME = re.compile(r'^wilayadz-\d{8}T\d{12}Z\.sqlite3\.gpg$')


def rclone(config, *args):
    # La configuration OAuth est privée et séparée de la clé de chiffrement.
    # La racine est le dossier Drive choisi, jamais le Drive entier.
    return subprocess.check_output(
        ['rclone', '--config', config['rclone_config'], '--drive-root-folder-id',
         config['folder_id'], '--contimeout', '15s', '--timeout', '60s',
         '--retries', '2', *map(str, args)], text=True, timeout=180,
        stderr=subprocess.PIPE)


def perform(source=SOURCE, state=STATE, key=KEY, config_path=CONFIG):
    config = json.loads(config_path.read_text())
    credential = Path(config['rclone_config'])
    if not credential.is_file() or credential.stat().st_mode & 0o077:
        raise RuntimeError('Configuration OAuth absente ou non privée')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', config['folder_id']):
        raise ValueError('Identifiant de dossier Drive invalide')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', config['remote']):
        raise ValueError('Nom de connexion Drive invalide')
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state / 'backup.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        report = export(source, state, key)
        archive = state / 'archives' / report['archive']
        remote = config['remote'] + ':'
        target = remote + report['archive']
        rclone(config, 'copyto', archive, target, '--immutable')
        with tempfile.TemporaryDirectory(prefix='drive-restore-', dir=state) as tmp:
            tmp = Path(tmp)
            rclone(config, 'copyto', target, tmp / 'returned.gpg')
            if digest(tmp / 'returned.gpg') != report['sha256']:
                raise RuntimeError('Archive relue depuis Drive différente de la source')
            crypt(key, state / 'gnupg', tmp / 'returned.gpg', tmp / 'restored.sqlite3', decrypt=True)
            inspect_db(tmp / 'restored.sqlite3')
        report.update(ok=True, completed_at=time.time(), destination='google-drive',
                      remote_verified=True, restore_verified=True)
        pending = state / 'backup-status.json.partial'
        pending.write_text(json.dumps(report) + '\n')
        pending.replace(state / 'backup-status.json')
        # Seulement nos archives dans le dossier dédié, après restauration réussie.
        names = sorted(item['Name'] for item in json.loads(rclone(config, 'lsjson', remote, '--files-only', '--max-depth', '1'))
                       if NAME.fullmatch(item['Name']))
        for old in names[:-30]:
            rclone(config, 'deletefile', remote + old, '--drive-use-trash=true')
        for old in sorted((state / 'archives').glob('wilayadz-*.sqlite3.gpg'))[:-7]:
            old.unlink()
    print(json.dumps(report))
    return report


if __name__ == '__main__':
    os.umask(0o077)
    perform()
