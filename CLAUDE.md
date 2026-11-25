# SEDA 新加坡择校网 (sgeda.org.cn)

面向中国家庭的新加坡择校/升学静态站。**核心原则：所有内容必须是静态/服务端渲染 HTML**——Baiduspider 和 AI 爬虫不执行 JS；任何 JS 客户端渲染的数据对它们不存在（教训：secondary-schools 的 146 所数据库曾因纯 JS 渲染对百度不可见，后改预渲染）。

## 部署

`git push origin main` → GitHub Actions 的 `deploy-aliyun.yml` 自动部署到**阿里云北京 ECS `8.141.10.184`**（cn-beijing，站点目录 `/var/www/sgeda`，SSH 密钥 `~/.ssh/sgeda_beijing`）。流程是 git reset --hard → 恢复 CMS 内容 → `npm ci` → **`npm test`** → `build-content.mjs` → `seo-check.mjs`。**`set -e`，任何一步失败整次部署中止**——2026-11-24 起就因为首页改版后测试没同步，连续十几次部署全挂，线上落后好几天；改测试或改内容后必须本地先跑 `npm test` + `npm run seo:check`。

**没有 CDN**：DNS 是 A 记录直连源站（无 CNAME、无分线路），源站在境内，百度/大陆访问直连即可。旧文档里的新加坡机 `43.98.175.239` 已弃用（证书过期），别再往那台部署。`nginx.conf` 只是仓库里的参照副本，实际生效的是服务器 `/etc/nginx/sites-available/sgeda-http`，部署不会覆盖它。

**远端常有日更内容提交，push 被拒时 `git pull --rebase` 再推**。

## 新建/重设计单页的「四件套」（必须遵守）

任何自定义页面（手工重设计的独立页）必须：

1. **标准页眉**：使用 `<header class="site-header">`（从 `index.html` 提取，不要自造 nav）+ 标准面包屑
2. **标准页脚**：`<footer class="site-footer">`（同样从 index.html 提取；页脚是全站单一事实源）
3. **全局资源**：`<link href="/seda-site.css?v=N">` + `<script src="/seda-site.js?v=N">`（版本号看现有页面）
4. **GA4 统计**：注入 `G-38WFES3WTH` 的 gtag 片段（搜 `SEDA_GA4_START` 参考）

已因缺这四件套返工过三次：student-pass、accommodation、jc。

### 面包屑已知坑（每个自定义页都会踩）

全局 `seda-site.css` 的 `.breadcrumb` 是 `display:flex` 且带 `::before` 红色装饰条。自定义页把面包屑文字包进 `.container` 后会出现：①容器被 flex 收缩居中 ②红条孤立漂在最左。页内加两行修复：

```css
nav.breadcrumb{display:block}
.breadcrumb::before{content:none!important;display:none!important}
```

## 防覆盖机制

- 文章类：frontmatter 加 `custom: true` → `build-content.mjs` 跳过不覆盖
- 独立页：页内加 `<!-- SEDA_CUSTOM_PAGE -->` 标记 + 在构建脚本排除清单里登记
- `enhance-key-seo-pages.mjs` 会给清单内页面注入 JSON-LD——完全手工的页面（如 /wace/）必须从其清单排除，避免重复 schema

## 数据与内容原则

- **真实数据，不灌水**：录取分/学费/政策必须有官方来源；没有逐专业分数线时用大类真实门槛并注明（参考 NUS BBA 处理方式）
- 数据年份保鲜是护城河命脉：poly ELR2B2（每年 1 月 JAE 后刷新）、secondary-schools COP（每年 12-1 月放榜后刷新）、JC L1R5
- 不同类型数据库（poly/公立/私立/国际）不互相交叉链接混淆定位
- robots.txt 故意屏蔽了模板化学校子页（防低质惩罚）；去模板化一批才解封一批
- **robots 白名单与 `data/seo/baidu-priority-urls.txt` 是同一个事实源**：清单里的 URL 即使位于模板前缀下，`build-content.mjs` 也会自动 `Allow`。想让百度抓某页，加进清单即可，不要再手写 Allow
- **`sitemap.xml` 只给 Google，`robots.txt` 里只声明 `baidu-sitemap.xml`**：前者是 653 条全量，其中约 391 条对 Baiduspider 是屏蔽的，再交给百度就等于喂它一份自相矛盾的地图

## SEO/GEO 要点

- 死链清单：`dead-links.txt`（站根，百度站长已订阅，新死链追加进去即可）
- `verification.html`（阿里云 CDN 归属凭证）与谷歌验证文件**不可删除**
- 百度主动推送走 **GitHub Actions `baidu-push.yml`**（每日一次，读 `baidu-sitemap.xml`，配额不足自动减半）。`scripts/baidu-submit.sh` 是**故意禁用**的兼容壳（`tests/baidu-submission-disabled.test.mjs` 守着它），别在里面恢复推送逻辑
- 主机名：`www.sgeda.org.cn` 和 80 端口一律 301 到 `https://sgeda.org.cn`；旧草稿 URL 用 nginx `location =` 做 301，别留 404
- Let's Encrypt 证书（CDN 用）约 90 天续签：资料在 `~/.seda-certbot/`，HTTP-01 验证文件走 git 部署（见 certbot-auth-hook.sh）
