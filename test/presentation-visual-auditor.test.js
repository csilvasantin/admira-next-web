import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const auditorSource=await readFile(new URL('../assets/presentation-visual-auditor.js',import.meta.url),'utf8');
const sandbox={window:{},URLSearchParams,setTimeout,clearTimeout};
sandbox.window.window=sandbox.window;
vm.runInNewContext(auditorSource,sandbox);
const auditor=sandbox.window.AdmiraPresentationVisualAuditor;

class MockClassList{
  constructor(element){this.element=element;}
  values(){return String(this.element.className||'').split(/\s+/).filter(Boolean);}
  contains(value){return this.values().includes(value);}
  add(value){if(!this.contains(value))this.element.className=[...this.values(),value].join(' ');}
  remove(value){this.element.className=this.values().filter(item=>item!==value).join(' ');}
}

class MockElement{
  constructor(tagName,options={}){
    this.nodeType=1;
    this.tagName=String(tagName).toUpperCase();
    this.id=options.id||'';
    this.className=options.className||'';
    this.textContent=options.textContent||'';
    this.style={
      display:'block',visibility:'visible',opacity:'1',color:'rgb(0, 0, 0)',
      backgroundColor:'rgba(0, 0, 0, 0)',fontSize:'24px',fontWeight:'400',
      lineHeight:'29px',overflowX:'visible',overflowY:'visible',position:'static',
      objectFit:'contain',...(options.style||{})
    };
    this.rect=options.rect||{left:100,top:100,width:200,height:50,right:300,bottom:150};
    this.clientWidth=options.clientWidth??this.rect.width;
    this.clientHeight=options.clientHeight??this.rect.height;
    this.scrollWidth=options.scrollWidth??this.clientWidth;
    this.scrollHeight=options.scrollHeight??this.clientHeight;
    this.complete=options.complete??true;
    this.naturalWidth=options.naturalWidth??this.rect.width;
    this.naturalHeight=options.naturalHeight??this.rect.height;
    this.children=[];
    this.parentElement=null;
    this.attributes=new Map();
    this.listeners=new Map();
    this.classList=new MockClassList(this);
    Object.entries(options.attributes||{}).forEach(([name,value])=>this.setAttribute(name,value));
  }
  appendChild(child){child.parentElement=this;this.children.push(child);return child;}
  removeChild(child){this.children=this.children.filter(value=>value!==child);child.parentElement=null;}
  remove(){if(this.parentElement)this.parentElement.removeChild(this);}
  get firstChild(){return this.children[0]||null;}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==='id')this.id=String(value);if(name==='class')this.className=String(value);}
  getAttribute(name){if(name==='id')return this.id||null;if(name==='class')return this.className||null;return this.attributes.has(name)?this.attributes.get(name):null;}
  hasAttribute(name){return (name==='id'&&Boolean(this.id))||(name==='class'&&Boolean(this.className))||this.attributes.has(name);}
  addEventListener(name,handler){this.listeners.set(name,handler);}
  click(){this.listeners.get('click')?.({target:this});}
  getBoundingClientRect(){return {...this.rect};}
  matches(selector){
    selector=selector.trim().replace(/:nth-of-type\(\d+\)$/,'');
    if(selector==='*')return true;
    if(selector.startsWith('#'))return this.id===selector.slice(1);
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
    const attr=selector.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
    if(attr)return this.hasAttribute(attr[1])&&(attr[2]===undefined||this.getAttribute(attr[1])===attr[2]);
    return this.tagName===selector.toUpperCase();
  }
  closest(selector){
    let current=this;
    const selectors=selector.split(',');
    while(current){
      if(selectors.some(value=>current.matches(value)))return current;
      current=current.parentElement;
    }
    return null;
  }
  querySelectorAll(selector){
    const selectors=selector.split(',').map(value=>value.trim());
    const found=[];
    const visit=node=>{
      node.children.forEach(child=>{
        if(selectors.some(value=>child.matches(value)))found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  scrollIntoView(options){this.scrolledWith=options;}
}

class MockDocument{
  constructor(slides=[]){
    this.root=new MockElement('main');
    slides.forEach(slide=>this.root.appendChild(slide));
    this.defaultView={
      location:{search:''},
      getComputedStyle:element=>element.style,
      matchMedia:()=>({matches:false})
    };
  }
  createElement(tagName){return new MockElement(tagName);}
  querySelectorAll(selector){return this.root.querySelectorAll(selector);}
  querySelector(selector){return this.root.querySelector(selector);}
  getElementById(id){return this.querySelector('#'+id);}
}

function element(tagName,options,children=[]){
  const node=new MockElement(tagName,options);
  children.forEach(child=>node.appendChild(child));
  return node;
}

function slide(children=[],options={}){
  return element('section',{className:'slide',rect:{left:0,top:0,width:1000,height:600,right:1000,bottom:600},style:{backgroundColor:'rgb(255, 255, 255)'},...options},children);
}

function auditSlides(slides,options={}){
  const document=new MockDocument(slides);
  return {document,result:auditor.audit({document,window:document.defaultView,...options})};
}

test('visual auditor exposes deterministic color and contrast primitives',()=>{
  assert.equal(JSON.stringify(auditor.parseColor('rgba(255, 0, 12, .5)')),JSON.stringify({r:255,g:0,b:12,a:.5}));
  assert.equal(auditor.parseColor('transparent'),null);
  assert.equal(auditor.contrastRatio({r:0,g:0,b:0},{r:255,g:255,b:255}),21);
  assert.equal(auditor.VERSION,1);
});

test('visual auditor is local, deterministic and excludes private presenter data',async()=>{
  const source=auditorSource;
  assert.doesNotThrow(()=>new Function(source));
  assert.match(source,/contrast/);
  assert.match(source,/media/);
  assert.match(source,/overflow/);
  assert.match(source,/legibility/);
  assert.match(source,/density/);
  assert.match(source,/safe-area/);
  assert.match(source,/blocking/);
  assert.match(source,/warning/);
  assert.match(source,/data-speaker-notes/);
  assert.match(source,/data-presenter-private/);
  assert.match(source,/audience-mode/);
  assert.match(source,/pixel|píxel/i);
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage/);
  assert.doesNotMatch(source,/speakerNotes|__ADMIRA_PRESENTER_NOTES__|innerHTML/);
});

test('visual auditor integration is private, supports rerun and navigation, and never loads for audience output',async()=>{
  const [source,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-visual-auditor.css',import.meta.url),'utf8')
  ]);
  assert.match(source,/function initializeVisualAuditor/);
  assert.match(source,/if \(remoteMode \|\| audienceMode/);
  assert.match(source,/presentation-visual-auditor\.js/);
  assert.match(source,/presentation-visual-auditor\.css/);
  assert.match(source,/auditor\.mount\(\{/);
  assert.match(source,/onNavigate: function \(index\)/);
  assert.match(source,/goLocal\(currentIndex, true\)/);
  assert.match(styles,/\.presenter-visual-auditor\[data-audit-state="blocked"\]/);
  assert.match(styles,/\.presenter-visual-auditor\[data-audit-state="warning"\]/);
  assert.match(styles,/\.visual-audit-target/);
});

test('DOM harness distinguishes low contrast from compliant large and normal text',()=>{
  const low=element('p',{id:'low',textContent:'Texto gris ilegible',style:{color:'rgb(150, 150, 150)',fontSize:'16px'}});
  const high=element('p',{id:'high',textContent:'Texto negro legible',style:{color:'rgb(0, 0, 0)',fontSize:'16px'}});
  const large=element('h2',{id:'large',textContent:'Titular grande',style:{color:'rgb(120, 120, 120)',fontSize:'28px',fontWeight:'700'}});
  const {result}=auditSlides([slide([low,high,large])]);
  assert.ok(result.issues.some(issue=>issue.rule==='contrast'&&issue.selector==='#low'));
  assert.ok(!result.issues.some(issue=>issue.rule==='contrast'&&issue.selector==='#high'));
  assert.ok(!result.issues.some(issue=>issue.rule==='contrast'&&issue.selector==='#large'));
});

test('DOM harness reports broken, low-resolution and missing-alt images without penalizing decorative media',()=>{
  const broken=element('img',{id:'broken',complete:true,naturalWidth:0,naturalHeight:0,attributes:{alt:'Captura rota'}});
  const lowResolution=element('img',{id:'small',complete:true,naturalWidth:100,naturalHeight:50,rect:{left:100,top:200,width:300,height:150,right:400,bottom:350},attributes:{alt:'Captura pequeña'}});
  const noAlt=element('img',{id:'no-alt',complete:true,naturalWidth:300,naturalHeight:150});
  const decorative=element('img',{id:'decorative',complete:true,naturalWidth:300,naturalHeight:150,attributes:{'aria-hidden':'true'}});
  const {result}=auditSlides([slide([broken,lowResolution,noAlt,decorative])]);
  assert.ok(result.issues.some(issue=>issue.selector==='#broken'&&issue.title==='Imagen no disponible'&&issue.severity==='blocking'));
  assert.ok(result.issues.some(issue=>issue.selector==='#small'&&issue.title==='Resolución de imagen limitada'));
  assert.ok(result.issues.some(issue=>issue.selector==='#no-alt'&&issue.title==='Imagen sin alternativa'));
  assert.ok(!result.issues.some(issue=>issue.selector==='#decorative'&&issue.title==='Imagen sin alternativa'));
});

test('DOM harness covers clipping, typography, density, safe area and composition severity',()=>{
  const clipped=element('div',{id:'clipped',clientWidth:100,scrollWidth:160,style:{overflowX:'hidden'}});
  const tiny=element('p',{id:'tiny',textContent:'Texto microscópico',style:{fontSize:'12px',lineHeight:'12px'}});
  const edge=element('p',{id:'edge',textContent:'Demasiado cerca del borde',rect:{left:10,top:100,width:200,height:50,right:210,bottom:150}});
  const beyond=element('img',{id:'beyond',rect:{left:900,top:200,width:150,height:100,right:1050,bottom:300},naturalWidth:150,naturalHeight:100,attributes:{alt:'Fuera del lienzo'}});
  const dense=Array.from({length:19},(_,index)=>element('p',{id:'dense-'+index,textContent:'Bloque '+index,style:{fontSize:'24px'}}));
  const {result}=auditSlides([slide([clipped,tiny,edge,beyond,...dense])]);
  assert.ok(result.issues.some(issue=>issue.selector==='#clipped'&&issue.rule==='overflow'&&issue.severity==='blocking'));
  assert.ok(result.issues.some(issue=>issue.selector==='#tiny'&&issue.rule==='legibility'&&issue.severity==='blocking'));
  assert.ok(result.issues.some(issue=>issue.selector==='#edge'&&issue.rule==='safe-area'&&issue.severity==='warning'));
  assert.ok(result.issues.some(issue=>issue.selector==='#beyond'&&issue.rule==='safe-area'&&issue.severity==='blocking'));
  assert.ok(result.issues.some(issue=>issue.rule==='density'&&issue.severity==='blocking'));
});

test('DOM harness suppresses private, hidden and fixed-position false positives',()=>{
  const privatePanel=element('aside',{attributes:{'data-presenter-private':''}},[
    element('p',{id:'private-low',textContent:'Nota privada',style:{color:'rgb(180, 180, 180)',fontSize:'10px'}})
  ]);
  const hidden=element('p',{id:'hidden-low',textContent:'Oculto',style:{display:'none',color:'rgb(180, 180, 180)',fontSize:'10px'}});
  const fixed=element('p',{id:'fixed-edge',textContent:'Control flotante',rect:{left:-30,top:0,width:100,height:30,right:70,bottom:30},style:{position:'fixed'}});
  const clean=element('p',{id:'clean',textContent:'Contenido correcto',style:{color:'rgb(0, 0, 0)',fontSize:'24px'}});
  const {result}=auditSlides([slide([privatePanel,hidden,fixed,clean])]);
  assert.ok(!result.issues.some(issue=>['#private-low','#hidden-low','#fixed-edge','#clean'].includes(issue.selector)));
});

test('decorative full-bleed media is not treated as unsafe content',()=>{
  const backdrop=element('img',{
    id:'full-bleed-decoration',
    rect:{left:0,top:0,width:1000,height:600,right:1000,bottom:600},
    naturalWidth:1000,
    naturalHeight:600,
    attributes:{'aria-hidden':'true'}
  });
  const {result}=auditSlides([slide([backdrop])]);
  assert.ok(!result.issues.some(issue=>issue.selector==='#full-bleed-decoration'&&issue.rule==='safe-area'));
});

test('audience=1 short-circuits before inspecting private or public DOM',()=>{
  const dangerous=element('p',{id:'dangerous',textContent:'No debe inspeccionarse',style:{color:'rgb(200, 200, 200)',fontSize:'10px'}});
  dangerous.getBoundingClientRect=()=>{throw new Error('auditor touched audience DOM');};
  const {result}=auditSlides([slide([dangerous])],{search:'?deck=x&audience=1'});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{version:1,skipped:true,reason:'audience-mode',slides:0,blocking:0,warnings:0,issues:[]});
});

test('mount supports keyboard-focusable controls, rerun and issue navigation',()=>{
  const low=element('p',{id:'navigable',textContent:'Contraste insuficiente',style:{color:'rgb(160, 160, 160)',fontSize:'16px'}});
  const deck=slide([low]);
  const document=new MockDocument([deck]);
  const panel=element('aside',{id:'admiraPresenterPanel'});
  document.root.appendChild(panel);
  const navigated=[];
  const mounted=auditor.mount({document,container:panel,onNavigate:index=>navigated.push(index)});
  const run=document.getElementById('presenterVisualAuditRun');
  assert.equal(run.tagName,'BUTTON');
  assert.equal(run.type,'button');
  assert.equal(document.getElementById('presenterVisualAuditState').getAttribute('aria-live'),'polite');
  run.click();
  assert.equal(run.disabled,false);
  assert.equal(run.textContent,'Repetir auditoría');
  const issueButton=document.getElementById('presenterVisualAuditIssues').querySelector('button');
  assert.ok(issueButton);
  issueButton.click();
  assert.deepEqual(navigated,[0]);
  assert.equal(low.classList.contains('visual-audit-target'),true);
  mounted.run();
  assert.equal(document.querySelectorAll('#presenterVisualAuditor').length,1);
  mounted.destroy();
  assert.equal(document.getElementById('presenterVisualAuditor'),null);
});

test('responsive and reduced-motion CSS avoids fixed panel widths and disables target animation',async()=>{
  const styles=await readFile(new URL('../assets/presentation-visual-auditor.css',import.meta.url),'utf8');
  assert.match(styles,/\.presenter-visual-audit-issues\{[^}]*max-height:320px[^}]*overflow:auto/);
  assert.match(styles,/\.presenter-visual-audit-issues button\{[^}]*width:100%/);
  assert.doesNotMatch(styles,/\.presenter-visual-auditor\{[^}]*\bwidth:\s*\d+px/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)\{\.visual-audit-target\{animation:none\}\}/);
});
