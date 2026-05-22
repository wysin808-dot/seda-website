#!/usr/bin/env python3
"""
Generate presentation-mode versions of SEDA AI tools.
Strips site navigation, SEO meta, FAQ, CTA, footer.
Adds minimal brand header for consultant demos.
"""

import re
import os

TOOLS = [
    {
        "src": "../pathway/university-matcher/index.html",
        "dest": "university-matcher.html",
        "title": "AI 大学匹配 — 新加坡公立大学",
        "icon": "🎯",
        "desc": "输入成绩，匹配 NUS NTU SMU 录取概率",
        "category": "sg"
    },
    {
        "src": "../pathway/study-planner/index.html",
        "dest": "study-planner.html",
        "title": "AI 升学规划 — 新加坡",
        "icon": "📋",
        "desc": "选目标大学+年级，生成个性化留学时间表",
        "category": "sg"
    },
    {
        "src": "../pathway/poly-matcher/index.html",
        "dest": "poly-matcher.html",
        "title": "AI Poly 匹配 — O-Level → 理工学院",
        "icon": "📐",
        "desc": "O-Level 成绩计算 ELR2B2，匹配理工学院课程",
        "category": "sg"
    },
    {
        "src": "../aeis/grade-checker/index.html",
        "dest": "aeis-grade-checker.html",
        "title": "AEIS 年级测算",
        "icon": "📊",
        "desc": "输入出生日期，查看可报考 AEIS/S-AEIS 年级",
        "category": "sg"
    },
    {
        "src": "../hk-university/matcher/index.html",
        "dest": "hk-matcher.html",
        "title": "AI 大学匹配 — 香港八大",
        "icon": "🇭🇰",
        "desc": "输入成绩，匹配香港八大名校录取概率",
        "category": "hk"
    },
    {
        "src": "../hk-university/planner/index.html",
        "dest": "hk-planner.html",
        "title": "AI 升学规划 — 香港",
        "icon": "🗓️",
        "desc": "量身定制香港大学申请方案与时间表",
        "category": "hk"
    },
    {
        "src": "../au-university/matcher/index.html",
        "dest": "au-matcher.html",
        "title": "AI 大学匹配 — 澳洲 Go8 + 名校",
        "icon": "🦘",
        "desc": "输入成绩，匹配澳洲八大及 UTS、RMIT 共 10 所名校",
        "category": "au"
    },
    {
        "src": "../au-university/planner/index.html",
        "dest": "au-planner.html",
        "title": "AI 升学规划 — 澳洲",
        "icon": "🗺️",
        "desc": "量身定制澳洲大学申请方案，含 7 大升学路径",
        "category": "au"
    },
]

PRESENT_HEADER = '''<header class="present-header">
  <div class="present-header-inner">
    <div class="present-brand">
      <span class="present-brand-word">SEDA</span>
      <span class="present-brand-sub">新加坡国际教育中心</span>
    </div>
    <a href="/tools/" class="present-back">← 全部工具</a>
  </div>
</header>'''

PRESENT_FOOTER = '''<footer class="present-footer">
  <p>SEDA 新加坡国际教育中心 &copy; 2024–2026 &nbsp;|&nbsp; <a href="/tools/">返回工具列表</a></p>
</footer>'''

PRESENT_CSS = '''
    /* ── Presentation Mode Overrides ── */
    .present-header {
      background: #fff;
      border-bottom: 2px solid #c62828;
      position: sticky; top: 0; z-index: 100;
    }
    .present-header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px clamp(20px, 6vw, 80px);
      max-width: 1400px;
      margin: 0 auto;
    }
    .present-brand {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .present-brand-word {
      font-size: 24px;
      font-weight: 900;
      color: #c62828;
      letter-spacing: -0.5px;
    }
    .present-brand-sub {
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
    }
    .present-back {
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      text-decoration: none;
    }
    .present-back:hover { color: #c62828; }
    .present-footer {
      border-top: 1px solid #e5e7eb;
      padding: 20px clamp(20px, 6vw, 80px);
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .present-footer a { color: #c62828; text-decoration: none; }
    .present-footer a:hover { text-decoration: underline; }
    /* Hide breadcrumb in present mode */
    .breadcrumb { display: none !important; }
    /* Hide lead overlay in present mode */
    .lead-overlay, #leadOverlay { display: none !important; }
    /* Hide CTA sections that regex may have missed */
    .cta-section { display: none !important; }
    /* Hide nav-cta if somehow still present */
    .nav-cta { display: none !important; }
'''

