#!/usr/bin/env bash
# capsula.sh — de una cápsula del Stock a sus DOS vídeos (9:16 y 16:9) + portada, lomo y revista.
#
#   bash capsula.sh <id-capsula> [carpeta] [--publicar] [--clip auto-xxx|fichero|ninguno]
#   bash capsula.sh --pendientes [--publicar]     # todas las cápsulas sin las dos versiones
#
# Norma de Carlos (26-sep-2026, #4406): toda cápsula de conocimiento, literaria o de vídeo,
# sale SIEMPRE en horizontal 16:9 y en vertical 9:16, porque la pantalla del Xpacio puede
# estar instalada de las dos formas. El clip de Grok (capsule-tiktok) es solo el fondo;
# título, subtítulos, ideas y cierre con QR se componen aquí, en local, sin gastar en xAI.
# Sin --publicar no se toca el Stock (ensayo). Ver README.md.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${CAPSULAS_PY:-python3}"                       # PIL, numpy, segno
PY_VOZ="${CAPSULAS_PY_VOZ:-$HOME/.venvs/capsulas/bin/python}"   # faster-whisper + piper-tts
BASE="${CAPSULAS_DIR:-$HOME/capsulas}"

PUBLICAR=""; CLIP=(); ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --publicar) PUBLICAR="--publicar" ;;
    --clip) CLIP=(--clip "$2"); shift ;;
    *) ARGS+=("$1") ;;
  esac; shift
done

if [ "${ARGS[0]:-}" = "--pendientes" ]; then
  for id in $("$PY" "$HERE/pendientes.py"); do
    bash "$HERE/capsula.sh" "$id" "$BASE/$id" $PUBLICAR || echo "✗ $id falló; sigo con la siguiente" >&2
  done
  exit 0
fi

ID="${ARGS[0]:?uso: capsula.sh <id-capsula> [carpeta] [--publicar]}"
DIR="${ARGS[1]:-$BASE/$ID}"
mkdir -p "$DIR"
t0=$(date +%s)
"$PY" "$HERE/guion.py" "$ID" "$DIR" ${CLIP[@]+"${CLIP[@]}"}
[ -f "$DIR/palabras.json" ] || "$PY_VOZ" "$HERE/voz.py" "$DIR"
"$PY" "$HERE/render.py" 9x16 "$DIR" "$DIR/capsula-9x16.mp4"
"$PY" "$HERE/render.py" 16x9 "$DIR" "$DIR/capsula-16x9.mp4"
"$PY" "$HERE/covers.py" "$DIR"
"$PY" "$HERE/publicar.py" "$DIR" $PUBLICAR
echo "✓ $ID en $(( $(date +%s) - t0 )) s → $DIR"
