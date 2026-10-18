# Admirito · playlist por hashtags

`/admirito playlist #musica #1980` (o `/playlist #musica #1980`) junta las piezas de Pixeria y admira.studio que llevan **todos** esos hashtags y las reproduce una detrás de otra en un reproductor flotante. El reproductor va encima de la página y no mueve el contenido. Funciona en el ⌘ Experto de toda la suite: Studio, Store, TV, App y Biz. Lo pidió Carlos el 18-oct-2026.

- **De dónde salen.** Pixeria y admira.studio comparten un solo Stock. Basta leer una vez el índice público `https://stock.admira.store/stock/index.json`, sin sesión ni cookies, con CORS abierto. Se guarda 60 s en memoria de la pestaña.
- **Qué entra.** Vídeo, imagen y audio (música y locuciones) cuyo fichero está en `stock.admira.store`. Quedan fuera los enlaces a YouTube o LinkedIn, los muebles 3D, los gemelos y los guiones. Una pieza o un fichero repetido entra una sola vez.
- **Cómo compara.** Igual que Pixeria (`tagKey` de `pixer-worker/src/stock-catalogo.mjs`): sin tildes, sin «#», sin separadores y con sus sinónimos. Así `#musica`, `#música` y `#music` traen lo mismo, y `#años80` encuentra «años 80».
- **Décadas.** En el Stock no hay ninguna pieza con «1980». Los 80 están escritos como «años 80», «80s», «1980s», «ochentas», «80smusic» o con el año suelto. Por eso un año redondo vale por su década: `#1980`, `#80s`, `#años80` y `#ochentas` son lo mismo. Cualquier otro año (`#1986`) busca solo ese año. El registro avisa cuando aplica una década.
- **Orden y ritmo.** El del índice, que es el de Pixeria: lo más reciente primero. El vídeo y el audio pasan a la siguiente pieza al acabar. La imagen dura 5 s, como en el previo de playlist de Pixeria. Si una pieza no carga, se salta. Un solo botón silencia toda la playlist y se recuerda. Si el navegador no deja sonar sin un clic, sigue en silencio y el botón 🔇 lo dice.
- **Mandos.** ‹ anterior, siguiente ›, 🔊/🔇 y ✕. `/admirito playlist parar` la cierra. Una playlist nueva cierra la anterior.
- **Sin resultados.** Dice cuántas piezas lleva cada hashtag por separado, para ver cuál sobra.
- **Para las aplicaciones.** Al abrirse emite `admira:playlist` con `{hashtags, ids}`. No guarda nada ni envía a pantallas: distribuir una playlist sigue necesitando la sesión de Pixeria o de admira.tv.

Código: `suite/admirito-playlist.mjs`, que `suite/admirito.mjs` carga solo cuando alguien usa el comando. Pruebas: `test/admirito-playlist.test.mjs`.

## English

`/admirito playlist #musica #1980` (or `/playlist #musica #1980`) gathers the Pixeria and admira.studio pieces tagged with **all** those hashtags and plays them one after another in a floating player that does not move the page. It works in every app's ⌘ Expert.

- One public read of `https://stock.admira.store/stock/index.json`, with no session or cookies. Pixeria and Studio share that Stock.
- Only video, image and audio files hosted in the Stock are included, each piece or file once.
- Tags are compared the way Pixeria compares them: accents, «#», separators and synonyms are ignored. A round year means its decade: `#1980` = `#80s` = `#años80` = `#ochentas`. Any other year (`#1986`) is that year only.
- Pieces play in index order (newest first). Video and audio advance when they end; images last 5 s. Pieces that fail to load are skipped. There is one remembered mute, with a silent fallback when autoplay with sound is blocked.
- `/admirito playlist stop` closes the player. With no results, each hashtag's own count is shown.
- The command emits `admira:playlist` with `{hashtags, ids}`. Nothing is saved or sent to screens.
