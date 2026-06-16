# -*- coding: utf-8 -*-
"""Rich gostudy-style detail pages for private universities (template: PSB first).
Per school: partner-university cards (with programme counts) + pathway + filterable
programme database (name + partner + level + field). Real data from official sites.
Schools NOT in RICH are left to build-private.py's simple template."""
import os, json, html
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSSV="38"
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
def esc(s): return html.escape(str(s),quote=True)

FIELDICON={"商科":"💼","会计与金融":"📊","市场营销":"📣","数据与分析":"📈","IT计算机":"💻","工程":"⚙️","网络安全":"🔐","生命科学":"🧬","医疗健康":"🩺","护理":"❤️","传媒":"🎬","酒店旅游":"🏨","体育运动":"🏅","物流供应链":"🚚","设计":"🎨","经济":"💹","社会科学":"🌐","心理学":"🧠"}
LEVELORDER={"证书":0,"文凭":1,"本科":2,"硕士":3}

# ============ PSB ============
PSB_PARTNERS=[
 ("cov","考文垂大学","Coventry University","英国","🇬🇧","课程最全、性价比高","QS #558 · 五星院校"),
 ("herts","赫特福德大学","University of Hertfordshire","英国","🇬🇧","工程、数据科学、医疗影像见长","QS #901"),
 ("napier","爱丁堡龙比亚大学","Edinburgh Napier University","英国","🇬🇧","商科与体育科学 Top-up 专升本","英国应用型名校"),
 ("newc","纽卡斯尔大学","University of Newcastle","澳大利亚","🇦🇺","商科、生物医学、IT、传媒","QS #227"),
 ("latrobe","拉筹伯大学","La Trobe University","澳大利亚","🇦🇺","生命科学、护理、商科见长","QS #233"),
 ("ecu","埃迪斯科文大学","Edith Cowan University","澳大利亚","🇦🇺","体育与运动科学全球前50","QS #487"),
 ("canberra","堪培拉大学","University of Canberra","澳大利亚","🇦🇺","工商管理博士 DBA","QS #494"),
 ("massey","梅西大学","Massey University","新西兰","🇳🇿","商科、商业分析、信息科学","QS #230"),
 ("psb","PSB 学院","PSB Academy","新加坡","🇸🇬","自颁文凭与基础课程，衔接合作大学本科","新加坡本地学府"),
]
# (英文专业名, 合作大学key, 层级, 方向, 中文专业名)
PSB_PROGS=[
 # 本科 Bachelor
 ("BA (Hons) Accounting and Finance for International Business (Top-up)","cov","本科","会计与金融","国际商务会计与金融（荣誉文学士·专升本）"),
 ("BSc (Hons) Accounting and Finance","cov","本科","会计与金融","会计与金融（荣誉理学士）"),
 ("BSc (Hons) Business and Finance","cov","本科","会计与金融","商业与金融（荣誉理学士）"),
 ("Bachelor of Commerce","newc","本科","会计与金融","商学学士"),
 ("BSc (Hons) Diagnostic Radiography and Imaging","herts","本科","医疗健康","诊断放射与医学影像（荣誉理学士）"),
 ("BSc (Hons) Paramedic Science (Top-Up)","cov","本科","医疗健康","院前急救科学（荣誉理学士·专升本）"),
 ("Bachelor of Business","massey","本科","数据与分析","商学学士（商业分析）"),
 ("BSc (Hons) Data Science","herts","本科","数据与分析","数据科学（荣誉理学士）"),
 ("BA (Hons) Business Administration (Top-Up)","herts","本科","商科","工商管理（荣誉文学士·专升本）"),
 ("BA (Hons) Business Management with Logistics","herts","本科","商科","商业管理与物流（荣誉文学士）"),
 ("BA Business Management (Top-up)","napier","本科","商科","商业管理（文学士·专升本）"),
 ("BA Business Management with Human Resource Management (Top-Up)","napier","本科","商科","商业管理与人力资源（文学士·专升本）"),
 ("BA (Hons) Global Business (Top-up)","cov","本科","商科","全球商务（荣誉文学士·专升本）"),
 ("Bachelor of Business","newc","本科","商科","商学学士"),
 ("Bachelor of Business (Management and International Business)","latrobe","本科","商科","商学学士（管理与国际商务）"),
 ("Bachelor of Business (Management and Marketing)","latrobe","本科","商科","商学学士（管理与市场营销）"),
 ("BA (Hons) Business and Marketing","cov","本科","市场营销","商业与市场营销（荣誉文学士）"),
 ("BA (Hons) Digital Marketing","cov","本科","市场营销","数字营销（荣誉文学士）"),
 ("Bachelor of Business (Marketing and International Business)","latrobe","本科","市场营销","商学学士（市场营销与国际商务）"),
 ("BSc (Hons) Quantity Surveying and Commercial Management","cov","本科","工程","工料测量与商业管理（荣誉理学士）"),
 ("BEng (Hons) Robotics and Artificial Intelligence","herts","本科","工程","机器人与人工智能（荣誉工程学士）"),
 ("BEng (Hons) Electrical and Electronic Engineering","cov","本科","工程","电气与电子工程（荣誉工程学士）"),
 ("BEng (Hons) Electro-Mechanical Engineering","cov","本科","工程","机电工程（荣誉工程学士）"),
 ("BEng (Hons) Mechanical Engineering","cov","本科","工程","机械工程（荣誉工程学士）"),
 ("BSc (Hons) Cyber Security","cov","本科","网络安全","网络安全（荣誉理学士）"),
 ("Bachelor of Computer Science (Artificial Intelligence)","latrobe","本科","IT计算机","计算机科学学士（人工智能）"),
 ("Bachelor of Information Sciences (Computer Science & IT)","massey","本科","IT计算机","信息科学学士（计算机科学与信息技术双主修）"),
 ("Bachelor of Information Technology","newc","本科","IT计算机","信息技术学士"),
 ("BSc (Hons) Artificial Intelligence (Top-Up)","cov","本科","IT计算机","人工智能（荣誉理学士·专升本）"),
 ("BSc (Hons) Computing Science","cov","本科","IT计算机","计算科学（荣誉理学士）"),
 ("Bachelor of Biomedical Science","newc","本科","生命科学","生物医学学士"),
 ("Bachelor of Biomedical Science","latrobe","本科","生命科学","生物医学学士"),
 ("Bachelor of Science (Applied Chemistry and Molecular Biology)","latrobe","本科","生命科学","理学学士（应用化学与分子生物学）"),
 ("Bachelor of Science (Biotechnology and Molecular Biology)","latrobe","本科","生命科学","理学学士（生物技术与分子生物学）"),
 ("Bachelor of Science (Molecular Biology and Pharmaceutical Science)","latrobe","本科","生命科学","理学学士（分子生物学与制药科学）"),
 ("Bachelor of Nursing (Top-up)","latrobe","本科","护理","护理学学士（专升本）"),
 ("BA (Hons) Digital Media","cov","本科","传媒","数字媒体（荣誉文学士）"),
 ("BA (Hons) Media and Communications","cov","本科","传媒","媒体与传播（荣誉文学士）"),
 ("Bachelor of Communication","newc","本科","传媒","传播学学士"),
 ("BA (Hons) International Hospitality and Tourism Management","cov","本科","酒店旅游","国际酒店与旅游管理（荣誉文学士）"),
 ("BA Hospitality and Tourism Management (Top-Up)","napier","本科","酒店旅游","酒店与旅游管理（文学士·专升本）"),
 ("Bachelor of Science (Exercise and Sports Science)","ecu","本科","体育运动","理学学士（运动与体育科学）"),
 ("BSc Sport and Exercise Science (Top-up)","napier","本科","体育运动","体育与运动科学（理学士·专升本）"),
 # 硕士 Master
 ("MBA in Finance","cov","硕士","会计与金融","金融工商管理硕士（MBA）"),
 ("MSc Data Science","herts","硕士","数据与分析","数据科学理学硕士"),
 ("Executive MBA","newc","硕士","商科","高级工商管理硕士（EMBA）"),
 ("MBA","herts","硕士","商科","工商管理硕士（MBA）"),
 ("MBA","newc","硕士","商科","工商管理硕士（MBA）"),
 ("MBA in Global Business","cov","硕士","商科","全球商务工商管理硕士（MBA）"),
 ("Doctor of Business Administration (DBA)","canberra","硕士","商科","工商管理博士（DBA）"),
 ("MSc Cyber Security","cov","硕士","网络安全","网络安全理学硕士"),
 ("MSc Engineering Management","cov","硕士","工程","工程管理理学硕士"),
 ("MSc Renewable Energy Engineering","cov","硕士","工程","可再生能源工程理学硕士"),
 ("Master of Biotechnology and Bioinformatics","latrobe","硕士","生命科学","生物技术与生物信息学硕士"),
 ("Master of Nursing (Leadership)","latrobe","硕士","护理","护理学硕士（领导力）"),
 ("MA Media Studies","massey","硕士","传媒","媒体研究文学硕士"),
 # 文凭 Diploma (PSB 自颁)
 ("Diploma in Business Administration (Accounting and Finance)","psb","文凭","会计与金融","工商管理大专（会计与金融）"),
 ("Diploma in Business Analytics","psb","文凭","数据与分析","商业分析大专"),
 ("Diploma in Business Administration","psb","文凭","商科","工商管理大专"),
 ("Diploma in Business Administration (Digital Marketing)","psb","文凭","市场营销","工商管理大专（数字营销）"),
 ("Diploma in Business Administration (Human Resource Management)","psb","文凭","商科","工商管理大专（人力资源管理）"),
 ("Diploma in Cyber Security","psb","文凭","网络安全","网络安全大专"),
 ("Diploma in Electrical Engineering Technology","psb","文凭","工程","电气工程技术大专"),
 ("Diploma in Electrical Engineering with Robotics","psb","文凭","工程","电气工程与机器人大专"),
 ("Diploma in Mechanical Engineering Technology","psb","文凭","工程","机械工程技术大专"),
 ("Diploma in InfoComm Technology","psb","文凭","IT计算机","信息通信技术大专"),
 ("Diploma in Global Supply Chain Management","psb","文凭","物流供应链","全球供应链管理大专"),
 ("Diploma in Tourism and Hospitality Management","psb","文凭","酒店旅游","旅游与酒店管理大专"),
 ("Diploma in Graphic Design and Media","psb","文凭","设计","平面设计与媒体大专"),
 ("Diploma in Media and Communications","psb","文凭","传媒","媒体与传播大专"),
 ("Diploma in Sport and Exercise Sciences","psb","文凭","体育运动","体育与运动科学大专"),
 ("Diploma in Paramedicine","psb","文凭","医疗健康","院前急救大专"),
 ("Foundation Diploma in Life Sciences","psb","文凭","生命科学","生命科学基础大专"),
]

