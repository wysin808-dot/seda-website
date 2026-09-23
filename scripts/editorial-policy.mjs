export function sourceLinks(body = '') {
  return [...body.matchAll(/(?<!!)\[[^\]]+\]\((https:\/\/[^\s)]+)\)/g)]
    .map(match => match[1]).filter(url => {
      try { const host = new URL(url).hostname; return host !== 'sgeda.org.cn' && !host.endsWith('.sgeda.org.cn'); }
      catch { return false; }
    });
}

export function editorialIssues(meta = {}, body = '') {
  const issues = [];
  if (meta.contentType === 'research-brief' || /\[待核实\]|\[待补充\]/.test(body)) issues.push('研究提纲或待核实内容不能发布');
  if (!sourceLinks(body).length) issues.push('请补充可核对的外部来源链接，并人工核实关键事实');
  if (!String(body).trim()) issues.push('缺少正文');
  return issues;
}

export function researchBrief(topic) {
  return `## 读者问题\n\n${topic}\n\n## 事实与来源\n\n[待核实] 记录官方原文链接、适用年份、对象、费用或截止日期。没有依据不填写结论。\n\n## 本页新增价值\n\n[待补充] 明确本页与现有内容的区别；优先更新已有 URL。只保留帮助读者决策的表格、真实图片或工具。\n\n## 复核记录\n\n[待补充] 完成正文后，将 contentType 改为 article，填写 reviewedBy、reviewedAt 和 factCheckedAt，再提交审核。\n`;
}
