const MAX_VERSIONS=100;
const KEYS=['presentation','ideas','generation','image-set'];
const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));

export async function captureVersion(env,client,reason='guardado',provided={}){
  if(!env.PRESENTATION_IDEAS)return null;
  const values={};
  for(const name of KEYS)values[name]=name in provided?clone(provided[name]):await env.PRESENTATION_IDEAS.get(`${name}:${client}`,{type:'json'});
  if(!values.presentation||!values.ideas)return null;
  const createdAt=new Date().toISOString(),id=`${createdAt.replace(/\D/g,'').slice(0,14)}-${crypto.randomUUID().slice(0,8)}`;
  const snapshot={schemaVersion:1,id,client,reason,createdAt,values};
  const index=await env.PRESENTATION_IDEAS.get(`versions:${client}`,{type:'json'})||{schemaVersion:1,client,versions:[]};
  const meta={id,reason,createdAt,displayName:values.presentation.displayName,languages:values.presentation.languages||values.ideas.languages||[],outputs:values.presentation.outputs||values.ideas.outputs||[],revision:values.ideas.updatedAt||values.presentation.updatedAt||createdAt};
  index.versions=[meta,...(index.versions||[]).filter(item=>item.id!==id)].slice(0,MAX_VERSIONS);
  await Promise.all([env.PRESENTATION_IDEAS.put(`version:${client}:${id}`,JSON.stringify(snapshot)),env.PRESENTATION_IDEAS.put(`versions:${client}`,JSON.stringify(index))]);
  return meta;
}

export async function listVersions(env,client){return (await env.PRESENTATION_IDEAS.get(`versions:${client}`,{type:'json'}))?.versions||[]}

export async function restoreVersion(env,client,id){
  const snapshot=await env.PRESENTATION_IDEAS.get(`version:${client}:${id}`,{type:'json'});if(!snapshot?.values?.presentation||!snapshot?.values?.ideas)throw new Error('Versión no encontrada.');
  await captureVersion(env,client,'copia automática antes de restaurar');
  const writes=KEYS.filter(name=>snapshot.values[name]!=null).map(name=>env.PRESENTATION_IDEAS.put(`${name}:${client}`,JSON.stringify(snapshot.values[name])));
  await Promise.all(writes);await captureVersion(env,client,`restaurada desde ${id}`,snapshot.values);return snapshot;
}
