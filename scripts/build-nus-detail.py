# -*- coding: utf-8 -*-
"""Build a rich, custom /university/nus/ detail page — reuses the poly detail-page
visual system (header/footer/<style> from poly/sp) with NUS-specific real content + photos."""
import os, json, re, html
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
STYLE=SP[SP.index('<style>'):SP.index('</style>')+len('</style>')]
def esc(s): return html.escape(str(s),quote=True)

faqs=[
 ("高考多少分能进 NUS？","NUS 接受中国高考成绩，但门槛很高——通常要求<b>远超当地一本线/特控线</b>（热门专业如计算机、商科、医学更高），并看英文单科成绩；英文不够会要求雅思/托福。高考只是入门，最终按全体国际申请者择优录取。"),
 ("NUS 接受高考申请吗？需要什么？","接受。中国学生可凭高考直接申请，需提交高考总分与单科（尤其英文/数学），部分专业有附加要求或面试。同时也接受 A-Level、IB、WACE/ATAR 和新加坡理工 Diploma。"),
 ("NUS 国际学生一年学费多少？","申请 MOE 学费津贴后，国际学生约每年 <b>S$20,000–39,200</b>（按专业，医学/牙医更高），需签<b>毕业后在新加坡工作 3 年</b>的服务协议；不申请津贴则更高。另需预算住宿与生活费。"),
 ("NUS 世界排名怎么样？","NUS 是新加坡综合排名最高的大学，QS 世界排名长期稳居<b>前 10（2025 年第 8）</b>，亚洲第一梯队，法律、计算机、商业分析、工程、医学等多个学科全球领先。"),
 ("NUS 最强/最热门的专业是哪些？","计算机科学、商业分析、商业人工智能系统、医学、法律、工商管理、药学都是录取分最高的一档。具体每个专业的 A-Level / 理工 GPA 录取线见<a href='/university/degrees/?uni=nus'>大学专业录取分数据库</a>。"),
 ("理工 Diploma 毕业能进 NUS 吗？","能。NUS 收理工生，按 GPA 竞争，多数专业 IGP 的理工 GPA 区间在 <b>3.6–3.9</b>（满分 4.0），热门专业接近 3.9+。先在<a href='/poly/courses/'>理工专业数据库</a>选对 Diploma，再用 GPA 升 NUS。"),
 ("NUS 校园在哪？住宿怎么样？","主校区在 <b>Kent Ridge（肯特岗）</b>，西部地铁可达；法学院在 Bukit Timah。住宿有 13 所住宿型 Hall / Residential College，加上现代化的 <b>University Town（UTown）</b>书院制社区，校园生活丰富。"),
 ("NUS 有奖学金吗？","有。面向国际学生有 ASEAN / 各类入学奖学金（如 Science & Technology Scholarship 等），覆盖学费甚至生活费，竞争激烈、需单独申请，通常看成绩 + 综合表现。"),
 ("NUS 和 NTU 怎么选？","NUS 综合更全、文社科与医法更强、综合排名略高；NTU 工程与计算机全球顶尖、校园更大更新。看专业方向：法律/医学/商科/文社科偏 NUS，纯工程/材料/通信可重点看 NTU。两校都可用同一套高考/A-Level/GPA 申请。"),
 ("NUS 申请时间线是怎样的？","国际本科一般在每年 10 月–次年 2/3 月开放申请（高考生通常在出分后补交成绩），8 月入学。建议提前 1 年准备成绩、英文、文书与奖学金申请。"),
]
faqld={"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub('<[^>]+>','',a)}} for q,a in faqs]}
collegeld={"@context":"https://schema.org","@type":"CollegeOrUniversity","name":"新加坡国立大学","alternateName":"National University of Singapore","url":"https://sgeda.org.cn/university/nus/","sameAs":"https://www.nus.edu.sg/","foundingDate":"1905","address":{"@type":"PostalAddress","addressLocality":"Kent Ridge","addressCountry":"SG"},"description":"新加坡历史最久、综合排名最高的公立大学，QS 世界排名前 10。接受中国高考、A-Level、IB、WACE 及理工 Diploma 申请。","inLanguage":"zh-CN"}
breadld={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},{"@type":"ListItem","position":2,"name":"新加坡大学","item":"https://sgeda.org.cn/university/"},{"@type":"ListItem","position":3,"name":"新加坡国立大学"}]}
jsonld="\n".join('<script type="application/ld+json">%s</script>'%json.dumps(j,ensure_ascii=False,separators=(",",":")) for j in [collegeld,breadld,faqld])

faqhtml="".join(f'<details><summary>{esc(q)}</summary><p>{a}</p></details>' for q,a in faqs)

