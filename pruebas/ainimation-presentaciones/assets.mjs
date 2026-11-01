import {safeThumbnailImage,THUMBNAIL_ART} from './refinement/thumbnail-model.mjs';
export function withThumbnailMedia(ideas,imageSet,library=[]) {
  const ready=(imageSet?.slides||[]).filter(slide=>slide.status==='ready'&&safeThumbnailImage(slide.url,ideas.client));
  const cover=ready.find(slide=>slide.sourceId==='cover'||slide.role==='cover'),saved=Object.values(ideas.thumbnails||{}).flatMap(t=>[t?.image,t?.logo]).filter(url=>safeThumbnailImage(url,ideas.client)&&url!==THUMBNAIL_ART);
  const approved=library.filter(item=>item.kind==='image'&&item.acceptedByCarlos===true&&safeThumbnailImage(item.url,ideas.client));
  const urls=[...new Set([...saved,...(cover?[cover.url]:[]),...approved.map(item=>item.url)])].slice(0,4);
  return {...ideas,thumbnailMedia:urls.map((url,index)=>({url,label:approved.find(item=>item.url===url)?.name|| (cover?.url===url?'Portada del generador':'Imagen guardada '+(index+1))}))};
}
export async function loadThumbnailAssets(project) {
  const assets={};
  for(const {url} of project.document.thumbnailMedia||[]) {
    if(!safeThumbnailImage(url,project.source.id)||url===THUMBNAIL_ART)continue;
    try{
      const response=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(15000)});
      if(!response.ok||!/^image\/(png|jpeg|webp)(;|$)/i.test(response.headers.get('content-type')||''))continue;
      if(Number(response.headers.get('content-length'))>10000000)continue;
      const blob=await response.blob();if(blob.size>10000000)continue;
      const image=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=Math.round(1280*image.height/image.width);
      if(canvas.height>2560){image.close();continue;}
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();
      const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let transparent=false;for(let i=3;i<rgba.length;i+=4)if(rgba[i]<255){transparent=true;break;}
      const data=canvas.toDataURL(transparent?'image/png':'image/jpeg',.85);if(data.length<=1500000)assets[url]=data;
    }catch{/* A missing asset is visible in the editor and never replaced on save. */}
  }
  return assets;
}
