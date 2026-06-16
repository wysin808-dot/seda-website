# -*- coding: utf-8 -*-
"""Build a premium, custom /university/nus/ page — distinct upscale design (navy + gold,
editorial layout), NOT the poly template. Daytime panorama hero. Reuses only site header/footer."""
import os, json, re, html
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP=open(os.path.join(ROOT,"poly/sp/index.html"),encoding="utf-8").read()
HEADER=SP[SP.index('<header class="site-header">'):SP.index('</header>')+len('</header>')]
FOOTER=SP[SP.index('<footer class="site-footer">'):SP.index('</footer>')+len('</footer>')]
def esc(s): return html.escape(str(s),quote=True)

CSS=r'''
.nx{--navy:#0d2240;--navy2:#17386a;--gold:#c8a24a;--ink:#16202e;--mut:#5d6b7e;--line:#e6eaf0;--bg:#f7f9fc;color:var(--ink);background:#fff}
.nx *{box-sizing:border-box}
.nx-hero{position:relative;min-height:clamp(340px,44vw,480px);display:flex;align-items:flex-end;background-size:cover;background-position:center;color:#fff}
.nx-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,18,38,.28) 0%,rgba(8,18,38,.55) 55%,rgba(8,18,38,.82) 100%)}
.nx-hero .in{position:relative;z-index:2;max-width:1160px;margin:0 auto;width:100%;padding:0 clamp(20px,6vw,72px) clamp(30px,4vw,48px)}
.nx-kicker{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:16px}
.nx-kicker span{font-size:.8rem;font-weight:700;letter-spacing:.02em;padding:5px 13px;border:1px solid rgba(255,255,255,.4);border-radius:999px;background:rgba(255,255,255,.08);backdrop-filter:blur(3px)}
.nx-kicker .au{border-color:var(--gold);color:#ffe9b8}
.nx-hero h1{font-size:clamp(30px,4.6vw,52px);line-height:1.12;margin:0 0 12px;font-weight:850;letter-spacing:-.01em;text-shadow:0 2px 16px rgba(0,0,0,.3)}
.nx-hero .sub{font-size:clamp(15px,1.7vw,19px);color:rgba(255,255,255,.92);max-width:720px;margin:0;line-height:1.6}
.nx-hero .rule{width:64px;height:3px;background:var(--gold);border-radius:2px;margin:0 0 18px}

.nx-stats{background:var(--navy);color:#fff}
.nx-stats .in{max-width:1160px;margin:0 auto;padding:26px clamp(20px,6vw,72px);display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.nx-stat{text-align:center;padding:6px 4px;position:relative}
.nx-stat+.nx-stat::before{content:"";position:absolute;left:0;top:18%;height:64%;width:1px;background:rgba(200,162,74,.4)}
.nx-stat .n{font-size:clamp(22px,2.6vw,30px);font-weight:850;color:var(--gold);line-height:1}
.nx-stat .l{font-size:.78rem;color:rgba(255,255,255,.78);margin-top:6px;letter-spacing:.02em}

.nx-wrap{max-width:1080px;margin:0 auto;padding:0 clamp(20px,6vw,72px)}
.nx-sec{padding:clamp(40px,5vw,60px) 0;border-top:1px solid var(--line)}
.nx-sec:first-of-type{border-top:0}
.nx-h2{font-size:clamp(23px,3vw,32px);font-weight:820;color:var(--navy);margin:0 0 8px;letter-spacing:-.01em;display:flex;align-items:center;gap:12px}
.nx-h2::before{content:"";width:26px;height:3px;background:var(--gold);border-radius:2px;flex:0 0 auto}
.nx-lead{color:var(--mut);font-size:1.04rem;line-height:1.85;margin:0 0 8px;max-width:760px}
.nx-lead a{color:var(--navy2);font-weight:700;border-bottom:1px solid #c7d3e6}

.nx-tldr{display:flex;gap:16px;background:linear-gradient(120deg,#fbf7ec,#fff 70%);border:1px solid #ecdfc2;border-radius:16px;padding:22px 26px;font-size:1.06rem;line-height:1.8;color:var(--ink)}
.nx-tldr .q{font-size:2.4rem;line-height:1;color:var(--gold);font-family:Georgia,serif}
.nx-tldr b{color:var(--navy2)}

.nx-feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(232px,1fr));gap:18px;margin-top:24px}
.nx-fcard{padding:22px;border:1px solid var(--line);border-radius:16px;background:#fff;transition:box-shadow .2s,transform .2s}
.nx-fcard:hover{box-shadow:0 18px 40px rgba(13,34,64,.09);transform:translateY(-3px)}
.nx-fcard .ic{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:13px}
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
.nx-pcard .hot{font-size:.66rem;font-weight:800;color:var(--navy);background:var(--gold);padding:2px 8px;border-radius:999px}
.nx-pcard p{margin:0;font-size:.88rem;color:var(--mut);line-height:1.6}
.nx-pcard .cop{margin-top:11px;padding-top:10px;border-top:1px dashed var(--line);font-size:.84rem;color:var(--ink)}
.nx-pcard .cop b{color:var(--navy2)}

.nx-routes{display:grid;grid-template-columns:repeat(auto-fit,minmax(244px,1fr));gap:15px;margin-top:22px}
.nx-rcard{border:1px solid var(--line);border-radius:14px;padding:17px 19px;background:#fff}
.nx-rcard.lead{background:linear-gradient(135deg,var(--navy),var(--navy2));border-color:var(--navy)}
.nx-rcard.lead *{color:#fff}
.nx-rcard .h{display:flex;align-items:center;gap:9px;font-weight:800;color:var(--ink);margin-bottom:6px}
.nx-rcard .h .fl{font-size:1.3rem}
.nx-rcard.lead .badge{font-size:.66rem;font-weight:800;color:var(--navy);background:var(--gold);padding:2px 8px;border-radius:999px;margin-left:auto}
.nx-rcard p{margin:0;font-size:.88rem;color:var(--mut);line-height:1.6}
.nx-rcard.lead p{color:rgba(255,255,255,.9)}
.nx-rcard.lead b{color:#ffe9b8}

.nx-fees{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:22px}
.nx-fee{border:1px solid var(--line);border-radius:15px;padding:20px;text-align:center;background:#fff;position:relative}
.nx-fee.hl{border-color:var(--gold);box-shadow:0 14px 36px rgba(200,162,74,.16)}
.nx-fee .tag{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--gold);color:var(--navy);font-size:.7rem;font-weight:800;padding:3px 12px;border-radius:999px;white-space:nowrap}
.nx-fee .who{font-size:.82rem;color:var(--mut);margin:0 0 6px}
.nx-fee .price{font-size:1.5rem;font-weight:850;color:var(--navy);margin:0}
.nx-fee .note{font-size:.78rem;color:var(--mut);margin:6px 0 0}

.nx-fit{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
.nx-fb{border-radius:15px;padding:20px 22px;border:1px solid var(--line)}
.nx-fb.y{background:linear-gradient(135deg,#f0f6ff,#fff);border-color:#cfe0f5}
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
.nx-cta a{background:var(--gold);color:var(--navy);font-weight:800;padding:13px 26px;border-radius:11px;text-decoration:none;white-space:nowrap}
.nx-prose p{color:#3a4658;font-size:1.05rem;line-height:1.95;margin:0 0 16px;max-width:820px}
.nx-prose p b{color:var(--navy2)}
.nx-rank{margin-top:24px;background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:18px;padding:28px clamp(20px,4vw,34px);color:#fff}
.nx-rank .big{display:flex;flex-wrap:wrap;gap:28px;margin-bottom:18px}
.nx-rank .big .it{flex:0 0 auto}
.nx-rank .big .n{font-size:2.6rem;font-weight:850;color:var(--gold);line-height:1}
.nx-rank .big .l{font-size:.86rem;color:rgba(255,255,255,.82);margin-top:4px}
.nx-rank .subs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px 18px;border-top:1px solid rgba(200,162,74,.35);padding-top:16px}
.nx-rank .subs .s{font-size:.92rem;color:rgba(255,255,255,.92);display:flex;justify-content:space-between;gap:10px}
.nx-rank .subs .s b{color:var(--gold);white-space:nowrap}
.nx-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}
.nx-chips span{font-size:.9rem;color:var(--ink);background:#fff;border:1px solid var(--line);padding:9px 15px;border-radius:11px}
.nx-chips span b{color:var(--navy2);font-weight:700}
.nx-camp{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:22px}
.nx-cc{border:1px solid var(--line);border-radius:15px;padding:18px 20px;background:#fff;border-top:3px solid var(--navy2)}
.nx-cc h3{margin:0 0 5px;font-size:1.05rem;color:var(--navy)}
.nx-cc .en{font-size:.78rem;color:var(--mut);margin:0 0 8px}
.nx-cc p{margin:0;font-size:.9rem;color:var(--mut);line-height:1.6}
@media(max-width:640px){.nx-fit{grid-template-columns:1fr}.nx-stat+.nx-stat::before{display:none}}
'''

