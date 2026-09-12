#!/usr/bin/env python3
"""Build the runtime .riv from the accepted head/body artwork. No editor login needed.
Wire schema: rive-app/rive-runtime generated headers; runtime major 7.
Rebuild after mascots_embedded.py. This is a runtime export, not a .rev editor project.
"""
import struct,json,base64,re,pathlib
root=pathlib.Path(__file__).resolve().parent
m=json.loads(re.search(r'fennec:(\{[^\n]*\})', (root/'p4i_mascots.js').read_text()).group(1))
def u(n):
 b=bytearray()
 while n>127:b.append((n&127)|128);n>>=7
 b.append(n);return bytes(b)
def v(x):
 if isinstance(x,float):return struct.pack('<f',x)
 if isinstance(x,str):x=x.encode()
 if isinstance(x,bytes):return u(len(x))+x
 return u(x)
b=bytearray(b'RIVE'+u(7)+u(0)+u(0)+u(0))
def o(t,**p):
 b.extend(u(t))
 for k,x in p.items():b.extend(u(int(k[1:]))+v(x))
 b.extend(b'\0')
o(23)
for i,k in enumerate(['body','head']):
 o(105,p203=k,p204=i,p207=float(m['h']),p208=float(m['w']))
 o(106,p212=base64.b64decode(m[k].split(',')[1]))
w,h=m['w'],m['h'];px,py=m['px'],m['py']
o(1,p4='Fennec',p7=float(w+40),p8=float(h+40))
o(2,p4='Body',p5=0,p13=(w+40)/2,p14=float(h+20))
o(100,p4='body',p5=1,p13=0.,p14=-h/2,p206=0)
o(2,p4='Head',p5=1,p13=(px-.5)*w,p14=(py-1)*h)
o(100,p4='head',p5=3,p13=(.5-px)*w,p14=(.5-py)*h,p206=1)
def anim(name,duration,loop,tracks):
 o(31,p55=name,p56=60,p57=duration,p59=loop)
 for obj,prop,keys in tracks:
  o(25,p51=obj);o(26,p53=prop)
  for f,x in keys:o(30,p67=f,p68=1,p70=float(x))
anim('Idle',240,1,[(1,17,[(0,1),(60,1.012),(120,1),(180,1.009),(240,1)]),(3,15,[(0,0),(60,-.025),(120,0),(180,.025),(240,0)])])
anim('Celebrate',72,0,[(1,14,[(0,h+20),(16,h+6),(30,h+20),(44,h+13),(60,h+20),(72,h+20)]),(3,15,[(0,0),(18,-.12),(40,.07),(72,0)])])
anim('Encourage',84,0,[(3,15,[(0,0),(25,.10),(50,.07),(84,0)]),(1,17,[(0,1),(25,.98),(84,1)])])
anim('Curious',100,0,[(3,15,[(0,0),(25,-.10),(55,-.10),(100,0)])])
o(53,p55='Companion')
for name in ['celebrate','encourage','curious']:o(58,p138=name)
o(57,p138='Reactions')
o(62)
for i in range(3):
 o(65,p151=4+i,p158=120);o(68,p155=i)
o(63);o(65,p151=3)
o(64)
for i in range(4):
 o(61,p149=i)
 if i:o(65,p151=3,p152=12,p160=100,p158=150)
dest=root/'assets/rive';dest.mkdir(parents=True,exist_ok=True);(dest/'fennec.riv').write_bytes(b)
print(len(b))