def process_tool(tool):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    src_path = os.path.join(script_dir, tool["src"])
    dest_path = os.path.join(script_dir, tool["dest"])

    with open(src_path, "r", encoding="utf-8") as f:
        html = f.read()

    # 1. Replace <title>
    html = re.sub(r'<title>[^<]*</title>', f'<title>{tool["title"]} | SEDA 顾问工具</title>', html)

    # 2. Remove all JSON-LD scripts
    html = re.sub(r'\s*<script type="application/ld\+json">[\s\S]*?</script>', '', html)

    # 3. Remove canonical link
    html = re.sub(r'\s*<link rel="canonical"[^>]*/>', '', html)

    # 4. Remove meta keywords
    html = re.sub(r'\s*<meta name="keywords"[^>]*/>', '', html)

    # 5. Simplify meta description
    html = re.sub(
        r'<meta name="description"[^>]*/>',
        f'<meta name="description" content="{tool["desc"]}" />',
        html
    )

    # 6. Add robots noindex (presentation pages shouldn't be indexed)
    html = html.replace(
        '<meta name="viewport"',
        '<meta name="robots" content="noindex, nofollow" />\n  <meta name="viewport"'
    )

    # 7. Inject presentation CSS before </style>
    html = html.replace('</style>', PRESENT_CSS + '\n  </style>', 1)

    # 8. Replace header (everything from <header to </header>)
    html = re.sub(
        r'<header class="site-header">[\s\S]*?</header>',
        PRESENT_HEADER,
        html,
        count=1
    )

    # 9. Remove breadcrumb nav
    html = re.sub(r'\s*<nav class="breadcrumb">[\s\S]*?</nav>', '', html)

    # 10. Remove CTA section (multiple patterns)
    # Pattern: <div class="cta-section"> ... </div>
    html = re.sub(r'\s*<div class="cta-section">[\s\S]*?</div>\s*(?=\s*</main>|<footer)', '', html)
    # Pattern: <section class="cta-...">
    html = re.sub(r'\s*<section class="cta[^"]*">[\s\S]*?</section>', '', html)

    # 11. Remove FAQ section (tool-faq class)
    html = re.sub(r'\s*<div class="tool-faq">[\s\S]*?</div>\s*(?=\s*<div class="(?:disclaimer|cta)|</main>|<footer)', '', html)
    # Also pattern: <section class="faq-section">
    html = re.sub(r'\s*<section class="faq-section">[\s\S]*?</section>', '', html)

    # 12. Remove lead overlay / lead capture forms
    html = re.sub(r'\s*<div id="leadOverlay"[\s\S]*?</div>\s*</div>\s*</div>', '', html)

    # 13. In JS, bypass lead capture - set _leadCaptured to true
    html = html.replace("let _leadCaptured=false;", "let _leadCaptured=true;")
    html = html.replace("let _leadCaptured = false;", "let _leadCaptured = true;")

    # 14. Replace footer
    html = re.sub(
        r'<footer class="site-footer">[\s\S]*?</footer>',
        PRESENT_FOOTER,
        html
    )

    # 15. Remove seda-site.js reference (not needed, nav logic not needed)
    html = re.sub(r'\s*<script src="/seda-site\.js"[^>]*></script>', '', html)

    # 16. Remove seda-site.css only if the page defines its own :root (fully self-contained)
    # Pages WITHOUT :root depend on seda-site.css for CSS variables (--brand, --wash, etc.)
    if ':root' in html:
        html = re.sub(r'\s*<link rel="stylesheet" href="/seda-site\.css"\s*/>', '', html)

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"  ✅ {tool['dest']} ({len(html):,} chars)")


