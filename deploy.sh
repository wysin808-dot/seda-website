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
  set -euo pipefail
  build_for_school_redirects() {
    cd "$1"
    npm ci
    node scripts/build-content.mjs
    npm test
    node scripts/migrate-school-pages.mjs --validate-only
    node scripts/seo-check.mjs
  }
  # Select the source before touching the served directory. fetch is read-only
  # with respect to frontend bytes; bootstrap works on the first helper rollout.
  DEPLOY_SOURCE="$SITE_DIR"
  if [ -d "/var/www/seda-website" ] && [ "/var/www/seda-website" != "$SITE_DIR" ]; then
    DEPLOY_SOURCE="/var/www/seda-website"
  fi
  cd "$DEPLOY_SOURCE"
  echo "[1/4] 获取最新代码与站外事务 helper..."
  git fetch origin main
  DEPLOY_HELPER="$(mktemp /var/tmp/sgeda-deploy-helper.XXXXXX)"
  trap 'rm -f -- "$DEPLOY_HELPER"' EXIT
  git show origin/main:scripts/deploy-site-transaction.sh > "$DEPLOY_HELPER"
  source "$DEPLOY_HELPER"
  rm -f -- "$DEPLOY_HELPER"
  # Always snapshot SITE_DIR, not merely a separate Git source directory.
  deploy_site_transaction_begin
  SOURCE_PREVIOUS_SHA="$(git rev-parse HEAD)"
  git pull origin main
  node scripts/restore-cms-content.mjs "$DEPLOY_TX_BACKUP/before" "$SOURCE_PREVIOUS_SHA"
  deploy_site_transaction_checkpoint_cms

  if [ "$DEPLOY_SOURCE" != "$SITE_DIR" ]; then
    echo "[1.5/4] 构建并同步到实际网站目录..."
    build_for_school_redirects "$DEPLOY_SOURCE"
    rsync -av --delete \
      --exclude='.git' \
      --exclude='.env*' \
      --exclude='node_modules' \
      --exclude='server-selfhost.js' \
      --exclude='deploy.sh' \
      --exclude='nginx.conf' \
      --exclude='scripts/' \
      --exclude='content/articles/' \
      --exclude='content/keyword-queue.csv' \
      --exclude='assets/uploads/' \
      --exclude='data/analytics/' \
      --exclude='data/leads/' \
      --exclude='data/cms/' \
      --exclude='data/seo/*state*.json' \
      --exclude='*.jsonl' \
      --exclude='*.log' \
      --exclude='*.sqlite*' \
      --exclude='*.db*' \
      --exclude='reports/' \
      "$DEPLOY_SOURCE/" "$SITE_DIR/"
    echo "✅ 文件同步完成"
  else
    build_for_school_redirects "$DEPLOY_SOURCE"
  fi
  # Validate actual served targets, not only the independently built source.
  (cd "$SITE_DIR"; node "$DEPLOY_SOURCE/scripts/migrate-school-pages.mjs" --validate-only)
  echo "[2/4] 安装学校精确 301、校验并重载 Nginx..."
  deploy_site_transaction_install_redirects "$DEPLOY_SOURCE/scripts/install-school-redirects.sh"
  deploy_site_transaction_commit
  # Environment provisioning/API restart are post-commit maintenance. An error
  # here is reported, without reverting frontend targets used by loaded 301s.
  if [ ! -f "$SITE_DIR/.env" ]; then
    touch "$SITE_DIR/.env"
  fi
  if ! grep -q '^REVIEW_ADMIN_TOKEN=' "$SITE_DIR/.env"; then
    REVIEW_TOKEN=$(node -e "console.log(require('crypto').randomBytes(12).toString('hex'))")
    echo "REVIEW_ADMIN_TOKEN=$REVIEW_TOKEN" >> "$SITE_DIR/.env"
    echo "已配置内容审核口令（不输出秘密值）"
  fi
  if ! grep -q '^CMS_ADMIN_PASSWORD=' "$SITE_DIR/.env"; then
    CMS_PASSWORD=$(grep '^REVIEW_ADMIN_TOKEN=' "$SITE_DIR/.env" | tail -1 | cut -d= -f2-)
    echo "CMS_ADMIN_PASSWORD=$CMS_PASSWORD" >> "$SITE_DIR/.env"
    echo "已配置 CMS 登录密码（不输出秘密值）"
  fi
  if ! grep -q '^CMS_SESSION_SECRET=' "$SITE_DIR/.env"; then
    CMS_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
    echo "CMS_SESSION_SECRET=$CMS_SECRET" >> "$SITE_DIR/.env"
  fi
  echo "[3/4] 重启 API 服务..."
  pm2 restart seda-api
  echo "✅ 更新完成！"
  exit 0
fi

if [ "$1" == "install-content-cron" ]; then
  echo "安装每日 SEO 草稿生产任务..."
  bash "$SITE_DIR/scripts/install-daily-drafts-cron.sh"
  echo "✅ 每日 09:00 自动生成待审核草稿已启用"
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
REVIEW_ADMIN_TOKEN=请改成内容审核口令
CMS_ADMIN_PASSWORD=请改成CMS登录密码
CMS_SESSION_SECRET=请改成随机会话密钥
PORT=3011
EOF
  echo "⚠️  请编辑 $SITE_DIR/.env 填入真实配置"
fi

echo "[6/9] 配置 Nginx..."
if [ -f /etc/nginx/sites-available/sgeda ]; then
  echo "保留已有 Nginx SSL/API 配置；已有站点请使用 deploy.sh update。"
else
  # Bootstrap only: never replace an existing production SSL/API configuration.
  echo "首次配置请先按 docs/school-database-deployment.md 准备生成的 include。"
  test -f /etc/nginx/snippets/school-redirects.nginx.conf
  cp "$SITE_DIR/nginx.conf" /etc/nginx/sites-available/sgeda
fi
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
