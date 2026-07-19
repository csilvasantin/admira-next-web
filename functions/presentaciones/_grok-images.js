const MAX_SLIDES = 22;
const MAX_PROMPT_CHARS = 3600;

function clean(value, max = 1200){
  return String(value == null ? '' : value)
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, ' ')
    .replace(/[\u2122\u00ae\u00a9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeId(value, fallback){
  return clean(value, 80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || fallback;
}

function removeClientReferences(value, displayName){
  let output = clean(value);
  const names = [clean(displayName, 100), ...clean(displayName, 100).split(/\s+/).filter(part => part.length >= 4)]
    .filter(Boolean).sort((left, right) => right.length - left.length);
  for(const name of names){
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'the client');
  }
  return output.replace(/\bAdmiraNeXT\b/gi, 'the presentation platform');
}

function themeDirection(presentation){
  const theme = presentation?.theme || {};
  const inspiration = presentation?.inspiration || {};
  const palette = [theme.primary, theme.accent, theme.background, theme.surface]
    .filter(value => /^#[0-9a-f]{6}$/i.test(String(value || ''))).slice(0, 4);
  return [
    clean(theme.profile || inspiration.profile || 'editorial', 40),
    clean(theme.mode || inspiration.mode || 'balanced', 30),
    clean(theme.layout || inspiration.layout || 'editorial', 40),
    palette.length ? `palette ${palette.join(', ')}` : ''
  ].filter(Boolean).join('; ');
}

export function buildImagePrompt({slide, presentation, ideas}){
  const displayName = presentation?.displayName || ideas?.displayName || '';
  const title = removeClientReferences(slide.title, displayName);
  const message = removeClientReferences(slide.message, displayName);
  const detail = removeClientReferences(slide.detail, displayName);
  const prompt = [
    'Create one original widescreen editorial BACKGROUND IMAGE for a premium business presentation.',
    `Slide role: ${slide.role}.`,
    `Theme: ${title || 'connected experience'}.`,
    message ? `Core concept: ${message}.` : '',
    detail ? `Visual context: ${detail}.` : '',
    `Art direction: ${themeDirection(presentation)}. Build a coherent visual system with strong composition, depth and one clear focal idea.`,
    'Use an original conceptual scene or abstract editorial metaphor. Keep generous negative space so presentation copy can be overlaid later.',
    'IP-safe contract: do not imitate any named artist, studio, campaign or existing artwork. Do not show logos, trademarks, brand names, recognizable products, copyrighted characters, public figures or identifiable real people. Do not copy a website or reference design.',
    'ABSOLUTE TEXT-FREE CONTRACT: the image must contain zero visible text and zero typography. Do not render words, letters, numbers, glyphs, captions, labels, symbols that resemble writing, signatures or watermarks.',
    'Avoid every surface that commonly contains text: signs, screens, interfaces, dashboards, books, documents, packaging, maps, charts, clothing graphics, license plates and architectural lettering.',
    'Use generic people only when essential. Do not invent factual claims. Return visual background art only; all presentation copy is added separately by the website.',
    'The result must be suitable for human review before commercial publication.'
  ].filter(Boolean).join('\n');
  return prompt.slice(0, MAX_PROMPT_CHARS);
}

async function digest(value){
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function slideSources(ideas){
  const enabled = (Array.isArray(ideas?.skeleton) ? ideas.skeleton : []).filter(item => item?.enabled !== false);
  return [
    {sourceId:'cover', role:'cover', title:ideas?.hero?.title, message:ideas?.hero?.summary, detail:ideas?.objective},
    {sourceId:'objective', role:'objective', title:'Objective', message:ideas?.objective, detail:'A focused visual metaphor for the decision this presentation should enable.'},
    ...enabled.map((item, index) => ({sourceId:item?.id || `idea-${index + 1}`, role:'content', title:item?.title, message:item?.message, detail:item?.detail})),
    {sourceId:'closing', role:'closing', title:ideas?.closing?.title, message:ideas?.closing?.action, detail:'A decisive, optimistic final image with a clear sense of forward movement.'}
  ].slice(0, MAX_SLIDES);
}

export async function buildImageSet({client, presentation, ideas, model = 'grok-imagine-image', now = new Date().toISOString()}){
  const id = crypto.randomUUID();
  const sources = slideSources(ideas);
  const slides = sources.map((source, index) => {
    const number = String(index + 1).padStart(2, '0');
    const sourceId = safeId(source.sourceId, `slide-${number}`);
    const slide = {
      id:`slide-${number}-${sourceId}`, sourceId, index:index + 1, role:source.role,
      title:clean(source.title, 180) || `Diapositiva ${index + 1}`,
      message:clean(source.message, 900), detail:clean(source.detail, 1400), status:'queued',
      progress:0, requestedAt:now, updatedAt:now
    };
    slide.prompt = buildImagePrompt({slide, presentation, ideas});
    return slide;
  });
  const sourceHash = await digest(JSON.stringify({
    slides:slides.map(({title, message, detail, role}) => ({title, message, detail, role})),
    theme:presentation?.theme || null, inspiration:presentation?.inspiration || null
  }));
  return recomputeImageSet({
    schemaVersion:2, id, client, displayName:clean(presentation?.displayName || ideas?.displayName, 100),
    provider:'xai', model, aspectRatio:'16:9', resolution:'1k', sourceHash,
    safetyContract:'original-background-no-text-v2', textFreeValidationRequired:true, humanReviewRequired:true,
    sourceUpdatedAt:ideas?.updatedAt || presentation?.updatedAt || now,
    slides, status:'queued', progress:0, processed:0, requestedAt:now, createdAt:now, updatedAt:now
  }, now);
}

export function recomputeImageSet(set, now){
  const slides = Array.isArray(set?.slides) ? set.slides : [];
  const ready = slides.filter(slide => slide.status === 'ready').length;
  const failed = slides.filter(slide => slide.status === 'failed').length;
  const processing = slides.some(slide => slide.status === 'processing');
  const pending = slides.filter(slide => ['queued','processing'].includes(slide.status)).length;
  for(const slide of slides){
    if(!Number.isFinite(Number(slide.progress))) slide.progress = ['ready','failed'].includes(slide.status) ? 100 : slide.status === 'processing' ? 10 : 0;
    slide.progress = Math.max(0, Math.min(100, Math.round(Number(slide.progress))));
    slide.requestedAt ||= set.requestedAt || set.createdAt || slide.updatedAt;
    if(slide.status !== 'queued') slide.startedAt ||= slide.submittedAt || slide.requestedAt || slide.updatedAt;
    if(slide.status === 'ready') { slide.progress = 100; slide.completedAt ||= slide.generatedAt || slide.updatedAt; }
    if(slide.status === 'failed') { slide.progress = 100; slide.failedAt ||= slide.updatedAt; }
  }
  set.completed = ready;
  set.failed = failed;
  set.processed = ready + failed;
  set.total = slides.length;
  set.progress = slides.length ? Math.round(slides.reduce((sum, slide) => sum + slide.progress, 0) / slides.length) : 0;
  set.status = ready === slides.length && slides.length ? 'complete' : processing ? 'processing' : pending ? 'queued' : failed ? 'partial' : 'queued';
  const starts=slides.map(slide=>Date.parse(slide.startedAt || '')).filter(Number.isFinite);
  const updates=slides.map(slide=>Date.parse(slide.updatedAt || '')).filter(Number.isFinite);
  if(starts.length) set.startedAt ||= new Date(Math.min(...starts)).toISOString();
  if(updates.length) set.lastActivityAt = new Date(Math.max(...updates)).toISOString();
  const active=slides.find(slide=>slide.status==='processing');
  set.stage=active?.stage || null;
  if(['complete','partial'].includes(set.status)) set.finishedAt ||= now || set.lastActivityAt || new Date().toISOString();
  else delete set.finishedAt;
  if(set.status === 'complete') set.completedAt ||= now || set.lastActivityAt || new Date().toISOString();
  else delete set.completedAt;
  if(now) set.updatedAt = now;
  else set.updatedAt ||= set.lastActivityAt || set.createdAt || new Date().toISOString();
  return set;
}

export function publicImageSet(set){
  if(!set) return null;
  return {
    schemaVersion:set.schemaVersion, id:set.id, client:set.client, displayName:set.displayName,
    provider:set.provider, model:set.model, aspectRatio:set.aspectRatio, resolution:set.resolution,
    sourceHash:set.sourceHash, safetyContract:set.safetyContract,
    textFreeValidationRequired:Boolean(set.textFreeValidationRequired), humanReviewRequired:Boolean(set.humanReviewRequired),
    sourceUpdatedAt:set.sourceUpdatedAt, status:set.status, progress:Number(set.progress || 0),
    completed:Number(set.completed || 0), failed:Number(set.failed || 0), processed:Number(set.processed || 0),
    total:Number(set.total || 0), stage:set.stage || null, requestedAt:set.requestedAt || set.createdAt,
    startedAt:set.startedAt || null, lastActivityAt:set.lastActivityAt || set.updatedAt,
    completedAt:set.completedAt || null, finishedAt:set.finishedAt || set.completedAt || null, updatedAt:set.updatedAt,
    slides:(set.slides || []).map(slide => ({
      id:slide.id, sourceId:slide.sourceId || null, index:slide.index, role:slide.role, title:slide.title, status:slide.status,
      url:slide.url || null, error:slide.error || null, retryable:Boolean(slide.retryable),
      source:slide.source || null, manual:Boolean(slide.manual),
      progress:Number(slide.progress || 0), stage:slide.stage || null, attempts:Number(slide.attempts || 0),
      textFreeVerified:Boolean(slide.textFreeVerified), requestedAt:slide.requestedAt || null,
      submittedAt:slide.submittedAt || null, startedAt:slide.startedAt || null,
      generatedAt:slide.generatedAt || null, completedAt:slide.completedAt || null,
      failedAt:slide.failedAt || null, updatedAt:slide.updatedAt
    }))
  };
}
