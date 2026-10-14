/* Shared navigation appearance. No authentication, console or command ownership. */
(function(G,D){
 'use strict';
 var host=location.hostname.replace(/^www\./,'');
 if(!/^(admira\.(studio|store|tv|app|biz)|pixeria\.com|xpaceos\.com|yokup\.com|clearchannel\.tv)$/.test(host)||G.AdmiraHeader)return;
 var controls='.pix-nav-icon-menu,.pix-nav-icon-advanced,.pix-nav-icon-expert,.pf-window-left,.pf-window-advanced,.pf-window-expert,[data-quad-toggle="left"],[data-quad-toggle="right"],[data-quad-toggle="bottom"],[data-quad-toggle="expert"],#header-menu-toggle,#header-advanced-toggle,#header-expert-toggle,#af-ico-left,#af-ico-right,#af-ico-bottom,#ykOptionsToggle,#ykAdvancedToggle,#ykExpertToggle,.yk-ico-opt,.yk-ico-left,.yk-ico-adv,.yk-ico-exp';
 var headers='.pf-topbar,.quad-top,.site-header,.topnav,.yk-topbar,.yk-top,header,#topBar';
 var brands='a.quad-brand,a.pf-topbar-brand,a.xs-brand,.logo-home,a.brand,a.yk-brand,a.site-logo';
 var style=D.createElement('style');style.id='admira-header-policy';style.textContent='[data-admira-compact-control]{zoom:.81!important} [data-admira-home-redundant]{display:none!important} :root[data-mb-marca][data-mb-plataforma="studio"] .pf-topbar .pf-topbar-brand .pf-brand-name{display:block!important;line-height:1.2!important} :root[data-mb-marca][data-mb-plataforma="studio"] .pf-topbar .pf-topbar-brand .pf-brand-name::before{content:"powered by"!important;display:block!important;line-height:1.2!important;margin-bottom:2px}' ;D.head.appendChild(style);
 function refresh(){
  D.querySelectorAll(controls).forEach(function(b){if(b.closest(headers)&&!b.hasAttribute('data-admira-compact-control'))b.setAttribute('data-admira-compact-control','');});
  D.querySelectorAll(headers).forEach(function(header){
   var logo=header.querySelector(brands);if(!logo)return;
   header.querySelectorAll('nav a,.pf-topbar-nav a,.quad-links a,.primary-nav a,.site-header .nav a,.quad-nav a,.site-nav a,.yk-nav a').forEach(function(a){
    if(a===logo||a.matches(brands))return;
    var text=(a.textContent||'').trim(),url;try{url=new URL(a.href,location.href);}catch(_){return;}
    if(!/^(inicio|home)$/i.test(text)||url.origin!==location.origin||!/^\/(en\/?)?$/.test(url.pathname)||url.hash)return;
    if(!logo.getAttribute('href')||logo.getAttribute('href')==='#')logo.href=url.href;
    if(!a.hasAttribute('data-admira-home-redundant'))a.setAttribute('data-admira-home-redundant','');
    a.setAttribute('aria-hidden','true');a.setAttribute('tabindex','-1');
   });
  });
 }
 var scheduled=false,observer=new MutationObserver(function(){if(scheduled)return;scheduled=true;G.requestAnimationFrame(function(){scheduled=false;refresh();});});
 G.AdmiraHeader=Object.freeze({refresh:refresh,version:'20261014-2',scale:.81});
 refresh();observer.observe(D.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','href','lang','data-quad-toggle']});
 G.addEventListener('pagehide',function(){observer.disconnect();},{once:true});
})(window,document);
