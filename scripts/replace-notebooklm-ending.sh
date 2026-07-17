#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Uso: $0 <video-entrada> <video-salida> [segundos-a-reemplazar]" >&2
  exit 2
fi

INPUT="$1"
OUTPUT="$2"
REMOVE_SECONDS="${3:-2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CARD="$ROOT/assets/video-closing-thank-you.svg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
command -v sips >/dev/null

DURATION="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$INPUT")"
CUT="$(awk -v duration="$DURATION" -v remove="$REMOVE_SECONDS" 'BEGIN{value=duration-remove; if(value<=0) exit 1; printf "%.3f",value}')"
CHANNELS="$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=nw=1:nk=1 "$INPUT")"
LAYOUT="mono"
[[ "$CHANNELS" == "2" ]] && LAYOUT="stereo"

sips -s format png "$CARD" --out "$TMP/closing.png" >/dev/null
ffmpeg -hide_banner -y -loglevel warning \
  -i "$INPUT" -loop 1 -framerate 24 -i "$TMP/closing.png" \
  -f lavfi -i "anullsrc=r=44100:cl=$LAYOUT" \
  -filter_complex "[0:v]trim=start=0:end=$CUT,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=0:end=$CUT,asetpts=PTS-STARTPTS[a0];[1:v]trim=duration=3,setpts=PTS-STARTPTS,format=yuv420p[v1];[2:a]atrim=duration=3,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 21 -profile:v high \
  -r 24 -c:a aac -b:a 80k -movflags +faststart \
  -metadata comment="Produït per AdmiraNeXT · Cierre Gracias / Thank you" "$OUTPUT"

echo "Cierre reemplazado desde ${CUT}s: $OUTPUT"
