# -*- coding: utf-8 -*-
"""Build /university/ (gostudy-style directory) and /university/degrees/ (full IGP database)
from content/university/uni-data.json. 6 autonomous unis + UAS. Static + client-side filter."""
import os, json, html

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSSV="38"
D=json.load(open(os.path.join(ROOT,"content/university/uni-data.json"),encoding="utf-8"))
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
def esc(s): return html.escape(str(s),quote=True)

UNIS={u["slug"]:u for u in D["unis"]}
CLI=D["cli"]
progs=D["programmes"]
N=len(progs)
GRADE=[p for p in progs if p["type"]=="grade"]
APT=[p for p in progs if p["type"] in ("aptitude","holistic")]
YEAR=D["year"]
clusters=sorted({p["cluster"] for p in progs}, key=lambda c:-sum(1 for p in progs if p["cluster"]==c))

CSS=r'''
.udb-hero{padding:38px clamp(20px,6vw,80px);background:linear-gradient(135deg,#0f2a5c,#1f4e9c)}
.udb-hero,.udb-hero *{color:#fff}
.udb-hero .in{max-width:1180px;margin:0 auto}
.udb-ey{display:inline-block;margin-bottom:14px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);padding:6px 14px;border-radius:999px;font-size:.82rem;font-weight:700}
.udb-hero h1{font-size:clamp(26px,3.6vw,42px);margin:0 0 12px;font-weight:850;line-height:1.16}
.udb-hero p.s{margin:0 0 22px;color:rgba(255,255,255,.9);font-size:clamp(15px,1.6vw,17px);line-height:1.7;max-width:780px}
.udb-search{display:flex;gap:10px;max-width:640px;background:#fff;border-radius:13px;padding:7px;box-shadow:0 18px 44px rgba(0,0,0,.24)}
.udb-search input{flex:1;border:0;outline:0;padding:0 14px;font-size:1rem;color:var(--ink);min-width:0;background:transparent}
.udb-search button{border:0;background:#1f4e9c;color:#fff;font-weight:800;padding:0 22px;border-radius:9px;cursor:pointer;height:44px}
.udb-statsband{background:#fff;border-bottom:1px solid var(--line)}
.udb-stats{max-width:1180px;margin:0 auto;padding:24px clamp(20px,6vw,80px);display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px;text-align:center}
.udb-stat .n{font-size:clamp(24px,3vw,34px);font-weight:850;color:#1f4e9c;line-height:1}
.udb-stat .l{font-size:.82rem;color:var(--muted);margin-top:5px}
.usec{max-width:1180px;margin:0 auto;padding:42px clamp(20px,6vw,80px)}
.usec h2{font-size:clamp(22px,3vw,30px);margin:0 0 6px;color:var(--ink);font-weight:820}
.usec .lead{color:var(--muted);margin:0 0 24px;line-height:1.7}
.ucards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
.ucard{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 2px 10px rgba(20,20,40,.04);transition:transform .2s,box-shadow .2s;text-decoration:none}
.ucard:hover{transform:translateY(-4px);box-shadow:var(--shadow-md)}
.ucard .cover{height:104px;background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end;justify-content:space-between;padding:10px 14px}
.ucard .cover.grad{background:linear-gradient(135deg,#1f4e9c,#4277cc)}
.ucard.arts .cover.grad{background:linear-gradient(135deg,#b5179e,#d94fc4)}
.ucard .cover .ab2{color:#fff;font-weight:800;font-size:1.15rem;letter-spacing:.03em;text-shadow:0 1px 5px rgba(0,0,0,.45)}
.ucard .cover .qs2{color:#fff;font-size:.72rem;font-weight:700;background:rgba(0,0,0,.32);padding:3px 9px;border-radius:999px;backdrop-filter:blur(2px)}
.ucard .body{display:flex;flex-direction:column;flex:1;padding:16px 18px}
.ucard h3{margin:0;font-size:1.12rem;color:var(--ink)}
.ucard .en{color:var(--muted);font-size:.8rem;margin:.1rem 0 .6rem}
.ucard .sig{font-size:.88rem;color:var(--ink);line-height:1.6;margin:0 0 .7rem}
.ucard .meta{display:flex;flex-wrap:wrap;gap:5px 12px;font-size:.8rem;color:var(--muted);margin-bottom:.7rem}
.ucard .adm{font-size:.74rem;font-weight:700;padding:3px 9px;border-radius:999px;display:inline-block;margin-bottom:.7rem}
.adm-grade{background:#eaf0fb;color:#1f4e9c}.adm-apt{background:#fff4e6;color:#b45309}.adm-port{background:#fbf0fa;color:#b5179e}
.ucard .foot{margin-top:auto;display:flex;justify-content:space-between;border-top:1px dashed var(--line);padding-top:.7rem;font-size:.84rem}
.ucard .foot .c{color:var(--muted)}.ucard .foot .c b{color:#1f4e9c;font-size:1.05rem}
.ucard .foot .go{color:#1f4e9c;font-weight:800}
.uclusters{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:11px}
.uclcard{display:flex;flex-direction:column;gap:3px;border:1px solid var(--line);border-radius:13px;padding:14px 15px;background:#fff;text-decoration:none;transition:.15s}
.uclcard:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:#bcd0f0}
.uclcard .ic{font-size:1.45rem}.uclcard .nm{font-weight:800;color:var(--ink)}.uclcard .ct{color:var(--muted);font-size:.8rem}.uclcard .ct b{color:#1f4e9c}
.uteaser{background:linear-gradient(135deg,#eef4fc,#fff 60%);border:1px solid #cdddf5;border-radius:18px;padding:28px clamp(20px,4vw,38px)}
.uteaser h2{margin:0 0 10px}.uteaser p{color:var(--muted);line-height:1.7;margin:0 0 16px}
.uteaser .btn{display:inline-flex;gap:8px;background:#1f4e9c;color:#fff;font-weight:800;padding:12px 22px;border-radius:11px;text-decoration:none}
.upath{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.upstep{background:#fff;border:1px solid var(--line);border-radius:13px;padding:15px;text-align:center}
.upstep .n{font-size:.72rem;color:#1f4e9c;font-weight:800}.upstep .t{font-weight:800;color:var(--ink);margin:5px 0 4px}.upstep .d{font-size:.8rem;color:var(--muted);line-height:1.5}
.ufaq details{background:#fff;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;overflow:hidden}
.ufaq summary{cursor:pointer;padding:15px 18px;font-weight:700;color:var(--ink);list-style:none;display:flex;justify-content:space-between;gap:12px}
.ufaq summary::-webkit-details-marker{display:none}
.ufaq summary::after{content:"+";color:#1f4e9c;font-weight:800;font-size:1.2rem}
.ufaq details[open] summary::after{content:"\2212"}
.ufaq .a{padding:14px 18px;color:var(--muted);line-height:1.75;font-size:.94rem}
/* database */
.udb-tools{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 4px 14px rgba(20,20,40,.05)}
.udb-tools .in{max-width:1180px;margin:0 auto;padding:15px clamp(20px,6vw,80px)}
.urow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:9px}
.ufind{display:flex;align-items:center;gap:8px;flex:1;min-width:220px;border:1px solid var(--line);border-radius:10px;padding:9px 13px;background:#fafafa}
.ufind input{border:0;outline:0;background:transparent;flex:1;font-size:.95rem;min-width:0}
.ugpa{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:7px 12px;background:#fafafa;font-size:.88rem;white-space:nowrap}
.ugpa input{width:60px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;text-align:center;outline:0}
.uchips{display:flex;flex-wrap:wrap;gap:7px}
.uchip{font-size:.83rem;border:1px solid var(--line);background:#fff;color:var(--muted);padding:6px 12px;border-radius:999px;cursor:pointer;user-select:none}
.uchip.on{background:#1f4e9c;border-color:#1f4e9c;color:#fff}
.uchiplb{font-size:.78rem;color:var(--muted);font-weight:700;align-self:center;margin-right:3px}
.ucount{max-width:1180px;margin:13px auto 0;padding:0 clamp(20px,6vw,80px);font-size:.86rem;color:var(--muted)}
.ucount b{color:#1f4e9c}
.uwrap{max-width:1180px;margin:8px auto 0;padding:0 clamp(20px,6vw,80px) 10px;overflow-x:auto}
.utable{width:100%;border-collapse:collapse;font-size:.9rem;min-width:780px}
.utable thead th{position:sticky;top:0;background:#f5f8fc;text-align:left;padding:11px 12px;font-weight:800;color:var(--ink);border-bottom:2px solid var(--line);white-space:nowrap}
.utable td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
.utable tbody tr:hover td{background:#f9fbfe}
.utable tr.dim{display:none}
.ubadge{display:inline-block;font-size:.72rem;font-weight:800;color:#fff;background:#1f4e9c;padding:2px 8px;border-radius:6px}
.ubadge.apt{background:#b45309}
.ucn{font-weight:700;color:var(--ink)}.uce{display:block;color:var(--muted);font-size:.75rem;font-weight:400}
.utag{font-size:.73rem;background:#eef2f8;color:#33507e;padding:2px 8px;border-radius:999px;white-space:nowrap}
.al{font-weight:700;color:#7a3b00;background:#fff4e6;padding:3px 8px;border-radius:7px;font-size:.8rem;white-space:nowrap}
.gp{font-weight:800;color:#1f6e3a;background:#eaf7ee;padding:3px 8px;border-radius:7px;white-space:nowrap}
.at{font-weight:800;color:#1f4e9c;background:#eaf0fb;padding:3px 8px;border-radius:7px;white-space:nowrap}
.na{color:#aab;font-size:.8rem}
.holi{color:#b45309;font-size:.78rem;font-weight:700}
.atar-floor{max-width:1180px;margin:16px auto 0;padding:0 clamp(20px,6vw,80px)}
.atar-floor .box{background:#eaf0fb;border:1px solid #c7d7f5;border-left:4px solid #1f4e9c;border-radius:12px;padding:14px 18px;font-size:.92rem;color:var(--ink);line-height:1.7}
.uas-table{width:100%;border-collapse:collapse;font-size:.9rem;min-width:680px}
.uas-table thead th{background:#fbf3fb;text-align:left;padding:10px 12px;font-weight:800;border-bottom:2px solid var(--line);white-space:nowrap}
.uas-table td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.req-作品集{font-size:.72rem;font-weight:800;color:#fff;background:#b5179e;padding:2px 8px;border-radius:999px;white-space:nowrap}
.req-试演{font-size:.72rem;font-weight:800;color:#fff;background:#d97706;padding:2px 8px;border-radius:999px;white-space:nowrap}
.req-面试{font-size:.72rem;font-weight:800;color:#fff;background:#2563eb;padding:2px 8px;border-radius:999px;white-space:nowrap}

/* ===== 目录页：白底红字简洁风（gostudy/schools） ===== */
.ud-page .udb-hero{background:#fff;border-bottom:1px solid var(--line);padding:46px clamp(20px,6vw,80px) 30px}
.ud-page .udb-hero *{color:var(--ink)}
.ud-page .udb-ey{display:inline-block;background:var(--brand-light);border:1px solid #f3c6c6;color:var(--brand-strong);padding:6px 14px;border-radius:999px;font-size:.82rem;font-weight:700;margin-bottom:18px}
.ud-page .udb-hero h1{color:var(--ink);letter-spacing:-.01em}
.ud-page .udb-hero p.s{color:var(--muted)}
.ud-page .udb-search{border:1px solid var(--line);box-shadow:0 12px 30px rgba(198,40,40,.1)}
.ud-page .udb-search button{background:var(--brand)}
.ud-page .udb-search button:hover{background:var(--brand-strong)}
.ud-page .udb-statsband{background:#fff}
.ud-page .udb-stat .n{color:var(--brand)}
.ud-page .ucard .abbr{background:var(--brand)}
.ud-page .ucard .cover.grad{background:linear-gradient(135deg,#a31515,#d83a3a)}
.ud-page .ucard.arts .cover.grad{background:linear-gradient(135deg,#8a2b6b,#c2569e)}
.ud-page .adm-grade{background:var(--brand-light);color:var(--brand-strong)}
.ud-page .ucard .foot .c b,.ud-page .ucard .foot .go{color:var(--brand)}
.ud-page .uclcard:hover{border-color:#f0bcbc}
.ud-page .uclcard .ct b{color:var(--brand)}
.ud-page .uteaser{background:linear-gradient(135deg,#fff7f7,#fff 62%);border-color:#f3d6d6}
.ud-page .uteaser h2,.ud-page .usec h2{color:var(--ink)}
.ud-page .uteaser .btn{background:var(--brand)}
.ud-page .uteaser .btn:hover{background:var(--brand-strong)}
.ud-page .upstep .n{color:var(--brand)}
.ud-page .ufaq summary::after{color:var(--brand)}
.ud-page .ufaq details[open] summary::after{color:var(--brand)}
.ud-page .ufaq .a a{color:var(--brand-strong)}
.ud-page ::selection{background:var(--brand-light)}
/* 封面 = 白底居中校徽（一眼识别） */
.ud-page .ucard .cover.logo{height:104px;background:linear-gradient(180deg,#fafbfc,#fff);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;padding:16px}
.ud-page .ucard .cover.logo img{max-height:64px;max-width:80%;width:auto;object-fit:contain}
.ud-page .ucard .abbrow{display:flex;align-items:center;gap:9px;margin-bottom:.15rem}
.ud-page .ucard .abbr2{font-size:.72rem;font-weight:800;color:#fff;background:var(--brand);padding:2px 8px;border-radius:6px;letter-spacing:.03em;flex:0 0 auto}
.ud-page .ucard.arts .abbr2{background:#b5179e}
.ud-page .ucard .abbrow h3{margin:0;font-size:1.08rem}
'''

