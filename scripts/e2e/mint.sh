#!/usr/bin/env bash
# Mint a fresh Supabase session for the E2E test user and cache it.
# Usage: E2E_SETUP_TOKEN=xxx bash scripts/e2e/mint.sh
set -euo pipefail

: "${E2E_SETUP_TOKEN:?set E2E_SETUP_TOKEN}"
PROJECT_REF="${E2E_PROJECT_REF:-qkjhguziuchqsbxzruea}"
OUT="${E2E_SESSION_PATH:-/tmp/browser/session.json}"

mkdir -p "$(dirname "$OUT")"
curl -sS -X POST \
  -H "x-e2e-token: ${E2E_SETUP_TOKEN}" \
  -H "content-type: application/json" \
  "https://${PROJECT_REF}.supabase.co/functions/v1/e2e-mint-session" \
  -o "$OUT"

if ! grep -q access_token "$OUT"; then
  echo "mint failed:" >&2; cat "$OUT" >&2; exit 1
fi
echo "session -> $OUT"