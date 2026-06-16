# -*- coding: utf-8 -*-
"""Assemble content/university/uni-data.json — 6 autonomous unis + UAS.
NUS/NTU/SMU: per-programme A-Level IGP + Poly GPA IGP (+ derived WACE ATAR).
SIT/SUTD/SUSS: aptitude / holistic admission — programme list + note (no fixed cut-off).
UAS: portfolio / audition requirements.
Sources: NUS official IGP AY25/26; NTU/SMU A-Level via illum.education, Poly GPA via digitalsenior; SIT via aspirertutor; SUSS via illum.
"""
import os, json, re

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

UNIS=[
 {"slug":"nus","abbr":"NUS","zh":"新加坡国立大学","en":"National University of Singapore","qs":"QS #8","founded":1905,"type":"grade","atar":"≥90（热门专业近满分）","sig":"综合排名全国第一，文理工医法全覆盖"},
 {"slug":"ntu","abbr":"NTU","zh":"南洋理工大学","en":"Nanyang Technological University","qs":"QS #12","founded":1991,"type":"grade","atar":"≥90","sig":"工程与计算机全球顶尖，理工强校"},
 {"slug":"smu","abbr":"SMU","zh":"新加坡管理大学","en":"Singapore Management University","qs":"商科顶尖","founded":2000,"type":"grade","atar":"≥90（参照）","sig":"商科/会计/法律/计算机，研讨式小班教学"},
 {"slug":"sutd","abbr":"SUTD","zh":"新加坡科技设计大学","en":"Singapore Univ. of Technology & Design","qs":"科技+设计","founded":2009,"type":"holistic","atar":"综合评估","sig":"科技与设计交叉，含作品/面试整体评估"},
 {"slug":"sit","abbr":"SIT","zh":"新加坡理工大学","en":"Singapore Institute of Technology","qs":"应用型","founded":2009,"type":"aptitude","atar":"能力本位·无硬性截分","sig":"应用型大学，与海外名校联合学位、行业实战"},
 {"slug":"suss","abbr":"SUSS","zh":"新跃社科大学","en":"Singapore Univ. of Social Sciences","qs":"社科见长","founded":2017,"type":"aptitude","atar":"多轮评估（笔试+面试）","sig":"社会科学、商科、心理与社工见长"},
 {"slug":"uas","abbr":"UAS","zh":"新加坡艺术大学","en":"University of the Arts Singapore","qs":"艺术","founded":2024,"type":"portfolio","atar":"作品集/试演","sig":"NAFA+LASALLE 组成，艺术设计表演类"},
]

