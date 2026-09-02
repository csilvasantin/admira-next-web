(function(){
  'use strict';
  if(document.documentElement.classList.contains('presenter-audience-mode')||document.documentElement.classList.contains('presenter-remote-mode'))return;

  var selector='.languages,.section-nav,.nav,.quality-levels,.presenter-launch';
  var labels={
    es:{move:'Mover control',close:'Ocultar control'},
    ca:{move:'Moure control',close:'Amagar control'},
    en:{move:'Move control',close:'Hide control'}
  };
  var shells=[];

  function language(){
    var state=window.__ADMIRA_PRESENTATION_STATE__;
    return labels[state&&state.language]?state.language:(labels[document.documentElement.lang]?document.documentElement.lang:'es');
  }
  function localize(shell){
    var copy=labels[language()]||labels.es,handle=shell.querySelector('.presentation-floating-handle'),close=shell.querySelector('.presentation-floating-close');
    handle.setAttribute('aria-label',copy.move);handle.title=copy.move;
    close.setAttribute('aria-label',copy.close);close.title=copy.close;
  }
  function clamp(shell,left,top){
    var width=shell.offsetWidth||1,height=shell.offsetHeight||1,pad=6;
    return {left:Math.max(pad,Math.min(innerWidth-width-pad,left)),top:Math.max(pad,Math.min(innerHeight-height-pad,top))};
  }
  function place(shell,left,top){
    var point=clamp(shell,left,top);
    shell.style.left=point.left+'px';shell.style.top=point.top+'px';shell.style.right='auto';shell.style.bottom='auto';shell.style.transform='none';
  }
  function moveBy(shell,dx,dy){var rect=shell.getBoundingClientRect();place(shell,rect.left+dx,rect.top+dy)}
  function mount(target){
    if(!target||target.dataset.floatingLabel==='ready'||target.closest('.presentation-floating-shell'))return;
    var rect=target.getBoundingClientRect(),shell=document.createElement('div'),handle=document.createElement('button'),close=document.createElement('button');
    target.dataset.floatingLabel='ready';shell.className='presentation-floating-shell';shell.dataset.floatingKind=target.id||target.className.split(/\s+/)[0]||'control';
    handle.type='button';handle.className='presentation-floating-handle';handle.textContent='⠿';
    close.type='button';close.className='presentation-floating-close';close.textContent='×';
    target.parentNode.insertBefore(shell,target);shell.append(target,handle,close);shells.push(shell);place(shell,rect.left,rect.top);localize(shell);
    handle.addEventListener('pointerdown',function(event){
      if(event.button!==0)return;event.preventDefault();event.stopPropagation();
      var start=shell.getBoundingClientRect(),originX=event.clientX,originY=event.clientY;shell.dataset.floatingDragging='true';handle.setPointerCapture?.(event.pointerId);
      function moving(next){place(shell,start.left+next.clientX-originX,start.top+next.clientY-originY)}
      function done(){shell.dataset.floatingDragging='false';handle.removeEventListener('pointermove',moving);handle.removeEventListener('pointerup',done);handle.removeEventListener('pointercancel',done)}
      handle.addEventListener('pointermove',moving);handle.addEventListener('pointerup',done);handle.addEventListener('pointercancel',done);
    });
    handle.addEventListener('keydown',function(event){
      var step=event.shiftKey?24:8,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
      if(!delta)return;event.preventDefault();moveBy(shell,delta[0],delta[1]);
    });
    close.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();shell.hidden=true});
  }
  function scan(root){
    if(root&&root.matches&&root.matches(selector))mount(root);
    if(root&&root.querySelectorAll)root.querySelectorAll(selector).forEach(mount);
  }
  function localizeAll(){shells.forEach(localize)}
  scan(document);
  new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType===1)scan(node)})})}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('admira:language',localizeAll);
  addEventListener('resize',function(){shells.filter(function(shell){return!shell.hidden}).forEach(function(shell){var rect=shell.getBoundingClientRect();place(shell,rect.left,rect.top)})},{passive:true});
}());
