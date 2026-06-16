# -*- coding: utf-8 -*-
"""Assemble poly-data.json: 5 polytechnics metadata + ~194 diplomas with ELR2B2 + cluster + zh name.
Sources: NP/SP/NYP/RP from sgschoolkaki 2026 COP tables; TP from official tp.edu.sg 2026 table.
"""
import json, re, os

POLYS = [
 {"slug":"sp","abbr":"SP","name_zh":"新加坡理工学院","name_en":"Singapore Polytechnic","founded":1954,
  "area":"Dover","mrt":"Dover (EW22)","schools":10,"students":"约 13,000","logo":"/assets/sp-logo.png",
  "campus":"/assets/sp-campus.jpg","url":"https://www.sp.edu.sg/","tagline":"全国第一所理工学院",
  "highlights":["海事 / 视光全国唯一","航空工程","建筑","化学工程"]},
 {"slug":"np","abbr":"NP","name_zh":"义安理工学院","name_en":"Ngee Ann Polytechnic","founded":1963,
  "area":"Clementi","mrt":"Clementi (EW23)","schools":8,"students":"约 14,000","logo":"/assets/np-logo.png",
  "campus":"/assets/np-campus.jpg","url":"https://www.np.edu.sg/","tagline":"传媒与健康科学强校",
  "highlights":["电影/媒体最强","大众传播招牌","护理","视光"]},
 {"slug":"nyp","abbr":"NYP","name_zh":"南洋理工学院","name_en":"Nanyang Polytechnic","founded":1992,
  "area":"Ang Mo Kio","mrt":"Yio Chu Kang (NS15)","schools":7,"students":"约 13,000","logo":"/assets/nyp-logo.svg",
  "campus":"/assets/nyp-campus.jpg","url":"https://www.nyp.edu.sg/","tagline":"健康科学与教学工厂模式",
  "highlights":["护理 / 健康科学最强","教学工厂产业实战","生物医学","工程"]},
 {"slug":"tp","abbr":"TP","name_zh":"淡马锡理工学院","name_en":"Temasek Polytechnic","founded":1990,
  "area":"Tampines","mrt":"Tampines (EW4 / DT32)","schools":6,"students":"约 13,000","logo":"/assets/tp-logo.svg",
  "campus":"/assets/tp-campus.jpg","url":"https://www.tp.edu.sg/","tagline":"设计与临湖校园",
  "highlights":["设计全国领先","兽医技术全国唯一","法律与管理","航空"]},
 {"slug":"rp","abbr":"RP","name_zh":"共和理工学院","name_en":"Republic Polytechnic","founded":2002,
  "area":"Woodlands","mrt":"Woodlands (NS9 / TE2)","schools":7,"students":"约 14,000","logo":"/assets/rp-logo.png",
  "campus":"/assets/rp-campus.jpg","url":"https://www.rp.edu.sg/","tagline":"最年轻 · 问题导向学习 PBL",
  "highlights":["PBL 教学法全校独特","体育与健康","酒店与休闲","航空"]},
]

