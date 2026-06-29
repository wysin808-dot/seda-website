# -*- coding: utf-8 -*-
"""Build /private-university/ (gostudy-style directory) + 10 unified clean detail pages.
10 schools = gostudy's 8 (SIM, Kaplan, PSB, JCU, MDIS, Curtin, LSBF, Amity) + SHRM + TMC.
简洁明了：directory with filter + concise fact-driven detail pages. Real data only."""
import os, json, html

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSSV="38"
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
def esc(s): return html.escape(str(s),quote=True)

FIELDICON={"商科":"💼","会计金融":"📊","计算机/IT":"💻","酒店旅游":"🏨","心理学":"🧠","传媒":"🎬","工程":"⚙️","生命科学":"🧬","法律":"⚖️","时尚设计":"👗","健康科学":"❤️","教育":"🎓","环境科学":"🌿"}
TYPELABEL={"直属":"海外大学直属校区","合作":"合作名校学位"}

# 真实数据（合作大学/创办/EduTrust 等均经官方与权威来源核实）
SCHOOLS=[
{"slug":"jcu","abbr":"JCU","zh":"詹姆斯库克大学（新加坡）","en":"James Cook University Singapore","type":"直属","founded":2003,"color":"#009ca6",
 "sig":"澳洲詹姆斯库克大学直属校区，颁发与澳洲本部相同的学位，中留服认证稳妥。",
 "partners":["詹姆斯库克大学（澳洲本部直属）James Cook University"],
 "fields":["商科","计算机/IT","心理学","教育","环境科学","酒店旅游"],
 "fee":"S$55,000–72,000","fee_note":"本科总学费（直属校区较高），按专业不同；以官方为准。",
 "duration":"本科约 2 年（每年 3 次开学，加速完成）","intake":"3 / 7 / 11 月",
 "edutrust":"EduTrust 认证","china":"直属海外校区学位，中留服认证相对稳妥（以当年名单为准）。",
 "overview":["JCU 新加坡是澳洲詹姆斯库克大学的直属校区，颁发与澳洲本部<b>完全相同的学位</b>，学制紧凑、每年三次开学，最快 2 年读完本科。","以<b>心理学、环境科学、商科、信息技术、教育</b>见长；地处新加坡，文凭含金量与中留服认证较稳，适合想要正规海外大学学位、又看重性价比与时间的学生。"],
 "fit":["想要澳洲名校直属学位、中留服认证稳妥","希望 2 年加速完成本科、节省时间成本","目标心理学 / 环境 / 商科 / IT 等方向"]},
{"slug":"curtin","abbr":"Curtin","zh":"科廷大学（新加坡）","en":"Curtin University Singapore","type":"直属","founded":2008,"color":"#b9982b",
 "sig":"澳洲科廷大学直属校区，与本部同质学位，商科与传媒见长。",
 "partners":["科廷大学（澳洲本部直属）Curtin University"],
 "fields":["商科","会计金融","传媒","健康科学"],
 "fee":"S$55,000–70,000","fee_note":"本科总学费（直属校区较高），按专业不同；以官方为准。",
 "duration":"本科约 2 年（每年多次开学）","intake":"2 / 6 / 10 月",
 "edutrust":"EduTrust 认证","china":"直属海外校区学位，中留服认证相对稳妥（以当年名单为准）。",
 "overview":["Curtin 新加坡是澳洲科廷大学的直属校区，颁发与本部一致的学位，QS 排名稳居全球前列（澳洲八大之外的实力派）。","以<b>商科、会计金融、市场传媒、健康科学</b>见长，学制紧凑、每年多次开学，适合想要澳洲正规学位、快速衔接就业的学生。"],
 "fit":["想要澳洲科廷正规学位、中留服稳妥","目标商科 / 会计 / 传媒方向","希望加速完成、性价比高"]},
{"slug":"sim","abbr":"SIM","zh":"新加坡管理学院","en":"Singapore Institute of Management (SIM)","type":"合作","founded":1964,"color":"#c8102e",
 "sig":"新加坡规模最大、历史最久的私立学府之一，合作伦敦大学等名校。",
 "partners":["伦敦大学 University of London","伯明翰大学 University of Birmingham","皇家墨尔本理工 RMIT","卧龙岗大学 University of Wollongong","斯特灵大学 University of Stirling","拉筹伯大学 La Trobe University"],
 "fields":["商科","会计金融","计算机/IT","传媒","心理学"],
 "fee":"S$30,000–50,000","fee_note":"本科总学费，按合作大学与专业不同；以官方为准。",
 "duration":"本科约 2–3 年","intake":"每年多次开学（按合作大学）",
 "edutrust":"EduTrust 认证","china":"取决于合作大学，如<b>伦敦大学、伯明翰大学</b>等可获中留服认证；申请前请在中留服核实具体学位。",
 "overview":["SIM（新加坡管理学院）创办于 1964 年，是新加坡<b>规模最大、最具声誉的私立学府之一</b>，与多所英澳名校合作授予学位。","合作大学含<b>伦敦大学（学术指导来自 LSE）、伯明翰大学、RMIT、卧龙岗</b>等，商科、金融、计算机、传媒、心理学方向强，校园与学生生活成熟。"],
 "fit":["想要英国伦敦大学 / 伯明翰等名校学位","目标商科 / 金融 / 计算机方向","看重学校规模、声誉与校园氛围"]},
{"slug":"kaplan","abbr":"Kaplan","zh":"楷博高等教育（新加坡）","en":"Kaplan Higher Education Singapore","type":"合作","founded":2005,"color":"#003a70",
 "sig":"全球教育集团 Kaplan 旗下，合作英澳爱名校，开课灵活、专业面广。",
 "partners":["莫道克大学 Murdoch University","都柏林大学 University College Dublin","诺桑比亚大学 Northumbria University","朴茨茅斯大学 University of Portsmouth","埃塞克斯大学 University of Essex"],
 "fields":["商科","会计金融","计算机/IT","酒店旅游","传媒"],
 "fee":"S$28,000–48,000","fee_note":"本科总学费，按合作大学与专业不同；以官方为准。",
 "duration":"本科约 2–3 年","intake":"每年多次开学",
 "edutrust":"EduTrust 认证","china":"取决于合作大学是否在中留服名单（如莫道克、UCD 等）；申请前请在中留服核实。",
 "overview":["Kaplan 新加坡隶属全球教育集团 Kaplan，是本地<b>专业最广、开课最灵活</b>的私立学府之一，合作多所英、澳、爱尔兰大学。","合作大学含<b>莫道克、都柏林大学（UCD）、诺桑比亚、朴茨茅斯</b>等，商科、会计金融、IT、传媒、酒店等方向齐全，市中心校区、转专业灵活。"],
 "fit":["想要专业选择多、开课时间灵活","目标商科 / 会计 / IT / 传媒方向","希望市中心就读、衔接快"]},
{"slug":"psb","abbr":"PSB","zh":"PSB 学院","en":"PSB Academy","type":"合作","founded":1964,"color":"#b30537",
 "sig":"理工与商科并重，合作英澳大学，工程与生命科学是特色。",
 "partners":["纽卡斯尔大学（澳）University of Newcastle","考文垂大学 Coventry University","爱丁堡龙比亚大学 Edinburgh Napier","拉筹伯大学 La Trobe University"],
 "fields":["商科","工程","生命科学","计算机/IT","传媒"],
 "fee":"S$28,000–48,000","fee_note":"本科总学费，按合作大学与专业不同；以官方为准。",
 "duration":"本科约 2–3 年","intake":"每年多次开学",
 "edutrust":"EduTrust 认证","china":"取决于合作大学是否在中留服名单；申请前请在中留服核实。",
 "overview":["PSB 学院前身可追溯到 1964 年，是少数<b>理工与商科并重</b>的私立学府，合作英澳大学授予学位。","合作大学含<b>纽卡斯尔（澳）、考文垂、爱丁堡龙比亚、拉筹伯</b>等，<b>工程、生命科学</b>是它区别于其他私立的特色，商科、IT、传媒同样齐全。"],
 "fit":["想读工程 / 生命科学等理工方向","目标商科 / IT 也合适","看重理工 + 商科兼顾的私立"]},
{"slug":"mdis","abbr":"MDIS","zh":"新加坡管理发展学院","en":"Management Development Institute of Singapore (MDIS)","type":"合作","founded":1956,"color":"#c81432",
 "sig":"新加坡历史最悠久的非营利私立学府（1956），专业覆盖广。",
 "partners":["班戈大学 Bangor University","蒂赛德大学 Teesside University","桑德兰大学 University of Sunderland"],
 "fields":["商科","工程","生命科学","时尚设计","传媒","心理学"],
 "fee":"S$28,000–48,000","fee_note":"本科总学费，按合作大学与专业不同；以官方为准。",
 "duration":"本科约 2–3 年","intake":"每年多次开学",
 "edutrust":"EduTrust 认证","china":"取决于合作大学是否在中留服名单；申请前请在中留服核实。",
 "overview":["MDIS 创办于 1956 年，是新加坡<b>历史最悠久的非营利私立学府</b>，合作多所英国大学授予学位。","合作大学含<b>班戈、蒂赛德、桑德兰</b>等，专业覆盖商科、工程、生命科学、时尚设计、传媒、心理学，自有校园与宿舍，适合想要稳健老牌私校的学生。"],
 "fit":["看重历史底蕴与自有校园的老牌私校","专业选择面广（含工程 / 时尚 / 生科）","目标英国大学学位"]},
{"slug":"lsbf","abbr":"LSBF","zh":"伦敦商业金融学院（新加坡）","en":"London School of Business and Finance Singapore","type":"合作","founded":2007,"color":"#1a2a6c",
 "sig":"商科与金融见长，合作英国格林威治大学等，专业财会方向强。",
 "partners":["格林威治大学 University of Greenwich","康考迪亚大学（芝加哥）Concordia University Chicago","格勒诺布尔高商 Grenoble École de Management"],
 "fields":["商科","会计金融","酒店旅游","法律"],
 "fee":"S$28,000–46,000","fee_note":"本科总学费，按合作大学与专业不同；以官方为准。",
 "duration":"本科约 2–3 年","intake":"每年多次开学",
 "edutrust":"EduTrust 4 年认证","china":"取决于合作大学（如格林威治大学）是否在中留服名单；申请前请在中留服核实。",
 "overview":["LSBF 新加坡是伦敦商业金融学院的新加坡校区，<b>专注商科、金融与财会</b>，合作英国格林威治大学等授予学位。","以<b>会计金融、商业管理、酒店、法律</b>方向见长，课程偏实务与职业资格衔接（如 ACCA），适合目标财会 / 金融职业路径的学生。"],
 "fit":["目标会计 / 金融 / 商业管理职业","想衔接 ACCA 等职业资格","偏好实务导向的商科课程"]},
{"slug":"amity","abbr":"Amity","zh":"Amity 全球教育学院（新加坡）","en":"Amity Global Institute Singapore","type":"合作","founded":2007,"color":"#5a2d82",
 "sig":"印度 Amity 教育集团旗下，合作英国名校，商科与酒店旅游见长。",
 "partners":["东英吉利大学 University of East Anglia","伦敦大学 University of London","北安普顿大学 University of Northampton","蒂赛德大学 Teesside University","创意艺术大学 University for the Creative Arts"],
 "fields":["商科","酒店旅游","传媒","计算机/IT"],
 "fee":"S$28,000–45,000","fee_note":"本科总学费，按合作大学与专业不同；以官方为准。",
 "duration":"本科约 2–3 年","intake":"每年多次开学",
 "edutrust":"EduTrust 4 年认证","china":"取决于合作大学（如伦敦大学、东英吉利）是否在中留服名单；申请前请在中留服核实。",
 "overview":["Amity 新加坡隶属印度 Amity 教育集团，学生来自 45 个以上国家，合作多所英国大学授予学位。","合作大学含<b>东英吉利（UEA）、伦敦大学、北安普顿、蒂赛德</b>等，<b>商科、酒店旅游、传媒</b>方向见长，提供预科到硕士的完整衔接。"],
 "fit":["目标商科 / 酒店旅游 / 传媒方向","想要英国大学学位 + 国际化环境","需要预科 / 大专到本科的衔接"]},
{"slug":"shrm","abbr":"SHRM","zh":"SHRM 学院","en":"SHRM College Singapore","type":"合作","founded":2007,"color":"#0e7a6b",
 "sig":"酒店与旅游管理专精的私立学院，合作英国大学，实操导向。",
 "partners":["雷克瑟姆大学 Wrexham University","坎布里亚大学 University of Cumbria"],
 "fields":["酒店旅游","商科"],
 "fee":"S$30,000–45,000","fee_note":"本科总学费，按专业与学制不同；以官方为准。",
 "duration":"本科约 2–3 年（含高级大专衔接）","intake":"每年多次开学",
 "edutrust":"EduTrust 4 年认证","china":"取决于合作大学是否在中留服名单；申请前请在中留服核实。",
 "overview":["SHRM 学院创办于 2007 年（前身为 SHRM 酒店与度假村管理学院），是<b>酒店与旅游管理专精</b>的私立学院。","合作<b>英国雷克瑟姆大学、坎布里亚大学</b>，提供国际旅游与酒店管理、国际商业（专升本）及 MBA，课程偏<b>实操与行业实训</b>，适合立志酒店旅游业的学生。"],
 "fit":["立志酒店 / 旅游 / 服务业管理","偏好实操与行业实训导向","想用高级大专衔接英国学位"]},
{"slug":"tmc","abbr":"TMC","zh":"TMC 学院","en":"TMC Academy","type":"合作","founded":1981,"color":"#c2185b",
 "sig":"新加坡最早的私立学府之一（1981），专业面广，心理学与商科见长。",
 "partners":["格洛斯特郡大学 University of Gloucestershire","利物浦约翰摩尔斯大学 Liverpool John Moores","北安普顿大学 University of Northampton","格林威治大学 University of Greenwich"],
 "fields":["商科","计算机/IT","心理学","酒店旅游","法律","传媒"],
 "fee":"S$28,000–45,000","fee_note":"本科总学费，按合作大学与专业不同；以官方为准。",
 "duration":"本科约 2–3 年","intake":"每年多次开学",
 "edutrust":"EduTrust 4 年认证","china":"取决于合作大学是否在中留服名单；申请前请在中留服核实。",
 "overview":["TMC 学院创办于 1981 年，是<b>新加坡最早的私立学府之一</b>，合作多所英国大学授予学位。","合作大学含<b>格洛斯特郡、利物浦约翰摩尔斯、北安普顿、格林威治</b>等，专业覆盖商科、IT、<b>心理学</b>、酒店、法律、传媒，老牌稳健、专业面广。"],
 "fit":["看重老牌资历、专业选择多","目标心理学 / 商科 / IT 方向","想要英国大学学位"]},
]

