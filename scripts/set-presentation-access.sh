#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Fija/actualiza la contraseña de un espacio de presentaciones (secret de
# Cloudflare Pages del proyecto 'admiranext'). La misma clave abre la versión
# castellana en /presentaciones y la inglesa en /presentations. Tú tecleas la
# clave; no se muestra ni se guarda en el historial. Aislamiento por cliente.
#
#   Uso:  ./scripts/set-presentation-access.sh <slug>
#   Slugs: caixa · lenovo · admin (galería) · <nuevo-cliente>…
#
# Tras fijar las claves, publica el gate:  ./deploy.sh
# Este script NO se despliega al sitio (.gitattributes export-ignore).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
slug="${1:-}"
[ -n "$slug" ] || { echo "Uso: $0 <slug>   (p.ej. caixa, lenovo, admin)"; exit 1; }
cd "$(dirname "$0")/.."

export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
WR="npx --yes wrangler@latest"
PROJ="admiranext"

# 1) Clave de firma de cookies (una sola vez, aleatoria).
if ! $WR pages secret list --project-name "$PROJ" 2>/dev/null | grep -q PRES_SIGNING_KEY; then
  echo "→ Creando PRES_SIGNING_KEY (clave de firma, una sola vez)…"
  openssl rand -hex 32 | $WR pages secret put PRES_SIGNING_KEY --project-name "$PROJ"
fi

# 2) Password del espacio: slug 'caixa' → secret PRES_CAIXA, 'admin' → PRES_ADMIN.
NAME="PRES_$(printf '%s' "$slug" | tr '[:lower:]' '[:upper:]' | tr -c 'A-Z0-9' '_')"
read -rs -p "Contraseña para '$slug'  (secret $NAME): " pw; echo
[ -n "$pw" ] || { echo "✗ vacía, aborto"; exit 1; }
printf '%s' "$pw" | $WR pages secret put "$NAME" --project-name "$PROJ"
echo "✓ $NAME configurada."
echo "  Cuando tengas todas, publica el gate:  ./deploy.sh"