# raw: code | name | elr2b2  (per poly). Names已去掉"Diploma in"前缀。
RAW = {
"sp":"""S98|Biomedical Science|3-7
S30|Applied AI & Analytics|5-8
S28|Common Science Programme|7-9
S64|Applied Chemistry|3-9
S67|Optometry|7-11
S54|Cybersecurity & Digital Forensics|5-11
S38|Perfumery & Cosmetic Science|5-11
S76|Banking & Finance|5-11
S75|Accountancy|5-12
S48|Human Resource Management with Psychology|6-12
S70|Chemical Engineering|5-12
S71|Business Administration|4-12
S42|Engineering with Business|6-12
S47|Food Science & Technology|5-12
S31|Common Business Programme|5-12
S29|Media, Arts & Design|6-13
S90|Aerospace Electronics|4-13
S88|Aeronautical Engineering|5-13
S73|Mechatronics & Robotics|5-13
S94|Landscape Architecture|6-15
S99|Electrical & Electronic Engineering|5-15
S91|Mechanical Engineering|5-15
S50|Integrated Events & Project Management|10-15
S74|Maritime Business|5-15
S66|Architecture|8-15
S89|Interior Design|11-15
S69|Computer Science|4-15
S32|Common ICT Programme|5-17
S95|Facilities Management|13-18
S40|Common Engineering Programme|3-19
S53|Computer Engineering|7-20
S68|Civil Engineering|8-21
S63|Marine Engineering|9-22""",
"np":"""N59|Biomedical Science|3-7
N15|Common Science Programme|4-9
N73|Pharmaceutical Science|5-9
N53|Banking & Finance|3-9
N11|Psychology & Community Development|5-10
N60|Biomedical Engineering|8-10
N45|Business Studies|3-10
N93|Engineering Science|3-10
N67|Mass Communication|3-11
N81|Applied AI & Analytics|3-11
N56|Chemical & Biomolecular Engineering|4-11
N85|International Trade & Business|3-11
N97|Common Business Programme|3-11
N51|Accountancy|4-11
N72|Tourism & Resort Management|5-12
N83|Optometry|6-12
N94|Cybersecurity & Digital Forensics|6-12
N14|Common Media Programme|8-13
N74|Environmental Science & Sustainability|7-13
N65|Aerospace Engineering|6-13
N91|Arts Business Management|5-13
N48|Real Estate Business|11-13
N12|Design|5-13
N82|Film, Sound & Video|7-13
N70|Chinese Studies|7-14
N16|Computing with Law|5-14
N88|Chinese Media & Communication|7-14
N13|Media Post-Production|10-14
N40|Hotel & Leisure Facilities Management|9-15
N98|Common ICT Programme|6-15
N57|Landscape Design & Horticulture|4-16
N54|Information Technology|7-18
N71|Common Engineering Programme|7-19
N96|Early Childhood Development & Education|8-19
N95|Tamil Studies with Early Education|11-19
N43|Electrical Engineering|7-20
N44|Electronic & Computer Engineering|5-20
N41|Mechanical Engineering|10-20
N50|Mechatronics & Robotics|12-20
N42|Offshore & Sustainable Engineering|5-22
N69|Nursing|6-28""",
"nyp":"""C25|Biomedical Science with Analytics|6-8
C72|Oral Health Therapy|5-9
C45|Applied Chemistry|4-10
C43|Applied AI & Analytics|7-10
C65|Pharmaceutical Science|7-10
C49|Biologics & Process Technology|7-10
C96|Banking & Finance|5-11
C98|Accountancy & Finance|4-11
C73|Chemical & Pharmaceutical Technology|10-11
C54|Cybersecurity & Digital Forensics|3-11
C27|Common Science Programme|4-11
C71|Biomedical Engineering|7-12
C47|Social Work|7-12
C31|AI & Data Engineering|6-12
C69|Food Science & Nutrition|8-12
C29|Animation, Games & Visual Effects|4-12
C81|Sport & Wellness Management|6-13
C93|Media & Communication Management|8-13
C34|Common Business Programme|5-14
C94|Business Management|5-14
C35|Business & Financial Technology|6-14
C26|Aerospace Engineering|7-14
C38|Architecture|9-15
C46|Food & Beverage Business|4-15
C67|Hospitality & Tourism Management|11-15
C70|Game Development & Technology|6-15
C24|Common Business & Technology Programme|5-16
C28|Common Design & Media Programme|8-16
C32|Experiential Product & Interior Design|11-18
C36|Common ICT Programme|5-18
C30|Communication & Motion Design|9-19
C75|Cloud Engineering|9-21
C42|Common Engineering Programme|10-23
C41|Sustainability in Engineering with Business|10-23
C89|Electronic & Computer Engineering|5-25
C85|Information Technology|6-26
C87|Robotics & Mechatronics|11-26
C62|Advanced & Digital Manufacturing|10-26
C97|Nursing|7-28""",
"tp":"""T38|Biomedical Engineering|7-12
T33|Chemical Engineering|7-13
T70|Common Science Programme|8-11
T26|Food, Nutrition & Culinary Science|5-12
T64|Medical Biotechnology|3-8
T25|Pharmaceutical Science|5-10
T45|Veterinary Technology|3-9
T29|Architectural Technology & Building Services|8-16
T28|Integrated Facility Management|12-16
T02|Accountancy & Finance|6-11
T04|Aviation Management|4-11
T10|Business|5-12
T43|Business Process & Systems Engineering|5-15
T01|Common Business Programme|5-12
T40|Communications & Media Management|4-12
T18|Culinary Arts & Management|6-15
T08|Hospitality & Tourism Management|5-14
T09|Law & Management|5-10
T07|International Trade & Logistics|7-14
T67|Marketing|9-13
T50|Aerospace Electronics|5-12
T51|Aerospace Engineering|5-10
T56|Common Engineering Programme|8-19
T13|Computer Engineering|11-19
T65|Electronics|6-22
T66|Mechatronics|3-12
T68|Early Childhood Development & Education|7-16
T48|Psychology Studies|4-9
T53|Social Sciences in Gerontology|3-14
T69|Applied Artificial Intelligence|8-14
T60|Big Data & Analytics|4-14
T63|Common ICT Programme|9-20
T62|Cybersecurity & Digital Forensics|7-14
T58|Immersive Media & Game Development|9-15
T30|Information Technology|12-18
T20|Fashion Management & Design|5-15
T71|Common Design Programme|6-15
T59|Communication Design|4-16
T23|Digital Film & Television|8-14
T22|Interior Architecture & Design|4-12
T35|Product Experience & Design|13-15""",
"rp":"""R62|Environmental & Marine Science|8-10
R14|Biomedical Science|8-10
R17|Applied Chemistry|10-14
R26|Sport & Exercise Science|6-14
R52|Human Resource Management with Psychology|11-16
R60|Business|6-16
R39|Aviation Management|11-17
R59|Common Science Programme|10-17
R22|Pharmaceutical Science|10-17
R16|Biological Sciences|11-17
R32|Mass Communication|6-17
R48|Consumer Insights & Psychology|15-18
R33|Outdoor Education|11-18
R57|Common Business Programme|13-20
R65|Common Arts, Media & Design Programme|15-21
R67|Design|14-21
R19|Digital Content Creation|9-21
R25|Arts & Entertainment Production Management|13-21
R54|Mobility & Robotic Systems|17-22
R46|Restaurant & Culinary Management|15-22
R24|Sonic Arts|16-22
R66|Hospitality & Tourism Management|11-22
R28|Events & Project Management|14-23
R40|Aerospace Engineering|14-24
R47|Information Technology|12-24
R37|Hotel & Leisure Management|14-24
R56|Engineering|13-25
R12|Enterprise Cloud Computing & Management|15-26
R55|Cybersecurity & Digital Forensics|15-26
R58|Common ICT Programme|13-26
R13|Applied AI & Analytics|15-26
R21|Supply Chain Management|13-26
R18|Financial Technology|11-26
R61|Sustainable Built Environment|16-26
R63|Common Sports & Health Programme|9-26
R45|Integrated Community Care|11-26
R50|Electrical & Electronic Engineering|11-26
R42|Common Engineering Programme|13-26
R49|Sport Coaching|15-26
R11|Business Process & Engineering Management|11-26
R43|Sports & Health|14-26""",
}

