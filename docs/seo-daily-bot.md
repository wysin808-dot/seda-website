# SEDA SEO Daily Bot

这个自动任务用于每天检查 `sgeda.org.cn` 的基础 SEO 状态，并在配置百度 token 后自动提交重点 URL。

## 每天做什么

- 读取 `sitemap.xml`，确认 sitemap URL 都有本地页面。
- 检查 title、description、h1、canonical、noindex、正文长度、图片数量和内链数量。
- 找出重复 title / description，优先暴露模板化风险。
- 检查重点页面线上是否能访问。
- 如果设置了 `BAIDU_TOKEN`，每天向百度普通收录接口提交一批重点 URL。
- 在 GitHub Actions Summary 和 artifact 里生成当天报告。

## GitHub Secrets

在 GitHub 仓库里进入 `Settings -> Secrets and variables -> Actions`，添加：

- `BAIDU_TOKEN`: 百度搜索资源平台给 `sgeda.org.cn` 的链接提交 token。

脚本默认站点是 `https://sgeda.org.cn`。如果以后换域名，再改 workflow 里的 `SITE` / `BAIDU_SITE`。

## 手动运行

```bash
npm run seo:daily
```

只检查、不提交百度：

```bash
SUBMIT_TO_BAIDU=false npm run seo:daily
```

本地生成的报告在：

```text
reports/seo-daily-report.md
```

## 重点 URL

脚本会优先读取：

```text
data/seo/priority-urls.txt
```

这里放刚改版、最想让百度重新抓的 URL。没有配置时，会自动使用首页、AEIS、SEC/O-Level、WACE、国际学校、学校库、大学、费用、学生准证等核心页面。

## 注意

这个 Bot 不能保证百度立刻收录，但它能稳定解决三件事：

- 百度每天能收到更新 URL。
- 我们每天知道站点有没有技术性拦截或重复模板风险。
- 页面改版后有固定流程，不再靠手动记。
