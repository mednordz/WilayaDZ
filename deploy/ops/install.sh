#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" != 0 ]; then
  echo 'Installation système : exécuter avec sudo.' >&2
  exit 1
fi
command -v gpg >/dev/null
command -v rclone >/dev/null
# Ne pas activer un dispositif qui n'a pas encore de connexion Google dédiée.
test -s /etc/wilayadz/drive.json
python3 - <<'PY'
import json, pathlib
c = json.loads(pathlib.Path('/etc/wilayadz/drive.json').read_text())
p = pathlib.Path(c['rclone_config'])
assert p.is_file() and not p.stat().st_mode & 0o077, 'Configuration OAuth privée requise'
PY
ops_source="$(cd "$(dirname "$0")" && pwd)"
install -d -m 700 /etc/wilayadz /var/lib/wilayadz-ops
install -d -m 755 /opt/wilayadz-ops
# Création unique ; les mises à jour ne remplacent JAMAIS la clé.
python3 - <<'PY'
import os, secrets
try:
    fd = os.open('/etc/wilayadz/backup.key', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    pass
else:
    with os.fdopen(fd, 'w') as f:
        f.write(secrets.token_urlsafe(48) + '\n')
PY
install -m 755 "$ops_source/backup.py" "$ops_source/export_backup.py" "$ops_source/drive_backup.py" "$ops_source/monitor.py" /opt/wilayadz-ops/
install -m 644 "$ops_source"/*.service "$ops_source"/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now wilayadz-backup.timer wilayadz-monitor.timer
