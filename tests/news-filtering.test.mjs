import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../news/news.js', import.meta.url), 'utf8');
function fixture(hash = '') {
  function link(category, label, href) {
    const attrs = new Map([['href', href], ['data-news-label', label]]);
    const classes = new Set(category === 'all' ? ['is-active'] : []);
    return {
      dataset: { newsFilter: category },
      getAttribute: key => attrs.get(key),
      setAttribute: (key, value) => attrs.set(key, value),
      removeAttribute: key => attrs.delete(key),
      classList: { toggle: (name, selected) => selected ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) },
      addEventListener: (name, handler) => { if (name === 'click') attrs.set('click', handler); },
      click: (overrides = {}) => attrs.get('click')({ button: 0, preventDefault() {}, ...overrides }),
    };
  }
  const links = [link('all', '全部文章', '#news-articles'), link('o-level', 'O-Level', '#news-o-level'), link('aeis', 'AEIS', '#news-aeis')];
  const groups = [
    { dataset: { newsCategory: 'o-level' }, hidden: false, querySelectorAll: () => Array(2).fill({}) },
    { dataset: { newsCategory: 'aeis' }, hidden: false, querySelectorAll: () => Array(3).fill({}) },
  ];
  const count = { textContent: '共 5 篇文章' };
  const archive = { querySelectorAll: selector => selector === '[data-news-filter]' ? links : groups, querySelector: () => count };
  const events = {};
  const window = { location: { hash }, history: { replaceState: (_, __, next) => { window.location.hash = next; } }, addEventListener: (name, handler) => { events[name] = handler; } };
  vm.runInNewContext(script, { document: { querySelector: () => archive }, window });
  return { links, groups, count, window, events };
}

test('分类只隐藏其他主题，全部入口恢复所有文章并同步可访问状态', () => {
  const f = fixture();
  assert.deepEqual(f.groups.map(group => group.hidden), [false, false]);
  f.links[2].click();
  assert.deepEqual(f.groups.map(group => group.hidden), [true, false]);
  assert.match(f.count.textContent, /AEIS · 3 篇/);
  assert.equal(f.window.location.hash, '#news-aeis');
  assert.equal(f.links[2].getAttribute('aria-current'), 'true');
  assert.equal(f.links[0].getAttribute('aria-current'), undefined);
  f.links[0].click();
  assert.deepEqual(f.groups.map(group => group.hidden), [false, false]);
  assert.match(f.count.textContent, /全部文章 · 5 篇/);
  assert.equal(f.links[0].classList.contains('is-active'), true);
});

test('有效分类深链接可直接使用，联系锚点不会重置当前分类', () => {
  const f = fixture('#news-o-level');
  assert.deepEqual(f.groups.map(group => group.hidden), [false, true]);
  f.window.location.hash = '#contact';
  f.events.hashchange();
  assert.deepEqual(f.groups.map(group => group.hidden), [false, true]);
  f.window.location.hash = '';
  f.events.hashchange();
  assert.deepEqual(f.groups.map(group => group.hidden), [false, false]);
});

test('未知片段不隐藏内容，修饰键点击保留浏览器原有行为', () => {
  const f = fixture('#unknown');
  assert.deepEqual(f.groups.map(group => group.hidden), [false, false]);
  f.links[1].click({ ctrlKey: true, preventDefault() { throw new Error('must retain modified click'); } });
  assert.deepEqual(f.groups.map(group => group.hidden), [false, false]);
  assert.equal(f.window.location.hash, '#unknown');
});

test('脚本在无新闻目录的页面安全退出，不读写服务端或新增URL', () => {
  assert.doesNotThrow(() => vm.runInNewContext(script, { document: { querySelector: () => null } }));
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|localStorage|\/news\/\$|window\.location\.search/);
});
