# -*- coding: utf-8 -*-
"""Build /university/uas/ — bespoke arts page for University of the Arts Singapore.
Its OWN design (NOT the nx- public-uni template). Rich intro (LASALLE+NAFA alliance,
own degrees, difference vs private unis) + a filterable 35-programme arts directory database.
Data: content/university/uni-data.json -> D["uas"] (35 real degree programmes)."""
import os, json, html

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSSV="38"
D=json.load(open(os.path.join(ROOT,"content/university/uni-data.json"),encoding="utf-8"))
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
def esc(s): return html.escape(str(s),quote=True)

PROGS=D["uas"]
N=len(PROGS)
COLLEGES=["LASALLE","NAFA"]
CLUSTERS=["纯艺术","设计","媒体与电影","表演艺术","音乐","艺术管理与理论"]
LEVELS=["本科","研究生"]
ENTRIES=["作品集","试镜","面试"]
CLCOLOR={"纯艺术":"#ff5470","设计":"#6a2c91","媒体与电影":"#2c7be5","表演艺术":"#e8590c","音乐":"#15998a","艺术管理与理论":"#9b51b0"}
CLICON={"纯艺术":"🎨","设计":"✏️","媒体与电影":"🎬","表演艺术":"🎭","音乐":"🎵","艺术管理与理论":"🗂️"}
ENPILL={"作品集":"port","试镜":"aud","面试":"itv"}

def count(field,val): return sum(1 for p in PROGS if p[field]==val)

