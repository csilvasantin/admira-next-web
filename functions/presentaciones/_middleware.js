/*
 * Puerta privada y auditoría de /presentaciones/*.
 * Cada cliente conserva su contraseña aislada. Una identidad firmada (nombre + correo)
 * permite saber quién entra, cuándo lo hace y qué recursos utiliza, sin guardar claves.
 */

import {cleanIdentity, identityCookie, makeIdentityToken, readCookies, readIdentity, writeAccessEvent} from './_access.js';

const MAXAGE = 60 * 60 * 24 * 30;
const TRUSTED_GENERATOR_EMAILS = new Set(['csilva@admira.com', 'csilvasantin@gmail.com']);
const GOOGLE_CLIENT_ID = '861856772040-e1ri6kpu6maagtb6crdfbb923hsaalgb.apps.googleusercontent.com';
const enc = new TextEncoder();

function b64url(buf){
  let value = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(key, message){
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message)));
}
function ctEq(a, b){
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}
async function makeToken(signKey, slug, exp){ return `${exp}.${await hmac(signKey, `${slug}:${exp}`)}`; }
async function validToken(signKey, slug, token){
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const exp = parseInt(token.slice(0, dot), 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  return ctEq(token.slice(dot + 1), await hmac(signKey, `${slug}:${exp}`));
}
function esc(value){ return String(value == null ? '' : value).replace(/[<>&"]/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[char])); }

const formStyles = `
  :root{--bg:#070a10;--panel:#0d1522;--line:#1e2940;--ink:#e8eef8;--dim:#7186a8;--brand:#3df08a}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;padding:24px}
  body::before{content:"";position:fixed;inset:0;background:radial-gradient(90% 60% at 80% -10%,rgba(61,240,138,.08),transparent 60%);pointer-events:none}
  .box{position:relative;width:100%;max-width:430px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:34px 30px;box-shadow:0 24px 60px rgba(0,0,0,.5)}
  .eyebrow{font:700 11px/1 ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--brand);display:flex;align-items:center;gap:9px;margin-bottom:20px}.eyebrow svg{width:14px;height:14px}
  h1{font-size:26px;font-weight:800;letter-spacing:-.01em;margin:0 0 6px}.sub{color:var(--dim);font-size:14px;margin:0 0 24px;line-height:1.5}
  label{display:block;font:700 11px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:14px 0 8px}
  input{width:100%;background:#0a1220;color:var(--ink);border:1px solid var(--line);border-radius:11px;padding:13px 14px;font-size:16px;outline:none;transition:border-color .15s,box-shadow .15s}input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(61,240,138,.16)}
  button{width:100%;margin-top:18px;appearance:none;border:0;border-radius:11px;padding:13px;cursor:pointer;background:var(--brand);color:#052013;font:800 14px/1 -apple-system,system-ui,sans-serif;letter-spacing:.01em}button:hover{filter:brightness(1.08)}
  .or{display:flex;align-items:center;gap:12px;margin:20px 0 4px;color:var(--dim);font:700 10px/1 ui-monospace,monospace;letter-spacing:.12em}.or::before,.or::after{content:"";height:1px;flex:1;background:var(--line)}
  .google-picker{display:flex;justify-content:center;min-height:44px;margin-top:14px}.google-picker>div{max-width:100%}
  .secondary{display:block;margin-top:14px;color:#a8bad4;text-align:center;font:700 12px/1.4 ui-monospace,monospace;text-underline-offset:3px}.secondary:hover{color:var(--brand)}
  .back{display:inline-block;margin-bottom:18px;color:#a8bad4;font:700 12px/1 ui-monospace,monospace;text-decoration:none}.back:hover{color:var(--brand)}
  .notice{margin-top:15px;padding:11px 12px;border:1px solid var(--line);border-radius:10px;color:#9db0cc;font:600 11px/1.45 ui-monospace,monospace}.ok{margin-top:14px;padding:12px;border:1px solid rgba(61,240,138,.35);border-radius:10px;color:var(--brand);font:600 13px/1.5 ui-monospace,monospace}.err{margin-top:14px;color:#ff6b6b;font:600 13px/1.4 ui-monospace,monospace;text-align:center}.foot{margin-top:20px;text-align:center;font:600 11px/1 ui-monospace,monospace;letter-spacing:.04em;color:var(--dim)}
`;

function shell(title, body){
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} · Acceso</title><style>${formStyles}</style></head><body>${body}</body></html>`;
}

function identityFields(values = {}){
  return `<label for="name">Nombre y apellidos</label><input id="name" name="name" value="${esc(values.name)}" required minlength="2" maxlength="100" autocomplete="name"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" value="${esc(values.email)}" required maxlength="180" autocomplete="username" autocapitalize="none" spellcheck="false">`;
}

function loginPage(title, action, error = '', values = {}){
  const recovery = `${action}${action.includes('?') ? '&' : '?'}recuperar=1`;
  const google = `<div class="or">O ELIGE TU CUENTA</div><form id="google-access" method="POST" action="${esc(action)}"><input type="hidden" name="intent" value="google"><input id="google-credential" type="hidden" name="credential"><div id="g_id_onload" data-client_id="${GOOGLE_CLIENT_ID}" data-callback="admiraGoogleAccess" data-auto_prompt="false"></div><div class="google-picker"><div class="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="outline" data-text="continue_with" data-size="large" data-logo_alignment="left" data-width="320"></div></div></form><script>function admiraGoogleAccess(response){var input=document.getElementById('google-credential');if(!input||!response||!response.credential)return;input.value=response.credential;document.getElementById('google-access').submit()}</script><script src="https://accounts.google.com/gsi/client" async defer></script>`;
  return shell(title, `<div class="box"><form method="POST" action="${esc(action)}" autocomplete="on"><div class="eyebrow"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.9L21.5 9l-5.6 4.3 2.1 7-6-4.3-6 4.3 2.1-7L2.5 9l7.1-.1z"/></svg>ADmiraNeXT · Presentación</div><h1>${esc(title)}</h1><p class="sub">Contenido privado. Identifícate e introduce la contraseña facilitada por nuestro equipo.</p>${identityFields(values)}<label for="password">Contraseña</label><input id="password" name="password" type="password" required autocomplete="current-password"><button type="submit">Entrar</button><a class="secondary" href="${esc(recovery)}">¿Has olvidado la contraseña?</a></form>${google}<div class="notice">Puedes usar una contraseña guardada en Google Password Manager o en el gestor de tu navegador.</div><div class="notice">Por seguridad, registramos identidad, fecha, presentación, IP y acciones sobre los materiales.</div>${error ? `<div class="err">${esc(error)}</div>` : ''}<div class="foot">admiranext.com</div></div>`);
}

async function verifyGoogleCredential(credential){
  if (!credential || credential.length > 6000) return null;
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const email = String(payload.email || '').trim().toLowerCase();
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    const validExpiry = Number(payload.exp) > Math.floor(Date.now() / 1000);
    if (payload.aud !== GOOGLE_CLIENT_ID || !verified || !validExpiry || !TRUSTED_GENERATOR_EMAILS.has(email)) return null;
    return cleanIdentity({name:payload.name || email.split('@')[0], email});
  } catch (_) { return null; }
}

function recoveryPage(title, action, state = '', values = {}){
  const login = new URL(action, 'https://admiranext.com'); login.searchParams.delete('recuperar');
  const message = state === 'sent' ? '<div class="ok" role="status">Solicitud recibida. Si los datos corresponden a un acceso autorizado, el equipo de Admira te enviará nuevas instrucciones. Revisa también la carpeta de correo no deseado.</div>' : '';
  const error = state === 'invalid' ? '<div class="err">Indica un nombre y un correo válidos.</div>' : '';
  return shell(`Recuperar acceso · ${title}`, `<form class="box" method="POST" action="${esc(action)}"><input type="hidden" name="intent" value="recover"><a class="back" href="${esc(login.pathname + login.search)}">← Volver al acceso</a><div class="eyebrow">ADmiraNeXT · Recuperación segura</div><h1>Recuperar contraseña</h1><p class="sub">Solicita nuevas instrucciones de acceso para ${esc(title)}. Por seguridad nunca mostraremos ni enviaremos la contraseña actual.</p>${identityFields(values)}<button type="submit">Solicitar recuperación</button>${message}${error}<div class="notice">La solicitud queda registrada para que el equipo valide tu identidad. La respuesta es siempre la misma para no revelar qué correos están autorizados.</div><div class="foot">admiranext.com</div></form>`);
}

async function requestRecovery(env, request, details){
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const rateKey = `access:recovery-rate:${ip}:${bucket}`;
  if (env.PRESENTATION_IDEAS && await env.PRESENTATION_IDEAS.get(rateKey)) return false;
  if (env.PRESENTATION_IDEAS) await env.PRESENTATION_IDEAS.put(rateKey, '1', {expirationTtl:600});
  const payload = new FormData();
  payload.set('name', details.identity.name);
  payload.set('email', details.identity.email);
  payload.set('_subject', `Recuperación de acceso · ${details.presentation}`);
  payload.set('Presentación', details.presentation);
  payload.set('Ruta', details.path);
  payload.set('Fecha', new Date().toISOString());
  payload.set('IP', ip);
  payload.set('_template', 'table');
  payload.set('_captcha', 'false');
  try {
    const response = await fetch('https://formsubmit.co/ajax/info@admira.com', {method:'POST', body:payload, headers:{Accept:'application/json'}});
    return response.ok;
  } catch (_) { return false; }
}

function identifyPage(title, action, error = '', values = {}){
  return shell(title, `<form class="box" method="POST" action="${esc(action)}"><input type="hidden" name="intent" value="identify"><div class="eyebrow">ADmiraNeXT · Control de acceso</div><h1>Confirma tu identidad</h1><p class="sub">Tu sesión ya está autorizada. Solo necesitamos identificarla una vez para el registro de actividad de ${esc(title)}.</p>${identityFields(values)}<button type="submit">Continuar</button><div class="notice">El acceso y el uso de los materiales quedan registrados durante 180 días.</div>${error ? `<div class="err">${esc(error)}</div>` : ''}</form>`);
}

function htmlResponse(body, status = 401){
  return new Response(body, {status, headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}

function shouldIdentify(request, parts){
  if (request.method !== 'GET') return false;
  if (!(request.headers.get('Accept') || '').includes('text/html')) return false;
  const last = parts[parts.length - 1] || '';
  return !/\.(?:css|js|json|png|jpe?g|gif|webp|svg|ico|mp4|m4a|mp3|pdf|pptx|txt|csv|woff2?)$/i.test(last);
}

async function injectTelemetry(response, inlineEditor = false){
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('text/html')) return response;
  const text = await response.text();
  const editor = inlineEditor ? '<script>window.__ADMIRA_CAN_EDIT__=true</script><script src="/assets/presentation-inline-editor.js?v=20260721-6"></script>' : '';
  const telemetry = text.includes('presentation-telemetry.js') ? '' : '<script src="/assets/presentation-telemetry.js?v=20260717-1"></script>';
  const html = text.replace(/<\/body>/i, `${editor}${telemetry}</body>`);
  const headers = new Headers(response.headers); headers.delete('content-length'); headers.set('cache-control', 'no-store');
  return new Response(html, {status:response.status, statusText:response.statusText, headers});
}

export async function onRequest(context){
  const {request, env, next} = context;
  const url = new URL(request.url);
  const rel = url.pathname.replace(/^\/presentaciones\/?/i, '').replace(/^\/+|\/+$/g, '');
  const parts = rel ? rel.split('/').filter(Boolean) : [];
  const first = (parts[0] || '').replace(/\.html$/i, '').toLowerCase();
  const isGallery = parts.length === 0 || (parts.length === 1 && first === 'index');
  const seg = isGallery ? '' : first;

  if (request.method === 'GET' && parts[1] === 'Ideas') {
    const canonical = new URL(request.url); canonical.pathname = canonical.pathname.replace(/\/Ideas\/?$/, '/ideas');
    return Response.redirect(canonical.toString(), 308);
  }

  const second = (parts[1] || '').replace(/\.html$/i, '').toLowerCase();
  const third = (parts[2] || '').replace(/\.html$/i, '').toLowerCase();
  const isIdeasEditor = !isGallery && second === 'ideas';
  const isIdeasApi = !isGallery && second === 'api' && third === 'ideas';
  const isGenerationApi = !isGallery && second === 'api' && third === 'generation';
  const isCompatibilityApi = !isGallery && second === 'api' && third === 'compatibility';
  const isRoomDeviceLabApi = !isGallery && second === 'api' && third === 'room-device-lab';
  const isInlineEditApi = !isGallery && second === 'api' && third === 'inline-edit';
  const isVersionsApi = !isGallery && second === 'api' && third === 'versions';
  const isVersionsPage = !isGallery && second === 'versiones';
  const isSlideImages = !isGallery && second === 'images';
  const isDeckAssets = !isGallery && second === 'deck';
  const isBrandAssets = !isGallery && second === 'brand';
  const isPresentationMode = !isGallery && second === 'presentacion';
  const isIdeasWrite = isIdeasApi && request.method !== 'GET';
  const isGeneratorPage = first === 'generador' && parts.length === 1;
  const isPublicSourceBriefApi = first === 'api' && second === 'source-brief';
  const isGeneratorApi = first === 'api' && ['generate','inspiration','images','decks','media-library','grok-video','ad-idea','video-reference','video-package'].includes(second);
  const isProductionApi = first === 'api' && second === 'production';
  const isCapsuleApi = first === 'api' && second === 'capsule-tiktok';
  const isClientsApi = first === 'api' && second === 'clients';
  const isControlArea = first === 'control';
  const isRemoteApi = !isGallery && second === 'api' && third === 'remote';
  const isInternalArea = isIdeasEditor || isIdeasWrite || isGenerationApi || isCompatibilityApi || isRoomDeviceLabApi || isInlineEditApi || isVersionsApi || isVersionsPage || isGeneratorPage || isGeneratorApi || isClientsApi || isControlArea;

  // El productor local se autentica con un Bearer token propio. No debe atravesar
  // el formulario/cookie de las áreas humanas antes de llegar a su endpoint.
  if (isProductionApi) return next();
  // Igual la puerta de cápsulas: la llama el worker del Stock cuando se publica
  // una cápsula, no un navegador, y verifica el secreto de ingesta ella misma. Sin
  // esto recibía la página de login en vez de la petición — y en silencio, porque
  // un 200 con HTML no parece un error desde el otro lado.
  if (isCapsuleApi) return next();
  // Leer una URL y preparar un brief no inicia ninguna generación de pago ni
  // concede acceso a la presentación. El endpoint devuelve únicamente una
  // proyección acotada (título, resumen y bloques visibles), por lo que puede
  // usarse desde Pixeria sin obligar al visitante a entrar en el Generador.
  if (isPublicSourceBriefApi) return next();
  // La creación de sesión atraviesa la puerta humana normal. El emparejamiento
  // y el polling posterior usan secretos efímeros verificados por sus endpoints.
  if (isRemoteApi && parts.length > 4) return next();

  const cookieName = `pres_${isGallery ? 'admin' : seg}`;
  const cookieSlug = isGallery ? '_admin' : seg;
  const secretName = isGallery ? 'PRES_ADMIN' : `PRES_${seg.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
  const names = {lacaixa:'La Caixa', clearchannel:'Clear Channel', lenovo:'Lenovo', caixa:'La Caixa', control:'Control de presentaciones'};
  const signKey = env.PRES_SIGNING_KEY;
  const expected = env[secretName];
  const master = env.PRES_ADMIN;
  const editor = env.PRES_EDITOR;
  // Acceso común para las presentaciones públicas. Nunca concede privilegios de
  // edición, generación o control: esas zonas siguen exigiendo master/editor.
  const generic = env.PRES_GENERIC;
  const cleanPath = `${url.pathname}${url.search}`;
  const recoveryRequested = url.searchParams.get('recuperar') === '1';
  const accessEmail = String(request.headers.get('Cf-Access-Authenticated-User-Email') || '').trim().toLowerCase();
  const accessAssertion = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const trustedGeneratorIdentity = request.method === 'GET'
    && isGeneratorPage
    && url.hostname.toLowerCase() === 'www.admiranext.com'
    && Boolean(accessAssertion)
    && TRUSTED_GENERATOR_EMAILS.has(accessEmail);

  let generated = null;
  if (!isGallery && env.PRESENTATION_IDEAS && !isGeneratorApi && !isGeneratorPage && !isControlArea) generated = await env.PRESENTATION_IDEAS.get(`presentation:${seg}`, {type:'json'});
  const dynamicVerifier = generated?.passwordVerifier || '';
  const clientTitle = generated?.displayName || names[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
  const title = isGallery ? 'Presentaciones' : (isGeneratorPage || isGeneratorApi || isClientsApi ? 'Generador de presentaciones' : (isIdeasEditor || isIdeasApi || isGenerationApi || isCompatibilityApi || isRoomDeviceLabApi ? `${clientTitle} · Ideas` : clientTitle));

  if (!signKey || (!expected && !dynamicVerifier && !master && !generic)) return htmlResponse(loginPage(title, cleanPath, 'Acceso no disponible por ahora.'), 503);

  const cookies = readCookies(request);
  const [masterValid, editorValid, ownerValid, clientValid, identity] = await Promise.all([
    validToken(signKey, '_master', cookies.pres_master),
    editor ? validToken(signKey, '_editor', cookies.pres_editor) : false,
    validToken(signKey, '_owner', cookies.pres_owner),
    validToken(signKey, cookieSlug, cookies[cookieName]),
    readIdentity(request, signKey)
  ]);
  if (trustedGeneratorIdentity && !ownerValid) {
    const ownerIdentity = cleanIdentity({
      name:accessEmail === 'csilva@admira.com' ? 'Carlos Silva' : 'Carlos Silva Santín',
      email:accessEmail,
      visitorId:identity?.visitorId
    });
    const exp = Math.floor(Date.now() / 1000) + MAXAGE;
    const [ownerToken, identityToken] = await Promise.all([
      makeToken(signKey, '_owner', exp),
      makeIdentityToken(signKey, ownerIdentity, MAXAGE)
    ]);
    const headers = new Headers({Location:cleanPath, 'cache-control':'no-store'});
    headers.append('Set-Cookie', `pres_owner=${ownerToken}; Path=/presentaciones; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Lax`);
    headers.append('Set-Cookie', identityCookie(identityToken, MAXAGE));
    context.waitUntil(writeAccessEvent(env, request, {type:'trusted_owner_login', client:'generador', presentation:title, identity:ownerIdentity, access:'owner', path:url.pathname}));
    return new Response(null, {status:303, headers});
  }
  const editorAllowed = !isControlArea && (isIdeasEditor || isIdeasApi || isGenerationApi || isCompatibilityApi || isRoomDeviceLabApi || isInlineEditApi || isVersionsApi || isVersionsPage || isSlideImages || isDeckAssets || isBrandAssets || isGeneratorPage || isGeneratorApi || isClientsApi || isPresentationMode);
  const ownerAllowed = isGeneratorPage || isGeneratorApi || isClientsApi;
  const authorized = masterValid || (editorAllowed && editorValid) || (ownerAllowed && ownerValid) || (!isInternalArea && clientValid);
  const accessLevel = masterValid ? 'master' : editorValid ? 'editor' : ownerValid ? 'owner' : 'client';
  const contentType = request.headers.get('content-type') || '';
  const isFormPost = request.method === 'POST' && /application\/x-www-form-urlencoded|multipart\/form-data/i.test(contentType);

  if (request.method === 'GET' && recoveryRequested && !authorized) return htmlResponse(recoveryPage(title, cleanPath));

  if (isFormPost && !isGeneratorApi) {
    let form;
    try { form = await request.formData(); } catch (_) { form = new FormData(); }
    const supplied = cleanIdentity({name:form.get('name'), email:form.get('email'), visitorId:identity?.visitorId});
    if (form.get('intent') === 'recover') {
      const values = {name:form.get('name'), email:form.get('email')};
      if (!supplied) return htmlResponse(recoveryPage(title, cleanPath, 'invalid', values));
      context.waitUntil(Promise.all([
        requestRecovery(env, request, {identity:supplied, presentation:title, path:url.pathname}),
        writeAccessEvent(env, request, {type:'password_recovery_requested', client:seg || '_gallery', presentation:title, identity:supplied, access:'recovery', path:url.pathname})
      ]));
      return htmlResponse(recoveryPage(title, cleanPath, 'sent', values), 200);
    }
    if (form.get('intent') === 'google') {
      const googleIdentity = await verifyGoogleCredential(String(form.get('credential') || ''));
      if (!googleIdentity) {
        context.waitUntil(writeAccessEvent(env, request, {type:'google_login_failed', client:seg || '_gallery', presentation:title, access:'denied', path:url.pathname}));
        return htmlResponse(loginPage(title, cleanPath, 'La cuenta de Google no está autorizada.'));
      }
      const exp = Math.floor(Date.now() / 1000) + MAXAGE;
      const [accessToken, identityToken] = await Promise.all([
        makeToken(signKey, '_master', exp),
        makeIdentityToken(signKey, googleIdentity, MAXAGE)
      ]);
      const headers = new Headers({Location:cleanPath, 'cache-control':'no-store'});
      headers.append('Set-Cookie', `pres_master=${accessToken}; Path=/presentaciones; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Lax`);
      headers.append('Set-Cookie', identityCookie(identityToken, MAXAGE));
      context.waitUntil(writeAccessEvent(env, request, {type:'google_master_login', client:seg || '_gallery', presentation:title, identity:googleIdentity, access:'master', path:url.pathname}));
      return new Response(null, {status:303, headers});
    }
    if (form.get('intent') === 'identify') {
      if (!authorized) return htmlResponse(loginPage(title, cleanPath, 'La sesión ha caducado. Vuelve a introducir la contraseña.', supplied || {}));
      if (!supplied) return htmlResponse(identifyPage(title, cleanPath, 'Indica un nombre y un correo válidos.', {name:form.get('name'), email:form.get('email')}));
      const token = await makeIdentityToken(signKey, supplied);
      const headers = new Headers({Location:cleanPath, 'cache-control':'no-store'}); headers.append('Set-Cookie', identityCookie(token));
      context.waitUntil(writeAccessEvent(env, request, {type:'identity_confirmed', client:seg || '_gallery', presentation:title, identity:supplied, access:accessLevel, path:url.pathname}));
      return new Response(null, {status:303, headers});
    }

    const password = String(form.get('password') || '');
    const values = {name:form.get('name'), email:form.get('email')};
    if (!supplied) return htmlResponse(loginPage(title, cleanPath, 'Indica un nombre y un correo válidos.', values));
    let targetName = '', targetSlug = '', granted = '';
    if (master && ctEq(password, master)) { targetName = 'pres_master'; targetSlug = '_master'; granted = 'master'; }
    else if (editorAllowed && editor && ctEq(password, editor)) { targetName = 'pres_editor'; targetSlug = '_editor'; granted = 'editor'; }
    else if (!isInternalArea && generic && ctEq(password, generic)) { targetName = cookieName; targetSlug = cookieSlug; granted = 'client'; }
    else if (!isInternalArea && expected && ctEq(password, expected)) { targetName = cookieName; targetSlug = cookieSlug; granted = 'client'; }
    else if (!isInternalArea && dynamicVerifier && ctEq(await hmac(signKey, `password:${seg}:${password}`), dynamicVerifier)) { targetName = cookieName; targetSlug = cookieSlug; granted = 'client'; }

    if (!granted) {
      context.waitUntil(writeAccessEvent(env, request, {type:'login_failed', client:seg || '_gallery', presentation:title, identity:supplied, access:'denied', path:url.pathname}));
      const message = isInternalArea ? 'Esta zona requiere acceso interno de Admira.' : 'Contraseña incorrecta.';
      return htmlResponse(loginPage(title, cleanPath, message, values));
    }

    const exp = Math.floor(Date.now() / 1000) + MAXAGE;
    const [accessToken, identityToken] = await Promise.all([makeToken(signKey, targetSlug, exp), makeIdentityToken(signKey, supplied)]);
    const headers = new Headers({Location:cleanPath, 'cache-control':'no-store'});
    headers.append('Set-Cookie', `${targetName}=${accessToken}; Path=/; Max-Age=${MAXAGE}; HttpOnly; Secure; SameSite=Lax`);
    headers.append('Set-Cookie', identityCookie(identityToken));
    context.waitUntil(writeAccessEvent(env, request, {type:'login_success', client:seg || '_gallery', presentation:title, identity:supplied, access:granted, path:url.pathname}));
    return new Response(null, {status:303, headers});
  }

  if (!authorized) return htmlResponse(loginPage(title, cleanPath));
  if (shouldIdentify(request, parts) && !identity) return htmlResponse(identifyPage(title, cleanPath));

  const response = await next();
  const trackView = request.method === 'GET' && shouldIdentify(request, parts) && !isInternalArea && !isGallery;
  if (trackView && identity) context.waitUntil(writeAccessEvent(env, request, {type:'page_view', client:seg, presentation:clientTitle, identity, access:accessLevel, path:url.pathname, language:url.searchParams.get('lang') || ''}));
  const isAudienceOutput = isPresentationMode && url.searchParams.get('audience') === '1';
  return injectTelemetry(response, isPresentationMode && !isAudienceOutput && (masterValid || editorValid));
}
