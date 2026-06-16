# -*- coding: utf-8 -*-
"""SAMPLE: /university/degrees/ — university degree IGP database (NUS + UAS only, to validate format).
3 entry columns for 公立: A-Level IGP (official) | 理工 GPA IGP (official) | WACE 参考 ATAR (derived from A-Level, labelled).
UAS shown separately (portfolio/audition requirements). Reuses site header/footer + poly-db visual system."""
import os, json, re, html

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSSV="38"
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
def esc(s): return html.escape(str(s),quote=True)

# ---- NUS official IGP (AY2025/26) : name_en, name_zh, cluster, alevel_lo, alevel_hi, gpa_lo, gpa_hi (gpa None = small sample)
NUS=[
("Law","法学（法律）","法律","AAA/A","AAA/A",None,None),
("Medicine","医学","医学健康","AAA/A","AAA/A",3.87,3.99),
("Dentistry","牙医学","医学健康","AAA/A","AAA/A",None,None),
("Nursing","护理学","医学健康","CCD/C","ABB/B",3.18,3.77),
("Pharmacy","药学","医学健康","AAA/C","AAA/A",3.73,3.97),
("Pharmaceutical Science","药剂科学","理学","AAA/A","AAA/A",3.93,4.00),
("Engineering","工程（大类）","工程","BBB/C","AAA/A",3.57,3.94),
("Computer Engineering","计算机工程","工程","AAA/A","AAA/A",3.81,3.99),
("Industrial Design","工业设计","设计建筑","BBC/B","AAA/A",3.56,3.90),
("Architecture","建筑学","设计建筑","CCC/C","AAB/B",3.27,3.88),
("Landscape Architecture","景观建筑","设计建筑","CCC/B","AAB/C",3.37,3.81),
("Common Computer Science Programmes","计算机科学（大类）","计算机","AAA/A","AAA/A",3.81,3.98),
("Information Security","信息安全","计算机","AAA/B","AAA/A",3.88,3.98),
("Business Analytics","商业分析","计算机","AAA/A","AAA/A",3.75,3.98),
("Business Artificial Intelligence Systems","商业人工智能系统","计算机","AAA/B","AAA/A",3.71,3.90),
("Data Science and Economics","数据科学与经济","计算机","AAA/A","AAA/A",None,None),
("Business Administration","工商管理","商科","AAA/C","AAA/A",3.61,3.94),
("Environmental Studies","环境研究","理学","AAA/B","AAA/A",3.67,3.94),
("Food Science and Technology","食品科学与技术","理学","AAA/C","AAA/A",3.64,3.91),
("Humanities and Sciences","人文与科学","人文社科","ABB/C","AAA/A",3.63,3.92),
("Philosophy, Politics, and Economics","哲学政治经济（PPE）","人文社科","AAA/A","AAA/A",None,None),
]
UNIS={"nus":{"abbr":"NUS","zh":"新加坡国立大学","atar_floor":"≥90（热门专业 ~99）"}}

# A-Level 3-letter (strip /X) -> ATAR estimate
def atar_est(alevel_lo):
    g=alevel_lo.split("/")[0]
    val={"A":5,"B":4,"C":3,"D":2,"E":1}
    s=sum(val.get(c,0) for c in g[:3])
    table={15:"≈99",14:"≈97",13:"≈95",12:"≈92",11:"≈90",10:"≈88",9:"≈85",8:"≈83",7:"≈80"}
    return table.get(s,"≈80")

# cluster icons
CLI={"法律":"⚖️","医学健康":"🩺","工程":"⚙️","计算机":"💻","商科":"📊","理学":"🧪","人文社科":"📚","设计建筑":"🏛️"}

