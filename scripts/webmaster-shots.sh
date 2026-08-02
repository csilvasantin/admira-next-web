#!/usr/bin/env bash
# ============================================================================
# webmaster-shots.sh — recaptura las miniaturas de /webmaster.
#
# Una tabla de versiones dice QUÉ hay publicado; la miniatura dice si lo que hay
# publicado se ve bien. Un despliegue que rompe la portada no cambia el sello:
# solo se nota mirando.
#
# Chrome headless en local, no un servicio externo: no añade dependencias ni
# saca las URLs del ecosistema a terceros. Cloudflare tiene su Browser Rendering
# API, pero el token de la bóveda no lo cubre (401) — si algún día se amplía,
# esto se puede sustituir por una Function y dejar de ser un paso manual.
#
# Uso:  ./scripts/webmaster-shots.sh            (todas)
#       ./scripts/webmaster-shots.sh yokup      (una)
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "no encuentro Google Chrome"; exit 1; }

DESTINO="webmaster-shots"
mkdir -p "$DESTINO"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# nombre|url[|ms] — el nombre es el que usa webmaster.html para pedir la imagen.
# El tercer campo es la espera antes de disparar: por defecto 8 s, pero los
# sitios que montan un avatar 3D o un canvas pesado necesitan bastante más
# (digitalavatar salía con el «Cargando avatar…» en pantalla).
SITIOS=(
  "admiranext|https://www.admiranext.com"
  "yokup|https://yokup.com"
  "pixeria|https://www.pixeria.com"
  "xpaceos|https://www.xpaceos.com"
  "admira-live|https://www.admira.live"
  "admira-studio|https://www.admira.studio"
  "admira-store|https://www.admira.store"
  "admira-tv|https://admira.tv"
  "clearchannel-tv|https://www.clearchannel.tv"
  "admira-app|https://www.admira.app"
  "digitalavatar|https://digitalavatar.ai|25000"
  "ainimation|https://www.ainimation.studio|15000"
)

FILTRO="${1:-}"
for entrada in "${SITIOS[@]}"; do
  nombre="${entrada%%|*}"; resto="${entrada#*|}"; url="${resto%%|*}"
  ms="8000"; [ "$resto" != "$url" ] && ms="${resto##*|}"
  [ -n "$FILTRO" ] && [ "$FILTRO" != "$nombre" ] && continue

  printf '%-18s ' "$nombre"
  # virtual-time-budget deja que arranquen las animaciones y las fuentes; sin él
  # varias portadas del ecosistema salen a medio pintar.
  # Guardián: Chrome headless puede quedarse esperando para siempre en un sitio
  # que no cierra la conexión, y ahí se planta el lote entero (pasó con
  # admira.store). Se le da 45 s y se le corta.
  "$CHROME" --headless --disable-gpu --hide-scrollbars --no-sandbox \
    --screenshot="$TMP/$nombre.png" --window-size=1280,800 \
    --virtual-time-budget="$ms" "$url" >/dev/null 2>&1 &
  pid=$!
  espera=0
  while kill -0 "$pid" 2>/dev/null && [ "$espera" -lt $(( ms / 1000 + 40 )) ]; do sleep 1; espera=$((espera+1)); done
  if kill -0 "$pid" 2>/dev/null; then kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; echo -n "(cortado) "; fi
  wait "$pid" 2>/dev/null

  if [ ! -s "$TMP/$nombre.png" ]; then echo "✖ sin captura"; continue; fi

  # 640 de ancho: se ve en la ficha y en pantalla de retina sigue nítido al
  # tamaño al que se muestra (320 CSS). JPEG porque son fotos de pantalla.
  sips -Z 640 -s format jpeg -s formatOptions 72 \
       "$TMP/$nombre.png" --out "$DESTINO/$nombre.jpg" >/dev/null 2>&1

  if [ -s "$DESTINO/$nombre.jpg" ]; then
    echo "✔ $(du -h "$DESTINO/$nombre.jpg" | cut -f1)"
  else
    echo "✖ falló la conversión"
  fi
done

echo
echo "Total: $(du -sh "$DESTINO" | cut -f1) en $DESTINO/"
echo "Recuerda desplegar para que se vean: ./deploy.sh"
