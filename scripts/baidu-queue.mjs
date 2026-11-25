export function selectBatch(pages, state, limit, priorities = [], now = new Date()) {
  const rank = new Map(priorities.map((url, i) => [url, i]));
  return pages.filter(page => !page.issues.length).filter(page => {
    const previous = state[page.url];
    return !previous || previous.fingerprint !== page.fingerprint || now - new Date(previous.submittedAt) >= 30 * 86400000;
  }).sort((a, b) => {
    const changed = p => state[p.url] && state[p.url].fingerprint !== p.fingerprint ? 0 : !state[p.url] ? 1 : 2;
    return changed(a) - changed(b) || (rank.get(a.url) ?? Infinity) - (rank.get(b.url) ?? Infinity) || Number(Boolean(b.modified)) - Number(Boolean(a.modified)) ||
      String(b.modified || b.lastmod).localeCompare(String(a.modified || a.lastmod)) || a.url.localeCompare(b.url);
  }).slice(0, limit);
}

export function isFullAcceptance(response, count) {
  // Partial acceptance does not identify which URLs Baidu accepted.
  return Boolean(response && !response.error && response.success === count &&
    !response.not_same_site?.length && !response.not_valid?.length);
}

export function recordAccepted(state, batch, result, now = new Date()) {
  if (!result.ok || !isFullAcceptance(result.response, batch.length)) return false;
  for (const page of batch) state[page.url] = { fingerprint: page.fingerprint, submittedAt: now.toISOString() };
  return true;
}
