#!/bin/bash
set -euo pipefail

SITE_DIR="${SITE_DIR:-/var/www/sgeda}"
LOG_DIR="$SITE_DIR/data/logs"
LOG_FILE="$LOG_DIR/seo-submit.log"
CRON_FILE="/etc/cron.d/sgeda-seo-submit"

mkdir -p "$LOG_DIR"

cat > "$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Submit SEDA sitemap URLs to Baidu and IndexNow every day at 09:20 Singapore/China time.
20 9 * * * root cd $SITE_DIR && npm run seo:submit >> $LOG_FILE 2>&1
EOF

chmod 644 "$CRON_FILE"
echo "Installed SEO submit cron: $CRON_FILE"
echo "Log file: $LOG_FILE"
