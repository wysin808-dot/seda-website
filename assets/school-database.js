const value = input => typeof input === 'string' ? input : '';
const normalized = input => value(input).normalize('NFKC').toLocaleLowerCase('zh-CN').trim();

export function filterSchools(records, { query = '', location = '' } = {}) {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  return records.filter(record => {
    if (location && value(record.location).trim() !== location) return false;
    const haystack = normalized([record.nameZh, record.nameEn, record.schoolType, record.curriculum, record.location].map(value).join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

export function schoolIdFromHash(hash) {
  try {
    const decoded = decodeURIComponent(value(hash));
    if (decoded === '#school-database-main') return null;
    const match = /^#school-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(decoded);
    return match ? match[1] : null;
  } catch { return null; }
}

/** Pure state transition: no DOM, network, URL mutation or invented school data. */
export function transitionSchoolState(records, previous = {}, event = { type: 'init' }) {
  let state = {
    query: value(previous.query), location: value(previous.location),
    selectedId: previous.selectedId || null, notice: '',
  };
  if (event.type === 'filter') {
    if (typeof event.query === 'string') state.query = event.query;
    if (typeof event.location === 'string') state.location = event.location;
  } else if (event.type === 'reset') {
    state.query = '';
    state.location = '';
  } else if ((event.type === 'select' || event.type === 'hash' || event.type === 'init')
    && !(event.type !== 'select' && event.hash === '#school-database-main')) {
    // The skip-to-content anchor scrolls the UI; it never selects another school.
    const hashEvent = event.type !== 'select';
    const id = hashEvent ? schoolIdFromHash(event.hash) : event.id;
    const target = records.find(record => record.id === id);
    if (target) {
      // A deep link always wins over incompatible local-only search/filter state.
      if (!filterSchools([target], state).length) {
        state.query = '';
        state.location = '';
      }
      state.selectedId = target.id;
    } else {
      state.selectedId = null;
      if (!event.hash && hashEvent) {
        state.query = '';
        state.location = '';
      }
      if (event.hash || !hashEvent) state.notice = '未找到链接对应的学校，请从本页目录选择。';
    }
  }
  const results = filterSchools(records, state);
  if (!results.some(record => record.id === state.selectedId)) state.selectedId = results[0]?.id || null;
  return { ...state, resultIds: results.map(record => record.id) };
}

export function initSchoolDatabase(root, browser = globalThis.window) {
  if (!root || !browser || root.classList.contains('is-enhanced')) return null;
  const articles = [...root.querySelectorAll('[data-school-record]')];
  const links = [...root.querySelectorAll('[data-school-select]')];
  const listItems = [...root.querySelectorAll('[data-school-list-item]')];
  const search = root.querySelector('#school-search');
  const location = root.querySelector('#school-location');
  const reset = root.querySelector('[data-school-reset]');
  const controls = root.querySelector('[data-school-controls]');
  const count = root.querySelector('[data-school-result-count]');
  const empty = root.querySelector('[data-school-empty]');
  const notice = root.querySelector('[data-school-hash-notice]');
  const selectionStatus = root.querySelector('[data-school-selection-status]');
  if (![search, location, reset, controls, count, empty, notice, selectionStatus].every(Boolean)) return null;
  const records = articles.map(article => ({
    id: article.dataset.schoolRecord,
    nameZh: article.dataset.nameZh,
    nameEn: article.dataset.nameEn,
    location: article.dataset.location,
    schoolType: article.dataset.schoolType,
    curriculum: article.dataset.curriculum,
  }));
  let state = transitionSchoolState(records, {}, { type: 'init', hash: browser.location.hash });

  function paint() {
    const matches = new Set(state.resultIds);
    for (const article of articles) article.hidden = article.dataset.schoolRecord !== state.selectedId;
    for (const item of listItems) item.hidden = !matches.has(item.dataset.schoolListItem);
    for (const link of links) {
      if (link.dataset.schoolSelect === state.selectedId) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    search.value = state.query;
    location.value = state.location;
    count.textContent = `${state.resultIds.length} 所学校${state.query || state.location ? '符合当前筛选' : ''}`;
    empty.hidden = state.resultIds.length !== 0;
    notice.hidden = !state.notice;
    notice.textContent = state.notice;
    const selected = records.find(record => record.id === state.selectedId);
    selectionStatus.textContent = selected ? `当前学校：${selected.nameZh || selected.nameEn}` : '未找到学校';
  }
  function syncHash(method) {
    const fragment = state.selectedId ? `#school-${state.selectedId}` : '';
    if (browser.location.hash === fragment) return;
    // Never create query-string filter URLs. Only the stable school fragment changes.
    browser.history[method](null, '', `${browser.location.pathname}${browser.location.search || ''}${fragment}`);
  }
  function filter() {
    state = transitionSchoolState(records, state, { type: 'filter', query: search.value, location: location.value });
    paint();
    syncHash('replaceState');
  }
  function choose(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault();
    const id = event.currentTarget.dataset.schoolSelect;
    state = transitionSchoolState(records, state, { type: 'select', id });
    paint();
    syncHash('pushState');
    articles.find(article => article.dataset.schoolRecord === state.selectedId)?.focus();
  }
  function fromHistory() {
    state = transitionSchoolState(records, state, { type: 'hash', hash: browser.location.hash });
    paint();
    // Reading back/forward never writes the URL or adds a history entry.
  }
  function clear() {
    state = transitionSchoolState(records, state, { type: 'reset' });
    paint();
    syncHash('replaceState');
    search.focus();
  }
  search.addEventListener('input', filter);
  location.addEventListener('change', filter);
  reset.addEventListener('click', clear);
  for (const link of links) link.addEventListener('click', choose);
  browser.addEventListener('hashchange', fromHistory);
  browser.addEventListener('popstate', fromHistory);
  paint();
  controls.hidden = false;
  root.classList.add('is-enhanced');
  return {
    getState: () => ({ ...state, resultIds: [...state.resultIds] }),
    destroy() {
      search.removeEventListener('input', filter);
      location.removeEventListener('change', filter);
      reset.removeEventListener('click', clear);
      for (const link of links) {
        link.removeEventListener('click', choose);
        link.removeAttribute('aria-current');
      }
      browser.removeEventListener('hashchange', fromHistory);
      browser.removeEventListener('popstate', fromHistory);
      for (const article of articles) article.hidden = false;
      for (const item of listItems) item.hidden = false;
      controls.hidden = true;
      notice.hidden = true;
      empty.hidden = records.length !== 0;
      count.textContent = `${records.length} 所学校`;
      selectionStatus.textContent = '';
      root.classList.remove('is-enhanced');
    },
  };
}

if (typeof document !== 'undefined') {
  const start = () => document.querySelectorAll('[data-school-database]').forEach(root => initSchoolDatabase(root));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
