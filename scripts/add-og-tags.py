#!/usr/bin/env python3
"""Batch-inject OG tags into pages that are missing them."""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_URL = "https://sgeda.org.cn"
DEFAULT_IMAGE = f"{BASE_URL}/assets/hero-mbs-day3.jpg"
SKIP_DIRS = {"node_modules", ".git", "cms", "content-review"}

def get_tag(html, pattern):
    m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else ""

def html_path_to_url(filepath):
    rel = os.path.relpath(filepath, ROOT)
    parts = rel.replace("\\", "/").split("/")
    # e.g. primary-schools/foo/index.html → /primary-schools/foo/
    if parts[-1] == "index.html":
        parts = parts[:-1]
    return BASE_URL + "/" + "/".join(parts) + ("/" if parts else "")

def build_og_block(title, desc, url, image):
    esc = lambda s: s.replace("&", "&amp;").replace('"', "&quot;")
    lines = [
        f'  <meta property="og:type" content="article" />',
        f'  <meta property="og:locale" content="zh_CN" />',
        f'  <meta property="og:site_name" content="SEDA 新加坡择校网" />',
        f'  <meta property="og:title" content="{esc(title)}" />',
        f'  <meta property="og:description" content="{esc(desc)}" />',
        f'  <meta property="og:url" content="{esc(url)}" />',
        f'  <meta property="og:image" content="{esc(image)}" />',
        f'  <meta property="og:image:width" content="1200" />',
        f'  <meta property="og:image:height" content="630" />',
    ]
    return "\n".join(lines)

def process(filepath):
    with open(filepath, encoding="utf-8") as f:
        html = f.read()

    if 'og:title' in html:
        return False  # already has OG

    title = get_tag(html, r'<title>([^<]+)</title>')
    desc  = get_tag(html, r'<meta\s+name="description"\s+content="([^"]+)"')
    canon = get_tag(html, r'<link\s+rel="canonical"\s+href="([^"]+)"')

    if not title:
        return False

    url   = canon if canon else html_path_to_url(filepath)
    desc  = desc if desc else title

    og_block = build_og_block(title, desc, url, DEFAULT_IMAGE)

    # Insert after canonical if present, else after charset meta
    if 'rel="canonical"' in html:
        html = re.sub(
            r'(<link\s+rel="canonical"[^>]*/?>)',
            r'\1\n' + og_block,
            html, count=1
        )
    else:
        html = re.sub(
            r'(<meta\s+charset[^>]*/?>)',
            r'\1\n' + og_block,
            html, count=1, flags=re.IGNORECASE
        )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    return True

count = 0
skipped = 0
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fname in filenames:
        if fname == "index.html":
            fp = os.path.join(dirpath, fname)
            result = process(fp)
            if result:
                count += 1
                rel = os.path.relpath(fp, ROOT)
                if count <= 20 or count % 50 == 0:
                    print(f"  ✓ {rel}")
            else:
                skipped += 1

print(f"\n完成：新增 OG 标签 {count} 个页面，已有/跳过 {skipped} 个")