# 共用 FAQ（私立大学通识，每页附在校级 FAQ 之后）
COMMON_FAQ=[
 ("私立大学学位中国教育部（中留服）认可吗？","看具体学位。<b>JCU、Curtin 等海外大学直属校区</b>的学位认证相对稳妥；<b>合作办学</b>模式则取决于其合作大学是否在中留服名单（如伦敦大学、伯明翰大学等可认证）。务必在申请前到中留服官网核实该校该专业的具体学位。"),
 ("EduTrust 认证是什么？为什么重要？","EduTrust 是新加坡 SSG 颁给私立教育机构的质量认证（最高为 4 年期 EduTrust）。只有持证学校才能招收国际学生并办理学生准证，是选私立大学最基本的筛选门槛。本页 10 所均持 EduTrust 认证。"),
 ("中国高中生没有高考成绩能申请吗？","可以。多数私立大学接受<b>高中毕业证 + 成绩单</b>直申，不需要高考；英语通常 IELTS 5.5–6.0（比公立大学低），不达标可先读语言 / 预科再升本科。"),
]

CSS=r'''
:root{--pv-ink:#1f2430;--pv-line:#e7ebf1;--pv-muted:#6a7383;--pv-brand:#c0392b}
.pv *{box-sizing:border-box}
.pv-hero{padding:46px clamp(20px,6vw,80px) 40px;background:linear-gradient(135deg,#241a1e,#7e2d3a)}
.pv-hero,.pv-hero *{color:#fff}
.pv-hero .in{max-width:1160px;margin:0 auto}
.pv-ey{display:inline-block;margin-bottom:13px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);padding:6px 14px;border-radius:999px;font-size:.82rem;font-weight:700}
.pv-hero h1{font-size:clamp(26px,3.7vw,42px);margin:0 0 12px;font-weight:850;line-height:1.16}
.pv-hero p.s{margin:0 0 20px;color:rgba(255,255,255,.9);font-size:clamp(15px,1.6vw,17px);line-height:1.7;max-width:820px}
.pv-search{display:flex;gap:10px;max-width:560px;background:#fff;border-radius:12px;padding:7px;box-shadow:0 16px 40px rgba(0,0,0,.22)}
.pv-search input{flex:1;border:0;outline:0;padding:0 14px;font-size:1rem;color:var(--pv-ink);min-width:0;background:transparent}
.pv-search button{border:0;background:var(--pv-brand);color:#fff;font-weight:800;padding:0 22px;border-radius:9px;cursor:pointer;height:44px}
.pv-tools{max-width:1160px;margin:0 auto;padding:20px clamp(20px,6vw,80px) 4px}
.pv-frow{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:10px}
.pv-flb{font-size:.78rem;color:var(--pv-muted);font-weight:800;margin-right:3px}
.pv-chip{font-size:.83rem;border:1px solid var(--pv-line);background:#fff;color:var(--pv-muted);padding:6px 12px;border-radius:999px;cursor:pointer;user-select:none;transition:.13s}
.pv-chip:hover{border-color:#9fb3cc}
.pv-chip.on{background:#7e2d3a;border-color:#7e2d3a;color:#fff}
.pv-count{max-width:1160px;margin:0 auto;padding:12px clamp(20px,6vw,80px) 0;font-size:.92rem;color:var(--pv-muted)}
.pv-count b{color:#7e2d3a;font-size:1.05rem}
.pv-cards{max-width:1160px;margin:0 auto;padding:14px clamp(20px,6vw,80px) 30px;display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:18px}
.pv-card{display:flex;flex-direction:column;border:1px solid var(--pv-line);border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 2px 10px rgba(20,20,40,.04);transition:transform .18s,box-shadow .18s}
.pv-card.hide{display:none}
.pv-card:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(20,30,60,.12)}
.pv-logobar{height:84px;display:flex;align-items:center;justify-content:center;background:#fff;border-bottom:1px solid var(--pv-line);padding:14px 18px}
.pv-logobar img{max-height:50px;max-width:74%;width:auto;object-fit:contain}
.pv-logobar.mono{color:#fff;font-weight:850;font-size:1.7rem;letter-spacing:.03em}
.pv-head{padding:14px 18px 4px}
.pv-head h3{margin:0;font-size:1.1rem;color:var(--pv-ink);line-height:1.25}
.pv-head .en{color:var(--pv-muted);font-size:.76rem;margin-top:.15rem}
.pv-badges{display:flex;flex-wrap:wrap;gap:6px;padding:0 18px 12px}
.pv-b{font-size:.72rem;font-weight:800;padding:3px 9px;border-radius:999px}
.pv-b.t-直属{background:#e6f7f6;color:#0e7a6b}.pv-b.t-合作{background:#f3ece9;color:#8a4a2d}
.pv-b.et{background:#fff4e6;color:#b45309}
.pv-body{padding:0 18px 14px;display:flex;flex-direction:column;flex:1}
.pv-row{font-size:.85rem;color:var(--pv-ink);line-height:1.6;margin:0 0 8px}
.pv-row .k{color:var(--pv-muted);font-weight:700;margin-right:5px}
.pv-tags{display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 12px}
.pv-tag{font-size:.74rem;background:#f3f5f9;color:#475067;padding:3px 9px;border-radius:7px}
.pv-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;border-top:1px dashed var(--pv-line);padding-top:12px}
.pv-foot .fee{font-size:.85rem;color:var(--pv-muted)}.pv-foot .fee b{color:var(--pv-ink)}
.pv-foot .go{color:#7e2d3a;font-weight:800;text-decoration:none;font-size:.9rem}
.pv-sec{max-width:1160px;margin:0 auto;padding:30px clamp(20px,6vw,80px)}
.pv-sec h2{font-size:clamp(21px,2.8vw,29px);margin:0 0 6px;font-weight:830}
.pv-sec .lead{color:var(--pv-muted);margin:0 0 20px;line-height:1.7}
.pv-cmp-wrap{overflow-x:auto}
.pv-cmp{width:100%;border-collapse:collapse;font-size:.9rem;min-width:760px}
.pv-cmp th,.pv-cmp td{padding:11px 13px;text-align:left;border-bottom:1px solid var(--pv-line);vertical-align:top}
.pv-cmp thead th{background:#7e2d3a;color:#fff;font-weight:800;white-space:nowrap}
.pv-cmp tbody td:first-child{font-weight:800;color:var(--pv-ink)}
.pv-cmp tr:hover td{background:#f7f9fc}
.pv-faq details{border:1px solid var(--pv-line);border-radius:12px;padding:2px 16px;margin-bottom:9px;background:#fff}
.pv-faq summary{cursor:pointer;font-weight:700;padding:13px 0;list-style:none}
.pv-faq summary::-webkit-details-marker{display:none}
.pv-faq summary::after{content:"+";float:right;color:#7e2d3a;font-weight:800}
.pv-faq details[open] summary::after{content:"–"}
.pv-faq .a{padding:0 0 14px;color:#48505f;line-height:1.74}
.pv-cta{background:linear-gradient(135deg,#241a1e,#7e2d3a);border-radius:18px;padding:26px 28px;text-align:center;margin:8px 0}
.pv-cta,.pv-cta *{color:#fff}.pv-cta h3{margin:0 0 8px;font-size:1.3rem}
.pv-cta a{display:inline-block;margin-top:14px;background:var(--pv-brand);color:#fff;font-weight:800;padding:11px 28px;border-radius:10px;text-decoration:none}
/* detail */
.pv-dhero{padding:42px clamp(20px,6vw,80px) 34px;color:#fff}
.pv-dhero .in{max-width:1000px;margin:0 auto}
.pv-dlogo{display:inline-flex;align-items:center;justify-content:center;background:#fff;border-radius:12px;padding:10px 18px;margin-bottom:16px;box-shadow:0 8px 22px rgba(0,0,0,.18)}
.pv-dlogo img{height:40px;max-width:230px;width:auto;object-fit:contain}
.pv-dbadges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.pv-dbadges span{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.32);padding:5px 12px;border-radius:999px;font-size:.8rem;font-weight:700}
.pv-dhero h1{font-size:clamp(25px,3.6vw,40px);margin:0 0 6px;font-weight:850;line-height:1.18}
.pv-dhero .en{font-size:.92rem;opacity:.84;margin:0 0 14px}
.pv-dhero .sig{font-size:clamp(15px,1.7vw,17px);line-height:1.7;max-width:760px;color:rgba(255,255,255,.94);margin:0}
.pv-facts{max-width:1000px;margin:-22px auto 0;position:relative;z-index:3;padding:0 clamp(20px,6vw,80px)}
.pv-facts table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--pv-line);border-radius:14px;overflow:hidden;box-shadow:0 14px 38px rgba(20,30,60,.12)}
.pv-facts th,.pv-facts td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--pv-line);font-size:.92rem;vertical-align:top}
.pv-facts th{background:#f7f9fc;color:var(--pv-muted);font-weight:700;width:34%;white-space:nowrap}
.pv-facts tr:last-child th,.pv-facts tr:last-child td{border-bottom:0}
.pv-dsec{max-width:1000px;margin:0 auto;padding:30px clamp(20px,6vw,80px)}
.pv-dsec h2{font-size:clamp(20px,2.6vw,27px);margin:0 0 14px;font-weight:830}
.pv-dsec p{line-height:1.84;color:#3a4150;margin:0 0 14px}
.pv-plist{display:flex;flex-wrap:wrap;gap:9px}
.pv-pu{border:1px solid var(--pv-line);border-radius:11px;padding:11px 15px;font-size:.92rem;font-weight:600;color:var(--pv-ink);background:#fff}
.pv-fchips{display:flex;flex-wrap:wrap;gap:8px}
.pv-fchip{background:#f3f5f9;color:#3a4456;font-size:.88rem;font-weight:700;padding:7px 13px;border-radius:9px}
.pv-fit{list-style:none;padding:0;margin:0;display:grid;gap:9px}
.pv-fit li{padding:11px 15px 11px 40px;position:relative;background:#f7faf7;border:1px solid #e0efe0;border-radius:11px;line-height:1.6}
.pv-fit li::before{content:"✓";position:absolute;left:15px;color:#2e8b57;font-weight:800}
.pv-note{background:#fff8ef;border:1px solid #f3e0c4;border-left:4px solid #d98b2b;border-radius:12px;padding:15px 18px;font-size:.9rem;color:#5a4a32;line-height:1.7}
.pv-rel{display:flex;flex-wrap:wrap;gap:10px}
.pv-rel a{border:1px solid var(--pv-line);border-radius:999px;padding:9px 17px;text-decoration:none;color:#7e2d3a;font-weight:700;font-size:.92rem;transition:.13s}
.pv-rel a:hover{background:#7e2d3a;color:#fff;border-color:#7e2d3a}
@media(max-width:600px){.pv-facts th{width:42%}.pv-cards{grid-template-columns:1fr}}
'''

