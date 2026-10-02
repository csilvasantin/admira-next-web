export function countryCode(value, centres) {
  const key = String(value || '').trim();
  if (centres[key.toUpperCase()]) return key.toUpperCase();
  return Object.keys(centres).find(code => centres[code].aliases?.some(name => name.toLowerCase() === key.toLowerCase())) || null;
}

export function globeLocations(snapshot, centres) {
  const groups = new Map(), seen = new Set();
  let unknown = 0;
  const live = snapshot.mode === 'live';
  const rows = live ? snapshot.visitors || [] : snapshot.geography || [];
  for (const row of rows) {
    if (live) {
      const session = row.host + ':' + row.visitor;
      if (seen.has(session)) continue;
      seen.add(session);
    }
    const visits = live ? 1 : Number(row.visits || 0);
    if (!Number.isFinite(visits) || visits <= 0) continue;
    const code = countryCode(row.country, centres);
    if (!code) { unknown += visits; continue; }
    const located=live && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Math.abs(row.latitude)<=90 && Math.abs(row.longitude)<=180;
    const key=located?`${code}:${row.latitude},${row.longitude}`:code;
    const item = groups.get(key) || {code,key,...centres[code],...(located?{lat:row.latitude,lng:row.longitude,city:row.city || '',region:row.region || '',geoSource:'Cloudflare IP'}:{geoSource:'País'}),visits:0,pages:[],pageviews:0};
    item.visits += visits;
    item.pageviews += live ? 1 : Number(row.pageviews || 0);
    if (live && !item.pages.includes(row.host + row.path)) item.pages.push(row.host + row.path);
    groups.set(key,item);
  }
  return {locations:[...groups.values()].sort((a,b)=>b.visits-a.visits || a.code.localeCompare(b.code)),unknown};
}

// A common linear scale within the selected period: twice the traffic adds twice the height.
export function rayHeight(visits, maximum, radius) {
  return radius * .7 * Math.max(0,Math.min(1,visits / Math.max(1,maximum)));
}

export function closestAngle(current,target) {
  return current + ((target-current+540)%360)-180;
}
