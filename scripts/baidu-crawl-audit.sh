#!/usr/bin/env bash
# 百度抓取体检：在服务器上读 nginx 日志，验证蜘蛛身份，统计抓取结构。
#
# 为什么需要它：2026-11-25 那次体检发现，14 天里百度只抓了 96 个 HTML 页面，
# 30% 的请求花在 /api/config 上，核心页 /aeis/ 一次没被抓。这类问题在
# 站长平台的「抓取频次」图上看不出来，只能从日志里算。
#
# 用法（在服务器上跑）：
#   bash scripts/baidu-crawl-audit.sh            # 默认读全部现有日志
#   bash scripts/baidu-crawl-audit.sh 7          # 只看最近 7 个日志文件
#
# 输出：终端汇总 + reports/baidu-crawl-YYYYMMDD.json

set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ "$REPO_DIR" = "/" ] && REPO_DIR="$(pwd)"
LOG_DIR="${LOG_DIR:-/var/log/nginx}"
LIMIT="${1:-0}"
CACHE=/tmp/seda-baidu-verified-$(date +%Y%m%d).txt
TMP=/tmp/seda-baidu-req.txt

cd "$LOG_DIR" || { echo "找不到日志目录 $LOG_DIR"; exit 1; }

# 日志文件按时间排序，LIMIT 用于只看最近几份
mapfile -t LOGS < <(ls -1 access.log* 2>/dev/null | sort -V)
if [ "$LIMIT" -gt 0 ] 2>/dev/null; then
  LOGS=("${LOGS[@]: -$LIMIT}")
fi

# 1) 收集自称 Baiduspider 的 IP，做双向 DNS 验证（反查 baidu.com + 正查回原 IP）
if [ ! -s "$CACHE" ]; then
  zcat -f "${LOGS[@]}" 2>/dev/null \
    | awk '/Baiduspider/ {print $1}' | sort -u > /tmp/seda-baidu-ips.txt
  : > "$CACHE"
  while read -r ip; do
    name=$(dig +short -x "$ip" 2>/dev/null | head -1 | sed 's/\.$//')
    case "$name" in
      *.baidu.com)
        fwd=$(dig +short "$name" A 2>/dev/null | head -1)
        [ "$fwd" = "$ip" ] && echo "$ip" >> "$CACHE"
        ;;
    esac
  done < /tmp/seda-baidu-ips.txt
fi

zcat -f "${LOGS[@]}" 2>/dev/null \
  | awk 'NR==FNR{ok[$1]=1;next} ($1 in ok) && /Baiduspider/ && /"GET /' "$CACHE" - \
  | awk '{print $7"\t"$9}' > "$TMP"

TOTAL=$(wc -l < "$TMP" | tr -d ' ')
[ "$TOTAL" -eq 0 ] && { echo "样本内没有已验证的百度抓取"; exit 0; }

API=$(grep -c '^/api/' "$TMP")
ASSETS=$(grep -cE '\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)\b' "$TMP")
HTML=$(grep -vcE '^/api/|\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)\b' "$TMP")
UNIQ_HTML=$(grep -vE '^/api/|\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)\b' "$TMP" | cut -f1 | sed 's/?.*//' | sort -u | wc -l | tr -d ' ')

echo "════════ 百度抓取体检（日志 ${#LOGS[@]} 份）════════"
echo "已验证蜘蛛 IP：$(wc -l < "$CACHE" | tr -d ' ')"
echo "GET 请求总数：$TOTAL"
printf "  接口 /api/*   %5s  (%.0f%%)\n" "$API" "$(awk -v a="$API" -v t="$TOTAL" 'BEGIN{printf (a/t)*100}')"
printf "  静态资源      %5s  (%.0f%%)\n" "$ASSETS" "$(awk -v a="$ASSETS" -v t="$TOTAL" 'BEGIN{printf (a/t)*100}')"
printf "  HTML 页面     %5s  (%.0f%%)\n" "$HTML" "$(awk -v a="$HTML" -v t="$TOTAL" 'BEGIN{printf (a/t)*100}')"
echo "唯一 HTML 页面：$UNIQ_HTML"
echo
echo "状态码分布："
cut -f2 "$TMP" | sort | uniq -c | sort -rn | head -5 | sed 's/^/  /'
echo
echo "核心页抓取次数："
for p in / /aeis/ /o-level/ /wace/ /jc/ /poly/ /university/ /international-school/; do
  n=$(awk -F'\t' -v p="$p" '$1==p' "$TMP" | wc -l | tr -d ' ')
  printf "  %-22s %s\n" "$p" "$n"
done
echo
echo "被爬最多的 10 个 URL："
cut -f1 "$TMP" | sed 's/?.*//' | sort | uniq -c | sort -rn | head -10 | sed 's/^/  /'

mkdir -p "$REPO_DIR/reports"
OUT="$REPO_DIR/reports/baidu-crawl-$(date +%Y%m%d).json"
cat > "$OUT" <<JSON
{
  "generatedAt": "$(date -Iseconds)",
  "source": "nginx $LOG_DIR (${#LOGS[@]} files)",
  "verifiedIps": $(wc -l < "$CACHE" | tr -d ' '),
  "requests": {"total": $TOTAL, "api": $API, "assets": $ASSETS, "html": $HTML, "uniqueHtml": $UNIQ_HTML}
}
JSON
echo
echo "报告：$OUT"
