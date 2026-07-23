export const COMPATIBILITY_TARGETS=['powerpoint','keynote','google-slides','pdf','web'];
const TARGET_SET=new Set(COMPATIBILITY_TARGETS);
const SAFE_ID=/^[a-z0-9][a-z0-9._:-]{0,99}$/i;
const SHA256=/^[a-f0-9]{64}$/i;
const LEVELS=new Set(['executed','structural','unavailable']);
const EXECUTION_STATUSES=new Set(['passed','passed_with_differences','failed']);
const SEVERITIES=new Set(['info','warning','error']);

const TARGET_POLICY={
  powerpoint:{output:'powerpoint',fallback:'Exporta PPTX, abre una copia en PowerPoint y registra evidencia del adaptador antes de distribuir.'},
  keynote:{output:'powerpoint',fallback:'Importa una copia del PPTX en Keynote, sustituye transiciones no compatibles y registra el resultado real.'},
  'google-slides':{output:'powerpoint',fallback:'Importa una copia del PPTX en Google Slides, revisa fuentes y multimedia y conserva el original como fallback.'},
  pdf:{output:'pdf',fallback:'Usa PDF como fallback visual estático; reemplaza audio, vídeo y controles por enlaces o notas visibles.'},
  web:{output:'website',fallback:'Usa la versión web en navegador compatible y conserva PDF como respaldo offline.'}
};

function text(value,max){return String(value==null?'':value).trim().slice(0,max)}
function id(value){const clean=text(value,100);return SAFE_ID.test(clean)?clean:''}
function unique(values){return [...new Set(values)]}
function iso(value){const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():''}
function publicHost(value){
  const host=String(value||'').toLowerCase().replace(/^\[|\]$/g,'');
  if(!host||host==='localhost'||host.endsWith('.localhost')||/\.(?:local|internal|lan|home)$/.test(host))return false;
  if(host.includes(':'))return false;
  if(/^\d+(?:\.\d+){3}$/.test(host)){
    const octets=host.split('.').map(Number);
    if(octets.some(octet=>octet<0||octet>255))return false;
    const [a,b]=octets;
    return !(a===0||a===10||a===127||a>=224||
      (a===100&&b>=64&&b<=127)||(a===169&&b===254)||
      (a===172&&b>=16&&b<=31)||(a===192&&b===168)||
      (a===198&&(b===18||b===19)));
  }
  return true;
}
export function publicEvidenceUrl(value){
  try{
    const url=new URL(String(value||''));
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&publicHost(url.hostname)?url.href:'';
  }catch(_){return ''}
}
function clone(value){return JSON.parse(JSON.stringify(value))}
function key(deckId,target){return `${deckId}:${target}`}

function structuralDifferences(target,features){
  const found=[];
  const add=(area,detail,fallback)=>found.push({severity:'warning',area,detail,fallback});
  if(target!=='web'&&features.includes('css-layout'))add('layout','El layout CSS no se reproduce de forma nativa.','Usar exportación visual o reconstruir masters y rejillas en el destino.');
  if(target!=='web'&&features.includes('interactive-controls'))add('interaction','Los controles del presentador son exclusivos de la salida web.','Trasladar instrucciones críticas a notas y usar navegación nativa.');
  if(target==='pdf'&&features.some(feature=>['audio','video','animation'].includes(feature)))add('media','PDF aplana contenido temporal o interactivo.','Añadir póster, enlace verificable y texto alternativo.');
  if(['powerpoint','keynote','google-slides'].includes(target)&&features.includes('custom-fonts'))add('fonts','Las fuentes pueden sustituirse si no están instaladas o embebidas.','Empaquetar fuentes autorizadas o definir una familia fallback métrica.');
  if(['keynote','google-slides'].includes(target)&&features.some(feature=>['audio','video','animation'].includes(feature)))add('media','La importación puede cambiar codecs, autoplay o transiciones.','Convertir a MP4 H.264/AAC y probar reproducción manual en el destino.');
  return found;
}

function recompute(lab){
  const entries=Object.values(lab.results||{});
  lab.summary={
    total:entries.length,
    executed:entries.filter(entry=>entry.level==='executed').length,
    structural:entries.filter(entry=>entry.level==='structural').length,
    unavailable:entries.filter(entry=>entry.level==='unavailable').length,
    failed:entries.filter(entry=>entry.level==='executed'&&entry.status==='failed').length,
    differences:entries.reduce((sum,entry)=>sum+(entry.differences||[]).length,0)
  };
  return lab;
}

