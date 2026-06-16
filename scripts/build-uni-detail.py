# -*- coding: utf-8 -*-
"""Generalized premium university detail-page builder (NUS-standard).
Each university is a CONFIG with its own brand colours, photos and rich content.
Reuses the nx- editorial design. NUS has its own script (build-nus-detail.py)."""
import os, json, re, html
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
def esc(s): return html.escape(str(s),quote=True)

CSS_TMPL=r'''
.nx{--navy:%NAVY%;--navy2:%NAVY2%;--gold:%ACC%;--ink:#16202e;--mut:#5d6b7e;--line:#e6eaf0;--bg:#f7f9fc;color:var(--ink);background:#fff;-webkit-tap-highlight-color:transparent}
.nx *{box-sizing:border-box}
.nx ::selection{background:rgba(0,0,0,.08);color:var(--ink)}
.nx-fcard,.nx-pcard,.nx-rcard,.nx-fee,.nx-cc,.nx-fb{-webkit-tap-highlight-color:transparent}
.nx-hero{position:relative;min-height:clamp(340px,44vw,480px);display:flex;align-items:flex-end;background-size:cover;background-position:center;color:#fff}
.nx-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,18,38,.28) 0%,rgba(8,18,38,.55) 55%,rgba(8,18,38,.82) 100%)}
.nx-hero .in{position:relative;z-index:2;max-width:1160px;margin:0 auto;width:100%;padding:0 clamp(20px,6vw,72px) clamp(30px,4vw,48px)}
.nx-kicker{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:16px}
.nx-kicker span{font-size:.8rem;font-weight:700;letter-spacing:.02em;padding:5px 13px;border:1px solid rgba(255,255,255,.4);border-radius:999px;background:rgba(255,255,255,.08);backdrop-filter:blur(3px)}
.nx-kicker .au{border-color:var(--gold);color:#fff}
.nx-hero h1{font-size:clamp(30px,4.6vw,52px);line-height:1.12;margin:0 0 12px;font-weight:850;letter-spacing:-.01em;text-shadow:0 2px 16px rgba(0,0,0,.3)}
.nx-hero .sub{font-size:clamp(15px,1.7vw,19px);color:rgba(255,255,255,.92);max-width:720px;margin:0;line-height:1.6}
.nx-hero .rule{width:64px;height:3px;background:var(--gold);border-radius:2px;margin:0 0 18px}
.nx-stats{background:var(--navy);color:#fff}
.nx-stats .in{max-width:1160px;margin:0 auto;padding:26px clamp(20px,6vw,72px);display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.nx-stat{text-align:center;padding:6px 4px;position:relative}
.nx-stat+.nx-stat::before{content:"";position:absolute;left:0;top:18%;height:64%;width:1px;background:rgba(255,255,255,.22)}
.nx-stat .n{font-size:clamp(22px,2.6vw,30px);font-weight:850;color:var(--gold);line-height:1}
.nx-stat .l{font-size:.78rem;color:rgba(255,255,255,.78);margin-top:6px;letter-spacing:.02em}
.nx-wrap{max-width:1080px;margin:0 auto;padding:0 clamp(20px,6vw,72px)}
.nx-sec{padding:clamp(40px,5vw,60px) 0;border-top:1px solid var(--line)}
.nx-sec:first-of-type{border-top:0}
.nx-h2{font-size:clamp(23px,3vw,32px);font-weight:820;color:var(--navy);margin:0 0 8px;letter-spacing:-.01em;display:flex;align-items:center;gap:12px}
.nx-h2::before{content:"";width:26px;height:3px;background:var(--gold);border-radius:2px;flex:0 0 auto}
.nx-lead{color:var(--mut);font-size:1.04rem;line-height:1.85;margin:0 0 8px;max-width:760px}
.nx-lead a{color:var(--navy2);font-weight:700;border-bottom:1px solid #c7d3e6}
.nx-prose p{color:#3a4658;font-size:1.05rem;line-height:1.95;margin:0 0 16px;max-width:820px}
.nx-prose p b{color:var(--navy2)}
.nx-rank{margin-top:24px;background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:18px;padding:28px clamp(20px,4vw,34px);color:#fff}
.nx-rank .big{display:flex;flex-wrap:wrap;gap:28px;margin-bottom:18px}
.nx-rank .big .it{flex:0 0 auto}
.nx-rank .big .n{font-size:2.6rem;font-weight:850;color:var(--gold);line-height:1}
.nx-rank .big .l{font-size:.86rem;color:rgba(255,255,255,.82);margin-top:4px}
.nx-rank .subs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px 18px;border-top:1px solid rgba(255,255,255,.25);padding-top:16px}
.nx-rank .subs .s{font-size:.92rem;color:rgba(255,255,255,.92);display:flex;justify-content:space-between;gap:10px}
.nx-rank .subs .s b{color:var(--gold);white-space:nowrap}
.nx-tldr{display:flex;gap:16px;background:#f6f8fb;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:16px;padding:22px 26px;font-size:1.06rem;line-height:1.8;color:var(--ink)}
.nx-tldr .q{font-size:2.4rem;line-height:1;color:var(--gold);font-family:Georgia,serif}
.nx-tldr b{color:var(--navy2)}
.nx-feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:18px;margin-top:24px}
.nx-fcard{padding:22px;border:1px solid var(--line);border-radius:16px;background:#fff;transition:box-shadow .2s,transform .2s}
.nx-fcard:hover{box-shadow:0 18px 40px rgba(13,34,64,.09);transform:translateY(-3px)}
.nx-fcard .ic{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:13px}
.nx-fcard h3{margin:0 0 6px;font-size:1.08rem;color:var(--ink)}
.nx-fcard p{margin:0;font-size:.92rem;color:var(--mut);line-height:1.65}
.nx-figure{margin:30px 0 0;border-radius:18px;overflow:hidden;box-shadow:0 16px 44px rgba(13,34,64,.12)}
.nx-figure img{width:100%;height:auto;display:block}
.nx-figure figcaption{padding:11px 18px;font-size:.84rem;color:var(--mut);background:#fff;border:1px solid var(--line);border-top:0}
.nx-prog{display:grid;grid-template-columns:repeat(auto-fill,minmax(252px,1fr));gap:16px;margin-top:22px}
.nx-pcard{border:1px solid var(--line);border-radius:15px;padding:18px 20px;background:#fff;border-left:3px solid var(--gold);transition:box-shadow .2s,transform .2s}
.nx-pcard:hover{box-shadow:0 16px 38px rgba(13,34,64,.1);transform:translateY(-3px)}
.nx-pcard .t{display:flex;align-items:center;gap:9px;margin-bottom:6px}
.nx-pcard .t .ic{font-size:1.25rem}
.nx-pcard h3{margin:0;font-size:1.06rem;color:var(--navy);flex:1}
.nx-pcard .hot{font-size:.66rem;font-weight:800;color:#fff;background:var(--gold);padding:2px 8px;border-radius:999px}
.nx-pcard p{margin:0;font-size:.88rem;color:var(--mut);line-height:1.6}
.nx-pcard .cop{margin-top:11px;padding-top:10px;border-top:1px dashed var(--line);font-size:.84rem;color:var(--ink)}
.nx-pcard .cop b{color:var(--navy2)}
.nx-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}
.nx-chips span{font-size:.9rem;color:var(--ink);background:#fff;border:1px solid var(--line);padding:9px 15px;border-radius:11px}
.nx-chips span b{color:var(--navy2);font-weight:700}
.nx-camp{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:22px}
.nx-cc{border:1px solid var(--line);border-radius:15px;padding:18px 20px;background:#fff;border-top:3px solid var(--navy2)}
.nx-cc h3{margin:0 0 5px;font-size:1.05rem;color:var(--navy)}
.nx-cc .en{font-size:.78rem;color:var(--mut);margin:0 0 8px}
.nx-cc p{margin:0;font-size:.9rem;color:var(--mut);line-height:1.6}
.nx-routes{display:grid;grid-template-columns:repeat(auto-fit,minmax(244px,1fr));gap:15px;margin-top:22px}
.nx-rcard{border:1px solid var(--line);border-radius:14px;padding:17px 19px;background:#fff;transition:box-shadow .2s,transform .2s}
.nx-rcard.lead{background:linear-gradient(135deg,var(--navy),var(--navy2));border-color:var(--navy)}
.nx-rcard .h{display:flex;align-items:center;gap:9px;font-weight:800;color:var(--ink);margin-bottom:6px}
.nx-rcard .h .fl{font-size:1.3rem}
.nx-rcard.lead .h,.nx-rcard.lead .h *{color:#fff}
.nx-rcard p{margin:0;font-size:.88rem;color:var(--mut);line-height:1.6}
.nx-rcard.lead p{color:rgba(255,255,255,.9)}
.nx-rcard.lead b{color:#fff;text-decoration:underline;text-decoration-color:var(--gold)}
.nx-rcard.lead .badge{font-size:.66rem;font-weight:800;color:var(--navy);background:#fff;padding:2px 8px;border-radius:999px;margin-left:auto}
.nx-rcard:hover,.nx-cc:hover{box-shadow:0 16px 38px rgba(13,34,64,.1);transform:translateY(-3px)}
.nx-fees{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:22px}
.nx-fee{border:1px solid var(--line);border-radius:15px;padding:20px;text-align:center;background:#fff;position:relative;transition:box-shadow .2s,transform .2s}
.nx-fee:hover{box-shadow:0 16px 38px rgba(13,34,64,.1);transform:translateY(-3px)}
.nx-fee.hl{border-color:var(--gold)}
.nx-fee .tag{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--gold);color:#fff;font-size:.7rem;font-weight:800;padding:3px 12px;border-radius:999px;white-space:nowrap}
.nx-fee .who{font-size:.82rem;color:var(--mut);margin:0 0 6px}
.nx-fee .price{font-size:1.5rem;font-weight:850;color:var(--navy);margin:0}
.nx-fee .note{font-size:.78rem;color:var(--mut);margin:6px 0 0}
.nx-fit{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
.nx-fb{border-radius:15px;padding:20px 22px;border:1px solid var(--line)}
.nx-fb.y{background:#f4f8fc;border-color:#d3e2f2}
.nx-fb.n{background:#fafbfc}
.nx-fb h4{margin:0 0 10px;font-size:1rem}.nx-fb.y h4{color:var(--navy2)}.nx-fb.n h4{color:var(--mut)}
.nx-fb ul{margin:0;padding-left:1.15rem;line-height:1.85;font-size:.93rem;color:var(--ink)}
.nx-faq details{border:1px solid var(--line);border-radius:13px;margin-bottom:11px;overflow:hidden;background:#fff}
.nx-faq summary{cursor:pointer;padding:16px 20px;font-weight:700;color:var(--ink);list-style:none;display:flex;justify-content:space-between;gap:14px}
.nx-faq summary::-webkit-details-marker{display:none}
.nx-faq summary::after{content:"+";color:var(--gold);font-weight:800;font-size:1.3rem;line-height:1}
.nx-faq details[open] summary{border-bottom:1px solid var(--line)}
.nx-faq details[open] summary::after{content:"\2212"}
.nx-faq .a{padding:15px 20px;color:var(--mut);line-height:1.8;font-size:.95rem}
.nx-faq .a a{color:var(--navy2);font-weight:700}
.nx-rel{display:flex;flex-wrap:wrap;gap:11px;margin-top:22px}
.nx-rel a{font-size:.92rem;font-weight:700;color:var(--navy);background:#fff;border:1px solid var(--line);padding:10px 18px;border-radius:999px;text-decoration:none;transition:.15s}
.nx-rel a:hover{border-color:var(--gold);box-shadow:0 8px 20px rgba(13,34,64,.08)}
.nx-cta{margin-top:30px;background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:18px;padding:28px 30px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px}
.nx-cta h3{margin:0 0 5px;color:#fff;font-size:1.3rem}.nx-cta p{margin:0;color:rgba(255,255,255,.8);font-size:.95rem}
.nx-cta a{background:var(--gold);color:#fff;font-weight:800;padding:13px 26px;border-radius:11px;text-decoration:none;white-space:nowrap}
@media(max-width:640px){.nx-fit{grid-template-columns:1fr}.nx-stat+.nx-stat::before{display:none}}
'''