ZH = {
"Biomedical Science":"生物医学","Applied AI & Analytics":"应用人工智能与分析","Common Science Programme":"科学大类",
"Applied Chemistry":"应用化学","Optometry":"视光","Cybersecurity & Digital Forensics":"网络安全与数字取证",
"Perfumery & Cosmetic Science":"香水与化妆品科学","Banking & Finance":"银行与金融","Accountancy":"会计",
"Human Resource Management with Psychology":"人力资源管理与心理学","Chemical Engineering":"化学工程",
"Business Administration":"工商管理","Engineering with Business":"工程与商务","Food Science & Technology":"食品科学与技术",
"Common Business Programme":"商科大类","Media, Arts & Design":"媒体、艺术与设计","Aerospace Electronics":"航空航天电子",
"Aeronautical Engineering":"航空工程","Mechatronics & Robotics":"机电一体化与机器人","Landscape Architecture":"景观建筑",
"Electrical & Electronic Engineering":"电气与电子工程","Mechanical Engineering":"机械工程",
"Integrated Events & Project Management":"综合活动与项目管理","Maritime Business":"海事商务","Architecture":"建筑学",
"Interior Design":"室内设计","Computer Science":"计算机科学","Common ICT Programme":"信息科技大类",
"Facilities Management":"设施管理","Common Engineering Programme":"工程大类","Computer Engineering":"计算机工程",
"Civil Engineering":"土木工程","Marine Engineering":"轮机工程",
"Pharmaceutical Science":"制药科学","Psychology & Community Development":"心理学与社区发展","Biomedical Engineering":"生物医学工程",
"Business Studies":"商务学","Engineering Science":"工程科学","Mass Communication":"大众传播",
"Chemical & Biomolecular Engineering":"化学与生物分子工程","International Trade & Business":"国际贸易与商务",
"Tourism & Resort Management":"旅游与度假村管理","Common Media Programme":"媒体大类",
"Environmental Science & Sustainability":"环境科学与可持续发展","Aerospace Engineering":"航空工程",
"Arts Business Management":"艺术商务管理","Real Estate Business":"房地产商务","Design":"设计",
"Film, Sound & Video":"电影、声音与视频","Chinese Studies":"中文研究","Computing with Law":"计算机与法律",
"Chinese Media & Communication":"华文媒体与传播","Media Post-Production":"媒体后期制作",
"Hotel & Leisure Facilities Management":"酒店与休闲设施管理","Landscape Design & Horticulture":"景观设计与园艺",
"Information Technology":"信息技术","Early Childhood Development & Education":"幼儿发展与教育",
"Tamil Studies with Early Education":"泰米尔语研究与早教","Electrical Engineering":"电气工程",
"Electronic & Computer Engineering":"电子与计算机工程","Offshore & Sustainable Engineering":"海事与可持续工程","Nursing":"护理",
"Biomedical Science with Analytics":"生物医学与分析","Oral Health Therapy":"口腔保健治疗",
"Biologics & Process Technology":"生物制剂与工艺技术","Accountancy & Finance":"会计与金融",
"Chemical & Pharmaceutical Technology":"化学与制药技术","Social Work":"社会工作","AI & Data Engineering":"人工智能与数据工程",
"Food Science & Nutrition":"食品科学与营养","Animation, Games & Visual Effects":"动画、游戏与视觉特效",
"Sport & Wellness Management":"运动与健康管理","Media & Communication Management":"媒体与传播管理",
"Business Management":"商业管理","Business & Financial Technology":"商业与金融科技","Food & Beverage Business":"餐饮商务",
"Hospitality & Tourism Management":"酒店与旅游管理","Game Development & Technology":"游戏开发与技术",
"Common Business & Technology Programme":"商业与科技大类","Common Design & Media Programme":"设计与媒体大类",
"Experiential Product & Interior Design":"体验式产品与室内设计","Communication & Motion Design":"传播与动态设计",
"Cloud Engineering":"云计算工程","Sustainability in Engineering with Business":"工程可持续与商务",
"Robotics & Mechatronics":"机器人与机电一体化","Advanced & Digital Manufacturing":"先进与数字制造",
"Food, Nutrition & Culinary Science":"食品、营养与烹饪科学","Medical Biotechnology":"医学生物技术",
"Veterinary Technology":"兽医技术","Architectural Technology & Building Services":"建筑技术与楼宇服务",
"Integrated Facility Management":"综合设施管理","Aviation Management":"航空管理","Business":"商务",
"Business Process & Systems Engineering":"业务流程与系统工程","Communications & Media Management":"传播与媒体管理",
"Culinary Arts & Management":"烹饪艺术与管理","Law & Management":"法律与管理","International Trade & Logistics":"国际贸易与物流",
"Marketing":"市场营销","Electronics":"电子工程","Mechatronics":"机电一体化","Psychology Studies":"心理学研究",
"Social Sciences in Gerontology":"老年学社会科学","Applied Artificial Intelligence":"应用人工智能","Big Data & Analytics":"大数据与分析",
"Immersive Media & Game Development":"沉浸式媒体与游戏开发","Fashion Management & Design":"时尚管理与设计",
"Common Design Programme":"设计大类","Communication Design":"传达设计","Digital Film & Television":"数字电影与电视",
"Interior Architecture & Design":"室内建筑与设计","Product Experience & Design":"产品体验与设计",
"Environmental & Marine Science":"环境与海洋科学","Sport & Exercise Science":"运动与锻炼科学",
"Biological Sciences":"生物科学","Consumer Insights & Psychology":"消费者洞察与心理学","Outdoor Education":"户外教育",
"Common Arts, Media & Design Programme":"艺术、媒体与设计大类","Digital Content Creation":"数字内容创作",
"Arts & Entertainment Production Management":"艺术与娱乐制作管理","Mobility & Robotic Systems":"移动与机器人系统",
"Restaurant & Culinary Management":"餐厅与烹饪管理","Sonic Arts":"声音艺术","Events & Project Management":"活动与项目管理",
"Hotel & Leisure Management":"酒店与休闲管理","Engineering":"工程","Enterprise Cloud Computing & Management":"企业云计算与管理",
"Supply Chain Management":"供应链管理","Financial Technology":"金融科技","Sustainable Built Environment":"可持续建筑环境",
"Common Sports & Health Programme":"体育与健康大类","Integrated Community Care":"综合社区护理","Sport Coaching":"运动教练",
"Business Process & Engineering Management":"业务流程与工程管理","Sports & Health":"体育与健康",
}

