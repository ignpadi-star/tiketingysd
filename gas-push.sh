#!/usr/bin/env bash
# Push kode ke project Apps Script "Tiket Kegiatan" lalu perbarui deployment.
# Pakai: npm run push:gas
set -euo pipefail

cd "$(dirname "$0")"

# Deployment yang dipakai URL produksi. Ganti bila URL berubah.
DEPLOYMENT_ID="${DEPLOYMENT_ID:-AKfycbwq7RPgy84niiUOBoyTsYZ08XrP7ySdhtbYs6C9gTEgn7ZiAS7YV331ZAvrMrLHKlqR}"
DESCRIPTION="${1:-Update $(date '+%Y-%m-%d %H:%M')}"

clasp push --force

if [ -n "$DEPLOYMENT_ID" ]; then
  clasp update-deployment "$DEPLOYMENT_ID" --description "$DESCRIPTION"
fi
