import test,{beforeEach,afterEach} from 'node:test';import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/presentaciones/[client]/remote-audio.js';
import {onRequest as gate} from '../functions/presentaciones/_middleware.js';
import {makeIdentityToken} from '../functions/presentaciones/_access.js';
const origin='https://www.admiranext.test',base='presentations/alsea/remote/audio/';let realFetch;
beforeEach(()=>{realFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Audio must not call a provider');};});afterEach(()=>{globalThis.fetch=realFetch;});
class Bucket{
 constructor(entries={}){this.entries=entries;this.reads=[];}
 async get(key,options){this.reads.push(key);this.options=options;return this.entries[key]??null;}
 async head(key){return this.entries[key]??null;}
 async put(){throw Error('Read-only endpoint');}
}
const manifest=(lang='es',segments=[{id:'s001',duration:4.2},{id:'d-store-tpv-p01',duration:7.1}])=>({version:1,lang,source:'macOS say',segments:segments.map(s=>({textHash:'a'.repeat(64),...s}))});
const object=value=>({json:async()=>value});
function call(bucket,query='',client='alsea',binding='PRESENTATION_MEDIA'){
 return onRequestGet({request:new Request(`${origin}/presentaciones/${client}/remote-audio${query}`),params:{client},env:{[binding]:bucket}});
}
function privateHeaders(response){assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('x-robots-tag'),/noindex/);}
test('manifest returns only safe IDs/durations and private same-origin URLs, preserving stored narration',async()=>{
 const stored={...manifest(),passwordVerifier:'PRIVATE',privateText:'SECRET',url:'https://private.invalid/secret',segments:manifest().segments.map(s=>({...s,text:'NARRATION',url:'javascript:bad()'}))},before=JSON.stringify(stored);
 const bucket=new Bucket({[base+'manifest-es.json']:object(stored)});const response=await call(bucket);assert.equal(response.status,200);privateHeaders(response);
 assert.deepEqual(await response.json(),{version:1,lang:'es',source:'macOS say',segments:stored.segments.map(s=>({id:s.id,duration:s.duration,textHash:s.textHash,url:`/presentaciones/alsea/remote-audio?lang=es&id=${s.id}`}))});assert.equal(JSON.stringify(stored),before);assert.deepEqual(bucket.reads,[base+'manifest-es.json']);
});
test('English and Catalan manifests retain their own namespace',async()=>{
 for(const lang of ['en','ca']){const bucket=new Bucket({[base+`manifest-${lang}.json`]:object(manifest(lang))});const response=await call(bucket,'?lang='+lang);assert.equal(response.status,200);assert.equal((await response.json()).lang,lang);assert.deepEqual(bucket.reads,[base+`manifest-${lang}.json`]);}
});
test('audio streams exactly the selected prepared body with forced safe MIME and private headers',async()=>{
 for(const id of ['s001','s999','d-studio-voz-p01','d-store-tpv-p99','d-biz-iot-p02']){
  const data=new Uint8Array([0,1,2,255]),stream=new ReadableStream({start(c){c.enqueue(data);c.close();}});const bucket=new Bucket({[base+`en-${id}.m4a`]:{body:stream,size:4,httpMetadata:{contentType:'text/html',cacheControl:'public'}}});
  const response=await call(bucket,'?lang=en&id='+id);assert.equal(response.status,200);privateHeaders(response);assert.equal(response.headers.get('content-type'),'audio/mp4');assert.equal(response.headers.get('content-length'),'4');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),data);assert.deepEqual(bucket.reads,[base+`en-${id}.m4a`]);
 }
});
test('invalid languages, IDs and client paths are rejected before reading storage',async()=>{
 const queries=['?lang=fr','?lang=ES','?lang=','?lang=es&lang=en','?id=s000','?id=s1000','?id=','?id=../s001','?id=s001.m4a','?id=d-tv-test-p01','?id=d-studio-voz-p00','?id=d-store-voz-p100','?id=d-store-á-p01','?id=d-store-'+ 'a'.repeat(70)+'-p01','?id=s001&id=s002'];
 for(const query of queries){const bucket=new Bucket();const response=await call(bucket,query);assert.equal(response.status,400,query);privateHeaders(response);assert.deepEqual(bucket.reads,[]);}
 for(const client of ['../alsea','alsea/private','', 'a'.repeat(81)]){const bucket=new Bucket();assert.equal((await call(bucket,'',client)).status,400);assert.deepEqual(bucket.reads,[]);}
});
test('missing media, missing storage and corrupt manifests return honest non-leaking errors',async()=>{
 for(const query of ['', '?id=s001'])assert.equal((await call(new Bucket(),query)).status,404);
 assert.equal((await onRequestGet({request:new Request(origin+'/remote-audio'),params:{client:'alsea'},env:{}})).status,503);
 const invalid=[{...manifest(),version:2},{...manifest(),lang:'en'},{...manifest(),source:'secret source'},manifest('es',[{id:'../secret',duration:1}]),manifest('es',[{id:'s001',duration:0}]),manifest('es',[{id:'s001',duration:Infinity}]),manifest('es',[{id:'s001',duration:600}]),manifest('es',Array.from({length:201},(_,k)=>({id:'s'+String(k+1).padStart(3,'0'),duration:1}))),manifest('es',[{id:'s001',duration:1,textHash:'A'.repeat(64)}]),manifest('es',[{id:'s001',duration:1,textHash:''}]),manifest('es',[{id:'s001',duration:1,textHash:['a'.repeat(64)]}]),manifest('es',[{id:'s001',duration:'1'}]),manifest('es',[{id:'s001',duration:1},{id:'s001',duration:2}])];
 for(const data of invalid){const response=await call(new Bucket({[base+'manifest-es.json']:object(data)}));assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'invalid_audio_manifest'});}
 assert.equal((await call(new Bucket({[base+'manifest-es.json']:{json:async()=>{throw Error('PRIVATE storage text');}}}))).status,502);
 const response=await call({get:async()=>{throw Error('PRIVATE credentials');}});assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE/);
});
class KV{async get(){return null;}async put(){}}
async function token(key,client){const exp=Math.floor(Date.now()/1000)+120;const signing=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',signing,new TextEncoder().encode(`${client}:${exp}`));return `${exp}.`+btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
test('real presentations middleware denies anonymous/other-room access and permits the identified room session',async()=>{
 const key='remote-audio-fixture-key',identity=await makeIdentityToken(key,{name:'Viewer',email:'viewer@test.invalid'}),env={PRES_SIGNING_KEY:key,PRES_ALSEA:'fixture-password',PRESENTATION_IDEAS:new KV()};
 for(const cookie of ['',`pres_other=${await token(key,'other')}; pres_identity=${identity}`,`pres_alsea=${await token(key,'other')}; pres_identity=${identity}`]){
  let passed=false;const response=await gate({env,data:{},request:new Request(origin+'/presentaciones/alsea/remote-audio?lang=es&id=s001',{headers:{Cookie:cookie}}),waitUntil(){},next(){passed=true;return new Response('PRIVATE AUDIO');}});assert.equal(passed,false);assert.equal(response.status,401);
 }
 const bucket=new Bucket({[base+'manifest-es.json']:object(manifest())}),pending=[],request=new Request(origin+'/presentaciones/alsea/remote-audio?lang=es',{headers:{Cookie:`pres_alsea=${await token(key,'alsea')}; pres_identity=${identity}`}});
 let passed=false;const response=await gate({env:{...env,PRESENTATION_MEDIA:bucket},data:{},request,waitUntil(p){pending.push(p);},next(){passed=true;return onRequestGet({request,params:{client:'alsea'},env:{PRESENTATION_MEDIA:bucket}});}});await Promise.all(pending);assert.equal(passed,true);assert.equal(response.status,200);assert.equal((await response.json()).source,'macOS say');
});

test('byte ranges stream only the requested slice with truthful 206 metadata',async()=>{
 for(const [header,offset,length]of [['bytes=1-2',1,2],['bytes=2-',2,2],['bytes=-2',2,2],['bytes=0-99',0,4]]){
  const key=base+'es-s001.m4a',bytes=new Uint8Array([10,20,30,40]);let captured;
  const bucket={head:async name=>{assert.equal(name,key);return {size:bytes.length};},get:async(name,options)=>{assert.equal(name,key);captured=options;return {size:4,body:new ReadableStream({start(c){c.enqueue(bytes.slice(options.range.offset,options.range.offset+options.range.length));c.close();}})};}};
  const request=new Request(origin+'/presentaciones/alsea/remote-audio?lang=es&id=s001',{headers:{Range:header}});const response=await onRequestGet({request,params:{client:'alsea'},env:{PRESENTATION_MEDIA:bucket}});
  assert.equal(response.status,206);privateHeaders(response);assert.equal(response.headers.get('content-range'),`bytes ${offset}-${offset+length-1}/4`);assert.equal(response.headers.get('content-length'),String(length));assert.equal(response.headers.get('accept-ranges'),'bytes');assert.deepEqual(captured,{range:{offset,length}});assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes.slice(offset,offset+length));
 }
});
test('invalid or unsatisfiable ranges never fetch an audio body',async()=>{
 for(const range of ['bytes=4-','bytes=2-1','bytes=-0','bytes=0-1,2-3','bytes=','bytes=9007199254740992-']){
  let reads=0;const bucket={head:async()=>({size:4}),get:async()=>{reads++;throw Error('must not read');}};const request=new Request(origin+'/presentaciones/alsea/remote-audio?id=s001',{headers:{Range:range}});const response=await onRequestGet({request,params:{client:'alsea'},env:{PRESENTATION_MEDIA:bucket}});assert.equal(response.status,416,range);assert.equal(reads,0);
 }
});

