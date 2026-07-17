export const OUTPUTS = ['website','audio','video','pdf','powerpoint','documents','infographic'];
export const LANGUAGES = ['es','ca','en'];
export const OUTPUT_LABELS = {
  website:'Website', audio:'Audio', video:'Vídeo', pdf:'PDF', powerpoint:'PowerPoint',
  documents:'Documento de trabajo', infographic:'Infografía'
};
export const LANGUAGE_LABELS = { es:'Castellano', ca:'Català', en:'English' };
export const VALID_STATUSES = new Set(['queued','processing','ready','published','complete','failed','skipped']);

export function taskKey(language, output){ return `${language}:${output}`; }

function postProcess(output){
  if (output !== 'video') return undefined;
  return {
    providerCleanup:'ending-only',
    strategy:'freeze-last-clean-frame',
    preserveVisualStyle:true,
    preserveDuration:true,
    defaultEndingSeconds:2
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
        url:taskUrl(client, language, output), attempts:0, postProcess:postProcess(output), updatedAt:now
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
    artifacts[output] = {
      label:OUTPUT_LABELS[output] || output, status, url:available?.url || null,
      language:available?.language || null, variants:variants.map(task => task.id),
      ready:variants.filter(task => ['ready','published','complete'].includes(task.status)).length,
      total:variants.length, updatedAt:now
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
