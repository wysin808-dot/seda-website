#!/usr/bin/env bash
set -euo pipefail

# The legacy cron invoked the former Baidu submission compatibility command.
# Remove it during every deploy so inherited server state cannot consume Baidu quota.
CRON_FILE="${CRON_FILE:-/etc/cron.d/sgeda-seo-submit}"
rm -f "$CRON_FILE"
printf 'Removed legacy SEO submission cron: %s\n' "$CRON_FILE"
