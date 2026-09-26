#!/usr/bin/env bash
# instalar-cron.sh — deja la tarea automática de cápsulas (norma 16:9 + 9:16, 26-sep-2026).
# Cada CAPSULAS_CADA min (15): git pull del checkout y capsula.sh --pendientes --publicar.
# Con crontab, una línea de cron (se reemplaza a sí misma). Sin crontab —las cajas Linux de
# la flota no traen cron ni systemd—, un bucle nohup con pidfile, como el vigilante de encargos
# (box-*.sh): relanzarlo mata el anterior. El bucle NO sobrevive a un reinicio de la caja.
#   CAPSULAS_REPO (checkout de admira-next-web en main), CAPSULAS_DIR, CAPSULAS_PY_VOZ, CAPSULAS_CADA
#   instalar-cron.sh [--parar]
set -euo pipefail
REPO="${CAPSULAS_REPO:-$HOME/admira-next-web}"
DIR="${CAPSULAS_DIR:-$HOME/capsulas}"
PYV="${CAPSULAS_PY_VOZ:-$HOME/.venvs/capsulas/bin/python}"
CADA="${CAPSULAS_CADA:-15}"
MARCA="# capsulas-16x9-9x16"
PIDF="$DIR/.bucle.pid"
mkdir -p "$DIR"
VUELTA="cd '$REPO' && git pull -q --ff-only origin main >/dev/null 2>&1; CAPSULAS_DIR='$DIR' CAPSULAS_PY_VOZ='$PYV' bash '$REPO/tools/capsulas/capsula.sh' --pendientes --publicar >> '$DIR/cron.log' 2>&1"

if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then kill "$(cat "$PIDF")"; fi
rm -f "$PIDF"
[ "${1:-}" = "--parar" ] && { command -v crontab >/dev/null && { crontab -l 2>/dev/null | grep -v "$MARCA" | crontab - || true; }; echo "parado"; exit 0; }

if command -v crontab >/dev/null; then
  { crontab -l 2>/dev/null | grep -v "$MARCA" || true; echo "*/$CADA * * * * $VUELTA $MARCA"; } | crontab -
  crontab -l | grep "$MARCA"
else
  nohup bash -c "while true; do $VUELTA; sleep $((CADA * 60)); done" >/dev/null 2>&1 &
  echo $! > "$PIDF"
  echo "bucle cada $CADA min · pid $(cat "$PIDF") · log $DIR/cron.log"
fi
