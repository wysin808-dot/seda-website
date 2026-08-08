# SEDA 新加坡择校网 (sgeda.org.cn)

面向中国家庭的新加坡择校/升学静态站。**核心原则：所有内容必须是静态/服务端渲染 HTML**——Baiduspider 和 AI 爬虫不执行 JS；任何 JS 客户端渲染的数据对它们不存在（教训：secondary-schools 的 146 所数据库曾因纯 JS 渲染对百度不可见，后改预渲染）。

## 部署

`git push origin main` → GitHub Actions 自动部署到阿里云 ECS（新加坡 43.98.175.239，git reset --hard + 运行 build-content.mjs 等）。**远端常有日更内容提交，push 被拒时 `git pull --rebase` 再推**。大陆流量走阿里云 CDN（CNAME 分线路：中国大陆→CDN，海外→源站直连；CDN 回源协议必须 HTTPS，否则 301 循环）。

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

## SEO/GEO 要点

- 死链清单：`dead-links.txt`（站根，百度站长已订阅，新死链追加进去即可）
- `verification.html`（阿里云 CDN 归属凭证）与谷歌验证文件**不可删除**
- 推送脚本 `scripts/baidu-submit.sh`：priority-urls.txt 非空=集中推清单，空=轮换 baidu-sitemap
- Let's Encrypt 证书（CDN 用）约 90 天续签：资料在 `~/.seda-certbot/`，HTTP-01 验证文件走 git 部署（见 certbot-auth-hook.sh）
