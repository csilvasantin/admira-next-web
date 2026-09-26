# Cápsulas en pantalla · 9:16 + 16:9, portada, lomo y revista

Compositor local de las cápsulas de conocimiento (#4398 · FLT-101049, nota #4406).
Parte de la muestra que Carlos aprobó (Jobs, `/workspace/capsulas/muestra/`, 26-sep-2026).

**Norma de Carlos (26-sep-2026):** toda cápsula de conocimiento, literaria o de vídeo, sale
**siempre en horizontal 16:9 y en vertical 9:16**, porque la pantalla del Xpacio puede estar
instalada de las dos formas. Esto lo cumple para *cualquier* cápsula del Stock, no solo las de Blinkist.

## Cómo encaja con el generador que ya existe

```
publicar cápsula (type:capsula) ─► pixer-worker ─► capsule-tiktok (_capsule-brief) ─► grok-video
                                                                    │ clip 15 s 9:16 con voz, sin texto
                                                                    ▼
                                            Stock: vídeo auto-… (el «bruto»)
                                                                    │
            tools/capsulas/capsula.sh  ◄────── pendientes.py (índice del Stock)
              guion.py  → guion.json (libro, autor, tema, locución, 3-5 ideas, QR)
              voz.py    → voz.wav + palabras.json (voz del clip sin «Para carbono», o Piper si no hay clip)
              render.py → capsula-9x16.mp4 y capsula-16x9.mp4
              covers.py → portada.png, lomo.png, revista.png
              publicar.py → Stock: 2 vídeos enlazados a la cápsula (vertical + horizontal)
```

Cloudflare no puede componer vídeo (ni ffmpeg ni fuentes), así que la composición corre en
una máquina de la flota, igual que `tools/notebooklm-local`. **No gasta en xAI:** reutiliza el
clip que el motor ya generó; si una cápsula no tiene clip (Sapiens, Skunk Works), el fondo es el
motivo del tema animado y la voz se sintetiza en local con Piper (voz libre `es_ES-davefx-medium`).

## Qué sale

| Pieza | Tamaño | Notas |
|---|---|---|
| `capsula-9x16.mp4` | 1080×1920, 24 fps, H.264 + AAC | título y autor · subtítulos grandes sincronizados (palabra dicha en el color del tema) · 3-5 ideas en escenas · cierre AdmiraNeXT con QR |
| `capsula-16x9.mp4` | 1920×1080 | mismo guion. Laterales **no oscuros**: el propio clip ampliado, difuminado y teñido del color del tema; clip vertical en panel a la derecha; columna de texto a la izquierda con cuerpos para tele a varios metros (subtítulos 80 px, títulos > 100 px) |
| `portada.png` | 1200×1800 (2:3) | tipográfica, sin la portada de Blinkist |
| `lomo.png` | 180×1800 | mismo alto que la portada, texto de arriba abajo |
| `revista.png` | 1200×1600 | portada de revista con un fotograma del clip y las 3 ideas |

Color y motivo por tema (etiquetas de la cápsula, como en `_capsule-brief.mjs`):
negocio = petróleo y oro con arcos · tecnología = azul noche y cian con retícula · creatividad = ciruela y coral con círculos.

## Uso

```bash
# una cápsula (ensayo: no publica)
bash tools/capsulas/capsula.sh 1790336817010-dieu0q ~/capsulas/jobs-co-intelligence
# retocar a mano guion.json (titulares de las ideas, título en español) y volver a lanzar:
# el guion y la voz no se rehacen si ya existen; los vídeos y las portadas sí.
# publicar las dos versiones en el Stock
bash tools/capsulas/capsula.sh 1790336817010-dieu0q ~/capsulas/jobs-co-intelligence --publicar
# todas las cápsulas a las que les falta alguna versión
bash tools/capsulas/capsula.sh --pendientes --publicar
```

Automático para toda cápsula nueva: un cron en la máquina que componga, cada 15 min
`bash tools/capsulas/capsula.sh --pendientes --publicar` (instalado en GrokBotBox con
`instalar-cron.sh`). Una cápsula sin clip de Grok se espera 30 min (el motor tarda unos minutos
en dejarlo); pasado ese margen se compone igual con el fondo del tema y voz local. Un candado
evita que dos vueltas se pisen.

Instalación (una vez por máquina):

```bash
python3 -m pip install pillow numpy segno            # render y portadas
python3 -m venv ~/.venvs/capsulas && ~/.venvs/capsulas/bin/pip install faster-whisper piper-tts
mkdir -p ~/.local/share/piper && cd ~/.local/share/piper && for f in es_ES-davefx-medium.onnx es_ES-davefx-medium.onnx.json; do
  curl -fsSLO "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/$f"; done
```

Fuentes: DM Serif Display, Cormorant SC y Source Sans Pro (`CAPSULAS_FUENTES`, por defecto las de la caja Linux).
Variables: `CAPSULAS_PY`, `CAPSULAS_PY_VOZ`, `CAPSULAS_DIR`, `CAPSULAS_WHISPER` (modelo, `small`), `CAPSULAS_PIPER_VOZ`.

## Contrato con el Stock y con el visor de Xpaces

`publicar.py` publica cada versión como `type: video` con:

- `externalRef: "capsula:<id de la cápsula>"` y el **mismo título** que la cápsula → así la
  encuentra `mediaFor()` de `pixeria/assets/xpaces/capsulas.mjs`;
- etiquetas `[tema, "capsula", "vertical" | "horizontal"]` → `orientation()` y `pickVideo()`
  eligen vertical en un móvil en vertical y horizontal en el resto (commit 7e5f70f de pixeria).
- `quality: "best"`; el QR del cierre apunta al texto público de la cápsula (`/stock/asset/<id>`).

## Cómo enganchar lomos y portadas en el motor de Pixeria (para Walt y Trinity)

No se ha tocado el motor (`pixeria/assets/xpaces/engine/life-scene.mjs`). Hoy `shelf()` pinta
los libros como cajas de color y `case 'magazines'` las revistas como cajas de 0,29 × 0,36 m.
Para texturizarlos con estas piezas:

1. Subir `portada.png`, `lomo.png` y `revista.png` al Stock (o a R2) y exponer sus URLs junto a la cápsula.
2. En `shelf()`, cargar `lomo.png` con `T.TextureLoader` y aplicarlo a la **cara frontal** del libro
   (la que mira a la sala): lomo 180×1800 = proporción 1:10, así que el libro debe medir ~2,5 cm × 25 cm
   de frente o recortar la textura con `map.repeat`/`map.offset`. La portada va en la cara lateral si
   el libro se pinta de frente o inclinado.
3. En `magazines`, aplicar `revista.png` a la cara delantera de `cover` (la caja 0,29×0,36, que ya lleva
   `rotation.x = -0.2`). La revista es 3:4 y la caja 0,806: `map.repeat.set(1, 0.93)` y `map.offset.y = 0.035`
   la encajan sin deformar.
4. `colorSpace = T.SRGBColorSpace` y liberar las texturas con el mismo `own(…)` del motor para no fugar memoria.
