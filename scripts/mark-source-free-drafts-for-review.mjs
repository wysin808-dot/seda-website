import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const reviewNote = '草稿审核：缺少可核对的外部来源；不得发布。请补充权威来源、逐项核验关键事实并完成人工审核。';

function splitFrontmatter(raw) {
  const match = raw.match(/^(---\n)([\s\S]*?)(\n---\n?)([\s\S]*)$/);
  if (!match) return null;
  return { start: match[1], frontmatter: match[2], separator: match[3], body: match[4] };
}

function sourceCount(body) {
  return [...body.matchAll(/(?<!!)\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)].length;
}

function setField(frontmatter, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:.*$`, 'm');
  return pattern.test(frontmatter) ? frontmatter.replace(pattern, line) : `${frontmatter}\n${line}`;
}

export function markSourceFreeDraftsForReview({ root = process.cwd(), reviewDate = new Date().toISOString().slice(0, 10) } = {}) {
  const articleDir = path.join(root, 'content', 'articles');
  const updated = [];
  if (!fs.existsSync(articleDir)) return { updated };
  for (const file of fs.readdirSync(articleDir).filter((name) => name.endsWith('.md') && !name.startsWith('_')).sort()) {
    const articlePath = path.join(articleDir, file);
    const raw = fs.readFileSync(articlePath, 'utf8');
    const parts = splitFrontmatter(raw);
    if (!parts || !/^draft:\s*true\s*$/m.test(parts.frontmatter) || sourceCount(parts.body) > 0) continue;
    let frontmatter = parts.frontmatter;
    frontmatter = setField(frontmatter, 'contentType', 'research-brief');
    frontmatter = setField(frontmatter, 'reviewStatus', 'needs_revision');
    frontmatter = setField(frontmatter, 'factCheckRequired', 'true');
    frontmatter = setField(frontmatter, 'reviewNote', reviewNote);
    frontmatter = setField(frontmatter, 'reviewedAt', reviewDate);
    const next = `${parts.start}${frontmatter}${parts.separator}${parts.body}`;
    if (next !== raw) {
      fs.writeFileSync(articlePath, next, 'utf8');
      updated.push(file);
    }
  }
  return { updated };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = markSourceFreeDraftsForReview();
  console.log(JSON.stringify({ updated: result.updated.length, files: result.updated }, null, 2));
}
