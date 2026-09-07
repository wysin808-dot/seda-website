#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SITE_DIR="${SITE_DIR:-$(dirname "$SCRIPT_DIR")}"

# Baidu has one submission owner and one persistent history in GitHub Actions.
echo "Baidu: handled by SEDA SEO Daily Bot; new published URLs enter the next daily batch."
exec node "$SCRIPT_DIR/indexnow-submit.mjs"