# ---- grade unis: "name_en | A-Level lo | A-Level hi" (A-Level from illum) ----
ALEVEL={
"nus":"""Law|AAA/A|AAA/A
Medicine|AAA/A|AAA/A
Dentistry|AAA/A|AAA/A
Nursing|CCD/C|ABB/B
Pharmacy|AAA/B|AAA/A
Pharmaceutical Science|AAA/A|AAA/A
Engineering|BBB/C|AAA/A
Computer Engineering|AAA/A|AAA/A
Industrial Design|BBB/B|AAA/A
Architecture|CCC/C|AAA/C
Landscape Architecture|CCC/B|AAB/C
Common Computer Science Programmes|AAA/A|AAA/A
Information Security|AAA/A|AAA/A
Information Systems|AAA/A|AAA/A
Business Analytics|AAA/A|AAA/A
Business Artificial Intelligence Systems|AAA/B|AAA/A
Data Science and Economics|AAA/A|AAA/A
Business Administration|AAA/C|AAA/A
Environmental Studies|AAA/C|AAA/A
Food Science and Technology|AAA/B|AAA/A
Humanities and Sciences|ABB/B|AAA/A
Philosophy, Politics, and Economics|AAA/A|AAA/A""",
"ntu":"""Medicine|AAA/A|AAA/A
Renaissance Engineering|AAA/A|AAA/A
Aerospace Engineering|CCC/C|AAA/A
Bioengineering|BCC/D|AAA/A
Chemical & Biomolecular Engineering|BCC/C|AAA/A
Civil Engineering|CDD/D|ABC/B
Electrical & Electronic Engineering|CCD/C|AAA/A
Environmental Engineering|CCD/C|AAA/A
Information Engineering & Media|BCC/D|AAC/C
Maritime Studies|BCC/D|ABC/C
Materials Engineering|CCC/C|AAA/A
Mechanical Engineering|CDD/C|AAA/A
Artificial Intelligence and Society|ABC/C|AAA/A
Computer Engineering|ABC/C|AAA/A
Computer Science|AAC/B|AAA/A
Data Science & Artificial Intelligence|AAB/B|AAA/A
Biological Sciences|AAC/C|AAA/A
Chemistry & Biological Chemistry|BCC/C|AAA/A
Chinese Medicine|ABC/C|AAA/A
Environmental Earth Systems Science|AAB/B|AAA/A
Mathematical Sciences|BBC/C|AAA/A
Physics / Applied Physics|CCC/C|AAA/A
Accountancy|ABC/C|AAA/A
Business|ABC/C|AAA/A
Applied Computing in Finance|AAC/B|AAA/A
Art, Design & Media|BCC/C|AAA/A
Chinese|BBC/C|AAA/A
Communication Studies|AAC/C|AAA/A
Economics|BBC/B|AAA/A
Economics and Data Science|AAB/B|AAA/A
English|BBC/B|AAA/A
History|BCC/C|AAB/B
Linguistics & Multilingual Studies|BBC/C|AAA/A
Philosophy|BBC/C|AAA/A
Philosophy, Politics, and Economics|AAB/B|AAA/A
Psychology|AAC/B|AAA/A
Public Policy & Global Affairs|AAC/B|AAA/A
Sociology|BBC/C|AAB/B
Sport Science & Management|CCC/C|AAB/B""",
"smu":"""Accountancy|BBB/C|AAA/A
Business Management|ABB/C|AAA/A
Law|AAA/A|AAA/A
Economics|BBB/C|AAA/A
Information Systems|BBB/C|AAA/A
Computer Science|AAB/A|AAA/A
Computing & Law|ABB/A|AAA/A
Software Engineering|BBB/C|AAA/C
Social Sciences|BBB/C|AAA/A""",
}
# ---- Poly GPA from digitalsenior: "name_en | lo-hi" ----
GPA={
"nus":"""Law|3.82-3.98
Medicine|3.86-3.98
Nursing|3.18-3.77
Architecture|3.27-3.88
Engineering|3.57-3.94
Industrial Design|3.56-3.90
Landscape Architecture|3.37-3.81
Business Analytics|3.75-3.98
Common Computer Science Programmes|3.81-3.98
Information Security|3.80-3.97
Information Systems|3.76-3.97
Computer Engineering|3.81-3.99
Food Science and Technology|3.64-3.91
Humanities and Sciences|3.63-3.92
Pharmacy|3.73-3.97
Pharmaceutical Science|3.93-4.00
Business Administration|3.61-3.94
Business Artificial Intelligence Systems|3.71-3.90""",
"ntu":"""Aerospace Engineering|3.55-3.96
Bioengineering|3.57-3.94
Chemical & Biomolecular Engineering|3.71-3.98
Civil Engineering|3.49-3.91
Computer Engineering|3.65-3.94
Computer Science|3.70-3.96
Electrical & Electronic Engineering|3.44-3.93
Environmental Engineering|3.56-3.89
Information Engineering & Media|3.66-3.93
Maritime Studies|3.50-3.86
Materials Engineering|3.41-3.85
Mechanical Engineering|3.37-3.89
Data Science & Artificial Intelligence|3.78-4.00
Biological Sciences|3.71-3.96
Chemistry & Biological Chemistry|3.57-3.95
Mathematical Sciences|3.36-3.82
Accountancy|3.65-3.97
Business|3.64-3.95
Art, Design & Media|3.38-3.90
Chinese|3.42-3.74
Communication Studies|3.71-3.90
Economics|3.57-3.86
Economics and Data Science|3.76-3.99
English|3.34-3.66
History|3.35-3.73
Linguistics & Multilingual Studies|3.50-3.74
Philosophy|3.50-3.76
Public Policy & Global Affairs|3.60-3.93
Sociology|3.61-3.89
Sport Science & Management|3.54-3.90
Psychology|3.70-3.95""",
"smu":"""Accountancy|3.63-3.94
Business Management|3.70-3.95
Economics|3.61-3.93
Information Systems|3.71-3.96
Computer Science|3.80-3.96
Software Engineering|3.71-3.93
Social Sciences|3.67-3.93""",
}
# ---- aptitude/holistic unis: programme lists (no fixed cut-off) ----
APT={
"sit":"""Information & Communications Technology (Software Engineering)
Information & Communications Technology (Information Security)
Computing Science (with Univ. of Glasgow)
Applied Artificial Intelligence
Applied Computing (Fintech)
Computer Engineering
Robotics Systems
Mechatronics Systems
Digital Art & Animation
User Experience & Game Design
Civil Engineering
Aerospace Engineering
Aircraft Systems Engineering
Electrical Power Engineering
Electronics & Data Engineering
Mechanical Engineering
Mechanical Design & Manufacturing Engineering
Naval Architecture & Marine Engineering
Pharmaceutical Engineering
Chemical Engineering
Sustainable Built Environment
Digital Supply Chain
Dietetics & Nutrition
Diagnostic Radiography
Physiotherapy
Occupational Therapy
Speech & Language Therapy
Nursing
Accountancy
Hospitality Business
Food Business Management (Culinary Arts)
Food Business Management (Baking & Pastry)
Air Transport Management
Digital Communications & Integrated Media
Food Technology""",
"suss":"""Accountancy
Finance
Marketing
Supply Chain Management
Business Analytics
Human Resource Management
Social Work
Early Childhood Education
Public Safety & Security
Psychology
Information & Communication Technology
Chinese Studies""",
"sutd":"""Architecture & Sustainable Design
Engineering Product Development
Engineering Systems & Design
Information Systems Technology & Design
Design & Artificial Intelligence
Computer Science & Design""",
}
# ---- UAS portfolio programmes ----
UAS=[
("纯艺术","Fine Arts","NAFA / LASALLE","作品集","15–20 件原创作品（素描/绘画/立体）+ 面试"),
("视觉传达设计","Design Communication","LASALLE","作品集","设计/插画作品集 + 创意测试 + 面试"),
("动画艺术","Animation Art","NAFA","作品集","速写、角色设计、动画样片 + 面试"),
("电影","Film","LASALLE","作品集","短片/影像样片 + 创作陈述 + 面试"),
("时装设计","Fashion Design","LASALLE / NAFA","作品集","时装设计作品集 + 面试"),
("室内设计","Interior Design","LASALLE","作品集","空间/设计作品集 + 面试"),
("音乐","Music","NAFA / LASALLE","试演","现场或录制试演 + 乐理测试"),
("舞蹈","Dance","NAFA / LASALLE","试演","现场试演（技巧 + 即兴）"),
("戏剧表演","Acting / Theatre","LASALLE","试演","独白试演 + 面试 + 工作坊"),
("艺术管理","Arts Management","LASALLE","面试","个人陈述 + 面试（无需作品集）"),
]

