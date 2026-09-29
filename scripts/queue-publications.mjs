function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (quoted) {
      if (character === '"' && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      cells.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(value);
  return cells;
}

export function publishedQueueRoutes(csv) {
  const lines = String(csv).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const statusIndex = headers.indexOf('status');
  const notesIndex = headers.indexOf('notes');
  const keywordIndex = headers.indexOf('keyword');
  if (statusIndex < 0 || notesIndex < 0) throw new Error('Keyword queue is missing status or notes column');

  const routes = [];
  lines.slice(1).forEach((line, index) => {
    const row = parseCsvLine(line);
    if (!['done', 'published'].includes(String(row[statusIndex] || '').toLowerCase())) return;
    const match = String(row[notesIndex] || '').match(/(?:^|\s)已发布\s+(\/[^\s]+)/);
    if (!match) return;
    routes.push({
      route: match[1].endsWith('/') ? match[1] : `${match[1]}/`,
      keyword: row[keywordIndex] || '',
      line: index + 2,
    });
  });
  return routes;
}

export function missingPublishedQueueRoutes(csv, sitemapUrls, site) {
  return publishedQueueRoutes(csv).filter(item => !sitemapUrls.has(new URL(item.route, site).href));
}
