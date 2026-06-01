import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const title = args.find((arg) => !arg.startsWith('--'));

function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

if (!title) {
  console.error('Usage: npm run content:new -- "WACE适合中国学生吗" -- --category=wace --slug=wace-suitable-for-chinese-students');
  process.exit(1);
}

const category = option('category', 'guides');
const categoryLabel = option('categoryLabel', category);
const slug = option('slug', slugify(title) || `article-${Date.now()}`);
const description = option('description', `${title}。面向中国家长的新加坡教育长尾 SEO 文章，解释关键问题、适合人群、申请建议和常见误区。`);
const keywords = option('keywords', title);
const file = path.join(root, 'content', 'articles', `${category}-${slug}.md`);

if (fs.existsSync(file)) {
  console.error(`Article already exists: ${file}`);
  process.exit(1);
}

const body = `---
title: ${title}
description: ${description}
keywords: ${keywords}
category: ${category}
categoryLabel: ${categoryLabel}
slug: ${slug}
date: ${today()}
tags: ${categoryLabel},新加坡留学
draft: true
---

很多家长第一次搜索“${title}”，其实不是想看一堆官方定义。

他们真正想知道的是：这条路径是否适合自己的孩子、风险在哪里、需要提前准备什么。

## 先看结论

这里写 2-3 段结论，直接回答家长最关心的问题。

## 什么情况下适合

- 学生目前的年级和英文水平
- 家庭目标大学或学校类型
- 时间规划是否允许过渡
- 预算和陪读安排是否匹配

## 家长最容易误解的地方

这里写常见误区，语气要像顾问给家长解释，不要像百科。

## 申请或备考建议

这里写可执行建议，并自然加入站内链接，例如 [WACE 课程](/wace/) 或 [O-Level 课程](/o-level/)。

## 常见问题

### 这个方向适合英文一般的学生吗？

根据不同基础分层回答，不要绝对化。

### 什么时候开始准备比较合适？

给出时间线建议。

### 家长下一步应该做什么？

建议先明确目标学校、当前成绩和可接受预算，再决定课程路径。
`;

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, body, 'utf8');
console.log(`Created draft: ${file}`);
