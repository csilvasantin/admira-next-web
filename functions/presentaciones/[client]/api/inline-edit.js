const MAX_BODY_BYTES = 64 * 1024;
const MAX_EDITS = 20;
const LANGUAGES = ['es','ca','en'];
const LANGUAGE_NAMES = {es:'Spanish',ca:'Catalan',en:'English'};
const DEFAULT_LABELS = {es:{objective:'El objetivo',next:'Siguiente paso'},ca:{objective:"L'objectiu",next:'Següent pas'},en:{objective:'The objective',next:'Next step'}};
const LIMITS = {
  'hero.eyebrow':120, 'hero.title':220, 'hero.summary':900, objective:1200,
  'skeleton.title':180, 'skeleton.message':900, 'skeleton.detail':1600,
  'closing.title':220, 'closing.action':700, 'labels.objective':80, 'labels.next':80
};
import {captureVersion} from '../../_versions.js';

function response(body, status = 200){
  return new Response(JSON.stringify(body), {status, headers:{
    'content-type':'application/json; charset=utf-8', 'cache-control':'no-store, must-revalidate',
    'x-content-type-options':'nosniff'
  }});
}
function clean(value, max){ return String(value == null ? '' : value).replace(/\r\n?/g,'\n').trim().slice(0, max); }
function validClient(value){ const client=String(value||'').toLowerCase(); return /^[a-z0-9][a-z0-9-]{1,62}$/.test(client)?client:''; }
function clone(value){ return JSON.parse(JSON.stringify(value)); }
function baseContent(ideas){
  return {hero:clone(ideas.hero||{}),objective:String(ideas.objective||''),skeleton:clone(ideas.skeleton||[]),closing:clone(ideas.closing||{}),labels:clone(ideas.labels||DEFAULT_LABELS.es)};
}
function localeContent(ideas, language){
  if(language==='es') return ideas;
  ideas.translations=ideas.translations&&typeof ideas.translations==='object'?ideas.translations:{};
  if(!ideas.translations[language]){
    ideas.translations[language]=baseContent(ideas);
    ideas.translations[language].labels=clone(DEFAULT_LABELS[language]||DEFAULT_LABELS.es);
  }
  ideas.translations[language].labels ||= clone(DEFAULT_LABELS[language]||DEFAULT_LABELS.es);
  return ideas.translations[language];
}
function normalizedEdits(raw){
  if(!Array.isArray(raw)||!raw.length||raw.length>MAX_EDITS) throw new Error('Indica entre 1 y 20 textos para actualizar.');
  const seen=new Set();
  return raw.map((item,index)=>{
    const field=String(item?.field||''),limit=LIMITS[field];
    if(!limit) throw new Error('Uno de los campos no se puede editar directamente.');
    const blockId=field.startsWith('skeleton.')?clean(item?.blockId,80):'';
    if(field.startsWith('skeleton.')&&!blockId) throw new Error('No se ha identificado la diapositiva editada.');
    const id=`edit-${index+1}`,key=`${field}:${blockId}`;
    if(seen.has(key)) throw new Error('Hay un texto duplicado en la edición.');
    seen.add(key);
    return {id,field,blockId,value:clean(item?.value,limit)};
  });
}
function applyEdit(content, edit, value=edit.value){
  if(edit.field.startsWith('skeleton.')){
    const block=(content.skeleton||[]).find(item=>String(item?.id||'')===edit.blockId);
    if(!block) throw new Error('La diapositiva editada ya no existe. Recarga para continuar.');
    block[edit.field.split('.')[1]]=clean(value,LIMITS[edit.field]); return;
  }
  const [first,second]=edit.field.split('.');
  if(second){ content[first]=content[first]&&typeof content[first]==='object'?content[first]:{}; content[first][second]=clean(value,LIMITS[edit.field]); }
  else content[first]=clean(value,LIMITS[edit.field]);
}
function publicLocales(ideas, languages){
  const output={};
  for(const language of languages){
    const source=language==='es'?baseContent(ideas):clone(localeContent(ideas,language));
    source.skeleton=(source.skeleton||[]).filter(item=>item.enabled!==false);
    output[language]=source;
  }
  return output;
}
async function translateEdits(env, sourceLanguage, targetLanguages, edits){
  if(!targetLanguages.length) return {};
  if(!env.XAI_API_KEY) throw new Error('La traducción automática no está configurada.');
  const languageProperties=Object.fromEntries(targetLanguages.map(language=>[language,{type:'array',items:{type:'string'}}]));
  const provider=await fetch('https://api.x.ai/v1/responses',{
    method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.XAI_API_KEY}`},
    body:JSON.stringify({
      model:env.XAI_TEXT_MODEL||'grok-4.5',store:false,
      input:[
        {role:'system',content:[{type:'input_text',text:'Translate presentation copy faithfully and naturally. Preserve product names, brand names, numbers, punctuation, line breaks and factual meaning. Return each target-language array in exactly the same order and with exactly the same number of strings as the input. Do not add explanations.'}]},
        {role:'user',content:[{type:'input_text',text:JSON.stringify({sourceLanguage:LANGUAGE_NAMES[sourceLanguage],targetLanguages:targetLanguages.map(language=>LANGUAGE_NAMES[language]),edits:edits.map(edit=>({field:edit.field,text:edit.value}))})}]}
      ],
      text:{format:{type:'json_schema',name:'presentation_translations',strict:true,schema:{
        type:'object',additionalProperties:false,properties:{translations:{type:'object',additionalProperties:false,properties:languageProperties,required:targetLanguages}},required:['translations']
      }}}
    })
  });
  if(!provider.ok) throw new Error(provider.status===429?'xAI ha alcanzado temporalmente el límite de traducción.':'No se pudieron sincronizar los idiomas.');
  const length=Number(provider.headers.get('content-length')||0);
  if(length>MAX_BODY_BYTES) throw new Error('La traducción recibida es demasiado grande.');
  const payload=await provider.json();
  const outputText=payload?.output?.find(item=>item?.type==='message')?.content?.find(item=>item?.type==='output_text')?.text;
  let parsed; try{parsed=JSON.parse(outputText||'');}catch(_){throw new Error('La traducción no devolvió un resultado válido.');}
  for(const language of targetLanguages){
    if(!Array.isArray(parsed?.translations?.[language])||parsed.translations[language].length!==edits.length) throw new Error(`La versión ${language.toUpperCase()} quedó incompleta y no se ha guardado.`);
  }
  return parsed.translations;
}

export async function onRequest(context){
  if(context.request.method!=='PUT') return response({error:'Método no permitido.'},405);
  if(!context.env.PRESENTATION_IDEAS) return response({error:'Almacenamiento no configurado.'},503);
  const origin=context.request.headers.get('Origin'),url=new URL(context.request.url);
  if(!origin||origin!==url.origin) return response({error:'Origen no permitido.'},403);
  if(Number(context.request.headers.get('content-length')||0)>MAX_BODY_BYTES) return response({error:'La edición es demasiado grande.'},413);
  const client=validClient(context.params.client); if(!client) return response({error:'Presentación no válida.'},400);
  let payload; try{payload=await context.request.json();}catch(_){return response({error:'JSON no válido.'},400);}
  const language=String(payload?.language||'').toLowerCase();
  if(!LANGUAGES.includes(language)) return response({error:'Idioma no válido.'},400);
  let edits; try{edits=normalizedEdits(payload?.edits);}catch(error){return response({error:error.message},400);}
  const [presentation,ideas]=await Promise.all([
    context.env.PRESENTATION_IDEAS.get(`presentation:${client}`,{type:'json'}),
    context.env.PRESENTATION_IDEAS.get(`ideas:${client}`,{type:'json'})
  ]);
  if(!presentation||!ideas) return response({error:'Presentación no encontrada.'},404);
  if(payload.revision&&payload.revision!==ideas.updatedAt) return response({error:'La presentación cambió en otra sesión. Recarga antes de guardar.',conflict:true},409);
  const languages=[...new Set((presentation.languages||ideas.languages||['es']).filter(item=>LANGUAGES.includes(item)))];
  if(!languages.includes(language)) return response({error:'Este idioma no forma parte de la presentación.'},400);
  const targetLanguages=languages.filter(item=>item!==language);
  let translated;
  try{translated=await translateEdits(context.env,language,targetLanguages,edits);}
  catch(error){
    console.error(JSON.stringify({message:'inline translation failed',client,language,error:String(error?.message||error)}));
    return response({error:error.message||'No se pudieron sincronizar los idiomas.'},502);
  }
  try{
    const source=localeContent(ideas,language); edits.forEach(edit=>applyEdit(source,edit));
    for(const targetLanguage of targetLanguages){
      const target=localeContent(ideas,targetLanguage);
      edits.forEach((edit,index)=>applyEdit(target,edit,translated[targetLanguage][index]));
    }
  }catch(error){ return response({error:error.message||'No se pudo aplicar la edición.'},409); }
  ideas.updatedAt=new Date().toISOString();
  await context.env.PRESENTATION_IDEAS.put(`ideas:${client}`,JSON.stringify(ideas));
  await captureVersion(context.env,client,`textos ${language.toUpperCase()} guardados`,{presentation,ideas});
  return response({ok:true,revision:ideas.updatedAt,language,languages,locales:publicLocales(ideas,languages),translated:targetLanguages});
}
