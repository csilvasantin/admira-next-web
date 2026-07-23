import {createCompatibilityLab} from '../presentaciones/_compatibility-lab.js';
import {createRoomDeviceLab} from '../presentaciones/_room-device-lab.js';

const contract={
  schemaVersion:1,
  sources:[
    {id:'web-qa',type:'web',label:'Informe público de QA',url:'https://example.com/report',locator:'Sección 2',verifiable:true},
    {id:'notebook-qa',type:'notebooklm',label:'NotebookLM de QA',fingerprint:'notebooklm_0123456789abcdef',locator:'Fuente 3 · página 8',verifiable:true},
    {id:'document-qa',type:'document',label:'Documento de QA',fingerprint:'document_0123456789abcdef',locator:'Página 4',verifiable:true}
  ],
  claims:[
    {id:'claim-cover',slideKey:'cover',contentPath:'hero.summary',label:'Resumen verificable',sourceIds:['web-qa']},
    {id:'claim-objective',slideKey:'objective',contentPath:'objective',label:'Objetivo verificable',sourceIds:['notebook-qa','document-qa']}
  ],
  slideKeys:['cover','objective'],
  reviewedSlides:['cover','objective'],
  audit:{ready:true,totalClaims:2,verifiableClaims:2,unsupportedClaimIds:[],unreviewedSlideKeys:[],orphanSourceIds:[]}
};
const compatibilityLab=createCompatibilityLab({
  decks:[{id:'proposal:qa',label:'QA reproducible'}],
  requestedOutputs:['website','powerpoint','pdf'],
  features:['css-layout','interactive-controls','custom-fonts','video'],
  now:'2026-07-24T00:00:00.000Z'
});
const roomDeviceLab=createRoomDeviceLab({
  features:['css-layout','interactive-controls','custom-fonts','video'],
  now:'2026-07-24T00:00:00.000Z'
});

function safeJson(value){
  return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
}

function page(audienceMode,autoOpen=false){
  const surface=audienceMode?'audience':'presenter';
  const coverNotes=audienceMode?'':' data-speaker-notes="Confirmar fuentes antes de presentar."';
  const objectiveNotes=audienceMode?'':' data-speaker-notes="Validar aislamiento de audiencia."';
  const privateRuntime=audienceMode?'':`
  <script>window.__ADMIRA_PRESENTER_NOTES__="Fixture de QA sin datos reales.";window.__ADMIRA_SOURCE_TRACEABILITY__=${safeJson(contract)};window.__ADMIRA_COMPATIBILITY_LAB__=${safeJson(compatibilityLab)};window.__ADMIRA_ROOM_DEVICE_LAB__=${safeJson(roomDeviceLab)}</script>
  <script src="/assets/presentation-source-traceability.js?v=20260724-1"></script>
  <script src="/assets/presentation-room-device-lab.js?v=20260724-1"></script>`;
  return `<!doctype html>
<html lang="es" class="${audienceMode?'presenter-audience-mode':''}" data-presenter-surface="${surface}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>QA · Trazabilidad de fuentes · ${surface}</title>
  <link rel="stylesheet" href="/assets/presentation-presenter-mode.css?v=20260723-5">
  <style>
    :root{color-scheme:dark;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}body{margin:0;background:#07101b;color:#f8fbff}
    .slide{min-height:100vh;display:grid;place-items:center;padding:8vw;background:radial-gradient(circle at 85% 15%,#24466f 0,#07101b 55%)}
    .slide:nth-child(2){background:radial-gradient(circle at 15% 85%,#5c4311 0,#07101b 55%)}
    .inner{width:min(960px,100%)}.eyebrow{color:#ffb000;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    h1,h2{font-size:clamp(48px,8vw,104px);line-height:.94;letter-spacing:-.05em;margin:.25em 0}
    p{font-size:clamp(20px,2.5vw,32px);line-height:1.35;max-width:760px}
    .qa-surface{position:fixed;z-index:30;left:18px;top:18px;padding:9px 13px;border:1px solid #ffffff30;border-radius:999px;background:#07101bd9;font:800 11px/1 ui-monospace,monospace;letter-spacing:.08em}
  </style>
</head>
<body>
  <div class="qa-surface">QA · ${audienceMode?'AUDIENCIA SEGURA':'PRESENTADOR PRIVADO'}</div>
  <section id="cover" class="slide" data-block-id="cover"${coverNotes}><div class="inner"><span class="eyebrow">AdmiraNeXT · QA reproducible</span><h1>Trazabilidad de fuentes</h1><p>El modo presentador comprueba dos afirmaciones verificables; la salida de audiencia no recibe el contrato privado.</p></div></section>
  <section id="objective" class="slide" data-block-id="objective"${objectiveNotes}><div class="inner"><span class="eyebrow">Objetivo</span><h2>Presentar con evidencia</h2><p>Esta página ejercita el mismo runtime que las presentaciones generadas.</p></div></section>
  ${privateRuntime}
  <script src="/assets/presentation-presenter-mode.js?v=20260724-3"></script>
  ${!audienceMode&&autoOpen?'<script>document.getElementById("admiraPresenterLaunch")?.click();setTimeout(()=>document.getElementById("presenterLaunchAssistant")?.scrollIntoView({block:"start"}),120)</script>':''}
</body>
</html>`;
}

export function onRequestGet(context){
  const url=new URL(context.request.url);
  const audienceMode=url.searchParams.get('audience')==='1';
  const autoOpen=url.searchParams.get('open')==='1';
  return new Response(page(audienceMode,autoOpen),{headers:{
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store, must-revalidate',
    'x-robots-tag':'noindex, nofollow'
  }});
}
