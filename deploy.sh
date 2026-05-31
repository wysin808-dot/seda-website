#!/bin/bash
# SGEDA 一键部署脚本
# 在火山引擎 ECS 上首次运行: bash deploy.sh
# 后续更新运行: bash deploy.sh update

set -e
REPO="https://github.com/wysin808-dot/seda-website.git"
SITE_DIR="/var/www/sgeda"
DOMAIN="sgeda.org.cn"

echo "=== SGEDA 部署脚本 ==="

if [ "$1" == "update" ]; then
  # ── 更新代码 ──
  echo "[1/3] 拉取最新代码..."
  cd $SITE_DIR && git pull origin main
  echo "[2/3] 重启 API 服务..."
  pm2 restart seda-api
  echo "[3/3] 重载 Nginx..."
  nginx -t && systemctl reload nginx
  echo "✅ 更新完成！"
  exit 0
fi

# ── 首次安装 ──

echo "[1/9] 更新系统包..."
apt-get update -qq && apt-get install -y -qq nginx git certbot python3-certbot-nginx curl

echo "[2/9] 安装 Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs

echo "[3/9] 安装 PM2..."
npm install -g pm2 --quiet

echo "[4/9] 克隆代码..."
mkdir -p /var/www
if [ -d "$SITE_DIR" ]; then
  cd $SITE_DIR && git pull origin main
else
  git clone $REPO $SITE_DIR
fi

echo "[5/9] 配置环境变量..."
if [ ! -f "$SITE_DIR/.env" ]; then
  cat > $SITE_DIR/.env << 'EOF'
DEEPSEEK_API_KEY=请填入你的DeepSeek API Key
DEEPSEEK_MODEL=deepseek-chat
WECHAT_ID=请填入微信号
WECHAT_QR_URL=请填入微信二维码图片URL
PORT=3001
EOF
  echo "⚠️  请编辑 $SITE_DIR/.env 填入真实配置"
fi

echo "[6/9] 配置 Nginx..."
cp $SITE_DIR/nginx.conf /etc/nginx/sites-available/sgeda
# 替换占位域名（如果需要）
ln -sf /etc/nginx/sites-available/sgeda /etc/nginx/sites-enabled/sgeda
rm -f /etc/nginx/sites-enabled/default
nginx -t

echo "[7/9] 申请 SSL 证书..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || \
  echo "⚠️  SSL 申请失败，请确认 DNS 已指向本机 IP，再手动运行: certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo "[8/9] 启动 API 服务..."
cd $SITE_DIR
pm2 start server-selfhost.js --name seda-api --interpreter node
pm2 save
pm2 startup systemd -u root --hp /root

echo "[9/9] 启动 Nginx..."
systemctl enable nginx
systemctl restart nginx

echo ""
echo "✅ 部署完成！"
echo "   网站地址: https://www.$DOMAIN"
echo "   API 状态: pm2 status"
echo "   Nginx 日志: tail -f /var/log/nginx/access.log"
echo "   更新代码: bash $SITE_DIR/deploy.sh update"
