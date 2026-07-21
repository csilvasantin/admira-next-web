import {DEFAULT_BEFORE_DECK,DEFAULT_BEFORE_LENGTH,DEFAULT_BEFORE_QUALITY,listDeckPacks} from '../_deck-library.js';

export async function onRequestGet(){
  return new Response(JSON.stringify({decks:listDeckPacks(),defaultBefore:DEFAULT_BEFORE_DECK,defaultBeforeLength:DEFAULT_BEFORE_LENGTH,defaultBeforeQuality:DEFAULT_BEFORE_QUALITY}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
