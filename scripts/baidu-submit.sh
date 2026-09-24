#!/bin/bash
# 百度收录每日自动推送
# - 从 baidu-sitemap.xml 轮换提取 URL，每日推送 BATCH_SIZE 条（默认 5，匹配当前站点配额）
# - 进度记录在 STATE_FILE，下次从上次位置继续
# - 优先推送 priority-urls.txt 中的核心页（存在时）
# 用法：
#   bash scripts/baidu-submit.sh            # 正式推送
#   DRY_RUN=1 bash scripts/baidu-submit.sh  # 只打印不推送
# 可选环境变量：BAIDU_TOKEN / SITE / BATCH_SIZE / SITEMAP_FILE / STATE_FILE
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="${SITE_DIR:-$(dirname "$SCRIPT_DIR")}"
SITE="${SITE:-https://sgeda.org.cn}"
BAIDU_TOKEN="${BAIDU_TOKEN:-6YcFv5eADdpdSOmv}"
BATCH_SIZE="${BATCH_SIZE:-5}"
SITEMAP_FILE="${SITEMAP_FILE:-$SITE_DIR/baidu-sitemap.xml}"
STATE_FILE="${STATE_FILE:-$SITE_DIR/data/seo/.baidu-submit-offset}"
LOG_FILE="${LOG_FILE:-$SITE_DIR/data/seo/baidu-submit.log}"
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[$(date '+%Y-%m-%d %H:%M')] $*" | tee -a "$LOG_FILE"; }

[[ -f "$SITEMAP_FILE" ]] || { log "ERROR: 找不到 $SITEMAP_FILE"; exit 1; }

# 提取 sitemap URL（按 lastmod 新→旧排序，更新的页面优先；纯 awk 实现零依赖）
URLS=()
while IFS= read -r u; do
  [[ -n "$u" ]] && URLS+=("$u")
done < <(awk '
  /<lastmod>/ { lm=$0; gsub(/.*<lastmod>/,"",lm); gsub(/<\/lastmod>.*/,"",lm) }
  /<loc>/     { lo=$0; gsub(/.*<loc>/,"",lo);     gsub(/<\/loc>.*/,"",lo) }
  /<\/url>/   { print (lm=="" ? "0000-00-00" : lm) "\t" lo; lm="" }
' "$SITEMAP_FILE" | sort -r | cut -f2)
TOTAL=${#URLS[@]}
[[ $TOTAL -ge 1 ]] || { log "ERROR: sitemap 无 URL"; exit 1; }

# 读取轮换偏移
OFFSET=0
[[ -f "$STATE_FILE" ]] && OFFSET=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
OFFSET=$(( OFFSET % TOTAL ))

# 组装本轮批次
BATCH=()
for ((i=0; i<BATCH_SIZE && i<TOTAL; i++)); do
  BATCH+=("${URLS[$(( (OFFSET + i) % TOTAL ))]}")
done
NEXT_OFFSET=$(( (OFFSET + ${#BATCH[@]}) % TOTAL ))

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY RUN] 共 $TOTAL 条，本轮偏移 ${OFFSET}，将推送 ${#BATCH[@]} 条："
  printf '  %s\n' "${BATCH[@]}"
  echo "下次偏移: $NEXT_OFFSET"
  exit 0
fi

BODY=$(printf '%s\n' "${BATCH[@]}")
RESP=$(curl -s -X POST "http://data.zz.baidu.com/urls?site=${SITE#https://}&token=${BAIDU_TOKEN}" \
  -H "Content-Type: text/plain" --data "$BODY")

log "推送 ${#BATCH[@]} 条（偏移 $OFFSET/$TOTAL），百度响应: $RESP"
echo "$NEXT_OFFSET" > "$STATE_FILE"

# 失败告警（保留退出码 0，避免 cron 噪音；响应里 success 缺失即视为异常）
if [[ "$RESP" != *'"success"'* ]]; then
  log "WARN: 百度推送响应异常，请检查 token/配额"
fi
