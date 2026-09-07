# SEDA SEO Daily Bot

## 检查与提交

GitHub Actions 的 `seo-daily.yml` 是百度提交的唯一执行入口。服务器上的 `seo:submit` 保留为兼容入口，只调用 IndexNow；CMS 发布的新页面通过更新的百度地图进入下一次百度日更队列。

每日读取生产站点的 `sitemap.xml`、`baidu-sitemap.xml` 和 `robots.txt`，检查所有允许百度抓取的 HTML、标题、描述、H1、canonical、noindex、重复标题和描述，以及真实 DOM 中的站内链接与图片。脚本字符串中的 HTML 不作为可见链接统计。每日 JSON 报告保留完整检查结果，Markdown 汇总列出问题和实际提交 URL。

`BAIDU_TOKEN` 仅从 GitHub Secrets 提供，不写入脚本。主动提交必须设置 `SUBMIT_TO_BAIDU=true`，本地默认只读。

每次最多提交 5 个健康页面：优先实质修改页、新页面，再到距成功提交已超过 30 天的页面。文章使用明确的修改日期；已接受且未变化的内容不会每天重复推送。优先清单仍支持手动排序，但不能绕过质量检查或重复提交限制。

状态保存在 `data/seo/baidu-state.json`，由 Actions cache 跨运行恢复。队列记录仅在百度确认整批接受后更新；失败、超配额、无法确定具体 URL 的部分成功均保留重试。缓存被平台清理时会重新发现页面，因此应保留原始运行报告用于追踪。

`remain=0, success=5` 表示 5 条成功且剩余额度为 0。它不同于 over quota 错误。提交记录不能证明索引量、展现或点击增长，这些指标仍以百度搜索资源平台为准。

## 本地验证

```bash
npm ci
npm test
npm run content:build
npm run seo:check
SUBMIT_TO_BAIDU=false npm run seo:daily
```

`seo:check` 检查生成文件与百度地图；`seo:daily` 检查线上生产内容。修改本地代码不会改变线上检查结果。

## 内容发布

同一 URL 有草稿和已发布文章时，草稿不删除正式页面；两个已发布文件使用相同 URL 时拒绝构建。已发布的自定义文章如果 HTML 尚不存在，会从文章内容首次生成；已存在的自定义页面保持保护。

历史修复清单位于 `data/seo/legacy-content-repairs.json`。已确认的 URL 别名指向正确文章，尚未发布的引用显示为普通文字，历史缺失配图不输出损坏的图片标签。新出现的未知死链和缺图会中止发布构建，不能以补几个 img 标签通过检查。

每次构建同步生成百度地图，沿用现有 robots 屏蔽策略。验证文件、备份目录和 noindex 页面不进入地图。内容哈希与修改日期记录在服务器 `data/seo/page-updates.json`，避免仅因重建而每天刷新所有页面的 lastmod。

生产部署在 CMS 备份与仓库修复之间执行三方合并，再安装依赖、测试、构建与校验。同一段内容冲突时停止并保留服务器备份，不自动覆盖团队修改。

## 报告位置

- `reports/seo-daily-report.md`
- `reports/seo-daily-report.json`
- GitHub Actions Summary 和 `seo-daily-report` artifact

检测到问题或百度提交失败时任务失败，但仍上传诊断报告。生产监测只能排除技术性障碍，不能保证百度收录或搜索排名。
