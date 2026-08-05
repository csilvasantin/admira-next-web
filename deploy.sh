#!/usr/bin/env bash
# Publica admiranext.com (status + sitio) en CLOUDFLARE PAGES (proyecto 'admiranext').
# Desde 2026-07-10 el ORIGEN es Cloudflare Pages (custom domain www.admiranext.com),
# NO GitHub Pages — así el /status nunca sirve caché vieja (_headers: no-store).
# git push queda como backup de código. Uso: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${ADMIRA_RELEASE_AGENT:?Define ADMIRA_RELEASE_AGENT con el agente responsable (ej. OraculoMBAPlata)}"
: "${ADMIRA_RELEASE_MACHINE:?Define ADMIRA_RELEASE_MACHINE con el equipo físico (ej. MacBookAirPlata)}"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ No se publica desde un árbol sucio: firma y commit dejarían de corresponder." >&2
  exit 1
fi
echo "→ GitHub (push de código, backup)…"
# PRODUCCION ES LA RAMA PRINCIPAL. El 5-ago-2026 yokup.com estuvo horas
# sirviendo una rama de trabajo y nadie se entero. Este guarda lo impide:
# aborta si lo que tienes delante no es exactamente origin/main.
echo "→ Rama…"
source ~/Claude/admira-vault/guarda-rama.sh

git push origin main 2>&1 | tail -1 || echo "  (nada que pushear)"
echo "→ Cloudflare Pages (ORIGEN de producción)…"
export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
TMP="$(mktemp -d)"; git archive main | tar -x -C "$TMP"
release="$(git show main:index.html | sed -n 's/.*admiranext-version.*content="[^"]*\(v\.[^"]*\)".*/\1/p' | head -1)"
[[ -n "$release" ]] || { echo "✗ No se encontró el sello canónico en index.html" >&2; exit 1; }
declared_version="$(jq -r '.version // empty' release-signature.json)"
declared_agent="$(jq -r '.deployer // .agent // empty' release-signature.json)"
declared_machine="$(jq -r '.machine // empty' release-signature.json)"
declared_signature="$(jq -r '.signature // empty' release-signature.json)"
[[ "$declared_version" == "$release" ]] || { echo "✗ release-signature.json no coincide con el sello $release" >&2; exit 1; }
[[ "$declared_agent" == "$ADMIRA_RELEASE_AGENT" && "$declared_machine" == "$ADMIRA_RELEASE_MACHINE" ]] || { echo "✗ La declaración de responsable no coincide con este agente/equipo" >&2; exit 1; }
[[ "$declared_signature" == "$ADMIRA_RELEASE_AGENT · $ADMIRA_RELEASE_MACHINE" ]] || { echo "✗ Firma inválida en release-signature.json" >&2; exit 1; }
git_full="$(git rev-parse main)"
jq -n \
  --arg version "$release" \
  --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg deployer "$ADMIRA_RELEASE_AGENT" \
  --arg machine "$ADMIRA_RELEASE_MACHINE" \
  --arg signature "$ADMIRA_RELEASE_AGENT · $ADMIRA_RELEASE_MACHINE" \
  --arg git "$git_full" \
  '{version:$version,deployedAt:$deployedAt,deployer:$deployer,machine:$machine,signature:$signature,git:$git,gitShort:($git[0:7]),gitFull:$git,dirty:false}' \
  > "$TMP/version.json"
npx --yes wrangler@latest pages deploy "$TMP" --project-name admiranext --branch main
rm -rf "$TMP"
echo "✓ https://www.admiranext.com/status (Cloudflare Pages · sin caché) · mirror https://admiranext.pages.dev"