def head(title,desc,canon,jsonld,noindex=False):
    blocks="\n".join('<script type="application/ld+json">%s</script>'%json.dumps(j,ensure_ascii=False,separators=(",",":")) for j in jsonld)
    robots="noindex,follow" if noindex else "index,follow,max-image-preview:large"
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}"/>
<meta name="robots" content="{robots}"/>
<link rel="canonical" href="{canon}"/>
<link rel="stylesheet" href="/seda-site.css?v={CSSV}"/>
{blocks}
<style>{CSS}</style>
</head>
<body>
{HEADER}
<main>'''
TAIL=f'''</main>
{FOOTER}
<script src="/seda-site.js?v=28"></script>
</body>
</html>'''

# ============ DATABASE ============
def build_db():
    canon="https://sgeda.org.cn/university/degrees/"
    rows=[]
    order=sorted(progs,key=lambda p:(0 if p["type"]=="grade" else 1, p["uni"], -p["glo"]))
    for p in order:
        u=UNIS[p["uni"]]
        grade=p["type"]=="grade"
        al=f'<span class="al">{esc(p["alevel"])}</span>' if grade else f'<span class="holi">{esc(u["atar"])}</span>'
        gp=(f'<span class="gp">{esc(p["gpa"])}</span>' if (grade and "-" in p["gpa"]) else ('<span class="na">样本少</span>' if grade else '<span class="na">—</span>'))
        if grade: at=f'<span class="at">{esc(p["atar"])}</span>'
        else:
            est=u.get("atar_est")
            at=(f'<span class="at" style="opacity:.9" title="校级估算">{esc(est)} <small>估</small></span>' if est else '<span class="na">综合</span>')
        rows.append(f'''<tr data-uni="{p['uni']}" data-cluster="{esc(p['cluster'])}" data-grade="{1 if grade else 0}" data-glo="{p['glo']}" data-name="{esc((p['name_zh']+' '+p['name_en']+' '+u['abbr']+' '+p['cluster']).lower())}">