def figure(f):
    if not f: return ""
    return f'<figure class="nx-figure"><img src="{f[0]}" alt="{esc(f[1])}" loading="lazy" decoding="async" width="1200"><figcaption>{esc(f[2])}</figcaption></figure>'
def hotspan(h): return f'<span class="hot">{esc(h)}</span>' if h else ''
def badgespan(b): return f'<span class="badge">{esc(b)}</span>' if b else ''
def tagspan(t): return f'<span class="tag">{esc(t)}</span>' if t else ''

def render(c):
    CSS=CSS_TMPL.replace("%NAVY%",c["navy"]).replace("%NAVY2%",c["navy2"]).replace("%ACC%",c["acc"])
    kick="".join(f'<span class="{ "au" if i==0 else "" }">{esc(k)}</span>' for i,k in enumerate(c["kicker"]))
    stats="".join(f'<div class="nx-stat"><div class="n">{esc(n)}</div><div class="l">{l}</div></div>' for n,l in c["stats"])
    overview="".join(f'<p>{p}</p>' for p in c["overview"])
    rank=""
    if c.get("rank"):
        bigs="".join(f'<div class="it"><div class="n">{esc(n)}</div><div class="l">{l}</div></div>' for n,l in c["rank"]["bigs"])
        subs="".join(f'<div class="s"><span>{esc(s)}</span><b>{esc(r)}</b></div>' for s,r in c["rank"]["subs"])
        rank=f'<div class="nx-rank"><div class="big">{bigs}</div><div class="subs">{subs}</div></div>'
    why="".join(f'<div class="nx-fcard"><div class="ic">{ic}</div><h3>{esc(t)}</h3><p>{d}</p></div>' for ic,t,d in c["why"])
    faculties=f'<section class="nx-sec"><h2 class="nx-h2">{esc(c["faculties"][0])}</h2><p class="nx-lead">{c["faculties"][1]}</p><div class="nx-chips">{"".join(c["faculties"][2])}</div></section>' if c.get("faculties") else ""
    progs="".join(f'<div class="nx-pcard"><div class="t"><span class="ic">{ic}</span><h3>{esc(nm)}</h3>{hotspan(hot)}</div><p>{d}</p><div class="cop">{cop}</div></div>' for ic,nm,hot,d,cop in c["progs"])
    camps=""
    if c.get("campuses"):
        cc="".join(f'<div class="nx-cc"><h3>{esc(n)}</h3><p class="en">{esc(e)}</p><p>{d}</p></div>' for n,e,d in c["campuses"])
        camps=f'<section class="nx-sec"><h2 class="nx-h2">{esc(c.get("campuses_h","校区"))}</h2><div class="nx-camp">{cc}</div></section>'
    feats="".join(f'<div class="nx-fcard"><div class="ic">{ic}</div><h3>{esc(t)}</h3><p>{d}</p></div>' for ic,t,d in c["features"])
    emp=""
    if c.get("emp"):
        e=c["emp"]; bigs="".join(f'<div class="it"><div class="n">{esc(n)}</div><div class="l">{l}</div></div>' for n,l in e["bigs"])
        emp=f'''<section class="nx-sec"><h2 class="nx-h2">就业与出路</h2><p class="nx-lead">{e["lead"]}</p>
        <div class="nx-rank"><div class="big">{bigs}</div><div class="subs" style="grid-template-columns:1fr"><div class="s" style="display:block;color:rgba(255,255,255,.9);line-height:1.7">{e["note"]}</div></div></div>{figure(c.get("fig_emp"))}</section>'''
    routes="".join(f'<div class="nx-rcard{" lead" if lead else ""}"><div class="h"><span class="fl">{fl}</span>{esc(t)}{badgespan(badge)}</div><p>{d}</p></div>' for fl,t,badge,d,lead in c["routes"])
    fees="".join(f'<div class="nx-fee{" hl" if hl else ""}">{tagspan(tag)}<p class="who">{esc(who)}</p><p class="price">{esc(price)}</p><p class="note">{esc(note)}</p></div>' for hl,tag,who,price,note in c["fees"])
    fy="".join(f'<li>{esc(x)}</li>' for x in c["fit"][0]); fn="".join(f'<li>{esc(x)}</li>' for x in c["fit"][1])
    faqs="".join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q,a in c["faqs"])
    rel="".join(f'<a href="{u}">{esc(t)}</a>' for t,u in c["rel"])

    body=f'''<div class="nx">
  <section class="nx-hero" style="background-image:url('{c["hero_img"]}')"><div class="in">
    <div class="nx-kicker">{kick}</div><div class="rule"></div>
    <h1>{esc(c["name_zh"])} {esc(c["abbr"])}</h1>
    <p class="sub">{esc(c["hero_sub"])}</p>
  </div></section>
  <div class="nx-stats"><div class="in">{stats}</div></div>
  <div class="nx-wrap">
    <section class="nx-sec"><div class="nx-tldr"><span class="q">“</span><div>{c["tldr"]}</div></div></section>
    <section class="nx-sec nx-prose"><h2 class="nx-h2">学校概况</h2>{overview}{rank}</section>
    <section class="nx-sec"><h2 class="nx-h2">为什么是 {esc(c["abbr"])}</h2><p class="nx-lead">{c["why_lead"]}</p><div class="nx-feat">{why}</div></section>
    {faculties}
    <section class="nx-sec"><h2 class="nx-h2">王牌与热门专业</h2><p class="nx-lead">{c["progs_lead"]} <a href="/university/degrees/?uni={c['slug']}">查全部 {esc(c['abbr'])} 专业的录取分 →</a></p><div class="nx-prog">{progs}</div>{figure(c.get("fig_prog"))}</section>
    {camps}
    <section class="nx-sec"><h2 class="nx-h2">特色项目与校园生活</h2><div class="nx-feat">{feats}</div></section>
    {emp}
    <section class="nx-sec"><h2 class="nx-h2">中国学生申请路径</h2><p class="nx-lead">{c.get("routes_lead","按你手上的成绩类型选择。")}</p><div class="nx-routes">{routes}</div></section>
    <section class="nx-sec"><h2 class="nx-h2">学费参考 · 国际学生 / 每年</h2><div class="nx-fees">{fees}</div><p class="nx-lead" style="margin-top:16px;font-size:.9rem">{c["fees_note"]}</p></section>
    <section class="nx-sec"><h2 class="nx-h2">适合谁</h2><div class="nx-fit"><div class="nx-fb y"><h4>✅ 适合</h4><ul>{fy}</ul></div><div class="nx-fb n"><h4>⚠️ 需谨慎</h4><ul>{fn}</ul></div></div></section>
    <section class="nx-sec nx-faq"><h2 class="nx-h2">常见问题</h2><div style="margin-top:20px">{faqs}</div>
      <div class="nx-cta"><div><h3>想知道你的分数能进 {esc(c["abbr"])} 哪个专业？</h3><p>用大学专业录取分数据库，输入成绩看 {esc(c["abbr"])} 各专业门槛。</p></div><a href="/university/degrees/?uni={c['slug']}">查 {esc(c["abbr"])} 专业录取分 →</a></div>
      <div class="nx-rel">{rel}</div>
    </section>
  </div>
</div>'''
    jsonld=[
      {"@context":"https://schema.org","@type":"CollegeOrUniversity","name":c["name_zh"],"alternateName":c["name_en"],"url":f"https://sgeda.org.cn/university/{c['slug']}/","sameAs":c["site"],"foundingDate":str(c["founded"]),"description":c["meta_desc"],"inLanguage":"zh-CN"},
      {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},{"@type":"ListItem","position":2,"name":"新加坡大学","item":"https://sgeda.org.cn/university/"},{"@type":"ListItem","position":3,"name":c["name_zh"]}]},
      {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub('<[^>]+>','',a)}} for q,a in c["faqs"]]},
    ]
    jl="\n".join('<script type="application/ld+json">%s</script>'%json.dumps(j,ensure_ascii=False,separators=(",",":")) for j in jsonld)
    page=f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>{esc(c["title"])}</title>
<meta name="description" content="{esc(c["meta_desc"])}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="https://sgeda.org.cn/university/{c['slug']}/"/>
<link rel="stylesheet" href="/seda-site.css?v=38"/>
{jl}
<style>{CSS}</style>
</head>
<body>
{HEADER}
<main>
{body}
</main>
{FOOTER}
<script src="/seda-site.js?v=28"></script>
</body>
</html>'''
    os.makedirs(os.path.join(ROOT,"university",c["slug"]),exist_ok=True)
    open(os.path.join(ROOT,"university",c["slug"],"index.html"),"w",encoding="utf-8").write(page)
    return len(page)

from uni_configs import CONFIGS
for slug,c in CONFIGS.items():
    n=render(c); print(f"wrote university/{slug}/index.html | {n} bytes")
