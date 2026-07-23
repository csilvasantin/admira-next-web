const SOURCE_TYPES=new Set(['web','notebooklm','document']);
const SAFE_ID=/^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const FINGERPRINT=/^[a-z0-9_-]{16,128}$/i;
const CONTENT_PATH=/^(?:hero\.(?:summary|title)|objective|skeleton\.[a-z0-9._:-]+\.(?:message|detail)|closing\.(?:title|action))$/i;

function text(value,max){return String(value==null?'':value).trim().slice(0,max)}
function id(value){const normalized=text(value,80);return SAFE_ID.test(normalized)?normalized:''}
function unique(values){return [...new Set(values)]}
function httpsUrl(value){
  try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch(_){return ''}
}
function assertUnique(items,label){
  const ids=items.map(item=>item.id);
  if(ids.length!==new Set(ids).size)throw new Error(`${label}: hay identificadores duplicados.`);
}

function normalizeSource(value,index){
  const sourceId=id(value?.id);
  const type=SOURCE_TYPES.has(value?.type)?value.type:'';
  if(!sourceId||!type)throw new Error(`Fuente ${index+1}: id y type válidos son obligatorios.`);
  const source={id:sourceId,type,label:text(value.label,160)||sourceId,locator:text(value.locator,240)};
  if(type==='web'){
    source.url=httpsUrl(value.url);
    if(!source.url)throw new Error(`Fuente ${sourceId}: una fuente web requiere URL HTTPS.`);
  }else{
    source.fingerprint=text(value.fingerprint,128);
    if(!FINGERPRINT.test(source.fingerprint))throw new Error(`Fuente ${sourceId}: ${type} requiere fingerprint opaco de 16-128 caracteres.`);
  }
  if(!source.locator)throw new Error(`Fuente ${sourceId}: locator verificable requerido.`);
  source.verifiable=Boolean(source.locator&&(source.url||source.fingerprint));
  return source;
}

function normalizeClaim(value,index,slideSet,sourceSet){
  const claimId=id(value?.id),slideKey=id(value?.slideKey),contentPath=text(value?.contentPath,180);
  if(!claimId||!slideSet.has(slideKey)||!CONTENT_PATH.test(contentPath)){
    throw new Error(`Afirmación ${index+1}: id, slideKey y contentPath válidos son obligatorios.`);
  }
  const sourceIds=unique((Array.isArray(value.sourceIds)?value.sourceIds:[]).map(id).filter(Boolean));
  const unknown=sourceIds.filter(sourceId=>!sourceSet.has(sourceId));
  if(unknown.length)throw new Error(`Afirmación ${claimId}: fuentes desconocidas ${unknown.join(', ')}.`);
  return {id:claimId,slideKey,contentPath,label:text(value.label,160),sourceIds};
}

export function traceabilitySummary(contract){
  const sources=Array.isArray(contract?.sources)?contract.sources:[];
  const claims=Array.isArray(contract?.claims)?contract.claims:[];
  const sourceById=new Map(sources.map(source=>[source.id,source]));
  const unsupportedClaimIds=claims.filter(claim=>
    !claim.sourceIds.length||claim.sourceIds.some(sourceId=>!sourceById.get(sourceId)?.verifiable)
  ).map(claim=>claim.id);
  const used=new Set(claims.flatMap(claim=>claim.sourceIds));
  const slideKeys=Array.isArray(contract?.slideKeys)?contract.slideKeys:[];
  const reviewed=new Set(Array.isArray(contract?.reviewedSlides)?contract.reviewedSlides:[]);
  const unreviewedSlideKeys=slideKeys.filter(slideKey=>!reviewed.has(slideKey));
  return {
    ready:unsupportedClaimIds.length===0&&unreviewedSlideKeys.length===0,
    totalClaims:claims.length,
    verifiableClaims:claims.length-unsupportedClaimIds.length,
    unsupportedClaimIds,
    unreviewedSlideKeys,
    orphanSourceIds:sources.filter(source=>!used.has(source.id)).map(source=>source.id)
  };
}

export function normalizeSourceTraceability(value,slideKeys,defaults={}){
  const normalizedSlideKeys=unique((Array.isArray(slideKeys)?slideKeys:[]).map(id).filter(Boolean));
  const slideSet=new Set(normalizedSlideKeys);
  const rawSources=Array.isArray(value?.sources)?value.sources:[];
  const sources=rawSources.slice(0,100).map(normalizeSource);
  if(rawSources.length!==sources.length)throw new Error('Trazabilidad: se admiten hasta 100 fuentes.');
  if(!sources.length&&defaults.website){
    sources.push(normalizeSource({
      id:'client-website',type:'web',label:defaults.websiteLabel||'Web oficial del cliente',
      url:defaults.website,locator:'Sitio oficial aportado al generar la presentación'
    },0));
  }
  assertUnique(sources,'Fuentes');
  const sourceSet=new Set(sources.map(source=>source.id));
  const rawClaims=Array.isArray(value?.claims)?value.claims:[];
  const claims=rawClaims.slice(0,500).map((claim,index)=>normalizeClaim(claim,index,slideSet,sourceSet));
  if(rawClaims.length!==claims.length)throw new Error('Trazabilidad: se admiten hasta 500 afirmaciones.');
  assertUnique(claims,'Afirmaciones');
  const requestedReviewed=(Array.isArray(value?.reviewedSlides)?value.reviewedSlides:[]).map(id);
  const unknownReviewed=requestedReviewed.filter(slideKey=>!slideSet.has(slideKey));
  if(unknownReviewed.length)throw new Error(`Trazabilidad: diapositivas revisadas desconocidas ${unique(unknownReviewed).join(', ')}.`);
  const reviewedSlides=unique(requestedReviewed);
  const contract={schemaVersion:1,slideKeys:normalizedSlideKeys,sources,claims,reviewedSlides};
  contract.audit=traceabilitySummary(contract);
  return contract;
}
