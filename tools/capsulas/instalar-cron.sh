#!/usr/bin/env bash
# instalar-cron.sh — deja la tarea automática de cápsulas (norma 16:9 + 9:16, 26-sep-2026).
# Cada 15 min: capsula.sh --pendientes --publicar. Idempotente: reemplaza su propia línea.
#   CAPSULAS_REPO (checkout de admira-next-web al día), CAPSULAS_DIR, CAPSULAS_PY_VOZ, CAPSULAS_CADA (min)
set -euo pipefail
REPO="${CAPSULAS_REPO:-$HOME/admira-next-web}"
DIR="${CAPSULAS_DIR:-$HOME/capsulas}"
PYV="${CAPSULAS_PY_VOZ:-$HOME/.venvs/capsulas/bin/python}"
CADA="${CAPSULAS_CADA:-15}"
mkdir -p "$DIR"
LINEA="*/$CADA * * * * cd $REPO && git pull -q --ff-only origin main >/dev/null 2>&1; CAPSULAS_DIR=$DIR CAPSULAS_PY_VOZ=$PYV bash $REPO/tools/capsulas/capsula.sh --pendientes --publicar >> $DIR/cron.log 2>&1 # capsulas-16x9-9x16"
{ crontab -l 2>/dev/null | grep -v '# capsulas-16x9-9x16' || true; echo "$LINEA"; } | crontab -
crontab -l | grep '# capsulas-16x9-9x16'
