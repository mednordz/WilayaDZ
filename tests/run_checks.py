"""Validation locale/CI isolée. Aucun compte ni service de production."""
import os, pathlib, shutil, subprocess, sys, tempfile, time, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT)
def run(*cmd,env=None): subprocess.run(cmd,check=True,env=env,timeout=180)
run(sys.executable,'tests/check_secrets.py')
run(sys.executable,'app/build.py')
run('node','--check','app/_check.js')
run('node','tests/test_sync.js')
run(sys.executable,'tests/test_payload.py')
run(sys.executable,'tests/test_production.py')
run(sys.executable,'tests/test_api.py')
# Quelques anciens tests utilisent ce chemin ; la copie est toujours reconstruite.
legacy=pathlib.Path('/tmp/wilayas');legacy.mkdir(exist_ok=True)
for name in ['wilaya-v6.html','sw.js']: shutil.copy2(ROOT/'app'/name,legacy/name)
for test in ['test_map','test_design_pages','test_visual_parcours','test_ladder','test_rive']:
    run('node',f'tests/{test}.js')
with tempfile.TemporaryDirectory(prefix='wilayadz-checks-') as tmp:
    env=dict(os.environ,WILAYA_DB=tmp+'/test.sqlite3',BASE='http://127.0.0.1:8390/',APP_URL='http://127.0.0.1:8390')
    with open(tmp+'/server.log','w') as log:
        server=subprocess.Popen([sys.executable,'tests/serve_test.py','8390'],env=env,stdout=log,stderr=log)
        try:
            for _ in range(100):
                if server.poll() is not None: raise RuntimeError('Le serveur de test a quitté')
                try:
                    with urllib.request.urlopen(env['BASE']+'api/health',timeout=.3): break
                except OSError: time.sleep(.1)
            else: raise RuntimeError('Serveur de test indisponible')
            for test in ['test_cloud_e2e','audit_a11y_cloud','test_musique','test_resilience']:
                run('node',f'tests/{test}.js',env=env)
        finally:
            server.terminate()
            try: server.wait(timeout=5)
            except subprocess.TimeoutExpired: server.kill();server.wait()
print('Tous les contrôles obligatoires sont passés.')
