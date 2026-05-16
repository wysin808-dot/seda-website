import { readFile, writeFile, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const outDir = new URL("../seda-github-pages/", import.meta.url);

const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("seda-site.css", root), "utf8");
const js = await readFile(new URL("seda-site.js", root), "utf8");

const linkMap = new Map([
  ["/", "./"],
  ["/wace/", "#wace-topic-title"],
  ["/o-level/", "#olevel-topic-title"],
  ["/international-school/", "#database-title"],
  ["/school-database/", "#database-title"],
  ["/guides/", "#parent-title"],
  ["/news/", "#articles-title"],
  ["/pathway/", "#pathway-title"],
  ["/wace-vs-a-level/", "#wace-topic-title"],
  ["/wace-atar/", "#wace-topic-title"],
  ["/wace-nus-ntu/", "#wace-topic-title"],
  ["/o-level-jc/", "#olevel-topic-title"],
  ["/o-level-poly/", "#olevel-topic-title"],
  ["/o-level-schools/", "#olevel-topic-title"],
  ["/singapore-education/", "#pathway-title"],
  ["/government-schools/", "#olevel-topic-title"],
  ["/private-schools/", "#database-title"],
  ["/a-level/", "#pathway-title"],
  ["/aeis/", "#olevel-topic-title"],
  ["/ib/", "#database-title"],
  ["/guides/student-pass/", "#parent-title"],
  ["/guides/cost/", "#parent-title"],
  ["/guides/accommodation/", "#parent-title"],
  ["/about/", "#contact"],
  ["/contact/", "#contact"],
]);

let singleFile = html
  .replace('<link rel="stylesheet" href="/seda-site.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="/seda-site.js"></script>', `<script>\n${js}\n</script>`);

for (const [from, to] of linkMap) {
  singleFile = singleFile.replaceAll(`href="${from}"`, `href="${to}"`);
}

singleFile = singleFile.replace(/href="\/[^"]+"/g, 'href="#articles-title"');

await mkdir(outDir, { recursive: true });
await writeFile(new URL("index.html", outDir), singleFile);
