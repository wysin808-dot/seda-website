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

FIELDICON={"商科":"💼","会计与金融":"📊","市场营销":"📣","数据与分析":"📈","IT计算机":"💻","工程":"⚙️","网络安全":"🔐","生命科学":"🧬","医疗健康":"🩺","护理":"❤️","传媒":"🎬","酒店旅游":"🏨","体育运动":"🏅","物流供应链":"🚚","设计":"🎨","经济":"💹","社会科学":"🌐","心理学":"🧠","环境科学":"🌿","教育":"🎓","预科":"📘","商业心理":"🧩","健康科学":"⚕️","时尚设计":"👗"}
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

# ============ Curtin（澳洲直属校区）============
CURTIN_PARTNERS=[("curtin","科廷大学（新加坡）","Curtin University Singapore","新加坡","🇸🇬","澳洲科廷直属校区","QS #183")]
CURTIN_PROGS=[
 ("Pathway Diploma","curtin","文凭","预科","大学预科文凭"),
 ("Bachelor of Commerce (Accounting)","curtin","本科","会计与金融","商务学士（会计）"),
 ("Bachelor of Commerce (Accounting and Finance)","curtin","本科","会计与金融","商务学士（会计与金融）"),
 ("Bachelor of Commerce (Finance)","curtin","本科","会计与金融","商务学士（金融）"),
 ("Bachelor of Commerce (Management)","curtin","本科","商科","商务学士（管理）"),
 ("Bachelor of Commerce (Marketing)","curtin","本科","市场营销","商务学士（市场营销）"),
 ("Bachelor of Commerce (Management and Marketing)","curtin","本科","商科","商务学士（管理与市场营销）"),
 ("Bachelor of Communications (Top-up)","curtin","本科","传媒","传播学学士（专升本）"),
 ("Bachelor of Information Technology","curtin","本科","IT计算机","信息技术学士"),
 ("Bachelor of Computing (Cyber Security)","curtin","本科","网络安全","计算学士（网络安全）"),
 ("Bachelor of Science (Nursing) Conversion (Top-up)","curtin","本科","护理","护理学学士（注册护士转换·专升本）"),
 ("Master of Business Administration (MBA)","curtin","硕士","商科","工商管理硕士（MBA）"),
 ("Master of International Business","curtin","硕士","商科","国际商务硕士"),
 ("Master of Supply Chain Management (Professional)","curtin","硕士","物流供应链","供应链管理硕士（专业）"),
 ("Master of Computing","curtin","硕士","IT计算机","计算硕士"),
 ("Master of Artificial Intelligence","curtin","硕士","IT计算机","人工智能硕士"),
 ("Master of Cyber Security","curtin","硕士","网络安全","网络安全硕士"),
 ("Master of Predictive Analytics (Data Science)","curtin","硕士","数据与分析","预测分析硕士（数据科学）"),
 ("Master of Advanced Practice","curtin","硕士","健康科学","高级实践硕士（护理）"),
 ("Graduate Certificate in Clinical Leadership","curtin","硕士","健康科学","临床领导力研究生证书"),
]

# ============ JCU（澳洲直属校区）============
JCU_PARTNERS=[("jcu","詹姆斯库克大学（新加坡）","James Cook University Singapore","新加坡","🇸🇬","澳洲 JCU 直属校区","QS #440")]
JCU_PROGS=[
 ("Foundation Program","jcu","文凭","预科","大学预科课程"),
 ("Diploma of Higher Education","jcu","文凭","预科","高等教育文凭"),
 ("Bachelor of Business","jcu","本科","商科","商学学士"),
 ("Bachelor of Commerce","jcu","本科","会计与金融","商务学士"),
 ("Bachelor of Information Technology","jcu","本科","IT计算机","信息技术学士"),
 ("Bachelor of Cybersecurity","jcu","本科","网络安全","网络安全学士"),
 ("Bachelor of Psychological Science","jcu","本科","心理学","心理科学学士"),
 ("Bachelor of Business and Environmental Science","jcu","本科","环境科学","商务与环境科学（双学士）"),
 ("Bachelor of Science (Environmental Science)","jcu","本科","环境科学","理学学士（环境科学）"),
 ("Bachelor of Science (Aquaculture)","jcu","本科","生命科学","理学学士（水产养殖）"),
 ("Bachelor of Games Design","jcu","本科","设计","游戏设计学士"),
 ("Bachelor of Tourism, Hospitality and Events","jcu","本科","酒店旅游","旅游、酒店与会展学士"),
 ("Bachelor of Education (Early Childhood Education)","jcu","本科","教育","教育学学士（幼儿教育）"),
 ("Master of Business Administration (MBA)","jcu","硕士","商科","工商管理硕士（MBA）"),
 ("Master of Professional Accounting","jcu","硕士","会计与金融","专业会计硕士"),
 ("Master of International Tourism and Hospitality Management","jcu","硕士","酒店旅游","国际旅游与酒店管理硕士"),
 ("Master of Information Technology","jcu","硕士","IT计算机","信息技术硕士"),
 ("Master of Data Science","jcu","硕士","数据与分析","数据科学硕士"),
 ("Master of Guidance and Counselling","jcu","硕士","心理学","指导与咨询硕士"),
 ("Master of Education","jcu","硕士","教育","教育学硕士"),
 ("Master of Conflict Management and Resolution","jcu","硕士","社会科学","冲突管理与化解硕士"),
]

# ============ LSBF ============
LSBF_PARTNERS=[
 ("greenwich","格林威治大学","University of Greenwich","英国","🇬🇧","LSBF 主要学位伙伴，酒店管理见长","QS #801-850"),
 ("uel","东伦敦大学","University of East London","英国","🇬🇧","网络安全等技术方向","英国伦敦应用型大学"),
 ("chichester","奇切斯特大学","University of Chichester","英国","🇬🇧","市场营销与传播","英国应用型大学"),
 ("mmu","曼彻斯特城市大学","Manchester Metropolitan University","英国","🇬🇧","商科等方向","英国应用型大学"),
 ("lsbf","伦敦商业金融学院","London School of Business and Finance","新加坡","🇸🇬","自颁文凭与 ACCA 备考课程","新加坡本地学府"),
]
LSBF_PROGS=[
 ("BA (Hons) Accounting and Finance","greenwich","本科","会计与金融","会计与金融（荣誉文学士）"),
 ("BA (Hons) Accounting and Finance (Top-up)","greenwich","本科","会计与金融","会计与金融（荣誉文学士·专升本）"),
 ("BA (Hons) Business Management","greenwich","本科","商科","商业管理（荣誉文学士）"),
 ("BA (Hons) Business Studies (Top-up)","greenwich","本科","商科","商学（荣誉文学士·专升本）"),
 ("BA (Hons) Hospitality Management (Top-up)","greenwich","本科","酒店旅游","酒店管理（荣誉文学士·专升本）"),
 ("BA (Hons) Business Logistics and Transport Management (Top-up)","greenwich","本科","物流供应链","商业物流与运输管理（荣誉文学士·专升本）"),
 ("BSc (Hons) Cyber Security Networks","uel","本科","网络安全","网络安全（荣誉理学士）"),
 ("MBA Global","greenwich","硕士","商科","全球工商管理硕士（MBA Global）"),
 ("MA Logistics and Supply Chain Management","greenwich","硕士","物流供应链","物流与供应链管理硕士"),
 ("Advanced Diploma in Accounting and Finance","lsbf","文凭","会计与金融","会计与金融高级大专"),
 ("Advanced Diploma in Business Administration","lsbf","文凭","商科","工商管理高级大专"),
 ("Preparatory Course for ACCA","lsbf","文凭","会计与金融","ACCA 特许会计师备考课程"),
]

