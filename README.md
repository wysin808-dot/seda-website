# SEDA 新加坡国际教育中心

`seda.org.sg` 中文新加坡留学资讯门户，承接 SEO 流量。

## 部署

- **GitHub Pages**：`wysin808-dot.github.io/seda-website/`
- **Vercel**：`edu-mvp-crm.vercel.app`

## 内容覆盖

- 5 大考试体系：WACE / O-Level / A-Level / AEIS / IB
- 3 类学校对比：政府 / 私立 / 国际学校
- 25+ 深度攻略页（3,000-5,000 字）
- AI 工具：大学匹配器（163 专业 × 6 大学）、升学规划器

## 本地预览

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

## 同步到 GitHub Pages

```bash
node scripts/build-seda-github-pages-multipage.mjs
cd seda-github-pages && git add -A && git commit -m "Sync" && git push origin gh-pages
```

## 文件结构

```
index.html          SEDA 首页
seda-site.css       样式
seda-site.js        交互逻辑
sitemap.xml         SEO 站点地图
vercel.json         Vercel 配置
pathway/            升学路径 + AI 工具
  university-matcher/   AI 大学匹配
  study-planner/        AI 升学规划
aeis/               AEIS 考试（含 7 个子页面）
o-level/            O-Level（含 4 个子页面）
wace/               WACE 课程
guides/             留学指南
...                 其他内容目录
```
