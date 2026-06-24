#!/bin/bash
# SEDA 每日浏览量报告
# 每天定时运行，调用 /api/analytics/report 获取昨日数据，发送邮件到指定邮箱
# 用法: bash scripts/daily-report.sh
# Cron: 0 8 * * * cd /var/www/sgeda && bash scripts/daily-report.sh

set -e

TOKEN="${ANALYTICS_REPORT_TOKEN:-seda-report-2026}"
API="http://localhost:3011/api/analytics/report?token=${TOKEN}"
TO_EMAIL="${REPORT_EMAIL:-ocean@bci.edu.sg}"
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)

echo "=== SEDA 每日报告 ${YESTERDAY} ==="

# 调用 API
RESP=$(curl -s --max-time 10 "${API}&date=${YESTERDAY}")
if [ -z "$RESP" ]; then
  echo "❌ API 无响应"
  exit 1
fi

# 检查是否有效 JSON
if ! echo "$RESP" | grep -q '"date"'; then
  echo "❌ API 返回异常: $(echo "$RESP" | head -c 200)"
  exit 1
fi

# 提取字段
PV=$(echo "$RESP" | grep -o '"pageviews":[0-9]*' | grep -o '[0-9]*')
UV=$(echo "$RESP" | grep -o '"visitors":[0-9]*' | grep -o '[0-9]*')

# 提取 Top 页面（简单解析 JSON 中的 topPages 数组）
TOP_PAGES=$(echo "$RESP" | grep -o '"path":"[^"]*","count":[0-9]*' | head -10 | while read line; do
  p=$(echo "$line" | grep -o '"path":"[^"]*"' | sed 's/"path":"//;s/"//')
  c=$(echo "$line" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
  printf "  %-45s %s 次\n" "$p" "$c"
done)

# 来源
TOP_SOURCES=$(echo "$RESP" | grep -o '"source":"[^"]*","count":[0-9]*' | head -5 | while read line; do
  s=$(echo "$line" | grep -o '"source":"[^"]*"' | sed 's/"source":"//;s/"//')
  c=$(echo "$line" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
  printf "  %-20s %s\n" "$s" "$c"
done)

# 地区
TOP_REGIONS=$(echo "$RESP" | grep -o '"region":"[^"]*","count":[0-9]*' | head -5 | while read line; do
  r=$(echo "$line" | grep -o '"region":"[^"]*"' | sed 's/"region":"//;s/"//')
  c=$(echo "$line" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
  printf "  %-25s %s\n" "$r" "$c"
done)

# 设备
DEVICES=$(echo "$RESP" | grep -o '"device":"[^"]*","count":[0-9]*' | while read line; do
  d=$(echo "$line" | grep -o '"device":"[^"]*"' | sed 's/"device":"//;s/"//')
  c=$(echo "$line" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
  printf "  %s: %s  " "$d" "$c"
done)

# 构建邮件正文
BODY=$(cat <<EOF
From: SEDA 日报 <noreply@sgeda.org.cn>
To: ${TO_EMAIL}
Subject: 📊 SEDA 日报 ${YESTERDAY} | PV: ${PV:-0} UV: ${UV:-0}
Content-Type: text/plain; charset=UTF-8

═══════════════════════════════════════
  SEDA 新加坡择校网 · 每日浏览量报告
  📅 ${YESTERDAY}
═══════════════════════════════════════

📈 总浏览量:  ${PV:-0}
👥 访客数:    ${UV:-0}

───────────────────────────────────────
📄 热门页面 Top 10
───────────────────────────────────────
${TOP_PAGES:-  暂无数据}

───────────────────────────────────────
🔗 流量来源
───────────────────────────────────────
${TOP_SOURCES:-  暂无数据}

───────────────────────────────────────
🌏 访客地区
───────────────────────────────────────
${TOP_REGIONS:-  暂无数据}

───────────────────────────────────────
📱 设备
───────────────────────────────────────
${DEVICES:-  暂无数据}

───────────────────────────────────────
SEDA 新加坡择校网 | sgeda.org.cn
报告由自动系统生成
EOF
)

echo "$BODY"
echo ""

# 发送邮件
if command -v sendmail &> /dev/null; then
  echo "$BODY" | sendmail -t && echo "✅ 邮件已发送到 ${TO_EMAIL}"
elif command -v mail &> /dev/null; then
  echo "$BODY" | mail -s "📊 SEDA 日报 ${YESTERDAY}" "${TO_EMAIL}" && echo "✅ 邮件已发送到 ${TO_EMAIL}"
elif command -v msmtp &> /dev/null; then
  echo "$BODY" | msmtp -t && echo "✅ 邮件已发送到 ${TO_EMAIL}"
else
  echo "⚠️  未找到 sendmail/mail/msmtp，邮件未发送。请安装: apt install mailutils"
  echo "   报告内容已输出在上面 ↑"
fi
