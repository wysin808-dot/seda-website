# SEDA 学校数据库改版与抓取策略 · 2026-11-26

用户已明确同意按照“集中学校库＋静态分类页＋少量充实详情”实施。沿用现有GitHub仓库、阿里云、中文SEDA品牌及静态HTML架构，不初始化新的托管站，不引入SQL/后台重构或新的内容采集。当前独立修复分支承接第二批未上线改动；完成后保存PR，不自动合并main或部署。

## 产品与设计

参考用户提供的 https://www.vasteredu.cn/schools/ 左侧校名列表、右侧资料面板，采用SEDA现有红色、暖白、中文字体与品牌字标。学校库以搜索和类别导航为主，不使用排行榜、推荐分数和无年份收费范围。桌面为列表＋资料，手机以搜索、列表和选中资料上下呈现；不新增装饰性照片或仿制参考站logo。

原始HTML直接输出学校名称及已有类型、区域、课程、合法官网链接和真实现有专业/入学列表；JS只增强搜索、筛选与同页选择，不通过接口才能读取资料。无JS仍可查校和阅读，深链接用稳定片段ID选中学校。所有中文学校名称沿用真实已有记录，BCI记录显示为BCI，不更改SEDA品牌。

学校库主入口 `/school-database/`。静态分类页复用 `/primary-schools/`、`/secondary-schools/`、`/international-school/schools/`、`/private-schools/`；新增 `/school-database/jc/`、`/school-database/poly/`、`/school-database/university/`，保留已有JC/Poly/大学政策指南原URL。分类页有自身标题、描述和canonical，不为筛选状态另造页面。

只保留已有明确充实的学校详情：光华、16所JC、5所Poly和7所公立/艺术大学，以及已有独立私立大学院校资料页。不能用customContent标记、字数或模板篇幅自动认定质量；华侨/莱佛士中学的短旧模板仍应集中到库，而其JC详情不受影响。无需为每条资料创建独立文章。

## 数据与实现

`content/schools/database.json`：学校记录唯一事实源，数组结构；由既有350条记录、小学179/中学146目录及已有真实学校实体补全一次，再独立维护，不在每次构建重新读取迁移后的旧HTML。字段：id、category、nameZh、nameEn、location、schoolType、curriculum、website、majorAreas、admissionPaths、detailUrl、legacyUrls。字段缺失留空，不猜官网，不复制参考站学费、成绩或特色；清除Tier/COP、宣传判断和旧套话。

`content/schools/database-policy.json`：{version:1,categories:[{id,label,route}],retainedDetails:[...paths],redirects:[{from,to,recordId}]}。固定类别 primary/secondary/international/private/jc/poly/university；artsUniversity归大学分类。学校记录id为稳定ASCII slug；片段ID `school-${id}`。普通记录链接为类别route＋片段，已有充实详情可保留detailUrl。迁移from均为现有准确旧URL且不含查询/片段；to为现有详情或学校记录片段。别名只有确认同校才合并，不把不同学段或不同学校合并。

`scripts/school-catalog.mjs`：数据读取、验证、类别与学校目标纯函数，禁止import时写仓库。

`scripts/build-school-database.mjs`：渲染主入口和7分类；`assets/school-database.css/js`：界面与渐进增强。保留共享header/footer、正常统计、联系入口；不要恢复来源/核实日期大块。CollectionPage/ItemList仅描述实际学校记录，不补通用FAQ。

已有CMS的只读学校覆盖概览同步读取新库，依据实际分类页中的稳定学校片段与分类canonical地图入口统计记录；不能继续用350条旧源或要求每校独立详情。界面明确区分“学校记录”与“地图覆盖记录”，不把记录数当独立索引页数；不新增后台写接口、SQL或权限功能。

`scripts/migrate-school-pages.mjs`：依据精确policy生成旧页安全兼容HTML和Nginx精确301 include；旧页标记 `SEDA_SCHOOL_REDIRECT`，noindex且移出地图。不以meta刷新或JS跳转冒充HTTP301。覆盖slash、无slash及index.html旧URL形式，不重定向保留详情、政策文章或目录。站内HTML/已有JS/结构化链接定向更新到学校目标，不能误改不同学校或共享导航。兼容HTML保留，便于不支持Nginx的环境继续访问，不在上线前直接删文件。

## 抓取与部署

已迁移学校URL允许被百度抓取以读取301；后台、内容审核与API继续限制。新学校库、分类页、充实详情和正常公开文章允许抓取。不一次性解除仍存在的薄详情限制，不能仅凭允许抓取承诺收录。一般sitemap仅含可索引、200的活跃canonical页面；百度精选清单纳入学校库和分类入口，剔除301/noindex/缺失目标，lastmod跟随实际内容变化。

构建顺序显式保证旧学校生成器不再生产已迁移模板，旧静态名单脚本不把迁移兼容页重新列入独立详情。先等待八个学校库生成，再维护正常页面的共享布局、元数据和统计；最后等待精确内链改写与兼容页迁移及目标校验完成，才放开公开抓取并生成地图。来源记录对迁移页只做归档维护，不恢复旧Article实体；重复构建不能恢复旧模板或造成片段漂移。

现有`.github/workflows/deploy-aliyun.yml`的main自动部署在以后用户批准上线时需先构建，再安装生成的Nginx重定向include，执行nginx -t后才reload，失败不得声称上线成功；不替换不相关的服务器SSL/API配置。当前只修改部署代码和本地验收，不连接生产或触发workflow。

## 项目结构

- `content/schools/`：原始旧资料与新学校库维护记录、精确迁移策略。
- `scripts/`：学校库纯模型、静态生成、精确迁移和既有内容构建/SEO逻辑。
- `assets/`：仅学校库样式和无接口依赖的交互。
- 学校库及既有各分类目录：生成的可抓取中文HTML；充实详情保持既有路径。
- `data/seo/`：活跃地图日期、精选入口和生成的Nginx迁移规则。
- `tests/`：真实记录覆盖、无JS内容、筛选/深链接、单跳301及地图权限一致性回归。
- `docs/`：后续阿里云上线与回滚注意事项，不包含凭证。

## 本次复查残留修复（2026-11-26 14:19 用户已批准）

修复科廷FAQ串用其他大学实体及10所私立院校共用未经逐校核实的招生/雅思答案。采用撤掉无独立可靠依据的通用FAQ方式，不换词补模板，不猜各校门槛；保留学校概况、合作大学、专业和已有资料。可见内容、FAQ结构化数据与旧手动生成器同步清理，常规构建不恢复。

旧 `aeis_backup/index.html` 从公开站点移除，原文留Git历史及站点目录外审计归档；不删除Google等合法验证文件。阻止该备份重新进入构建/发布产物，地图继续只包含正式页面。原备份不是学校迁移URL，不改392条迁移策略，不虚增学校301规则。只保存当前修复分支与PR；不修改受限GitHub工作流、不合并main、不连接生产、不自动提交百度。
