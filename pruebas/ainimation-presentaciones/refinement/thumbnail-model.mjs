export const THUMBNAIL_ART = 'builtin:orbita';
export const THUMBNAIL_KEYS = ['title','kicker','image','accent','layout','font','logo','logoStyle'];
const clean = (value,max) => String(value || '').replace(/\s+/g,' ').trim().slice(0,max);
export function safeThumbnailImage(value,client) {
  if(value===THUMBNAIL_ART)return true;
  if(typeof value!=='string'||value.length>500||!/^[a-z0-9][a-z0-9-]{1,62}$/.test(client||''))return false;
  const prefix=`/presentaciones/${client}/images/`;
  const library=`/presentaciones/${client}/media/`;
  if(value.startsWith(library))return /^[a-z0-9][a-z0-9._-]{0,159}\.(?:png|jpe?g|webp)$/i.test(value.slice(library.length));
  return value.startsWith(prefix)&&/^(?:manual-)?slide-[a-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(value.slice(prefix.length));
}
export function validateThumbnail(value,client) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Miniatura no válida.');
  const limits={title:96,kicker:64};
  for(const [key,max] of Object.entries(limits))if(typeof value[key]!=='string'||value[key].length>max||value[key]!==value[key].trim()||/[\r\n]/.test(value[key]))throw Error('Revisa el texto de la miniatura.');
  if(!value.title.trim())throw Error('La miniatura necesita un titular.');
  if(!safeThumbnailImage(value.image,client)||!/^#[0-9a-f]{6}$/i.test(value.accent)||!['impact','editorial'].includes(value.layout))throw Error('Revisa la imagen, el color o la composición de la miniatura.');
  const font=value.font??'system';if(!['system','fira-sans'].includes(font))throw Error('Tipografía de miniatura no compatible.');
  const logo=value.logo??'';if(logo!==''&&(!safeThumbnailImage(logo,client)||logo===THUMBNAIL_ART))throw Error('Logotipo de miniatura no compatible.');
  const logoStyle=value.logoStyle??'original';if(!['original','white'].includes(logoStyle))throw Error('Versión del logotipo no compatible.');
  return Object.fromEntries(THUMBNAIL_KEYS.map(key=>[key,key==='font'?font:key==='logo'?logo:key==='logoStyle'?logoStyle:value[key]]));
}
export function thumbnailMedia(ideas) {
  return (Array.isArray(ideas.thumbnailMedia)?ideas.thumbnailMedia:[])
    .filter(item=>item&&safeThumbnailImage(item.url,ideas.client)&&item.url!==THUMBNAIL_ART)
    .slice(0,4).map(item=>({url:item.url,label:clean(item.label||'Imagen de portada',80)}));
}
export function sourceThumbnail(ideas,language='es') {
  const content=language==='es'?ideas:ideas.translations?.[language],media=thumbnailMedia(ideas);
  const fallback={title:clean(content?.hero?.title||ideas.displayName||'Una nueva propuesta',96),kicker:clean(ideas.displayName||content?.hero?.eyebrow||'Una nueva perspectiva',64),image:media[0]?.url||THUMBNAIL_ART,accent:'#c3ff6b',layout:'impact',font:'system',logo:'',logoStyle:'original'};
  try{return validateThumbnail(ideas.thumbnails?.[language],ideas.client);}catch{return fallback;}
}
export function thumbnailFields(value,media=[]) {
  return [
    {id:'thumbnail-title',label:'Titular de la miniatura',type:'text',maxLength:96},
    {id:'thumbnail-kicker',label:'Marca o antetítulo',type:'text',maxLength:64},
    {id:'thumbnail-image',label:'Imagen de la miniatura',type:'text',maxLength:500},
    {id:'thumbnail-accent',label:'Color de la miniatura',type:'color'},
    {id:'thumbnail-layout',label:'Composición',type:'choice',options:['impact','editorial']},
    {id:'thumbnail-font',label:'Tipografía del titular',type:'choice',options:['system','fira-sans']},
    {id:'thumbnail-logo',label:'Logotipo independiente',type:'text',maxLength:500},
    {id:'thumbnail-logoStyle',label:'Versión del logotipo',type:'choice',options:['original','white']}
  ].map(field=>({...field,path:['components','thumbnail',field.id.slice(10)]}));
}
export function thumbnailAssetMap(input,project) {
  const allowed=new Set([project.document.components?.thumbnail?.image,project.document.components?.thumbnail?.logo,...(project.document.thumbnailMedia||[]).map(item=>item.url)]),result={};
  let total=0;
  for(const [key,value] of Object.entries(input||{})) {
    if(!allowed.has(key)||typeof value!=='string'||!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)||value.length>1500000)continue;
    total+=value.length;if(total>3500000)break;result[key]=value;
  }
  return result;
}
