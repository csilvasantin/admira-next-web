const LANGUAGES = new Set(['es', 'ca', 'en']);
const QUALITIES = new Set(['good', 'better', 'best']);
const STYLES = new Set(['arcade', 'vhs', 'synthwave']);
const DESTINATION_TYPES = new Set(['presentation', 'site', 'app']);
const STORYBOARD_IDS = ['boot', 'signal', 'odyssey', 'reveal', 'launch'];
const MAX_VERSIONS = 20;

export function cleanText(value, limit = 1200) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, limit);
}

export function slugify(value) {
  return cleanText(value, 100).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

export function esc(value) {
  return String(value == null ? '' : value).replace(/[<>&"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'
  }[char]));
}

function color(value, fallback) {
  const next = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(next) ? next.toLowerCase() : fallback;
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function safeDestination(value) {
  const next = cleanText(value, 500);
  if (/^\/(?!\/)[a-z0-9/_?=&%#.+~-]*$/i.test(next)) return next;
  try {
    const url = new URL(next);
    return url.protocol === 'https:' ? url.href : '';
  } catch (_) {
    return '';
  }
}

function copy(language) {
  return {
    es: {
      skip: 'Saltar intro', sound: 'Sonido', play: 'Pausa', resume: 'Reproducir', enter: 'Entrar',
      reduced: 'Movimiento reducido activo', destination: 'La experiencia continúa',
      beats: [
        ['SISTEMA ADMR-1992', 'Insert coin to imagine'],
        ['SEÑAL ENCONTRADA', 'Toda gran historia empieza antes de empezar.'],
        ['CULTURA EN MOVIMIENTO', 'Arcades, videoclubs, radio nocturna y futuros que todavía queremos visitar.'],
        ['UNA NUEVA PARTIDA', 'La atención no se pide. Se merece.'],
        ['PRESS ENTER', 'Entrar en la experiencia']
      ]
    },
    ca: {
      skip: 'Saltar intro', sound: 'So', play: 'Pausa', resume: 'Reproduir', enter: 'Entrar',
      reduced: 'Moviment reduït actiu', destination: "L'experiència continua",
      beats: [
        ['SISTEMA ADMR-1992', 'Insert coin to imagine'],
        ['SENYAL TROBAT', 'Tota gran història comença abans de començar.'],
        ['CULTURA EN MOVIMENT', 'Arcades, videoclubs, ràdio nocturna i futurs que encara volem visitar.'],
        ['UNA NOVA PARTIDA', "L'atenció no es demana. Es mereix."],
        ['PRESS ENTER', "Entrar a l'experiència"]
      ]
    },
    en: {
      skip: 'Skip intro', sound: 'Sound', play: 'Pause', resume: 'Play', enter: 'Enter',
      reduced: 'Reduced motion enabled', destination: 'The experience continues',
      beats: [
        ['SYSTEM ADMR-1992', 'Insert coin to imagine'],
        ['SIGNAL ACQUIRED', 'Every great story begins before it starts.'],
        ['CULTURE IN MOTION', 'Arcades, video stores, midnight radio and futures we still want to visit.'],
        ['A NEW GAME', 'Attention is not requested. It is earned.'],
        ['PRESS ENTER', 'Enter the experience']
      ]
    }
  }[language];
}

function seedStoryboard(input, language) {
  const labels = copy(language);
  const brand = input.displayName || 'ADmiraNeXT';
  const culture = input.culture || 'Arcade, cine de aventuras, synth pop y videojuegos de los 80/90.';
  const objective = input.objective || 'Abrir una experiencia que merezca ser recordada.';
  return STORYBOARD_IDS.map((id, index) => ({
    id,
    cue: labels.beats[index][0],
    title: index === 1 ? brand : labels.beats[index][1],
    body: index === 2 ? culture : (index === 3 ? objective : (index === 4 ? input.cta || labels.destination : '')),
    duration: [12, 18, 28, 24, 18][index]
  }));
}

export function normalizePresite(raw = {}, existing = null) {
  const displayName = cleanText(raw.displayName || existing?.displayName, 100);
  const slug = slugify(raw.slug || displayName || existing?.slug);
  const languageValue = String(raw.language || existing?.language || '').toLowerCase();
  const qualityValue = String(raw.quality || existing?.quality || '').toLowerCase();
  const styleValue = String(raw.experience?.style || raw.style || existing?.experience?.style || '').toLowerCase();
  const destinationTypeValue = String(raw.destination?.type || raw.destinationType || existing?.destination?.type || '').toLowerCase();
  const language = LANGUAGES.has(languageValue) ? languageValue : 'es';
  const quality = QUALITIES.has(qualityValue) ? qualityValue : 'good';
  const input = {
    displayName,
    slug,
    language,
    quality,
    brief: cleanText(raw.brief || existing?.brief, 1400),
    objective: cleanText(raw.objective || existing?.objective, 1000),
    audience: cleanText(raw.audience || existing?.audience, 500),
    culture: cleanText(raw.culture || existing?.culture, 700),
    title: cleanText(raw.title || existing?.title, 220),
    cta: cleanText(raw.cta || existing?.cta, 500)
  };
  input.destination = {
    type: DESTINATION_TYPES.has(destinationTypeValue) ? destinationTypeValue : 'presentation',
    url: safeDestination(raw.destination?.url || raw.destinationUrl || existing?.destination?.url || '/presentaciones/')
  };
  input.experience = {
    style: STYLES.has(styleValue) ? styleValue : 'arcade',
    duration: integer(raw.experience?.duration ?? raw.duration ?? existing?.experience?.duration, 18, 8, 45),
    autoAdvance: (raw.experience?.autoAdvance ?? raw.autoAdvance ?? existing?.experience?.autoAdvance) === true
  };
  const submitted = Array.isArray(raw.storyboard) ? raw.storyboard : null;
  const previous = Array.isArray(existing?.storyboard) ? existing.storyboard : null;
  const source = submitted || previous || seedStoryboard(input, language);
  const byId = new Map(source.map(beat => [String(beat?.id || ''), beat]));
  const defaults = new Map(seedStoryboard(input, language).map(beat => [beat.id, beat]));
  input.storyboard = STORYBOARD_IDS.map(id => {
    const base = defaults.get(id);
    const beat = byId.get(id) || base;
    return {
      id,
      cue: cleanText(beat.cue || base.cue, 80),
      title: cleanText(beat.title || base.title, 220),
      body: cleanText(beat.body || base.body, 800),
      duration: integer(beat.duration, base.duration, 5, 50)
    };
  });
  input.theme = {
    primary: color(raw.theme?.primary || existing?.theme?.primary, '#05070d'),
    accent: color(raw.theme?.accent || existing?.theme?.accent, '#65e9f4'),
    glow: color(raw.theme?.glow || existing?.theme?.glow, '#ff4fa3')
  };
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    ...input,
    status: existing?.status || 'draft',
    publication: existing?.publication || { mode: 'simulation', published: false },
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

export function validatePresite(site) {
  if (!site.displayName || site.displayName.length < 2) return 'Indica un nombre de marca válido.';
  if (!site.slug || site.slug.length < 2) return 'El identificador de URL no es válido.';
  if (!site.brief) return 'Resume la idea o brief de la intro.';
  if (!site.objective) return 'Indica qué debe provocar la intro.';
  if (!site.audience) return 'Indica a quién va dirigida.';
  if (!safeDestination(site.destination?.url)) return 'Indica un destino HTTPS o una ruta interna válida.';
  return '';
}

export function presiteKey(slug) { return `presite:site:${slug}`; }
export function versionsKey(slug) { return `presite:versions:${slug}`; }
export function listKey() { return 'presite:index'; }

export function appendVersion(versions, site, label = 'guardado') {
  return [{
    id: crypto.randomUUID(),
    label: cleanText(label, 100),
    createdAt: new Date().toISOString(),
    site
  }, ...(Array.isArray(versions) ? versions : [])].slice(0, MAX_VERSIONS);
}

export function publicSummary(site) {
  return {
    slug: site.slug,
    displayName: site.displayName,
    language: site.language,
    quality: site.quality,
    style: site.experience?.style,
    duration: site.experience?.duration,
    destinationType: site.destination?.type,
    status: site.status,
    publication: site.publication,
    updatedAt: site.updatedAt,
    createdAt: site.createdAt
  };
}

export function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}
  });
}

