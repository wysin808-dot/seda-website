#!/usr/bin/env bash
set -euo pipefail

# Intentionally retained as a compatibility entry point for legacy calls.
# Automatic Baidu URL submission is disabled: sitemap discovery remains enabled,
# but this script must never read credentials or send requests to Baidu.
printf '%s\n' 'Automatic Baidu URL submission is disabled; no URLs were submitted.'
