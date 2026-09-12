/* Home now shows the approved book artwork. Exercise the retained mascot
   component independently, using its real template, renderer and assets. */
exports.mountMascotFixture=async page=>page.evaluate(()=>{
 const hero=document.getElementById('hero-card');
 hero.appendChild(hero.querySelector('template').content.cloneNode(true));
 const stage=hero.querySelector('.mascot-stage');
 stage.style.cssText='position:absolute;left:0;top:0;width:96px;height:96px;z-index:2';
});
