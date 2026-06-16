# -*- coding: utf-8 -*-
"""Build /poly/ (gostudy-style directory) and /poly/courses/ (ELR2B2 database)
from content/poly/poly-data.json. Reuses header/footer from poly/sp/index.html so nav stays identical.
Static HTML + scoped CSS + vanilla filter JS (Baidu-indexable)."""
import json, re, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT,"content/poly/poly-data.json"),encoding="utf-8"))
CSSV = "37"  # bump
SP = open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER = SP[SP.index("<header class=\"site-header\">"):SP.index("</header>")+len("</header>")]
FOOTER = SP[SP.index("<footer class=\"site-footer\">"):SP.index("</footer>")+len("</footer>")]

polys = {p["slug"]:p for p in DATA["polys"]}
courses = DATA["courses"]
CL_ORDER = DATA["clusters"]
YEAR = DATA["year"]
N = len(courses)

def esc(s): return html.escape(str(s),quote=True)

def diff_label(d): return {"hard":"竞争激烈","mid":"中等","easy":"较友好"}[d]
def diff_cls(d): return d

# ---------- shared head ----------
def head(title, desc, canon, jsonld):
    blocks = "\n".join('<script type="application/ld+json">%s</script>'%json.dumps(j,ensure_ascii=False,separators=(",",":")) for j in jsonld)
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
<link rel="alternate" type="application/rss+xml" title="SEDA 新加坡择校网最新文章" href="https://sgeda.org.cn/feed.xml"/>
<link rel="stylesheet" href="/seda-site.css?v={CSSV}"/>
{blocks}
<style>{CSS}</style>
</head>
<body>
{HEADER}
<main>'''

TAIL = f'''{FOOTER}
<script src="/seda-site.js?v=27"></script>
</body>
</html>'''

# ---------- scoped CSS ----------
CSS = r'''
.pdb-hero{position:relative;padding:54px clamp(20px,6vw,80px) 46px;background:linear-gradient(135deg,#7f1d1d 0%,#b32020 48%,#c62828 100%);color:#fff;overflow:hidden}
.pdb-hero::after{content:"";position:absolute;inset:0;background:radial-gradient(900px 360px at 88% -10%,rgba(255,255,255,.14),transparent 60%);pointer-events:none}
.pdb-hero .in{position:relative;max-width:1180px;margin:0 auto}
.pdb-eyebrow{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);padding:6px 14px;border-radius:999px;font-size:.82rem;font-weight:700;margin-bottom:16px}
.pdb-hero h1{font-size:clamp(28px,4.4vw,46px);line-height:1.16;margin:0 0 14px;font-weight:850}
.pdb-hero p.sub{font-size:clamp(15px,1.7vw,18px);color:rgba(255,255,255,.9);max-width:760px;margin:0 0 24px;line-height:1.7}
.pdb-searchbar{display:flex;gap:10px;max-width:660px;background:#fff;border-radius:14px;padding:8px;box-shadow:0 20px 50px rgba(0,0,0,.22)}
.pdb-searchbar input{flex:1;border:0;outline:0;padding:0 14px;font-size:1rem;color:var(--ink);background:transparent;min-width:0}
.pdb-searchbar button{flex:0 0 auto;border:0;background:var(--brand);color:#fff;font-weight:800;padding:0 22px;border-radius:9px;cursor:pointer;font-size:.96rem;height:46px}
.pdb-hotrow{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:center;font-size:.86rem;color:rgba(255,255,255,.85)}
.pdb-hotrow a{color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);padding:4px 11px;border-radius:999px;text-decoration:none}
.pdb-hotrow a:hover{background:rgba(255,255,255,.26)}
.pdb-trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:20px;font-size:.85rem;color:rgba(255,255,255,.9)}
.pdb-trust span{display:inline-flex;align-items:center;gap:6px}

.pdb-statsband{background:#fff;border-bottom:1px solid var(--line)}
.pdb-stats{max-width:1180px;margin:0 auto;padding:26px clamp(20px,6vw,80px);display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:18px;text-align:center}
.pdb-stat .n{font-size:clamp(26px,3.4vw,38px);font-weight:850;color:var(--brand);line-height:1}
.pdb-stat .l{font-size:.84rem;color:var(--muted);margin-top:6px}

.pdb-sec{max-width:1180px;margin:0 auto;padding:46px clamp(20px,6vw,80px)}
.pdb-sec h2{font-size:clamp(23px,3vw,32px);margin:0 0 6px;color:var(--ink);font-weight:820}
.pdb-sec .lead{color:var(--muted);margin:0 0 26px;font-size:1rem;line-height:1.7}

.pdb-polys{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:20px}
.pdb-pcard{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 2px 10px rgba(20,20,40,.04);transition:transform .2s,box-shadow .2s;text-decoration:none}
.pdb-pcard:hover{transform:translateY(-4px);box-shadow:var(--shadow-md)}
.pdb-pcard .cover{position:relative;height:128px;background-size:cover;background-position:center}
.pdb-pcard .cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,24,40,.05),rgba(16,24,40,.55))}
.pdb-pcard .abbr{position:absolute;top:12px;left:12px;z-index:2;background:var(--brand);color:#fff;font-weight:800;font-size:.78rem;padding:4px 10px;border-radius:8px;letter-spacing:.04em}
.pdb-pcard .lchip{position:absolute;bottom:-22px;left:18px;z-index:2;background:#fff;border-radius:12px;padding:8px 12px;box-shadow:0 6px 18px rgba(0,0,0,.16);height:44px;display:flex;align-items:center}
.pdb-pcard .lchip img{height:26px;width:auto;display:block}
.pdb-pcard .body{padding:30px 20px 20px}
.pdb-pcard h3{margin:0;font-size:1.18rem;color:var(--ink);font-weight:800}
.pdb-pcard .en{color:var(--muted);font-size:.84rem;margin:.15rem 0 .7rem}
.pdb-pcard .meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.82rem;color:var(--muted);margin-bottom:.7rem}
.pdb-pcard .meta b{color:var(--ink)}
.pdb-pcard .tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:.9rem}
.pdb-pcard .tags span{font-size:.74rem;background:var(--brand-light);color:var(--brand-strong);border:1px solid #f3c6c6;padding:3px 9px;border-radius:999px}
.pdb-pcard .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;border-top:1px dashed var(--line);padding-top:.8rem;font-size:.84rem}
.pdb-pcard .foot .cnt{color:var(--muted)}.pdb-pcard .foot .cnt b{color:var(--brand);font-size:1.05rem}
.pdb-pcard .foot .go{color:var(--brand-strong);font-weight:800}

