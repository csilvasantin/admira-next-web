import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadGuardian(){
  const source=await readFile(new URL('../assets/presentation-share-guardian.js',import.meta.url),'utf8');
  const context={};
  vm.runInNewContext(source,context);
  return context.AdmiraPresentationShareGuardian;
}

function deferred(){
  let resolve;
  let reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
}

function fakeTrack(settings={displaySurface:'window'}){
  const listeners=new Map();
  return {
    readyState:'live',
    muted:false,
    stopped:false,
    getSettings(){return settings},
    addEventListener(type,listener){listeners.set(type,listener)},
    removeEventListener(type,listener){if(listeners.get(type)===listener) listeners.delete(type)},
    emit(type){listeners.get(type)?.()},
    stop(){this.stopped=true;this.readyState='ended';listeners.get('ended')?.()}
  };
}

function fakeStream(track){
  return {
    getVideoTracks(){return [track]},
    getTracks(){return [track]}
  };
}

class FakeBroadcastChannel{
  static channels=new Map();

  constructor(name){
    this.name=name;
    this.listeners=new Set();
    const group=FakeBroadcastChannel.channels.get(name)||new Set();
    group.add(this);
    FakeBroadcastChannel.channels.set(name,group);
  }

  addEventListener(type,listener){
    if(type==='message') this.listeners.add(listener);
  }

  removeEventListener(type,listener){
    if(type==='message') this.listeners.delete(listener);
  }

  postMessage(data){
    for(const peer of FakeBroadcastChannel.channels.get(this.name)||[]){
      if(peer===this) continue;
      for(const listener of peer.listeners) listener({data});
    }
  }