<td><span class="ucn">{esc(p['name_zh'])}</span><span class="uce">{esc(p['name_en'])}</span></td>
<td><span class="ubadge{'' if grade else ' apt'}">{esc(u['abbr'])}</span></td>
<td><span class="utag">{CLI.get(p['cluster'],'')} {esc(p['cluster'])}</span></td>
<td>{al}</td><td>{gp}</td><td>{at}</td></tr>''')
    rowhtml="\n".join(rows)
    unichips="".join(f'<span class="uchip" data-f="uni" data-v="{u["slug"]}">{esc(u["abbr"])}</span>' for u in D["unis"] if u["slug"]!="uas")
    clchips="".join(f'<span class="uchip" data-f="cluster" data-v="{esc(c)}">{CLI.get(c,"")} {esc(c)}</span>' for c in clusters)
    uasrows="".join(f'''<tr><td><span class="ucn">{esc(x["zh"])}</span><span class="uce">{esc(x["en"])}</span></td><td>{esc(x["college"])}</td><td><span class="req-{x["rtype"]}">{esc(x["rtype"])}</span></td><td>{esc(x["req"])}</td></tr>''' for x in D["uas"])
    jsonld=[
     {"@context":"https://schema.org","@type":"Dataset","name":"新加坡大学本科专业录取分数据库（%s）"%YEAR,
      "description":"新加坡 6 所公立大学（NUS/NTU/SMU/SUTD/SIT/SUSS）共 %d 个本科专业的 A-Level IGP 成绩档、理工 Diploma GPA 录取线、WACE 参考 ATAR；含艺术大学 UAS 作品集要求。"%(N),
      "url":canon,"inLanguage":"zh-CN","isAccessibleForFree":True,"keywords":"IGP,A-Level,ATAR,WACE,理工GPA,新加坡大学,录取分数",
      "creator":{"@type":"Organization","name":"SEDA 新加坡择校网"}},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
       {"@type":"ListItem","position":2,"name":"新加坡大学","item":"https://sgeda.org.cn/university/"},
       {"@type":"ListItem","position":3,"name":"专业录取分数据库"}]},
    ]
    title="新加坡大学本科专业录取分数据库：A-Level / WACE / 理工GPA 一表查询（%s）"%YEAR
    desc="新加坡 6 所公立大学 %d 个本科专业的 A-Level IGP 成绩档、理工 GPA 录取线与 WACE 参考 ATAR 一表查询，可按学校、方向、GPA 筛选；含艺术大学 UAS 作品集要求。"%N
    body=f'''
  <section class="udb-hero"><div class="in">
    <span class="udb-ey">🎓 6 公立大学 + 艺术大学 · {N} 个本科专业 · {YEAR}</span>
    <h1>新加坡大学专业录取分数据库</h1>
    <p class="s">每个专业三条录取通道一表看清：<b>A-Level 成绩档（IGP 官方）</b> · <b>理工 Diploma GPA（IGP 官方）</b> · <b>WACE 参考 ATAR</b>。能力本位录取的 SIT/SUTD/SUSS 与作品集录取的艺术大学 UAS 另列说明。</p>
  </div></section>
  <div class="atar-floor"><div class="box">
    🎓 <b>WACE / 国际 A-Level 申请须知</b>：本表「新加坡 A-Level」列是各校官方 IGP（仅适用<b>新加坡-剑桥 A-Level</b>考生）。<b>国际 A-Level（CIE/Edexcel）与 WACE 考生</b>按等同学历 / ATAR 评估，请看「WACE / ATAR」列。<br>
    其中：NUS/NTU/SMU 的 ATAR 由各专业最低录取 A-Level 档换算（逐专业估算）；<b>SIT/SUTD/SUSS 为能力本位录取、不公布成绩档，给出的是校级预估 ATAR 区间（标「估」）</b>。6 所中仅 NTU 公布固定门槛 ATAR ≥90，均<b>以各校官方评估为准</b>。
  </div></div>

  <div class="udb-tools"><div class="in">
    <div class="urow">
      <div class="ufind">🔎<input type="search" id="uq" placeholder="搜专业 / 学校 / 方向，如 计算机、护理、NTU"></div>
      <div class="ugpa"><span>我的理工 GPA</span><input type="number" id="ugpa" min="0" max="4" step="0.01" placeholder="如 3.7"><label><input type="checkbox" id="uonly"> 只看我够得着</label></div>
    </div>
    <div class="urow"><span class="uchiplb">学校</span><div class="uchips">{unichips}</div></div>
    <div class="urow"><span class="uchiplb">方向</span><div class="uchips">{clchips}</div></div>
  </div></div>
  <div class="ucount">显示 <b id="ushow">{N}</b> / {N} 个专业　<span id="uhint" style="color:var(--muted)"></span></div>
  <div class="uwrap"><table class="utable" id="utable"><thead><tr>
    <th>专业</th><th>大学</th><th>方向</th>
    <th>新加坡 A-Level<br><small style="font-weight:400;color:#999">IGP 官方</small></th>
    <th>理工 GPA<br><small style="font-weight:400;color:#999">IGP 官方</small></th>
    <th>WACE / ATAR<br><small style="font-weight:400;color:#999">估算</small></th>
  </tr></thead><tbody id="ubody">{rowhtml}</tbody></table></div>
  <p class="usec" style="padding-top:6px;padding-bottom:0;font-size:.8rem;color:var(--muted)">说明：NUS/NTU/SMU 为成绩录取，A-Level 与理工 GPA 取官方 IGP（10–90 百分位）。<b>SIT / SUTD / SUSS 为能力本位/综合评估录取，无硬性截分</b>（表中该列显示其录取方式）。"样本少"为官方因人数少未公布。</p>

  <section class="usec">
    <h2>🎨 新加坡艺术大学 UAS（作品集 / 试演录取）</h2>
    <p class="lead">UAS（NAFA + LASALLE）<b>不看分数线</b>——A-Level / WACE 达学术门槛即可，录取看<b>作品集或试演</b>。代表专业与要求如下（以 NAFA / LASALLE 官方为准）。</p>
    <div style="overflow-x:auto"><table class="uas-table"><thead><tr><th>专业</th><th>学院</th><th>录取方式</th><th>作品集 / 试演要求</th></tr></thead><tbody>{uasrows}</tbody></table></div>
  </section>

  <section class="usec" style="padding-top:0">
    <a href="/poly/courses/" style="display:block;background:linear-gradient(135deg,#fff7f7,#fff 60%);border:1px solid #f3d6d6;border-left:4px solid #c62828;border-radius:14px;padding:18px 22px;text-decoration:none">
      <span style="font-weight:800;color:#c62828;font-size:1.05rem">🏫 还在读 O-Level / 打算先读理工？→ 理工学院专业录取分</span>
      <span style="display:block;margin-top:6px;color:#5a6478;font-size:.92rem;line-height:1.6">很多人「O-Level → 理工 Diploma → 大学」三步走。查 5 所理工 195 个专业的 ELR2B2 录取分数据库，先选对 Diploma，再用本页「理工 GPA」一列升大学。</span>
    </a>
  </section>

  <section class="usec ufaq" style="padding-top:0">
    <h2>常见问题</h2>
    <div style="margin-top:6px">
    <details><summary>IGP（录取成绩档）是什么？</summary><div class="a">IGP 是各大学公布的上一届被录取学生的成绩分布，用 10–90 百分位表示。A-Level 用成绩档（如 BBB/C – AAA/A），理工生用 GPA 区间（如 3.6–3.9，满分 4.0）。它是参考，不是预定截分，每年浮动。</div></details>
    <details><summary>我的理工 GPA 能进哪些大学专业？</summary><div class="a">在上方输入 GPA 并勾选「只看我够得着」，表格会筛出你的 GPA ≥ 该专业最低录取 GPA 的专业。注意这是 NUS/NTU/SMU 的逻辑；SIT/SUTD/SUSS 是综合评估，GPA 只是其一。</div></details>
    <details><summary>WACE / ATAR 学生怎么用这张表？</summary><div class="a">先确认达到各校 ATAR 门槛（如 NTU ≥90），再用「WACE 参考 ATAR」列判断各专业竞争度——该列按专业最低录取 A-Level 档换算，仅供参考，最终以各校官方评估为准。</div></details>
    <details><summary>SIT、SUTD、SUSS 为什么没有分数线？</summary><div class="a">这三所是能力本位/综合评估录取：SIT 看学术 + 非学术表现、不设硬性截分；SUTD 整体评估（含作品/面试）；SUSS 有笔试、认知测试、面试多轮。成绩达标后更看综合素质。</div></details>
    <details><summary>艺术想读 UAS 要准备什么？</summary><div class="a">UAS（NAFA/LASALLE）学术达标即可，关键是作品集或试演：纯艺/设计要 portfolio（15–20 件作品），音乐/舞蹈/戏剧要现场试演，艺术管理重面试。提前 1 年准备作品集最稳。</div></details>
    </div>
  </section>
  <section class="usec" style="padding-top:0"><p class="lead" style="font-size:.86rem">数据来源：NUS 官方 IGP、NTU/SMU IGP（聚合整理）、SIT/SUSS 招生页，{YEAR} 学年，仅供参考。想要一对一选校建议可<a href="/contact/" style="color:#1f4e9c;font-weight:700">免费咨询</a>。</p></section>
