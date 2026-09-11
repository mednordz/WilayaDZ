import os, re, sys
os.chdir('/tmp/wilayas')
def R(p): return open(p, encoding='utf-8').read()
face = R('font_face.css') if os.path.exists('font_face.css') else ''
out = "".join([R('p0_head.html'), "<style>\n", face, R('p1_css.css'), R('p2_css_add.css'), "\n</style>\n\n",
  R('p3_body.html'), "\n\n<script>\n(function(){\n  \"use strict\";\n",
  R('part_data.js'), R('p4i_mascots.js'), R('p4a_core.js'), R('p4f_i18n.js'), R('p4g_account.js'),
  R('p4b_exercises.js'), R('p4c_session.js'), R('p4d_path.js'), R('p4h_profileui.js'),
  R('p4e_practice.js'), "\n})();\n</script>\n"])
target = sys.argv[1] if len(sys.argv) > 1 else 'wilaya-v6.html'
open(target,'w',encoding='utf-8').write(out)
open('_check.js','w',encoding='utf-8').write(re.search(r'<script>(.*)</script>', out, re.S).group(1))
print("%s : %d octets%s" % (target, len(out), "  (police intégrée)" if face else "  (police NON intégrée)"))
