#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" != 0 ]; then
  echo 'Installation système : exécuter avec sudo.' >&2
  exit 1
fi
command -v gpg >/dev/null
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
install -m 755 "$ops_source/backup.py" "$ops_source/monitor.py" /opt/wilayadz-ops/
install -m 644 "$ops_source"/*.service "$ops_source"/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now wilayadz-backup.timer wilayadz-monitor.timer
