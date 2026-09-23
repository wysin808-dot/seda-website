#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SITE_DIR="${SITE_DIR:-$(dirname "$SCRIPT_DIR")}"

# Automatic Baidu push is disabled in the repository. Do not consume its quota.
echo "Baidu: disabled; sitemap discovery only. This command submits to IndexNow."
exec node "$SCRIPT_DIR/indexnow-submit.mjs"