# ---- UAS sample programmes (NAFA/LASALLE) : name_zh, name_en, college, academic, requirement_type, requirement
UAS=[
("纯艺术","Fine Arts","NAFA / LASALLE","A-Level / 高中毕业 / 同等学历","作品集","15–20 件原创作品（素描、绘画、立体等）+ 面试"),
("视觉传达设计","Design Communication","LASALLE","A-Level / 同等学历","作品集","设计/插画作品集 + 创意测试 + 面试"),
("动画艺术","Animation Art","NAFA","A-Level / 同等学历","作品集","速写、角色设计、动画样片 + 面试"),
("电影","Film","LASALLE","A-Level / 同等学历","作品集","短片 / 影像样片 + 创作陈述 + 面试"),
("音乐（表演/作曲）","Music","NAFA / LASALLE","A-Level / 同等学历","试演","现场或录制试演 + 乐理测试"),
("舞蹈","Dance","NAFA / LASALLE","A-Level / 同等学历","试演","现场试演（技巧 + 即兴）"),
("戏剧表演","Acting / Theatre","LASALLE","A-Level / 同等学历","试演","独白试演 + 面试 + 工作坊"),
("艺术管理","Arts Management","LASALLE","A-Level / 同等学历（侧重学术）","面试","个人陈述 + 面试（无需作品集）"),
]

def gpa_str(lo,hi): return "—" if lo is None else f"{lo:.2f}–{hi:.2f}"

# build NUS rows
rows=[]
for name_en,name_zh,cl,alo,ahi,glo,ghi in NUS:
    atar=atar_est(alo)
    rows.append({"uni":"nus","name_en":name_en,"name_zh":name_zh,"cluster":cl,
                 "alevel":f"{alo} – {ahi}","gpa":gpa_str(glo,ghi),"glo":glo,"atar":atar,
                 "search":(name_zh+" "+name_en+" NUS "+cl).lower()})

clusters=sorted({r["cluster"] for r in rows}, key=lambda c:-sum(1 for r in rows if r["cluster"]==c))
N=len(rows)

def head():
    jsonld=[
     {"@context":"https://schema.org","@type":"Dataset","name":"新加坡大学本科专业录取分数据库（样板：NUS）",
      "description":"新加坡公立大学本科专业的 A-Level IGP 成绩档、理工 Diploma GPA 录取线与 WACE 参考 ATAR；含艺术大学 UAS 作品集要求。当前为 NUS + UAS 样板。",
      "url":"https://sgeda.org.cn/university/degrees/","inLanguage":"zh-CN","isAccessibleForFree":True,
      "creator":{"@type":"Organization","name":"SEDA 新加坡择校网"}},
     {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
       {"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},
       {"@type":"ListItem","position":2,"name":"新加坡大学","item":"https://sgeda.org.cn/university/"},
       {"@type":"ListItem","position":3,"name":"专业录取分数据库"}]},
    ]
    blocks="\n".join('<script type="application/ld+json">%s</script>'%json.dumps(j,ensure_ascii=False,separators=(",",":")) for j in jsonld)
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>新加坡大学本科专业录取分数据库：A-Level / WACE / 理工GPA 一表查询（样板）</title>
<meta name="description" content="新加坡公立大学本科专业的 A-Level IGP 成绩档、理工 Diploma GPA 录取线与 WACE 参考 ATAR 一表查询，含艺术大学 UAS 作品集要求。当前为 NUS + UAS 样板页。"/>
<meta name="robots" content="noindex,follow"/>
<link rel="canonical" href="https://sgeda.org.cn/university/degrees/"/>
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

