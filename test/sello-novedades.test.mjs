// Sello de versión con novedades (Merovingio, 06-10-2026): cargador común de la suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync(new URL('../assets/sello-novedades.js', import.meta.url), 'utf8');

test('el popover vive en body con position:fixed (ningún overflow de un padre lo recorta)', () => {
  assert.match(SRC, /#admira-sello-tip\{position:fixed/);
  assert.match(SRC, /document\.body\.appendChild\(t\)/);
  assert.match(SRC, /getBoundingClientRect/);
});

test('lee el /version.json del propio sitio, marca NUEVO por localStorage y muestra 2-4 líneas', () => {
  assert.match(SRC, /VERSION_URL = ds\.versionUrl \|\| '\/version\.json'/);
  assert.match(SRC, /admira-sello:visto/);
  assert.match(SRC, /\.slice\(0, 4\)/);
  assert.match(SRC, /NUEVO/);
});

test('se apaga en iframes, emisión y kiosco', () => {
  assert.match(SRC, /root\.top !== root/);
  assert.match(SRC, /canal\|player\|virtual-players\|wall\|signage/);
});

test('placeTip encaja el popover en el viewport', () => {
  const listeners = {};
  const doc = {
    readyState: 'complete', body: null, head: { appendChild() {} }, documentElement: { clientWidth: 400, clientHeight: 300, appendChild() {} },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} }),
    addEventListener() {}
  };
  const win = { document: doc, location: { search: '', pathname: '/' }, innerWidth: 400, innerHeight: 300, addEventListener: (k, f) => { listeners[k] = f; }, setTimeout: () => 0, setInterval: () => 0 };
  win.top = win;
  const ctx = vm.createContext(Object.assign(win, { window: win, setTimeout: () => 0, setInterval: () => 0, clearTimeout() {} }));
  vm.runInContext(SRC, ctx);
  const place = ctx.AdmiraSello._placeTip;
  const tip = { offsetWidth: 300, offsetHeight: 120, style: {} };
  // Sello pegado a la derecha y arriba: el tip no se sale ni por la derecha ni por arriba.
  const r = place({ getBoundingClientRect: () => ({ left: 380, right: 398, top: 4, bottom: 20 }) }, tip);
  assert.ok(r.left + r.width <= 400 - 8 + 0.5, 'derecha');
  assert.ok(r.top >= 8, 'arriba');
  // Sello abajo a la izquierda: el tip va encima.
  const r2 = place({ getBoundingClientRect: () => ({ left: 12, right: 120, top: 270, bottom: 288 }) }, tip);
  assert.equal(r2.top, 270 - 120 - 8);
  assert.equal(r2.left, 12);
});

function policy() {
  const doc = { readyState: 'loading', currentScript: {dataset:{}}, querySelector:()=>null, addEventListener(){} };
  const win = {document:doc,location:{search:'',pathname:'/'}}; win.top=win;
  const ctx=vm.createContext({window:win, document:doc, location:win.location}); vm.runInContext(SRC,ctx);
  return win.AdmiraSello._floatingPolicy;
}
test('Opciones abierto muestra su pie y nunca duplica la versión flotante', () => {
  assert.equal(policy()(true,true,true,false),false);
});
test('Opciones plegado oculta la versión después del primer aviso', () => {
  assert.equal(policy()(true,false,false,false),false);
});
test('novedad sin reconocer permite un primer aviso; leerlo y cerrarlo lo oculta', () => {
  const show=policy();
  assert.equal(show(true,false,true,false),true);
  assert.equal(show(true,false,false,true),true);
  assert.equal(show(true,false,false,false),false);
});
test('las páginas sin marco cuadrático conservan su versión', () => {
  assert.equal(policy()(false,false,false,false),true);
});
test('hidden vence al display propio de ambos sellos generados', () => {
  assert.match(SRC, /#admira-sello-chip\[hidden\],#admira-sello-options\[hidden\],\.ax-sello-outside\{display:none!important\}/);
});

test('a native footer stays empty until its own Options opener writes the version', () => {
  const intervals=[];
  const element=()=>{
    const classes=new Set(),children=[]; let value='';
    return {nodeType:1,isConnected:true,tagName:'SPAN',id:'',style:{},children,
      classList:{add:(c)=>classes.add(c),remove:(c)=>classes.delete(c),contains:(c)=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},
      get textContent(){return value+children.map(c=>c.textContent).join('');},
      set textContent(v){value=v;children.length=0;},
      getAttribute:()=>null,hasAttribute:()=>false,setAttribute(){},addEventListener(){},closest:()=>null,
      appendChild:(child)=>children.push(child),querySelector:()=>children.find(c=>c.className==='axs-nuevo')||null,
      getBoundingClientRect:()=>({left:8,right:160,top:260,bottom:290,width:152,height:30})};
  };
  const native=element(),panel=element(); native.classList.add('qm-version'); native.parentElement=panel;native.offsetParent=panel;panel.contains=(el)=>el===native;
  const doc={readyState:'complete',body:element(),head:{appendChild(){}},documentElement:element(),currentScript:{dataset:{}},
    querySelector:(selector)=>selector.includes('meta[name="admiranext-version"]')?{getAttribute:()=> 'v.06.10.2026.r1.07:40'}:selector.startsWith('[data-admira-options]')?panel:null,
    querySelectorAll:()=>[native],getElementById:()=>null,createElement:element,addEventListener(){}};
  const style=()=>({display:'block',visibility:'visible',opacity:'1',position:'static'});
  const win={document:doc,location:{search:'',pathname:'/'},innerWidth:400,innerHeight:300,getComputedStyle:style,addEventListener(){}};win.top=win;
  const ctx=vm.createContext({window:win,document:doc,location:win.location,getComputedStyle:style,
    fetch:()=>Promise.resolve({ok:false}),setTimeout:()=>0,clearTimeout(){},setInterval:(fn)=>intervals.push(fn),
    localStorage:{getItem:()=>null,setItem(){}}});
  vm.runInContext(SRC,ctx);
  assert.equal(native.textContent,'','the news marker must not block the native empty-footer guard');
  if(!native.textContent)native.textContent='v.06.10.2026.r1.07:40';
  intervals[1]();
  assert.equal(native.textContent,'v.06.10.2026.r1.07:40NUEVO');
  native.textContent='❔'; // Native layout measured before its version script loaded.
  intervals[1]();
  assert.equal(native.textContent,'v.06.10.2026.r1.07:40NUEVO','replace a placeholder with the verified site version');
});
