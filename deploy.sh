#!/usr/bin/env bash
# Publica admiranext.com (status + sitio) en CLOUDFLARE PAGES (proyecto 'admiranext').
# Desde 2026-07-10 el ORIGEN es Cloudflare Pages (custom domain www.admiranext.com),
# NO GitHub Pages — así el /status nunca sirve caché vieja (_headers: no-store).
# git push queda como backup de código. Uso: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
echo "→ GitHub (push de código, backup)…"
git push origin main 2>&1 | tail -1 || echo "  (nada que pushear)"
echo "→ Cloudflare Pages (ORIGEN de producción)…"
export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
TMP="$(mktemp -d)"; git archive main | tar -x -C "$TMP"
npx --yes wrangler@latest pages deploy "$TMP" --project-name admiranext --branch main
rm -rf "$TMP"
echo "✓ https://www.admiranext.com/status (Cloudflare Pages · sin caché) · mirror https://admiranext.pages.dev"
