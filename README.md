# SEDA - Singapore Educational Development Association

SEDA 新加坡国际教育中心官网 (seda.org.sg)，最全面的中文新加坡留学资讯门户。

## 站点规模

- **170 个页面**，覆盖新加坡全部教育阶段
- 50 所小学、11 所中学、17 所 JC、7 所 Poly、8 所大学、7 所私立大学、6 所海外校区、16 所国际学校
- AEIS / O-Level / A-Level / IB / WACE 考试攻略
- 升学路径规划 + AI 工具

## 技术栈

- 纯静态 HTML + CSS + JS
- SEO: JSON-LD / sitemap.xml / canonical URL / meta description
- 部署: nginx (34.75.185.228)

## 本地预览

```bash
python3 -m http.server 8080
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
- 重新生成 `sitemap.xml`
- 加入 Article 与 Breadcrumb JSON-LD

每日选题可先放在 `content/keyword-queue.csv`。

## 部署

```bash
ssh user@34.75.185.228
cd /path/to/site
git pull origin main
```