def head(title,desc,canon,jsonld):
    blocks="\n".join('<script type="application/ld+json">%s</script>'%json.dumps(j,ensure_ascii=False,separators=(",",":")) for j in jsonld)
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="{canon}"/>
<link rel="stylesheet" href="/seda-site.css?v={CSSV}"/>
{blocks}
<style>{CSS}</style>
</head>
<body>
{HEADER}
<main class="pv">'''
TAIL=f'''</main>
{FOOTER}
<script src="/seda-site.js?v=28"></script>
</body>
</html>'''

ALLFIELDS=[]
for s in SCHOOLS:
    for f in s["fields"]:
        if f not in ALLFIELDS: ALLFIELDS.append(f)

WHITE_LOGO={"psb","kaplan"}  # 白色 logo → 放品牌色底
def logo_of(slug):
    for ext in ("svg","png"):
        if os.path.exists(os.path.join(ROOT,"assets",f"logo-{slug}.{ext}")): return f"/assets/logo-{slug}.{ext}"
    return None
def logobar(s):
    lg=logo_of(s["slug"])
    if not lg:  # 无 logo → 字母牌兜底
        return f'<div class="pv-logobar mono" style="background:linear-gradient(135deg,{s["color"]},{s["color"]}cc)">{esc(s["abbr"])}</div>'
    bg=s["color"] if s["slug"] in WHITE_LOGO else "#fff"
    return f'<div class="pv-logobar" style="background:{bg}"><img src="{lg}?v=1" alt="{esc(s["zh"])} 校徽" loading="lazy" decoding="async"></div>'

def card(s):
    fields=" ".join(s["fields"])
    name=(s["zh"]+" "+s["en"]+" "+s["abbr"]+" "+" ".join(s["fields"])).lower()
    tags="".join(f'<span class="pv-tag">{FIELDICON.get(f,"")} {esc(f)}</span>' for f in s["fields"][:4])
    partners="、".join(p.split(" ")[0] for p in s["partners"][:3])
    if s["type"]=="直属": partners="澳洲本部直属，颁同质学位"
    return f'''<div class="pv-card" data-type="{s['type']}" data-fields="{esc(fields)}" data-name="{esc(name)}">
  {logobar(s)}
  <div class="pv-head"><h3>{esc(s['zh'])}</h3><div class="en">{esc(s['en'])}</div></div>
  <div class="pv-badges"><span class="pv-b t-{s['type']}">{TYPELABEL[s['type']]}</span><span class="pv-b et">🎖 {esc(s['edutrust'])}</span></div>
  <div class="pv-body">
    <p class="pv-row"><span class="k">合作 / 学位</span>{esc(partners)}</p>
    <div class="pv-tags">{tags}</div>
    <div class="pv-foot"><span class="fee">本科学费 <b>{esc(s['fee'])}</b></span><a class="go" href="/private-university/{s['slug']}/">查看详情 →</a></div>
  </div>