# ============ SIM ============
SIM_PARTNERS=[
 ("uol","伦敦大学","University of London","英国","🇬🇧","LSE 学术引领，英国名校学位","LSE 学术引领"),
 ("bham","伯明翰大学","University of Birmingham","英国","🇬🇧","罗素集团名校，商科强","QS #76"),
 ("warwick","华威大学","University of Warwick","英国","🇬🇧","罗素集团顶尖名校","QS #74"),
 ("cardiff","卡迪夫大学","Cardiff University","英国","🇬🇧","罗素集团名校","QS #181"),
 ("stir","斯特灵大学","University of Stirling","英国","🇬🇧","市场营销与体育管理","QS #517"),
 ("usyd","悉尼大学","University of Sydney","澳大利亚","🇦🇺","澳洲八大，护理见长","QS #25"),
 ("rmit","皇家墨尔本理工","RMIT University","澳大利亚","🇦🇺","设计 / 商科 / 传媒","QS #125"),
 ("uow","卧龙岗大学","University of Wollongong","澳大利亚","🇦🇺","计算机与 IT 见长","QS #184"),
 ("monash","莫纳什学院","Monash College","澳大利亚","🇦🇺","衔接莫纳什大学（QS #36）","Monash 衔接"),
 ("alberta","阿尔伯塔大学","University of Alberta","加拿大","🇨🇦","加拿大顶尖研究型大学","QS #94"),
 ("buffalo","纽约州立布法罗大学","University at Buffalo (SUNY)","美国","🇺🇸","纽约州公立名校，文理见长","QS #410"),
 ("grenoble","格勒诺布尔高商","Grenoble École de Management","法国","🇫🇷","欧洲顶尖商学院","欧洲顶尖商学院"),
 ("sim","新加坡管理学院","SIM Global Education","新加坡","🇸🇬","自颁文凭与预科，衔接合作大学本科","新加坡本地学府"),
]
SIM_PROGS=[
 # University of London（LSE 学术引领）
 ("BSc Economics","uol","本科","经济","经济学（理学士）"),
 ("BSc Accountancy","uol","本科","会计与金融","会计学（理学士）"),
 ("BSc Banking and Finance","uol","本科","会计与金融","银行与金融（理学士）"),
 ("BSc Finance","uol","本科","会计与金融","金融（理学士）"),
 ("BSc Business and Management","uol","本科","商科","商业与管理（理学士）"),
 ("BSc Management","uol","本科","商科","管理学（理学士）"),
 ("BSc Business Analytics","uol","本科","数据与分析","商业分析（理学士）"),
 ("BSc Data Science and Business Analytics","uol","本科","数据与分析","数据科学与商业分析（理学士）"),
 ("BSc Digital Innovation","uol","本科","IT计算机","数字创新（理学士）"),
 ("BSc International Relations","uol","本科","社会科学","国际关系（理学士）"),
 ("BSc Politics and International Relations","uol","本科","社会科学","政治与国际关系（理学士）"),
 ("BSc Computer Science","uol","本科","IT计算机","计算机科学（理学士）"),
 ("BSc Computer Science (Machine Learning and AI)","uol","本科","IT计算机","计算机科学（机器学习与人工智能）"),
 ("BSc Computer Science (Web and Mobile Development)","uol","本科","IT计算机","计算机科学（网络与移动开发）"),
 ("MSc Professional Accountancy","uol","硕士","会计与金融","专业会计（理学硕士）"),
 ("MSc Accounting and Financial Management","uol","硕士","会计与金融","会计与财务管理（理学硕士）"),
 # University of Birmingham
 ("BSc Business Management","bham","本科","商科","商业管理（理学士）"),
 ("BSc International Business","bham","本科","商科","国际商务（理学士）"),
 ("BSc Money, Banking and Finance","bham","本科","会计与金融","货币、银行与金融（理学士）"),
 ("BSc Accounting and Finance","bham","本科","会计与金融","会计与金融（理学士）"),
 ("BSc Marketing","bham","本科","市场营销","市场营销（理学士）"),
 ("BA Media and Communication","bham","本科","传媒","媒体与传播（文学士）"),
 ("MSc Management","bham","硕士","商科","管理学（理学硕士）"),
 ("MSc International Business","bham","硕士","商科","国际商务（理学硕士）"),
 # RMIT University
 ("Bachelor of Business (Accountancy)","rmit","本科","会计与金融","商学学士（会计）"),
 ("Bachelor of Business (Economics and Finance)","rmit","本科","会计与金融","商学学士（经济与金融）"),
 ("Bachelor of Business (Business and Technology)","rmit","本科","商科","商学学士（商业与技术）"),
 ("Bachelor of Business (Global Business)","rmit","本科","商科","商学学士（全球商务）"),
 ("Bachelor of Business (Logistics and Supply Chain)","rmit","本科","物流供应链","商学学士（物流与供应链）"),
 ("Bachelor of Business (Management and Change)","rmit","本科","商科","商学学士（管理与变革）"),
 ("Bachelor of Business (Marketing)","rmit","本科","市场营销","商学学士（市场营销）"),
 ("Bachelor of Accounting","rmit","本科","会计与金融","会计学学士"),
 ("Bachelor of Communication (Professional Communication)","rmit","本科","传媒","传播学学士（专业传播）"),
 ("Bachelor of Design (Communication Design)","rmit","本科","设计","设计学学士（传达设计）"),
 ("Bachelor of Aviation","rmit","本科","商科","航空学学士"),
 ("Bachelor of Applied Science (Construction Management)","rmit","本科","工程","应用科学学士（建筑管理）"),
 # University of Wollongong
 ("Bachelor of Computer Science","uow","本科","IT计算机","计算机科学学士"),
 ("Bachelor of Information Technology","uow","本科","IT计算机","信息技术学士"),
 ("Bachelor of Business Information Systems","uow","本科","IT计算机","商业信息系统学士"),
 ("Bachelor of Psychological Science","uow","本科","心理学","心理科学学士"),
 # University at Buffalo
 ("BS Business Administration","buffalo","本科","商科","工商管理（理学士）"),
 ("BA Communication","buffalo","本科","传媒","传播学（文学士）"),
 ("BA Psychology","buffalo","本科","心理学","心理学（文学士）"),
 ("BA Sociology","buffalo","本科","社会科学","社会学（文学士）"),
 ("BA Economics","buffalo","本科","经济","经济学（文学士）"),
 ("BA Geographic Information Science","buffalo","本科","IT计算机","地理信息科学（文学士）"),
 ("BA International Trade","buffalo","本科","商科","国际贸易（文学士）"),
 # University of Stirling
 ("BA (Hons) Marketing","stir","本科","市场营销","市场营销（荣誉文学士）"),
 ("BA (Hons) Digital Media","stir","本科","传媒","数字媒体（荣誉文学士）"),
 ("BA (Hons) Sport and Marketing","stir","本科","市场营销","体育与市场营销（荣誉文学士）"),
 ("BA (Hons) Sport Business Management","stir","本科","体育运动","体育商业管理（荣誉文学士）"),
 # University of Sydney
 ("Bachelor of Nursing (Post-registration)","usyd","本科","护理","护理学学士（注册后）"),
 ("Bachelor of Nursing (Honours)","usyd","本科","护理","护理学学士（荣誉）"),
 # Grenoble École de Management
 ("Bachelor in International Business","grenoble","本科","商科","国际商务学士"),
 ("MSc in Management","grenoble","硕士","商科","管理学理学硕士"),
]