# ============ Amity ============
AMITY_PARTNERS=[
 ("uea","东英吉利大学","University of East Anglia","英国","🇬🇧","英国研究型名校（全英前 25）","英国研究型名校"),
 ("uol","伦敦大学","University of London","英国","🇬🇧","MBA 由伦敦玛丽女王大学学术指导","伦敦大学体系"),
 ("teesside","蒂赛德大学","Teesside University","英国","🇬🇧","AI、数据科学与商科见长","英国应用型大学"),
 ("northampton","北安普顿大学","University of Northampton","英国","🇬🇧","商科与商业分析","英国应用型大学"),
 ("amity","Amity 全球教育学院","Amity Global Institute","新加坡","🇸🇬","印度 Amity 集团旗下，自颁文凭与预科","新加坡本地学府"),
]
AMITY_PROGS=[
 ("BA (Hons) Global Business Management (Top-up)","northampton","本科","商科","全球商业管理（荣誉文学士·专升本）"),
 ("BSc (Hons) Computer Science (Top-up)","northampton","本科","IT计算机","计算机科学（荣誉理学士·专升本）"),
 ("BA (Hons) Global Communication with Business Management (Top-up)","uea","本科","传媒","全球传播与商业管理（荣誉文学士·专升本）"),
 ("BSc (Hons) Computing Science with Software Development (Top-up)","uea","本科","IT计算机","计算科学与软件开发（荣誉理学士·专升本）"),
 ("BSc Business Administration","uol","本科","商科","工商管理（理学士）"),
 ("BSc Accounting and Finance","uol","本科","会计与金融","会计与金融（理学士）"),
 ("Master of Business Administration","uol","硕士","商科","工商管理硕士（MBA·玛丽女王学术指导）"),
 ("MSc Supply Chain Management and Global Logistics","uol","硕士","物流供应链","供应链管理与全球物流硕士"),
 ("Master of Business Administration","northampton","硕士","商科","工商管理硕士（MBA）"),
 ("MSc Logistics and Supply Chain Management","northampton","硕士","物流供应链","物流与供应链管理硕士"),
 ("MSc Business Analytics","northampton","硕士","数据与分析","商业分析硕士"),
 ("Master of Business Administration","teesside","硕士","商科","工商管理硕士（MBA）"),
 ("MSc International Management","teesside","硕士","商科","国际管理硕士"),
 ("MSc Accounting and Finance","teesside","硕士","会计与金融","会计与金融硕士"),
 ("MSc Digital Marketing","teesside","硕士","市场营销","数字营销硕士"),
 ("MSc Applied Artificial Intelligence","teesside","硕士","IT计算机","应用人工智能硕士"),
 ("MSc Applied Data Science","teesside","硕士","数据与分析","应用数据科学硕士"),
 ("MA in Education","teesside","硕士","教育","教育学硕士"),
]

# ============ SHRM ============
SHRM_PARTNERS=[
 ("wrexham","雷克瑟姆大学","Wrexham University","英国","🇬🇧","SHRM 主要学位伙伴（酒店 / 商科 / MBA）","英国应用型大学"),
 ("cumbria","坎布里亚大学","University of Cumbria","英国","🇬🇧","MBA 授予","英国应用型大学"),
 ("shrm","SHRM 学院","SHRM College","新加坡","🇸🇬","酒店与旅游专精，自颁高级大专","新加坡本地学府"),
]
SHRM_PROGS=[
 ("Diploma in Business Management","shrm","文凭","商科","工商管理大专"),
 ("Diploma in Hospitality and Tourism Management","shrm","文凭","酒店旅游","酒店与旅游管理大专"),
 ("Advanced Diploma in Business Management","shrm","文凭","商科","工商管理高级大专"),
 ("Advanced Diploma in Hospitality and Tourism Management","shrm","文凭","酒店旅游","酒店与旅游管理高级大专"),
 ("BA (Hons) International Tourism and Hospitality Management (Top-up)","wrexham","本科","酒店旅游","国际旅游与酒店管理（荣誉文学士·专升本）"),
 ("BA (Hons) Hospitality, Tourism and Event Management (Top-up)","wrexham","本科","酒店旅游","酒店、旅游与会展管理（荣誉文学士·专升本）"),
 ("BA (Hons) International Business (Top-up)","wrexham","本科","商科","国际商务（荣誉文学士·专升本）"),
 ("BA (Hons) Business (Top-up)","wrexham","本科","商科","商学（荣誉文学士·专升本）"),
 ("Master of Business Administration (MBA)","wrexham","硕士","商科","工商管理硕士（MBA·Wrexham）"),
 ("Master of Business Administration (MBA)","cumbria","硕士","商科","工商管理硕士（MBA·Cumbria）"),
]

# ============ TMC ============
TMC_PARTNERS=[
 ("aru","安格利亚鲁斯金大学","Anglia Ruskin University","英国","🇬🇧","TMC 现主要学位伙伴","英国应用型大学"),
 ("northampton","北安普顿大学","University of Northampton","英国","🇬🇧","传统合作（招生至 2026 年 7 月）","英国应用型大学"),
 ("tmc","TMC 学院","TMC Academy","新加坡","🇸🇬","新加坡最早私立学府之一，自颁文凭","新加坡本地学府"),
]
TMC_PROGS=[
 ("BSc (Hons) Business with Marketing","aru","本科","市场营销","商业与市场营销（荣誉理学士）"),
 ("BSc (Hons) International Business Management","aru","本科","商科","国际商业管理（荣誉理学士）"),
 ("BSc (Hons) Supply Chain Management","aru","本科","物流供应链","供应链管理（荣誉理学士）"),
 ("BSc (Hons) Business with Tourism Management","aru","本科","酒店旅游","商业与旅游管理（荣誉理学士）"),
 ("Master of Business Administration (MBA)","aru","硕士","商科","工商管理硕士（MBA）"),
 ("BA (Hons) Business and Management (Top-up)","northampton","本科","商科","商业与管理（荣誉文学士·专升本）"),
 ("BA (Hons) Marketing Management (Top-up)","northampton","本科","市场营销","市场营销管理（荣誉文学士·专升本）"),
 ("BSc (Hons) Accounting and Finance","northampton","本科","会计与金融","会计与金融（荣誉理学士）"),
 ("BA (Hons) International Tourism and Hospitality Management (Top-up)","northampton","本科","酒店旅游","国际旅游与酒店管理（荣誉文学士·专升本）"),
 ("BA (Hons) International Logistics and Trade Finance (Top-up)","northampton","本科","物流供应链","国际物流与贸易金融（荣誉文学士·专升本）"),
 ("BSc (Hons) Psychology (Top-up)","northampton","本科","心理学","心理学（荣誉理学士·专升本）"),
 ("BSc (Hons) Psychology and Counselling","northampton","本科","心理学","心理学与咨询（荣誉理学士）"),
 ("BSc (Hons) Software Engineering (Top-up)","northampton","本科","IT计算机","软件工程（荣誉理学士·专升本）"),
 ("BA (Hons) Creative Film, Television and Digital Media Production (Top-up)","northampton","本科","传媒","创意影视与数字媒体制作（荣誉文学士·专升本）"),
 ("MBA (Top-up)","northampton","硕士","商科","工商管理硕士（MBA·专升本）"),
 ("Executive MBA (Top-up)","northampton","硕士","商科","高级工商管理硕士（EMBA·专升本）"),
]