def build_hub():
    """Build the /tools/index.html hub page."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dest_path = os.path.join(script_dir, "index.html")

    sg_tools = [t for t in TOOLS if t["category"] == "sg"]
    hk_tools = [t for t in TOOLS if t["category"] == "hk"]
    au_tools = [t for t in TOOLS if t["category"] == "au"]

    def tool_card(t):
        return f'''      <a href="/tools/{t["dest"]}" class="tool-card">
        <span class="tool-icon">{t["icon"]}</span>
        <div class="tool-info">
          <div class="tool-name">{t["title"]}</div>
          <div class="tool-desc">{t["desc"]}</div>
        </div>
        <span class="tool-arrow">→</span>
      </a>'''

    hub_html = f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>AI 升学工具合集 | SEDA 顾问工具</title>
  <meta name="description" content="SEDA 新加坡国际教育中心 AI 升学工具集合，包含大学匹配、升学规划、Poly 匹配、AEIS 年级测算等。" />
  <style>
    :root {{
      --brand: #c62828;
      --brand-light: #fca5a5;
      --ink: #1a1a2e;
      --muted: #6b7280;
      --wash: #f8f9fa;
      --line: #e5e7eb;
      --radius: 16px;
      --shadow: 0 2px 12px rgba(0,0,0,0.06);
      --shadow-lg: 0 8px 32px rgba(0,0,0,0.10);
    }}
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
      color: var(--ink); background: #fff; line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }}
    a {{ color: var(--brand); text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}

    .present-header {{
      background: #fff;
      border-bottom: 2px solid var(--brand);
      position: sticky; top: 0; z-index: 100;
    }}
    .present-header-inner {{
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px clamp(20px, 6vw, 80px);
      max-width: 1200px; margin: 0 auto;
    }}
    .present-brand {{
      display: flex; align-items: baseline; gap: 10px;
    }}
    .present-brand-word {{
      font-size: 24px; font-weight: 900; color: var(--brand); letter-spacing: -0.5px;
    }}
    .present-brand-sub {{
      font-size: 13px; font-weight: 600; color: var(--muted);
    }}
    .present-back {{
      font-size: 13px; font-weight: 600;
      color: var(--muted); text-decoration: none;
    }}
    .present-back:hover {{ color: var(--brand); }}

    .hub-hero {{
      background: linear-gradient(135deg, #2a1215 0%, #1a0a0c 100%);
      color: #fff;
      padding: 60px clamp(20px, 6vw, 80px) 52px;
      text-align: center;
    }}
    .hub-hero h1 {{
      font-size: clamp(28px, 5vw, 44px);
      font-weight: 800;
      margin-bottom: 16px;
    }}
    .hub-hero h1 em {{ font-style: normal; color: var(--brand-light); }}
    .hub-hero p {{
      font-size: 16px;
      color: rgba(255,255,255,0.65);
      max-width: 520px;
      margin: 0 auto;
    }}

    .hub-section {{
      max-width: 900px;
      margin: 0 auto;
      padding: 40px clamp(20px, 6vw, 80px) 20px;
    }}
    .hub-section h2 {{
      font-size: 20px; font-weight: 800;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--brand);
    }}
    .hub-section h2 em {{ font-style: normal; color: var(--brand); }}

    .tool-list {{
      display: grid;
      gap: 12px;
      margin-bottom: 32px;
    }}
    .tool-card {{
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      background: #fff;
      border: 1.5px solid var(--line);
      border-radius: 12px;
      transition: all 0.2s;
      text-decoration: none;
      color: var(--ink);
    }}
    .tool-card:hover {{
      border-color: var(--brand-light);
      box-shadow: var(--shadow);
      transform: translateY(-2px);
      text-decoration: none;
    }}
    .tool-icon {{
      font-size: 32px;
      flex-shrink: 0;
      width: 56px; height: 56px;
      display: flex; align-items: center; justify-content: center;
      background: var(--wash);
      border-radius: 12px;
    }}
    .tool-info {{ flex: 1; min-width: 0; }}
    .tool-name {{
      font-size: 17px; font-weight: 700;
      margin-bottom: 4px;
    }}
    .tool-desc {{
      font-size: 13px; color: var(--muted);
    }}
    .tool-arrow {{
      font-size: 20px;
      color: var(--muted);
      flex-shrink: 0;
      transition: transform 0.2s;
    }}
    .tool-card:hover .tool-arrow {{
      transform: translateX(4px);
      color: var(--brand);
    }}

    .present-footer {{
      border-top: 1px solid var(--line);
      padding: 24px clamp(20px, 6vw, 80px);
      text-align: center;
      font-size: 12px;
      color: var(--muted);
    }}

    @media (max-width: 640px) {{
      .tool-card {{ padding: 16px; gap: 12px; }}
      .tool-icon {{ width: 44px; height: 44px; font-size: 24px; }}
      .tool-name {{ font-size: 15px; }}
      .present-back {{ display: none; }}
    }}
  </style>
</head>
<body>

{PRESENT_HEADER}

<div class="hub-hero">
  <h1>SEDA <em>AI 升学工具</em></h1>
  <p>AI 驱动的升学分析工具，助你找到最适合的学校与路径</p>
</div>

<div class="hub-section">
  <h2>🇸🇬 新加坡 <em>升学工具</em></h2>
  <div class="tool-list">
{chr(10).join(tool_card(t) for t in sg_tools)}
  </div>
</div>

<div class="hub-section">
  <h2>🇭🇰 香港 <em>升学工具</em></h2>
  <div class="tool-list">
{chr(10).join(tool_card(t) for t in hk_tools)}
  </div>
</div>

<div class="hub-section">
  <h2>🇦🇺 澳洲 <em>升学工具</em></h2>
  <div class="tool-list">
{chr(10).join(tool_card(t) for t in au_tools)}
  </div>
</div>

<footer class="present-footer">
  <p>SEDA 新加坡国际教育中心 &copy; 2024–2026</p>
</footer>

</body>
</html>'''

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(hub_html)
    print(f"  ✅ index.html (hub page, {len(hub_html):,} chars)")


if __name__ == "__main__":
    print("Building presentation-mode AI tools...")
    print()
    build_hub()
    for tool in TOOLS:
        process_tool(tool)
    print()
    print(f"Done! {len(TOOLS) + 1} files written to /tools/")
