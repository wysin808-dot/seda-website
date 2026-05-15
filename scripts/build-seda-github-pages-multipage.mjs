import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sourceRoot = new URL("../", import.meta.url);
const outRoot = new URL("../seda-github-pages/", import.meta.url);
const basePath = "/seda-website";

const siteDirs = [
  "a-level",
  "about",
  "aeis",
  "contact",
  "government-schools",
  "guides",
  "ib",
  "international-school",
  "news",
  "o-level",
  "o-level-jc",
  "o-level-poly",
  "o-level-schools",
  "pathway",
  "private-schools",
  "school-database",
  "singapore-education",
  "wace",
  "wace-atar",
  "wace-nus-ntu",
  "wace-vs-a-level",
];

const rootFiles = ["index.html", "seda-site.css", "seda-site.js", "robots.txt", "sitemap.xml"];

await mkdir(outRoot, { recursive: true });

for (const entry of await readdir(outRoot)) {
  if (entry !== ".git") {
    await rm(new URL(entry, outRoot), { recursive: true, force: true });
  }
}

for (const file of rootFiles) {
  await cp(new URL(file, sourceRoot), new URL(file, outRoot));
}

for (const dir of siteDirs) {
  await cp(new URL(`${dir}/`, sourceRoot), new URL(`${dir}/`, outRoot), { recursive: true });
}

const rewriteHtml = async (relativePath) => {
  const fileUrl = new URL(relativePath, outRoot);
  let html = await readFile(fileUrl, "utf8");
  html = html
    .replaceAll('href="/', `href="${basePath}/`)
    .replaceAll('src="/', `src="${basePath}/`)
    .replaceAll("href=”/", `href="${basePath}/`)
    .replaceAll("src=”/", `src="${basePath}/`)
    .replaceAll("”", '"')
    .replaceAll("“", '"');
  await writeFile(fileUrl, html);
};

const walk = async (dirUrl, prefix = "") => {
  for (const entry of await readdir(dirUrl, { withFileTypes: true })) {
    const rel = join(prefix, entry.name);
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      await walk(child, rel);
    } else if (entry.name.endsWith(".html")) {
      await rewriteHtml(rel);
    }
  }
};

await walk(outRoot);