CSS=r'''
.udb-hero{padding:34px clamp(20px,6vw,80px);background:linear-gradient(135deg,#0f2a5c,#1f4e9c);color:#fff}
.udb-hero .in{max-width:1180px;margin:0 auto}
.udb-hero h1{font-size:clamp(24px,3.4vw,36px);margin:0 0 8px;font-weight:850}
.udb-hero p{margin:0;color:rgba(255,255,255,.9);font-size:.98rem;line-height:1.6}
.udb-sample{display:inline-block;margin-bottom:12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);padding:5px 13px;border-radius:999px;font-size:.82rem;font-weight:700}
.udb-tools{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 4px 14px rgba(20,20,40,.05)}
.udb-tools .in{max-width:1180px;margin:0 auto;padding:16px clamp(20px,6vw,80px)}
.udb-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px}
.udb-find{display:flex;align-items:center;gap:8px;flex:1;min-width:220px;border:1px solid var(--line);border-radius:10px;padding:9px 13px;background:#fafafa}
.udb-find input{border:0;outline:0;background:transparent;flex:1;font-size:.95rem;min-width:0}
.udb-gpa{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:7px 12px;background:#fafafa;font-size:.88rem;white-space:nowrap}
.udb-gpa input{width:62px;border:1px solid var(--line);border-radius:7px;padding:5px 8px;text-align:center;outline:0}
.udb-chips{display:flex;flex-wrap:wrap;gap:7px}
.udb-chip{font-size:.84rem;border:1px solid var(--line);background:#fff;color:var(--muted);padding:6px 13px;border-radius:999px;cursor:pointer;user-select:none}
.udb-chip.on{background:#1f4e9c;border-color:#1f4e9c;color:#fff}
.udb-chiplabel{font-size:.78rem;color:var(--muted);font-weight:700;align-self:center;margin-right:4px}
.udb-count{max-width:1180px;margin:14px auto 0;padding:0 clamp(20px,6vw,80px);font-size:.86rem;color:var(--muted)}
.udb-count b{color:#1f4e9c}
.udb-wrap{max-width:1180px;margin:8px auto 0;padding:0 clamp(20px,6vw,80px) 10px;overflow-x:auto}
.udb-table{width:100%;border-collapse:collapse;font-size:.9rem;min-width:760px}
.udb-table thead th{position:sticky;top:0;background:#f5f8fc;text-align:left;padding:11px 12px;font-weight:800;color:var(--ink);border-bottom:2px solid var(--line);white-space:nowrap}
.udb-table td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:middle}
.udb-table tbody tr:hover td{background:#f9fbfe}
.udb-table tr.dim{display:none}
.uni-badge{display:inline-block;font-size:.72rem;font-weight:800;color:#fff;background:#1f4e9c;padding:2px 8px;border-radius:6px}
.cn{font-weight:700;color:var(--ink)}.ce{display:block;color:var(--muted);font-size:.76rem;font-weight:400}
.ctag{font-size:.74rem;background:#eef2f8;color:#33507e;padding:2px 9px;border-radius:999px;white-space:nowrap}
.sc-al{font-weight:700;color:#7a3b00;background:#fff4e6;padding:3px 8px;border-radius:7px;font-size:.82rem;white-space:nowrap}
.sc-gpa{font-weight:800;color:#1f6e3a;background:#eaf7ee;padding:3px 9px;border-radius:7px;white-space:nowrap}
.sc-atar{font-weight:800;color:#1f4e9c;background:#eaf0fb;padding:3px 9px;border-radius:7px;white-space:nowrap}
.sc-na{color:var(--muted)}
.udb-note{max-width:1180px;margin:0 auto;padding:6px clamp(20px,6vw,80px) 0;font-size:.8rem;color:var(--muted)}
.udb-sec{max-width:1180px;margin:0 auto;padding:30px clamp(20px,6vw,80px)}
.udb-sec h2{font-size:clamp(22px,3vw,30px);margin:0 0 6px;color:var(--ink)}
.udb-sec .lead{color:var(--muted);margin:0 0 20px;line-height:1.7}
.uas-table{width:100%;border-collapse:collapse;font-size:.9rem;min-width:680px}
.uas-table thead th{background:#fbf3fb;text-align:left;padding:10px 12px;font-weight:800;border-bottom:2px solid var(--line);white-space:nowrap}
.uas-table td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.req-port{font-size:.72rem;font-weight:800;color:#fff;background:#b5179e;padding:2px 8px;border-radius:999px;white-space:nowrap}
.req-aud{font-size:.72rem;font-weight:800;color:#fff;background:#d97706;padding:2px 8px;border-radius:999px;white-space:nowrap}
.req-int{font-size:.72rem;font-weight:800;color:#fff;background:#2563eb;padding:2px 8px;border-radius:999px;white-space:nowrap}
.atar-floor{max-width:1180px;margin:18px auto 0;padding:14px clamp(20px,6vw,80px)}
.atar-floor .box{background:#eaf0fb;border:1px solid #c7d7f5;border-left:4px solid #1f4e9c;border-radius:12px;padding:14px 18px;font-size:.92rem;color:var(--ink);line-height:1.7}
'''