HTML=f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<title>新加坡国立大学（NUS）完整指南：QS世界#8、中国学生高考/A-Level/WACE申请、专业与学费 | SEDA</title>
<meta name="description" content="新加坡国立大学（NUS）深度指南：QS 世界排名第 8，新加坡综合第一。接受中国高考、A-Level、IB、WACE/ATAR 及理工 Diploma 申请；附热门专业录取分、国际生学费与申请路径。"/>
<meta name="keywords" content="新加坡国立大学,NUS,NUS申请,NUS高考,NUS学费,NUS专业,NUS录取分,新加坡国立大学世界排名"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<link rel="canonical" href="https://sgeda.org.cn/university/nus/"/>
<link rel="alternate" type="application/rss+xml" title="SEDA 新加坡择校网最新文章" href="https://sgeda.org.cn/feed.xml"/>
<link rel="stylesheet" href="/seda-site.css?v=38"/>
{jsonld}
{STYLE}
<style>
.nus-hero .hero-rank{{display:inline-flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}}
.nus-hero .hero-rank span{{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);padding:4px 11px;border-radius:999px;font-size:.82rem;font-weight:700}}
.route-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:8px 0 4px}}
.route-card{{border:1px solid var(--line);border-radius:13px;padding:15px 17px;background:#fff}}
.route-card .h{{display:flex;align-items:center;gap:8px;font-weight:800;color:var(--ink);margin-bottom:5px}}
.route-card .h .flag{{font-size:1.2rem}}
.route-card.hot{{border-color:#f0bcbc;background:linear-gradient(135deg,#fff7f7,#fff)}}
.route-card .tag{{font-size:.7rem;font-weight:800;color:#fff;background:var(--brand);padding:2px 8px;border-radius:999px;margin-left:auto}}
.route-card p{{margin:0;font-size:.86rem;color:var(--muted);line-height:1.6}}
</style>
</head>
<body>
{HEADER}
<main>
  <section class="page-hero school-hero nus-hero" style="background:linear-gradient(125deg,rgba(10,22,52,.86) 0%,rgba(15,42,92,.55) 100%),url('/assets/nus-campus.jpg') center/cover">
    <div class="hero-rank"><span>🏆 QS 世界 #8</span><span>🇸🇬 新加坡综合第一</span><span>📅 1905 年创办</span></div>
    <h1>新加坡国立大学（NUS）完整指南</h1>
    <p class="hero-subtitle">新加坡历史最久、综合排名最高的公立大学 · 法律 / 医学 / 计算机 / 商科全面顶尖 · 接受中国高考申请</p>
  </section>
  <div class="content-layout">
    <article class="content-main">

      <div class="poly-facts">
        <div class="poly-fact"><span class="ic">🏆</span><div><p class="t">QS 世界排名</p><p class="v">第 8（2025）</p></div></div>
        <div class="poly-fact"><span class="ic">📅</span><div><p class="t">创办</p><p class="v">1905 年</p></div></div>
        <div class="poly-fact"><span class="ic">📍</span><div><p class="t">主校区</p><p class="v">Kent Ridge 肯特岗</p></div></div>
        <div class="poly-fact"><span class="ic">👥</span><div><p class="t">在校生</p><p class="v">约 38,000</p></div></div>
        <div class="poly-fact"><span class="ic">🏛️</span><div><p class="t">学院/学部</p><p class="v">17 个</p></div></div>
        <div class="poly-fact"><span class="ic">🇨🇳</span><div><p class="t">中国学生</p><p class="v">接受高考申请</p></div></div>
      </div>

      <div class="poly-tldr">一句话看懂：<b>NUS 是新加坡的「清北」</b>——综合排名最高、QS 世界前 10，文理工商医法全面顶尖。中国学生可凭<b>高考、A-Level、IB、WACE 或理工 Diploma</b> 申请，门槛高、竞争激烈，是冲顶学霸的首选。</div>

      <figure class="poly-photo"><img src="/assets/nus-campus.jpg" alt="新加坡国立大学 University Town（UTown）夜景" loading="lazy" decoding="async" width="1200"><figcaption>University Town（UTown）夜景——NUS 现代化书院制社区（图：Wikimedia Commons）</figcaption></figure>

      <div class="poly-why"><h3>💡 为什么选 NUS（而不是别家）</h3><ul>
        <li><b>综合实力全国第一</b>：法律、医学、计算机、商业分析、商科、工程全部亚洲/全球顶尖，选择面最广</li>
        <li><b>QS 世界 #8</b>：常年亚洲第一梯队，文凭全球认可、就业力榜单前列</li>
        <li><b>住宿学院 + UTown 书院制</b>：13 所 Hall/RC + NUS College 荣誉书院，校园生活与人脉资源丰富</li>
        <li><b>接受中国高考</b>：高考生有专门通道，无需再考 A-Level 也能申请顶尖名校</li>
      </ul></div>

      <h2 id="programs">🎯 王牌与热门专业</h2>
      <p>NUS 录取分最高的一档集中在计算机、商科与医法。下面是热门方向，<a href="/university/degrees/?uni=nus">点此查全部 NUS 专业的 A-Level / 理工 GPA 录取分 →</a></p>
      <div class="prog-grid">
        <div class="prog-card"><div class="head"><span class="ic">💻</span><h3>计算机科学</h3><span class="uniq">最热</span></div><p>School of Computing，全亚洲顶尖；含 AI、信息安全方向。</p><div class="cop">A-Level 档 <b>AAA/A</b> · 理工 GPA <b>3.81–3.98</b></div></div>
        <div class="prog-card"><div class="head"><span class="ic">📊</span><h3>商业分析 / 商业 AI</h3><span class="uniq">高薪</span></div><p>数据 + 商科交叉，就业极强，分数门槛顶格。</p><div class="cop">A-Level 档 <b>AAA/A</b> · 理工 GPA <b>3.71–3.98</b></div></div>
        <div class="prog-card"><div class="head"><span class="ic">⚖️</span><h3>法律 Law</h3></div><p>全国最强法学院之一，录取近满分。</p><div class="cop">A-Level 档 <b>AAA/A</b></div></div>
        <div class="prog-card"><div class="head"><span class="ic">🩺</span><h3>医学 Medicine</h3></div><p>杨潞龄医学院，五年制 MBBS，录取极难。</p><div class="cop">A-Level 档 <b>AAA/A</b> · 理工 GPA <b>3.87–3.99</b></div></div>
        <div class="prog-card"><div class="head"><span class="ic">💼</span><h3>工商管理 Business</h3></div><p>NUS Business School，亚洲商学院第一梯队。</p><div class="cop">A-Level 档 <b>AAA/C–AAA/A</b> · 理工 GPA <b>3.61–3.94</b></div></div>
        <div class="prog-card"><div class="head"><span class="ic">⚙️</span><h3>工程（大类）</h3></div><p>含机械、电子、生物医学等，名额多、相对友好。</p><div class="cop">A-Level 档 <b>BBB/C–AAA/A</b> · 理工 GPA <b>3.57–3.94</b></div></div>
      </div>

      <figure class="poly-photo"><img src="/assets/nus-campus2.jpg" alt="NUS 计算机学院 COM2 大楼" loading="lazy" decoding="async" width="1200"><figcaption>NUS 计算机学院（School of Computing）——全亚洲顶尖（图：Wikimedia Commons）</figcaption></figure>

      <h2 id="apply">📝 中国学生申请路径</h2>
      <p>NUS 对中国学生开放多条通道，按你手上的成绩类型选：</p>
      <div class="route-grid">
        <div class="route-card hot"><div class="h"><span class="flag">🇨🇳</span>高考 Gaokao<span class="tag">中国学生主路</span></div><p>NUS 接受高考成绩，通常要求<b>远超一本线/特控线</b>，热门专业更高，看英文单科；英文不够需雅思/托福。</p></div>
        <div class="route-card"><div class="h"><span class="flag">📘</span>A-Level / 国际 A-Level</div><p>按 IGP 成绩档竞争，多数专业 <b>AAA</b> 起；国际 A-Level（CIE/Edexcel）按等同评估。</p></div>
        <div class="route-card"><div class="h"><span class="flag">🌐</span>IB 文凭</div><p>高分录取，热门专业一般 40+/45。</p></div>
        <div class="route-card"><div class="h"><span class="flag">🇦🇺</span>WACE / ATAR</div><p>按 ATAR 评估，顶尖专业近满分；以官方综合评估为准。</p></div>
        <div class="route-card"><div class="h"><span class="flag">🎓</span>理工 Diploma</div><p>凭 GPA 升学，多数专业 IGP GPA <b>3.6–3.9</b>。</p></div>
        <div class="route-card"><div class="h"><span class="flag">🗣️</span>语言要求</div><p>英文非母语者一般需<b>雅思 / 托福</b>或同等成绩。</p></div>
      </div>
      <p class="source-note">高考是中国学生进 NUS 的主要通道，但「过线」不等于录取——NUS 按全体国际申请者择优，越热门的专业要求越高。建议提前 1 年规划成绩与英文。</p>

      <h2 id="fees">💰 学费参考（国际学生·每年）</h2>
      <div class="fee-grid">
        <div class="fee-card hl"><span class="tag">中国学生看这档</span><span class="ic">✈️</span><p class="who">申请 MOE 津贴后</p><p class="price">S$20,000–39,200</p><p class="note">按专业；签 3 年服务协议</p></div>
        <div class="fee-card"><span class="ic">🩺</span><p class="who">医学 / 牙医</p><p class="price">更高</p><p class="note">专业学费另计</p></div>
        <div class="fee-card"><span class="ic">🏠</span><p class="who">住宿 + 生活费</p><p class="price">另算</p><p class="note">Kent Ridge / UTown 宿舍</p></div>
      </div>
      <p class="source-note">不申请学费津贴则更高；津贴需签毕业后在新加坡工作 3 年的服务协议。以 NUS / MOE 当年收费为准。</p>

      <figure class="poly-photo"><img src="/assets/nus-campus3.jpg" alt="NUS 理学院" loading="lazy" decoding="async" width="1200"><figcaption>NUS 理学院（Faculty of Science）（图：Wikimedia Commons）</figcaption></figure>

      <h2 id="fit">🧭 适合谁</h2>
      <div class="fit2">
        <div class="fit-box yes"><h4>✅ 适合</h4><ul><li>成绩拔尖、目标世界名校的学霸</li><li>想要综合性大学的丰富资源与人脉</li><li>高考 / A-Level / IB 高分，或理工 GPA 3.7+</li><li>看重排名、就业力与海外交换机会</li></ul></div>
        <div class="fit-box no"><h4>⚠️ 需谨慎</h4><ul><li>分数离顶尖还有距离——可看 SMU / SUTD / SIT</li><li>想要小班、应用型、产业实战导向</li><li>英文还在过渡期，需先把语言补上</li></ul></div>
      </div>

      <section class="related-section">
        <h2>继续了解</h2>
        <div class="quick-links"><a href="/university/">新加坡大学总览</a><a href="/university/degrees/?uni=nus">📊 NUS 全部专业录取分</a><a href="/university/ntu/">南洋理工 NTU</a><a href="/university/degrees/">大学专业数据库</a><a href="/poly/courses/">理工专业数据库</a></div>
      </section>

      <section class="faq-section" id="faq">
        <h2>❓ 常见问题</h2>
        {faqhtml}
      </section>
    </article>
    <aside class="sidebar">
      <div class="sidebar-card"><h3>NUS 速览</h3><ul>
        <li>🏆 QS 世界 #8（2025）</li>
        <li>📅 1905 · 全国最久</li>
        <li>📍 Kent Ridge 肯特岗</li>
        <li>👥 约 38,000 在校生</li>
        <li>🇨🇳 接受中国高考</li>
        <li>💰 国际生约 S$20k–39k/年</li>
      </ul></div>
      <div class="sidebar-card"><h3>🎯 录取分速查</h3><ul>
        <li>💻 计算机 A-Level <b>AAA/A</b></li>
        <li>📊 商业分析 GPA <b>3.75+</b></li>
        <li>⚖️ 法律 / 医学 <b>AAA/A</b></li>
        <li>⚙️ 工程相对友好</li>
        <li><a href="/university/degrees/?uni=nus">查全部 NUS 专业 →</a></li>
      </ul></div>
      <div class="sidebar-card"><h3>🔗 官方信息</h3><ul>
        <li>🌐 <a href="https://www.nus.edu.sg/" target="_blank" rel="nofollow noopener">nus.edu.sg 官网</a></li>
        <li>📍 21 Lower Kent Ridge Road</li>
        <li>📅 申请：10 月–次年 2/3 月</li>
      </ul></div>
      <div class="sidebar-card"><h3>6 所公立大学</h3><ul>
        <li><a href="/university/nus/">NUS 新加坡国立</a></li>
        <li><a href="/university/ntu/">NTU 南洋理工</a></li>
        <li><a href="/university/smu/">SMU 新加坡管理</a></li>
        <li><a href="/university/sutd/">SUTD 科技设计</a></li>
        <li><a href="/university/sit/">SIT 新加坡理工大学</a></li>
        <li><a href="/university/suss/">SUSS 新跃社科</a></li>
      </ul></div>
    </aside>
  </div>
</main>
{FOOTER}
<script src="/seda-site.js?v=28"></script>
</body>
</html>'''

open(os.path.join(ROOT,"university/nus/index.html"),"w",encoding="utf-8").write(HTML)
print("wrote university/nus/index.html | bytes:",len(HTML))
