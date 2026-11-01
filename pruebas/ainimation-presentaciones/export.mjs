import {FORMAT, validatePresentation} from './contract.mjs';

// Only audience-visible text. Notes, commercial briefs, passwords, media URLs and credentials stay in the generator.
export function exportPresentation(ideas, language='es') {
  if(!['es','ca','en'].includes(language))throw Error('Idioma no compatible.');
  if(!ideas || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(ideas.client||''))throw Error('La presentación no tiene una identidad válida.');
  const content=language==='es'?ideas:ideas.translations?.[language];
  if(!content)throw Error('Esta presentación no tiene una versión guardada en ese idioma.');
  if(!Array.isArray(content.skeleton))throw Error('No se encuentra el guion de la presentación.');
  const slides=[{id:'cover',title:content.hero?.title,message:content.hero?.summary||'',detail:'',chapter:content.hero?.eyebrow||'Presentación'}];
  if(content.objective)slides.push({id:'objective',title:content.labels?.objective||'El objetivo',message:content.objective,detail:'',chapter:'Objetivo'});
  for(const [i,block] of content.skeleton.entries()) {
    if(block.enabled===false)continue;
    slides.push({id:'block-'+i,title:block.title,message:block.message||'',detail:block.detail||'',chapter:block.chapter||String(i+1).padStart(2,'0')});
  }
  slides.push({id:'closing',title:content.closing?.title,message:content.closing?.action||'',detail:'',chapter:content.labels?.next||'Siguiente paso'});
  return validatePresentation({format:FORMAT,version:1,title:content.hero?.title,
    source:{id:ideas.client,language,revision:ideas.updatedAt||''},slides});
}