CSS=r'''
:root{--ua-ink:#231331;--ua-pur:#3d1b54;--ua-pur2:#6a2c91;--ua-cor:#ff5470;--ua-line:#ece3f2;--ua-muted:#6c6577}
.ua *{box-sizing:border-box}
.ua{color:var(--ua-ink);background:#fff}
.ua ::selection{background:var(--ua-cor);color:#fff}
/* hero */
.ua-hero{position:relative;overflow:hidden;padding:64px clamp(20px,6vw,84px) 58px;background:radial-gradient(1100px 460px at 78% -8%,rgba(255,84,112,.42),transparent 60%),linear-gradient(135deg,#2a1140 0%,#3d1b54 42%,#6a2c91 100%)}
.ua-hero,.ua-hero *{color:#fff}
.ua-hero .in{max-width:1120px;margin:0 auto;position:relative;z-index:2}
.ua-hero::after{content:"";position:absolute;right:-90px;bottom:-90px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(255,84,112,.5),transparent 68%);z-index:1}
.ua-kick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.ua-kick span{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.34);padding:6px 13px;border-radius:999px;font-size:.82rem;font-weight:700;backdrop-filter:blur(3px)}
.ua-hero h1{font-size:clamp(30px,5vw,54px);line-height:1.08;margin:0 0 8px;font-weight:880;letter-spacing:-.01em}
.ua-hero .en{font-size:clamp(13px,1.5vw,16px);letter-spacing:.04em;opacity:.82;margin:0 0 18px;font-weight:600}
.ua-hero .sub{max-width:760px;font-size:clamp(15px,1.7vw,17.5px);line-height:1.72;color:rgba(255,255,255,.92);margin:0}
.ua-stats{display:flex;flex-wrap:wrap;gap:10px 30px;margin-top:30px}
.ua-stat .n{font-size:clamp(20px,2.6vw,30px);font-weight:850;line-height:1}
.ua-stat .l{font-size:.78rem;opacity:.82;margin-top:5px}
/* sections */
.ua-sec{max-width:1120px;margin:0 auto;padding:50px clamp(20px,6vw,84px)}
.ua-sec.tight{padding-top:0}
.ua-sec h2{font-size:clamp(22px,3vw,31px);margin:0 0 6px;font-weight:840;letter-spacing:-.01em}
.ua-sec h2 .em{color:var(--ua-pur2)}
.ua-sec .lead{color:var(--ua-muted);margin:0 0 26px;line-height:1.7;max-width:780px}
.ua-tldr{max-width:1120px;margin:0 auto;padding:0 clamp(20px,6vw,84px)}
.ua-tldr .box{margin-top:-30px;position:relative;z-index:5;background:#fff;border:1px solid var(--ua-line);border-left:5px solid var(--ua-cor);border-radius:16px;padding:20px 24px;box-shadow:0 18px 46px rgba(61,27,84,.14);line-height:1.78;font-size:1.02rem}
.ua-prose p{line-height:1.86;margin:0 0 16px;font-size:1.01rem;color:#3a3145}
.ua-prose p:last-child{margin-bottom:0}
/* feature/why cards */
.ua-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:16px}
.ua-card{border:1px solid var(--ua-line);border-radius:15px;padding:20px;background:#fff;transition:transform .18s,box-shadow .18s}
.ua-card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(61,27,84,.12)}
.ua-card .ic{font-size:1.7rem;line-height:1}
.ua-card h3{margin:.55rem 0 .35rem;font-size:1.06rem;font-weight:800}
.ua-card p{margin:0;color:var(--ua-muted);font-size:.92rem;line-height:1.62}
/* two colleges */
.ua-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.ua-col{border:1px solid var(--ua-line);border-radius:18px;padding:24px;background:linear-gradient(180deg,#fbf6fe,#fff 55%)}
.ua-col .tag{display:inline-block;font-weight:850;font-size:1.18rem;color:var(--ua-pur2)}
.ua-col .sub{color:var(--ua-muted);font-size:.86rem;margin:.2rem 0 .7rem}
.ua-col p{margin:0;line-height:1.7;font-size:.95rem;color:#3a3145}
/* comparison table */
.ua-cmp{width:100%;border-collapse:collapse;font-size:.94rem;border:1px solid var(--ua-line);border-radius:14px;overflow:hidden}
.ua-cmp th,.ua-cmp td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--ua-line);vertical-align:top}
.ua-cmp thead th{background:var(--ua-pur);color:#fff;font-weight:800}
.ua-cmp thead th.hl{background:var(--ua-pur2)}
.ua-cmp tbody th{font-weight:700;background:#faf6fd;width:26%}
.ua-cmp .uas-cell{background:#fdf0f4;font-weight:600}
.ua-cmp tr:last-child td,.ua-cmp tr:last-child th{border-bottom:0}
/* DATABASE */
.ua-db{background:linear-gradient(180deg,#faf6fd,#fff);border-top:1px solid var(--ua-line);border-bottom:1px solid var(--ua-line)}
.ua-tools{max-width:1120px;margin:0 auto;padding:22px clamp(20px,6vw,84px) 6px}
.ua-find{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--ua-line);border-radius:12px;padding:10px 14px;max-width:520px;box-shadow:0 4px 14px rgba(61,27,84,.06)}
.ua-find input{flex:1;border:0;outline:0;font-size:1rem;color:var(--ua-ink);background:transparent;min-width:0}
.ua-frow{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:14px}
.ua-flb{font-size:.78rem;color:var(--ua-muted);font-weight:800;margin-right:2px}
.ua-chip{font-size:.83rem;border:1px solid var(--ua-line);background:#fff;color:var(--ua-muted);padding:6px 13px;border-radius:999px;cursor:pointer;user-select:none;transition:.13s}
.ua-chip:hover{border-color:var(--ua-pur2)}
.ua-chip.on{background:var(--ua-pur2);border-color:var(--ua-pur2);color:#fff}
.ua-count{max-width:1120px;margin:0 auto;padding:16px clamp(20px,6vw,84px) 0;font-size:.92rem;color:var(--ua-muted)}
.ua-count b{color:var(--ua-pur2);font-size:1.08rem}
.ua-progs{max-width:1120px;margin:0 auto;padding:14px clamp(20px,6vw,84px) 50px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.ua-prog{display:flex;flex-direction:column;border:1px solid var(--ua-line);border-left:4px solid var(--cl,#6a2c91);border-radius:13px;padding:15px 17px;background:#fff;transition:transform .15s,box-shadow .15s}
.ua-prog:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(61,27,84,.12);border-color:var(--cl,#6a2c91)}
.ua-prog.hide{display:none}
.ua-plink{display:block;flex:1;text-decoration:none;color:inherit}
.ua-prog .zh .ext{font-size:.8em;color:var(--cl,#6a2c91);opacity:.85;margin-left:2px}
.ua-consult{display:inline-flex;align-items:center;gap:4px;align-self:flex-start;margin-top:12px;font-size:.8rem;font-weight:800;color:var(--cl,#6a2c91);text-decoration:none;border-top:1px dashed var(--ua-line);padding-top:10px;width:100%}
.ua-consult:hover{text-decoration:underline}
.ua-prog .zh{font-weight:800;font-size:1.05rem;line-height:1.3}
.ua-prog .en{color:var(--ua-muted);font-size:.78rem;margin:.12rem 0 .6rem}
.ua-prog .tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:.6rem}
.ua-prog .t{font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px}
.ua-prog .t.cl{color:#fff;background:var(--cl,#6a2c91)}
.ua-prog .t.col{background:#efe7f5;color:var(--ua-pur2)}
.ua-prog .t.lv{background:#eef1f6;color:#516079}
.ua-prog .t.en2{font-size:.74rem;font-weight:800;padding:2px 9px;border-radius:999px}
.ua-prog .t.en2.port{background:#f3e3fb;color:#8e24aa}
.ua-prog .t.en2.aud{background:#ffe4ea;color:#e0345a}
.ua-prog .t.en2.itv{background:#eceff3;color:#516079}
.ua-prog .req{font-size:.85rem;color:#4a4357;line-height:1.55;margin:0}
.ua-empty{max-width:1120px;margin:0 auto;padding:0 clamp(20px,6vw,84px) 40px;color:var(--ua-muted);display:none}
/* routes */
.ua-routes{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.ua-route{border:1px solid var(--ua-line);border-radius:14px;padding:18px;background:#fff}
.ua-route.lead{border:0;background:linear-gradient(135deg,var(--ua-pur),var(--ua-pur2))}
.ua-route.lead *{color:#fff}
.ua-route .h{font-weight:800;font-size:1.02rem;margin:.4rem 0 .3rem;display:flex;align-items:center;gap:7px}
.ua-route .bdg{font-size:.68rem;font-weight:800;background:var(--ua-cor);color:#fff;padding:2px 8px;border-radius:999px}
.ua-route p{margin:0;font-size:.9rem;line-height:1.6;color:var(--ua-muted)}
.ua-route.lead p{color:rgba(255,255,255,.92)}
/* fees / faq / related */
.ua-note{background:#faf6fd;border:1px solid var(--ua-line);border-radius:13px;padding:16px 18px;font-size:.9rem;color:#4a4357;line-height:1.7;margin-top:14px}
.ua-faq details{border:1px solid var(--ua-line);border-radius:12px;padding:2px 16px;margin-bottom:9px;background:#fff}
.ua-faq summary{cursor:pointer;font-weight:700;padding:13px 0;list-style:none}
.ua-faq summary::-webkit-details-marker{display:none}
.ua-faq summary::after{content:"+";float:right;color:var(--ua-pur2);font-weight:800}
.ua-faq details[open] summary::after{content:"–"}
.ua-faq .a{padding:0 0 14px;color:#4a4357;line-height:1.74}
.ua-rel{display:flex;flex-wrap:wrap;gap:10px}
.ua-rel a{border:1px solid var(--ua-line);border-radius:999px;padding:9px 17px;text-decoration:none;color:var(--ua-pur2);font-weight:700;font-size:.92rem;transition:.13s}
.ua-rel a:hover{background:var(--ua-pur2);color:#fff;border-color:var(--ua-pur2)}
@media(max-width:680px){.ua-cols{grid-template-columns:1fr}.ua-cmp{font-size:.86rem}.ua-cmp th,.ua-cmp td{padding:10px}.ua-cmp tbody th{width:32%}}
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
<main class="ua">'''
TAIL=f'''</main>
{FOOTER}
<script src="/seda-site.js?v=28"></script>
</body>
</html>'''