test('an approved local voice label is projected to the generic source without exposing private fields',async()=>{
 const stored={...manifest(),source:'macOS say · Mónica',voice:'PRIVATE VOICE',segments:manifest().segments.map(s=>({...s,bytes:123,sha256:'b'.repeat(64),text:'PRIVATE NARRATION'}))};
 const response=await call(new Bucket({[base+'manifest-es.json']:object(stored)}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.source,'macOS say');assert.equal(result.segments[0].textHash,'a'.repeat(64));assert.doesNotMatch(JSON.stringify(result),/PRIVATE|Mónica|bytes|sha256/);
});

test('the protected editor session can read remote audio through the same extra-page gate',async()=>{
 const key='remote-audio-editor-fixture',identity=await makeIdentityToken(key,{name:'Editor',email:'editor@test.invalid'}),request=new Request(origin+'/presentaciones/alsea/remote-audio?lang=es',{headers:{Cookie:`pres_editor=${await token(key,'_editor')}; pres_identity=${identity}`}});
 let passed=false;const env={PRES_SIGNING_KEY:key,PRES_ALSEA:'fixture-room',PRES_EDITOR:'fixture-editor',PRESENTATION_IDEAS:new KV()},pending=[];
 const response=await gate({env,data:{},request,waitUntil(p){pending.push(p);},next(){passed=true;return new Response('PRIVATE EDITOR AUDIO');}});await Promise.all(pending);assert.equal(response.status,200);assert.equal(passed,true);assert.equal(await response.text(),'PRIVATE EDITOR AUDIO');
});
