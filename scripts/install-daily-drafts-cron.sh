#!/bin/bash
set -euo pipefail

SITE_DIR="${SITE_DIR:-/var/www/sgeda}"
COUNT="${CONTENT_DRAFT_COUNT:-1}"
LOG_DIR="$SITE_DIR/data/logs"
LOG_FILE="$LOG_DIR/daily-drafts.log"
CRON_FILE="/etc/cron.d/sgeda-daily-drafts"

mkdir -p "$LOG_DIR"

cat > "$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Generate one research brief on Monday/Wednesday/Friday, never auto-publish.
0 9 * * 1,3,5 root cd $SITE_DIR && npm run content:drafts -- --count=$COUNT >> $LOG_FILE 2>&1 && npm run content:build >> $LOG_FILE 2>&1 && pm2 restart seda-api --update-env >> $LOG_FILE 2>&1
EOF

chmod 644 "$CRON_FILE"
echo "Installed daily draft cron: $CRON_FILE"
echo "Log file: $LOG_FILE"
