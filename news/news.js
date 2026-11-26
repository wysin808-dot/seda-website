(() => {
  const archive = document.querySelector('.news-archive');
  if (!archive) return;
  const links = [...archive.querySelectorAll('[data-news-filter]')];
  const groups = [...archive.querySelectorAll('[data-news-category]')];
  const count = archive.querySelector('[data-news-count]');
  if (!links.length || !groups.length) return;

  function applyCategory(category) {
    if (category !== 'all' && !groups.some(group => group.dataset.newsCategory === category)) return;
    for (const group of groups) group.hidden = category !== 'all' && group.dataset.newsCategory !== category;
    for (const link of links) {
      const selected = link.dataset.newsFilter === category;
      link.classList.toggle('is-active', selected);
      if (selected) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    const visibleCount = groups.filter(group => !group.hidden).reduce((total, group) => total + group.querySelectorAll('.news-article').length, 0);
    const label = category === 'all' ? '全部文章' : links.find(link => link.dataset.newsFilter === category)?.getAttribute('data-news-label') || category;
    if (count) count.textContent = `${label} · ${visibleCount} 篇，按发表日期排列`;
  }

  function applyHash() {
    const selected = links.find(link => link.getAttribute('href') === window.location.hash);
    if (selected) applyCategory(selected.dataset.newsFilter);
    else if (!window.location.hash) applyCategory('all');
  }

  for (const link of links) {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      applyCategory(link.dataset.newsFilter);
      window.history.replaceState(null, '', link.getAttribute('href'));
    });
  }
  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
