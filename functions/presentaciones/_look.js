import { normalizePresentationStyle, themeFromPresentationStyle } from './_mood.js';

export const PRESENTATION_LOOKS = [
  {key:'classic',tier:'Good',label:'Classic'},
  {key:'admira',tier:'Better',label:'Admira'},
  {key:'movie',tier:'Best',label:'Película'}
];

export function presentationLookState(config = {}){
  const selected=normalizePresentationStyle(config.presentationStyle,config.mood?'movie':'classic');
  const themes={
    classic:themeFromPresentationStyle('classic',null),
    admira:themeFromPresentationStyle('admira',null),
    movie:themeFromPresentationStyle('movie',config.mood||null)
  };
  if(config.theme&&typeof config.theme==='object') themes[selected]={...themes[selected],...config.theme};
  const moodKey=['ghostbusters','back-to-the-future','alien'].includes(config.mood?.key)?config.mood.key:'custom';
  return {selected,moodKey,themes,looks:PRESENTATION_LOOKS};
}
