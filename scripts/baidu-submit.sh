#!/bin/bash
# 百度收录自动提交脚本
# 每天提交 20 条 URL，轮换覆盖全站 382 页
# 每次运行会记录提交进度，下次从上次停止的位置继续

SITE="https://sgeda.org.cn"
BAIDU_TOKEN="${BAIDU_TOKEN:-6YcFv5eADdpdSOmv}"
SITEMAP_FILE="/var/www/sgeda/sitemap.xml"
STATE_FILE="/var/www/sgeda/.baidu-submit-offset"
LOG_FILE="/var/log/baidu-submit.log"
BATCH_SIZE=5   # 安全批次：每次5条，避免超出剩余配额导致整批失败

log() { echo "[$(date '+%Y-%m-%d %H:%M')] $*" | tee -a "$LOG_FILE"; }

# 从 sitemap 提取所有 URL
ALL_URLS=$(grep -oP '(?<=<loc>)[^<]+' "$SITEMAP_FILE" 2>/dev/null)
TOTAL=$(echo "$ALL_URLS" | wc -l)

if [ -z "$ALL_URLS" ] || [ "$TOTAL" -lt 1 ]; then
  log "ERROR: 无法读取 sitemap，URL 数量: $TOTAL"
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
log "✅ 完成，下次从第 $((NEXT_OFFSET + 1)) 页开始"