RICH={
"psb":{
 "abbr":"PSB","zh":"PSB 学院","en":"PSB Academy","color":"#b30537","founded":1964,
 "tagline":"亚洲未来学院 · 理工与商科并重",
 "sig":"新加坡领先私立学府，与英、澳、新西兰 8 所大学合作，提供从语言、文凭到本科、硕士的完整升学路径；3 大市中心校区，EduTrust 认证，工程与生命科学是特色。",
 "fee":"S$28,000–48,000","fee_note":"本科总学费按合作大学与专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"每年 1/4/7/10 月等多次开学","edutrust":"EduTrust 认证",
 "china":"取决于合作大学是否在中留服名单（直属/合作各异）；申请前请在中留服官网核实具体学位。",
 "overview":[
   "PSB 学院（PSB Academy）前身可追溯到 1964 年，是新加坡领先的私立学府之一，被称为「亚洲未来学院」。设有 3 个市中心校区，持 EduTrust 认证。",
   "PSB 与<b>英国、澳大利亚、新西兰 8 所大学</b>深度合作，提供从语言（CEP）、PSB 文凭到合作大学本科与硕士的完整路径。它采用<b>一年 3 学期的 Trimester 制</b>，比澳洲本校区两学期制可节省约 1 年时间与费用，所获学位与本校区一致。",
   "<b>工程与生命科学</b>是 PSB 区别于其他私立的特色，商科、IT、传媒、体育科学、护理与医疗健康同样齐全。",
 ],
 "highlights":[("省时省钱","Trimester 制，比澳洲本校区省约 1 年"),("同等学历","学位与本校区一致，可中留服认证"),("专业最全","16 大方向、8 所合作大学")],
 "pathway":[("语言课程 CEP","按入学测试分级；已有雅思 5.5 可跳过，直入证书/文凭。"),
   ("证书 / 预科","6 个月，高中均分达标可跳过，直接读文凭。"),
   ("PSB 文凭","约 12 个月，16 大方向，完成后<b>直入合作大学本科大二</b>。"),
   ("本科学位","直入大二（主流，最快约 16 个月）/ Top-up 专升本（最快约 8 个月）/ 大一直入；学位由合作大学颁发。"),
   ("硕士学位","12–16 个月，合作大学颁发，可衔接 MBA / 工程 / 数据 / 生科等。")],
 "finder":"https://www.psb-academy.edu.sg/programmes",
 "coverage":"以下收录 PSB 各合作大学的主要学位专业；PSB 还有更多文凭与方向，完整清单见官方课程页。",
 "partners":PSB_PARTNERS,"progs":PSB_PROGS,
},
"sim":{
 "abbr":"SIM","zh":"新加坡管理学院","en":"Singapore Institute of Management (SIM)","color":"#e4002b","founded":1964,
 "tagline":"新加坡规模最大的私立学府 · 140+ 专业",
 "sig":"新加坡规模最大、历史最久的私立学府之一（1964 年创办），与英、澳、美、加、欧 12 所大学合作，提供 140+ 专业；伦敦大学（LSE 学术引领）、悉尼大学、伯明翰、华威等名校学位，校园与学生生活成熟。",
 "fee":"S$30,000–50,000","fee_note":"本科总学费按合作大学与专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"每年多次开学（按合作大学）","edutrust":"EduTrust 认证",
 "china":"取决于合作大学，如<b>伦敦大学、伯明翰、悉尼大学、华威</b>等可获中留服认证；申请前请在中留服官网核实具体学位。",
 "overview":[
   "新加坡管理学院（SIM Global Education）创办于 1964 年，是新加坡<b>规模最大、最具声誉的私立学府之一</b>，在校学生与校友众多、学生生活与社团成熟。",
   "SIM 与<b>英国、澳大利亚、美国、加拿大、法国 12 所大学</b>合作，提供 <b>140+ 个</b>从文凭、预科到本科、硕士的专业。招牌是<b>伦敦大学（学术由 LSE 等引领）</b>，并有悉尼大学（澳洲八大）、伯明翰、华威、卧龙岗、RMIT、布法罗等名校学位。",
   "商科、金融、会计、数据科学、计算机、传媒、心理学、护理等方向齐全，是公立大学之外名校学位的热门之选。",
 ],
 "highlights":[("规模最大","在校学生与校友众多，学生生活成熟"),("名校云集","伦敦大学 / 悉尼 / 伯明翰 / 华威等"),("专业最全","140+ 专业、12 所合作大学")],
 "pathway":[("预科 / 文凭","SIM 管理预科或文凭，按学历从对应阶段入读。"),
   ("英语 / 桥梁","英语不达标可先读英语 / 桥梁课程，再入读学位。"),
   ("本科学位","2–3 年，合作大学颁发学位，部分文凭可学分减免、加速完成。"),
   ("荣誉年 / 硕士","可读荣誉学位年或衔接合作大学硕士（如会计、管理、商务等）。")],
 "finder":"https://www.sim.edu.sg/degrees-diplomas/overview",
 "coverage":"SIM 有 140+ 专业，以下收录各合作大学的主要学位专业（按官方学科整理）；完整清单见 SIM 官方课程查找器。",
 "partners":SIM_PARTNERS,"progs":SIM_PROGS,
},
}