  close(){
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

test('expone sin ambigüedad soporte, permiso no solicitado y límites del navegador',async()=>{
  const guardian=await loadGuardian();
  const instance=guardian.create({navigator:{}});
  const state=instance.getState();
  assert.equal(state.capture.support,'unsupported');
  assert.equal(state.capture.permission,'not-requested');
  assert.equal(state.capture.phase,'unsupported');
  assert.equal(state.assurance.canVerifyExternalWindows,false);
  assert.match(state.assurance.message,/no puede verificar otras ventanas/i);
  assert.doesNotMatch(JSON.stringify(state),/notes|speaker|client|token/i);
});

test('nunca llama getDisplayMedia sin un gesto explícito verificable',async()=>{
  const guardian=await loadGuardian();
  let calls=0;
  const instance=guardian.create({
    navigator:{mediaDevices:{getDisplayMedia(){calls++;return Promise.resolve(null)}}},
    isUserGesture:event=>event?.explicit===true
  });
  await assert.rejects(instance.requestShareFromGesture(null),error=>error.code==='explicit-user-gesture-required');
  await assert.rejects(instance.requestShareFromGesture({explicit:false}),error=>error.code==='explicit-user-gesture-required');
  assert.equal(calls,0);
  assert.equal(instance.getState().capture.permission,'not-requested');
});

test('userActivation inactiva prevalece sobre un evento trusted ya caducado',async()=>{
  const guardian=await loadGuardian();
  let calls=0;
  const instance=guardian.create({
    navigator:{
      userActivation:{isActive:false},
      mediaDevices:{getDisplayMedia(){calls++;return Promise.resolve(null)}}
    }
  });
  await assert.rejects(instance.requestShareFromGesture({isTrusted:true}),error=>error.code==='explicit-user-gesture-required');
  assert.equal(calls,0);
});

test('solicita solo vídeo desde el gesto y refleja superficie y ciclo live/muted/ended',async()=>{
  const guardian=await loadGuardian();
  const track=fakeTrack({displaySurface:'window'});
  let constraints;
  const instance=guardian.create({
    navigator:{mediaDevices:{getDisplayMedia(next){constraints=next;return Promise.resolve(fakeStream(track))}}},
    isUserGesture:()=>true
  });
  const result=await instance.requestShareFromGesture({type:'click'});
  assert.equal(constraints.video,true);
  assert.equal(constraints.audio,false);
  assert.equal(result.stream.getVideoTracks()[0],track);
  assert.equal(instance.getState().capture.permission,'granted');
  assert.equal(instance.getState().capture.trackState,'live');
  assert.equal(instance.getState().capture.displaySurface,'window');
  assert.equal(instance.getState().capture.selectionReported,true);

  track.muted=true;
  track.emit('mute');
  assert.equal(instance.getState().capture.trackState,'muted');
  track.muted=false;
  track.emit('unmute');
  assert.equal(instance.getState().capture.trackState,'live');
  track.readyState='ended';
  track.emit('ended');
  assert.equal(instance.getState().capture.phase,'ended');
  assert.equal(instance.getState().capture.trackState,'ended');
});

test('un rechazo NotAllowedError no afirma si fue denegación o cancelación',async()=>{
  const guardian=await loadGuardian();
  const denied=new Error('not allowed');
  denied.name='NotAllowedError';
  const instance=guardian.create({
    navigator:{mediaDevices:{getDisplayMedia(){return Promise.reject(denied)}}},
    isUserGesture:()=>true
  });
  await assert.rejects(instance.requestShareFromGesture({type:'click'}),denied);
  const state=instance.getState().capture;
  assert.equal(state.permission,'denied-or-dismissed');
  assert.equal(state.phase,'not-authorized');
  assert.equal(state.failure,'permission-denied-or-dismissed');
  assert.equal(state.displaySurface,'unknown');
});

test('mantiene requesting mientras el selector está abierto y no inventa displaySurface',async()=>{
  const guardian=await loadGuardian();
  const pending=deferred();
  const instance=guardian.create({
    navigator:{mediaDevices:{getDisplayMedia(){return pending.promise}}},
    isUserGesture:()=>true
  });
  const request=instance.requestShareFromGesture({type:'click'});
  assert.equal(instance.getState().capture.phase,'requesting');
  pending.resolve(fakeStream(fakeTrack({})));
  await request;
  assert.equal(instance.getState().capture.displaySurface,'unknown');
  assert.equal(instance.getState().capture.selectionReported,false);
});

test('probe y ack confirman frescura de audience sin serializar contenido privado',async()=>{
  FakeBroadcastChannel.channels.clear();
  const guardian=await loadGuardian();
  let currentTime=1000;
  const intervals=[];
  const posted=[];
  class InspectableChannel extends FakeBroadcastChannel{
    postMessage(data){
      posted.push(data);
      super.postMessage(data);
    }
  }
  const common={
    BroadcastChannel:InspectableChannel,
    channelName:'guardian-test',
    now:()=>currentTime,
    heartbeatMs:1000,
    freshnessMs:2500
  };
  const audience=guardian.create({...common,role:'audience'});
  const presenter=guardian.create({
    ...common,
    role:'presenter',
    setInterval:callback=>{intervals.push(callback);return 7},
    clearInterval:()=>{}
  });
  audience.start();
  presenter.start();
  assert.equal(presenter.getState().audience.status,'fresh');
  assert.equal(presenter.getState().audience.lastAckAt,1000);
  assert.ok(posted.some(message=>message.type==='audience-probe'));
  assert.ok(posted.some(message=>message.type==='audience-ack'));
  for(const message of posted){
    assert.deepEqual(Object.keys(message).sort(),['protocol','sentAt','sequence','type']);
    assert.doesNotMatch(JSON.stringify(message),/notes|speaker|client|token|slide/i);
  }

  currentTime=3601;
  assert.equal(presenter.getState().audience.status,'stale');
  intervals[0]();
  assert.equal(presenter.getState().audience.status,'fresh');
  presenter.destroy();
  audience.destroy();
});

test('sin BroadcastChannel declara transporte no soportado, no audiencia verificada',async()=>{
  const guardian=await loadGuardian();
  const instance=guardian.create({
    navigator:{mediaDevices:{getDisplayMedia(){throw new Error('unused')}}},
    BroadcastChannel:null
  });
  instance.start();
  const state=instance.getState();
  assert.equal(state.audience.transport,'unsupported');
  assert.equal(state.audience.status,'unsupported');
  assert.equal(state.audience.lastAckAt,null);
});

test('stopShare detiene pistas y limpia solo el estado técnico efímero',async()=>{
  const guardian=await loadGuardian();
  const track=fakeTrack({displaySurface:'monitor'});
  const instance=guardian.create({
    navigator:{mediaDevices:{getDisplayMedia(){return Promise.resolve(fakeStream(track))}}},
    isUserGesture:()=>true
  });
  await instance.requestShareFromGesture({type:'click'});
  instance.stopShare();
  assert.equal(track.stopped,true);
  assert.deepEqual(JSON.parse(JSON.stringify(instance.getState().capture)),{
    support:'supported',
    permission:'not-requested',
    phase:'idle',
    trackState:'none',
    displaySurface:'unknown',
    selectionReported:false,
    failure:null
  });
});