export function renderPresite(site, {preview = false} = {}) {
  const quality = QUALITIES.has(site.quality) ? site.quality : 'good';
  const language = LANGUAGES.has(site.language) ? site.language : 'es';
  const style = STYLES.has(site.experience?.style) ? site.experience.style : 'arcade';
  const labels = copy(language);
  const theme = site.theme || {};
  const duration = integer(site.experience?.duration, 18, 8, 45);
  const destination = preview ? '#presite-preview-destination' : safeDestination(site.destination?.url) || '/';
  const beats = Array.isArray(site.storyboard) ? site.storyboard : seedStoryboard(site, language);
  const scenes = beats.map((beat, index) => `
    <section class="intro-scene scene-${index + 1}" data-scene="${index + 1}" aria-hidden="${index ? 'true' : 'false'}">
      <div class="scene-copy">
        <span class="scene-cue">${esc(beat.cue)}</span>
        <h${index === 1 ? '1' : '2'}>${esc(beat.title)}</h${index === 1 ? '1' : '2'}>
        ${beat.body ? `<p>${esc(beat.body)}</p>` : ''}
      </div>
    </section>`).join('');
  const autoAdvance = site.experience?.autoAdvance === true;
  const runtimeConfig = JSON.stringify({
    destination,
    preview,
    autoAdvance,
    duration,
    labels: {reduced: labels.reduced}
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${esc(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><title>${esc(site.displayName)} · Presite</title><style>
  :root{--bg:${esc(theme.primary || '#05070d')};--accent:${esc(theme.accent || '#65e9f4')};--glow:${esc(theme.glow || '#ff4fa3')};--ink:#f7fbff;--duration:${duration}s}
  *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--bg);color:var(--ink);font-family:ui-monospace,"SFMono-Regular",Consolas,monospace}button,a{font:inherit}button:focus-visible,a:focus-visible{outline:2px solid #fff;outline-offset:3px}.presite-intro{position:relative;width:100%;height:100%;isolation:isolate;background:radial-gradient(circle at 50% 55%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 42%),var(--bg);transition:opacity .55s ease,transform .55s ease}.presite-intro.is-exiting{opacity:0;transform:scale(1.035)}.intro-stage,.intro-scene{position:absolute;inset:0}.intro-stage{overflow:hidden}.intro-stage::before{content:"";position:absolute;inset:-40%;background:repeating-linear-gradient(90deg,transparent 0 5.8vw,color-mix(in srgb,var(--accent) 11%,transparent) 6vw),repeating-linear-gradient(0deg,transparent 0 5.8vw,color-mix(in srgb,var(--accent) 11%,transparent) 6vw);transform:perspective(420px) rotateX(64deg) translateY(34%);transform-origin:center bottom;animation:gridDrive 5s linear infinite}.intro-stage::after{content:"";position:absolute;inset:0;z-index:20;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0 1px,transparent 1px 4px),linear-gradient(90deg,rgba(255,0,74,.04),transparent 30%,rgba(0,180,255,.04));mix-blend-mode:screen}.intro-scene{display:grid;place-items:center;padding:clamp(24px,6vw,96px);text-align:center;opacity:0;animation:scene var(--duration) linear infinite}.scene-copy{max-width:min(980px,90vw);position:relative;z-index:3}.scene-cue{display:inline-flex;padding:8px 12px;border:1px solid color-mix(in srgb,var(--accent) 70%,transparent);color:var(--accent);font-size:clamp(9px,1.2vw,13px);font-weight:900;letter-spacing:.2em;text-transform:uppercase;box-shadow:0 0 32px color-mix(in srgb,var(--accent) 18%,transparent)}h1,h2{margin:22px 0 16px;font-family:Impact,"Arial Black",sans-serif;font-weight:900;font-size:clamp(54px,12vw,170px);line-height:.82;letter-spacing:-.045em;text-transform:uppercase;text-shadow:.035em .035em 0 var(--glow),0 0 45px color-mix(in srgb,var(--accent) 32%,transparent)}p{max-width:720px;margin:0 auto;color:#c7d6e4;font-family:system-ui,sans-serif;font-size:clamp(15px,2vw,24px);line-height:1.45}.scene-1{animation-delay:0s}.scene-2{animation-delay:calc(var(--duration) * -.80)}.scene-3{animation-delay:calc(var(--duration) * -.60)}.scene-4{animation-delay:calc(var(--duration) * -.38)}.scene-5{animation-delay:calc(var(--duration) * -.18)}.scene-5 h2{animation:pulse 1.1s steps(2,end) infinite}
  .intro-sun{position:absolute;z-index:0;left:50%;top:50%;width:min(45vw,480px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-56%);background:repeating-linear-gradient(0deg,var(--glow) 0 8%,transparent 8% 12%),linear-gradient(var(--accent),var(--glow));filter:drop-shadow(0 0 55px color-mix(in srgb,var(--glow) 45%,transparent));opacity:.32}.intro-stars{position:absolute;inset:0;background-image:radial-gradient(circle,#fff 0 1px,transparent 1.5px),radial-gradient(circle,var(--accent) 0 1px,transparent 1.5px);background-size:93px 93px,137px 137px;background-position:12px 17px,64px 39px;animation:stars 8s linear infinite}.intro-chrome{position:absolute;inset:8%;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);clip-path:polygon(8% 0,92% 0,100% 12%,100% 88%,92% 100%,8% 100%,0 88%,0 12%);box-shadow:inset 0 0 90px color-mix(in srgb,var(--accent) 8%,transparent)}
  .intro-controls{position:fixed;z-index:50;inset:clamp(12px,2vw,24px) clamp(12px,2vw,28px) auto;display:flex;align-items:center;justify-content:space-between;gap:12px}.control-group{display:flex;gap:8px;flex-wrap:wrap}.intro-control{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 14px;border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);border-radius:999px;background:rgba(3,7,13,.72);backdrop-filter:blur(12px);color:#fff;font-size:10px;font-weight:900;letter-spacing:.1em;text-decoration:none;text-transform:uppercase;cursor:pointer}.intro-control:hover{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,#03070d)}.intro-control.skip{border-color:#fff}.intro-progress{position:fixed;z-index:50;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.12)}.intro-progress span{display:block;width:100%;height:100%;background:linear-gradient(90deg,var(--accent),var(--glow));transform-origin:left;animation:progress var(--duration) linear infinite}.intro-hint{position:fixed;z-index:50;left:50%;bottom:22px;transform:translateX(-50%);color:rgba(255,255,255,.65);font-size:9px;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}.preview-note{position:fixed;z-index:60;right:20px;bottom:22px;color:var(--accent);font-size:9px;letter-spacing:.12em;text-transform:uppercase}.static-fallback{display:none}
  body[data-quality="good"] .intro-stage::before{opacity:.25}body[data-quality="good"] .intro-sun{opacity:.18}body[data-quality="good"] h1,body[data-quality="good"] h2{text-shadow:.025em .025em 0 var(--accent)}
  body[data-quality="better"] .intro-stage{background:linear-gradient(115deg,transparent 48%,color-mix(in srgb,var(--accent) 8%,transparent) 49% 51%,transparent 52%)}body[data-quality="better"] .scene-copy{transform:skewY(-1deg)}
  body[data-quality="best"] .intro-stage{background:radial-gradient(circle at 50% 48%,transparent 0 16%,color-mix(in srgb,var(--glow) 11%,transparent) 38%,transparent 64%)}body[data-quality="best"] h1,body[data-quality="best"] h2{mix-blend-mode:screen}body[data-quality="best"] .intro-chrome{animation:chrome 2.5s ease-in-out infinite alternate}
  body[data-style="vhs"] .intro-stage::after{background:repeating-linear-gradient(0deg,rgba(255,255,255,.045) 0 1px,transparent 1px 3px),linear-gradient(90deg,rgba(255,0,74,.08),transparent 36%,rgba(0,180,255,.08));animation:vhs .22s steps(2,end) infinite}body[data-style="vhs"] .scene-copy{filter:contrast(1.15) saturate(.82)}body[data-style="arcade"] .scene-cue{border-radius:0}body[data-style="synthwave"] .intro-sun{opacity:.58}
  body.is-paused *,body.is-paused *::before,body.is-paused *::after{animation-play-state:paused!important}
  body.is-reduced .intro-scene{display:none;animation:none}body.is-reduced .scene-5{display:grid;opacity:1}body.is-reduced .intro-stars,body.is-reduced .intro-stage::before,body.is-reduced .intro-chrome,body.is-reduced .intro-progress span{animation:none}body.is-reduced .intro-progress span{transform:none}
  @keyframes scene{0%,17%{opacity:0;transform:scale(.94)}3%,14%{opacity:1;transform:scale(1)}16%{opacity:0;transform:scale(1.035)}100%{opacity:0}}@keyframes progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes gridDrive{to{background-position:0 0,0 6vw}}@keyframes stars{to{background-position:105px 150px,210px 260px}}@keyframes pulse{50%{opacity:.3}}@keyframes chrome{to{inset:5%;filter:hue-rotate(25deg)}}@keyframes vhs{50%{transform:translateX(1px)}}@media(max-width:640px){.intro-controls{align-items:flex-start}.control-group{max-width:175px;justify-content:flex-end}.intro-control{min-height:38px;padding:0 11px;font-size:8px}.intro-hint{display:none}h1,h2{font-size:clamp(48px,18vw,100px)}}@media(prefers-reduced-motion:reduce){.intro-scene{display:none;animation:none}.scene-5{display:grid;opacity:1}.intro-stars,.intro-stage::before,.intro-chrome,.intro-progress span{animation:none}.intro-progress span{transform:none}.presite-intro{transition:none}}
  @supports not (animation-name:scene){.intro-scene{display:none}.scene-5{display:grid;opacity:1}}
  </style></head><body data-quality="${quality}" data-style="${style}"><main class="presite-intro" id="presiteIntro"><div class="intro-stage" aria-live="polite"><div class="intro-stars"></div><div class="intro-sun"></div><div class="intro-chrome"></div>${scenes}</div><div class="intro-controls"><button class="intro-control skip" id="skipIntro" type="button">${esc(labels.skip)} · Esc</button><div class="control-group"><button class="intro-control" id="togglePlayback" type="button" aria-pressed="false">${esc(labels.play)}</button><button class="intro-control" id="toggleSound" type="button" aria-pressed="false">${esc(labels.sound)} · Off</button><a class="intro-control" id="enterExperience" href="${esc(destination)}">${esc(labels.enter)} · ↵</a></div></div><div class="intro-progress" aria-hidden="true"><span></span></div><div class="intro-hint">Esc · ${esc(labels.skip)} &nbsp; / &nbsp; Enter · ${esc(labels.enter)}</div>${preview ? '<div class="preview-note" id="presite-preview-destination">Preview · salida desactivada</div>' : ''}</main><noscript><style>.presite-intro{display:none}.static-fallback{min-height:100%;display:grid;place-content:center;gap:24px;padding:32px;text-align:center;background:var(--bg)}.static-fallback h1{font-size:clamp(48px,12vw,140px)}.static-fallback a{justify-self:center;padding:14px 18px;border:1px solid var(--accent);color:#fff;text-decoration:none}</style><div class="static-fallback"><h1>${esc(site.displayName)}</h1><a href="${esc(destination)}">${esc(labels.enter)}</a></div></noscript><script>
  (()=>{'use strict';const config=${runtimeConfig};const root=document.getElementById('presiteIntro'),skip=document.getElementById('skipIntro'),enter=document.getElementById('enterExperience'),play=document.getElementById('togglePlayback'),sound=document.getElementById('toggleSound');let audio=null,timer=null,exitTimer=null,leaving=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){document.body.classList.add('is-reduced');root.setAttribute('aria-label',config.labels.reduced);const finalScene=root.querySelector('.scene-5');if(finalScene)finalScene.setAttribute('aria-hidden','false')}const go=event=>{if(event)event.preventDefault();if(config.preview){if(root.animate)root.animate([{filter:'brightness(1)'},{filter:'brightness(1.5)'},{filter:'brightness(1)'}],{duration:420});return}if(leaving)return;leaving=true;if(reduced){location.assign(config.destination);return}const finish=()=>{if(!leaving)return;clearTimeout(exitTimer);root.removeEventListener('transitionend',onTransitionEnd);location.assign(config.destination)},onTransitionEnd=transition=>{if(transition.target===root&&['opacity','transform'].includes(transition.propertyName))finish()};root.addEventListener('transitionend',onTransitionEnd);root.classList.add('is-exiting');exitTimer=setTimeout(finish,550)};skip.addEventListener('click',go);enter.addEventListener('click',go);play.addEventListener('click',()=>{const paused=document.body.classList.toggle('is-paused');if(audio)(paused?audio.suspend():audio.resume());play.setAttribute('aria-pressed',String(paused));play.textContent=paused?'${esc(labels.resume)}':'${esc(labels.play)}'});sound.addEventListener('click',()=>{const enabled=sound.getAttribute('aria-pressed')!=='true';if(!enabled&&audio){audio.close();audio=null}if(enabled){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext){sound.setAttribute('aria-pressed','false');sound.textContent='${esc(labels.sound)} · Off';return}audio=new AudioContext();const master=audio.createGain(),filter=audio.createBiquadFilter(),bass=audio.createOscillator(),fifth=audio.createOscillator(),lfo=audio.createOscillator(),lfoDepth=audio.createGain();master.gain.value=.018;filter.type='lowpass';filter.frequency.value=420;bass.type='sawtooth';bass.frequency.value=55;fifth.type='triangle';fifth.frequency.value=82.5;lfo.type='sine';lfo.frequency.value=.08;lfoDepth.gain.value=150;lfo.connect(lfoDepth).connect(filter.frequency);bass.connect(filter);fifth.connect(filter);filter.connect(master).connect(audio.destination);bass.start();fifth.start();lfo.start();[0,0.12,0.24,0.48].forEach((time,index)=>{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=index===3?'sine':'square';oscillator.frequency.value=[110,165,220,440][index];gain.gain.setValueAtTime(.0001,audio.currentTime+time);gain.gain.exponentialRampToValueAtTime(.035,audio.currentTime+time+.02);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+time+.11);oscillator.connect(gain).connect(audio.destination);oscillator.start(audio.currentTime+time);oscillator.stop(audio.currentTime+time+.13)});if(document.body.classList.contains('is-paused'))audio.suspend()}sound.setAttribute('aria-pressed',String(enabled));sound.textContent='${esc(labels.sound)} · '+(enabled?'On':'Off')});document.addEventListener('keydown',event=>{if(event.key==='Escape')go(event);if(event.key==='Enter'&&!event.repeat&&!event.target.closest('button,a,input,select,textarea'))go(event)});if(config.autoAdvance&&!config.preview&&!reduced)timer=setTimeout(go,config.duration*1000);addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(exitTimer);if(audio)audio.close()})})();
  </script></body></html>`;
}
