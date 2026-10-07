// Owns one narration at a time; stale media events can never complete a stopped run.
export function createRemoteRunner({show,narrate,changed,completed}) {
  let plan=[],index=0,state='idle',generation=0,voice=null,fullySeen=true;
  const emit=message=>changed({state,index,total:plan.length,message});
  function cancel(){generation++;voice?.cancel?.();voice=null;}
  function play(){
    const token=++generation;show(plan[index],index);
    voice=narrate(plan[index],()=>{
      if(token!==generation||state!=='running')return;
      voice=null;
      if(++index===plan.length){state='complete';emit('complete');if(fullySeen)completed();return;}
      play();
    },message=>{
      if(token!==generation||state!=='running')return;
      cancel();state='error';emit(message);
    });if(state==='running')emit('playing');
  }
  return {
    start(next){if(!Array.isArray(next)||!next.length)throw new Error('No presentation plan.');cancel();plan=next;index=0;fullySeen=true;state='running';play();},
    pause(){if(state!=='running')return;state='paused';voice?.pause?.();emit('paused');},
    resume(){if(state!=='paused')return;state='running';voice?.resume?.();emit('playing');},
    stop(){cancel();state='idle';emit('stopped');},
    next(){if(!['running','paused'].includes(state))return;cancel();fullySeen=false;if(index+1>=plan.length){state='idle';emit('stopped');return;}index++;state='running';play();},
    fallback(){if(state!=='error')return;state='running';play();},
    snapshot(){return {state,index,total:plan.length,fullySeen};}
  };
}