</div>'''

def build_directory():
    canon="https://sgeda.org.cn/private-university/"
    title="新加坡私立大学指南：SIM、Kaplan、PSB、JCU、MDIS 对比 | SEDA"
    desc="新加坡 10 所主流私立大学一站对比：SIM、Kaplan、PSB、JCU、MDIS、Curtin、LSBF、Amity、SHRM、TMC。合作名校学位、海外直属校区、学费、EduTrust 认证与中留服认证、热门专业与中国学生选校建议。"
    typechips="".join(f'<span class="pv-chip" data-f="type" data-v="{t}">{TYPELABEL[t]}</span>' for t in ["直属","合作"])
    fieldchips="".join(f'<span class="pv-chip" data-f="field" data-v="{esc(f)}">{FIELDICON.get(f,"")} {esc(f)}</span>' for f in ALLFIELDS)
    cards="".join(card(s) for s in SCHOOLS)
    # comparison rows
    cmp="".join(f'''<tr><td>{esc(s['abbr'])}<br><small style="font-weight:400;color:#888">{esc(s['zh'])}</small></td>
<td>{TYPELABEL[s['type']]}</td><td>{esc("、".join(p.split(" ")[0] for p in s["partners"][:3]) if s["type"]=="合作" else "澳洲本部直属")}</td>
<td>{esc("、".join(s["fields"][:3]))}</td><td>{esc(s['fee'])}</td></tr>''' for s in SCHOOLS)
    faq="".join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q,a in COMMON_FAQ)
    jsonld=[
     {"@context":"https://schema.org","@type":"ItemList","name":"新加坡主流私立大学","numberOfItems":len(SCHOOLS),
      "itemListElement":[{"@type":"ListItem","position":i+1,"name":s["zh"],"url":"https://sgeda.org.cn/private-university/%s/"%s["slug"]} for i,s in enumerate(SCHOOLS)]},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
       {"@type":"ListItem","position":2,"name":"新加坡私立大学"}]},
     {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":html.unescape(a.replace("<b>","").replace("</b>",""))}} for q,a in COMMON_FAQ]},
    ]
    body=f'''
  <section class="pv-hero" style="background:linear-gradient(135deg,#241a1e,#7e2d3a)"><div class="in">
    <span class="pv-ey">🎓 10 所主流私立大学 · 合作名校 / 海外直属校区</span>
    <h1>新加坡私立大学</h1>
    <p class="s">公立大学之外的灵活升学路径：<b>海外大学直属校区</b>（JCU、Curtin）与<b>合作名校学位</b>（SIM、Kaplan、PSB、MDIS、LSBF、Amity、SHRM、TMC）。高中毕业可直申、学制紧凑、专业灵活——下面按类型与专业方向对比 10 所，均持 <b>EduTrust 认证</b>。</p>
    <form class="pv-search" onsubmit="return false"><input type="search" id="pvq" placeholder="搜学校 / 专业，如 酒店、心理、JCU"><button type="button" onclick="document.getElementById('pvq').focus()">搜索</button></form>
    <a href="#database" style="display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:700;padding:10px 20px;border-radius:10px;text-decoration:none">📚 直接查 10 所 273 个专业总数据库 →</a>
  </div></section>
  <div class="pv-tools">
    <div class="pv-frow"><span class="pv-flb">类型</span>{typechips}</div>
    <div class="pv-frow"><span class="pv-flb">方向</span>{fieldchips}</div>
  </div>
  <div class="pv-count">显示 <b id="pvshow">{len(SCHOOLS)}</b> / {len(SCHOOLS)} 所私立大学</div>
  <div class="pv-cards" id="pvcards">{cards}</div>

  <section class="pv-sec">
    <h2>10 所一表对比</h2>
    <p class="lead">类型、代表合作大学、优势方向与学费一览（学费为本科总额区间，以官方为准）。</p>
    <div class="pv-cmp-wrap"><table class="pv-cmp"><thead><tr><th>学校</th><th>类型</th><th>代表合作大学 / 学位</th><th>优势方向</th><th>本科学费</th></tr></thead><tbody>{cmp}</tbody></table></div>
  </section>

  <section class="pv-sec">
    <h2>私立大学怎么选？</h2>
    <p class="lead">三条简单判断线：</p>
    <ul class="pv-fit">
      <li><b>最看重中留服认证 / 回国就业</b> → 优先 <b>JCU、Curtin</b>（海外直属校区）或 SIM 的伦敦大学方向。</li>
      <li><b>看重名校学位与学校声誉</b> → <b>SIM</b>（伦敦大学、伯明翰）专业广、规模大、氛围成熟。</li>
      <li><b>专业对口最重要</b> → 工程/生科看 <b>PSB</b>，酒店旅游看 <b>SHRM/Amity</b>，心理学看 <b>JCU/TMC</b>，财会看 <b>LSBF</b>。</li>
    </ul>
  </section>

  <section class="pv-sec pv-faq">
    <h2>常见问题</h2>
    {faq}
  </section>

  <section class="pv-sec"><div class="pv-cta"><h3>不知道选哪所？</h3><p>告诉我们你的高考 / 高中成绩、预算与目标专业，给你匹配最合适的私立大学与申请方案。</p><a href="/contact/">免费咨询选校 →</a></div></section>
