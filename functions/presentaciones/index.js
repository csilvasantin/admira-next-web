import {onRequestGet as renderGenerator} from './generador.js';

export async function onRequestGet(context){
  return renderGenerator(context);
}