'''
    js=r'''
<script>(function(){
  var body=document.getElementById('ubody'),rows=[].slice.call(body.querySelectorAll('tr'));
  var q=document.getElementById('uq'),gpa=document.getElementById('ugpa'),only=document.getElementById('uonly');
  var show=document.getElementById('ushow'),hint=document.getElementById('uhint');
  var fU={},fC={};
  function act(o){return Object.keys(o).filter(function(k){return o[k]})}
  function apply(){
    var term=(q.value||'').trim().toLowerCase(),g=parseFloat(gpa.value),onlyMe=only.checked&&!isNaN(g);
    var aU=act(fU),aC=act(fC),n=0;
    rows.forEach(function(tr){
      var ok=true;
      if(term&&tr.getAttribute('data-name').indexOf(term)<0)ok=false;
      if(ok&&aU.length&&aU.indexOf(tr.getAttribute('data-uni'))<0)ok=false;
      if(ok&&aC.length&&aC.indexOf(tr.getAttribute('data-cluster'))<0)ok=false;
      if(ok&&onlyMe&&tr.getAttribute('data-grade')==='1'){var glo=parseFloat(tr.getAttribute('data-glo'));if(glo===0||g<glo)ok=false;}
      tr.classList.toggle('dim',!ok);if(ok)n++;
    });
    show.textContent=n;
    hint.textContent=(!isNaN(g))?('· GPA '+g.toFixed(2)+' 够得着的成绩录取专业；SIT/SUTD/SUSS 为综合评估'):'';
  }
  q.addEventListener('input',apply);gpa.addEventListener('input',apply);only.addEventListener('change',apply);
  document.querySelectorAll('.uchip').forEach(function(c){c.addEventListener('click',function(){c.classList.toggle('on');var f=c.getAttribute('data-f'),v=c.getAttribute('data-v');(f==='uni'?fU:fC)[v]=c.classList.contains('on');apply();});});
  var sp=new URLSearchParams(location.search);
  if(sp.get('q')){q.value=sp.get('q');}
  var cl=sp.get('cluster');if(cl){document.querySelectorAll('.uchip[data-f="cluster"]').forEach(function(c){if(c.getAttribute('data-v')===cl){c.classList.add('on');fC[cl]=true;}});}
  var un=sp.get('uni');if(un){document.querySelectorAll('.uchip[data-f="uni"]').forEach(function(c){if(c.getAttribute('data-v')===un){c.classList.add('on');fU[un]=true;}});}
  apply();
})();</script>'''
    return head(title,desc,canon,jsonld)+body+js+TAIL

# ============ DIRECTORY LANDING ============
def build_landing():
    canon="https://sgeda.org.cn/university/"
    counts={u["slug"]:sum(1 for p in progs if p["uni"]==u["slug"]) for u in D["unis"]}
    counts["uas"]=len(D["uas"])
    cl_counts={c:sum(1 for p in progs if p["cluster"]==c) for c in clusters}
    admtag={"grade":("adm-grade","成绩录取 · IGP"),"aptitude":("adm-apt","能力本位录取"),"holistic":("adm-apt","综合评估录取"),"portfolio":("adm-port","作品集 / 试演")}
    cards=[]
    for u in D["unis"]:
        a,lbl=admtag[u["type"]]
        arts=" arts" if u["type"]=="portfolio" else ""
        ext="png" if u["slug"]=="suss" else "svg"
        cover=f'<div class="cover logo"><img src="/assets/uni-{u["slug"]}-logo.{ext}" alt="{esc(u["zh"])} 校徽" loading="eager" decoding="async"></div>'
        cards.append(f'''<a class="ucard{arts}" href="/university/{u['slug']}/">
  {cover}
  <div class="body">
    <div class="abbrow"><span class="abbr2">{esc(u['abbr'])}</span><h3>{esc(u['zh'])}</h3></div><p class="en">{esc(u['en'])}</p>
    <p class="sig">{esc(u['sig'])}</p>
    <div class="meta"><span>📅 {u['founded']}</span><span>🏅 {esc(u['qs'])}</span><span>🎯 {esc(u.get('atar_est') or u['atar'])}{' 估' if u.get('atar_est') else ''}</span></div>
    <span class="adm {a}">{lbl}</span>
    <div class="foot"><span class="c"><b>{counts[u['slug']]}</b> 个本科专业</span><span class="go">查看详情 →</span></div>
  </div>