.pdb-clusters{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px}
.pdb-clcard{display:flex;flex-direction:column;gap:4px;border:1px solid var(--line);border-radius:14px;padding:15px 16px;background:#fff;text-decoration:none;transition:transform .15s,box-shadow .15s,border-color .15s}
.pdb-clcard:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:#f0bcbc}
.pdb-clcard .ic{font-size:1.5rem;line-height:1}
.pdb-clcard .nm{font-weight:800;color:var(--ink);font-size:1rem}
.pdb-clcard .ct{color:var(--muted);font-size:.8rem}.pdb-clcard .ct b{color:var(--brand)}

.pdb-dbteaser{background:linear-gradient(135deg,#fff7f7,#fff 60%);border:1px solid #f3d6d6;border-radius:20px;padding:30px clamp(20px,4vw,40px);display:grid;grid-template-columns:1.1fr 1fr;gap:30px;align-items:center}
.pdb-dbteaser h2{margin:0 0 10px}
.pdb-dbteaser p{color:var(--muted);line-height:1.75;margin:0 0 18px}
.pdb-dbteaser .btn{display:inline-flex;align-items:center;gap:8px;background:var(--brand);color:#fff;font-weight:800;padding:12px 22px;border-radius:11px;text-decoration:none}
.pdb-dbteaser .btn:hover{background:var(--brand-strong)}
.pdb-mini{display:grid;gap:8px}
.pdb-mini .row{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:.86rem}
.pdb-mini .row .nm{flex:1;color:var(--ink);font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdb-mini .row .pp{font-size:.72rem;color:var(--muted)}

.pdb-score{display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:28px;padding:0 8px;border-radius:8px;font-weight:800;font-size:.92rem;color:#fff}
.pdb-score.hard{background:#c0392b}.pdb-score.mid{background:#d97706}.pdb-score.easy{background:#2e7d32}

/* pathway */
.pdb-path{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.pdb-pstep{background:#fff;border:1px solid var(--line);border-radius:13px;padding:16px;text-align:center;position:relative}
.pdb-pstep .n{font-size:.74rem;color:var(--brand);font-weight:800;letter-spacing:.06em}
.pdb-pstep .t{font-weight:800;color:var(--ink);margin:5px 0 4px}
.pdb-pstep .d{font-size:.8rem;color:var(--muted);line-height:1.5}

/* FAQ */
.pdb-faq details{background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden}
.pdb-faq summary{cursor:pointer;padding:15px 18px;font-weight:700;color:var(--ink);list-style:none;display:flex;justify-content:space-between;gap:12px}
.pdb-faq summary::-webkit-details-marker{display:none}
.pdb-faq summary::after{content:"+";color:var(--brand);font-weight:800;font-size:1.2rem}
.pdb-faq details[open] summary::after{content:"\2212"}
.pdb-faq details[open] summary{border-bottom:1px solid var(--line)}
.pdb-faq .a{padding:14px 18px;color:var(--muted);line-height:1.75;font-size:.94rem}

/* ===== database page ===== */
.pdb-dbhero{padding:34px clamp(20px,6vw,80px);background:linear-gradient(135deg,#7f1d1d,#c62828);color:#fff}
.pdb-dbhero .in{max-width:1180px;margin:0 auto}
.pdb-dbhero h1{font-size:clamp(24px,3.4vw,36px);margin:0 0 8px;font-weight:850}
.pdb-dbhero p{margin:0;color:rgba(255,255,255,.9);font-size:.98rem;line-height:1.6}
.pdb-tools{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 4px 14px rgba(20,20,40,.05)}
.pdb-tools .in{max-width:1180px;margin:0 auto;padding:16px clamp(20px,6vw,80px)}
.pdb-toolrow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px}
.pdb-find{display:flex;align-items:center;gap:8px;flex:1;min-width:220px;border:1px solid var(--line);border-radius:10px;padding:9px 13px;background:#fafafa}
.pdb-find input{border:0;outline:0;background:transparent;flex:1;font-size:.95rem;color:var(--ink);min-width:0}
.pdb-scorebox{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:7px 12px;background:#fafafa;font-size:.88rem;color:var(--ink);white-space:nowrap}
.pdb-scorebox input{width:62px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;font-size:.95rem;text-align:center;outline:0}
.pdb-scorebox label{font-weight:700;color:var(--brand-strong);display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.pdb-sort{border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:#fafafa;font-size:.9rem;color:var(--ink);cursor:pointer}
.pdb-chips{display:flex;flex-wrap:wrap;gap:7px}
.pdb-chip{font-size:.84rem;border:1px solid var(--line);background:#fff;color:var(--muted);padding:6px 13px;border-radius:999px;cursor:pointer;user-select:none;transition:all .12s}
.pdb-chip:hover{border-color:#f0bcbc;color:var(--brand-strong)}
.pdb-chip.on{background:var(--brand);border-color:var(--brand);color:#fff}
.pdb-chiplabel{font-size:.78rem;color:var(--muted);font-weight:700;margin-right:4px;align-self:center}
.pdb-count{font-size:.86rem;color:var(--muted);padding:0 clamp(20px,6vw,80px);max-width:1180px;margin:14px auto 0}
.pdb-count b{color:var(--brand)}

.pdb-tablewrap{max-width:1180px;margin:10px auto 0;padding:0 clamp(20px,6vw,80px) 40px;overflow-x:auto}
.pdb-table{width:100%;border-collapse:collapse;font-size:.92rem;min-width:680px}
.pdb-table thead th{position:sticky;top:0;background:#faf7f5;text-align:left;padding:11px 12px;font-weight:800;color:var(--ink);border-bottom:2px solid var(--line);white-space:nowrap;cursor:pointer}
.pdb-table thead th .ar{color:var(--brand);font-size:.7rem}
.pdb-table td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
.pdb-table tbody tr:hover td{background:#fcfaf9}
.pdb-table tr.dim{opacity:.32}
.pdb-table tr.hit td:first-child{box-shadow:inset 3px 0 0 #2e7d32}
.pdb-cn{font-weight:700;color:var(--ink)}
.pdb-ce{display:block;color:var(--muted);font-size:.76rem;font-weight:400}
.pdb-pbadge{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;font-weight:700;color:var(--brand-strong);white-space:nowrap}
.pdb-pbadge img{height:16px;width:auto}
.pdb-ctag{font-size:.74rem;background:#f3f4f6;color:#444;padding:2px 9px;border-radius:999px;white-space:nowrap}
.pdb-bar{height:7px;border-radius:4px;background:#ececec;overflow:hidden;min-width:74px;max-width:120px}
.pdb-bar i{display:block;height:100%;border-radius:4px}
.pdb-bar i.hard{background:#c0392b}.pdb-bar i.mid{background:#d97706}.pdb-bar i.easy{background:#2e7d32}
.pdb-empty{text-align:center;color:var(--muted);padding:46px 0;font-size:.95rem;display:none}

@media(max-width:760px){
 .pdb-dbteaser{grid-template-columns:1fr}
 .pdb-mini{display:none}
}
@media(max-width:560px){
 .pdb-table .col-en{display:none}
}
'''

# ============================================================ LANDING
def build_landing():
    canon="https://sgeda.org.cn/poly/"
    counts={s:sum(1 for c in courses if c["poly"]==s) for s in polys}
    cl_counts={cl:sum(1 for c in courses if c["cluster"]==cl) for cl in CL_ORDER}
    cl_icon={"工程":"⚙️","信息科技":"💻","商科":"📊","设计":"🎨","传媒":"🎬","健康护理":"🩺","应用科学":"🧪","建筑环境":"🏗️","海事":"⚓","人文社科":"📚","体育休闲":"🏅","其他":"🎓"}

    # poly cards
    pcards=[]
    for s in ["sp","np","nyp","tp","rp"]:
        p=polys[s]
        tags="".join(f"<span>{esc(h)}</span>" for h in p["highlights"][:3])
        pcards.append(f'''<a class="pdb-pcard" href="/poly/{s}/">
  <div class="cover" style="background-image:linear-gradient(0deg,rgba(0,0,0,.1),rgba(0,0,0,.1)),url('{p["campus"]}')">
    <span class="abbr">{esc(p["abbr"])}</span>
    <span class="lchip"><img src="{p["logo"]}" alt="{esc(p["name_zh"])}校徽" loading="lazy"></span>
  </div>
  <div class="body">
    <h3>{esc(p["name_zh"])}</h3>
    <p class="en">{esc(p["name_en"])}</p>
    <div class="meta"><span>📅 <b>{p["founded"]}</b> 年</span><span>📍 {esc(p["area"])}</span><span>🎓 {p["schools"]} 学院</span><span>👥 {esc(p["students"])}</span></div>
    <div class="tags">{tags}</div>
    <div class="foot"><span class="cnt"><b>{counts[s]}</b> 个 Diploma 专业</span><span class="go">查看详情 →</span></div>
  </div>
</a>''')
    # cluster cards
    clcards=[]
    for cl in CL_ORDER:
        if cl_counts.get(cl,0)==0: continue
        clcards.append(f'''<a class="pdb-clcard" href="/poly/courses/?cluster={esc(cl)}">
  <span class="ic">{cl_icon.get(cl,"🎓")}</span><span class="nm">{esc(cl)}</span><span class="ct"><b>{cl_counts[cl]}</b> 个专业</span>
</a>''')
    # mini preview: 4 hardest (lowest lo) + label
    hardest=sorted(courses,key=lambda c:c["lo"])[:5]
    minirows="".join(f'''<div class="row"><span class="nm">{esc(c["name_zh"])}</span><span class="pp">{esc(polys[c["poly"]]["abbr"])}</span><span class="pdb-score {diff_cls(c["diff"])}">{esc(c["elr2b2"])}</span></div>''' for c in hardest)

    stats=[("5","所公立理工"),(str(N),"个 Diploma 专业"),(str(len([1 for cl in CL_ORDER if cl_counts.get(cl)])) ,"个专业大类"),(YEAR,"最新 ELR2B2"),("NUS·NTU·SIT","可衔接公立大学")]
    statshtml="".join(f'<div class="pdb-stat"><div class="n">{esc(n)}</div><div class="l">{esc(l)}</div></div>' for n,l in stats)

    faqs=[
     ("ELR2B2 是什么？分数怎么算？","ELR2B2 是新加坡 O-Level 升理工学院（JAE）的核心分数：英文（EL）+ 2 门相关科目（R2）+ 2 门最佳科目（B2），共 5 科分数之和，<b>越低越好</b>，可减去 CCA 加分。大部分专业要求净分 ≤26，护理类（ELR2B2-C）放宽到 ≤28。本数据库的区间表示当年录取学生「最高分到最低分」的范围。"),
     ("表里的录取分区间怎么看？","每个专业显示的是 %s 年 JAE 最近一届实际录取学生的净 ELR2B2 范围（例如「5-12」表示分数最好的学生 5 分、分数最低的被录取者 12 分）。这是历史参考，不代表下一届的预定截分——实际会随当届考生成绩和报考热度浮动。"%YEAR),
     ("中国学生可以申请理工学院吗？","可以。国际学生可凭 O-Level 或同等学历（如初中/高中成绩 + AEIS/英文测试）申请，主流通过 JAE 或国际学生通道。理工 Diploma 毕业后可凭 GPA 升 SIT / NUS / NTU / SMU / SUTD 及英澳大学，部分课程学分减免、最快 2 年完成本科。"),
     ("5 所理工怎么选？","看专业方向和分数：SP 海事/视光/航空全国唯一；NP 传媒/电影、护理强；NYP 护理/健康科学、教学工厂模式；TP 设计/兽医技术（全国唯一）；RP 问题导向学习 PBL、体育/酒店强。用上方「专业方向」或打开数据库按分数筛选最直观。"),
    ]
    faqhtml="".join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q,a in faqs)

    jsonld=[
      {"@context":"https://schema.org","@type":"CollectionPage","name":"新加坡五大理工学院专业与录取分数据库","url":canon,
       "description":"新加坡 5 所公立理工学院（SP/NP/NYP/TP/RP）完整对比与 %d 个 Diploma 专业的 %s 年 ELR2B2 录取分数据库。"%(N,YEAR),"inLanguage":"zh-CN"},
      {"@context":"https://schema.org","@type":"ItemList","itemListElement":[
         {"@type":"ListItem","position":i+1,"name":polys[s]["name_zh"],"url":"https://sgeda.org.cn/poly/%s/"%s} for i,s in enumerate(["sp","np","nyp","tp","rp"])]},
      {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
         {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
         {"@type":"ListItem","position":2,"name":"理工学院数据库"}]},
      {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
         {"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub("<[^>]+>","",a)}} for q,a in faqs]},
    ]

    title="新加坡五大理工学院完全指南：5所Polytechnic对比 + %d个专业ELR2B2录取分数据库（%s）"%(N,YEAR)
    desc="新加坡 5 所公立理工学院（SP/NP/NYP/TP/RP）一站式对比：创办年份、校区、王牌专业，以及 %d 个 Diploma 课程的 %s 年 JAE ELR2B2 录取分数据库，可按专业方向和分数查询。"%(N,YEAR)

    body=f'''
  <section class="pdb-hero"><div class="in">
    <span class="pdb-eyebrow">🎓 5 所公立理工 · {N} 个 Diploma · 真实 ELR2B2 录取分</span>
    <h1>新加坡五大理工学院<br>专业与录取分数据库</h1>
    <p class="sub">SP · NP · NYP · TP · RP 一站对比。{N} 个 Diploma 专业的 {YEAR} 年 JAE 录取分数（ELR2B2）全部收录，按专业方向或你的分数即可查到能进哪些专业。</p>
    <form class="pdb-searchbar" action="/poly/courses/" method="get">
      <input type="search" name="q" placeholder="搜专业 / 学校，如 护理、商科、网络安全、SP" aria-label="搜索专业">
      <button type="submit">搜索专业</button>
    </form>
    <div class="pdb-hotrow"><span>热门：</span><a href="/poly/courses/?q=护理">护理</a><a href="/poly/courses/?q=商">商科</a><a href="/poly/courses/?cluster=信息科技">信息科技</a><a href="/poly/courses/?cluster=工程">工程</a><a href="/poly/courses/?q=设计">设计</a><a href="/poly/courses/?q=航空">航空</a></div>
    <div class="pdb-trust"><span>✅ 数据来源 MOE / 各校官方</span><span>✅ {YEAR} 最新一届 JAE</span><span>✅ 可按分数筛选</span></div>
  </div></section>

  <div class="pdb-statsband"><div class="pdb-stats">{statshtml}</div></div>

  <section class="pdb-sec">
    <h2>5 所公立理工学院</h2>
    <p class="lead">新加坡仅有 5 所公立理工学院，全部颁发受 NUS/NTU/SIT 等公立大学认可的 Diploma 文凭。点开任意一所看王牌专业、录取分与申请路径。</p>
    <div class="pdb-polys">{''.join(pcards)}</div>
  </section>

  <section class="pdb-sec" style="padding-top:0">
    <h2>按专业方向浏览</h2>
    <p class="lead">{N} 个 Diploma 按 {len([cl for cl in CL_ORDER if cl_counts.get(cl)])} 个方向归类，点一下直接进数据库看该方向所有专业的录取分。</p>
    <div class="pdb-clusters">{''.join(clcards)}</div>
  </section>

  <section class="pdb-sec" style="padding-top:0">
    <div class="pdb-dbteaser">
      <div>
        <h2>📊 专业录取分数据库</h2>
        <p>把 5 所理工的 {N} 个 Diploma 专业、{YEAR} 年真实 ELR2B2 录取分放进一张可筛选的表。输入你的 O-Level 分数，立刻看到「我能进哪些专业」——这是中文网络上少有的完整理工选专业工具。</p>
        <a class="btn" href="/poly/courses/">打开完整数据库 →</a>
      </div>
      <div class="pdb-mini" aria-hidden="true">
        <div style="font-size:.8rem;color:var(--muted);font-weight:700">🔥 全国最难进的 5 个专业（分数越低越难）</div>
        {minirows}
      </div>
    </div>
  </section>

  <section class="pdb-sec" style="padding-top:0">
    <h2>理工 → 大学升学路径</h2>
    <p class="lead">理工学院不是终点。Diploma 毕业凭 GPA 可直升公立或英澳名校，部分专业学分减免。</p>
    <div class="pdb-path">
      <div class="pdb-pstep"><div class="n">STEP 1</div><div class="t">O-Level</div><div class="d">5 科 ELR2B2 通过 JAE 竞争入学</div></div>
      <div class="pdb-pstep"><div class="n">STEP 2</div><div class="t">理工 Diploma</div><div class="d">3 年文凭 + 实习，积累 GPA</div></div>
      <div class="pdb-pstep"><div class="n">STEP 3</div><div class="t">本科学位</div><div class="d">升 SIT/NUS/NTU/SMU 或英澳</div></div>
      <div class="pdb-pstep"><div class="n">STEP 4</div><div class="t">就业 / 深造</div><div class="d">本地就业或继续读硕</div></div>
    </div>
  </section>

  <section class="pdb-sec pdb-faq" style="padding-top:0">
    <h2>常见问题</h2>
    <div style="margin-top:6px">{faqhtml}</div>
  </section>
'''
    return head(title,desc,canon,jsonld)+body+TAIL

# ============================================================ DATABASE
def build_database():
    canon="https://sgeda.org.cn/poly/courses/"
    cl_counts={cl:sum(1 for c in courses if c["cluster"]==cl) for cl in CL_ORDER}
    abbr={s:polys[s]["abbr"] for s in polys}
    logo={s:polys[s]["logo"] for s in polys}

    # sort default by lo asc
    rows_sorted=sorted(courses,key=lambda c:(c["lo"],c["hi"]))
    rows=[]
    for c in rows_sorted:
        s=c["poly"]
        # bar width: map lo (3..26) to inverse fill (harder->fuller). fill = (27-lo)/27*100 clamped
        fill=max(8,min(100,round((27-c["lo"])/24*100)))
        rows.append(f'''<tr data-poly="{s}" data-cluster="{esc(c["cluster"])}" data-lo="{c["lo"]}" data-hi="{c["hi"]}" data-name="{esc((c["name_zh"]+" "+c["name_en"]+" "+abbr[s]+" "+c["cluster"]).lower())}">
<td><span class="pdb-cn">{esc(c["name_zh"])}</span><span class="pdb-ce col-en">{esc(c["name_en"])} · {esc(c["code"])}</span></td>
<td class="col-en"><span class="pdb-pbadge"><img src="{logo[s]}" alt="">{esc(abbr[s])}</span></td>
<td><span class="pdb-ctag">{esc(c["cluster"])}</span></td>
<td><span class="pdb-score {c["diff"]}">{esc(c["elr2b2"])}</span></td>
<td><div class="pdb-bar"><i class="{c["diff"]}" style="width:{fill}%"></i></div></td>
</tr>''')
    rowshtml="\n".join(rows)

    polychips="".join(f'<span class="pdb-chip" data-f="poly" data-v="{s}">{esc(abbr[s])}</span>' for s in ["sp","np","nyp","tp","rp"])
    clchips="".join(f'<span class="pdb-chip" data-f="cluster" data-v="{esc(cl)}">{esc(cl)} {cl_counts[cl]}</span>' for cl in CL_ORDER if cl_counts.get(cl))

    jsonld=[
      {"@context":"https://schema.org","@type":"Dataset","name":"新加坡理工学院 Diploma 专业 ELR2B2 录取分数据库（%s）"%YEAR,
       "description":"新加坡 5 所公立理工学院（SP/NP/NYP/TP/RP）共 %d 个全日制 Diploma 专业的 %s 年 JAE 净 ELR2B2 录取分数区间，含专业方向分类。"%(N,YEAR),
       "url":canon,"inLanguage":"zh-CN","keywords":"ELR2B2,理工学院,Polytechnic,录取分数,JAE,Diploma",
       "creator":{"@type":"Organization","name":"SEDA 新加坡择校网"},"isAccessibleForFree":True},
      {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
         {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
         {"@type":"ListItem","position":2,"name":"理工学院数据库","item":"https://sgeda.org.cn/poly/"},
         {"@type":"ListItem","position":3,"name":"专业录取分数据库"}]},
    ]
    title="新加坡理工学院专业数据库：%d个Diploma课程ELR2B2录取分查询（%s JAE）"%(N,YEAR)
    desc="新加坡 5 所理工学院 %d 个 Diploma 专业的 %s 年 JAE ELR2B2 录取分一表查询，可按专业方向、学校和你的 O-Level 分数筛选，看自己能进哪些专业。"%(N,YEAR)

    body=f'''
  <section class="pdb-dbhero"><div class="in">
    <h1>理工学院专业录取分数据库</h1>
    <p>5 所公立理工 · {N} 个 Diploma 专业 · {YEAR} 年 JAE 净 ELR2B2 录取分。输入你的分数，看能进哪些专业。</p>
  </div></section>

  <div class="pdb-tools"><div class="in">
    <div class="pdb-toolrow">
      <div class="pdb-find">🔎<input type="search" id="pdbq" placeholder="搜专业 / 学校 / 方向，如 护理、SP、网络安全"></div>
      <div class="pdb-scorebox"><span>我的 ELR2B2</span><input type="number" id="pdbscore" min="3" max="30" placeholder="如 12"><label><input type="checkbox" id="pdbonly">只看我能进的</label></div>
      <select class="pdb-sort" id="pdbsort">
        <option value="lo-asc">按录取分 · 难→易</option>
        <option value="lo-desc">按录取分 · 易→难</option>
        <option value="poly">按学校</option>
        <option value="name">按专业名</option>
      </select>
    </div>
    <div class="pdb-toolrow"><span class="pdb-chiplabel">学校</span><div class="pdb-chips">{polychips}</div></div>
    <div class="pdb-toolrow"><span class="pdb-chiplabel">方向</span><div class="pdb-chips">{clchips}</div></div>
  </div></div>
  <div class="pdb-count">显示 <b id="pdbshow">{N}</b> / {N} 个专业　<span id="pdbhint" style="color:var(--muted)"></span></div>

  <div class="pdb-tablewrap">
    <table class="pdb-table" id="pdbtable">
      <thead><tr>
        <th data-sort="name">专业 <span class="ar"></span></th>
        <th class="col-en" data-sort="poly">学校 <span class="ar"></span></th>
        <th>方向</th>
        <th data-sort="lo">ELR2B2 <span class="ar">▲</span></th>
        <th>竞争度</th>
      </tr></thead>
      <tbody id="pdbbody">
{rowshtml}
      </tbody>
    </table>
    <div class="pdb-empty" id="pdbempty">没有符合条件的专业，试着放宽筛选条件。</div>
  </div>

  <section class="pdb-sec" style="padding-top:10px">
    <p class="lead" style="font-size:.86rem">数据为 {YEAR} 年 JAE 各专业净 ELR2B2 录取区间（最高分–最低分），来源 MOE 及各理工官方招生页，仅供参考，实际截分每届浮动。想要一对一选专业建议，可<a href="/contact/" style="color:var(--brand-strong);font-weight:700">免费咨询顾问</a>。</p>
  </section>
'''
    js=r'''
<script>
(function(){
  var body=document.getElementById('pdbbody');
  var rows=[].slice.call(body.querySelectorAll('tr'));
  var q=document.getElementById('pdbq'),score=document.getElementById('pdbscore'),only=document.getElementById('pdbonly');
  var show=document.getElementById('pdbshow'),hint=document.getElementById('pdbhint'),empty=document.getElementById('pdbempty');
  var sortSel=document.getElementById('pdbsort');
  var fPoly={},fCluster={};
  function activeSet(o){return Object.keys(o).filter(function(k){return o[k]})}
  function apply(){
    var term=(q.value||'').trim().toLowerCase();
    var sc=parseInt(score.value,10); var onlyMe=only.checked && !isNaN(sc);
    var aP=activeSet(fPoly),aC=activeSet(fCluster),n=0;
    rows.forEach(function(tr){
      var ok=true;
      if(term && tr.getAttribute('data-name').indexOf(term)<0) ok=false;
      if(ok && aP.length && aP.indexOf(tr.getAttribute('data-poly'))<0) ok=false;
      if(ok && aC.length && aC.indexOf(tr.getAttribute('data-cluster'))<0) ok=false;
      var hi=parseInt(tr.getAttribute('data-hi'),10);
      var reachable=!isNaN(sc)&&sc<=hi;
      if(ok && onlyMe && !reachable) ok=false;
      tr.style.display=ok?'':'none';
      tr.classList.toggle('hit', ok && !isNaN(sc) && reachable);
      if(ok) n++;
    });
    show.textContent=n; empty.style.display=n?'none':'block';
    hint.textContent=(!isNaN(sc))?('· 绿色标记 = 你的分数 '+sc+' 可达的专业'):'';
  }
  function sortRows(mode){
    var arr=rows.slice();
    arr.sort(function(a,b){
      if(mode=='lo-asc')return (+a.dataset.lo)-(+b.dataset.lo)||(+a.dataset.hi)-(+b.dataset.hi);
      if(mode=='lo-desc')return (+b.dataset.lo)-(+a.dataset.lo)||(+b.dataset.hi)-(+a.dataset.hi);
      if(mode=='poly')return a.dataset.poly.localeCompare(b.dataset.poly)||(+a.dataset.lo)-(+b.dataset.lo);
      if(mode=='name')return a.dataset.name.localeCompare(b.dataset.name);
      return 0;
    });
    arr.forEach(function(tr){body.appendChild(tr)});
  }
  q.addEventListener('input',apply); score.addEventListener('input',apply); only.addEventListener('change',apply);
  sortSel.addEventListener('change',function(){sortRows(sortSel.value);});
  document.querySelectorAll('.pdb-chip').forEach(function(ch){
    ch.addEventListener('click',function(){
      ch.classList.toggle('on');
      var f=ch.getAttribute('data-f'),v=ch.getAttribute('data-v');
      var store=f=='poly'?fPoly:fCluster; store[v]=ch.classList.contains('on'); apply();
    });
  });
  document.querySelectorAll('.pdb-table thead th[data-sort]').forEach(function(th){
    th.addEventListener('click',function(){
      var k=th.getAttribute('data-sort');
      if(k=='lo'){var cur=sortSel.value; sortSel.value=(cur=='lo-asc')?'lo-desc':'lo-asc';}
      else sortSel.value=k;
      sortRows(sortSel.value);
    });
  });
  // read URL params (q / cluster) from landing links
  var sp=new URLSearchParams(location.search);
  if(sp.get('q')){q.value=sp.get('q');}
  var cl=sp.get('cluster');
  if(cl){document.querySelectorAll('.pdb-chip[data-f="cluster"]').forEach(function(ch){if(ch.getAttribute('data-v')===cl){ch.classList.add('on');fCluster[cl]=true;}});}
  apply();
})();
</script>'''
    return head(title,desc,canon,jsonld)+body+js+TAIL

# ---- write ----
os.makedirs(os.path.join(ROOT,"poly/courses"),exist_ok=True)
open(os.path.join(ROOT,"poly/index.html"),"w",encoding="utf-8").write(build_landing())
open(os.path.join(ROOT,"poly/courses/index.html"),"w",encoding="utf-8").write(build_database())
print("wrote poly/index.html and poly/courses/index.html")
print("landing bytes:",os.path.getsize(os.path.join(ROOT,"poly/index.html")))
print("database bytes:",os.path.getsize(os.path.join(ROOT,"poly/courses/index.html")))
