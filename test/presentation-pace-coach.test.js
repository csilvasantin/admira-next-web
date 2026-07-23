import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadCoach(){
  const source=await readFile(new URL('../assets/presentation-pace-coach.js',import.meta.url),'utf8');
  const context={};
  vm.runInNewContext(source,context);
  return context.AdmiraPresentationPaceCoach;
}

const items=[
  {title:'Apertura',role:'opening',weight:.7},
  {title:'Contexto',role:'context',weight:1,optional:true},
  {title:'Propuesta',role:'content',weight:1.2},
  {title:'Caso',role:'context',weight:1,optional:true},
  {title:'Cierre',role:'closing',weight:.7}
];

test('la escaleta respeta segundos explícitos y reparte el resto sin deriva',async()=>{
  const coach=await loadCoach();
  const run=coach.createRunOfShow([{title:'Fijo',seconds:90},{title:'Flexible',weight:1},{title:'Flexible 2',weight:2}],600);
  assert.equal(run[0].plannedSeconds,90);
  assert.equal(run[1].plannedSeconds,170);
  assert.equal(run[2].plannedSeconds,340);
  assert.equal(run.reduce((sum,item)=>sum+item.plannedSeconds,0),600);
});

test('cero o una transición mantienen un estado neutral y valores finitos',async()=>{
  const coach=await loadCoach();
  const run=coach.createRunOfShow(items,600);
  for(const samples of [[],[{plannedSeconds:100,actualSeconds:85}]]){
    const result=coach.assess({runOfShow:run,totalSeconds:600,elapsedSeconds:85,currentEnteredAt:80,index:1,samples});
    assert.equal(result.mode,'learning');
    assert.equal(result.predictedFinish,null);
    assert.ok(Number.isFinite(result.plannedRemaining));
    assert.ok(Number.isFinite(result.availableRemaining));
    assert.doesNotMatch(JSON.stringify(result),/NaN|Infinity/);
  }
});

test('el coach recomienda ampliar, resumir o saltar según una predicción estable',async()=>{
  const coach=await loadCoach();
  const run=coach.createRunOfShow(items,600);
  const quick=[{plannedSeconds:run[0].plannedSeconds,actualSeconds:25},{plannedSeconds:run[1].plannedSeconds,actualSeconds:35}];
  const late=[{plannedSeconds:run[0].plannedSeconds,actualSeconds:150},{plannedSeconds:run[1].plannedSeconds,actualSeconds:190}];
  const expand=coach.assess({runOfShow:run,totalSeconds:600,elapsedSeconds:60,currentEnteredAt:60,index:2,samples:quick});
  const skip=coach.assess({runOfShow:run,totalSeconds:600,elapsedSeconds:340,currentEnteredAt:340,index:2,samples:late});
  assert.equal(expand.mode,'expand');
  assert.equal(skip.mode,'skip');
  assert.equal(skip.skipIndex,3);

  const required=run.map(item=>({...item,optional:false}));
  const summarize=coach.assess({runOfShow:required,totalSeconds:600,elapsedSeconds:340,currentEnteredAt:340,index:2,samples:late});
  assert.equal(summarize.mode,'summarize');
  const closing=coach.assess({runOfShow:run,totalSeconds:600,elapsedSeconds:570,currentEnteredAt:560,index:4,samples:late});
  assert.equal(closing.mode,'closing');
  assert.equal(closing.skipIndex,null);
});

test('cambiar la duración recalcula la predicción y los saltos no dan tiempos negativos',async()=>{
  const coach=await loadCoach();
  const shortRun=coach.createRunOfShow(items,600);
  const longRun=coach.createRunOfShow(items,1200);
  const samples=[{plannedSeconds:shortRun[0].plannedSeconds,actualSeconds:80},{plannedSeconds:shortRun[1].plannedSeconds,actualSeconds:100}];
  const short=coach.assess({runOfShow:shortRun,totalSeconds:600,elapsedSeconds:190,currentEnteredAt:180,index:2,samples});
  const remapped=samples.map((sample,index)=>({...sample,plannedSeconds:longRun[index].plannedSeconds}));
  const long=coach.assess({runOfShow:longRun,totalSeconds:1200,elapsedSeconds:190,currentEnteredAt:180,index:2,samples:remapped});
  assert.notEqual(short.predictedFinish,long.predictedFinish);
  const jumped=coach.assess({runOfShow:shortRun,totalSeconds:600,elapsedSeconds:900,currentEnteredAt:900,index:99,samples});
  assert.ok(jumped.plannedRemaining>=0);
  assert.ok(jumped.predictedRemaining>=0);
  assert.ok(jumped.availableRemaining>=0);
});

