import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {onRequestGet as renderPresentation} from '../functions/presentaciones/[client]/presentacion.js';

function kv(values){
  return {async get(key,options){
    const value=values[key];
    return options?.type==='json'?value:JSON.stringify(value);
  }};
}

const config={displayName:'Demo',outputs:['website'],languages:['es'],theme:{},sequence:{}};
const ideas={
  hero:{title:'Propuesta',summary:'Resumen',speakerNotes:'Nota privada'},
  objective:'Objetivo',
  skeleton:[{id:'uno',title:'Idea',message:'Mensaje',detail:'Detalle',enabled:true,notes:'Nota de bloque'}],
  closing:{title:'Cierre',action:'Acción'},
  labels:{objective:'Objetivo',next:'Siguiente'},
  notes:'Guion privado'
};

async function presentationHtml(url){
  const response=await renderPresentation({
    params:{client:'demo'},
    request:new Request(url),
    env:{PRESENTATION_IDEAS:kv({'presentation:demo':config,'ideas:demo':ideas})},
    next(){throw new Error('unexpected next');}
  });
  return response.text();
}

function functionSource(source,name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`missing ${name}`);
  const open=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let index=open;index<source.length;index+=1){
    const char=source[index];
    if(quote){
      if(escaped) escaped=false;
      else if(char==='\\') escaped=true;
      else if(char===quote) quote='';
      continue;
    }
    if(char==='"\''||char==='"'||char==='`'){quote=char;continue;}
    if(char==='{') depth+=1;
    else if(char==='}'&&--depth===0) return source.slice(start,index+1);
  }
  throw new Error(`unterminated ${name}`);
}

function compileFunction(source,name,bindings={}){
  const keys=Object.keys(bindings);
  return Function(...keys,`return (${functionSource(source,name)});`)(...keys.map(key=>bindings[key]));
}

async function loadHandoff(){
  const source=await readFile(new URL('../assets/presentation-speaker-handoff.js',import.meta.url),'utf8');
  const sandbox={};
  vm.runInNewContext(source,sandbox);
  return sandbox.AdmiraSpeakerHandoff;
}

