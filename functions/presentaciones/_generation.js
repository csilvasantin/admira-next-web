export const OUTPUTS = ['website','audio','video','pdf','powerpoint','documents','infographic'];
export const DEFAULT_OUTPUTS = ['website','audio','video','infographic'];
export const NOTEBOOKLM_OUTPUTS = new Set(['audio','video','infographic']);
export const LANGUAGES = ['es','ca','en'];
export const OUTPUT_LABELS = {
  website:'Website', audio:'Audio', video:'Vídeo', pdf:'PDF', powerpoint:'PowerPoint',
  documents:'Documento de trabajo', infographic:'Infografía'
};
export const LANGUAGE_LABELS = { es:'Castellano', ca:'Català', en:'English' };
export const VALID_STATUSES = new Set(['queued','processing','ready','published','complete','failed','skipped']);
const COMPLETE_STATUSES = new Set(['ready','published','complete']);

export function taskKey(language, output){ return `${language}:${output}`; }

export function updateTaskStatus(task, status, now = new Date().toISOString()){
  task.status = status;
  if (status === 'queued') task.requestedAt ||= now;
  else if (!task.startedAt && status !== 'skipped') task.startedAt = now;
  if (status === 'processing') task.submittedAt ||= now;
  if (COMPLETE_STATUSES.has(status)) {
    task.completedAt ||= now;
    delete task.failedAt;
    delete task.error;
  } else if (['failed','skipped'].includes(status)) {
    task.failedAt ||= now;
    delete task.completedAt;
  } else {
    delete task.completedAt;
    delete task.failedAt;
    if (status !== 'skipped') delete task.error;
  }
  task.updatedAt = now;
  return task;
}

function postProcess(output){
  if (output !== 'video') return undefined;
  return {
    providerCleanup:'ending-only',
    strategy:'freeze-last-clean-frame',
    preserveVisualStyle:true,
    preserveDuration:true,
    defaultEndingSeconds:3
  };
}

function taskUrl(client, language, output){
  return output === 'website' ? `/presentaciones/${client}/presentacion?lang=${language}` : null;
}

export function buildGeneration({client, displayName, outputs, languages, sourceText = ''}){
  const now = new Date().toISOString();
  const tasks = {};
  for (const language of languages) {
    for (const output of outputs) {
      const key = taskKey(language, output);
      tasks[key] = {
        id:key, language, languageLabel:LANGUAGE_LABELS[language], output, label:OUTPUT_LABELS[output],
        status:output === 'website' ? 'ready' : 'queued',
        url:taskUrl(client, language, output), attempts:0, postProcess:postProcess(output),
        provider:NOTEBOOKLM_OUTPUTS.has(output)?'notebooklm':'admiranext', requestedAt:now,
        startedAt:output === 'website' ? now : undefined, completedAt:output === 'website' ? now : undefined, updatedAt:now
      };
    }
  }
  return recomputeGeneration({
    schemaVersion:2, id:crypto.randomUUID(), client, displayName, requested:outputs, languages, tasks,
    artifacts:{}, sourceText, provider:'notebooklm', createdAt:now, updatedAt:now
  });
}