export function createCompatibilityLab({decks,requestedOutputs=[],features=[],now=new Date().toISOString()}={}){
  const normalizedDecks=unique((Array.isArray(decks)?decks:[]).map(value=>id(value?.id||value)).filter(Boolean)).map(deckId=>{
    const raw=(Array.isArray(decks)?decks:[]).find(value=>id(value?.id||value)===deckId);
    return {id:deckId,label:text(raw?.label,160)||deckId};
  });
  if(!normalizedDecks.length)throw new Error('Compatibilidad: se requiere al menos un deck.');
  const outputs=new Set((Array.isArray(requestedOutputs)?requestedOutputs:[]).map(String));
  const normalizedFeatures=unique((Array.isArray(features)?features:[]).map(value=>id(value)).filter(Boolean)).sort();
  const results={};
  for(const deck of normalizedDecks){
    for(const target of COMPATIBILITY_TARGETS){
      const policy=TARGET_POLICY[target];
      const available=outputs.has(policy.output);
      results[key(deck.id,target)]={
        deckId:deck.id,target,
        level:available?'structural':'unavailable',
        status:available?'analysis_only':'not_requested',
        analyzedAt:iso(now)||new Date().toISOString(),
        differences:available?structuralDifferences(target,normalizedFeatures):[],
        fallback:policy.fallback,
        note:available
          ?'Análisis estructural: no demuestra que la aplicación destino se haya ejecutado.'
          :'Destino no disponible en esta generación: no se creó el entregable de intercambio.'
      };
    }
  }
  return recompute({schemaVersion:1,decks:normalizedDecks,targets:[...COMPATIBILITY_TARGETS],features:normalizedFeatures,results,updatedAt:iso(now)||new Date().toISOString()});
}

function normalizeFindings(value){
  const raw=Array.isArray(value)?value:[];
  if(raw.length>50)throw new Error('Compatibilidad: se admiten hasta 50 diferencias por ejecución.');
  return raw.map((finding,index)=>{
    const severity=SEVERITIES.has(finding?.severity)?finding.severity:'';
    const area=id(finding?.area),detail=text(finding?.detail,500),fallback=text(finding?.fallback,500);
    if(!severity||!area||!detail||!fallback)throw new Error(`Diferencia ${index+1}: severity, area, detail y fallback son obligatorios.`);
    return {severity,area,detail,fallback};
  });
}

export function applyCompatibilityReport(current,report,now=new Date().toISOString()){
  const lab=clone(current);
  const deckId=id(report?.deckId),target=String(report?.target||'');
  const entry=lab.results?.[key(deckId,target)];
  if(!entry||!TARGET_SET.has(target))throw new Error('Compatibilidad: deck o destino desconocido.');
  const checkedAt=iso(report?.checkedAt||now);
  if(!checkedAt)throw new Error('Compatibilidad: checkedAt no es una fecha válida.');
  const nowMs=Date.parse(now),checkedMs=Date.parse(checkedAt);
  if(Number.isFinite(nowMs)&&checkedMs>nowMs+5*60*1000)throw new Error('Compatibilidad: checkedAt no puede estar en el futuro.');
  if(report?.kind==='unavailable'){
    const reason=text(report.reason,300),fallback=text(report.fallback,500);
    if(!reason||!fallback)throw new Error('Compatibilidad: indisponibilidad requiere reason y fallback.');
    Object.assign(entry,{level:'unavailable',status:'not_available',checkedAt,note:reason,fallback,execution:undefined});
  }else if(report?.kind==='execution'){
    const status=EXECUTION_STATUSES.has(report.status)?report.status:'';
    const adapter=id(report.adapter),adapterVersion=text(report.adapterVersion,60);
    const artifactSha256=text(report.artifactSha256,64),evidenceUrl=publicEvidenceUrl(report.evidenceUrl);
    const environment=text(report.environment,160),executedAt=iso(report.executedAt);
    if(!status||!adapter||!adapterVersion||!SHA256.test(artifactSha256)||!evidenceUrl||!environment||!executedAt){
      throw new Error('Compatibilidad: una ejecución real requiere status, adaptador/version, SHA-256, evidenceUrl HTTPS, environment y executedAt.');
    }
    if(Date.parse(executedAt)>checkedMs+5*60*1000)throw new Error('Compatibilidad: executedAt no puede ser posterior a la comprobación.');
    const differences=normalizeFindings(report.differences);
    Object.assign(entry,{
      level:'executed',status,checkedAt,execution:{adapter,adapterVersion,artifactSha256:artifactSha256.toLowerCase(),evidenceUrl,environment,executedAt},
      differences,fallback:text(report.fallback,500)||TARGET_POLICY[target].fallback,
      note:'Ejecución declarada por el adaptador con evidencia verificable; Yokup no infiere que una app se ejecutó.'
    });
  }else throw new Error('Compatibilidad: kind debe ser execution o unavailable.');
  if(!LEVELS.has(entry.level))throw new Error('Compatibilidad: nivel inválido.');
  lab.updatedAt=checkedAt;
  return recompute(lab);
}

export function publicCompatibilityLab(value){
  if(!value||typeof value!=='object')return null;
  return clone(value);
}