test('speaker handoff UI is private, stateful and keyboard accessible',async()=>{
  const [source,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.css',import.meta.url),'utf8')
  ]);
  assert.doesNotThrow(()=>new Function(source));
  for(const id of [
    'presenterSpeakerHandoff','presenterHandoffActive','presenterHandoffCountdown',
    'presenterHandoffQueue','presenterHandoffAdd','presenterHandoffRequest',
    'presenterHandoffAccept','presenterHandoffCancel','presenterHandoffFeedback'
  ]) assert.match(source,new RegExp(`id="${id}"`));
  assert.match(source,/id="presenterSpeakerHandoff"[^>]*data-handoff-state="degraded"[^>]*data-presenter-private/);
  assert.match(source,/aria-label="Cola editable de ponentes"/);
  assert.match(source,/role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(source,/speakerHandoffActive\.focus\(\{preventScroll: true\}\)/);
  assert.match(source,/button\.setAttribute\('aria-label', control\.label \+ ' a ' \+ speaker\.name\)/);
  assert.match(source,/if \(nextQueueSignature !== speakerHandoffQueueSignature\) \{[\s\S]{0,240}?speakerHandoffQueue\.replaceChildren\(\)/);
  for(const state of ['countdown','transferred','cancelled','degraded']){
    assert.match(styles,new RegExp(`\\.presenter-speaker-handoff\\[data-handoff-state="${state}"\\]`));
  }
  assert.match(styles,/\.presenter-speaker-queue button:focus-visible/);
  assert.match(styles,/\.presenter-speaker-add :is\(input,button\):focus-visible/);
  assert.match(styles,/\.presenter-speaker-actions button:focus-visible/);
  assert.match(styles,/@media\(max-width:720px\)[\s\S]*\.presenter-speaker-actions\{grid-template-columns:1fr\}/);
});

test('presenter integrates the handoff contract and restores private context per speaker',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.match(source,/window\.AdmiraSpeakerHandoff/);
  assert.match(source,/contract\.create\(\{[\s\S]{0,600}?presentationId:[\s\S]{0,600}?role: 'moderator'[\s\S]{0,600}?actorId: 'presenter-control'[\s\S]{0,600}?initialControllerId: 'speaker-1'[\s\S]{0,600}?defaultCountdownMs: 10000/);
  for(const method of ['enqueue','removeFromQueue','updateSpeakerState','requestHandoff','cancelHandoff','acceptHandoff','snapshot','onChange','destroy']){
    assert.match(source,new RegExp(method));
  }
  assert.match(source,/slideIndex: context\.index/);
  assert.match(source,/notes: context\.notes/);
  assert.match(source,/reference: speakerContextReference\(context\)/);
  assert.match(source,/var reference = parseSpeakerContextReference\(speaker\.state\.reference\)/);
  assert.match(source,/presentationId: speakerHandoffPresentationId\(location\.pathname\)/);
  assert.match(source,/role: 'speaker'/);
  assert.match(source,/Promise\.resolve\(result\)\.then\(function \(\) \{[\s\S]{0,220}?speakerHandoffSnapshot = speakerHandoffReadSnapshot\(\)/);
  assert.match(source,/restoreSpeakerContext\(nextSpeakerId\)/);
  assert.match(source,/shouldRestoreSpeakerContext\(snapshot, active\)/);
  assert.match(source,/goLocal\(clamp\(Number\(saved\.index\)/);
  assert.match(source,/if \(typeof saved\.notes === 'string'\) notes\.textContent = saved\.notes/);
  assert.match(source,/notes\.scrollTop = Math\.max\(0, Number\(saved\.notesScrollTop\)/);
  assert.match(source,/if \(saved\.promptPlaying\) startPrompt\(\)/);
  assert.doesNotMatch(source.slice(source.indexOf('function captureSpeakerContext'),source.indexOf('function productionCueList')),/\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(|WebSocket|EventSource/);
});

test('real handoff engine accepts canonical ids and round-trips presenter recovery context',async()=>{
  const presenterSource=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const canonicalId=compileFunction(presenterSource,'speakerHandoffPresentationId');
  const serializeReference=compileFunction(presenterSource,'speakerContextReference',{clamp});
  const parseReference=compileFunction(presenterSource,'parseSpeakerContextReference',{clamp});
  const shouldRestore=compileFunction(presenterSource,'shouldRestoreSpeakerContext');
  const api=await loadHandoff();
  const values=new Map();
  const storage={
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
  const presentationId=canonicalId('/presentaciones/demo/presentacion');
  assert.equal(presentationId,'presentaciones-demo-presentacion');
  const options={
    presentationId,
    speakers:[
      {id:'presenter-control',name:'Control',role:'moderator'},
      {id:'speaker-1',name:'Ana',role:'speaker'},
      {id:'speaker-2',name:'Bruno',role:'speaker'}
    ],
    actorId:'presenter-control',
    initialControllerId:'speaker-1',
    initialQueue:['speaker-2'],
    storage,
    storageKey:'handoff.private.dynamic',
    now:()=>1000,
    schedule:()=>1,
    cancel:()=>{}
  };
  const reference=serializeReference({notesScrollTop:137,promptPlaying:true});
  const first=api.create(options);
  first.updateSpeakerState('speaker-2',{slideIndex:4,notes:'Nota privada de Bruno',reference});
  const initialTransfer=first.requestHandoff('speaker-2',{countdownMs:1000});
  first.acceptHandoff(initialTransfer.id);
  first.destroy();

  const recovered=api.create(options);
  const recoveredSnapshot=recovered.snapshot();
  const active=recoveredSnapshot.speakers.find(speaker=>speaker.id===recoveredSnapshot.controllerId);
  assert.equal(recoveredSnapshot.persistence.status,'persisted');
  assert.equal(recoveredSnapshot.controllerId,'speaker-2');
  assert.deepEqual(Array.from(recoveredSnapshot.queue),[]);
  assert.equal(shouldRestore(recoveredSnapshot,active),true);
  assert.deepEqual(parseReference(active.state.reference),{notesScrollTop:137,promptPlaying:true});
  assert.equal(active.state.slideIndex,4);
  assert.equal(active.state.notes,'Nota privada de Bruno');

  const added=recovered.addSpeaker({id:'speaker-3',name:'Carla',role:'speaker'});
  assert.equal(added.id,'speaker-3');
  recovered.enqueue('speaker-3');
  const actionResult=recovered.requestHandoff('speaker-3',{countdownMs:1000});
  assert.equal(actionResult.toSpeakerId,'speaker-3');
  assert.equal(actionResult.speakers,undefined);
  const actualSnapshot=recovered.snapshot();
  assert.ok(Array.isArray(actualSnapshot.speakers));
  assert.equal(actualSnapshot.controllerId,'speaker-2');
  assert.equal(actualSnapshot.handoff.id,actionResult.id);
  recovered.destroy();
});

test('audience response never loads or serializes private speaker handoff state',async()=>{
  const [presenter,audience,source]=await Promise.all([
    presentationHtml('https://admiranext.test/presentaciones/demo/presentacion'),
    presentationHtml('https://admiranext.test/presentaciones/demo/presentacion?audience=1'),
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8')
  ]);
  assert.match(presenter,/presentation-speaker-handoff\.js\?v=20260723-1/);
  assert.ok(presenter.indexOf('presentation-speaker-handoff.js')<presenter.indexOf('presentation-presenter-mode.js'));
  assert.doesNotMatch(audience,/presentation-speaker-handoff|AdmiraSpeakerHandoff|presenterSpeakerHandoff|Relevo entre ponentes/);
  assert.doesNotMatch(audience,/Guion privado|Nota privada|Nota de bloque|__ADMIRA_PRESENTER_NOTES__/);
  const audienceInitialization=source.slice(source.indexOf('function startAudienceMode'),source.indexOf('function readPreferences'));
  assert.doesNotMatch(audienceInitialization,/AdmiraSpeakerHandoff|speakerHandoffContexts|updateSpeakerState|requestHandoff|cancelHandoff|acceptHandoff/);
  const stateSignal=source.match(/broadcast\(\{type: 'state',[^\n]+\}\)/)?.[0]||'';
  assert.doesNotMatch(stateSignal,/speaker|handoff|notes|reference|controller|queue/i);
});
