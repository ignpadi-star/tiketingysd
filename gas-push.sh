#!/usr/bin/env bash
# Push kode ke project Apps Script "Tiket Kegiatan" lalu perbarui deployment.
# Pakai: npm run push:gas
set -euo pipefail

cd "$(dirname "$0")"

# Deployment yang dipakai URL produksi. Ganti bila URL berubah.
DEPLOYMENT_ID="${DEPLOYMENT_ID:-AKfycby0JWNlNvNQ819AD_zrhTAAffBBg0_LLfAH3WjXCNLzN3V-JCogCPTVYMuk98UMqvzo}"
DESCRIPTION="${1:-Update $(date '+%Y-%m-%d %H:%M')}"

clasp push --force

if [ -n "$DEPLOYMENT_ID" ]; then
  clasp update-deployment "$DEPLOYMENT_ID" --description "$DESCRIPTION"
fi