</a>''')
    clcards="".join(f'<a class="uclcard" href="/university/degrees/?cluster={esc(c)}"><span class="ic">{CLI.get(c,"🎓")}</span><span class="nm">{esc(c)}</span><span class="ct"><b>{cl_counts[c]}</b> 专业</span></a>' for c in clusters)
    stats=[("6","所公立大学"),("1","所艺术大学"),(str(N),"个本科专业"),(str(len(clusters)),"个专业方向"),("3","通道录取分 · A-Level/WACE/GPA")]
    statshtml="".join(f'<div class="udb-stat"><div class="n">{esc(n)}</div><div class="l">{esc(l)}</div></div>' for n,l in stats)
    faqs=[
     ("新加坡有几所公立大学？","6 所自治（公立）大学：NUS、NTU、SMU、SUTD、SIT、SUSS；外加 2024 年新成立的艺术大学 UAS（政府支持、NAFA+LASALLE 组成）。学位全球认可。"),
     ("中国学生能申请新加坡公立大学吗？","能。可凭 A-Level、IB、WACE/ATAR 等国际学历，或新加坡理工 Diploma（GPA）申请。中国高考成绩部分大学也接受，个案评估。语言一般要求雅思/托福或同等。"),
     ("WACE / ATAR 申请新加坡大学的门槛？","按 ATAR 整体评估，如 NTU 官方门槛 ATAR ≥90；热门专业更高。具体专业竞争度可参考数据库的「WACE 参考 ATAR」列。"),
     ("理工 Diploma 能升哪些大学？","6 所公立都收理工生（看 GPA）：NUS/NTU/SMU 看 IGP GPA 区间；SIT 最欢迎理工生、应用型；SUSS/SUTD 综合评估。打开数据库输入 GPA 即可看能进哪些。"),
    ]
    faqhtml="".join(f'<details><summary>{esc(q)}</summary><div class="a">{esc(a)}</div></details>' for q,a in faqs)
    jsonld=[
     {"@context":"https://schema.org","@type":"CollectionPage","name":"新加坡大学完全指南：6公立+艺术大学与专业录取分数据库","url":canon,
      "description":"新加坡 6 所公立大学 + 艺术大学 UAS 完整对比，%d 个本科专业的 A-Level / WACE / 理工 GPA 录取分数据库。"%N,"inLanguage":"zh-CN"},
     {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":i+1,"name":u["zh"],"url":"https://sgeda.org.cn/university/%s/"%u["slug"]} for i,u in enumerate(D["unis"])]},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},{"@type":"ListItem","position":2,"name":"新加坡大学"}]},
     {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]},
    ]
    title="新加坡大学完全指南：6所公立大学+艺术大学对比 + %d个专业录取分数据库（A-Level/WACE/理工GPA）"%N
    desc="新加坡 6 所公立大学（NUS/NTU/SMU/SUTD/SIT/SUSS）+ 艺术大学 UAS 一站对比：QS 排名、录取方式、王牌专业，以及 %d 个本科专业的 A-Level / WACE ATAR / 理工 GPA 录取分数据库。"%N
    body=f'''
  <section class="udb-hero"><div class="in">
    <span class="udb-ey">🎓 6 所公立大学 + 1 所艺术大学</span>
    <h1>新加坡大学专业录取分<br>一站查询</h1>
    <p class="s">NUS · NTU · SMU · SUTD · SIT · SUSS + 艺术大学 UAS，{N} 个本科专业的 A-Level / WACE / 理工 GPA 录取分全收录。</p>
    <form class="udb-search" action="/university/degrees/" method="get"><input type="search" name="q" placeholder="搜专业 / 学校，如 计算机、护理、NUS"><button type="submit">搜专业</button></form>
  </div></section>
  <div class="udb-statsband"><div class="udb-stats">{statshtml}</div></div>

  <section class="usec"><h2>6 公立大学 + 1 艺术大学</h2>
    <p class="lead">新加坡 6 所政府资助的自治大学，加上 2024 年新成立的艺术大学 UAS，学位全球认可。注意录取方式不同：NUS/NTU/SMU 看成绩（IGP），SIT/SUTD/SUSS 能力本位/综合评估，UAS 看作品集。</p>
    <div class="ucards">{''.join(cards)}</div></section>

  <section class="usec" style="padding-top:0"><h2>按专业方向浏览</h2>
    <p class="lead">{N} 个本科专业按 {len(clusters)} 个方向归类，点一下进数据库看该方向所有专业的录取分。</p>
    <div class="uclusters">{clcards}</div></section>

  <section class="usec" style="padding-top:0"><div class="uteaser">
    <h2>📊 专业录取分数据库</h2>
    <p>把 6 所公立的 {N} 个本科专业、A-Level 成绩档 + 理工 GPA + WACE 参考 ATAR 放进一张可筛选的表。输入你的 GPA 或对照 A-Level/ATAR，立刻看到能进哪些专业。</p>
    <a class="btn" href="/university/degrees/">打开完整数据库 →</a>
  </div></section>

  <section class="usec" style="padding-top:0"><h2>升学路径 → 大学</h2>
    <p class="lead">三条主流通道进新加坡大学，数据库三列正好一一对应。</p>
    <div class="upath">
      <div class="upstep"><div class="n">路线 A</div><div class="t">A-Level</div><div class="d">JC 两年 A-Level，按 IGP 成绩档竞争</div></div>
      <div class="upstep"><div class="n">路线 B</div><div class="t">WACE / ATAR</div><div class="d">WACE 国际学历，按 ATAR 评估（≥90）</div></div>
      <div class="upstep"><div class="n">路线 C</div><div class="t">理工 Diploma</div><div class="d">理工毕业凭 GPA 升大学，可学分减免</div></div>
      <div class="upstep"><div class="n">艺术</div><div class="t">作品集 / 试演</div><div class="d">UAS：学术达标 + 作品集/试演</div></div>
    </div></section>

  <section class="usec ufaq" style="padding-top:0"><h2>常见问题</h2><div style="margin-top:6px">{faqhtml}</div></section>