# ---- programme cards ----
def prog_card(p):
    cl=p["cluster"]; en=p["rtype"]; url=p.get("url","#")
    name=(p["zh"]+" "+p["en"]+" "+p["college"]+" "+cl+" "+p["level"]+" "+en).lower()
    return f'''<div class="ua-prog" style="--cl:{CLCOLOR[cl]}" data-col="{esc(p['college'])}" data-cl="{esc(cl)}" data-lv="{esc(p['level'])}" data-en="{esc(en)}" data-name="{esc(name)}">
  <a class="ua-plink" href="{esc(url)}" target="_blank" rel="nofollow noopener" title="查看 {esc(p['college'])} 官方专业页">
    <div class="zh">{esc(p['zh'])}<span class="ext">↗</span></div><div class="en">{esc(p['en'])}</div>
    <div class="tags"><span class="t cl">{CLICON[cl]} {esc(cl)}</span><span class="t col">{esc(p['college'])}</span><span class="t lv">{esc(p['level'])}</span><span class="t en2 {ENPILL[en]}">{esc(en)}</span></div>
    <p class="req">{esc(p['req'])}</p>
  </a>
  <a class="ua-consult" href="/contact/">💬 免费咨询该专业 →</a>
</div>'''

def chips(field,vals,icons=None):
    out=[]
    for v in vals:
        ic=(icons.get(v,"")+" ") if icons else ""
        out.append(f'<span class="ua-chip" data-f="{field}" data-v="{esc(v)}">{ic}{esc(v)}（{count(_FIELD[field],v)}）</span>')
    return "".join(out)
