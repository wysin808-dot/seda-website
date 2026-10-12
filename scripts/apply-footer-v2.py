#!/usr/bin/env python3
"""把全站 index.html 的旧页脚统一替换为 Footer v2。"""
import re, glob

SITE = "/Users/ocean/Documents/seda-website"
SNIPPET = open(f"{SITE}/scripts/footer-snippet.html", encoding="utf-8").read().strip()

replaced, injected, skipped = 0, 0, []
for f in glob.glob(f"{SITE}/**/index.html", recursive=True):
    if "/node_modules/" in f or "/aeis_backup/" in f or f.endswith("cms/index.html"):
        continue
    h = open(f, encoding="utf-8").read()
    if 'class="present-footer"' in h:   # tools 页保留专属页脚
        skipped.append(f)
        continue
    m = re.search(r'<footer class="site-footer">.*?</footer>', h, re.S)
    if m:
        if m.group(0).strip() == SNIPPET:
            continue
        h2 = h[:m.start()] + SNIPPET + h[m.end():]
        tag = "replace"
    elif "</body>" in h:
        h2 = h.replace("</body>", SNIPPET + "\n</body>", 1)
        tag = "inject"
    else:
        skipped.append(f)
        continue
    open(f, "w", encoding="utf-8").write(h2)
    if tag == "replace":
        replaced += 1
    else:
        injected += 1
        print("注入新页脚:", f.replace(SITE + "/", ""))

print(f"\n完成：替换 {replaced} 个文件，注入 {injected} 个，跳过 {len(skipped)} 个")
for f in skipped:
    print("  跳过:", f.replace(SITE + "/", ""))

# 校验
bad = 0
for f in glob.glob(f"{SITE}/**/index.html", recursive=True):
    if "/node_modules/" in f or "/aeis_backup/" in f:
        continue
    h = open(f, encoding="utf-8").read()
    n = h.count('class="site-footer"')
    if n != 1:
        print("!! 异常:", f.replace(SITE + "/", ""), "site-footer 出现", n, "次")
        bad += 1
print("校验异常文件数:", bad)