# cluster keyword rules, first match wins (order = priority)
CLUSTER_RULES = [
 ("海事", ["Maritime","Marine Engineering","Offshore"]),
 ("健康护理", ["Nursing","Oral Health","Optometry","Community Care","Social Work","Wellness"]),
 ("体育休闲", ["Sport","Exercise","Outdoor","Coaching"]),
 ("建筑环境", ["Architecture","Architectural","Facility","Facilities","Built Environment","Landscape","Real Estate","Horticulture"]),
 ("设计", ["Design","Fashion","Interior"]),
 ("传媒", ["Media","Communication","Film","Video","Animation","Motion","Sonic","Content","Game","Entertainment","Television"]),
 ("信息科技", ["Information Technology","ICT","Computing","Computer Science","Cybersecurity","Digital Forensics"," AI","AI ","Artificial Intelligence","Analytics","Data","Cloud","Financial Technology"]),
 ("工程", ["Engineering","Mechatronics","Robotic","Electronics","Electrical","Mechanical","Aerospace","Aeronautical","Manufacturing","Mobility"]),
 ("商科", ["Business","Accountancy","Banking","Finance","Marketing","Management","Trade","Logistics","Supply Chain","Hospitality","Tourism","Hotel","Human Resource","Events","Aviation","Culinary","Restaurant","Beverage","Resort"]),
 ("应用科学", ["Science","Chemistry","Biomedical","Biological","Biotechnology","Biologics","Perfumery","Veterinary","Environmental","Nutrition","Chemical","Pharmaceutical","Process Technology"]),
 ("人文社科", ["Psychology","Gerontology","Social Sciences","Early Childhood","Studies","Education","Community","Law"]),
]

