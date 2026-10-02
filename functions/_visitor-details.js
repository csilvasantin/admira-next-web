export function safeReferrer(value) {
  if (!value || typeof value !== 'string' || value.length>2000) return '';
  try {
    const url=new URL(value);
    if(!['https:','http:'].includes(url.protocol) || url.username || url.password)return '';
    // Login callback paths may contain tokens; keep the origin for these routes.
    const path=/\/(?:auth|oauth|callback|reset|recover|recuperar)(?:\/|$)/i.test(url.pathname)?'/':url.pathname;
    return (url.origin+path).slice(0,1000);
  } catch { return ''; }
}
export function visitorDetails(request, body) {
  const ua=request.headers.get('user-agent') || '',cf=request.cf || {};
  const clean=v=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').slice(0,100):'';
  const coordinate=(value,limit)=>value!==null && value!==undefined && value!=='' && Number.isFinite(Number(value)) && Math.abs(Number(value))<=limit?Math.round(Number(value)*1000)/1000:null;
  let device=/ipad|tablet/i.test(ua) || /android/i.test(ua)&&!/mobile/i.test(ua) || body.deviceHint==='tablet'&&/Macintosh/i.test(ua)?'Tableta':/mobile|android|iphone/i.test(ua)?'Móvil':'Ordenador';
  if(/smart-tv|smarttv|hbbtv|tizen|webos|googletv|appletv/i.test(ua))device='TV';
  const browser=/Edg(?:e|A|iOS)?\//i.test(ua)?'Edge':/OPR\/|Opera/i.test(ua)?'Opera':/Firefox\/|FxiOS\//i.test(ua)?'Firefox':/SamsungBrowser\//i.test(ua)?'Samsung Internet':/Chrome\/|CriOS\//i.test(ua)?'Chrome':/Safari\//i.test(ua)?'Safari':'No disponible';
  const os=/iphone|ipad|ipod/i.test(ua) || body.deviceHint==='tablet'&&/Macintosh/i.test(ua)?'iOS / iPadOS':/android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows':/Macintosh|Mac OS X/i.test(ua)?'macOS':/CrOS/i.test(ua)?'ChromeOS':/Linux/i.test(ua)?'Linux':'No disponible';
  const latitude=coordinate(cf.latitude,90),longitude=coordinate(cf.longitude,180);
  return {device,browser,os,city:clean(cf.city),region:clean(cf.region),latitude:longitude===null?null:latitude,longitude:latitude===null?null:longitude,referrer:safeReferrer(body.referrer)};
}