# ============ MDIS ============
MDIS_PARTNERS=[
 ("teesside","蒂赛德大学","Teesside University","英国","🇬🇧","IT / AI / 工程 / 生物医学","英国应用型大学"),
 ("sunderland","桑德兰大学","University of Sunderland","英国","🇬🇧","商科 / 传媒 / 时尚","英国应用型大学"),
 ("napier","爱丁堡龙比亚大学","Edinburgh Napier University","英国","🇬🇧","护理等","英国应用型大学"),
 ("roehampton","罗汉普顿大学","University of Roehampton","英国","🇬🇧","心理学","英国应用型大学"),
 ("bangor","班戈大学","Bangor University","英国","🇬🇧","财会 / 商科（部分招生至 2026/06）","QS #601-650"),
 ("uco","中俄克拉荷马大学","University of Central Oklahoma","美国","🇺🇸","工商管理","美国公立大学"),
 ("mdis","新加坡管理发展学院","MDIS","新加坡","🇸🇬","1956 创办，自颁文凭与预科","新加坡本地学府"),
]
MDIS_PROGS=[
 ("BSc (Hons) Information Technology","teesside","本科","IT计算机","信息技术（荣誉理学士）"),
 ("BSc (Hons) Artificial Intelligence and Computer Science","teesside","本科","IT计算机","人工智能与计算机科学（荣誉理学士）"),
 ("BEng Technology (Hons) Mechanical Engineering (Top-up)","teesside","本科","工程","机械工程技术（荣誉工程学士·专升本）"),
 ("BSc (Hons) Biomedical Sciences","teesside","本科","生命科学","生物医学（荣誉理学士）"),
 ("BA (Hons) Business and Management (Top-up)","sunderland","本科","商科","商业与管理（荣誉文学士·专升本）"),
 ("BA (Hons) Media, Culture and Communication","sunderland","本科","传媒","媒体、文化与传播（荣誉文学士）"),
 ("BA (Hons) Fashion Product and Promotion","sunderland","本科","时尚设计","时尚产品与推广（荣誉文学士）"),
 ("BSc Nursing (Top-up)","napier","本科","护理","护理学（理学士·专升本）"),
 ("BSc (Hons) Psychological and Behavioural Science","roehampton","本科","心理学","心理与行为科学（荣誉理学士）"),
 ("BSc (Hons) Banking and Finance","bangor","本科","会计与金融","银行与金融（荣誉理学士）"),
 ("BSc (Hons) Business Management and Finance","bangor","本科","商科","商业管理与金融（荣誉理学士）"),
 ("Bachelor of Business Administration","uco","本科","商科","工商管理学士（BBA）"),
 ("MBA in Banking and Finance","bangor","硕士","商科","工商管理硕士（银行与金融）"),
 ("MSc Information Technology","teesside","硕士","IT计算机","信息技术理学硕士"),
 ("International Foundation Diploma","mdis","文凭","预科","国际预科文凭"),
 ("Diploma in Business Management","mdis","文凭","商科","工商管理大专"),
 ("Diploma in Information Technology","mdis","文凭","IT计算机","信息技术大专"),
 ("Diploma in Mass Communications","mdis","文凭","传媒","大众传播大专"),
 ("Diploma in Psychology","mdis","文凭","心理学","心理学大专"),
 ("Diploma in Fashion Design","mdis","文凭","时尚设计","时装设计大专"),
 ("Diploma in Tourism and Hospitality Management","mdis","文凭","酒店旅游","旅游与酒店管理大专"),
]

# ============ Kaplan ============
KAPLAN_PARTNERS=[
 ("ucd","都柏林大学","University College Dublin","爱尔兰","🇮🇪","BBS 商学多方向，爱尔兰顶尖","QS #126"),
 ("rhul","皇家霍洛威（伦敦大学）","Royal Holloway, University of London","英国","🇬🇧","管理学多方向，伦敦大学体系","伦敦大学体系"),
 ("essex","埃塞克斯大学","University of Essex","英国","🇬🇧","会计与金融","英国研究型大学"),
 ("northumbria","诺桑比亚大学","Northumbria University","英国","🇬🇧","商科与旅游管理","英国应用型大学"),
 ("portsmouth","朴茨茅斯大学","University of Portsmouth","英国","🇬🇧","会计与 IT / 网络安全（含 CEH）","英国应用型大学"),
 ("murdoch","莫道克大学","Murdoch University","澳大利亚","🇦🇺","商科 / 传媒 / IT / 游戏设计","澳洲应用型大学"),
 ("kaplan","楷博高等教育","Kaplan Higher Education","新加坡","🇸🇬","自颁文凭与基础课程，衔接合作大学本科","新加坡本地学府"),
]
KAPLAN_PROGS=[
 ("Bachelor of Business Studies (Banking and Wealth Management)","ucd","本科","会计与金融","商学学士（银行与财富管理）"),
 ("Bachelor of Business Studies (Finance)","ucd","本科","会计与金融","商学学士（金融）"),
 ("Bachelor of Business Studies (Business with Law)","ucd","本科","法律","商学学士（商业与法律）"),
 ("Bachelor of Business Studies (Digital Business)","ucd","本科","商科","商学学士（数字商业）"),
 ("Bachelor of Business Studies (Human Resource Management)","ucd","本科","商科","商学学士（人力资源管理）"),
 ("Bachelor of Business Studies (Management)","ucd","本科","商科","商学学士（管理）"),
 ("Bachelor of Business Studies (Marketing)","ucd","本科","市场营销","商学学士（市场营销）"),
 ("Bachelor of Business Studies (Logistics and Supply Chain Management)","ucd","本科","物流供应链","商学学士（物流与供应链管理）"),
 ("Bachelor of Business Studies (Project Management)","ucd","本科","商科","商学学士（项目管理）"),
 ("BSc Business and Management","rhul","本科","商科","商业与管理（理学士）"),
 ("BSc Management with Accounting","rhul","本科","会计与金融","管理与会计（理学士）"),
 ("BSc Management with International Business","rhul","本科","商科","管理与国际商务（理学士）"),
 ("BSc Management with Marketing","rhul","本科","市场营销","管理与市场营销（理学士）"),
 ("BA (Hons) Business with International Management","northumbria","本科","商科","商业与国际管理（荣誉文学士）"),
 ("BA (Hons) Business with Tourism Management","northumbria","本科","酒店旅游","商业与旅游管理（荣誉文学士）"),
 ("BA (Hons) Accountancy and Financial Management","portsmouth","本科","会计与金融","会计与财务管理（荣誉文学士）"),
 ("BSc (Hons) Cyber Security and Forensic Computing","portsmouth","本科","网络安全","网络安全与取证计算（荣誉理学士·含 CEH）"),
 ("Bachelor of Business","murdoch","本科","商科","商学学士"),
 ("Bachelor of Communication and Media","murdoch","本科","传媒","传播与媒体学士"),
 ("Bachelor of Information Technology","murdoch","本科","IT计算机","信息技术学士"),
 ("Bachelor of Cyber Security and Forensics","murdoch","本科","网络安全","网络安全与取证学士"),
 ("Bachelor of Games Art and Design","murdoch","本科","设计","游戏艺术与设计学士"),
 ("BSc (Hons) Banking and Finance","essex","本科","会计与金融","银行与金融（荣誉理学士）"),
 ("BA (Hons) Accounting and Finance","essex","本科","会计与金融","会计与金融（荣誉文学士）"),
 ("Master of Business Administration","murdoch","硕士","商科","工商管理硕士（MBA）"),
 ("MSc Finance","essex","硕士","会计与金融","金融理学硕士"),
 ("MSc International Management","northumbria","硕士","商科","国际管理理学硕士"),
]