CSS=r'''
:root{--prc-ink:#1f2430;--prc-line:#e7ebf1;--prc-muted:#6a7383}
.prc *{box-sizing:border-box}
.prc-hero{padding:46px clamp(20px,6vw,80px) 40px;color:#fff;position:relative;overflow:hidden}
.prc-hero .in{max-width:1080px;margin:0 auto;position:relative;z-index:2}
.prc-dlogo{display:inline-flex;background:#fff;border-radius:12px;padding:10px 18px;margin-bottom:16px;box-shadow:0 8px 22px rgba(0,0,0,.18)}
.prc-dlogo img{height:42px;max-width:240px;object-fit:contain}
.prc-hero h1{font-size:clamp(26px,3.8vw,42px);margin:0 0 6px;font-weight:850;line-height:1.16}
.prc-hero .tag{font-size:.95rem;opacity:.9;margin:0 0 14px;font-weight:600}
.prc-hero .sig{max-width:760px;font-size:clamp(15px,1.6vw,17px);line-height:1.7;color:rgba(255,255,255,.94);margin:0 0 22px}
.prc-stats{display:flex;flex-wrap:wrap;gap:10px 28px}
.prc-stat .n{font-size:clamp(20px,2.6vw,30px);font-weight:850;line-height:1}
.prc-stat .l{font-size:.78rem;opacity:.85;margin-top:5px}
.prc-sec{max-width:1080px;margin:0 auto;padding:36px clamp(20px,6vw,80px)}
.prc-sec.tight{padding-top:0}
.prc-sec h2{font-size:clamp(21px,2.8vw,29px);margin:0 0 6px;font-weight:830}
.prc-sec .lead{color:var(--prc-muted);margin:0 0 22px;line-height:1.7;max-width:760px}
.prc-sec p.ov{line-height:1.84;color:#3a4150;margin:0 0 14px}
.prc-hl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:8px}
.prc-hlc{border:1px solid var(--prc-line);border-radius:13px;padding:16px 18px;background:#fff}
.prc-hlc b{display:block;font-size:1.02rem;margin-bottom:4px}
.prc-hlc span{color:var(--prc-muted);font-size:.9rem;line-height:1.55}
/* partner cards */
.prc-partners{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.prc-pc{border:1px solid var(--prc-line);border-radius:14px;padding:18px;background:#fff;transition:.16s}
.prc-pc:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(20,30,60,.1)}
.prc-pc .ctry{font-size:.8rem;color:var(--prc-muted);font-weight:700}
.prc-pc .ctry .qs{display:inline-block;margin-left:6px;background:var(--acc);color:#fff;font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:999px;vertical-align:middle}
.prc-pc h3{margin:.3rem 0 .1rem;font-size:1.08rem}
.prc-pc .en{color:var(--prc-muted);font-size:.78rem;margin-bottom:.6rem}
.prc-pc .note{font-size:.88rem;color:#3a4150;line-height:1.55;margin:0 0 .8rem}
.prc-pc .cnt{display:flex;gap:8px;flex-wrap:wrap}
.prc-pc .cnt span{font-size:.78rem;font-weight:800;padding:3px 10px;border-radius:999px;background:#f3f5f9;color:#3a4456}
/* pathway */
.prc-path{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:0}
.prc-step{position:relative;border:1px solid var(--prc-line);border-radius:13px;padding:16px;background:#fff;margin:6px}
.prc-step .no{font-size:.74rem;font-weight:800;color:#fff;background:var(--acc);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:8px}
.prc-step b{display:block;font-size:1rem;margin-bottom:4px}
.prc-step span{color:var(--prc-muted);font-size:.86rem;line-height:1.55}
/* database */
.prc-db{background:linear-gradient(180deg,#faf7f5,#fff);border-top:1px solid var(--prc-line);border-bottom:1px solid var(--prc-line)}
.prc-tools{max-width:1080px;margin:0 auto;padding:24px clamp(20px,6vw,80px) 6px}
.prc-find{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--prc-line);border-radius:12px;padding:10px 14px;max-width:520px;box-shadow:0 4px 14px rgba(20,30,60,.05)}
.prc-find input{flex:1;border:0;outline:0;font-size:1rem;background:transparent;min-width:0}
.prc-frow{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:13px}
.prc-flb{font-size:.78rem;color:var(--prc-muted);font-weight:800;margin-right:2px}
.prc-chip{font-size:.82rem;border:1px solid var(--prc-line);background:#fff;color:var(--prc-muted);padding:6px 12px;border-radius:999px;cursor:pointer;user-select:none;transition:.13s}
.prc-chip:hover{border-color:var(--acc)}
.prc-chip.on{background:var(--acc);border-color:var(--acc);color:#fff}
.prc-count{max-width:1080px;margin:0 auto;padding:14px clamp(20px,6vw,80px) 0;font-size:.92rem;color:var(--prc-muted)}
.prc-count b{color:var(--acc);font-size:1.06rem}
.prc-progs{max-width:1080px;margin:0 auto;padding:12px clamp(20px,6vw,80px) 44px;display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px}
.prc-prog{border:1px solid var(--prc-line);border-left:4px solid var(--acc);border-radius:12px;padding:14px 16px;background:#fff}
.prc-prog.hide{display:none}
.prc-prog .nm{font-weight:700;font-size:.96rem;line-height:1.35;color:var(--prc-ink)}
.prc-prog .ens{color:var(--prc-muted);font-size:.76rem;margin-top:3px;line-height:1.4}
.prc-prog .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.prc-prog .t{font-size:.73rem;font-weight:700;padding:2px 9px;border-radius:999px}
.prc-prog .t.lv{background:#efe7f5;color:#7a3da0}
.prc-prog .t.lv.本科{background:#e7f0fb;color:#2360a5}
.prc-prog .t.lv.硕士{background:#fdeaf0;color:#c2185b}
.prc-prog .t.lv.文凭{background:#fff2e3;color:#b45309}
.prc-prog .t.fl{background:#eef1f6;color:#516079}
.prc-prog .t.pn{background:#f0f6f0;color:#2e7d52}
.prc-empty{max-width:1080px;margin:0 auto;padding:0 clamp(20px,6vw,80px) 36px;color:var(--prc-muted);display:none}
/* facts/faq/cta reuse from pv look */
.prc-facts table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--prc-line);border-radius:14px;overflow:hidden}
.prc-facts th,.prc-facts td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--prc-line);font-size:.92rem}
.prc-facts th{background:#f7f8fa;color:var(--prc-muted);font-weight:700;width:32%;white-space:nowrap}
.prc-facts tr:last-child th,.prc-facts tr:last-child td{border-bottom:0}
.prc-faq details{border:1px solid var(--prc-line);border-radius:12px;padding:2px 16px;margin-bottom:9px;background:#fff}
.prc-faq summary{cursor:pointer;font-weight:700;padding:13px 0;list-style:none}
.prc-faq summary::-webkit-details-marker{display:none}
.prc-faq summary::after{content:"+";float:right;color:var(--acc);font-weight:800}
.prc-faq details[open] summary::after{content:"–"}
.prc-faq .a{padding:0 0 14px;color:#48505f;line-height:1.74}
.prc-cta{background:var(--accgrad);border-radius:18px;padding:26px 28px;text-align:center;margin:8px 0}
.prc-cta,.prc-cta *{color:#fff}.prc-cta h3{margin:0 0 8px;font-size:1.3rem}
.prc-cta a{display:inline-block;margin-top:14px;background:#fff;color:var(--acc);font-weight:800;padding:11px 28px;border-radius:10px;text-decoration:none}
.prc-rel{display:flex;flex-wrap:wrap;gap:10px}
.prc-rel a{border:1px solid var(--prc-line);border-radius:999px;padding:9px 17px;text-decoration:none;color:var(--acc);font-weight:700;font-size:.92rem}
.prc-rel a:hover{background:var(--acc);color:#fff}
@media(max-width:600px){.prc-facts th{width:40%}.prc-progs{grid-template-columns:1fr}}
'''

