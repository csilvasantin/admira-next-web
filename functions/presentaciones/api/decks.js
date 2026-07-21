import {DEFAULT_BEFORE_DECK,listDeckPacks} from '../_deck-library.js';

export async function onRequestGet(){
  return new Response(JSON.stringify({decks:listDeckPacks(),defaultBefore:DEFAULT_BEFORE_DECK}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
