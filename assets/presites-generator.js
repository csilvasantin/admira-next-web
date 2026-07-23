(function () {
  'use strict';

  const form = document.getElementById('presiteGenerator');
  const frame = document.getElementById('presitePreview');
  const status = document.getElementById('generatorStatus');
  if (!form || !frame) return;

  const escapeHtml = value => String(value || '').replace(/[<>&"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'
  }[char]));
  const value = name => new FormData(form).get(name) || '';
  const slugify = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

  function payload() {
    const data = new FormData(form);
    return {
      displayName: value('displayName'),
      slug: value('slug') || slugify(value('displayName')),
      brief: value('brief'),
      objective: value('objective'),
      audience: value('audience'),
      culture: value('culture'),
      language: value('language'),
      quality: value('quality'),
      title: value('title'),
      cta: value('cta'),
      destination: {type: value('destinationType'), url: value('destinationUrl')},
      experience: {
        style: value('style'),
        duration: Number(value('duration')) || 18,
        autoAdvance: data.get('autoAdvance') === 'true'
      },
      theme: {primary: value('primary'), accent: value('accent'), glow: value('glow')}
    };
  }

  const translations = {
    es: {skip: 'Saltar intro', enter: 'Entrar', pause: 'Pausa', sound: 'Sonido', cues: ['SISTEMA ADMR-1992', 'SEÑAL ENCONTRADA', 'CULTURA EN MOVIMIENTO', 'UNA NUEVA PARTIDA', 'PRESS ENTER']},
    ca: {skip: 'Saltar intro', enter: 'Entrar', pause: 'Pausa', sound: 'So', cues: ['SISTEMA ADMR-1992', 'SENYAL TROBAT', 'CULTURA EN MOVIMENT', 'UNA NOVA PARTIDA', 'PRESS ENTER']},
    en: {skip: 'Skip intro', enter: 'Enter', pause: 'Pause', sound: 'Sound', cues: ['SYSTEM ADMR-1992', 'SIGNAL ACQUIRED', 'CULTURE IN MOTION', 'A NEW GAME', 'PRESS ENTER']}
  };

  function preview() {
    const data = payload();
    const copy = translations[data.language] || translations.es;
    const scenes = [
      ['Insert coin to imagine', ''],
      [data.title || data.displayName || 'ADmiraNeXT', data.brief],
      ['A future worth remembering', data.culture],
      ['Attention is earned', data.objective],
      [data.cta || 'The experience continues', '']
    ].map((scene, index) => `<section class="scene s${index + 1}"><span>${escapeHtml(copy.cues[index])}</span><h${index === 1 ? '1' : '2'}>${escapeHtml(scene[0])}</h${index === 1 ? '1' : '2'}>${scene[1] ? `<p>${escapeHtml(scene[1])}</p>` : ''}</section>`).join('');

    frame.srcdoc = `<!doctype html><html lang="${escapeHtml(data.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      :root{--bg:${escapeHtml(data.theme.primary)};--a:${escapeHtml(data.theme.accent)};--g:${escapeHtml(data.theme.glow)};--d:${data.experience.duration}s}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--bg);color:#fff;font-family:ui-monospace,monospace}body{background:radial-gradient(circle at 50% 48%,color-mix(in srgb,var(--a) 18%,transparent),transparent 44%),var(--bg)}main{position:relative;width:100%;height:100%;overflow:hidden}main:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px);z-index:10;pointer-events:none}.grid{position:absolute;inset:35% -30% -45%;background:repeating-linear-gradient(90deg,transparent 0 9.8%,color-mix(in srgb,var(--a) 28%,transparent) 10%),repeating-linear-gradient(0deg,transparent 0 9.8%,color-mix(in srgb,var(--a) 28%,transparent) 10%);transform:perspective(300px) rotateX(63deg);animation:drive 4s linear infinite}.sun{position:absolute;left:50%;top:48%;width:min(42vw,280px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);background:repeating-linear-gradient(0deg,var(--g) 0 8%,transparent 8% 12%),linear-gradient(var(--a),var(--g));opacity:.34;filter:drop-shadow(0 0 40px var(--g))}.scene{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:8%;opacity:0;animation:scene var(--d) linear infinite}.scene span{justify-self:center;padding:6px 9px;border:1px solid var(--a);color:var(--a);font-size:9px;font-weight:900;letter-spacing:.16em}.scene h1,.scene h2{max-width:850px;margin:18px auto 12px;font-family:Impact,"Arial Black",sans-serif;font-size:clamp(44px,10vw,118px);line-height:.82;letter-spacing:-.04em;text-transform:uppercase;text-shadow:.04em .04em 0 var(--g),0 0 35px color-mix(in srgb,var(--a) 35%,transparent)}.scene p{max-width:580px;margin:auto;color:#c6d2dd;font-family:system-ui,sans-serif;font-size:clamp(13px,1.8vw,20px);line-height:1.45}.s1{animation-delay:0s}.s2{animation-delay:calc(var(--d)*-.80)}.s3{animation-delay:calc(var(--d)*-.60)}.s4{animation-delay:calc(var(--d)*-.38)}.s5{animation-delay:calc(var(--d)*-.18)}button{position:fixed;z-index:20;top:14px;border:1px solid #fff;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font:900 8px/1 ui-monospace;padding:12px;text-transform:uppercase}.skip{right:14px}.sound{left:14px;border-color:var(--a)}.progress{position:fixed;z-index:20;left:0;right:0;bottom:0;height:3px;background:#ffffff20}.progress i{display:block;height:100%;background:linear-gradient(90deg,var(--a),var(--g));transform-origin:left;animation:progress var(--d) linear infinite}body[data-quality=good] .sun{opacity:.16}body[data-quality=good] .grid{opacity:.25}body[data-quality=better] .scene{transform:skewY(-1deg)}body[data-quality=best] h1,body[data-quality=best] h2{mix-blend-mode:screen}body[data-style=vhs] main:before{animation:vhs .18s steps(2) infinite}body[data-style=synthwave] .sun{opacity:.62}@keyframes scene{0%,17%{opacity:0;transform:scale(.94)}3%,14%{opacity:1;transform:scale(1)}16%{opacity:0;transform:scale(1.03)}100%{opacity:0}}@keyframes drive{to{background-position:10% 0,0 10%}}@keyframes progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes vhs{50%{transform:translateX(1px)}}@media(prefers-reduced-motion:reduce){.scene{display:none;animation:none}.s5{display:grid;opacity:1}.grid,.progress i,main:before{animation:none}}
    </style></head><body data-quality="${escapeHtml(data.quality)}" data-style="${escapeHtml(data.experience.style)}"><main><div class="grid"></div><div class="sun"></div>${scenes}<button class="sound" type="button">${escapeHtml(copy.sound)} · off</button><button class="skip" type="button">${escapeHtml(copy.skip)} · Esc</button><div class="progress"><i></i></div></main><script>document.querySelector('.skip').onclick=()=>document.querySelector('main').animate([{filter:'brightness(1)'},{filter:'brightness(1.8)'},{filter:'brightness(1)'}],{duration:400});document.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Enter')document.querySelector('.skip').click()});document.querySelector('.sound').onclick=e=>{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;e.currentTarget.textContent='${escapeHtml(copy.sound)} · on';const c=new A();[110,165,220,440].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.type=i===3?'sine':'square';g.gain.value=.025;o.connect(g).connect(c.destination);o.start(c.currentTime+i*.11);o.stop(c.currentTime+i*.11+.09)})};<\/script></body></html>`;
  }

  let timer;
  form.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(preview, 180);
  });
  form.addEventListener('change', preview);
  document.getElementById('restartPreview').addEventListener('click', preview);
  document.querySelectorAll('[data-device]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-device]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    frame.className = 'ps-preview-frame ' + (button.dataset.device === 'desktop' ? '' : button.dataset.device);
  }));
  document.getElementById('displayName').addEventListener('input', event => {
    const slug = document.getElementById('slug');
    if (!slug.dataset.touched) slug.value = slugify(event.target.value);
  });
  document.getElementById('slug').addEventListener('input', event => { event.target.dataset.touched = '1'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.className = 'ps-status';
    status.textContent = 'Guardando secuencia y storyboard…';
    const button = document.getElementById('createPresite');
    button.disabled = true;
    try {
      let response = await fetch('/presites/api/sites', {
        method: 'PUT',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(payload())
      });
      let data = await response.json();
      if (response.status === 409 && data.exists && confirm('Este Presite ya existe. ¿Quieres crear una nueva versión?')) {
        response = await fetch('/presites/api/sites', {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({...payload(), overwrite: true})
        });
        data = await response.json();
      }
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar');
      status.className = 'ps-status ok';
      status.textContent = 'Secuencia guardada. Abriendo el storyboard…';
      location.href = data.studioUrl;
    } catch (error) {
      status.className = 'ps-status error';
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  preview();
})();