# ---- translation + cluster ----
ZH={
"Law":"法学（法律）","Medicine":"医学","Dentistry":"牙医学","Nursing":"护理学","Pharmacy":"药学","Pharmaceutical Science":"药剂科学",
"Engineering":"工程（大类）","Computer Engineering":"计算机工程","Industrial Design":"工业设计","Architecture":"建筑学","Landscape Architecture":"景观建筑",
"Common Computer Science Programmes":"计算机科学（大类）","Computer Science":"计算机科学","Information Security":"信息安全","Information Systems":"信息系统",
"Business Analytics":"商业分析","Business Artificial Intelligence Systems":"商业人工智能系统","Data Science and Economics":"数据科学与经济",
"Business Administration":"工商管理","Environmental Studies":"环境研究","Food Science and Technology":"食品科学与技术","Humanities and Sciences":"人文与科学",
"Philosophy, Politics, and Economics":"哲学政治经济（PPE）","Renaissance Engineering":"文艺复兴工程（精英）","Aerospace Engineering":"航空航天工程",
"Bioengineering":"生物工程","Chemical & Biomolecular Engineering":"化学与生物分子工程","Civil Engineering":"土木工程","Electrical & Electronic Engineering":"电气与电子工程",
"Environmental Engineering":"环境工程","Information Engineering & Media":"信息工程与媒体","Maritime Studies":"海事研究","Materials Engineering":"材料工程",
"Mechanical Engineering":"机械工程","Artificial Intelligence and Society":"人工智能与社会","Data Science & Artificial Intelligence":"数据科学与人工智能",
"Biological Sciences":"生物科学","Chemistry & Biological Chemistry":"化学与生物化学","Chinese Medicine":"中医","Environmental Earth Systems Science":"环境地球系统科学",
"Mathematical Sciences":"数学科学","Physics / Applied Physics":"物理/应用物理","Accountancy":"会计学","Business":"商学","Applied Computing in Finance":"金融应用计算",
"Art, Design & Media":"艺术、设计与媒体","Chinese":"中文","Communication Studies":"传播学","Economics":"经济学","Economics and Data Science":"经济与数据科学",
"English":"英文","History":"历史","Linguistics & Multilingual Studies":"语言学与多语研究","Philosophy":"哲学","Psychology":"心理学",
"Public Policy & Global Affairs":"公共政策与全球事务","Sociology":"社会学","Sport Science & Management":"运动科学与管理",
"Business Management":"工商管理","Computing & Law":"计算机与法律","Software Engineering":"软件工程","Social Sciences":"社会科学",
"Air Transport Management":"航空运输管理","Aircraft Systems Engineering":"飞机系统工程","Applied Artificial Intelligence":"应用人工智能","Applied Computing (Fintech)":"应用计算（金融科技）","Architecture & Sustainable Design":"建筑与可持续设计","Chemical Engineering":"化学工程","Chinese Studies":"中文研究","Computer Science & Design":"计算机科学与设计","Computing Science (with Univ. of Glasgow)":"计算机科学（格拉斯哥联合）","Design & Artificial Intelligence":"设计与人工智能","Diagnostic Radiography":"诊断放射学","Dietetics & Nutrition":"营养与膳食学","Digital Art & Animation":"数字艺术与动画","Digital Communications & Integrated Media":"数字传播与整合媒体","Digital Supply Chain":"数字供应链","Early Childhood Education":"幼儿教育","Electrical Power Engineering":"电力工程","Electronics & Data Engineering":"电子与数据工程","Engineering Product Development":"工程产品开发","Engineering Systems & Design":"工程系统与设计","Finance":"金融","Food Business Management (Baking & Pastry)":"餐饮管理（烘焙）","Food Business Management (Culinary Arts)":"餐饮管理（烹饪）","Food Technology":"食品科技","Hospitality Business":"酒店商业","Human Resource Management":"人力资源管理","Information & Communication Technology":"信息与通信技术","Information & Communications Technology (Information Security)":"信息与通信技术（信息安全）","Information & Communications Technology (Software Engineering)":"信息与通信技术（软件工程）","Information Systems Technology & Design":"信息系统技术与设计","Marketing":"市场营销","Mechanical Design & Manufacturing Engineering":"机械设计与制造工程","Mechatronics Systems":"机电系统","Naval Architecture & Marine Engineering":"船舶与海洋工程","Occupational Therapy":"职业治疗","Pharmaceutical Engineering":"制药工程","Physiotherapy":"物理治疗","Public Safety & Security":"公共安全","Robotics Systems":"机器人系统","Social Work":"社会工作","Speech & Language Therapy":"言语与语言治疗","Supply Chain Management":"供应链管理","Sustainable Built Environment":"可持续建筑环境","User Experience & Game Design":"用户体验与游戏设计",
}
CLUSTER_RULES=[
 ("医学健康",["Medicine","Dentistry","Nursing","Pharmac","Therapy","Radiography","Physiotherap","Dietetics","Occupational","Speech","Chinese Medicine"]),
 ("法律",["Law"]),
 ("计算机",["Computer Science","Computing","Information Security","Information Systems","Business Analytics","Artificial Intelligence","Data Science","Software","ICT","Information & Comm","Game"]),
 ("工程",["Engineering","Mechatronic","Robotics","Aerospace","Aircraft","Naval","Materials","Mechanical","Electrical","Civil","Bioengineering","Maritime"]),
 ("设计建筑",["Architecture","Industrial Design","Design","Fashion","Interior","Animation","Built Environment"]),
 ("传媒",["Media","Communication","Film","Communications"]),
 ("商科",["Business","Accountancy","Accounting","Finance","Marketing","Management","Supply Chain","Hospitality","Air Transport","Human Resource","Trade"]),
 ("理学",["Science","Chemistry","Physics","Biological","Mathemat","Food","Environmental","Nutrition"]),
 ("人文社科",["Humanities","Philosophy","Politics","Economics","Chinese","English","History","Linguistics","Psychology","Sociology","Policy","Social","Education","Studies","Sport"]),
]
def cluster(n):
    for cl,kws in CLUSTER_RULES:
        for k in kws:
            if k.lower() in n.lower(): return cl
    return "其他"