'''
    js=r'''
<script>(function(){
  var cards=[].slice.call(document.querySelectorAll('.pv-card'));
  var q=document.getElementById('pvq'),show=document.getElementById('pvshow');
  var F={type:{},field:{}};
  function act(o){return Object.keys(o).filter(function(k){return o[k]})}
  function apply(){
    var term=(q.value||'').trim().toLowerCase(),aT=act(F.type),aF=act(F.field),n=0;
    cards.forEach(function(c){
      var ok=true;
      if(term&&c.getAttribute('data-name').indexOf(term)<0)ok=false;
      if(ok&&aT.length&&aT.indexOf(c.getAttribute('data-type'))<0)ok=false;
      if(ok&&aF.length){var fs=c.getAttribute('data-fields');if(!aF.some(function(x){return fs.indexOf(x)>=0}))ok=false;}
      c.classList.toggle('hide',!ok);if(ok)n++;
    });
    show.textContent=n;
  }
  q.addEventListener('input',apply);
  document.querySelectorAll('.pv-chip').forEach(function(c){c.addEventListener('click',function(){
    c.classList.toggle('on');var f=c.getAttribute('data-f'),v=c.getAttribute('data-v');
    F[f][v]=c.classList.contains('on');apply();});});
  var sp=new URLSearchParams(location.search);if(sp.get('q')){q.value=sp.get('q');}apply();
})();</script>'''
    return head(title,desc,canon,jsonld)+body+js+TAIL

def detail(s):
    canon="https://sgeda.org.cn/private-university/%s/"%s["slug"]
    title=f"{s['zh']}（{s['abbr']}）指南：合作大学、学费、专业、EduTrust 与中留服认证 | SEDA"
    desc=f"{s['zh']}（{s['en']}）深度指南：{s['sig']} 合作大学、学制时长、学费区间、EduTrust 认证、中留服认证情况、热门专业方向与中国学生申请建议。"
    grad=f"linear-gradient(135deg,{s['color']},{s['color']}bb)"
    facts=f'''<table>