_FIELD={"col":"college","cl":"cluster","lv":"level","en":"rtype"}

def build():
    canon="https://sgeda.org.cn/university/uas/"
    title="新加坡艺术大学（UAS）完整指南：LASALLE+NAFA 联盟、35 个学位专业目录、作品集/试镜录取与申请路径 | SEDA"
    desc="新加坡艺术大学（UAS）深度指南：由拉萨尔（LASALLE）与南洋艺术学院（NAFA）联盟组成、政府支持的新加坡首所艺术大学。2024 年起自授本科与硕士学位（取代原英国伙伴大学学位）。含 35 个学位专业可筛选目录（按学院/学科/层级/入学方式），作品集 / 试镜录取，与其他私立大学的区别、学费与中国学生申请路径。"
    jsonld=[
     {"@context":"https://schema.org","@type":"CollegeOrUniversity","name":"新加坡艺术大学","alternateName":["University of the Arts Singapore","UAS"],
      "url":canon,"sameAs":["https://uas.edu.sg/"],"foundingDate":"2024","address":{"@type":"PostalAddress","addressCountry":"SG","addressLocality":"Singapore"},
      "description":"由 LASALLE 与 NAFA 联盟组成、政府支持的新加坡首所艺术大学，自授本科与硕士学位，覆盖纯艺术、设计、媒体、表演、音乐与艺术管理。"},
     {"@context":"https://schema.org","@type":"ItemList","name":"新加坡艺术大学 UAS 学位专业目录","numberOfItems":N,
      "itemListElement":[{"@type":"ListItem","position":i+1,"name":"%s（%s · %s · %s）"%(p["zh"],p["en"],p["college"],p["level"])} for i,p in enumerate(PROGS)]},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
       {"@type":"ListItem","position":2,"name":"新加坡大学","item":"https://sgeda.org.cn/university/"},
       {"@type":"ListItem","position":3,"name":"新加坡艺术大学 UAS"}]},
    ]
    FAQS=[
     ("UAS 是一所什么样的大学？","新加坡艺术大学（University of the Arts Singapore，UAS）于 2024 年 8 月开课，是新加坡首所、也是唯一一所政府支持的艺术大学。它由拉萨尔艺术学院（LASALLE）与南洋艺术学院（NAFA）结成联盟组成，专注纯艺术、设计、媒体、表演与艺术管理。"),
     ("UAS 和 LASALLE、NAFA 是什么关系？","是联盟（alliance）关系：LASALLE 与 NAFA 仍是各自独立的学院，保留自己的校园、品牌与课程；新设的中央机构 UAS Ltd 统一审核并颁授 UAS 学位。学生在原校园上课，毕业拿 UAS 的学位。"),
     ("UAS 发什么学位？和以前有什么不同？","UAS 自 2024 年起颁授自己的本科与硕士学位。此前 LASALLE 的学位由伦敦大学金匠学院（Goldsmiths）授予、NAFA 的学位与伦敦艺术大学（UAL）等合作授予；现在改为由 UAS 自授本土学位，结束了发英国伙伴大学文凭的模式。"),
     ("UAS 和其他私立大学有什么区别？","三点核心区别：① UAS 是政府支持的大学，普通私立大学（SIM、Kaplan、PSB 等）是纯私立；② UAS 自授本土学位，多数私立大学发的是海外伙伴大学的学位；③ UAS 符合条件者可申请 MOE 学费津贴，普通私立大学通常没有。"),
     ("UAS 有多少个学位专业？怎么查？","UAS 共有 %d 个学位专业（LASALLE 25 个 + NAFA 10 个），涵盖纯艺术、设计、媒体与电影、表演艺术、音乐、艺术管理与理论。可用本页的专业目录数据库按学院、学科、层级、入学方式筛选。"%N),
     ("UAS 怎么录取？一定要作品集吗？","以作品集（视觉 / 设计类）或试镜（表演 / 音乐类）为录取核心，部分专业（如艺术管理、艺术史）以面试 + 个人陈述为主；学术成绩达门槛即可，作品 / 试镜表现才是关键。"),
     ("中国学生 / 高考生能申请 UAS 吗？","能。凭高考 / 高中或同等学历，加上作品集 / 试镜与英文能力证明申请；艺术类录取以作品为主、学术为辅。"),
     ("理工 / 大专 Diploma 毕业能进 UAS 吗？","能。相关艺术 / 设计 Diploma 持有者满足条件可直入大二（Year 2），凭作品集 / 试镜与面试录取。"),
     ("UAS 学费多少？能申津贴吗？","学费由 LASALLE / NAFA 按专业分别公布；作为政府支持的大学，符合条件者可申请 MOE 学费津贴降低学费（通常须签毕业后服务协议）。艺术专业另有材料 / 工作室费用，准确金额以官方为准。"),
     ("UAS 适合什么样的学生？","适合立志走专业艺术 / 设计 / 表演 / 音乐道路、有作品集或表演特长、想要新加坡本土学位 + 政府支持（可申津贴）、并喜欢市中心创意产业环境的学生。"),
    ]
    jsonld.append({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in FAQS]})

    why=[("🎨","新加坡首所艺术大学","第一所、也是唯一一所政府支持的艺术大学，专注艺术与设计。"),
         ("🤝","两校强强联盟","集 LASALLE 与 NAFA 两所顶尖艺术学府之长，各自保留特色与校园。"),
         ("🎓","自授本土学位","2024 年起由 UAS 颁授学位，取代原英国伙伴大学文凭。"),
         ("💰","政府支持 · 可申津贴","符合条件者可申请 MOE 学费津贴——普通私立艺术学院通常没有。"),
         ("📁","作品集 / 试镜录取","看重创作能力与潜力，不唯学术分数论。"),
         ("🌏","艺术 × 科技 × 社会","课程把艺术与科技、社会、环境结合，面向当代创意产业。")]
    whyhtml="".join(f'<div class="ua-card"><div class="ic">{i}</div><h3>{esc(t)}</h3><p>{esc(d)}</p></div>' for i,t,d in why)

    routes=[("📁","作品集 / 试镜","UAS 录取核心","UAS 以作品集（视觉 / 设计类）或试镜（表演 / 音乐类）为录取核心，看重创作能力与潜力；学术成绩是参考，作品才是关键。",True),
            ("🇨🇳","中国高考 / 学历","","凭高考 / 高中或同等学历 + 作品集 / 试镜申请；艺术类录取以作品为主、学术为辅，并需英文能力证明。",False),
            ("📘","A-Level","","凭 A-Level 申请（可合并成绩），结合作品集 / 试镜与面试综合评估。",False),
            ("🎓","艺术 Diploma / 大专","","相关艺术 / 设计 Diploma 满足条件可直入大二（Year 2），凭作品集 / 试镜与面试录取。",False),
            ("💰","MOE 学费津贴","政府支持","符合条件者可申请 MOE 学费津贴降低学费——普通私立艺术学院通常没有。",False),
            ("🗣️","语言要求","","全英文授课；英文非母语者需提供雅思 / 托福等语言成绩。",False)]
    def route(ic,t,bdg,d,lead):
        b=f'<span class="bdg">{esc(bdg)}</span>' if bdg else ''
        return f'<div class="ua-route{" lead" if lead else ""}"><div class="h">{ic} {esc(t)} {b}</div><p>{d}</p></div>'
    routehtml="".join(route(*r) for r in routes)

    body=f'''
  <section class="ua-hero"><div class="in">
    <div class="ua-kick"><span>🎨 新加坡首所艺术大学</span><span>🤝 LASALLE + NAFA 联盟</span><span>📅 2024 年创办 · 政府支持</span></div>
    <h1>新加坡艺术大学 UAS</h1>
    <p class="en">UNIVERSITY OF THE ARTS SINGAPORE</p>
    <p class="sub">由拉萨尔艺术学院（LASALLE）与南洋艺术学院（NAFA）联盟组成的新加坡首所艺术大学。两校保留各自校园与传统，由 UAS 统一颁授本科与硕士学位，覆盖纯艺术、设计、媒体、表演、音乐与艺术管理。</p>
    <div class="ua-stats">
      <div class="ua-stat"><div class="n">2024</div><div class="l">创办 · 首所艺术大学</div></div>
      <div class="ua-stat"><div class="n">2 所</div><div class="l">创始学院 LASALLE+NAFA</div></div>
      <div class="ua-stat"><div class="n">{N} 个</div><div class="l">UAS 学位专业</div></div>
      <div class="ua-stat"><div class="n">作品集 / 试镜</div><div class="l">录取核心</div></div>
      <div class="ua-stat"><div class="n">政府支持</div><div class="l">可申 MOE 津贴</div></div>
    </div>
  </div></section>
  <div class="ua-tldr"><div class="box">一句话看懂：<b>UAS 是新加坡第一所艺术大学</b>，由<b>拉萨尔（LASALLE）+ 南洋艺术学院（NAFA）联盟</b>组成、政府支持。两校保留各自校园与特色，由 UAS 统一<b>颁授自己的本科 / 硕士学位</b>（不再发英国伙伴大学学位）。录取看<b>作品集 / 试镜</b>，且可申 MOE 学费津贴——这是它和普通私立艺术学院最大的不同。</div></div>

  <section class="ua-sec ua-prose">
    <h2>概况：<span class="em">一所「联盟制」的艺术大学</span></h2>
    <p>新加坡艺术大学（University of the Arts Singapore，UAS）于 <b>2024 年 8 月正式开课</b>，是<b>新加坡首所、也是唯一一所政府支持的艺术大学</b>。它不是新建一所学校，而是由本地两所顶尖艺术学府——<b>拉萨尔艺术学院（LASALLE）</b>与<b>南洋艺术学院（NAFA）</b>——结成<b>联盟（alliance）</b>共同组成。</p>
    <p>联盟采用「独立学院制」：LASALLE 与 NAFA 仍是<b>各自独立的法律实体与学院</b>，保留自己的校园、品牌与传统、继续开设各自课程；新设的中央机构 <b>UAS Ltd</b> 负责<b>审核、颁授并签发统一的 UAS 学位</b>。学生在原校园上课，毕业拿到的是 UAS 的学位。</p>
    <p><b>最关键的变化</b>：在 UAS 成立前，LASALLE 的学位由<b>伦敦大学金匠学院（Goldsmiths）</b>授予、NAFA 的学位则与<b>伦敦艺术大学（UAL）</b>等合作授予——学生拿的是英国伙伴大学的文凭。2024 年起，新加坡教育部（MOE）授权 UAS <b>自行颁授学位</b>，结束了发外国伙伴大学学位的模式。如今一张 UAS 文凭，是一所<b>新加坡本土艺术大学的自有学位</b>。</p>
  </section>

  <section class="ua-sec tight">
    <div class="ua-grid">{whyhtml}</div>
  </section>

  <section class="ua-sec">
    <h2>两所创始学院</h2>
    <p class="lead">UAS 的学位由两所学院开设、UAS 统一颁授。两校风格不同、各有所长。</p>
    <div class="ua-cols">
      <div class="ua-col"><span class="tag">LASALLE 拉萨尔</span><div class="sub">McNally / Winstedt 校区 · 市中心</div><p>拉萨尔艺术学院，以<b>当代艺术、设计、电影、时装与表演</b>见长，标志性玻璃「峡谷」建筑群。在 UAS 下开设 <b>25 个</b>学位专业（16 个本科 + 9 个硕士）。</p></div>
      <div class="ua-col"><span class="tag">NAFA 南洋艺术</span><div class="sub">Bencoolen 校区 · 市中心</div><p>南洋艺术学院，<b>1938 年</b>创办的老牌艺术学府，<b>纯艺术、设计、音乐（含华乐）、舞蹈与华语戏剧</b>传统深厚。在 UAS 下开设 <b>10 个</b>学位专业（7 个本科 + 3 个硕士）。</p></div>
    </div>
  </section>

  <section class="ua-sec">
    <h2>UAS 和其他私立大学的<span class="em">区别</span></h2>
    <p class="lead">很多人把 UAS 当成普通私立大学，其实差别很大。它是「政府支持的私立艺术大学」，介于公立自主大学与纯私立学院之间。</p>
    <div style="overflow-x:auto"><table class="ua-cmp">
      <thead><tr><th></th><th class="hl">新加坡艺术大学 UAS</th><th>普通私立大学（SIM/Kaplan/PSB…）</th></tr></thead>
      <tbody>
        <tr><th>办学性质</th><td class="uas-cell">政府支持的私立艺术大学</td><td>纯私立教育机构</td></tr>
        <tr><th>颁发的学位</th><td class="uas-cell">UAS <b>自授</b>本土本科 / 硕士学位</td><td>多为<b>海外伙伴大学</b>授予的学位</td></tr>
        <tr><th>学费津贴</th><td class="uas-cell">符合条件可申 <b>MOE 学费津贴</b></td><td>通常没有政府津贴</td></tr>
        <tr><th>录取方式</th><td class="uas-cell">作品集 / 试镜为核心，学术为辅</td><td>多以学术成绩 + 入学要求为主</td></tr>
        <tr><th>定位</th><td class="uas-cell">专注艺术与设计的专门大学</td><td>商科 / 综合学科为主</td></tr>
      </tbody>
    </table></div>
    <p class="ua-note">注：UAS 仍属「私立」范畴，但由 MOE 支持、可自授学位、学生可申津贴，这三点是它区别于普通私立大学的核心。具体津贴与服务协议以官方为准。</p>
  </section>

  <div class="ua-db">
    <div class="ua-tools">
      <h2 style="font-size:clamp(22px,3vw,31px);margin:6px 0 4px;font-weight:840">UAS 学位专业目录 · <span style="color:var(--ua-pur2)">{N} 个</span></h2>
      <p style="color:var(--ua-muted);margin:0 0 18px;line-height:1.7">LASALLE + NAFA 在 UAS 下开设的全部学位专业。<b>艺术大学不看分数线</b>，每个专业按<b>作品集 / 试镜 / 面试</b>录取——可按学院、学科、层级、入学方式筛选。<b>点专业卡片 ↗ 可查看官方专业页详情</b>，或点卡片底部「免费咨询」。</p>
      <div class="ua-find">🔎<input type="search" id="uaq" placeholder="搜专业，如 电影、音乐、设计、Fine Art"></div>
      <div class="ua-frow"><span class="ua-flb">学院</span>{chips("col",COLLEGES)}</div>
      <div class="ua-frow"><span class="ua-flb">学科</span>{chips("cl",CLUSTERS,CLICON)}</div>
      <div class="ua-frow"><span class="ua-flb">层级</span>{chips("lv",LEVELS)}</div>
      <div class="ua-frow"><span class="ua-flb">入学</span>{chips("en",ENTRIES)}</div>
    </div>
    <div class="ua-count">显示 <b id="uashow">{N}</b> / {N} 个学位专业</div>
    <div class="ua-progs" id="uaprogs">{"".join(prog_card(p) for p in PROGS)}</div>
    <div class="ua-empty" id="uaempty">没有匹配的专业，试试减少筛选条件。</div>
    <p style="max-width:1120px;margin:0 auto;padding:0 clamp(20px,6vw,84px) 36px;font-size:.82rem;color:var(--ua-muted)">说明：专业名称、所属学院与入学方式来自 LASALLE / NAFA 官方课程信息；作品集 / 试镜 / 面试的具体要求每年略有调整，最终<b>以 LASALLE / NAFA 官方招生为准</b>。</p>
  </div>

  <section class="ua-sec">
    <h2>申请路径</h2>
    <p class="lead">艺术大学的录取逻辑和综合大学不同——先看作品 / 试镜，学术达门槛即可。</p>
    <div class="ua-routes">{routehtml}</div>
  </section>

  <section class="ua-sec tight">
    <h2>学费</h2>
    <p class="lead">UAS 的学费由两所学院按专业分别公布，作为政府支持的大学可申 MOE 津贴。</p>
    <p class="ua-note">国际学生学费按 LASALLE / NAFA 各专业不同；符合条件者可申请 <b>MOE 学费津贴</b>明显降低学费（申津贴通常须签毕业后在新加坡工作的服务协议）。艺术专业还可能有<b>材料、工作室</b>等额外费用。准确金额请直接向 <a href="https://www.lasalle.edu.sg/" target="_blank" rel="nofollow">LASALLE</a> / <a href="https://www.nafa.edu.sg/" target="_blank" rel="nofollow">NAFA</a> 招生确认。</p>
  </section>

  <section class="ua-sec ua-faq tight">
    <h2>常见问题</h2>
    {"".join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q,a in FAQS)}
  </section>

  <section class="ua-sec tight">
    <h2>相关链接</h2>
    <div class="ua-rel">
      <a href="/university/">新加坡大学总览</a>
      <a href="/university/degrees/">公立大学专业录取分数据库</a>
      <a href="/poly/courses/">理工专业数据库</a>
      <a href="/private-university/">新加坡私立大学</a>
      <a href="/contact/">免费咨询</a>
    </div>
  </section>
'''
    js=r'''
<script>(function(){
  var grid=document.getElementById('uaprogs'),cards=[].slice.call(grid.querySelectorAll('.ua-prog'));
  var q=document.getElementById('uaq'),show=document.getElementById('uashow'),empty=document.getElementById('uaempty');
  var F={col:{},cl:{},lv:{},en:{}};
  function act(o){return Object.keys(o).filter(function(k){return o[k]})}
  function apply(){
    var term=(q.value||'').trim().toLowerCase();
    var aCol=act(F.col),aCl=act(F.cl),aLv=act(F.lv),aEn=act(F.en),n=0;
    cards.forEach(function(c){
      var ok=true;
      if(term&&c.getAttribute('data-name').indexOf(term)<0)ok=false;
      if(ok&&aCol.length&&aCol.indexOf(c.getAttribute('data-col'))<0)ok=false;
      if(ok&&aCl.length&&aCl.indexOf(c.getAttribute('data-cl'))<0)ok=false;
      if(ok&&aLv.length&&aLv.indexOf(c.getAttribute('data-lv'))<0)ok=false;
      if(ok&&aEn.length&&aEn.indexOf(c.getAttribute('data-en'))<0)ok=false;
      c.classList.toggle('hide',!ok);if(ok)n++;
    });
    show.textContent=n;empty.style.display=n?'none':'block';
  }
  q.addEventListener('input',apply);
  document.querySelectorAll('.ua-chip').forEach(function(c){c.addEventListener('click',function(){
    c.classList.toggle('on');var f=c.getAttribute('data-f'),v=c.getAttribute('data-v');
    F[f][v]=c.classList.contains('on');apply();
  });});
  var sp=new URLSearchParams(location.search);
  if(sp.get('q')){q.value=sp.get('q');}
  ['col','cl','lv','en'].forEach(function(f){var val=sp.get(f);if(val){document.querySelectorAll('.ua-chip[data-f="'+f+'"]').forEach(function(c){if(c.getAttribute('data-v')===val){c.classList.add('on');F[f][val]=true;}});}});
  apply();
})();</script>'''
    return head(title,desc,canon,jsonld)+body+js+TAIL

out=os.path.join(ROOT,"university/uas/index.html")
os.makedirs(os.path.dirname(out),exist_ok=True)
open(out,"w",encoding="utf-8").write(build())
print("wrote university/uas/index.html |",os.path.getsize(out),"bytes |",N,"programmes")
