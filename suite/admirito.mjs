// Shared namespace extension. Registers one verb in the existing suite engine;
// each assistant keeps its existing application action and execution path.
export const ADMIRITOS=Object.freeze([
 {id:'creativo',command:'creativo',es:'Locuciones y música: texto o letra, voz, idioma y estilo.',en:'Voice-overs and music: text or lyrics, voice, language and style.'},
 {id:'arquitecto',command:'arquitecto',es:'Crear, reformar e inventariar espacios.',en:'Create, renovate and survey spaces.'},
 {id:'bugito',command:'bugito',es:'Revisar incidencias y abrir el banco de pruebas.',en:'Review incidents and open the test bench.'},
 {id:'supervisor',command:'supervisor',es:'Supervisar cámaras, pantallas e incidencias.',en:'Supervise cameras, screens and incidents.'}
]);
const installed=new WeakSet();
export function installAdmirito(engine,environment=globalThis){
 if(!engine?.verb||!engine?.exec)throw Error('shared-expert-engine-required');
 if(installed.has(engine))return;installed.add(engine);
 const en=()=>environment.document.documentElement.lang.startsWith('en');
 function write(log,text,error=false){if(!log)return;for(const line of text.split('\n')){const row=environment.document.createElement(/^(OL|UL)$/.test(log.tagName)?'li':'div');row.className=error?'err':'';row.textContent=line;log.appendChild(row);}log.scrollTop=log.scrollHeight;}
 function help(log,error){engine.open?.();engine.resize?.(Math.max(300,engine.height?.()||0));if(environment.CustomEvent)environment.dispatchEvent?.(new environment.CustomEvent('admira:assistant-help'));const text=(error?error+'\n':'')+ADMIRITOS.map(a=>'/admirito '+a.id+' — '+a[en()?'en':'es']).join('\n')+'\n/admirito help — '+(en()?'Show these options.':'Mostrar estas opciones.');write(log,text,!!error);return {ok:!error,options:ADMIRITOS.map(a=>a.id)};}
 engine.verb({name:'admirito',args:'creativo|arquitecto|bugito|supervisor|help',desc:['Asistentes virtuales. /admirito help muestra las opciones.','Virtual assistants. /admirito help shows the options.'],run(args,log,command){
  // Read raw payload so literal lyrics retain newlines and repeated spaces.
  const raw=command?.raw?command.raw.replace(/^\/?admirito(?:\s+|$)/i,''):args.join(' ');
  const match=/^(\S+)(?:\s+([\s\S]*))?$/.exec(raw.trim()),name=(match?.[1]||'help').toLowerCase(),tail=match?.[2]||'';
  if(['help','ayuda','?'].includes(name))return help(log);
  // Preserve explicit legacy visibility controls, without routing them as assistants.
  if(['on','off'].includes(name)&&!tail)return engine.exec(name==='on'?'/avataron':'/avataroff',log,{echo:false,record:false});
  const assistant=ADMIRITOS.find(a=>a.id===name);
  if(!assistant)return help(log,en()?'Unknown assistant.':'Asistente desconocido.');
  if(!engine.has(assistant.command)){
   const message=en()?'This assistant is not available on this page.':'Este asistente no está disponible en esta página.';
   if(name==='creativo'&&!tail){write(log,en()?'Opening El Creativo in Admira Studio.':'Abriendo El Creativo en Admira Studio.');environment.location.assign('https://www.admira.studio/'+(en()?'en/':'')+'creativo/?lang='+(en()?'en':'es'));return {ok:true,navigating:true};}
   write(log,message,true);return {ok:false,error:message};
  }
  return engine.exec('/'+assistant.command+(tail?' '+tail:''),log,{echo:false,record:false});
 }});
 return engine;
}
