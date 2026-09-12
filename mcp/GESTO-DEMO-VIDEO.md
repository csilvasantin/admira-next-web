# Gesto · Demo completa como vídeo embebido (FLT-100316)

Fecha: 2026-09-12 · Carlos DM · sala sin abrir la plataforma

## Norma
Si la demo es parte del entregable (Tour DOOH, player, flujo en admira.app…), **grábala** y métela en la presentación como MP4. BEST muestra motion; el consejero **no** abre admira.app en la reunión.

## Pasos (consejero / box)
1. **Grabar** la demo en vivo:
   - OBS / QuickTime / Windows Game Bar, o
   - Box: `ffmpeg -f x11grab -video_size 1920x1080 -i :0.0 -c:v libx264 -pix_fmt yuv420p demo.mp4`
2. **Subir / hostear** el MP4:
   - Flota pública: `https://www.admira.live/assets/<ruta>/<clip>.mp4`
   - Privado del cliente: `/presentaciones/<slug>/media/<clip>.mp4`
3. **MCP** (`https://www.admiranext.com/mcp`):
   ```json
   {
     "name": "create_yokup_report",
     "arguments": {
       "mision": "FLT-100316",
       "titulo": "Demo Tour DOOH embebida",
       "resumen": "Captura en lámina closing; sala sin plataforma.",
       "cliente": "alcampo-viaje-dooh",
       "videoUrl": "https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4",
       "videoSlide": "closing",
       "demoVideo": true,
       "qualityHint": "best"
     }
   }
   ```
   - `create_presentation` acepta los mismos campos `videoUrl` / `videoSlide` / `demoVideo` / `requireExampleVideo`.
   - Con `demoVideo:true` o `requireExampleVideo:true` **sin** `videoUrl` → error (no placeholder).
4. Abrir sala `…/presentacion?quality=best&lang=es` — comprobar que la lámina reproduce el MP4.

## Generador (UI)
Campo **URL vídeo demo (captura)** → `videoUrl`. Checkbox «Incluir ejemplo vídeo» sigue usando flota si el entregable es Vídeo.

## Stand-in de flota (smoke)
`https://www.admira.live/assets/mouth-v2/boca-v2-ciclo.mp4`

## Help
`help` con `tema: demo` · página `/mcp/generador` §4c.
