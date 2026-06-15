# SEDA 新加坡择校网

SEDA 新加坡择校网（sgeda.org.cn），面向中国家长的新加坡升学资讯、选校数据库与 SEO 内容平台。

## 站点规模

- **300+ 个页面**，覆盖新加坡主要教育阶段与学校数据库
- 50 所小学、11 所中学、17 所 JC、7 所 Poly、8 所大学、7 所私立大学、6 所海外校区、16 所国际学校
- AEIS / O-Level / A-Level / IB / WACE 考试攻略
- 升学路径规划 + AI 工具

## 技术栈

- 纯静态 HTML + CSS + JS
- SEO: JSON-LD / sitemap.xml / canonical URL / meta description
- 自托管 API: `server-selfhost.js`
- 部署: 阿里云国际版 ECS + nginx + PM2

## 本地预览

```bash
python3 -m http.server 8080
```

如需测试 AI 聊天、CMS 或内容审核 API，需要同时启动自托管 API：

```bash
PORT=3002 node server-selfhost.js
```

## SEO 内容生产

新建一篇长尾词草稿：

```bash
npm run content:new -- "WACE适合中国学生吗" -- --category=wace --categoryLabel="WACE 课程" --slug=wace-suitable-for-chinese-students
```

编辑 `content/articles/*.md`，把 `draft: true` 改成 `draft: false` 后生成静态页面：

```bash
npm run content:build
```

生成脚本会自动：

- 输出文章页面到 `/<category>/<slug>/index.html`
- 把文章卡片插入 `/news/`
- 把最新文章卡片插入首页
- 重新生成 `sitemap.xml`
- 加入 Article 与 Breadcrumb JSON-LD

每日选题可先放在 `content/keyword-queue.csv`。

自动生成 5 篇待审核 SEO 草稿：

```bash
npm run content:drafts -- --count=5
npm run content:build
```

生产规则：

- 只生成 `draft: true` 草稿，不会自动发布
- 草稿会进入 `/cms/` 的“待审核”
- 审核通过后才会生成正式文章页、更新首页、资讯页和 sitemap

服务器定时任务建议每天早上 9 点执行：

```bash
cd /var/www/sgeda && npm run content:drafts -- --count=5 && npm run content:build && pm2 restart seda-api --update-env
```

部署到 ECS 后，也可以直接安装定时任务：

```bash
bash /var/www/sgeda/deploy.sh install-content-cron
```

## CMS 内容后台

线上入口：

```text
https://sgeda.org.cn/cms/
```

CMS 登录密码来自服务器 `.env`：

```text
CMS_ADMIN_PASSWORD=...
```

## 部署

```bash
bash deploy.sh update
```