def head(title,desc,canon,jsonld,acc,accgrad):
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
<style>{CSS}
.prc{{--acc:{acc};--accgrad:{accgrad}}}</style>
</head>
<body>
{HEADER}
<main class="prc">'''
TAIL=f'''</main>
{FOOTER}
<script src="/seda-site.js?v=28"></script>
</body>
</html>'''

def logo_path(slug):
    for ext in ("svg","png"):
        if os.path.exists(os.path.join(ROOT,"assets",f"logo-{slug}.{ext}")): return f"/assets/logo-{slug}.{ext}"
    return None

def build(slug):
    d=RICH[slug]; progs=d["progs"]; partners=d["partners"]
    acc=d["color"]; accgrad=f"linear-gradient(135deg,{acc},{acc}bb)"
    pmap={p[0]:p for p in partners}  # key -> tuple
    fields=[]
    for _,_,_,f,_ in progs:
        if f not in fields: fields.append(f)
    levels=sorted({p[2] for p in progs},key=lambda x:LEVELORDER.get(x,9))
    n_b=sum(1 for p in progs if p[2]=="本科"); n_m=sum(1 for p in progs if p[2]=="硕士"); n_d=sum(1 for p in progs if p[2]=="文凭")
    # partner counts
    def pcount(key,lv): return sum(1 for p in progs if p[1]==key and p[2]==lv)
    canon=f"https://sgeda.org.cn/private-university/{slug}/"
    title=f"{d['zh']}（{d['abbr']}）完整指南：{len(partners)-1} 所合作大学、{len(progs)}+ 专业数据库、升学路径与学费 | SEDA"
    desc=f"{d['zh']}（{d['en']}）深度指南：与 {len(partners)-1} 所英澳新大学合作，{len(progs)}+ 个专业（本科 {n_b}、硕士 {n_m}、文凭 {n_d}）可筛选数据库；合作大学、升学路径、入学要求、学费与中留服认证。"
    # partner cards
    pcards=""
    for key,zh,en,ctry,flag,note,qs in partners:
        if key in ("psb",) and n_d:
            cnt=f'<span>{n_d} 个文凭</span>'
        else:
            b=pcount(key,"本科"); m=pcount(key,"硕士")
            cnt="".join([f'<span>{b} 本科专业</span>' if b else '',f'<span>{m} 硕士专业</span>' if m else ''])
            if not cnt: cnt='<span>更多专业见官方查找器</span>'
        pcards+=f'<div class="prc-pc"><div class="ctry">{flag} {esc(ctry)} <span class="qs">{esc(qs)}</span></div><h3>{esc(zh)}</h3><div class="en">{esc(en)}</div><p class="note">{esc(note)}</p><div class="cnt">{cnt}</div></div>'
    # database
    def prog_card(p):
        en,key,lv,fl,zh=p; pz=pmap[key][1]
        nm=(zh+" "+en+" "+pz+" "+fl+" "+lv).lower()
        return f'''<div class="prc-prog" data-pt="{key}" data-lv="{lv}" data-fl="{esc(fl)}" data-name="{esc(nm)}">
  <div class="nm">{esc(zh)}</div>
  <div class="ens">{esc(en)}</div>
  <div class="meta"><span class="t lv {lv}">{lv}</span><span class="t fl">{FIELDICON.get(fl,"")} {esc(fl)}</span><span class="t pn">{esc(pz)}</span></div>
