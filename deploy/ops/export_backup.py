#!/usr/bin/env python3
"""Prépare une archive chiffrée transportable, sans affirmer son envoi distant."""
import argparse
import datetime
import json
import os
from pathlib import Path
import tempfile
from backup import atomic_copy, crypt, digest, inspect_db, snapshot


def export(source, state, key):
    if not key.is_file() or key.stat().st_mode & 0o077 or key.stat().st_size < 32:
        raise RuntimeError('Clé absente ou non privée')
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    home = state / 'gnupg'; home.mkdir(exist_ok=True, mode=0o700)
    archives = state / 'archives'; archives.mkdir(exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(prefix='export-check-', dir=state) as tmp:
        tmp = Path(tmp)
        expected = snapshot(source, tmp / 'snapshot.sqlite3')
        name = 'wilayadz-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite3.gpg'
        crypt(key, home, tmp / 'snapshot.sqlite3', tmp / name)
        crypt(key, home, tmp / name, tmp / 'restored.sqlite3', decrypt=True)
        if inspect_db(tmp / 'restored.sqlite3') != expected or digest(tmp / 'snapshot.sqlite3') != digest(tmp / 'restored.sqlite3'):
            raise RuntimeError('La restauration locale ne correspond pas au snapshot')
        atomic_copy(tmp / name, archives / name)
    report = {'archive': name, 'sha256': digest(archives / name),
              'local_restore_verified': True, 'remote_verified': False}
    (state / 'export-status.json').write_text(json.dumps(report) + '\n')
    return report


if __name__ == '__main__':
    os.umask(0o077)
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--state', type=Path, default=Path('/var/lib/wilayadz-ops'))
    p.add_argument('--key', type=Path, default=Path('/etc/wilayadz/backup.key'))
    args = p.parse_args()
    print(json.dumps(export(args.source, args.state, args.key)))
