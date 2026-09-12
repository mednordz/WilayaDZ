/* Rive Canvas Lite 2.42.1. Only the fennec uses Rive at this stage.
   Runtime, WASM and artwork are embedded by build.py for offline/APK use. */
(function(){
  var active = new Map(), motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var configured = false, failed = false, queued = false;
  function bytes(value){
    return Uint8Array.from(atob(value), function(c){ return c.charCodeAt(0); }).buffer;
  }
  function release(stage){
    var record = active.get(stage);
    if(!record) return;
    active.delete(stage);
    clearTimeout(record.timeout);
    if(record.resize) record.resize.disconnect();
    if(record.view) record.view.disconnect();
    stage.removeEventListener('pointerdown', record.touch);
    stage.classList.remove('rive-ready');
    if(record.player) record.player.cleanup();
    record.canvas.remove();
  }
  function mount(stage){
    if(active.has(stage) || motion.matches || failed || !window.rive) return;
    if(!configured){
      try{
        window.rive.RuntimeLoader.setWasmBinary(bytes(RIVE_WASM));
        window.rive.RuntimeLoader.setWasmFallbackUrl(null);
        configured = true;
      }catch(e){failed=true;return;}
    }
    var canvas = document.createElement('canvas');
    canvas.className = 'mascot-rive-canvas'; canvas.setAttribute('aria-hidden','true');
    // Match the original image footprint; the artboard has 20 px of breathing room.
    var m = MASCOTS.fennec;
    canvas.style.width = (100*(m.w+40)/m.w)+'%';
    canvas.style.height = (100*(m.h+40)/m.h)+'%';
    canvas.style.left = (-2000/m.w)+'%'; canvas.style.top = (-2000/m.h)+'%';
    stage.appendChild(canvas);
    var record = {canvas:canvas, player:null, visible:false, loaded:false};
    active.set(stage, record);
    function alive(){ return active.get(stage) === record; }
    function rendering(){
      if(!alive() || !record.loaded) return;
      if(record.visible && !document.hidden && !motion.matches) record.player.startRendering();
      else record.player.stopRendering();
    }
    record.rendering = rendering;
    function react(name){
      if(!alive() || !record.loaded || !record.visible || document.hidden) return;
      var input = record.player.stateMachineInputs('Companion').find(function(i){return i.name===name;});
      if(input) input.fire();
    }
    record.touch = function(){ react('curious'); };
    stage.addEventListener('pointerdown', record.touch);
    record.timeout = setTimeout(function(){failed=true;release(stage);}, 12000);
    try{
      record.player = new window.rive.Rive({
        canvas:canvas, buffer:bytes(RIVE_FENNEC), stateMachine:'Companion', autoplay:true,
        enableRiveAssetCDN:false,
        onLoad:function(){
          if(!alive()) return;
          clearTimeout(record.timeout);
          record.loaded=true;
          record.player.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio||1,2));
          // Reveal only after the renderer has painted, retaining the static fallback until then.
          requestAnimationFrame(function(){requestAnimationFrame(function(){
            if(alive()) stage.classList.add('rive-ready');
          });});
          var rig=stage.querySelector('.mascot-rig');
          var mood=rig && rig.classList.contains('mascot-sad') ? 'encourage' :
            stage.closest('.lesson-footer-mascot') ? 'celebrate' : null;
          if(mood) react(mood);
          rendering();
        },
        onLoadError:function(){failed=true; release(stage);}
      });
      record.view = new IntersectionObserver(function(entries){
        record.visible=entries[0].isIntersecting; rendering();
      });
      record.view.observe(stage);
      record.resize = new ResizeObserver(function(){
        if(alive() && record.loaded) record.player.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio||1,2));
      });
      record.resize.observe(stage);
    }catch(e){failed=true;release(stage);}
  }
  function reconcile(){
    queued=false;
    active.forEach(function(record,stage){if(!stage.isConnected || motion.matches) release(stage);});
    if(!motion.matches && !failed) document.querySelectorAll('.mascot-stage[data-mascot="fennec"]').forEach(mount);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(reconcile);}}
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',function(){active.forEach(function(r){r.rendering();});});
  if(motion.addEventListener) motion.addEventListener('change',schedule);
  else motion.addListener(schedule);
  schedule();
})();