# rows html
def reqcls(t): return {"作品集":"req-port","试演":"req-aud","面试":"req-int"}.get(t,"req-int")
rowhtml="\n".join(
 f'''<tr data-uni="{r['uni']}" data-cluster="{esc(r['cluster'])}" data-glo="{r['glo'] if r['glo'] else 0}" data-name="{esc(r['search'])}">
<td><span class="cn">{esc(r['name_zh'])}</span><span class="ce">{esc(r['name_en'])}</span></td>
<td><span class="uni-badge">{UNIS[r['uni']]['abbr']}</span></td>
<td><span class="ctag">{CLI.get(r['cluster'],'')} {esc(r['cluster'])}</span></td>
<td><span class="sc-al">{esc(r['alevel'])}</span></td>
<td>{('<span class="sc-gpa">'+esc(r['gpa'])+'</span>') if r['glo'] else '<span class="sc-na">样本少</span>'}</td>
<td><span class="sc-atar">{esc(r['atar'])}</span></td>
</tr>''' for r in rows)

clchips="".join(f'<span class="udb-chip" data-f="cluster" data-v="{esc(c)}">{CLI.get(c,"")} {esc(c)}</span>' for c in clusters)

uasrows="".join(
 f'''<tr><td><span class="cn">{esc(z)}</span><span class="ce">{esc(e)}</span></td>
<td>{esc(col)}</td><td>{esc(ac)}</td>
<td><span class="{reqcls(rt)}">{esc(rt)}</span></td><td>{esc(req)}</td></tr>'''
 for z,e,col,ac,rt,req in UAS)