def zh(n):
    if n in ZH: return ZH[n]
    return None
CLI={"医学健康":"🩺","法律":"⚖️","计算机":"💻","工程":"⚙️","设计建筑":"🏛️","传媒":"🎬","商科":"📊","理学":"🧪","人文社科":"📚","其他":"🎓"}
def atar_est(alo):
    g=alo.split("/")[0]; v={"A":5,"B":4,"C":3,"D":2,"E":1}
    s=sum(v.get(c,0) for c in g[:3])
    return {15:"≈99",14:"≈97",13:"≈95",12:"≈92",11:"≈90",10:"≈88",9:"≈85",8:"≈83",7:"≈80",6:"≈77"}.get(s,"≈75")

def parse(block):
    d={}
    for ln in block.strip().splitlines():
        p=[x.strip() for x in ln.split("|")]
        d[p[0]]=p[1:]
    return d

unmapped=set()
programmes=[]
for u in UNIS:
    s=u["slug"]
    if u["type"]=="grade":
        al=parse(ALEVEL[s]); gp=parse(GPA[s])
        for name,(alo,ahi) in al.items():
            z=zh(name)
            if not z: unmapped.add(name); z=name
            gpa=gp.get(name,["—"])[0]
            programmes.append({"uni":s,"name_en":name,"name_zh":z,"cluster":cluster(name),
                "alevel":f"{alo} – {ahi}","gpa":gpa,"glo":(float(gpa.split('-')[0]) if '-' in gpa else 0),
                "atar":atar_est(alo),"type":"grade"})
    elif u["type"] in ("aptitude","holistic"):
        for name in APT[s].strip().splitlines():
            name=name.strip()
            z=zh(name) or name
            if name not in ZH: unmapped.add(name)
            programmes.append({"uni":s,"name_en":name,"name_zh":z,"cluster":cluster(name),
                "alevel":"—","gpa":"—","glo":0,"atar":"—","type":u["type"]})

data={"unis":UNIS,"cli":CLI,"programmes":programmes,
      "uas":[{"zh":z,"en":e,"college":c,"rtype":rt,"req":rq} for z,e,c,rt,rq in UAS],
      "count":len(programmes),"year":"2025/26"}
os.makedirs(os.path.join(ROOT,"content/university"),exist_ok=True)
json.dump(data,open(os.path.join(ROOT,"content/university/uni-data.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=1)

from collections import Counter
print("programmes:",len(programmes))
print("by uni:",dict(Counter(p['uni'] for p in programmes)))
print("by cluster:",dict(Counter(p['cluster'] for p in programmes)))
print("grade-cut programmes (NUS/NTU/SMU):",sum(1 for p in programmes if p['type']=='grade'))
print("UAS:",len(UAS))
print("UNMAPPED zh:",sorted(unmapped) if unmapped else "all mapped ✓")
