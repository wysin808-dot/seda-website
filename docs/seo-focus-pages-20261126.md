# 五个核心页面内容复核（2026-11-26）

## 目标与边界

保留 URL 与现有设计，纠正事实错误，让每页集中回答一个可验证的家长问题。不是承诺百度排名、展现或点击，也不能把推送成功视为收录。

上一次后台核查（2026-11-25）记录：索引量最新数据为 11 月 23 日的 80；PC 近 30 天展现和点击为 0，移动图表也为 0。本次没有重新读取百度后台，以上不是 11 月 26 日的实时数值。真实蜘蛛抓取及索引存在，因此不能继续把问题描述为整站完全未收录。

## 本次变更

| URL | 主要意图（候选词，不代表已验证搜索量） | 修复与补充 |
| --- | --- | --- |
| /aeis/age-requirements/ | AEIS 年龄要求、2027 入学年级 | 删除错误的考试年年龄计算、旧出生日期表和无依据竞争排名；改用官方查询步骤、演示结果及年级/CEQ 表 |
| /aeis/english/ | AEIS 英语、CEQ 多少分 | 小学 CEQ 与中学卷分开；补 100/120/130/140 分对应考试类型、成绩日期例子；删未经验证学生统计；练习时间合计 130 分钟 |
| /o-level/ | 2027 SEC、O-Level 区别、2028 JC | 顶部对照考试与入学年份、L1R5/L1R4 和 G3；增加 PSE 转换提醒；删除跨学段课程主观打分 |
| /wace-nus-ntu/ | WACE 申请 NUS/NTU、ATAR 90/95 | 删除无依据专业分数线及案例；按两校原文区分外国申请人最低条件、最终成绩和英文要求；消除重复 FAQ |
| /guides/cost/ | 新加坡留学一年费用、政府学校学费 | 明确 2026 非东盟国际学生身份与杂费；加入全年演算及不包含项目；不冒充 2027 报价 |

同时更新页面标题、描述、社交元数据、FAQ 与可见内容、来源和核对日期；将三篇人工复核页加入构建保护。WACE 专题从旧增强脚本中移除，防止再次插入重复问答。

手机检查同时修正年龄页多余的容器嵌套，消除整页横向溢出；删除该页旧的错误联系方式，统一进入现用联系页。英文页补齐咨询按钮的目标锚点，WACE 专题增加联系页入口。

## 证据

- MOE 年龄查询器：https://www.moe.gov.sg/international-students/aeis/eligibility-criteria
  - 浏览器手工验证演示输入：2019-06-15 出生、2027 入学，返回 Pri 2 Maths、A2 Key for Schools CES 100、P1 数学，可能结果 P2/P1/未录取。
  - 当前官方查询器的公开数据按申请级别分别给出 P2/P3/P4 的 A2 Key 100/120/130 及 P5 的 B1 Preliminary 140；实际出生日期边界以查询器为准，不从出生年份推断所有个案。
- SEAB 测试结构：https://www.seab.gov.sg/aeis/test-details/
- SEAB 材料与 CEQ 日期：https://www.seab.gov.sg/aeis/application-procedures/
- NUS 外国申请人澳洲高中学历：https://www.nus.edu.sg/oam/admissions/international-qualifications-for-foreigners/international-qualifications/australian-high-school
- NTU 澳洲学历：https://www.ntu.edu.sg/admissions/undergraduate/admissions/general-admission-requirements/international-qualifications/australia-qualifications
- SEC：https://www.seab.gov.sg/secondary-education-certificate-sec/
- 2028 JC/MI：https://www.moe.gov.sg/post-secondary/admissions/pse/jc-and-mi
- PSE 公告：https://cos.moe.gov.sg/2026-announcements/
- 2026 学费与杂费：https://www.moe.gov.sg/news/press-releases/20231018-revised-school-fees-for-non-citizens-in-government-and-government-aided-schools-for-2024-to-2026
- 准证申请：https://www.ica.gov.sg/reside/STP/apply/gov

## 验证与后续判定

上线前运行构建、全套测试、SEO 检查及手机/桌面页面检查。上线后确认五个 URL 返回 200、标题与正文更新、canonical 不变、无 noindex、每页仅一个一致 FAQ。GitHub Pages 继续仅手动发布，阿里云保留自动发布。

本地完成结果：内容构建成功；91 项测试通过；SEO 检查覆盖 262 页、错误为 0。五页在 1365、390、320 像素宽度共 15 组浏览器检查均返回 200，无整页横向溢出、坏图或脚本异常，问答可展开。独立静态测试服务模拟统计接口，未向生产统计发送测试访问；没有因此宣称已验证生产统计入库。五页均在百度精选地图中，lastmod 为 2026-11-26。

上线日起以 7 天与 14 天窗口人工比较百度数据（本记录不创建新定时任务）：

1. 记录五个 URL 最近一次真实 Baiduspider 成功抓取时间，先确认新版是否已被读取。
2. 在百度后台分别查看 PC/移动的页面与查询词展现、点击；没有可导出的页面维度时明确写不可用，不拿全站数字替代。
3. 有抓取无展现：结合实际查询词与竞争结果继续改内容；有展现无点击：再看展示标题与搜索意图；无抓取：回查内链、状态和提交队列。
4. 只通过现有更新队列提交变更页面，不因没有展现反复提交全站，不在额度耗尽时循环重试。

仍待后续分批复核：其他自动文章及聚合页中的夸大标题、旧规则和错误年份。此次没有批量重写其正文，也未把普通网页搜索结果当作百度排名证据。
