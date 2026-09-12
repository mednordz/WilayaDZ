"""Garde contre la republication de matériel privé, sans afficher de secret."""
import pathlib,re,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
paths=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
bad=[]
for name in filter(None,paths):
    if name.startswith('.local-ops/') or name.endswith('/backup.key'):
        bad.append(name);continue
    p=root/name
    if not p.is_file(): continue
    if p.suffix.lower() in {'.jks','.keystore','.p12','.pfx'}:
        bad.append(name);continue
    if p.stat().st_size>2_000_000: continue
    data=p.read_bytes()
    if (re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',data)
        or (name=='PROJECT_NOTES.md' and re.search(rb'Mot de passe\s*:\s*`[^`]+`',data))):
        bad.append(name)
if bad:
    print('Matériel sensible interdit dans Git : '+', '.join(bad));sys.exit(1)
print('Contrôle des fichiers sensibles : OK')
