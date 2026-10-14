import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../suite/header.js',import.meta.url),'utf8');
function fixture(host){
 const node=(text='',href)=>({textContent:text,href,attrs:new Map(href?[['href',href]]:[]),setAttribute(k,v){this.attrs.set(k,v);},hasAttribute(k){return this.attrs.has(k);},getAttribute(k){return this.attrs.get(k)||null;},matches(){return false;},closest(){return header;}});
 const logo=node('Starbucks','/'),home=node('Inicio','https://'+host+'/'),creator=node('Creador','https://'+host+'/creador/'),external=node('Home','https://example.org/');
 const controls=[node(),node(),node()];controls[0].onclick=()=>42;
 const header={querySelector:()=>logo,querySelectorAll:()=>[home,creator,external]};
 const styles=[],document={head:{appendChild:n=>styles.push(n)},documentElement:{},createElement:()=>({}),querySelectorAll:s=>s.startsWith('.pix-nav-icon')?controls:[header]};
 let changed;
 const sandbox={document,location:{hostname:host,origin:'https://'+host,href:'https://'+host+'/'},URL,MutationObserver:class{constructor(fn){changed=fn;}observe(){}disconnect(){}},requestAnimationFrame:fn=>fn(),addEventListener(){}};sandbox.window=sandbox;
 const run=()=>vm.runInNewContext(src,sandbox);run();return {sandbox,controls,logo,home,creator,external,styles,run,changed};
}
test('the five product hosts and four clones share exactly one 90% policy',()=>{
 for(const host of ['admira.studio','admira.store','admira.tv','admira.app','admira.biz','pixeria.com','xpaceos.com','yokup.com','clearchannel.tv']){
  const f=fixture(host);assert.equal(f.sandbox.AdmiraHeader.scale,.9);assert.equal(f.styles.length,1);assert(f.styles[0].textContent.includes('zoom:.9!important'));assert(f.controls.every(n=>n.hasAttribute('data-admira-compact-control')));assert.equal(f.controls[0].onclick(),42);f.run();assert.equal(f.styles.length,1);
 }
});
test('only local redundant top Home is hidden; logo and all other destinations survive',()=>{
 const f=fixture('admira.studio');assert(f.home.hasAttribute('data-admira-home-redundant'));assert.equal(f.home.getAttribute('tabindex'),'-1');assert.equal(f.logo.getAttribute('href'),'/');assert(!f.creator.hasAttribute('data-admira-home-redundant'));assert(!f.external.hasAttribute('data-admira-home-redundant'));
 f.home.textContent='Home';f.home.href='https://admira.studio/en/';f.changed();assert(f.home.hasAttribute('data-admira-home-redundant'));assert.equal(f.logo.getAttribute('href'),'/');
});
test('corporate and unrelated sites are untouched and no Expert or auth surface is mounted',()=>{
 for(const host of ['www.admiranext.com','example.com','admira.studio.example.org']){const f=fixture(host);assert.equal(f.styles.length,0);assert.equal(f.sandbox.AdmiraHeader,undefined);assert.equal(f.sandbox.AdmiraExperto,undefined);}
});
