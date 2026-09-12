#!/usr/bin/env python3
"""Construit les calques articulés depuis les PNG transparents du projet.

ImageMagick effectue uniquement le cadrage, la réduction et la séparation
des calques. Les dessins ont été créés avec image_gen. Aucun modèle distant
n'est requis pour reconstruire les assets déjà acceptés.
"""
from pathlib import Path
import base64, json, subprocess, tempfile

APP=Path(__file__).resolve().parent
SOURCE=APP/'assets/mascottes'
RIG={
    'fennec':(.60,.10,.44,.62),
    'chameau':(.47,.09,.52,.49),
    'cigogne':(.46,.09,.46,.48),
    'palmier':(.62,.08,.48,.64),
}

def run(*args):
    return subprocess.run(args,check=True,capture_output=True,text=True).stdout.strip()

def main():
    entries=[]
    with tempfile.TemporaryDirectory() as tmp:
        for name,(cut,tongue,px,py) in RIG.items():
            src=SOURCE/(name+'.png')
            # Les quelques pixels d'alpha <2% hors du sujet ne doivent
            # pas agrandir le cadrage ni produire un voile sur fond sombre.
            full=Path(tmp)/(name+'.png')
            run('magick',str(src),'-channel','A','-level','2%,100%','+channel','-trim','+repage','-resize','x340',str(full))
            w,h=map(int,run('magick','identify','-format','%w %h',str(full)).split())
            layers={}
            for layer,y0,y1 in [('head',round((cut+tongue)*h),h),('body',0,round(cut*h)-1)]:
                dest=Path(tmp)/(name+'-'+layer+'.webp')
                run('magick',str(full),'(','+clone','-alpha','extract','-fill','black','-draw',f'rectangle 0,{y0} {w},{y1}',')','-alpha','off','-compose','CopyOpacity','-composite','-quality','88',str(dest))
                layers[layer]='data:image/webp;base64,'+base64.b64encode(dest.read_bytes()).decode()
            portrait=Path(tmp)/(name+'-portrait.webp')
            run('magick',str(Path(tmp)/(name+'-head.webp')),'-trim','+repage','-resize','160x160','-quality','88',str(portrait))
            layers['portrait']='data:image/webp;base64,'+base64.b64encode(portrait.read_bytes()).decode()
            entries.append(name+':'+json.dumps(dict(w=w,h=h,px=px,py=py,**layers),separators=(',',':')))
            print(name,w,h)
    (APP/'p4i_mascots.js').write_text('/* Généré par app/mascots_embedded.py — ne pas éditer. */\nvar MASCOTS={\n'+',\n'.join(entries)+'\n};\n')

if __name__=='__main__':main()
