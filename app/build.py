import os, re, sys, shutil, base64, json, gzip, xml.etree.ElementTree as ET
os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
def R(p): return open(p, encoding='utf-8').read()
# Canvas Lite is pinned and embedded: no CDN, including in the APK/file build.
def B(p): return base64.b64encode(open(p, 'rb').read()).decode('ascii')
rive_bundle = "\n/*\n" + R('vendor/rive/LICENSE') + "\n*/\n(function(){\n" + R('vendor/rive/rive.js') + "\n}).call(window);\n"
rive_bundle += "var RIVE_WASM='" + B('vendor/rive/rive.wasm') + "';\n"
rive_bundle += "var RIVE_MASCOTS={" + ','.join(name+":'"+B('assets/rive/'+name+'.riv')+"'" for name in ['fennec','cigogne']) + "};\n"
face = R('font_face.css') if os.path.exists('font_face.css') else ''
# Existing community geometry, with the last eleven IDs matched by name
# to this project's dataset. Keep provenance and the upstream IDs in the SVG.
map_root = ET.fromstring(R('assets/maps/algeria69.svg'))
map_shapes = [{'code': int(p.attrib['id'].split('-')[-1]),
               'sourceCode': int(p.attrib['data-source-code']), 'd': p.attrib['d']}
              for p in map_root.iter('{http://www.w3.org/2000/svg}path')]
if sorted(p['code'] for p in map_shapes) != list(range(1, 70)):
    raise SystemExit('La carte doit contenir exactement les codes 01–69.')
map_bundle = 'var WILAYA_SHAPES=' + json.dumps(map_shapes, separators=(',', ':')) + ';\n'
map_bundle += "var WILAYA_PANORAMA='data:image/webp;base64," + B('assets/illustrations/panorama-algerien.webp') + "';\n"
map_bundle += "var WILAYA_REVISION=" + json.dumps(os.environ.get("APP_REVISION", "development")) + ";\n"
patio_css = R('patio.css')
for asset in sorted(['architecture','logo','frise','medaillon','carte','enduit','flamme','diamant','musique','reglages','carte-icone'], key=len, reverse=True):
    patio_css = patio_css.replace('PATIO_'+asset.upper().replace('-','_'), 'data:image/webp;base64,'+B('assets/patio/'+asset+'.webp'))
parcours_css = R('parcours.css').replace('PARCOURS_MEDAILLON', 'data:image/webp;base64,'+B('assets/patio/noeud-faience.webp'))
# The old banner remains in source assets, but is no longer loaded by this design.
kit_bundle = re.sub(r'^    banniere:.*\n', '', R('p4o_kit.js'), flags=re.M)
out = "".join([R('p0_head.html'), "<style>\n", face, R('p1_css.css'), R('p2_css_add.css'), R('settings.css').replace('PATIO_IMAGE', 'data:image/webp;base64,' + B('assets/illustrations/patio-casbah.webp')).replace('TILE_IMAGE', 'data:image/webp;base64,' + B('assets/illustrations/ceramique-algeroise.webp')), patio_css, parcours_css, R('pilot.css'), "\n</style>\n\n",
  R('p3_body.html'), "\n\n<script>\n(function(){\n  \"use strict\";\n",
  rive_bundle, R('part_data.js'), R('p4i_mascots.js'), R('qr_lib.js'), R('preferences.js'), R('p4a_core.js'), R('p4f_i18n.js'), R('p4g_account.js'),
  R('p4b_exercises.js'), R('pilot.js'), R('p4c_session.js'), R('p4d_path.js'), R('p4h_profileui.js'),
  kit_bundle, R('p4k_cloud.js'), R('p4m_google.js'), R('p4n_avatar.js'), R('p4l_cloudui.js'),
  R('p4q_rive.js'), R('p4p_musique.js'), map_bundle, R('p4r_map.js'), R('settings.js'), R('connection_methods.js'), R('patio.js'), R('p4e_practice.js'), R('p4j_pwa.js'), "\n})();\n</script>\n"])
target = sys.argv[1] if len(sys.argv) > 1 else 'wilaya-v6.html'
open(target,'w',encoding='utf-8').write(out)
with open(target+'.gz','wb') as compressed:
    compressed.write(gzip.compress(out.encode('utf-8'), compresslevel=9, mtime=0))
open('_check.js','w',encoding='utf-8').write(re.search(r'<script>(.*)</script>', out, re.S).group(1))
# sw.js doit rester un fichier à part (un service worker ne peut pas
# s'enregistrer depuis un <script> inline) : copié à côté du HTML produit,
# jamais concaténé dedans.
target_dir = os.path.dirname(os.path.abspath(target)) or '.'
sw_dest = os.path.join(target_dir, 'sw.js')
if os.path.abspath(sw_dest) != os.path.abspath('sw.js'):
    shutil.copyfile('sw.js', sw_dest)
print("%s : %d octets%s" % (target, len(out), "  (police intégrée)" if face else "  (police NON intégrée)"))