'''
    countup=r'''<script>
(function(){var els=document.querySelectorAll('.ud-page .udb-stat .n');
function run(el){var t=parseInt((el.textContent||'').replace(/[^0-9]/g,''),10);if(isNaN(t)){return;}var d=900,s=null;
function step(ts){if(!s)s=ts;var p=Math.min((ts-s)/d,1),e=1-Math.pow(1-p,3);el.textContent=Math.round(e*t);if(p<1){requestAnimationFrame(step);}}requestAnimationFrame(step);}
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){run(en.target);io.unobserve(en.target);}});},{threshold:.5});els.forEach(function(el){io.observe(el);});}else{els.forEach(run);}})();
</script>'''
    return head(title,desc,canon,jsonld)+'<div class="ud-page">'+body+'</div>'+countup+TAIL

os.makedirs(os.path.join(ROOT,"university/degrees"),exist_ok=True)
open(os.path.join(ROOT,"university/degrees/index.html"),"w",encoding="utf-8").write(build_db())
open(os.path.join(ROOT,"university/index.html"),"w",encoding="utf-8").write(build_landing())
print("wrote university/index.html + university/degrees/index.html")
print("programmes:",N,"| grade:",len(GRADE),"| aptitude/holistic:",len(APT),"| UAS:",len(D["uas"]))