</div>'''
    order=sorted(progs,key=lambda p:(LEVELORDER.get(p[2],9),p[3],p[0]))
    progcards="".join(prog_card(p) for p in order)
    fieldchips="".join(f'<span class="prc-chip" data-f="fl" data-v="{esc(f)}">{FIELDICON.get(f,"")} {esc(f)}（{sum(1 for p in progs if p[3]==f)}）</span>' for f in fields)
    ptchips="".join(f'<span class="prc-chip" data-f="pt" data-v="{k}">{esc(z)}</span>' for k,z,*_ in partners if any(p[1]==k for p in progs))
    lvchips="".join(f'<span class="prc-chip" data-f="lv" data-v="{lv}">{lv}（{sum(1 for p in progs if p[2]==lv)}）</span>' for lv in levels)
    hl="".join(f'<div class="prc-hlc"><b>{esc(t)}</b><span>{esc(x)}</span></div>' for t,x in d["highlights"])
    ov="".join(f'<p class="ov">{p}</p>' for p in d["overview"])
    pathhtml="".join(f'<div class="prc-step"><div class="no">{i+1}</div><b>{esc(t)}</b><span>{x}</span></div>' for i,(t,x) in enumerate(d["pathway"]))
    pnames="、".join(z for k,z,*_ in partners if k not in ("psb","sim"))
    faqs=[
     (f"{d['abbr']} 和哪些大学合作？",f"{d['zh']}与 {len(partners)-1} 所大学合作：{pnames}。学位由合作大学颁发，与其本校区一致。"),
     (f"{d['abbr']} 有多少专业？",f"本页收录约 {len(progs)} 个主要专业（本科 {n_b}、硕士 {n_m}、文凭 {n_d}），覆盖 {len(fields)} 大方向，可按方向、合作大学、层级筛选；完整清单见学校官方课程查找器。"),
     (f"{d['abbr']} 的学位中留服认可吗？",d["china"]),
     ("中国学生没有高考能申请吗？","可以。接受高中毕业证 + 成绩单，按学历从证书 / 文凭 / 预科起读；英语雅思约 5.5（本科段 6.0–6.5），不达标可先读语言 / 预科课程。"),
     (f"{d['abbr']} 学费多少？",f"本科总学费约 {d['fee']}，按合作大学与专业不同。{d['fee_note']} 学费通常可按学期分期。"),
    ]
    faq="".join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q,a in faqs)
    jsonld=[
     {"@context":"https://schema.org","@type":"CollegeOrUniversity","name":d["zh"],"alternateName":[d["en"],d["abbr"]],"url":canon,"foundingDate":str(d["founded"]),
      "address":{"@type":"PostalAddress","addressCountry":"SG","addressLocality":"Singapore"},"description":d["sig"]},
     {"@context":"https://schema.org","@type":"ItemList","name":f"{d['zh']} 专业目录","numberOfItems":len(progs),
      "itemListElement":[{"@type":"ListItem","position":i+1,"name":f"{p[0]}（{pmap[p[1]][1]} · {p[2]}）"} for i,p in enumerate(order)]},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
       {"@type":"ListItem","position":2,"name":"新加坡私立大学","item":"https://sgeda.org.cn/private-university/"},
       {"@type":"ListItem","position":3,"name":d["zh"]}]},
     {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":html.unescape(a.replace("<b>","").replace("</b>",""))}} for q,a in faqs]},
    ]
    lg=logo_path(slug)
    WHITE_LOGO_RICH={"psb"}  # 白色 logo → 直接放彩色 hero（透明牌），不用白底
    if lg and slug in WHITE_LOGO_RICH:
        logohtml=f'<div class="prc-dlogo" style="background:transparent;box-shadow:none;padding:0;margin-bottom:14px"><img src="{lg}?v=1" style="height:46px" alt="{esc(d["zh"])} 校徽"></div>'
    elif lg:
        logohtml=f'<div class="prc-dlogo"><img src="{lg}?v=1" alt="{esc(d["zh"])} 校徽"></div>'
    else:
        logohtml=''
    rel="".join(f'<a href="/private-university/{o}/">{o.upper()}</a>' for o in ["sim","kaplan","jcu","mdis"] if o!=slug)
    body=f'''
  <section class="prc-hero" style="background:{accgrad}"><div class="in">
    {logohtml}
    <h1>{esc(d['zh'])} <span style="opacity:.7;font-size:.6em">{esc(d['abbr'])}</span></h1>
    <p class="tag">{esc(d['en'])} · {esc(d['tagline'])}</p>
    <p class="sig">{esc(d['sig'])}</p>
    <div class="prc-stats">
      <div class="prc-stat"><div class="n">{len(partners)-1} 所</div><div class="l">合作大学</div></div>
      <div class="prc-stat"><div class="n">{len(progs)}+</div><div class="l">专业 / 课程</div></div>
      <div class="prc-stat"><div class="n">{len(fields)} 大</div><div class="l">专业方向</div></div>
      <div class="prc-stat"><div class="n">{d['founded']}</div><div class="l">创办</div></div>
      <div class="prc-stat"><div class="n">🎖</div><div class="l">{esc(d['edutrust'])}</div></div>
    </div>
  </div></section>

  <section class="prc-sec"><h2>学校概况</h2>{ov}<div class="prc-hl">{hl}</div></section>

  <section class="prc-sec tight"><h2>合作大学 · {len(partners)-1} 所</h2>
    <p class="lead">学位由以下大学颁发，与其本校区一致。点专业数据库可看各校具体专业。</p>
    <div class="prc-partners">{pcards}</div></section>

  <section class="prc-sec tight"><h2>升学路径</h2>
    <p class="lead">中国学生典型路线：语言 → 证书/预科 → 文凭 → 本科（直入大二）→ 硕士。学历达标可跳过前段。</p>
    <div class="prc-path">{pathhtml}</div></section>

  <div class="prc-db">
    <div class="prc-tools">
      <h2 style="font-size:clamp(21px,2.8vw,29px);margin:6px 0 4px;font-weight:830">专业数据库 · <span style="color:{acc}">{len(progs)} 个</span></h2>
      <p style="color:var(--prc-muted);margin:0 0 16px;line-height:1.7">本科 {n_b} · 硕士 {n_m} · 文凭 {n_d}。可按<b>方向、合作大学、层级</b>筛选；专业名为官方授予名称，学位由对应合作大学颁发。</p>
      <div class="prc-find">🔎<input type="search" id="prcq" placeholder="搜专业，如 商科、AI、护理、Coventry"></div>
      <div class="prc-frow"><span class="prc-flb">方向</span>{fieldchips}</div>
      <div class="prc-frow"><span class="prc-flb">合作大学</span>{ptchips}</div>
      <div class="prc-frow"><span class="prc-flb">层级</span>{lvchips}</div>
    </div>
    <div class="prc-count">显示 <b id="prcshow">{len(progs)}</b> / {len(progs)} 个专业</div>
    <div class="prc-progs" id="prcprogs">{progcards}</div>
    <div class="prc-empty" id="prcempty">没有匹配的专业，试试减少筛选条件。</div>
    <p style="max-width:1080px;margin:0 auto;padding:0 clamp(20px,6vw,80px) 34px;font-size:.82rem;color:var(--prc-muted)">{esc(d.get("coverage",""))} 数据来自 {d['en']} 官网课程信息；专业每年略有调整，精确学费 / 学制以官方为准。{(f' <a href="{d["finder"]}" target="_blank" rel="nofollow" style="color:var(--acc);font-weight:700">→ 官方完整专业查找器</a>') if d.get("finder") else ""}</p>
  </div>

  <section class="prc-sec"><h2>关键信息</h2>
    <div class="prc-facts"><table>
      <tr><th>办学类型</th><td>合作名校学位（私立学府）</td></tr>
      <tr><th>合作大学</th><td>{esc("、".join(z for k,z,*_ in partners if k!="psb"))}</td></tr>
      <tr><th>本科学制</th><td>直入大二最快约 16 个月 / Top-up 最快约 8 个月</td></tr>
      <tr><th>开学时间</th><td>{esc(d['intake'])}</td></tr>
      <tr><th>本科学费</th><td>{esc(d['fee'])}<br><small style="color:#888">{esc(d['fee_note'])}</small></td></tr>
      <tr><th>EduTrust</th><td>🎖 {esc(d['edutrust'])}</td></tr>
      <tr><th>中留服认证</th><td>{d['china']}</td></tr>
    </table></div></section>

  <section class="prc-sec prc-faq tight"><h2>常见问题</h2>{faq}</section>

  <section class="prc-sec tight"><div class="prc-cta"><h3>想申请 {esc(d['abbr'])}？</h3><p>告诉我们你的成绩与目标专业，免费匹配合作大学与升学路径方案。</p><a href="/contact/">免费咨询 →</a></div></section>

  <section class="prc-sec tight"><h2>其他私立大学</h2><div class="prc-rel"><a href="/private-university/">← 全部 10 所</a>{rel}</div></section>
