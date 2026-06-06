#!/bin/bash
# 百度收录自动提交脚本
# 每天提交一小批 URL，轮换覆盖全站 sitemap
# 每次运行会记录提交进度，下次从上次停止的位置继续

SITE="https://sgeda.org.cn"
BAIDU_TOKEN="${BAIDU_TOKEN:-6YcFv5eADdpdSOmv}"
SITE_DIR="${SITE_DIR:-}"
if [ -z "$SITE_DIR" ]; then
  for dir in /var/www/seda-website /var/www/sgeda; do
    if [ -f "$dir/sitemap.xml" ]; then
      SITE_DIR="$dir"
      break
    fi
  done
fi
SITEMAP_FILE="${SITEMAP_FILE:-$SITE_DIR/sitemap.xml}"
STATE_FILE="${STATE_FILE:-$SITE_DIR/.baidu-submit-offset}"
LOG_FILE="/var/log/baidu-submit.log"
SEO_SUBMISSION_FILE="${SEO_SUBMISSION_FILE:-$SITE_DIR/data/seo/submissions.jsonl}"
BATCH_SIZE=5   # 安全批次：每次5条，避免超出剩余配额导致整批失败

log() { echo "[$(date '+%Y-%m-%d %H:%M')] $*" | tee -a "$LOG_FILE"; }

record_submission() {
  local provider="$1"
  local submitted="$2"
  local status="$3"
  local http_status="$4"
  local message="$5"
  mkdir -p "$(dirname "$SEO_SUBMISSION_FILE")"
  PROVIDER="$provider" SUBMITTED="$submitted" STATUS="$status" HTTP_STATUS="$http_status" MESSAGE="$message" TOTAL="$TOTAL" OFFSET="$OFFSET" NEXT_OFFSET="$NEXT_OFFSET" \
    python3 -c 'import json, os, datetime
now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
record = {
  "date": now[:10],
  "createdAt": now,
  "provider": os.environ.get("PROVIDER", ""),
  "submitted": int(os.environ.get("SUBMITTED", "0") or 0),
  "totalUrls": int(os.environ.get("TOTAL", "0") or 0),
  "offset": int(os.environ.get("OFFSET", "0") or 0),
  "nextOffset": int(os.environ.get("NEXT_OFFSET", "0") or 0),
  "status": os.environ.get("STATUS", ""),
  "httpStatus": int(os.environ.get("HTTP_STATUS", "0") or 0),
  "message": os.environ.get("MESSAGE", "")[:500],
}
print(json.dumps(record, ensure_ascii=False))' >> "$SEO_SUBMISSION_FILE"
}

# 从 sitemap 提取所有 URL
ALL_URLS=$(grep -oP '(?<=<loc>)[^<]+' "$SITEMAP_FILE" 2>/dev/null)
TOTAL=$(echo "$ALL_URLS" | wc -l)

if [ -z "$SITE_DIR" ] || [ -z "$ALL_URLS" ] || [ "$TOTAL" -lt 1 ]; then
  log "ERROR: 无法读取 sitemap，SITE_DIR=${SITE_DIR:-none}，URL 数量: $TOTAL"
  exit 1
fi

# 读取上次偏移量
OFFSET=0
[ -f "$STATE_FILE" ] && OFFSET=$(cat "$STATE_FILE")

# 取本次要提交的 URL（循环轮换）
BATCH=$(echo "$ALL_URLS" | tail -n +$((OFFSET + 1)) | head -n $BATCH_SIZE)
BATCH_COUNT=$(echo "$BATCH" | grep -c '^')

# 如果到了末尾不足 20 条，补上开头的
if [ "$BATCH_COUNT" -lt "$BATCH_SIZE" ]; then
  REMAINING=$((BATCH_SIZE - BATCH_COUNT))
  EXTRA=$(echo "$ALL_URLS" | head -n $REMAINING)
  BATCH=$(printf "%s\n%s" "$BATCH" "$EXTRA")
  NEXT_OFFSET=$REMAINING
else
  NEXT_OFFSET=$((OFFSET + BATCH_SIZE))
  [ "$NEXT_OFFSET" -ge "$TOTAL" ] && NEXT_OFFSET=0
fi

log "提交第 $((OFFSET + 1))-$((OFFSET + BATCH_SIZE)) / $TOTAL 页"

# 提交到百度
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: text/plain" \
  "http://data.zz.baidu.com/urls?site=${SITE}&token=${BAIDU_TOKEN}" \
  --data-binary "$(echo "$BATCH")" \
  --max-time 30)

log "百度响应: $RESPONSE"
BAIDU_STATUS="success"
echo "$RESPONSE" | grep -q '"error"' && BAIDU_STATUS="error"
record_submission "baidu" "$BATCH_COUNT" "$BAIDU_STATUS" "200" "$RESPONSE"

# 记录新偏移量
echo "$NEXT_OFFSET" > "$STATE_FILE"

# 同时推送到 IndexNow (Bing)
INDEXNOW_KEY="212f14d5aa77d65865cd1c7bc9719fba"
URL_ARRAY=$(echo "$BATCH" | python3 -c "
import sys, json
urls = [u.strip() for u in sys.stdin if u.strip()]
print(json.dumps(urls))
")

INDEXNOW_RESP=$(curl -s -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"host\":\"sgeda.org.cn\",\"key\":\"${INDEXNOW_KEY}\",\"keyLocation\":\"https://sgeda.org.cn/${INDEXNOW_KEY}.txt\",\"urlList\":${URL_ARRAY}}" \
  --max-time 30 \
  -w "HTTP:%{http_code}")

log "Bing IndexNow: $INDEXNOW_RESP"
INDEXNOW_HTTP=$(echo "$INDEXNOW_RESP" | sed -n 's/.*HTTP:\([0-9][0-9][0-9]\)$/\1/p')
INDEXNOW_STATUS="error"
[ "$INDEXNOW_HTTP" = "200" ] || [ "$INDEXNOW_HTTP" = "202" ] && INDEXNOW_STATUS="success"
record_submission "indexnow" "$BATCH_COUNT" "$INDEXNOW_STATUS" "${INDEXNOW_HTTP:-0}" "$INDEXNOW_RESP"
log "✅ 完成，下次从第 $((NEXT_OFFSET + 1)) 页开始"