RICH={
"kaplan":{
 "abbr":"Kaplan","zh":"楷博高等教育（新加坡）","en":"Kaplan Higher Education Singapore","color":"#003a70","founded":2005,
 "tagline":"全球教育集团 Kaplan 旗下 · 专业最广",
 "sig":"全球教育集团 Kaplan 旗下，新加坡<b>专业最广、开课最灵活</b>的私立学府之一；合作 <b>12 所</b>英、澳、爱名校（UCD、Royal Holloway、Northumbria、Murdoch、Essex、Portsmouth 等）授予学位，商科、会计金融、IT、网络安全、传媒、酒店等齐全。EduTrust 认证。",
 "fee":"S$28,000–48,000","fee_note":"本科总学费按合作大学与专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"每年多次开学","edutrust":"EduTrust 认证",
 "china":"取决于合作大学是否在中留服名单（如都柏林大学、皇家霍洛威等）；申请前请在中留服官网核实具体学位。",
 "overview":[
   "Kaplan 新加坡隶属<b>全球教育集团 Kaplan</b>，是本地<b>专业最广、开课最灵活</b>的私立学府之一，市中心校区、转专业与衔接灵活，持 EduTrust 认证。",
   "合作 <b>12 所</b>大学（UCD、Royal Holloway、Northumbria、Murdoch、Essex、Portsmouth、Griffith、Monash、RMIT、Swinburne、Birmingham City、南澳大学）授予学位。<b>都柏林大学（UCD）的商学学士（BBS）多方向</b>最热门，会计金融、IT/网络安全、传媒、游戏设计等同样齐全。",
   "本科多可专升本（Top-up）或文凭衔接，硕士约 12 个月，适合想要英澳爱名校学位、专业选择多的学生。",
 ],
 "highlights":[("专业最广","12 所合作大学、方向最全"),("开课灵活","多次开学、转专业灵活"),("市中心","衔接快、生活便利")],
 "pathway":[("文凭 / 基础课程","Kaplan 文凭，按学历入读，衔接合作大学本科。"),
   ("本科学位","凭文凭直入 / 专升本（Top-up），合作大学颁发学位。"),
   ("硕士学位","MBA / MSc，约 12 个月，合作大学颁发。")],
 "finder":"https://www.kaplan.com.sg/","coverage":"以下为 Kaplan 各主要合作大学的代表学位专业；Kaplan 合作 12 所大学、开设更多专业，完整清单见官方课程页。",
 "partners":KAPLAN_PARTNERS,"progs":KAPLAN_PROGS,
},
"mdis":{
 "abbr":"MDIS","zh":"新加坡管理发展学院","en":"Management Development Institute of Singapore (MDIS)","color":"#c81432","founded":1956,
 "tagline":"新加坡历史最悠久的私立学府（1956）",
 "sig":"<b>新加坡历史最悠久的非营利私立学府</b>（1956 年创办），自有校园与宿舍；合作英国 Teesside、Sunderland、Edinburgh Napier、Roehampton、Bangor 及美国中俄克拉荷马大学，<b>专业覆盖最广</b>——商科、工程、生科、时尚、传媒、心理、护理、IT。EduTrust 认证。",
 "fee":"S$28,000–48,000","fee_note":"本科总学费按合作大学与专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"每年多次开学","edutrust":"EduTrust 认证",
 "china":"MDIS 有 8 所英国合作大学的部分专业获中国教育部（中留服）认证（含 Sunderland、Portsmouth、Bangor、Roehampton、Northumbria、Teesside、Leeds Beckett、Edinburgh Napier）；申请前请在中留服官网核实具体专业。",
 "overview":[
   "MDIS（新加坡管理发展学院）创办于 <b>1956 年</b>，是新加坡<b>历史最悠久的非营利私立学府</b>，拥有自有校园与学生宿舍，持 EduTrust 认证。",
   "合作<b>英国 Teesside、Sunderland、Edinburgh Napier、Roehampton、Bangor</b> 及<b>美国中俄克拉荷马大学</b>授予学位，<b>专业覆盖最广</b>——商科、工程、生命科学、时尚设计、传媒、心理学、护理、信息技术等。",
   "提供从国际预科到博士的完整路径，本科多可专升本（Top-up）。适合想要稳健老牌私校、专业选择多、目标英国学位的学生。",
 ],
 "highlights":[("历史最悠久","1956 创办、非营利"),("专业最广","8+ 学科、自有校园宿舍"),("多国合作","英美 6+ 所大学")],
 "pathway":[("预科 / 文凭","国际预科或 MDIS 文凭，按学历入读，衔接本科。"),
   ("本科学位","2–3 年或专升本（Top-up），合作大学颁发学位。"),
   ("硕士学位","MBA / MSc 等，合作大学颁发。")],
 "finder":"https://www.mdis.edu.sg/degree","coverage":"以下为 MDIS 各合作大学的主要学位专业；Bangor 部分专业招生至 2026/06，MDIS 另有更多文凭与方向，完整清单见官方课程页。",
 "partners":MDIS_PARTNERS,"progs":MDIS_PROGS,
},
"shrm":{
 "abbr":"SHRM","zh":"SHRM 学院","en":"SHRM College Singapore","color":"#8a6d1f","founded":2007,
 "tagline":"酒店与旅游管理专精",
 "sig":"<b>酒店与旅游管理专精</b>的私立学院（2007 年创办，前身 SHRM 酒店与度假村管理学院）；合作英国 <b>Wrexham、Cumbria</b> 授予学位，课程偏实操与行业实训。EduTrust 4 年认证。",
 "fee":"S$30,000–45,000","fee_note":"本科总学费按专业与学制不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"每年多次开学","edutrust":"EduTrust 4 年认证",
 "china":"取决于合作大学是否在中留服名单；申请前请在中留服官网核实具体学位。",
 "overview":[
   "SHRM 学院 2007 年创办（前身为 SHRM 酒店与度假村管理学院），是新加坡<b>酒店与旅游管理专精</b>的私立学院，持 EduTrust 4 年认证。",
   "合作<b>英国雷克瑟姆大学（Wrexham）、坎布里亚大学（Cumbria）</b>，提供国际旅游与酒店管理、酒店与会展管理、国际商业的<b>专升本（Top-up）</b>学位及 MBA；课程<b>偏实操与行业实训</b>。",
   "适合立志酒店 / 旅游 / 服务业管理、想用高级大专快速衔接英国学位的学生。",
 ],
 "highlights":[("酒店专精","行业实训、实操导向"),("英国学位","Wrexham / Cumbria 授予"),("专升本快","高级大专衔接本科")],
 "pathway":[("文凭 / 高级大专","SHRM 自颁，按学历入读，衔接英国本科。"),
   ("本科学位（Top-up）","Wrexham 专升本，拿英国学位。"),
   ("硕士 MBA","Wrexham 或 Cumbria 的 MBA。")],
 "finder":"https://shrm.edu.sg/","coverage":"以下为 SHRM 主要学位与高级大专专业；完整清单见官方课程页。",
 "partners":SHRM_PARTNERS,"progs":SHRM_PROGS,
},
"tmc":{
 "abbr":"TMC","zh":"TMC 学院","en":"TMC Academy","color":"#b3243b","founded":1981,
 "tagline":"新加坡最早的私立学府之一（1981）",
 "sig":"<b>新加坡最早的私立学府之一</b>（1981 年创办），专业面广——商科、IT、<b>心理学</b>、酒店旅游、传媒等；现主要合作英国 <b>Anglia Ruskin</b> 授予学位。EduTrust 4 年认证。",
 "fee":"S$28,000–45,000","fee_note":"本科总学费按合作大学与专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"每年多次开学","edutrust":"EduTrust 4 年认证",
 "china":"取决于合作大学是否在中留服名单；申请前请在中留服官网核实具体学位。",
 "overview":[
   "TMC 学院 1981 年创办，是<b>新加坡最早的私立学府之一</b>，专业面广、老牌稳健，持 EduTrust 4 年认证。",
   "现主要合作<b>英国 Anglia Ruskin 大学（ARU）</b>授予商科学位；另与<b>北安普顿大学</b>合作的多个专业（商科、会计、心理、酒店、传媒、软件等）<b>招生至 2026 年 7 月</b>。商科、心理学、酒店旅游是其传统强项。",
   "本科多为 Top-up（专升本），适合想要英国大学学位、走商科 / 心理 / 酒店方向的学生。",
 ],
 "highlights":[("老牌资历","1981 创办，新加坡最早之一"),("专业面广","商科 / 心理 / 酒店 / 传媒 / IT"),("英国学位","Anglia Ruskin 等授予")],
 "pathway":[("文凭 / 高级文凭","TMC 自颁，按学历入读，衔接英国本科。"),
   ("本科学位（Top-up）","凭文凭专升本，拿英国大学学位。"),
   ("硕士 MBA","MBA / Executive MBA。")],
 "finder":"https://www.tmc.edu.sg/","coverage":"以下为 TMC 主要学位专业；北安普顿合作专业招生至 2026 年 7 月，完整与最新清单见官方课程页。",
 "partners":TMC_PARTNERS,"progs":TMC_PROGS,
},
"amity":{
 "abbr":"Amity","zh":"Amity 全球教育学院（新加坡）","en":"Amity Global Institute Singapore","color":"#00325a","founded":2007,
 "tagline":"印度 Amity 教育集团旗下 · 国际化",
 "sig":"印度 Amity 教育集团旗下的新加坡校区，学生来自 45+ 国家；合作英国 <b>UEA、伦敦大学、Teesside、Northampton</b> 授予学位，<b>商科、人工智能 / 数据科学、物流与酒店旅游</b>见长。EduTrust 4 年认证。",
 "fee":"S$28,000–45,000","fee_note":"本科 / 硕士总学费按合作大学与专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"每年多次开学","edutrust":"EduTrust 4 年认证",
 "china":"取决于合作大学（如伦敦大学、UEA）是否在中留服名单；申请前请在中留服官网核实具体学位。",
 "overview":[
   "Amity 全球教育学院新加坡校区隶属<b>印度 Amity 教育集团</b>，学生来自 45 个以上国家，国际化氛围浓，持 EduTrust 4 年认证。",
   "合作<b>英国东英吉利（UEA）、伦敦大学（MBA 由伦敦玛丽女王大学学术指导）、蒂赛德、北安普顿</b>授予学位。近年在 <b>人工智能、数据科学</b>方向（Teesside）开设多个硕士，商科、物流供应链、数字营销同样齐全。",
   "本科多为 Top-up（专升本），硕士约 12 个月，适合想要英国大学学位、走商科 / 数据 / 物流方向的学生。",
 ],
 "highlights":[("英国学位","UEA / 伦敦大学 / Teesside / Northampton"),("AI·数据强","Teesside 多个 AI / 数据硕士"),("国际化","学生来自 45+ 国家")],
 "pathway":[("预科 / 文凭","Amity 预科或文凭，按学历入读，达标衔接本科。"),
   ("本科学位（Top-up）","凭文凭专升本，拿英国大学学位。"),
   ("硕士学位","MBA / MSc（商科、AI、数据、物流等），约 12 个月。")],
 "finder":"https://www.amitysingapore.sg/programmes",
 "coverage":"以下为 Amity 主要学位专业；Amity 另有更多文凭、预科与专业资格课程，完整清单见官方课程页。",
 "partners":AMITY_PARTNERS,"progs":AMITY_PROGS,
},
"lsbf":{
 "abbr":"LSBF","zh":"伦敦商业金融学院（新加坡）","en":"London School of Business and Finance Singapore","color":"#16306b","founded":2007,
 "tagline":"专注商科、财会与金融",
 "sig":"伦敦商业金融学院新加坡校区，专注<b>商科、会计金融与酒店管理</b>；合作英国格林威治大学等授予学位，课程偏实务与职业资格（如 ACCA）衔接。EduTrust 4 年认证。",
 "fee":"S$28,000–46,000","fee_note":"本科总学费按合作大学与专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"1 / 5 / 9 月","edutrust":"EduTrust 4 年认证",
 "china":"取决于合作大学（如格林威治大学）是否在中留服名单；申请前请在中留服官网核实具体学位。",
 "overview":[
   "LSBF（伦敦商业金融学院）新加坡校区<b>专注商科、会计金融与酒店管理</b>，合作<b>英国格林威治大学</b>等授予学位，持 EduTrust 4 年认证。",
   "课程偏<b>实务与职业资格衔接</b>——会计金融方向与 <b>ACCA</b>（特许会计师）紧密结合，可走「ACCA 备考 → 应用会计学位」路线；酒店管理（格林威治该学科 QS 全球前 175）与商业物流也是特色。",
   "本科多为 Top-up（专升本，最快约 8–12 个月），适合已有大专 / 文凭、目标财会 / 金融职业路径的学生。",
 ],
 "highlights":[("财会见长","ACCA 衔接、应用会计强"),("英国学位","格林威治等授予"),("实务导向","职业资格 + 快速专升本")],
 "pathway":[("文凭 / ACCA 备考","按学历入读 LSBF 高级大专或 ACCA 备考课程。"),
   ("本科学位（Top-up）","凭文凭专升本，最快约 8–12 个月拿格林威治等英国学位。"),
   ("硕士学位","MBA Global、物流与供应链管理硕士等，约 12 个月。")],
 "finder":"https://www.lsbf.edu.sg/programmes",
 "coverage":"以下为 LSBF 主要学位专业；LSBF 另有更多文凭、专业资格与中文课程，完整清单见官方课程页。",
 "partners":LSBF_PARTNERS,"progs":LSBF_PROGS,
},
"curtin":{
 "abbr":"Curtin","zh":"科廷大学（新加坡）","en":"Curtin University Singapore","color":"#1a1a1a","founded":2008,
 "direct":True,"qs":"#183",
 "tagline":"澳洲科廷大学直属校区",
 "sig":"澳洲科廷大学（QS 世界 #183）的新加坡直属校区，颁发与本部<b>完全一致</b>的学位；商科、会计金融、传媒与信息科技见长，学制紧凑、可加速完成。",
 "fee":"S$55,000–70,000","fee_note":"本科总学费（直属校区较高），按专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"2 / 6 / 10 月（每年多次开学）","edutrust":"EduTrust 认证",
 "china":"直属海外校区学位，中留服认证相对稳妥（以当年名单为准）。",
 "overview":[
   "Curtin 新加坡是澳洲科廷大学（QS 世界 #183，澳洲八大之外的实力派）的<b>直属校区</b>，2008 年设立，颁发与本部<b>完全一致</b>的学位、全球认可。",
   "<b>商科与会计金融</b>是招牌（会计 / 金融 QS 学科全球前 200），<b>传媒、大众传播、广告</b>同样见长，信息技术、网络安全、人工智能与护理方向齐全；学制紧凑、可加速完成。",
   "适合想要澳洲正规商科 / 传媒学位、快速衔接就业、中留服认证稳的中国学生。",
 ],
 "highlights":[("同款学位","与澳洲本部一致，QS #183"),("商科 + 传媒","双强项见长"),("加速完成","学制紧凑、省时省钱")],
 "why":[
   ("🎓","澳洲同款学位","与澳洲科廷本部完全相同的学位，QS #183、全球认可。"),
   ("💼","商科招牌","会计、金融、管理、市场营销等商科方向强、就业广。"),
   ("🎙️","传媒强项","传播、大众传媒、广告等创意产业方向见长。"),
   ("💻","IT 与网络安全","信息技术、网络安全、人工智能、数据科学齐全。"),
   ("⏩","学制紧凑","加速完成，省时省钱，与本部同质。"),
   ("🇨🇳","高中即可申请","预科衔接本科，无需高考，中留服认证稳。"),
 ],
 "pathway":[("预科 / 英语","Pathway Diploma 或英语课程，按学历入读，达标直入本科。"),
   ("本科学位","商务 / 传媒 / IT 等，科廷自授、与澳洲本部一致。"),
   ("研究生 / 硕士","MBA、国际商务、计算、AI、网络安全、护理等硕士。"),
   ("博士研究","研究型高级学位（Higher Degree by Research）。")],
 "finder":"https://www.curtin.edu.sg/courses/",
 "coverage":"以下为 Curtin 新加坡主要学位专业（取自官方课程页）；完整清单见官方课程页。",
 "partners":CURTIN_PARTNERS,"progs":CURTIN_PROGS,
},
"jcu":{
 "abbr":"JCU","zh":"詹姆斯库克大学（新加坡）","en":"James Cook University Singapore","color":"#009ca6","founded":2003,
 "direct":True,"qs":"#440",
 "tagline":"澳洲詹姆斯库克大学直属校区",
 "sig":"澳洲詹姆斯库克大学（QS 世界 #440）的新加坡直属校区，颁发与本部<b>完全相同</b>的学位；一年 3 学期、最快约 2 年读完本科。海洋与环境科学、心理学、商科、IT、酒店旅游见长。",
 "fee":"S$55,000–72,000","fee_note":"本科总学费（直属校区较高），按专业不同；以官方为准。私立大学不提供 MOE 政府津贴。",
 "intake":"3 / 7 / 11 月（每年 3 次开学）","edutrust":"EduTrust 认证",
 "china":"直属海外校区学位，中留服认证相对稳妥（以当年名单为准）。",
 "overview":[
   "JCU 新加坡是澳洲詹姆斯库克大学（QS 世界 #440）的<b>直属校区</b>，2003 年设立，颁发与澳洲本部<b>完全相同</b>的学位，全球认可。",
   "采用<b>一年 3 学期</b>的加速学制，最快约 <b>2 年</b>读完本科，比常规省时省钱。海洋生物学全球领先，<b>环境科学、水产养殖、心理学</b>是招牌，商科、IT、网络安全、酒店旅游、教育同样齐全。",
   "适合想要正规海外大学学位、中留服认证稳、又看重时间与性价比的中国学生。",
 ],
 "highlights":[("同款学位","与澳洲本部完全一致，全球认可"),("最快 2 年","一年 3 学期加速完成"),("海洋与心理","环境/水产/心理学是招牌")],
 "why":[
   ("🎓","澳洲同款学位","与澳洲 JCU 本部完全相同的学位，全球认可、中留服认证稳。"),
   ("⏩","最快 2 年本科","一年 3 学期、加速完成，省时省钱。"),
   ("🌊","海洋与环境强项","JCU 海洋生物学全球领先，环境科学、水产养殖特色鲜明。"),
   ("🧠","心理学招牌","心理学、商业心理、指导与咨询是 JCU 强项。"),
   ("💼","商科 IT 齐全","商务、会计、IT、网络安全、酒店旅游等就业方向广。"),
   ("🇨🇳","高中即可申请","预科 / 大专衔接本科，无需高考，约 2 年拿学位。"),
 ],
 "pathway":[("预科 / 大专","Foundation 或高等教育文凭，按学历入读；达标可直入本科。"),
   ("本科学位","约 2 年（一年 3 学期加速），JCU 自授、与澳洲本部一致。"),
   ("荣誉 / 硕士","可读荣誉学位年或衔接 JCU 硕士（MBA、IT、心理、教育等）。"),
   ("博士研究","提供研究型高级学位（Higher Degrees by Research）。")],
 "finder":"https://www.jcu.edu.sg/courses-and-study/courses",
 "coverage":"以下为 JCU 新加坡主要学位专业；完整清单（含细分方向与博士）见 JCU 官方课程页。",
 "partners":JCU_PARTNERS,"progs":JCU_PROGS,
},
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
    direct=d.get("direct",False)  # 直属校区（如 JCU/Curtin）：自授学位、无多合作大学
    npartners=len([p for p in partners if p[0]!=slug])  # 合作大学数（排除自身）
    pmap={p[0]:p for p in partners}  # key -> tuple
    fields=[]
    for _,_,_,f,_ in progs:
        if f not in fields: fields.append(f)
    levels=sorted({p[2] for p in progs},key=lambda x:LEVELORDER.get(x,9))
    n_b=sum(1 for p in progs if p[2]=="本科"); n_m=sum(1 for p in progs if p[2]=="硕士"); n_d=sum(1 for p in progs if p[2]=="文凭")
    # partner counts
    def pcount(key,lv): return sum(1 for p in progs if p[1]==key and p[2]==lv)
    canon=f"https://sgeda.org.cn/private-university/{slug}/"
    if direct:
        title=f"{d['zh']}（{d['abbr']}）完整指南：澳洲直属校区、{len(progs)}+ 专业数据库、升学路径与学费 | SEDA"
        desc=f"{d['zh']}（{d['en']}）深度指南：澳洲大学直属校区，自授与本部一致的学位；{len(progs)}+ 个专业（本科 {n_b}、硕士 {n_m}）可筛选数据库；学科方向、升学路径、入学要求、学费与中留服认证。"
    else:
        title=f"{d['zh']}（{d['abbr']}）完整指南：{npartners} 所合作大学、{len(progs)}+ 专业数据库、升学路径与学费 | SEDA"
        desc=f"{d['zh']}（{d['en']}）深度指南：与 {npartners} 所英澳新大学合作，{len(progs)}+ 个专业（本科 {n_b}、硕士 {n_m}、文凭 {n_d}）可筛选数据库；合作大学、升学路径、入学要求、学费与中留服认证。"
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
        pntag='' if direct else f'<span class="t pn">{esc(pz)}</span>'
        return f'''<div class="prc-prog" data-pt="{key}" data-lv="{lv}" data-fl="{esc(fl)}" data-name="{esc(nm)}">
  <div class="nm">{esc(zh)}</div>
  <div class="ens">{esc(en)}</div>
  <div class="meta"><span class="t lv {lv}">{lv}</span><span class="t fl">{FIELDICON.get(fl,"")} {esc(fl)}</span>{pntag}</div>
</div>'''
    order=sorted(progs,key=lambda p:(LEVELORDER.get(p[2],9),p[3],p[0]))
    progcards="".join(prog_card(p) for p in order)
    fieldchips="".join(f'<span class="prc-chip" data-f="fl" data-v="{esc(f)}">{FIELDICON.get(f,"")} {esc(f)}（{sum(1 for p in progs if p[3]==f)}）</span>' for f in fields)
    ptchips="" if direct else "".join(f'<span class="prc-chip" data-f="pt" data-v="{k}">{esc(z)}</span>' for k,z,*_ in partners if any(p[1]==k for p in progs))
    ptrow=f'<div class="prc-frow"><span class="prc-flb">合作大学</span>{ptchips}</div>' if ptchips else ''
    lvchips="".join(f'<span class="prc-chip" data-f="lv" data-v="{lv}">{lv}（{sum(1 for p in progs if p[2]==lv)}）</span>' for lv in levels)
    hl="".join(f'<div class="prc-hlc"><b>{esc(t)}</b><span>{esc(x)}</span></div>' for t,x in d["highlights"])
    ov="".join(f'<p class="ov">{p}</p>' for p in d["overview"])
    pathhtml="".join(f'<div class="prc-step"><div class="no">{i+1}</div><b>{esc(t)}</b><span>{x}</span></div>' for i,(t,x) in enumerate(d["pathway"]))
    pnames="、".join(z for k,z,*_ in partners if k!=slug)
    if direct:
        faq1=(f"{d['abbr']} 和澳洲本部是什么关系？",f"{d['zh']}是澳洲詹姆斯库克大学的<b>直属校区</b>，颁发与澳洲本部<b>完全相同</b>的学位、全球认可；学制更紧凑，最快约 2 年读完本科。")
    else:
        faq1=(f"{d['abbr']} 和哪些大学合作？",f"{d['zh']}与 {npartners} 所大学合作：{pnames}。学位由合作大学颁发，与其本校区一致。")
    faqs=[faq1,
     (f"{d['abbr']} 有多少专业？",f"本页收录约 {len(progs)} 个主要专业（本科 {n_b}、硕士 {n_m}{('、文凭 '+str(n_d)) if n_d else ''}），覆盖 {len(fields)} 大方向，可按方向{('' if direct else '、合作大学')}、层级筛选；完整清单见学校官方课程页。"),
     (f"{d['abbr']} 的学位中留服认可吗？",d["china"]),
     ("中国学生没有高考能申请吗？","可以。接受高中毕业证 + 成绩单，按学历从预科 / 文凭起读；英语雅思约 5.5（本科段 6.0–6.5），不达标可先读语言 / 预科课程。"),
     (f"{d['abbr']} 学费多少？",f"本科总学费约 {d['fee']}。{d['fee_note']} 学费通常可按学期分期。"),
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
    WHITE_LOGO_RICH={"psb","kaplan"}  # 白色 logo → 直接放彩色 hero（透明牌），不用白底
    if lg and slug in WHITE_LOGO_RICH:
        logohtml=f'<div class="prc-dlogo" style="background:transparent;box-shadow:none;padding:0;margin-bottom:14px"><img src="{lg}?v=1" style="height:46px" alt="{esc(d["zh"])} 校徽"></div>'
    elif lg:
        logohtml=f'<div class="prc-dlogo"><img src="{lg}?v=1" alt="{esc(d["zh"])} 校徽"></div>'
    else:
        logohtml=''
    rel="".join(f'<a href="/private-university/{o}/">{o.upper()}</a>' for o in ["sim","kaplan","jcu","mdis"] if o!=slug)
    # 直属校区 vs 合作办学：中段与统计条
    if direct:
        whyhtml="".join(f'<div class="prc-hlc"><b>{ic} {esc(t)}</b><span>{esc(x)}</span></div>' for ic,t,x in d.get("why",[]))
        midsec=f'''<section class="prc-sec tight"><h2>为什么选 {esc(d['abbr'])}<span style="color:{acc}"> · 直属校区</span></h2>
    <p class="lead">澳洲大学的新加坡直属校区，自授与本部完全一致的学位。</p>
    <div class="prc-hl">{whyhtml}</div></section>'''
        stat1=f'<div class="prc-stat"><div class="n">直属</div><div class="l">澳洲本部校区</div></div>'
        statqs=f'<div class="prc-stat"><div class="n">{esc(d.get("qs","—"))}</div><div class="l">QS 世界排名</div></div>'
        factrows=f'<tr><th>办学类型</th><td>澳洲大学直属校区（私立学府）</td></tr><tr><th>学位授予</th><td>{esc(d["en"])}（与澳洲本部同款学位）</td></tr><tr><th>本科学制</th><td>最快约 2 年（一年 3 学期，加速完成）</td></tr>'
        dbfilterword="方向、层级"
    else:
        midsec=f'''<section class="prc-sec tight"><h2>合作大学 · {npartners} 所</h2>
    <p class="lead">学位由以下大学颁发，与其本校区一致。点专业数据库可看各校具体专业。</p>
    <div class="prc-partners">{pcards}</div></section>'''
        stat1=f'<div class="prc-stat"><div class="n">{npartners} 所</div><div class="l">合作大学</div></div>'
        statqs=''
        factrows=f'<tr><th>办学类型</th><td>合作名校学位（私立学府）</td></tr><tr><th>合作大学</th><td>{esc("、".join(z for k,z,*_ in partners if k!=slug))}</td></tr><tr><th>本科学制</th><td>直入大二最快约 16 个月 / Top-up 最快约 8 个月</td></tr>'
        dbfilterword="方向、合作大学、层级"
    statshtml=f'''{stat1}
      <div class="prc-stat"><div class="n">{len(progs)}+</div><div class="l">专业 / 课程</div></div>
      <div class="prc-stat"><div class="n">{len(fields)} 大</div><div class="l">专业方向</div></div>
      {statqs}
      <div class="prc-stat"><div class="n">{d['founded']}</div><div class="l">创办</div></div>
      <div class="prc-stat"><div class="n">🎖</div><div class="l">{esc(d['edutrust'])}</div></div>'''
    body=f'''
  <section class="prc-hero" style="background:{accgrad}"><div class="in">
    {logohtml}
    <h1>{esc(d['zh'])} <span style="opacity:.7;font-size:.6em">{esc(d['abbr'])}</span></h1>
    <p class="tag">{esc(d['en'])} · {esc(d['tagline'])}</p>
    <p class="sig">{esc(d['sig'])}</p>
    <div class="prc-stats">
      {statshtml}
    </div>
  </div></section>

  <section class="prc-sec"><h2>学校概况</h2>{ov}<div class="prc-hl">{hl}</div></section>

  {midsec}

  <section class="prc-sec tight"><h2>升学路径</h2>
    <p class="lead">中国学生典型路线：按学历从预科 / 文凭 / 本科对应阶段入读，学历达标可跳过前段。</p>
    <div class="prc-path">{pathhtml}</div></section>

  <div class="prc-db">
    <div class="prc-tools">
      <h2 style="font-size:clamp(21px,2.8vw,29px);margin:6px 0 4px;font-weight:830">专业数据库 · <span style="color:{acc}">{len(progs)} 个</span></h2>
      <p style="color:var(--prc-muted);margin:0 0 16px;line-height:1.7">本科 {n_b} · 硕士 {n_m}{(' · 文凭 '+str(n_d)) if n_d else ''}。可按<b>{dbfilterword}</b>筛选；专业名为官方授予名称{('，由 '+esc(d['abbr'])+' 颁授' if direct else '，学位由对应合作大学颁发')}。</p>
      <div class="prc-find">🔎<input type="search" id="prcq" placeholder="搜专业，如 商科、心理、IT、护理"></div>
      <div class="prc-frow"><span class="prc-flb">方向</span>{fieldchips}</div>
      {ptrow}
      <div class="prc-frow"><span class="prc-flb">层级</span>{lvchips}</div>
    </div>
    <div class="prc-count">显示 <b id="prcshow">{len(progs)}</b> / {len(progs)} 个专业</div>
    <div class="prc-progs" id="prcprogs">{progcards}</div>
    <div class="prc-empty" id="prcempty">没有匹配的专业，试试减少筛选条件。</div>
    <p style="max-width:1080px;margin:0 auto;padding:0 clamp(20px,6vw,80px) 34px;font-size:.82rem;color:var(--prc-muted)">{esc(d.get("coverage",""))} 数据来自 {d['en']} 官网课程信息；专业每年略有调整，精确学费 / 学制以官方为准。{(f' <a href="{d["finder"]}" target="_blank" rel="nofollow" style="color:var(--acc);font-weight:700">→ 官方完整专业查找器</a>') if d.get("finder") else ""}</p>
  </div>

  <section class="prc-sec"><h2>关键信息</h2>
    <div class="prc-facts"><table>
      {factrows}
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

def build_aggregate():
    # 汇总 10 所私立大学全部专业 → 一个总数据库
    ORDER=["psb","kaplan","sim","mdis","jcu","curtin","amity","tmc","lsbf","shrm"]
    rows=[]
    for slug in ORDER:
        if slug not in RICH: continue
        d=RICH[slug]; pmap={p[0]:p for p in d["partners"]}
        for en,key,lv,fl,zh in d["progs"]:
            pz=pmap[key][1] if key in pmap else ""
            rows.append((zh,en,slug,d["abbr"],d["color"],pz,lv,fl,d.get("direct",False)))
    N=len(rows)
    fields=[]
    for r in rows:
        if r[7] not in fields: fields.append(r[7])
    fields=sorted(fields,key=lambda f:-sum(1 for r in rows if r[7]==f))
    levels=sorted({r[6] for r in rows},key=lambda x:LEVELORDER.get(x,9))
    acc="#7e2d3a"; accgrad="linear-gradient(135deg,#241a1e,#7e2d3a)"
    canon="https://sgeda.org.cn/private-university/courses/"
    title="新加坡私立大学专业数据库：10 所私立大学 %d 个专业一站查询（合作大学 / 方向 / 层级）| SEDA"%N
    desc="新加坡 10 所主流私立大学（SIM/Kaplan/PSB/JCU/MDIS/Curtin/LSBF/Amity/SHRM/TMC）共 %d 个本科、硕士与文凭专业的可筛选数据库，按学校、专业方向、层级与合作大学查询，含官方英文名与中文名。"%N
    def card(r):
        zh,en,slug,abbr,color,pz,lv,fl,direct=r
        nm=(zh+" "+en+" "+abbr+" "+pz+" "+fl+" "+lv).lower()
        pntag='' if direct else (f'<span class="t pn">{esc(pz)}</span>' if pz else '')
        return f'''<div class="prc-prog" data-school="{slug}" data-lv="{lv}" data-fl="{esc(fl)}" data-name="{esc(nm)}">
  <div class="nm">{esc(zh)}</div><div class="ens">{esc(en)}</div>
  <div class="meta"><a class="t sch" href="/private-university/{slug}/" style="background:{color}">{esc(abbr)}</a><span class="t lv {lv}">{lv}</span><span class="t fl">{FIELDICON.get(fl,"")} {esc(fl)}</span>{pntag}</div>
</div>'''
    cards="".join(card(r) for r in rows)
    schoolchips="".join(f'<span class="prc-chip" data-f="school" data-v="{slug}" style="--c:{RICH[slug]["color"]}">{esc(RICH[slug]["abbr"])}（{sum(1 for r in rows if r[2]==slug)}）</span>' for slug in ORDER if slug in RICH)
    fieldchips="".join(f'<span class="prc-chip" data-f="fl" data-v="{esc(f)}">{FIELDICON.get(f,"")} {esc(f)}（{sum(1 for r in rows if r[7]==f)}）</span>' for f in fields)
    lvchips="".join(f'<span class="prc-chip" data-f="lv" data-v="{lv}">{lv}（{sum(1 for r in rows if r[6]==lv)}）</span>' for lv in levels)
    nb=sum(1 for r in rows if r[6]=="本科"); nm_=sum(1 for r in rows if r[6]=="硕士"); nd=sum(1 for r in rows if r[6]=="文凭")
    jsonld=[
     {"@context":"https://schema.org","@type":"Dataset","name":"新加坡私立大学专业数据库",
      "description":desc,"url":canon,"inLanguage":"zh-CN","isAccessibleForFree":True,
      "keywords":"新加坡私立大学,专业,SIM,Kaplan,PSB,MDIS,JCU,Curtin,合作大学,本科,硕士","creator":{"@type":"Organization","name":"SEDA 新加坡择校网"}},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
       {"@type":"ListItem","position":2,"name":"新加坡私立大学","item":"https://sgeda.org.cn/private-university/"},
       {"@type":"ListItem","position":3,"name":"专业数据库"}]},
    ]
    body=f'''
  <section class="prc-hero" style="background:{accgrad}"><div class="in">
    <div class="prc-dlogo" style="background:transparent;box-shadow:none;padding:0;margin-bottom:12px"><span style="color:#fff;font-weight:800;font-size:.9rem;letter-spacing:.05em">🎓 私立大学专业总库</span></div>
    <h1>新加坡私立大学专业数据库</h1>
    <p class="tag">10 所私立大学 · {N} 个专业 · 一站查询</p>
    <p class="sig">SIM、Kaplan、PSB、JCU、MDIS、Curtin、LSBF、Amity、SHRM、TMC 的全部本科 / 硕士 / 文凭专业汇总，可按<b>学校、专业方向、层级</b>筛选；专业名含官方英文名与中文名，点学校标签进各校详情页。</p>
    <div class="prc-stats">
      <div class="prc-stat"><div class="n">{N}</div><div class="l">专业总数</div></div>
      <div class="prc-stat"><div class="n">10 所</div><div class="l">私立大学</div></div>
      <div class="prc-stat"><div class="n">{nb}</div><div class="l">本科</div></div>
      <div class="prc-stat"><div class="n">{nm_}</div><div class="l">硕士</div></div>
      <div class="prc-stat"><div class="n">{nd}</div><div class="l">文凭</div></div>
    </div>
  </div></section>
  <div class="prc-db" style="border-top:0">
    <div class="prc-tools">
      <div class="prc-find">🔎<input type="search" id="prcq" placeholder="搜专业 / 学校 / 合作大学，如 会计、AI、护理、Murdoch"></div>
      <div class="prc-frow"><span class="prc-flb">学校</span>{schoolchips}</div>
      <div class="prc-frow"><span class="prc-flb">方向</span>{fieldchips}</div>
      <div class="prc-frow"><span class="prc-flb">层级</span>{lvchips}</div>
    </div>
    <div class="prc-count">显示 <b id="prcshow">{N}</b> / {N} 个专业</div>
    <div class="prc-progs" id="prcprogs">{cards}</div>
    <div class="prc-empty" id="prcempty">没有匹配的专业，试试减少筛选条件。</div>
    <p style="max-width:1080px;margin:0 auto;padding:0 clamp(20px,6vw,80px) 36px;font-size:.82rem;color:var(--prc-muted)">数据汇总自各校官网；大校（SIM/Kaplan 等）收录主要专业，完整清单见各校详情页与官方查找器。专业每年略有调整、精确学费学制以官方为准。</p>
  </div>
  <section class="prc-sec tight"><div class="prc-cta"><h3>不知道选哪所 / 哪个专业？</h3><p>告诉我们你的成绩、预算与目标方向，免费匹配最合适的私立大学与专业。</p><a href="/contact/">免费咨询选校 →</a></div></section>
  <section class="prc-sec tight"><h2>返回</h2><div class="prc-rel"><a href="/private-university/">← 私立大学总览（10 所）</a><a href="/university/degrees/">公立大学专业数据库</a><a href="/poly/courses/">理工专业数据库</a></div></section>
'''
    js=r'''
<script>(function(){
  var grid=document.getElementById('prcprogs'),cards=[].slice.call(grid.querySelectorAll('.prc-prog'));
  var q=document.getElementById('prcq'),show=document.getElementById('prcshow'),empty=document.getElementById('prcempty');
  var F={school:{},fl:{},lv:{}};
  function act(o){return Object.keys(o).filter(function(k){return o[k]})}
  function apply(){
    var term=(q.value||'').trim().toLowerCase(),aS=act(F.school),aFl=act(F.fl),aLv=act(F.lv),n=0;
    cards.forEach(function(c){
      var ok=true;
      if(term&&c.getAttribute('data-name').indexOf(term)<0)ok=false;
      if(ok&&aS.length&&aS.indexOf(c.getAttribute('data-school'))<0)ok=false;
      if(ok&&aFl.length&&aFl.indexOf(c.getAttribute('data-fl'))<0)ok=false;
      if(ok&&aLv.length&&aLv.indexOf(c.getAttribute('data-lv'))<0)ok=false;
      c.classList.toggle('hide',!ok);if(ok)n++;
    });
    show.textContent=n;empty.style.display=n?'none':'block';
  }
  q.addEventListener('input',apply);
  document.querySelectorAll('.prc-chip').forEach(function(c){c.addEventListener('click',function(){
    c.classList.toggle('on');var f=c.getAttribute('data-f'),v=c.getAttribute('data-v');
    F[f][v]=c.classList.contains('on');apply();});});
  var sp=new URLSearchParams(location.search);var s0=sp.get('school');
  if(s0){document.querySelectorAll('.prc-chip[data-f="school"]').forEach(function(c){if(c.getAttribute('data-v')===s0){c.classList.add('on');F.school[s0]=true;}});}
  apply();
})();</script>'''
    extra="<style>.prc-prog .t.sch{color:#fff;text-decoration:none;font-weight:800}.prc-chip[data-f=school].on{background:var(--c,#7e2d3a);border-color:var(--c,#7e2d3a)}</style>"
    out=os.path.join(ROOT,"private-university","courses"); os.makedirs(out,exist_ok=True)
    open(os.path.join(out,"index.html"),"w",encoding="utf-8").write(head(title,desc,canon,jsonld,acc,accgrad)+extra+body+js+TAIL)
    print(f"wrote private-university/courses/index.html | {N} programmes aggregated")

for slug in RICH:
    out=os.path.join(ROOT,"private-university",slug); os.makedirs(out,exist_ok=True)
    open(os.path.join(out,"index.html"),"w",encoding="utf-8").write(build(slug))
    print(f"wrote private-university/{slug}/index.html | {len(RICH[slug]['progs'])} programmes")
build_aggregate()
