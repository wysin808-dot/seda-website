# SEDA 独立SEO发布包 · 2026-11-26

用户20:36要求按建议拆分并重新检查上线。本目录是从已上线基线`dcaa91e665fe8dbff42f7d66f94e58ba69bbbfc3`建立的独立本地副本，不覆盖`/home/ubuntu/seda-website`中的14篇待审稿或其他内容候选。

## 本包范围

仅包含11个入口的搜索title、description、keywords、必要H1及稳定实体ID；Article/重点目录的组织与网站引用接线；大学海外栏目静态入口；News完整分类目录、原发表日期排序与独立CSS/JS。沿用原静态HTML、品牌和自托管部署架构，不初始化托管站。

OG/Twitter不新增、不自动维护或强制检查。既有标签和微信二维码/微信号/联系入口保持，不接公众号SDK。

## 明确不纳入

所有文章Markdown和来源登记均使用已上线基线，包括14篇修订对应的旧稿。未发布的新研究提纲、公共文章去模板、推荐/摘要模块撤除、草稿生成器和SEO评分器改动不在本包；原候选中的这些修改仍完整保留待后续审阅。

构建脚本按功能片段选择，只添加News生成、实体ID与两个晚阶段SEO同步接线，不整文件复制混合改动。News外壳复用新目录，但文章列表和ItemList重新从旧稿生成，其他文章页、feeds/RSS/llms、地图及审核页由本包真实重新生成，避免待审修订泄漏。

## 项目结构与不变边界

`content/seo-entry-pages.json`为11入口唯一SEO配置；`scripts/sync-entry-seo.mjs`与`sync-foreign-university-entry.mjs`为静态后处理；`scripts/render-news-index.mjs`为纯分类生成；`news/news.css/js`仅增强资讯目录；`tests/`保留基线测试并增加相关SEO/分类/隔离保护。

学校库、301、Gitguard、SSL/API、robots、工作流和共享布局不改；依赖仅有下述安装验收发现的兼容锁文件安全更新例外。独立副本不含原候选待审内容修改，不修改或降低现有内容评分。截至21:04仅完成拆包、本地构建与验收；用户21:06明确要求“上线 然后提交给百度”，当前允许通过独立GitHub集成保存新分支fix/seo-entry-news-20261126及其一个新PR，在最新main和最终head核对、保护条件满足后合并，触发原阿里云部署。生产部署与安全/公开页面验证成功后，再按实际百度配额提交公开可索引URL。不得复用旧PR5限定凭证、改工作流、访问Secrets、强推、绕过保护或重跑/dispatch旧部署。

## 安装验收发现的兼容安全补丁

真实npm ci/npm audit发现已上线基线锁文件含undici传递依赖高风险和fast-xml-parser低风险告警。本包额外允许仅在既有package.json版本范围内更新这两个依赖及其必要传递依赖的锁定版本，Undici保持7.x、XML解析器保持5.x，不新增直接依赖、不升级大版本、不改评分/工作流/SSL/API源码；原候选的package-lock.json保持不动。实际为Undici 7.30.2与XML解析器5.12.1；后者明确要求entities 3.1.0、builder 1.3.2、is-unsafe 2.0.3与strnum 2.5.1，额外四项没有超出该依赖链。修复版本已核对官方公告与npm元数据，新npm audit为0；仍须从新锁文件重新npm ci、构建及验收。此项为检查中发现的安全修复，不把既有依赖告警当作已修复或简单忽略。
