export function singaporeDate(value = new Date()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

export function referrerSource(referrer = '') {
  if (!referrer) return '直接访问';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    const matches = domain => host === domain || host.endsWith(`.${domain}`);
    for (const [domain, label] of Object.entries({
      'sgeda.org.cn': '站内', 'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT',
      'perplexity.ai': 'Perplexity', 'copilot.microsoft.com': 'Copilot',
      'doubao.com': '豆包', 'kimi.com': 'Kimi', 'kimi.moonshot.cn': 'Kimi',
      'chat.deepseek.com': 'DeepSeek', 'baidu.com': '百度', 'bing.com': 'Bing',
      'google.com': 'Google', 'google.com.sg': 'Google', 'sogou.com': '搜狗',
      'weixin.qq.com': '微信', 'wechat.com': '微信',
    })) if (matches(domain)) return label;
    return host.replace(/^www\./, '');
  } catch { return '其他来源'; }
}

export function trafficExclusion(event = {}) {
  if (event.device === '爬虫' || /bot|spider|crawl|slurp|headless|lighthouse/i.test(event.userAgent || '')) return 'bot';
  if (event.trafficClass === 'internal' || /^\/(cms|content-review|api)(\/|$)/.test(event.path || '')) return 'internal';
  if (event.trafficClass === 'test' || event.isTest === true) return 'test';
  return null;
}

export function filterTraffic(events) {
  const excluded = { bot: 0, internal: 0, test: 0 };
  const filtered = [];
  for (const event of events) {
    const reason = trafficExclusion(event);
    if (!reason) filtered.push({ ...event, source: event.referrer ? referrerSource(event.referrer) : (event.source || '直接访问') });
    else if ((event.eventType || 'pageview') === 'pageview') excluded[reason]++;
  }
  return { events: filtered, excluded, rawPageviews: events.filter(e => (e.eventType || 'pageview') === 'pageview').length };
}

// Import only dated API responses; never infer acceptance from shell exit status.
export function legacyBaiduRecords(log = '') {
  const records = [];
  for (const line of log.split(/\r?\n/)) {
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\].*百度响应:\s*(\{.*\})\s*$/);
    if (!match) continue;
    try {
      const raw = JSON.parse(match[3]);
      const submitted = Number.isInteger(raw.success) && raw.success >= 0 ? raw.success : 0;
      const response = { success: submitted, remain: Number.isInteger(raw.remain) ? raw.remain : null };
      if (raw.error !== undefined) response.error = raw.error;
      if (raw.message) response.message = String(raw.message).slice(0, 160);
      records.push({ provider: 'baidu', date: match[1], createdAt: `${match[1]}T${match[2]}:00+08:00`,
        origin: 'server-legacy-log', submitted: raw.error ? 0 : submitted,
        status: raw.error ? 'error' : submitted > 0 ? 'success' : 'unknown', response });
    } catch { /* Truncated responses are not evidence of acceptance. */ }
  }
  return records;
}

export function mergeSubmissionRecords(records, legacy, date) {
  const minute = row => Math.floor(Date.parse(row.createdAt) / 60000);
  const combined = [...records];
  for (const row of legacy) {
    if (!combined.some(other => other.provider === row.provider && minute(other) === minute(row) && Number(other.submitted) === row.submitted)) combined.push(row);
  }
  return combined.filter(row => (row.date || singaporeDate(row.createdAt)) === date)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function optionalCount(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('指标必须是非负整数，未核实时留空');
  return number;
}