def cluster_of(name):
    for cl, kws in CLUSTER_RULES:
        for kw in kws:
            if kw.lower() in name.lower():
                return cl
    return "其他"

def difficulty(elr):
    # lower aggregate = harder. use the low end (best student) for tier
    lo = int(elr.split("-")[0])
    if lo <= 8: return "hard"
    if lo <= 15: return "mid"
    return "easy"

courses=[]
unmapped=set()
for slug, block in RAW.items():
    for line in block.strip().splitlines():
        code,name,elr = [x.strip() for x in line.split("|")]
        zh = ZH.get(name)
        if not zh:
            unmapped.add(name); zh = name
        courses.append({
            "poly":slug,"code":code,"name_en":name,"name_zh":zh,
            "elr2b2":elr,"lo":int(elr.split("-")[0]),"hi":int(elr.split("-")[1]),
            "cluster":cluster_of(name),"diff":difficulty(elr)
        })

data={"polys":POLYS,"clusters":[c for c,_ in CLUSTER_RULES]+["其他"],
      "year":"2026","course_count":len(courses),"courses":courses}
os.makedirs("content/poly",exist_ok=True)
json.dump(data, open("content/poly/poly-data.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)

print("total courses:",len(courses))
from collections import Counter
print("by poly:",dict(Counter(c['poly'] for c in courses)))
print("by cluster:",dict(Counter(c['cluster'] for c in courses)))
if unmapped: print("!!! UNMAPPED zh:",unmapped)
else: print("zh: all mapped ✓")
