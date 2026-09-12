"""Régressions : snapshot WAL, restauration chiffrée, surcharge et rollback."""
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'server'))
sys.path.insert(0, str(ROOT / 'deploy/ops'))
SCRATCH = tempfile.TemporaryDirectory(prefix='wilaya-prod-test-')
os.environ['WILAYA_DB'] = SCRATCH.name + '/api.sqlite3'
import app as api


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


backup = module('backup', 'deploy/ops/backup.py')
release = module('release', 'deploy/release.py')
drive = module('drive_backup', 'deploy/ops/drive_backup.py')


class ProductionTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('gpg'), 'GPG absent sur ce poste ; exécuté sur Linux/CI')
    def test_drive_roundtrip_and_corruption_detection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root / 'live.sqlite3'; store = api.Store(str(src))
            key = root / 'key'; key.write_text('test-only-key-not-for-production-' * 2); key.chmod(0o600)
            creds = root / 'rclone.conf'; creds.write_text('[test]\ntype=drive\n'); creds.chmod(0o600)
            config = root / 'drive.json'; config.write_text(json.dumps({'remote':'test', 'folder_id':'test-folder', 'rclone_config':str(creds)}))
            cloud = root / 'cloud'; cloud.mkdir()
            state = root / 'state'
            corrupt = False
            def transport(config, action, *args):
                if action == 'copyto':
                    source, dest = str(args[0]), str(args[1])
                    if source.startswith('test:'):
                        shutil.copyfile(cloud / source.split(':', 1)[1], dest)
                        if corrupt: Path(dest).write_bytes(b'corrupted')
                    else:
                        shutil.copyfile(source, cloud / dest.split(':', 1)[1])
                elif action == 'lsjson':
                    return json.dumps([{'Name':p.name} for p in cloud.iterdir()])
                else: raise AssertionError(action)
                return ''
            with mock.patch.object(drive, 'rclone', transport):
                result = drive.perform(src, state, key, config)
                self.assertTrue(result['remote_verified'])
                self.assertEqual(result['destination'], 'google-drive')
                previous = (state / 'backup-status.json').read_bytes()
                corrupt = True
                with self.assertRaisesRegex(RuntimeError, 'différente'):
                    drive.perform(src, state, key, config)
                self.assertEqual((state / 'backup-status.json').read_bytes(), previous)
            self.assertFalse(list(state.glob('drive-restore-*')))
            store._db.close()

    def test_live_wal_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'live.sqlite3'
            store = api.Store(str(src))
            store.write("INSERT INTO accounts(email,name,pw_salt,pw_hash,created) VALUES(?,?,?,?,?)",
                        ('fixture@example.test', 'Fixture', b'a', b'b', 1))
            self.assertTrue(Path(str(src) + '-wal').exists())
            info = backup.snapshot(src, Path(tmp) / 'backup.sqlite3')
            self.assertEqual(info['counts']['accounts'], 1)
            self.assertEqual(info['schema'], api.SCHEMA_VERSION)
            store._db.close()

    def test_missing_source_does_not_create_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'missing.sqlite3'
            with self.assertRaises(sqlite3.OperationalError):
                backup.snapshot(source, Path(tmp) / 'out.sqlite3')
            self.assertFalse(source.exists())

    @unittest.skipUnless(shutil.which('gpg'), 'GPG absent sur ce poste ; exécuté sur Linux/CI')
    def test_encrypted_nas_restore_and_mount_guard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root / 'live.sqlite3'
            store = api.Store(str(src))
            key = root / 'key'; key.write_text('test-only-not-a-production-secret-' * 2); key.chmod(0o600)
            state, nas = root / 'state', root / 'nas'
            with self.assertRaisesRegex(RuntimeError, 'NAS non monté'):
                backup.backup(src, state, nas, root, key)
            self.assertFalse(state.exists())
            with mock.patch.object(backup.os.path, 'ismount', return_value=True):
                backup.backup(src, state, nas, root, key)
            status = json.loads((state / 'backup-status.json').read_text())
            self.assertTrue(status['restore_verified'])
            self.assertEqual(len(list(nas.glob('*.gpg'))), 1)
            self.assertFalse(list(state.glob('restore-check-*')))
            wrong = root / 'wrong'; wrong.write_text('incorrect-passphrase'); wrong.chmod(0o600)
            with self.assertRaises(Exception):
                backup.crypt(wrong, state / 'gnupg', nas / status['archive'], root / 'out', True)
            store._db.close()

    def test_failed_activation_restores_previous_and_still_fails(self):
        with mock.patch.object(release, 'compose') as compose, mock.patch.object(release, 'smoke', side_effect=[RuntimeError('broken'), None]):
            with self.assertRaisesRegex(RuntimeError, 'broken'):
                release.activate('new.json', 'old.json', 'a' * 40)
            self.assertEqual([c.args[0] for c in compose.call_args_list], ['new.json', 'old.json'])

    def test_success_does_not_rollback(self):
        with mock.patch.object(release, 'compose') as compose, mock.patch.object(release, 'smoke'):
            release.activate('new.json', 'old.json', 'a' * 40)
            self.assertEqual(compose.call_count, 1)

    def test_password_work_is_bounded(self):
        active = 0; peak = 0
        lock = threading.Lock()
        def expensive(*args, **kwargs):
            nonlocal active, peak
            with lock:
                active += 1; peak = max(peak, active)
            time.sleep(.03)
            with lock:
                active -= 1
            return b'hash'
        with mock.patch.object(api.hashlib, 'scrypt', expensive):
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                self.assertEqual(list(pool.map(lambda _: api.hash_password('password', b'salt'), range(8))), [b'hash'] * 8)
        self.assertEqual(peak, 2)

    def test_saturation_returns_503_then_recovers(self):
        server = api.BoundedHTTPServer(('127.0.0.1', 0), api.Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True); worker.start()
        held = []
        try:
            for _ in range(16):
                conn = socket.create_connection(server.server_address, timeout=2)
                conn.sendall(b'GET /api/health HTTP/1.1\r\n')
                held.append(conn)
            deadline = time.monotonic() + 3
            while server.slots._value and time.monotonic() < deadline:
                time.sleep(.01)
            with socket.create_connection(server.server_address, timeout=2) as extra:
                self.assertIn(b'503 Service Unavailable', extra.recv(512))
            for conn in held: conn.close()
            held.clear()
            deadline = time.monotonic() + 3
            while server.slots._value < 16 and time.monotonic() < deadline:
                time.sleep(.01)
            with urllib.request.urlopen('http://127.0.0.1:%d/api/health' % server.server_port) as r:
                self.assertEqual(json.load(r), {'ok': True})
        finally:
            for conn in held: conn.close()
            server.shutdown(); server.server_close(); worker.join()


if __name__ == '__main__':
    try:
        unittest.main(verbosity=2)
    finally:
        api.store._db.close()
        SCRATCH.cleanup()
