import {publicEvidenceUrl} from './_compatibility-lab.js';

export const ROOM_DEVICES=['mobile','laptop','projector','videowall'];
export const ROOM_AREAS=['codecs','autoplay','performance','legibility'];
const DEVICE_SET=new Set(ROOM_DEVICES),AREA_SET=new Set(ROOM_AREAS);
const SHA256=/^[a-f0-9]{64}$/i,SAFE=/^[a-z0-9][a-z0-9._:-]{0,79}$/i;
const METRICS=new Set(['startupMs','fpsP50','droppedFrameRate','minContrast','minFontPx','viewingDistanceM','testedCodecs','passedCodecs','mutedAutoplay','soundAutoplay','pass']);
const FALLBACKS={
  codecs:{
    mobile:'Servir MP4 H.264/AAC con póster y enlace alternativo.',
    laptop:'Conservar MP4 H.264/AAC y una imagen estática por clip.',
    projector:'Usar portátil reproductor validado y PDF con póster como respaldo.',
    videowall:'Transcodificar al perfil certificado del controlador y conservar stills sincronizados.'
  },
  autoplay:{
    mobile:'Iniciar multimedia tras gesto y mantener controles visibles.',
    laptop:'Preparar un clic de arranque y desactivar audio automático.',
    projector:'Arrancar desde el portátil del operador con un control manual ensayado.',
    videowall:'Usar señal de arranque del controlador; no depender de autoplay del navegador.'
  },
  performance:{
    mobile:'Reducir resolución, precarga y animaciones; ofrecer PDF.',
    laptop:'Cerrar cargas ajenas, precargar el siguiente slide y conservar PDF offline.',
    projector:'Fijar resolución/frecuencia y usar salida cableada con PDF local.',
    videowall:'Prerenderizar composiciones, limitar capas y usar contenido por zona.'
  },
  legibility:{
    mobile:'Usar tipografía mayor, una columna y contraste AA.',
    laptop:'Mantener zoom 100 %, contraste AA y modo presentador separado.',
    projector:'Subir tamaño/contraste y validar desde la última fila con patrón de sala.',
    videowall:'Respetar seams, distancia de visión y safe areas por módulo.'
  }
};

function text(value,max){return String(value==null?'':value).trim().slice(0,max)}
function id(value){const clean=text(value,80);return SAFE.test(clean)?clean:''}
function iso(value){const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():''}
function clone(value){return JSON.parse(JSON.stringify(value))}
const key=(device,area)=>`${device}:${area}`;

function inferredDifference(device,area,features){
  if(area==='codecs'&&features.some(feature=>['audio','video'].includes(feature)))return 'Hay multimedia, pero ningún decoder del dispositivo se ha probado.';
  if(area==='autoplay'&&features.some(feature=>['audio','video'].includes(feature)))return 'Las políticas de autoplay dependen del navegador, gesto y configuración real.';
  if(area==='performance'&&features.some(feature=>['video','animation','css-layout'].includes(feature)))return 'La complejidad visual puede variar por GPU, resolución y carga del dispositivo.';
  if(area==='legibility')return 'Tipografía y contraste están analizados, pero no se ha medido distancia, luz ni superficie real.';
  return 'No hay medición real para esta combinación.';
}
function recompute(lab){
  const entries=Object.values(lab.results||{});
  lab.summary={
    total:entries.length,
    measured:entries.filter(entry=>entry.level==='measured').length,
    capability:entries.filter(entry=>entry.level==='capability').length,
    inferred:entries.filter(entry=>entry.level==='inferred').length,
    unavailable:entries.filter(entry=>entry.level==='unavailable').length,
    failed:entries.filter(entry=>entry.level==='measured'&&entry.status==='failed').length
  };
  return lab;
}

export function createRoomDeviceLab({features=[],now=new Date().toISOString()}={}){
  const normalizedFeatures=[...new Set((Array.isArray(features)?features:[]).map(id).filter(Boolean))].sort();
  const at=iso(now)||new Date().toISOString(),results={};
  for(const device of ROOM_DEVICES)for(const area of ROOM_AREAS){
    const available=device==='mobile'||device==='laptop';
    results[key(device,area)]={
      device,area,level:available?'inferred':'unavailable',
      status:available?'analysis_only':'room_not_profiled',
      checkedAt:at,
      finding:available?inferredDifference(device,area,normalizedFeatures):'No existe perfil ni runner verificado para este hardware o sala.',
      fallback:FALLBACKS[area][device],
      note:available
        ?'Inferencia de diseño: no demuestra una prueba en el dispositivo.'
        :'No disponible: no se afirma que el hardware o la sala hayan sido probados.'
    };
  }
  return recompute({schemaVersion:1,devices:[...ROOM_DEVICES],areas:[...ROOM_AREAS],features:normalizedFeatures,results,updatedAt:at});
}

