# 学校数据库 URL 迁移与 Nginx 部署

此改动在独立修复分支完成；**当前不连接生产、不执行部署、不触发工作流、不合并 main**。只有用户另行批准上线后才执行本文生产命令。生产目录是 `/var/www/sgeda`，已有站点配置是 `/etc/nginx/sites-available/sgeda`，由 `/etc/nginx/sites-enabled/sgeda` 加载。不要将仓库 `nginx.conf` 覆盖到已有站点：真实 SSL、analytics 和 API 代理必须保留。仓库模板只增加了学校 include 的定位。

## 迁移模型与生成

数据由 `scripts/school-catalog.mjs` 的 `loadCatalog(root)` / `loadCatalogPolicy(root)` 读取，迁移器不生成或修改学校事实源和政策 JSON。policy 精确列出 `from/to/recordId`；普通学校目标为本类别路径加 `#school-<recordId>`，充实详情别名目标为该校保留的 `detailUrl`。目录、保留详情以及不在对应学校 `legacyUrls` 中的政策文章不能成为迁移来源。重复冲突、外链、非安全 ASCII 路径、自跳转和链/循环一律拒绝。

`migrateSchoolPages(root)` 默认校验目标并同步内链，无 import 写入行为。构建必须先生成学校库及七分类，再执行其他可能装饰 HTML 的公共处理，最后调用迁移，随后生成地图；不能在迁移之后再把统计、公共页脚或旧模板写回兼容页。兼容页保留旧文件，不删除目录，标有 `<!-- SEDA_SCHOOL_REDIRECT -->`，包含校名、迁移链接、`noindex,follow` 和不带片段的目标 canonical。meta refresh 只是无 Nginx 环境下的兼容方式，**不等于 HTTP 301**。

迁移同时产生 `data/seo/school-redirects.nginx.conf`：每个精确旧 URL 有 slash、去 slash、`index.html` 三条 `location =`，目标 `return 301` 使用完整带引号的 HTTPS URL，保留学校片段。不要删除引号，Nginx 会把未引用的 `#` 当成注释。没有新增按学校栏目泛匹配的重定向，也没有首页兜底。Nginx 的固定 canonical 跳转不保留旧请求查询；站内引用更新则保留原有 query，学校稳定片段优先于旧 section/schema 片段，目标不会出现双 hash。保留详情目标可继续携带原 section。

内链更新只匹配 root-relative 或 HTTP(S) 本域/`www` 本域的精确旧学校 URL，更新 `href`、`onclick`、JS 精确字符串和 JSON-LD 的 URL/@id/ItemList 引用。学校名称和文本不改，无关外链/其他学校路径不改，HTML 不作整页 DOM 序列化。跳过兼容页、8 个新学校库 HTML、新学校库 JS 以及 `.git/.github/node_modules/content/data/scripts/tests/docs/reports` 等工程维护目录。

### 本地 staging 与最终验真

纯 fixtures 可传入 `{ policy, catalog, validateTargets: false }`，或者使用 `--skip-target-validation`；这是初期 UI 尚未生成时的显式选项，不能用于最终上线。`--dry-run` 不写文件。默认 final build 必须确认所有真实目标文件存在且不为兼容页/noindex，分类目标片段 ID 存在。

```bash
# 主代理统一整合后运行；不要与数据导入/前台生成并发覆盖旧 HTML。
node scripts/build-content.mjs
# 只验证最终目标，不再写旧页或重写内链。
node scripts/migrate-school-pages.mjs --validate-only
node scripts/seo-check.mjs
node --test tests/school-migration.test.mjs
```

如需独立生成，构建全部真实目标后运行 `node scripts/migrate-school-pages.mjs`；默认既验真又改写精确内链。可选 `--skip-reference-rewrite` 仅在明确单独执行引用更新时使用。`validateSchoolMigrationTargets(root, options)` 是只读 late validator，`rewriteSchoolReferences(root, options)` 可单独使用；两者也接受 fixture 的 `{policy,catalog}`。

## 安装器的前置检查与事务

`bash scripts/install-school-redirects.sh` 不连接远端、不改 SSL/API、不把仓库模板覆盖生产。需 Python 3、已有 `/etc/nginx/snippets` 目录、真实站点 `index.html`、已启用且指向准确 sites-available 文件的站点配置。它寻找**唯一**满足 `server_name sgeda.org.cn`、`listen 443 ssl`、精确 `root /var/www/sgeda` 的 server 块，在 server 作用域安装以下管理段：

```nginx
# BEGIN SEDA_SCHOOL_REDIRECT_INCLUDE
include /etc/nginx/snippets/school-redirects.nginx.conf;
# END SEDA_SCHOOL_REDIRECT_INCLUDE
```

