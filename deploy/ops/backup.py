#!/usr/bin/env python3
"""Snapshot SQLite à chaud, archive chiffrée et restauration isolée vérifiée.

Aucune donnée personnelle ni clé n'est écrite dans les journaux.
"""
import argparse
import contextlib
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import time


def inspect_db(path):
    with contextlib.closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise RuntimeError('Intégrité SQLite invalide')
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Relations SQLite invalides')
        counts = {table: db.execute('SELECT count(*) FROM ' + table).fetchone()[0]
                  for table in ('accounts', 'sessions', 'resets', 'confirms')}
        return {'schema': db.execute('PRAGMA user_version').fetchone()[0], 'counts': counts}


def snapshot(source, destination):
    # mode=ro : une faute de chemin ne doit jamais créer une base vide.
    with contextlib.closing(sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True)) as src:
        with contextlib.closing(sqlite3.connect(destination)) as dst:
            deadline = time.monotonic() + 60
            def progress(*_):
                if time.monotonic() > deadline:
                    raise TimeoutError('Snapshot SQLite trop long')
            src.backup(dst, pages=128, progress=progress, sleep=.05)
    return inspect_db(destination)


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def atomic_copy(source, target):
    partial = target.with_suffix(target.suffix + '.partial')
    try:
        with source.open('rb') as src, partial.open('wb') as dst:
            shutil.copyfileobj(src, dst)
            dst.flush()
            os.fsync(dst.fileno())
        if digest(source) != digest(partial):
            raise RuntimeError('Copie de sauvegarde différente de la source')
        partial.replace(target)
    finally:
        partial.unlink(missing_ok=True)


def crypt(key, home, source, target, decrypt=False):
    cmd = ['gpg', '--batch', '--yes', '--homedir', str(home), '--pinentry-mode', 'loopback',
           '--no-symkey-cache', '--passphrase-file', str(key), '--output', str(target)]
    cmd += ['--decrypt'] if decrypt else ['--symmetric', '--cipher-algo', 'AES256']
    # GPG ne reçoit jamais la clé en argument ni dans l'environnement.
    subprocess.run(cmd + [str(source)], check=True, timeout=120, stdout=subprocess.DEVNULL,
                   stderr=subprocess.PIPE)


def backup(source, state, nas, mount, key, keep=30):
    if not os.path.ismount(mount):
        raise RuntimeError('NAS non monté : refus de créer une fausse copie locale')
    if not nas.resolve().is_relative_to(mount.resolve()):
        raise ValueError('La destination doit être sur le NAS')
    if not key.is_file() or key.stat().st_mode & 0o077 or key.stat().st_size < 32:
        raise RuntimeError('Clé absente ou permissions trop ouvertes (0600 requis)')
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    nas.mkdir(parents=True, exist_ok=True)
    home = state / 'gnupg'
    home.mkdir(exist_ok=True, mode=0o700)
    archive_dir = state / 'archives'
    archive_dir.mkdir(exist_ok=True, mode=0o700)
    with (state / 'backup.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with tempfile.TemporaryDirectory(prefix='restore-check-', dir=state) as tmp:
            tmp = Path(tmp)
            expected = snapshot(source, tmp / 'snapshot.sqlite3')
            name = 'wilayadz-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite3.gpg'
            encrypted = tmp / name
            crypt(key, home, tmp / 'snapshot.sqlite3', encrypted)
            atomic_copy(encrypted, archive_dir / name)
            atomic_copy(encrypted, nas / name)
            # Lire la copie du NAS, la déchiffrer LOCALement, puis vérifier.
            atomic_copy(nas / name, tmp / 'returned.gpg')
            crypt(key, home, tmp / 'returned.gpg', tmp / 'restored.sqlite3', decrypt=True)
            if inspect_db(tmp / 'restored.sqlite3') != expected:
                raise RuntimeError('Restauration différente du snapshot')
            if digest(tmp / 'restored.sqlite3') != digest(tmp / 'snapshot.sqlite3'):
                raise RuntimeError('Contenu restauré différent du snapshot')
            report = {'ok': True, 'completed_at': time.time(), 'archive': name,
                      'sha256': digest(encrypted), 'restore_verified': True}
            partial = state / 'backup-status.json.partial'
            partial.write_text(json.dumps(report) + '\n')
            partial.replace(state / 'backup-status.json')
        # Ne supprimer que nos archives, après réussite des deux copies/restauration.
        for directory, count in ((archive_dir, 7), (nas, keep)):
            for old in sorted(directory.glob('wilayadz-*.sqlite3.gpg'))[:-count]:
                old.unlink()
    print(json.dumps(report))


def main():
    os.umask(0o077)
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--state', type=Path, default=Path('/var/lib/wilayadz-ops'))
    p.add_argument('--nas', type=Path, default=Path('/mnt/qnap/Backups/WilayaDZ'))
    p.add_argument('--mount', type=Path, default=Path('/mnt/qnap'))
    p.add_argument('--key', type=Path, default=Path('/etc/wilayadz/backup.key'))
    args = p.parse_args()
    backup(args.source, args.state, args.nas, args.mount, args.key)


if __name__ == '__main__':
    main()
