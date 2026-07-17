#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 4 ]]; then
  echo "Uso: $0 <video-entrada> <video-salida> [segundos-a-reemplazar] [freeze|card]" >&2
  exit 2
fi

INPUT="$1"
OUTPUT="$2"
REMOVE_SECONDS="${3:-2}"
MODE="${4:-freeze}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CARD="$ROOT/assets/video-closing-thank-you.svg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ "$MODE" != "freeze" && "$MODE" != "card" ]]; then
  echo "Modo no válido: $MODE (usa freeze o card)" >&2
  exit 2
fi

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null

DURATION="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$INPUT")"
CUT="$(awk -v duration="$DURATION" -v remove="$REMOVE_SECONDS" 'BEGIN{value=duration-remove; if(value<=0) exit 1; printf "%.3f",value}')"
CHANNELS="$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=nw=1:nk=1 "$INPUT")"
LAYOUT="mono"
[[ "$CHANNELS" == "2" ]] && LAYOUT="stereo"

if [[ "$MODE" == "freeze" ]]; then
  # NotebookLM añade su tarjeta en los últimos segundos. Conservamos el último
  # fotograma limpio en vez de introducir una plantilla visual ajena al vídeo.
  ffmpeg -hide_banner -y -loglevel warning \
    -i "$INPUT" \
    -filter_complex "[0:v]trim=start=0:end=$CUT,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=$REMOVE_SECONDS,trim=duration=$DURATION,format=yuv420p[v];[0:a]atrim=start=0:end=$DURATION,asetpts=PTS-STARTPTS[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 21 -profile:v high \
    -r 24 -c:a aac -b:a 80k -movflags +faststart \
    -metadata comment="NotebookLM ending removed · original visual style preserved" "$OUTPUT"
else
  # Compatibilidad con el comportamiento anterior. La tarjeta dura exactamente
  # lo eliminado para no alterar la duración total del vídeo.
  command -v sips >/dev/null
  sips -s format png "$CARD" --out "$TMP/closing.png" >/dev/null
  ffmpeg -hide_banner -y -loglevel warning \
    -i "$INPUT" -loop 1 -framerate 24 -i "$TMP/closing.png" \
    -f lavfi -i "anullsrc=r=44100:cl=$LAYOUT" \
    -filter_complex "[0:v]trim=start=0:end=$CUT,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=0:end=$CUT,asetpts=PTS-STARTPTS[a0];[1:v]trim=duration=$REMOVE_SECONDS,setpts=PTS-STARTPTS,format=yuv420p[v1];[2:a]atrim=duration=$REMOVE_SECONDS,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
    -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 21 -profile:v high \
    -r 24 -c:a aac -b:a 80k -movflags +faststart \
    -metadata comment="Produced by AdmiraNeXT · branded closing card" "$OUTPUT"
fi

echo "Cierre de NotebookLM limpiado desde ${CUT}s con modo ${MODE}: $OUTPUT"
