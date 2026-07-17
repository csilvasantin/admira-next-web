#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/replace-notebooklm-ending.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null

# Dos segundos rojos representan la estética de la presentación; el último
# segundo azul representa la tarjeta ajena que debe desaparecer.
ffmpeg -hide_banner -y -loglevel error \
  -f lavfi -i "color=c=red:s=320x180:r=24:d=2" \
  -f lavfi -i "color=c=blue:s=320x180:r=24:d=1" \
  -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=3" \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -map 2:a -c:v libx264 -pix_fmt yuv420p -c:a aac "$TMP/source.mp4"

"$SCRIPT" "$TMP/source.mp4" "$TMP/result.mp4" 1

SOURCE_DURATION="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$TMP/source.mp4")"
RESULT_DURATION="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$TMP/result.mp4")"
awk -v source="$SOURCE_DURATION" -v result="$RESULT_DURATION" 'BEGIN { if ((source-result > .1) || (result-source > .1)) exit 1 }'

read -r RED GREEN BLUE < <(ffmpeg -hide_banner -loglevel error -ss 2.8 -i "$TMP/result.mp4" \
  -vf scale=1:1 -frames:v 1 -f rawvideo -pix_fmt rgb24 - | od -An -tu1)

if (( RED < 180 || GREEN > 80 || BLUE > 80 )); then
  echo "Fallo: el cierre no conserva la estética previa (RGB $RED $GREEN $BLUE)" >&2
  exit 1
fi

echo "OK: estilo conservado y duración estable (${RESULT_DURATION}s)"
