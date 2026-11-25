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

## 内容页版式变体（拆模板感）

全站页面原本共用一套骨架（大图 hero + 6~8 个 H2 + 常见问题 + 同一个 CTA），
百度按模板站处理。`seda-content.css` 提供三种版式，**新页面按用途选一种，不要都用同一种**：

| 变体 | 用在 | 特征 |
| --- | --- | --- |
| `cp-hero--light` | 数据页：题量结构、录取分、费用对照 | 白底细线 hero，不放背景图，正文直接进表格 |
| `cp-hero--split` | 指南页：备考、申请流程 | 左标题右要点卡，第一屏说清三条关键结论 |
| 默认大图 hero | 栏目落地页 | 保留视觉冲击，一个栏目只用一次 |

配套组件：
- `.cp-data-strip` + `.cp-stat`：hero 下方 2~3 个关键数字，数据页专用
- `.cp-cta-inline`：紧凑 CTA，替代整块 `contact-section`；参考页（纯查数据）可以不放 CTA
- 页面要 `<link rel="stylesheet" href="/seda-content.css?v=1">`（跟在 seda-site.css 后面）

判断标准：**同一栏目下的 4 个页面，hero 不应该长得都一样。**

### CTA 的密度规则

整块咨询卡（红色按钮 + 微信二维码 + 三行说明）原本铺在 477 个页面底部，
是全站最显眼的同质化元素。现在由 `scripts/soften-page-cta.mjs` 在构建时处理：

- **保留整块 CTA**：首页、`/contact/`、以及各栏目落地页（见脚本里的 `KEEP` 集合）
- **其余内容页**：降级成一行 `.cp-soft-cta` 文字链接，按栏目给不同话术
- 新页面默认会被软化；确实需要整块 CTA 的，把它加进 `KEEP`

判断标准：**同一个 CTA 视觉块，不应该在用户连续浏览的三个页面里出现三次。**

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

### 旧站 URL 重定向表

2022–2025 的旧站用过编号详情页，百度索引里残留的很可能就是这批地址。nginx 已全部映射：

| 旧地址 | 现在 |
| --- | --- |
| `/school/detail/N` | 301 → `/school-database/` |
| `/pages/detail/N` | 301 → `/pathway/` |
| `/project`、`/project/*` | 301 → `/pathway/` |
| `/news/detail/N` | 301 → `/news/` |
| `/feedback` | 301 → `/contact/` |
| `/attach/image/*` | 410（旧图已删，明确告知） |

### 抓取体检

`scripts/baidu-crawl-audit.sh` 在服务器上运行，读 nginx 日志、双向 DNS 验证蜘蛛、
统计「接口 / 静态资源 / HTML」的配额占比和核心页覆盖情况。

```bash
ssh root@8.141.10.184 'bash /var/www/sgeda/scripts/baidu-crawl-audit.sh 7'
```

2026-11-25 基线：14 天 558 次 GET，其中 168 次打 `/api/config`，只抓到 96 个 HTML 页面，
`/aeis/` 0 次。修掉接口请求和筛选态 URL 后，这个脚本用来验证配额是否真的转向 HTML。

## 百度搜索作战计划

`docs/seo-plan-2026-12.md` 是当前唯一的方向文件，`data/seo/target-keywords.csv` 是目标词表。

核心判断（2026-11-25 核查推翻旧假设）：

- 索引 **80 页**、30 天 **0 展现** → 收录不是瓶颈，排名才是
- 抓取 7 页/天、96 个唯一 HTML → 新页面进不了队列
- 因此**停止逐页改内容**，只打 10 个目标词；不再扩页面数

执行分工：页面/数据/结构化归我，站长平台与百家号归运营。
每周跑 `scripts/baidu-crawl-audit.sh` 看抓取结构是否改善。

### 月度政策核对

`scripts/policy-check.mjs` 每月 1 号由 `.github/workflows/policy-check.yml` 自动跑：

- 遍历 `content/sources.json` 里 26 条官方来源，检查是否仍返回 200
- 断言 5 个会被政策改动的数字：学生准证受理费 S$45、JC 的 L1R4 ≤16、
  AEIS 在 9 月、S-AEIS 1 月报名、SEC 已取代 O-Level

任一失败即 workflow 失败（GitHub 会邮件提醒），并在失败信息里写清「该改哪一页」。

背景：2026-11 这轮重写每改一页都能抓到一处过期事实（AEIS 小学英文卷、
L1R5、受理费 S$30、时间表停在 2025-2026）。页面写得很完整，但没人跟政策走。

## SEO/GEO 要点

- 死链清单：`dead-links.txt`（站根，百度站长已订阅，新死链追加进去即可）
- `verification.html`（阿里云 CDN 归属凭证）与谷歌验证文件**不可删除**
- 百度主动推送走 **GitHub Actions `baidu-push.yml`**（每日一次，读 `baidu-sitemap.xml`，配额不足自动减半）。`scripts/baidu-submit.sh` 是**故意禁用**的兼容壳（`tests/baidu-submission-disabled.test.mjs` 守着它），别在里面恢复推送逻辑
- 主机名：`www.sgeda.org.cn` 和 80 端口一律 301 到 `https://sgeda.org.cn`；旧草稿 URL 用 nginx `location =` 做 301，别留 404
- Let's Encrypt 证书（CDN 用）约 90 天续签：资料在 `~/.seda-certbot/`，HTTP-01 验证文件走 git 部署（见 certbot-auth-hook.sh）