'''
    js=r'''
<script>(function(){
  var grid=document.getElementById('prcprogs'),cards=[].slice.call(grid.querySelectorAll('.prc-prog'));
  var q=document.getElementById('prcq'),show=document.getElementById('prcshow'),empty=document.getElementById('prcempty');
  var F={fl:{},pt:{},lv:{}};
  function act(o){return Object.keys(o).filter(function(k){return o[k]})}
  function apply(){
    var term=(q.value||'').trim().toLowerCase(),aFl=act(F.fl),aPt=act(F.pt),aLv=act(F.lv),n=0;
    cards.forEach(function(c){
      var ok=true;
      if(term&&c.getAttribute('data-name').indexOf(term)<0)ok=false;
      if(ok&&aFl.length&&aFl.indexOf(c.getAttribute('data-fl'))<0)ok=false;
      if(ok&&aPt.length&&aPt.indexOf(c.getAttribute('data-pt'))<0)ok=false;
      if(ok&&aLv.length&&aLv.indexOf(c.getAttribute('data-lv'))<0)ok=false;
      c.classList.toggle('hide',!ok);if(ok)n++;
    });
    show.textContent=n;empty.style.display=n?'none':'block';
  }
  q.addEventListener('input',apply);
  document.querySelectorAll('.prc-chip').forEach(function(c){c.addEventListener('click',function(){
    c.classList.toggle('on');var f=c.getAttribute('data-f'),v=c.getAttribute('data-v');
    F[f][v]=c.classList.contains('on');apply();});});
  apply();
})();</script>'''
    return head(title,desc,canon,jsonld,acc,accgrad)+body+js+TAIL

for slug in RICH:
    out=os.path.join(ROOT,"private-university",slug); os.makedirs(out,exist_ok=True)
    open(os.path.join(out,"index.html"),"w",encoding="utf-8").write(build(slug))
    print(f"wrote private-university/{slug}/index.html | {len(RICH[slug]['progs'])} programmes")