先严格检查生成 include 的 ASCII 精确规则，然后原子写入 include 和管理段。只改变此管理段，其余现有配置按原始字节保留。接着执行 `nginx -t`，再用 `nginx -T` 证明 sites-enabled/available 及生成 include 确实被 Nginx 加载，全部成功后才 `systemctl reload nginx`。任一步失败，恢复原配置与原 include 或删除新建 include，退出非 0；`nginx -t/-T` 失败时绝不 reload。reload 自身失败时也恢复磁盘文件且不报成功，操作人须检查服务状态与日志。未在 sites-enabled 写任何备份，不会因通配加载而引入重复 server。重复安装相同规则不重复 include、不重复 reload；即便先前进程状态不明，批准上线前仍应独立检查服务状态和 `nginx -t`。

非生产路径必须显式 `--test-mode`，测试模式对 `--config`、`--enabled-config`、`--include-path`、`--site-root` 四条路径都进行解析保护：禁止默认/等价生产路径，以及真实 `/etc/nginx/` 和 `/var/www/sgeda/` 子路径，包含符号链接等价路径。fixture 参数还包括 `--source`、`--nginx-bin`、`--reload-bin`；可使用假命令验证顺序和失败恢复，无需 root。`--dry-run` 展示候选配置，不写文件、不运行 Nginx、不 reload。生产默认路径不能使用 fixture 模式规避实际载入证明。

## 用户批准后的部署顺序

**自动部署接线已保存，尚未合并或上线。** 用户补充对应仓库的工作流权限后，`.github/workflows/deploy-aliyun.yml` 已按批准补丁更新并保存至修复分支，提交 `a3657420bb7ef15c1c03830bb0c6d23c239dbb57`；远端文件与本地逐字匹配。自动流程已接入学校301安装器，原Aliyun密钥引用、CMS保护与SSL/API设置保留。`docs/deploy-aliyun-workflow.patch` 仅保留历史差异，已应用，不要重复执行；构建或部署脚本不会自动应用补丁。接线完成不等于真实服务器已经加载规则，仍须另行取得用户上线批准。

工作流仅由 main push 触发，`workflow_dispatch` 已移除；当前修复分支push不会触发该部署工作流，本轮不调用部署。**获得新的上线批准后**，远端顺序为：保留 CMS 内容，更新 main，恢复 CMS，`npm ci`、完整构建、测试最终产物、迁移只读late validator、SEO 检查，随后运行同一 include 安装器，成功后再执行现有提交/cron/API 步骤。新增校验与安装命令均未忽略失败；原IndexNow容错不变。任一校验或安装失败，不得声称上线成功。本次10项YAML/顺序/Bash/受保护配置定点检查及独立只读复核通过，392迁移目标验证通过，SEO265页0错误；未连接生产或运行安装器。

手动 `bash deploy.sh update` 也先构建/测试/验真/SEO；若使用独立 `/var/www/seda-website` 源目录，先在源目录构建，再同步静态文件到 `/var/www/sgeda`，用当前源目录的安装器安装实际服务目录中的生成 include。原 bootstrap 模板只允许在不存在真实配置时复制，已有配置不覆盖；本文不授权新服务器初始化。

生产执行前建议人工留存真实配置和 include 到 **sites-enabled 之外** 的受限备份目录；不要把含凭证或服务器私密配置提交 Git。确认前置条件后：

```bash
cd /var/www/sgeda
# 无写入预览；需要能读取现有配置。
bash scripts/install-school-redirects.sh --dry-run
# 仅在用户批准、构建和 SEO 成功后执行（需相应系统权限）。
bash scripts/install-school-redirects.sh --source /var/www/sgeda/data/seo/school-redirects.nginx.conf
```

上线后对普通学校及同校别名的 slash、无 slash、index.html 原 URL 请求确认真正的 **HTTP 301** 与 Location；对带学校片段目标确认 200 原始 HTML 包含匹配 ID；对保留详情、目录和政策文章确认不被误跳转。浏览器不会将 fragment 发送给服务器，需同时查看 Location 与目标 HTML。HTTP/www 的既有全站 HTTPS 主域规范化可能先产生原有额外跳转，不应改动现有 TLS 拓扑冒充所有入口都单跳；主域 HTTPS 学校旧 URL 应直接一跳到真实目标。父代理负责本地实际 Nginx/HTTP 集成验收，fixtures 只证明规则与安装事务，不单凭 meta refresh 声称线上已生效。

## 回滚与撤下学校规则

撤下规则不是删除兼容页。用户批准回滚后先用只读预览，再移除管理段及生成 include：

```bash
cd /var/www/sgeda
bash scripts/install-school-redirects.sh --remove --dry-run
bash scripts/install-school-redirects.sh --remove
```

移除同样先 `nginx -t/-T` 后 reload，失败恢复原磁盘配置与规则。撤下后旧 URL 会暂时返回兼容 HTML（通常 HTTP 200 + noindex + meta refresh），**不再有学校 Nginx 301**。若要完整回滚学校改版，应同时按批准的历史版本恢复旧内容、数据库生成及地图/抓取配置，避免只撤 include 却误称恢复旧索引行为。要恢复上一版精确规则，可将可信历史 generated include 作为 `--source` 再安装；不覆盖其他 live server 设置。