faqs=[
 ("高考多少分能进 NUS？","NUS 接受中国高考成绩，但门槛很高——通常要求<b>远超当地一本线/特控线</b>（计算机、商科、医学更高），并看英文单科；英文不够会要求雅思/托福。高考过线只是入门，最终按全体国际申请者择优录取。"),
 ("NUS 接受高考申请吗？需要什么？","接受。中国学生可凭高考直接申请，需提交高考总分与单科（尤其英文/数学），部分专业有附加要求或面试。同时也接受 A-Level、IB、WACE/ATAR 和新加坡理工 Diploma。"),
 ("NUS 国际学生一年学费多少？","申请 MOE 学费津贴后，国际学生约每年 <b>S$20,000–39,200</b>（按专业，医学/牙医更高），需签<b>毕业后在新加坡工作 3 年</b>的服务协议；不申请津贴则更高。另需预算住宿与生活费。"),
 ("NUS 世界排名怎么样？","NUS 是新加坡综合排名最高的大学，QS 世界排名长期稳居<b>前 10（2025 年第 8）</b>，亚洲第一梯队，法律、计算机、商业分析、工程、医学等多个学科全球领先。"),
 ("NUS 最强 / 最热门的专业是哪些？","计算机科学、商业分析、商业人工智能系统、医学、法律、工商管理、药学都是录取分最高的一档。具体每个专业的 A-Level / 理工 GPA 录取线见<a href='/university/degrees/?uni=nus'>大学专业录取分数据库</a>。"),
 ("理工 Diploma 毕业能进 NUS 吗？","能。NUS 收理工生，按 GPA 竞争，多数专业 IGP 的理工 GPA 区间在 <b>3.6–3.9</b>（满分 4.0），热门专业接近 3.9+。先在<a href='/poly/courses/'>理工专业数据库</a>选对 Diploma，再用 GPA 升 NUS。"),
 ("NUS 校园在哪？住宿怎么样？","主校区在 <b>Kent Ridge（肯特岗）</b>，西部地铁可达；法学院在 Bukit Timah。住宿有 13 所 Hall / Residential College，加上现代化的 University Town（UTown）书院制社区，校园生活丰富。"),
 ("NUS 有奖学金吗？","有。面向国际学生有 ASEAN 及各类入学奖学金，覆盖学费甚至生活费，竞争激烈、需单独申请，看成绩 + 综合表现。"),
 ("NUS 和 NTU 怎么选？","NUS 综合更全、文社科与医法更强、综合排名略高；NTU 工程与计算机全球顶尖、校园更大更新。法律/医学/商科/文社科偏 NUS，纯工程/材料/通信可重点看 NTU。两校都可用同一套高考/A-Level/GPA 申请。"),
 ("NUS 申请时间线是怎样的？","国际本科一般在每年 10 月–次年 2/3 月开放申请（高考生通常在出分后补交成绩），8 月入学。建议提前 1 年准备成绩、英文、文书与奖学金申请。"),
]
faqld={"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":re.sub('<[^>]+>','',a)}} for q,a in faqs]}
collegeld={"@context":"https://schema.org","@type":"CollegeOrUniversity","name":"新加坡国立大学","alternateName":"National University of Singapore","url":"https://sgeda.org.cn/university/nus/","sameAs":"https://www.nus.edu.sg/","foundingDate":"1905","address":{"@type":"PostalAddress","addressLocality":"Kent Ridge","addressCountry":"SG"},"description":"新加坡历史最久、综合排名最高的公立大学，QS 世界排名前 10。接受中国高考、A-Level、IB、WACE 及理工 Diploma 申请。","inLanguage":"zh-CN"}
breadld={"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"首页","item":"https://sgeda.org.cn/"},{"@type":"ListItem","position":2,"name":"新加坡大学","item":"https://sgeda.org.cn/university/"},{"@type":"ListItem","position":3,"name":"新加坡国立大学"}]}
jsonld="\n".join('<script type="application/ld+json">%s</script>'%json.dumps(j,ensure_ascii=False,separators=(",",":")) for j in [collegeld,breadld,faqld])
faqhtml="".join(f'<details><summary>{esc(q)}</summary><div class="a">{a}</div></details>' for q,a in faqs)

BODY=f'''<div class="nx">
  <section class="nx-hero" style="background-image:url('/assets/nus-hero.jpg')"><div class="in">
    <div class="nx-kicker"><span class="au">🏆 QS 世界排名 #8</span><span>🇸🇬 新加坡综合第一</span><span>📅 1905 年创办</span></div>
    <div class="rule"></div>
    <h1>新加坡国立大学 NUS</h1>
    <p class="sub">新加坡历史最久、综合排名最高的公立大学 —— 法律、医学、计算机、商科全面顶尖，接受中国高考申请。</p>
  </div></section>
  <div class="nx-stats"><div class="in">
    <div class="nx-stat"><div class="n">#8</div><div class="l">QS 世界排名</div></div>
    <div class="nx-stat"><div class="n">1905</div><div class="l">创办年份</div></div>
    <div class="nx-stat"><div class="n">17</div><div class="l">学院 / 学部</div></div>
    <div class="nx-stat"><div class="n">38k</div><div class="l">在校学生</div></div>
    <div class="nx-stat"><div class="n">✓</div><div class="l">接受中国高考</div></div>
  </div></div>

  <div class="nx-wrap">
    <section class="nx-sec">
      <div class="nx-tldr"><span class="q">“</span><div>一句话看懂：<b>NUS 是新加坡的「清北」</b>——综合排名最高、QS 世界前 10，文理工商医法全面顶尖。中国学生可凭<b>高考、A-Level、IB、WACE 或理工 Diploma</b> 申请，门槛高、竞争激烈，是冲顶学霸的首选。</div></div>
    </section>

    <section class="nx-sec nx-prose">
      <h2 class="nx-h2">学校概况</h2>
      <p>新加坡国立大学（National University of Singapore，NUS）是新加坡的<b>旗舰学府</b>，历史可追溯到 <b>1905 年</b>创办的海峡殖民地政府医学院；<b>1980 年 8 月</b>由新加坡大学与南洋大学合并，正式成立今天的 NUS。经过百余年发展，它已是新加坡<b>学科最齐全、综合排名最高</b>的研究型大学——QS 世界排名长期稳居前 10（2025 年第 8），常年位居亚洲第一梯队。</p>
      <p>全校设 <b>16 个学院 / 学部</b>、开设 50 多个本科主修，分布在 <b>Kent Ridge（肯特岗主校区）、Bukit Timah（法学院与李光耀公共政策学院）、Outram（杜克-NUS 医学院）</b>三大校区，在校学生约 <b>3.8 万</b>。从法律、医学、计算机、商科，到工程、设计、人文社科，NUS 几乎在每一个领域都处于全国乃至亚洲顶尖。</p>
      <p>对中国学生而言，NUS 是除清北复交之外<b>最具吸引力的亚洲名校之一</b>：接受高考直申、文凭全球认可、地处全英文环境又离家近、毕业生就业力位列全球前茅。</p>
      <div class="nx-rank">
        <div class="big">
          <div class="it"><div class="n">28</div><div class="l">个学科全球前 10<br><span style="font-size:.75rem;opacity:.7">QS 2026 学科排名</span></div></div>
          <div class="it"><div class="n">7</div><div class="l">个学科全球前 3</div></div>
          <div class="it"><div class="n">#8</div><div class="l">QS 世界综合排名</div></div>
        </div>
        <div class="subs">
          <div class="s"><span>艺术史 Art History</span><b>全球 #2</b></div>
          <div class="s"><span>土木与结构工程</span><b>全球 #3</b></div>
          <div class="s"><span>社会政策与管理</span><b>全球 #3</b></div>
          <div class="s"><span>计算机科学与信息系统</span><b>全球 #4</b></div>
          <div class="s"><span>电气与电子工程</span><b>全球 #4</b></div>
          <div class="s"><span>化学工程</span><b>全球 #4</b></div>
        </div>
      </div>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">为什么是 NUS</h2>
      <p class="nx-lead">不是「之一」，而是新加坡综合实力的天花板。</p>
      <div class="nx-feat">
        <div class="nx-fcard"><div class="ic">🏆</div><h3>世界前 10</h3><p>QS 2025 世界第 8，亚洲第一梯队，文凭全球认可，毕业生就业力榜单常年前列。</p></div>
        <div class="nx-fcard"><div class="ic">📚</div><h3>综合最强</h3><p>法律、医学、计算机、商业分析、商科、工程全部亚洲 / 全球顶尖，选择面最广。</p></div>
        <div class="nx-fcard"><div class="ic">🏛️</div><h3>书院制社区</h3><p>13 所 Hall / Residential College + 现代化 University Town（UTown），人脉与资源丰富。</p></div>
        <div class="nx-fcard"><div class="ic">🇨🇳</div><h3>接受高考</h3><p>高考生有专门申请通道，无需再考 A-Level 也能冲顶尖名校。</p></div>
        <div class="nx-fcard"><div class="ic">💼</div><h3>就业力顶尖</h3><p>QS 毕业生就业力榜单常年全球前列，雇主认可度高，本地与跨国名企争相招聘。</p></div>
        <div class="nx-fcard"><div class="ic">💰</div><h3>性价比高</h3><p>世界前 10 名校，申请学费津贴后约 S$20k–39k/年，远低于英美顶校，且离家近、环境安全。</p></div>
      </div>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">16 个学院 / 学部</h2>
      <p class="nx-lead">NUS 学科覆盖几乎所有领域，主要学院 / 学部如下：</p>
      <div class="nx-chips">
        <span>📖 <b>文学暨社会科学院</b> FASS</span><span>💼 <b>商学院</b> NUS Business School</span><span>💻 <b>计算机学院</b> School of Computing</span><span>⚙️ <b>设计与工程学院</b> CDE</span><span>⚖️ <b>法学院</b> Faculty of Law</span><span>🩺 <b>杨潞龄医学院</b> YLL Medicine</span><span>🦷 <b>牙科学院</b> Dentistry</span><span>🧪 <b>理学院</b> Faculty of Science</span><span>🎼 <b>杨秀桃音乐学院</b> YST</span><span>🏛️ <b>李光耀公共政策学院</b> LKYSPP</span><span>🩹 <b>公共卫生学院</b> SSHSPH</span><span>🎓 <b>NUS College</b> 荣誉书院</span><span>🔬 <b>杜克-NUS 医学院</b>（研究生）</span><span>🌐 <b>持续教育学院</b> SCALE</span>
      </div>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">王牌与热门专业</h2>
      <p class="nx-lead">录取分最高的一档集中在计算机、商科与医法。<a href="/university/degrees/?uni=nus">查全部 NUS 专业的 A-Level / 理工 GPA 录取分 →</a></p>
      <div class="nx-prog">
        <div class="nx-pcard"><div class="t"><span class="ic">💻</span><h3>计算机科学</h3><span class="hot">最热</span></div><p>School of Computing，全亚洲顶尖；含 AI、信息安全方向。</p><div class="cop">A-Level <b>AAA/A</b> · 理工 GPA <b>3.81–3.98</b></div></div>
        <div class="nx-pcard"><div class="t"><span class="ic">📊</span><h3>商业分析 / 商业 AI</h3><span class="hot">高薪</span></div><p>数据 + 商科交叉，就业极强，分数门槛顶格。</p><div class="cop">A-Level <b>AAA/A</b> · 理工 GPA <b>3.71–3.98</b></div></div>
        <div class="nx-pcard"><div class="t"><span class="ic">⚖️</span><h3>法律 Law</h3></div><p>全国最强法学院之一，录取近满分。</p><div class="cop">A-Level <b>AAA/A</b></div></div>
        <div class="nx-pcard"><div class="t"><span class="ic">🩺</span><h3>医学 Medicine</h3></div><p>杨潞龄医学院，五年制 MBBS，录取极难。</p><div class="cop">A-Level <b>AAA/A</b> · 理工 GPA <b>3.87–3.99</b></div></div>
        <div class="nx-pcard"><div class="t"><span class="ic">💼</span><h3>工商管理 Business</h3></div><p>NUS Business School，亚洲商学院第一梯队。</p><div class="cop">A-Level <b>AAA/C–AAA/A</b> · GPA <b>3.61–3.94</b></div></div>
        <div class="nx-pcard"><div class="t"><span class="ic">⚙️</span><h3>工程（大类）</h3></div><p>含机械、电子、生物医学等，名额多、相对友好。</p><div class="cop">A-Level <b>BBB/C–AAA/A</b> · GPA <b>3.57–3.94</b></div></div>
      </div>
      <figure class="nx-figure"><img src="/assets/nus-campus2.jpg" alt="NUS 计算机学院 COM2 大楼" loading="lazy" decoding="async" width="1200"><figcaption>NUS 计算机学院（School of Computing）—— 全亚洲顶尖</figcaption></figure>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">三大校区</h2>
      <div class="nx-camp">
        <div class="nx-cc"><h3>Kent Ridge 肯特岗</h3><p class="en">主校区</p><p>绝大多数学院所在地，以及 University Town（UTown）现代化书院社区；西部地铁 Kent Ridge 站可达。</p></div>
        <div class="nx-cc"><h3>Bukit Timah 武吉知马</h3><p class="en">法学院 · 公共政策</p><p>历史校园，法学院与李光耀公共政策学院（LKYSPP）所在地，环境优雅。</p></div>
        <div class="nx-cc"><h3>Outram 欧南</h3><p class="en">医学（研究生）</p><p>杜克-NUS 医学院所在地，临近新加坡中央医院与国家医学中心。</p></div>
      </div>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">特色项目与校园生活</h2>
      <div class="nx-feat">
        <div class="nx-fcard"><div class="ic">🌏</div><h3>海外学院 NOC</h3><p>NUS Overseas Colleges 把学生派到硅谷、上海、深圳等创业枢纽，边在初创公司实习边修课，创业基因浓厚。</p></div>
        <div class="nx-fcard"><div class="ic">🏘️</div><h3>住宿学院 + UTown</h3><p>13 所 Hall / Residential College 加现代化书院社区，跨学科住宿生活，社团与活动丰富。</p></div>
        <div class="nx-fcard"><div class="ic">🎓</div><h3>NUS College 荣誉书院</h3><p>整合原 USP 与 Yale-NUS，跨学科精英培养，小班研讨、全球游学。</p></div>
        <div class="nx-fcard"><div class="ic">🔁</div><h3>双学位 + 全球交换</h3><p>可修双学位 / 并行学位，并与全球顶尖大学广泛交换，国际化程度高。</p></div>
      </div>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">中国学生申请路径</h2>
      <p class="nx-lead">NUS 对中国学生开放多条通道，按你手上的成绩类型选。</p>
      <div class="nx-routes">
        <div class="nx-rcard lead"><div class="h"><span class="fl">🇨🇳</span>高考 Gaokao<span class="badge">中国学生主路</span></div><p>NUS 接受高考成绩，通常要求<b>远超一本线 / 特控线</b>，热门专业更高，看英文单科；英文不够需雅思 / 托福。</p></div>
        <div class="nx-rcard"><div class="h"><span class="fl">📘</span>A-Level / 国际 A-Level</div><p>按 IGP 成绩档竞争，多数专业 <b>AAA</b> 起；国际 A-Level（CIE/Edexcel）按等同评估。</p></div>
        <div class="nx-rcard"><div class="h"><span class="fl">🌐</span>IB 文凭</div><p>高分录取，热门专业一般 40+/45。</p></div>
        <div class="nx-rcard"><div class="h"><span class="fl">🇦🇺</span>WACE / ATAR</div><p>按 ATAR 综合评估，顶尖专业近满分；以官方为准。</p></div>
        <div class="nx-rcard"><div class="h"><span class="fl">🎓</span>理工 Diploma</div><p>凭 GPA 升学，多数专业 IGP GPA <b>3.6–3.9</b>。</p></div>
        <div class="nx-rcard"><div class="h"><span class="fl">🗣️</span>语言要求</div><p>英文非母语者一般需<b>雅思 / 托福</b>或同等成绩。</p></div>
      </div>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">学费参考 · 国际学生 / 每年</h2>
      <div class="nx-fees">
        <div class="nx-fee hl"><span class="tag">中国学生看这档</span><p class="who">申请 MOE 津贴后</p><p class="price">S$20,000–39,200</p><p class="note">按专业；签 3 年服务协议</p></div>
        <div class="nx-fee"><p class="who">医学 / 牙医</p><p class="price">更高</p><p class="note">专业学费另计</p></div>
        <div class="nx-fee"><p class="who">住宿 + 生活费</p><p class="price">另算</p><p class="note">Kent Ridge / UTown 宿舍</p></div>
      </div>
      <p class="nx-lead" style="margin-top:16px;font-size:.9rem">不申请津贴则更高；津贴需签毕业后在新加坡工作 3 年的服务协议。以 NUS / MOE 当年收费为准。</p>
      <figure class="nx-figure"><img src="/assets/nus-campus3.jpg" alt="NUS 理学院" loading="lazy" decoding="async" width="1200"><figcaption>NUS 理学院（Faculty of Science），肯特岗主校区</figcaption></figure>
    </section>

    <section class="nx-sec">
      <h2 class="nx-h2">适合谁</h2>
      <div class="nx-fit">
        <div class="nx-fb y"><h4>✅ 适合</h4><ul><li>成绩拔尖、目标世界名校的学霸</li><li>想要综合性大学的丰富资源与人脉</li><li>高考 / A-Level / IB 高分，或理工 GPA 3.7+</li><li>看重排名、就业力与海外交换机会</li></ul></div>
        <div class="nx-fb n"><h4>⚠️ 需谨慎</h4><ul><li>分数离顶尖还有距离 —— 可看 SMU / SUTD / SIT</li><li>想要小班、应用型、产业实战导向</li><li>英文还在过渡期，需先把语言补上</li></ul></div>
      </div>
    </section>

    <section class="nx-sec nx-faq">
      <h2 class="nx-h2">常见问题</h2>
      <div style="margin-top:20px">{faqhtml}</div>
      <div class="nx-cta">
        <div><h3>想知道你的分数能进 NUS 哪个专业？</h3><p>用大学专业录取分数据库，输入成绩看 NUS 各专业门槛。</p></div>
        <a href="/university/degrees/?uni=nus">查 NUS 专业录取分 →</a>
      </div>
      <div class="nx-rel"><a href="/university/">新加坡大学总览</a><a href="/university/degrees/">大学专业数据库</a><a href="/university/ntu/">南洋理工 NTU</a><a href="/poly/courses/">理工专业数据库</a><a href="/contact/">免费咨询</a></div>
    </section>
  </div>
</div>'''

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
<style>{CSS}</style>
</head>
<body>
{HEADER}
<main>
{BODY}
</main>
{FOOTER}
<script src="/seda-site.js?v=28"></script>
</body>
</html>'''
open(os.path.join(ROOT,"university/nus/index.html"),"w",encoding="utf-8").write(HTML)
print("wrote premium university/nus/index.html | bytes:",len(HTML))