function cleanMetrics(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Sala: metrics debe ser un objeto acotado.');
  const output={};
  for(const [name,raw] of Object.entries(value)){
    if(!METRICS.has(name))continue;
    if(typeof raw==='boolean')output[name]=raw;
    else if(Number.isFinite(Number(raw)))output[name]=Math.max(0,Math.min(100000,Number(raw)));
  }
  if(!Object.keys(output).length)throw new Error('Sala: no hay métricas reconocidas.');
  return output;
}

export function applyRoomDeviceReport(current,report,now=new Date().toISOString()){
  const lab=clone(current),device=String(report?.device||''),area=String(report?.area||'');
  const entry=lab.results?.[key(device,area)];
  if(!entry||!DEVICE_SET.has(device)||!AREA_SET.has(area))throw new Error('Sala: dispositivo o área desconocida.');
  const checkedAt=iso(report?.checkedAt||now),nowMs=Date.parse(now);
  if(!checkedAt||Date.parse(checkedAt)>nowMs+5*60*1000)throw new Error('Sala: checkedAt inválido o futuro.');
  if(report.kind==='measurement'){
    const adapter=id(report.adapter),adapterVersion=text(report.adapterVersion,60),environment=text(report.environment,160);
    const artifactSha256=text(report.artifactSha256,64),evidenceUrl=publicEvidenceUrl(report.evidenceUrl),executedAt=iso(report.executedAt);
    const status=['passed','passed_with_differences','failed'].includes(report.status)?report.status:'';
    if(!adapter||!adapterVersion||!environment||!SHA256.test(artifactSha256)||!evidenceUrl||!executedAt||!status){
      throw new Error('Sala: una medición real requiere adaptador/version, entorno, SHA-256, evidencia HTTPS pública, executedAt y status.');
    }
    if(Date.parse(executedAt)>Date.parse(checkedAt)+5*60*1000)throw new Error('Sala: executedAt no puede ser posterior a checkedAt.');
    Object.assign(entry,{
      level:'measured',status,checkedAt,metrics:cleanMetrics(report.metrics),
      evidence:{adapter,adapterVersion,environment,artifactSha256:artifactSha256.toLowerCase(),evidenceUrl,executedAt},
      finding:text(report.finding,500)||'Medición registrada por el runner.',
      fallback:text(report.fallback,500)||FALLBACKS[area][device],
      note:'Medición declarada por un runner con evidencia; no se extrapola a otro dispositivo o sala.'
    });
  }else if(report.kind==='capability'){
    const source=['browser-api','device-profile','room-profile'].includes(report.source)?report.source:'';
    const rawCapabilities=Array.isArray(report.capabilities)?report.capabilities:[];
    if(rawCapabilities.length<1||rawCapabilities.length>30)throw new Error('Sala: capability requiere entre 1 y 30 capacidades.');
    const normalizedCapabilities=rawCapabilities.map(id);
    if(normalizedCapabilities.some(value=>!value)||new Set(normalizedCapabilities).size!==normalizedCapabilities.length){
      throw new Error('Sala: las capacidades deben tener IDs válidos y no duplicados.');
    }
    const capabilities=normalizedCapabilities;
    if(!source)throw new Error('Sala: capability requiere source válido.');
    Object.assign(entry,{
      level:'capability',status:'capability_detected',checkedAt,capabilities,
      finding:text(report.finding,500)||'Capacidad detectada; no equivale a una medición del resultado.',
      fallback:text(report.fallback,500)||FALLBACKS[area][device],
      note:'Análisis de capacidades: no afirma reproducción, rendimiento ni legibilidad medidos.'
    });
    delete entry.metrics;delete entry.evidence;
  }else if(report.kind==='unavailable'){
    const reason=text(report.reason,300),fallback=text(report.fallback,500);
    if(!reason||!fallback)throw new Error('Sala: unavailable requiere reason y fallback.');
    Object.assign(entry,{level:'unavailable',status:'not_available',checkedAt,finding:reason,fallback,note:'No disponible: no se afirma que el hardware o la sala hayan sido probados.'});
    delete entry.metrics;delete entry.evidence;delete entry.capabilities;
  }else throw new Error('Sala: kind debe ser measurement, capability o unavailable.');
  lab.updatedAt=checkedAt;
  return recompute(lab);
}

export function publicRoomDeviceLab(value){return value&&typeof value==='object'?clone(value):null}
