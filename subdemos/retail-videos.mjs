// Reusable prepared function reels; an edited/captured clip always wins over the common fallback.
const keys = ['biz/proyecto','biz/circuito','biz/gemelo','biz/iot','biz/itil',
  'store/voz','store/musica','store/imagenes','store/video','store/tpv',
  'studio/voz','studio/musica','studio/imagen','studio/video','studio/adaptar'];
const durations={"biz-proyecto":26.0,"biz-circuito":25.0,"biz-gemelo":26.0,"biz-iot":27.0,"biz-itil":26.0,"store-voz":32.0,"store-musica":27.0,"store-imagenes":26.0,"store-video":25.0,"store-tpv":30.0,"studio-voz":30.0,"studio-musica":29.0,"studio-imagen":24.0,"studio-video":26.0,"studio-adaptar":27.0};
export const VIDEOS_RETAIL = Object.fromEntries(keys.map(clave => {
  const stem='https://www.admiranext.com/assets/demos/suite-v1/'+clave.replace('/','-');
  return [clave,{version:1,tipo:'video',url:stem+'.mp4',poster:stem+'.jpg',duracion:durations[clave.replace('/','-')],audio:true,idioma:'es',
    descripcion:'Ensayo preparado de esta función. No realiza altas, generación ni publicación.',fuente:'ensayo-local'}];
}));
export function videoPorDemo(item) {
  return structuredClone(item.video||VIDEOS_RETAIL[item.clave]||null);
}