BODY=f'''
  <section class="udb-hero"><div class="in">
    <span class="udb-sample">⚙️ 样板页 · 当前仅含 NUS + UAS，确认格式后扩展到 6 公立全量</span>
    <h1>新加坡大学本科专业录取分数据库</h1>
    <p>每个专业三条录取通道一表看清：<b>A-Level 成绩档（IGP 官方）</b> · <b>理工 Diploma GPA（IGP 官方）</b> · <b>WACE 参考 ATAR</b>。艺术大学 UAS 按作品集/试演要求单列。</p>
  </div></section>

  <div class="atar-floor"><div class="box">
    🎓 <b>WACE / 澳洲学历申请须知</b>：新加坡公立大学对 WACE/澳洲 Year 12 按 <b>ATAR</b> 整体评估（如 NTU 官方门槛 ATAR ≥90）。下表「WACE 参考 ATAR」是按各专业<b>最低录取 A-Level 档换算的估算值</b>，用于判断专业竞争度，达校级门槛后按此竞争——具体以各校官方为准。
  </div></div>

  <div class="udb-tools"><div class="in">
    <div class="udb-row">
      <div class="udb-find">🔎<input type="search" id="uq" placeholder="搜专业 / 方向，如 计算机、护理、商科"></div>
      <div class="udb-gpa"><span>我的理工 GPA</span><input type="number" id="ugpa" min="0" max="4" step="0.01" placeholder="如 3.7"><label><input type="checkbox" id="uonly"> 只看我够得着</label></div>
    </div>
    <div class="udb-row"><span class="udb-chiplabel">方向</span><div class="udb-chips">{clchips}</div></div>
  </div></div>
  <div class="udb-count">显示 <b id="ushow">{N}</b> / {N} 个专业（NUS 样板）　<span id="uhint" style="color:var(--muted)"></span></div>

  <div class="udb-wrap">
    <table class="udb-table" id="utable">
      <thead><tr>
        <th>专业</th><th>大学</th><th>方向</th>
        <th>A-Level 档<br><small style="font-weight:400;color:#999">官方 IGP</small></th>
        <th>理工 GPA<br><small style="font-weight:400;color:#999">官方 IGP</small></th>
        <th>WACE 参考 ATAR<br><small style="font-weight:400;color:#999">估算</small></th>
      </tr></thead>
      <tbody id="ubody">{rowhtml}</tbody>
    </table>
  </div>
  <p class="udb-note">A-Level 档与理工 GPA 为 NUS 官方 AY2025/26 IGP（10–90 百分位）；WACE ATAR 为按最低录取 A-Level 估算的参考值。"样本少"指官方因人数过少未公布 GPA。</p>

  <section class="udb-sec">
    <h2>🎨 新加坡艺术大学 UAS（作品集 / 试演录取）</h2>
    <p class="lead">UAS（由 NAFA 与 LASALLE 组成）是艺术类大学，<b>不看分数线</b>——A-Level / WACE 达学术门槛即可，录取主要看<b>作品集或试演</b>。以下为代表专业与要求（以 NAFA / LASALLE 官方为准）。</p>
    <div style="overflow-x:auto"><table class="uas-table">
      <thead><tr><th>专业</th><th>学院</th><th>学术门槛</th><th>录取方式</th><th>作品集 / 试演要求</th></tr></thead>
      <tbody>{uasrows}</tbody>
    </table></div>
  </section>

  <section class="udb-sec" style="padding-top:0">
    <p class="lead" style="font-size:.86rem">本页为<b>样板</b>，用于确认「A-Level + WACE + 理工 GPA」三通道 + UAS 作品集的展示格式。确认后将扩展到 <b>NUS / NTU / SMU / SUTD / SIT / SUSS 六所公立 + UAS 全量专业</b>，并补 gostudy 式大学目录页与各校录取门槛。想要一对一选校建议可<a href="/contact/" style="color:#1f4e9c;font-weight:700">免费咨询</a>。</p>
  </section>
'''

JS=r'''
<script>
(function(){
  var body=document.getElementById('ubody');
  var rows=[].slice.call(body.querySelectorAll('tr'));
  var q=document.getElementById('uq'),gpa=document.getElementById('ugpa'),only=document.getElementById('uonly');
  var show=document.getElementById('ushow'),hint=document.getElementById('uhint');
  var fC={};
  function act(o){return Object.keys(o).filter(function(k){return o[k]})}
  function apply(){
    var term=(q.value||'').trim().toLowerCase();
    var g=parseFloat(gpa.value); var onlyMe=only.checked&&!isNaN(g);
    var aC=act(fC),n=0;
    rows.forEach(function(tr){
      var ok=true;
      if(term&&tr.getAttribute('data-name').indexOf(term)<0)ok=false;
      if(ok&&aC.length&&aC.indexOf(tr.getAttribute('data-cluster'))<0)ok=false;
      var glo=parseFloat(tr.getAttribute('data-glo'));
      if(ok&&onlyMe&&(glo===0||g<glo))ok=false;
      tr.classList.toggle('dim',!ok); if(ok)n++;
    });
    show.textContent=n;
    hint.textContent=(!isNaN(g))?('· GPA '+g.toFixed(2)+' 够得着的专业（你的 GPA ≥ 该专业最低录取 GPA）'):'';
  }
  q.addEventListener('input',apply);gpa.addEventListener('input',apply);only.addEventListener('change',apply);
  document.querySelectorAll('.udb-chip').forEach(function(c){c.addEventListener('click',function(){c.classList.toggle('on');fC[c.getAttribute('data-v')]=c.classList.contains('on');apply();});});
})();
</script>'''

os.makedirs(os.path.join(ROOT,"university/degrees"),exist_ok=True)
open(os.path.join(ROOT,"university/degrees/index.html"),"w",encoding="utf-8").write(head()+BODY+JS+TAIL)
print("wrote university/degrees/index.html | NUS programmes:",N,"| UAS:",len(UAS))