test('la histéresis conserva el consejo durante el cooldown y permite el cambio después',async()=>{
  const coach=await loadCoach();
  const prior={mode:'expand',label:'Amplía',detail:'Detalle',changedAt:1000};
  const next={mode:'summarize',label:'Resume',detail:'Nuevo'};
  assert.equal(coach.stabilizeAdvice(next,prior,5000,8000).mode,'expand');
  assert.equal(coach.stabilizeAdvice(next,prior,9001,8000).mode,'summarize');
});

test('la histéresis refresca el contenido sin reiniciar el cooldown del mismo consejo',async()=>{
  const coach=await loadCoach();
  const prior={mode:'summarize',label:'Resume',detail:'Recorta 01:20',changedAt:1000};
  const refreshed={mode:'summarize',label:'Resume',detail:'Recorta 01:35'};
  const result=coach.stabilizeAdvice(refreshed,prior,5000,8000);
  assert.equal(result.detail,'Recorta 01:35');
  assert.equal(result.changedAt,1000);
});

test('la integración mantiene el coach privado, no lo difunde y protege el muestreo del scroll suave',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  assert.match(source,/id="presenterPaceCoach"[^>]*data-presenter-private/);
  assert.match(source,/id="presenterCoachAdvice"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(source,/broadcast\(\{type: 'state', index: currentIndex, slideCount: slides\.length, elapsed: seconds, running: running, pace: paceInfo\.label\}\)/);
  assert.doesNotMatch(source,/broadcast\([^)]*(?:coach|advice|prediction)/i);
  assert.match(source,/programmaticNavigationTarget = currentIndex/);
  assert.match(source,/Date\.now\(\) < programmaticNavigationUntil\) return/);
  assert.match(source,/shouldAnnounce = coachLabel\.dataset\.mode !== stableCoachAdvice\.mode/);
  assert.doesNotMatch(source,/shouldAnnounce[^;]*15000/);
  assert.match(source,/resetPaceCoach\(0\)/);
});

test('recuperar o reiniciar una sesión recalibra sin persistir muestras ni consejos privados',async()=>{
  const source=await readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8');
  const storedSession=source.match(/localStorage\.setItem\(sessionStorageKey,[\s\S]*?\}\)\);/)?.[0]||'';
  assert.match(source,/function resumeSession\(\)[\s\S]*resetPaceCoach\(carriedSeconds\)[\s\S]*goLocal\(currentIndex, true\)/);
  assert.match(source,/function resetSession\(\)[\s\S]*resetPaceCoach\(0\)/);
  assert.match(source,/presenterTimerReset[\s\S]*resetPaceCoach\(0\)/);
  assert.doesNotMatch(storedSession,/paceSamples|slideEnteredAt|coach|advice/i);
});

test('el consejo y el salto son operables por teclado sin secuestrar controles enfocados',async()=>{
  const [source,styles]=await Promise.all([
    readFile(new URL('../assets/presentation-presenter-mode.js',import.meta.url),'utf8'),
    readFile(new URL('../assets/presentation-presenter-mode.css',import.meta.url),'utf8')
  ]);
  assert.match(source,/<button[^>]*type="button"[^>]*id="presenterCoachSkip"[^>]*hidden/);
  assert.match(source,/coachSkip\.addEventListener\('click'/);
  assert.match(source,/event\.target\?\.closest\?\.\('input,textarea,select,button,\[contenteditable="true"\]'\)/);
  assert.match(styles,/\.presenter-coach-skip:hover,\.presenter-coach-skip:focus-visible/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
});