export function normalizeGeneration(job){
  if (!job || typeof job !== 'object') return job;
  if (job.schemaVersion >= 2 && job.tasks && typeof job.tasks === 'object') {
    for (const task of Object.values(job.tasks)) {
      if (task?.output === 'video' && !task.postProcess) task.postProcess = postProcess('video');
      if (!task?.requestedAt) task.requestedAt = job.createdAt || task.updatedAt || new Date().toISOString();
      if (!task?.provider) task.provider = NOTEBOOKLM_OUTPUTS.has(task?.output)?'notebooklm':'admiranext';
      if (!task?.startedAt && !['queued','skipped'].includes(task?.status)) task.startedAt = task.submittedAt || task.updatedAt || job.createdAt;
      if (task?.status === 'processing' && !task.submittedAt) task.submittedAt = task.startedAt;
      if (COMPLETE_STATUSES.has(task?.status) && !task.completedAt) task.completedAt = task.updatedAt || task.startedAt;
      if (['failed','skipped'].includes(task?.status) && !task.failedAt) task.failedAt = task.updatedAt || task.startedAt || job.createdAt;
    }
    return recomputeGeneration(job);
  }
  const languages = Array.isArray(job.languages) && job.languages.length ? job.languages : ['es'];
  const outputs = Array.isArray(job.requested) && job.requested.length ? job.requested : Object.keys(job.artifacts || {});
  const tasks = {};
  for (const language of languages) {
    for (const output of outputs) {
      const old = job.artifacts?.[output] || {};
      const key = taskKey(language, output);
      tasks[key] = {
        id:key, language, languageLabel:LANGUAGE_LABELS[language] || language.toUpperCase(), output,
        label:old.label || OUTPUT_LABELS[output] || output, status:VALID_STATUSES.has(old.status) ? old.status : 'queued',
        url:old.url || taskUrl(job.client, language, output), error:old.error, attempts:0,
        postProcess:postProcess(output),
        provider:NOTEBOOKLM_OUTPUTS.has(output)?'notebooklm':'admiranext',
        requestedAt:old.requestedAt || job.createdAt || old.updatedAt || job.updatedAt,
        startedAt:old.startedAt || old.submittedAt,
        submittedAt:old.submittedAt,
        completedAt:old.completedAt, failedAt:old.failedAt,
        updatedAt:old.updatedAt || job.updatedAt || job.createdAt || new Date().toISOString()
      };
    }
  }
  return recomputeGeneration({...job, schemaVersion:2, languages, requested:outputs, tasks});
}

export function recomputeGeneration(job){
  const now = new Date().toISOString();
  const tasks = Object.values(job.tasks || {});
  const artifacts = {};
  for (const output of job.requested || []) {
    const variants = tasks.filter(task => task.output === output);
    const published = variants.find(task => task.status === 'published' && task.url);
    const ready = variants.find(task => task.status === 'ready' && task.url);
    const processing = variants.some(task => task.status === 'processing');
    const allTerminal = variants.length && variants.every(task => ['ready','published','failed','skipped','complete'].includes(task.status));
    const allFailed = variants.length && variants.every(task => ['failed','skipped'].includes(task.status));
    let status = published ? 'published' : ready ? 'ready' : processing ? 'processing' : allFailed ? 'failed' : allTerminal ? 'complete' : 'queued';
    const available = published || ready;
    const failed = variants.find(task => ['failed','skipped'].includes(task.status) && task.error) || variants.find(task => ['failed','skipped'].includes(task.status));
    const dates = variants.map(task => Date.parse(task.startedAt || task.submittedAt || '')).filter(Number.isFinite);
    const requests = variants.map(task => Date.parse(task.requestedAt || '')).filter(Number.isFinite);
    const updates = variants.map(task => Date.parse(task.updatedAt || '')).filter(Number.isFinite);
    artifacts[output] = {
      label:OUTPUT_LABELS[output] || output, status, url:available?.url || null,
      language:available?.language || null, variants:variants.map(task => task.id),
      ready:variants.filter(task => ['ready','published','complete'].includes(task.status)).length,
      total:variants.length, requestedAt:requests.length ? new Date(Math.min(...requests)).toISOString() : job.createdAt || null,
      startedAt:dates.length ? new Date(Math.min(...dates)).toISOString() : null,
      completedAt:available?.completedAt || null, failedAt:failed?.failedAt || null,
      error:failed?.error || null,
      updatedAt:updates.length ? new Date(Math.max(...updates)).toISOString() : now
    };
  }
  const statuses = tasks.map(task => task.status);
  if (statuses.length && statuses.every(status => ['ready','published','complete','skipped'].includes(status))) job.status = 'complete';
  else if (statuses.some(status => status === 'processing')) job.status = 'processing';
  else if (statuses.length && statuses.every(status => ['failed','skipped'].includes(status))) job.status = 'failed';
  else job.status = 'queued';
  job.artifacts = artifacts;
  job.updatedAt = now;
  return job;
}

export function publicGeneration(job){
  if (!job) return null;
  const { sourceText, provider, ...safe } = job;
  return safe;
}
