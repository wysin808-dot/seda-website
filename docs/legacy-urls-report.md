# 旧站 URL 状态核查报告（2026-11-25）

## 用途

百度 `site:sgeda.org.cn` 目前只剩 1 条结果，且指向已下线的 `test.sgeda.org.cn`。
索引库里大概率存的是 2022–2025 旧站的地址。本报告证明：**所有旧地址现在都有明确归宿**，
可随站长平台「死链提交」与站点申诉一并提交。

## 结果

共核查 **217** 个旧地址（2026-11-25 实测）：

| 状态 | 数量 | 含义 |
| --- | --- | --- |
| 301 | 206 | 已永久跳转到对应新页面 |
| 410 | 11 | 内容已下线，明确告知删除（旧图片、旧 CMS 路径） |
| 404 | 0 | — |

## 映射规则

| 旧地址 | 现在 |
| --- | --- |
| `/school/detail/N`（N=1–130） | 301 → `/school-database/` |
| `/pages/detail/N`（N=1–24） | 301 → `/pathway/` |
| `/news/detail/N`（N=1–40） | 301 → `/news/` |
| `/project`、`/project/detail/N`、`/project/list/N` | 301 → `/pathway/` |
| `/feedback` | 301 → `/contact/` |
| `/a/*`（旧 CMS：product/contact/about/member/student/news） | 410 |
| `/attach/image/*`（旧站图片） | 410 |

## 提交建议

1. 站长平台 → 死链提交：粘贴 `reports/legacy-urls.csv` 中 status 为 `410` 的地址
2. 站长平台 → 站点反馈：附本报告，说明旧站已整体改版、旧 URL 全部 301/410、测试子域已下线
3. 同时提交 `test.sgeda.org.cn`（DNS 已不解析）

明细见 `reports/legacy-urls.csv`（217 行，含每个地址的实时状态与跳转目标）。
