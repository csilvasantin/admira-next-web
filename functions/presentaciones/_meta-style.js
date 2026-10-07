// La biblioteca corporativa, la propuesta y sus anexos comparten el mismo lienzo.
const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function withMetaStyle(html, name) {
  const pattern=/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>|<\/?section\b[^>]*>/gi;
  const stack=[],insertions=[];let count=0;
  for(const match of html.matchAll(pattern)){
    const tag=match[0];if(/^<(?:script|style)\b/i.test(tag))continue;
    if(/^<\/section/i.test(tag)){
      const slide=stack.pop();if(slide)insertions.push({position:match.index,...slide});
    } else stack.push(/\bclass="[^"]*\bslide\b/.test(tag)?{index:++count,illustration:/\bdeck-slide\b/.test(tag)}:null);
  }
  for(const {position,index,illustration} of insertions.reverse()){
    const footer=`<footer class="meta-footer"><span>Admira × ${esc(name)}${illustration?' · Ilustración':''}</span><span>${String(index).padStart(2,'0')} / ${count}</span></footer>`;
    html=html.slice(0,position)+footer+html.slice(position);
  }
  return html.replace('</head>','<link rel="stylesheet" href="/assets/presentation-meta-style.css?v=20261007-1"></head>');
}