<tr><th>办学类型</th><td>{TYPELABEL[s['type']]}</td></tr>
<tr><th>创办年份</th><td>{s['founded']} 年</td></tr>
<tr><th>合作 / 颁证大学</th><td>{esc("；".join(s['partners']))}</td></tr>
<tr><th>本科学制</th><td>{esc(s['duration'])}</td></tr>
<tr><th>开学时间</th><td>{esc(s['intake'])}</td></tr>
<tr><th>本科学费区间</th><td>{esc(s['fee'])}<br><small style="color:#888">{esc(s['fee_note'])}</small></td></tr>
<tr><th>EduTrust</th><td>🎖 {esc(s['edutrust'])}</td></tr>
<tr><th>中留服认证</th><td>{s['china']}</td></tr>
</table>'''
    partners="".join(f'<span class="pv-pu">{esc(p)}</span>' for p in s["partners"])
    fchips="".join(f'<span class="pv-fchip">{FIELDICON.get(f,"")} {esc(f)}</span>' for f in s["fields"])
    fit="".join(f'<li>{esc(x)}</li>' for x in s["fit"])
    overview="".join(f'<p>{p}</p>' for p in s["overview"])
    school_faq=[
     (f"{s['abbr']} 的学位中留服认可吗？",s['china']),
     (f"{s['abbr']} 学费大概多少？",f"本科总学费约 {s['fee']}，按合作大学与专业不同。{s['fee_note']} 私立大学不提供 MOE 政府津贴，但部分有自有奖学金。"),
     (f"中国学生申请 {s['abbr']} 需要高考吗？","不需要。接受高中毕业证 + 成绩单直申，英语通常 IELTS 5.5–6.0；不达标可先读语言 / 预科再升本科。"),
    ]
    faqs=school_faq+COMMON_FAQ[:1]
    faq="".join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q,a in faqs)
    others=[x for x in SCHOOLS if x["slug"]!=s["slug"]][:4]
    rel="".join(f'<a href="/private-university/{o["slug"]}/">{esc(o["abbr"])}</a>' for o in others)
    jsonld=[
     {"@context":"https://schema.org","@type":"CollegeOrUniversity","name":s["zh"],"alternateName":[s["en"],s["abbr"]],
      "url":canon,"foundingDate":str(s["founded"]),"address":{"@type":"PostalAddress","addressCountry":"SG","addressLocality":"Singapore"},
      "description":s["sig"]},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
       {"@type":"ListItem","position":2,"name":"新加坡私立大学","item":"https://sgeda.org.cn/private-university/"},
       {"@type":"ListItem","position":3,"name":s["zh"]}]},
     {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":html.unescape(a.replace("<b>","").replace("</b>",""))}} for q,a in faqs]},
    ]
    body=f'''
  <section class="pv-dhero" style="background:{grad}"><div class="in">
    {(f'<div class="pv-dlogo"><img src="{logo_of(s["slug"])}?v=1" alt="{esc(s["zh"])} 校徽"></div>') if (logo_of(s["slug"]) and s["slug"] not in WHITE_LOGO) else ''}
    <div class="pv-dbadges"><span>{TYPELABEL[s['type']]}</span><span>🎖 {esc(s['edutrust'])}</span><span>📅 {s['founded']} 年创办</span></div>
    <h1>{esc(s['zh'])} <span style="opacity:.7;font-size:.6em">{esc(s['abbr'])}</span></h1>
    <p class="en">{esc(s['en'])}</p>
    <p class="sig">{esc(s['sig'])}</p>
  </div></section>
  <div class="pv-facts">{facts}</div>

  <section class="pv-dsec"><h2>学校概况</h2>{overview}</section>
  <section class="pv-dsec"><h2>合作 / 颁证大学</h2><div class="pv-plist">{partners}</div></section>
  <section class="pv-dsec"><h2>热门专业方向</h2><div class="pv-fchips">{fchips}</div></section>
  <section class="pv-dsec"><h2>适合什么样的学生</h2><ul class="pv-fit">{fit}</ul></section>
  <section class="pv-dsec"><div class="pv-note">💡 选私立大学务必认准两点：① <b>EduTrust 认证</b>（招收国际生与办学生准证的前提）；② 若打算回中国就业，<b>申请前到中留服官网核实</b>该校该专业的具体学位是否可认证。{s['abbr']} 持有 {s['edutrust']}。</div></section>
  <section class="pv-dsec pv-faq"><h2>常见问题</h2>{faq}</section>
  <section class="pv-dsec"><div class="pv-cta"><h3>想申请 {esc(s['abbr'])}？</h3><p>告诉我们你的成绩与目标专业，免费评估录取与给出学费 / 认证方案。</p><a href="/contact/">免费咨询 →</a></div></section>
  <section class="pv-dsec"><h2>其他私立大学</h2><div class="pv-rel"><a href="/private-university/">← 全部 10 所</a>{rel}</div></section>
'''
    return head(title,desc,canon,jsonld)+body+TAIL

# ---- write ----
open(os.path.join(ROOT,"private-university/index.html"),"w",encoding="utf-8").write(build_directory())
print("wrote private-university/index.html")
RICH_SLUGS={"psb","sim","jcu","curtin","lsbf","amity","shrm","tmc","mdis","kaplan"}  # 这些由 build-private-rich.py 生成 gostudy 式富页，简单模板跳过
for s in SCHOOLS:
    if s["slug"] in RICH_SLUGS: continue
    d=os.path.join(ROOT,"private-university",s["slug"]); os.makedirs(d,exist_ok=True)
    open(os.path.join(d,"index.html"),"w",encoding="utf-8").write(detail(s))
    print("wrote private-university/%s/index.html"%s["slug"])
print("DONE | %d schools (rich skipped: %s)"%(len(SCHOOLS),RICH_SLUGS))
