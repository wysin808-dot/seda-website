/* ── Global WeChat Contact ── */
(function(){
  var contact = {
    consultant: 'Amy',
    wechatId: 'SEDAGUIDE',
    wechatQrUrl: '/assets/wechat-amy-seda-guide.jpg',
    title: '新加坡择校顾问 Amy',
  };
  window.SEDA_CONTACT = Object.assign({}, contact, window.SEDA_CONTACT || {});

  function benefitList() {
    return [
      '国际学校推荐',
      'AEIS 规划',
      'A-Level 规划',
      'WACE 规划',
      '学费预算分析',
    ].map(function(text){ return '<li>'+text+'</li>'; }).join('');
  }

  function trackWechat(eventType, placement) {
    var data = {
      visitorId: localStorage.getItem('sedaVisitorId') || '',
      eventType: eventType,
      placement: placement || 'global',
      path: location.pathname,
      title: document.title,
      referrer: document.referrer,
    };
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventType, {
        event_category: 'wechat_conversion',
        event_label: placement || 'global',
      });
    }
    var body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/collect', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function(){});
    }
  }

  function qrCard(extraClass, options) {
    var cfg = window.SEDA_CONTACT;
    var opts = options || {};
    var subtitle = opts.subtitle || '扫码添加，获取免费择校方案';
    var heading = opts.title || cfg.title;
    return '<div class="seda-wechat-card '+(extraClass || '')+'">' +
      '<div class="seda-wechat-head">' +
        '<div><strong>'+heading+'</strong><span>'+subtitle+'</span></div>' +
        '<button type="button" class="seda-copy-wechat" data-wechat="'+cfg.wechatId+'">复制微信号</button>' +
      '</div>' +
      '<div class="seda-wechat-body">' +
        '<img class="seda-wechat-qr" src="'+cfg.wechatQrUrl+'" alt="新加坡择校顾问Amy微信二维码" loading="lazy" decoding="async">' +
        '<div class="seda-wechat-info">' +
          '<p class="seda-wechat-id">微信号：<b>'+cfg.wechatId+'</b></p>' +
          '<ul>'+benefitList()+'</ul>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function openWechatModal(title, placement) {
    var existing = document.querySelector('.seda-wechat-modal');
    if (existing) {
      existing.remove();
    }
    trackWechat('wechat_click', placement || 'modal');
    var panel = document.createElement('div');
    panel.className = 'seda-wechat-modal';
    panel.innerHTML =
      '<div class="seda-wechat-dialog" role="dialog" aria-label="微信咨询">' +
        '<button type="button" class="seda-wechat-close" aria-label="关闭">×</button>' +
        qrCard('seda-wechat-card-modal', { title: title || window.SEDA_CONTACT.title }) +
      '</div>';
    document.body.appendChild(panel);
    trackWechat('wechat_exposure', placement || 'modal');
    panel.querySelector('.seda-wechat-close').addEventListener('click', function(){ panel.remove(); });
  }

  function copyWechat(button) {
    var id = button.getAttribute('data-wechat') || window.SEDA_CONTACT.wechatId;
    if (navigator.clipboard) navigator.clipboard.writeText(id).catch(function(){});
    trackWechat('wechat_copy', button.closest('[data-wechat-placement]')?.getAttribute('data-wechat-placement') || 'copy_button');
    button.textContent = '已复制';
    setTimeout(function(){ button.textContent = '复制微信号'; }, 1600);
  }

  function createFloat() {
    if (location.pathname.startsWith('/cms/') || location.pathname.startsWith('/content-review/')) return;
    if (document.querySelector('.wechat-float')) return;
    var button = document.createElement('button');
    button.className = 'wechat-float';
    button.type = 'button';
    button.setAttribute('aria-label', '微信咨询');
    button.setAttribute('data-wechat-placement', 'floating_button');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.825 4.15c-2.19 0-4.166.88-5.481 2.255-1.208 1.262-1.942 2.94-1.942 4.773 0 3.708 3.286 6.643 7.423 6.643.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.133 0 .241-.11.241-.245 0-.06-.024-.12-.04-.178l-.326-1.233a.49.49 0 0 1 .177-.554C21.886 21.065 23 19.18 23 17.17c0-3.832-3.339-7.028-7.577-7.028zm-2.57 3.198c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.543.434-.983.97-.983zm5.14 0c.535 0 .969.44.969.983a.976.976 0 0 1-.97.983.976.976 0 0 1-.968-.983c0-.543.434-.983.969-.983z"/></svg><span>微信咨询</span>';
    document.body.appendChild(button);
  }

  function shouldShowSideCard(path) {
    // Floating Amy sidecard disabled site-wide — pages have their own
    // consultation CTA, the popup card was intrusive/repetitive.
    return false;
  }

  function createSideCard() {
    if (!shouldShowSideCard(location.pathname)) return;
    if (sessionStorage.getItem('sedaWechatSidecardClosed') === '1') return;
    if (document.querySelector('.seda-wechat-sidecard')) return;
    var wrap = document.createElement('aside');
    wrap.className = 'seda-wechat-sidecard';
    wrap.setAttribute('data-wechat-placement', 'right_sidecard');
    wrap.setAttribute('aria-label', '新加坡择校顾问 Amy 微信咨询');
    wrap.innerHTML =
      '<button type="button" class="seda-sidecard-close" aria-label="关闭微信咨询卡">×</button>' +
      '<p class="seda-sidecard-kicker">免费择校咨询</p>' +
      '<h2>扫码添加 Amy</h2>' +
      '<p class="seda-sidecard-sub">获取新加坡升学与选校建议</p>' +
      '<img src="'+window.SEDA_CONTACT.wechatQrUrl+'" alt="新加坡择校顾问Amy微信二维码" loading="lazy" decoding="async">' +
      '<p class="seda-sidecard-id">微信号：<b>'+window.SEDA_CONTACT.wechatId+'</b></p>' +
      '<ul><li>AEIS / O-Level 规划</li><li>WACE / A-Level 路径</li><li>国际学校与公立大学申请</li><li>Poly 理工路线与预算分析</li></ul>' +
      '<button type="button" class="seda-copy-wechat" data-wechat="'+window.SEDA_CONTACT.wechatId+'">复制微信号</button>';
    document.body.appendChild(wrap);
    document.body.classList.add('has-seda-wechat-sidecard');
    var close = wrap.querySelector('.seda-sidecard-close');
    if (close) {
      close.addEventListener('click', function(){
        sessionStorage.setItem('sedaWechatSidecardClosed', '1');
        wrap.remove();
        document.body.classList.remove('has-seda-wechat-sidecard');
      });
    }
    trackWechat('wechat_exposure', 'right_sidecard');
  }

  function isSchoolDetail(path) {
    return /^\/(international-school|secondary-schools|primary-schools|jc|poly)\/[^/]+\/$/.test(path)
      && !/\/(index|schools)\/$/.test(path);
  }

  function isArticleLike(path) {
    if (isSchoolDetail(path)) return false;
    if (/^\/(cms|content-review|contact|about|news|tools)\/?/.test(path)) return false;
    var parts = path.split('/').filter(Boolean);
    return parts.length >= 2 && !/^(primary-schools|secondary-schools|jc|poly|international-school)$/.test(parts[0]);
  }

  function ctaHtml(type) {
    var school = type === 'school';
    return '<section class="seda-conversion-cta" data-wechat-placement="'+(school ? 'school_bottom' : 'article_bottom')+'">' +
      '<div class="seda-conversion-copy">' +
        '<p class="eyebrow">'+(school ? '学校咨询' : '免费咨询')+'</p>' +
        '<h2>'+(school ? '想了解申请要求和录取数据？' : '还不知道如何选择学校？')+'</h2>' +
        '<p>'+(school ? '扫码添加新加坡择校顾问 Amy，获取学费信息、申请要求、入学测试和录取案例。' : '扫码添加新加坡择校顾问 Amy，获取国际学校推荐、AEIS 规划、A-Level 规划、WACE 规划和学费预算分析。')+'</p>' +
      '</div>' +
      qrCard('seda-wechat-card-inline', { subtitle: school ? '获取学校申请资料与录取数据' : '扫码添加，获取免费择校方案' }) +
    '</section>';
  }

  function injectConversionCta() {
    if (document.querySelector('.seda-conversion-cta')) return;
    var target = document.querySelector('.content-main, article.content-main, main article, main');
    if (!target) return;
    if (isSchoolDetail(location.pathname)) {
      target.insertAdjacentHTML('beforeend', ctaHtml('school'));
      trackWechat('wechat_exposure', 'school_bottom');
    } else if (isArticleLike(location.pathname)) {
      target.insertAdjacentHTML('beforeend', ctaHtml('article'));
      trackWechat('wechat_exposure', 'article_bottom');
    }
  }

  function enhanceAiTool() {
    if (!location.pathname.startsWith('/tools/')) return;
    if (document.querySelector('.seda-ai-wechat-cta')) return;
    var target = document.querySelector('main, .tools-page, body');
    if (!target) return;
    target.insertAdjacentHTML('beforeend',
      '<section class="seda-ai-wechat-cta" data-wechat-placement="ai_tool_bottom">' +
        '<h2>需要人工顾问帮助？</h2>' +
        '<p>AI 结果适合作为初步参考，具体学校选择、申请材料和时间线建议让 Amy 再帮你人工确认。</p>' +
        qrCard('seda-wechat-card-inline', { subtitle: '扫码添加 Amy，继续人工咨询' }) +
      '</section>');
  }

  window.SEDA_WECHAT_CARD_HTML = qrCard;
  window.SEDA_OPEN_WECHAT = openWechatModal;

  document.addEventListener('click', function(event){
    var copyButton = event.target.closest('.seda-copy-wechat');
    if (copyButton) {
      event.preventDefault();
      copyWechat(copyButton);
      return;
    }
    var trigger = event.target.closest('.wechat-float, .js-wechat-open, a[href="weixin://"], [data-wechat-open]');
    if (trigger) {
      event.preventDefault();
      openWechatModal('新加坡择校顾问 Amy', trigger.getAttribute('data-wechat-placement') || 'click');
    }
  });

  document.addEventListener('DOMContentLoaded', function(){
    createFloat();
    createSideCard();
    injectConversionCta();
    enhanceAiTool();
    document.querySelectorAll('.seda-wechat-card, .seda-conversion-cta').forEach(function(card){
      trackWechat('wechat_exposure', card.getAttribute('data-wechat-placement') || 'wechat_card');
    });
    document.querySelectorAll('.contact-options').forEach(function(options){
      if (!options.querySelector('.js-wechat-open')) return;
      var link = options.querySelector('.js-wechat-open');
      link.textContent = '微信：SEDAGUIDE';
    });
  });
})();

/* ── Lead Capture API ── */
(function(){
  function visitorId() {
    var key = 'sedaVisitorId';
    var id = localStorage.getItem(key);
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function submitLead(form) {
    var button = form.querySelector('button[type="submit"], button:not([type])');
    var originalText = button ? button.textContent : '';
    var data = {};
    new FormData(form).forEach(function(value, key){
      data[key] = String(value || '').trim();
    });
    data.sourcePage = location.pathname;
    data.pageTitle = document.title;
    data.referrer = document.referrer;
    data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    data.language = navigator.language || '';
    data.visitorId = visitorId();

    if (button) {
      button.disabled = true;
      button.textContent = '提交中...';
    }

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function(res){
      return res.json().then(function(body){ return { ok: res.ok, body: body }; });
    }).then(function(result){
      if (!result.ok) throw new Error(result.body.error || '提交失败，请稍后再试');
      if (button) button.textContent = '已收到，顾问会尽快联系';
      form.reset();
      if (typeof window.SEDA_OPEN_WECHAT === 'function') {
        window.SEDA_OPEN_WECHAT(form.getAttribute('data-success-title') || '已收到，扫码添加 Amy 加快沟通');
      } else {
        alert('已收到，SEDA顾问会尽快联系您。');
      }
      if (typeof window.closeLeadModal === 'function') window.closeLeadModal();
    }).catch(function(error){
      alert(error.message || '提交失败，请稍后再试');
      if (button) {
        button.disabled = false;
        button.textContent = originalText || '提交';
      }
    });
  }

  document.querySelectorAll('.lead-form').forEach(function(form){
    form.addEventListener('submit', function(event){
      event.preventDefault();
      submitLead(form);
    });
  });
})();

/* ── Lightweight Analytics ── */
(function(){
  if (location.pathname.startsWith('/cms/') || location.pathname.startsWith('/content-review/')) return;
  var key = 'sedaVisitorId';
  var startTime = Date.now();
  var engagementSent = false;
  var visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(key, visitorId);
  }
  var payload = {
    visitorId: visitorId,
    eventType: 'pageview',
    path: location.pathname,
    title: document.title,
    referrer: document.referrer,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    language: navigator.language || '',
  };
  var body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/collect', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function(){});
  }

  function sendEngagement() {
    if (engagementSent) return;
    engagementSent = true;
    var seconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    var engagementBody = JSON.stringify({
      visitorId: visitorId,
      eventType: 'engagement',
      path: location.pathname,
      title: document.title,
      referrer: document.referrer,
      durationSeconds: seconds,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      language: navigator.language || '',
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/collect', new Blob([engagementBody], { type: 'application/json' }));
    } else {
      fetch('/api/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: engagementBody, keepalive: true }).catch(function(){});
    }
  }

  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') sendEngagement();
  });
  window.addEventListener('pagehide', sendEngagement);
})();

/* ── Google Analytics 4 ── */
(function(){
  if (location.pathname.startsWith('/cms/') || location.pathname.startsWith('/content-review/')) return;
  fetch('/api/config', { credentials: 'same-origin' }).then(function(res){
    return res.ok ? res.json() : {};
  }).then(function(config){
    var id = String(config.googleAnalyticsId || '').trim();
    if (!/^G-[A-Z0-9]+$/i.test(id)) return;
    if (window.__sedaGaLoaded || typeof window.gtag === 'function') return;
    window.__sedaGaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, {
      send_page_view: true,
      linker: { domains: ['sgeda.org.cn'] },
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(script);
  }).catch(function(){});
})();

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

document.querySelectorAll(".faq-list details summary").forEach((summary) => {
  summary.addEventListener("click", (e) => {
    const parent = e.target.closest("details");
    const faqList = parent.parentElement;
    if (!parent.open) {
      faqList.querySelectorAll("details[open]").forEach((d) => {
        if (d !== parent) d.removeAttribute("open");
      });
    }
  });
});

if (!document.querySelector(".wechat-float")) {
  const wechat = document.createElement("button");
  wechat.className = "wechat-float";
  wechat.type = "button";
  wechat.setAttribute("aria-label", "微信咨询");
  wechat.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm3.825 4.15c-2.19 0-4.166.88-5.481 2.255-1.208 1.262-1.942 2.94-1.942 4.773 0 3.708 3.286 6.643 7.423 6.643.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.133 0 .241-.11.241-.245 0-.06-.024-.12-.04-.178l-.326-1.233a.49.49 0 0 1 .177-.554C21.886 21.065 23 19.18 23 17.17c0-3.832-3.339-7.028-7.577-7.028zm-2.57 3.198c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.543.434-.983.97-.983zm5.14 0c.535 0 .969.44.969.983a.976.976 0 0 1-.97.983.976.976 0 0 1-.968-.983c0-.543.434-.983.969-.983z"/></svg><span>微信咨询</span>';
  document.body.appendChild(wechat);
}

(function () {
  const header = document.querySelector(".header-main");
  const nav = document.querySelector(".main-nav");
  if (!header || !nav) return;

  const btn = document.createElement("button");
  btn.className = "menu-toggle";
  btn.setAttribute("aria-label", "菜单");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = '<span></span><span></span><span></span>';
  header.insertBefore(btn, nav);

  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("nav-open");
    btn.classList.toggle("active", open);
    btn.setAttribute("aria-expanded", open);
    document.body.classList.toggle("nav-drawer-open", open);
  });

  nav.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("nav-open");
      btn.classList.remove("active");
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-drawer-open");
    });
  });

  nav.querySelectorAll(".nav-group").forEach((group) => {
    group.addEventListener("click", (e) => {
      if (window.innerWidth > 980) return;
      if (e.target.closest("a")) return;
      group.classList.toggle("mobile-open");
    });
  });
})();

/* ── AI Chat Widget ── */
(function(){
  // ── Config ──
  // 生产：自托管 API 和前端同域，留空即可
  // 本地开发：改为 'http://localhost:3005'
  var API_BASE = '';

  var QUICK = [
    'AEIS怎么备考', 'WACE是什么', 'O-Level和WACE怎么选',
    '新加坡留学费用', 'A-Level难度', '国际学校怎么选'
  ];
  var WELCOME = '您好！我是 SEDA AI 升学助手 👋\n\n可以帮您解答 WACE、AEIS、O-Level、国际学校、新加坡大学申请等问题。\n\n请直接输入您的问题。';

  var cfg = Object.assign({ wechatId: 'SEDAGUIDE', wechatQrUrl: '/assets/wechat-amy-seda-guide.jpg' }, window.SEDA_CONTACT || {});
  var isOpen = false, isLoading = false, panel = null, messagesEl = null, inputEl = null, sendBtn = null;

  // Build trigger button
  var trigger = document.createElement('button');
  trigger.className = 'ai-chat-trigger';
  trigger.setAttribute('aria-label', 'AI升学助手');
  trigger.innerHTML = '🤖<span class="ai-trigger-badge">AI</span>';
  trigger.addEventListener('click', toggle);
  document.body.appendChild(trigger);

  // Fetch config
  fetch(API_BASE + '/api/config').then(function(r){ return r.json(); }).then(function(d){
    cfg = Object.assign({}, cfg, d || {});
    if (!cfg.wechatId) cfg.wechatId = 'SEDAGUIDE';
    if (!cfg.wechatQrUrl) cfg.wechatQrUrl = '/assets/wechat-amy-seda-guide.jpg';
  }).catch(function(){});

  function toggle() {
    if (isOpen) close(); else open();
  }

  function open() {
    if (panel) { panel.style.display = 'flex'; panel.classList.remove('closing'); isOpen = true; return; }
    isOpen = true;
    panel = document.createElement('div');
    panel.className = 'ai-chat-panel';
    panel.innerHTML =
      '<div class="ai-panel-header">' +
        '<div class="ai-avatar">🤖</div>' +
        '<div class="ai-info"><div class="ai-name">AI 升学助手</div><div class="ai-status"><span class="ai-dot"></span>在线解答</div></div>' +
        '<button class="ai-panel-close" aria-label="关闭">×</button>' +
      '</div>' +
      '<div class="ai-quick-btns">' +
        QUICK.map(function(q){ return '<button class="ai-quick-btn" data-q="'+q+'">'+q+'</button>'; }).join('') +
      '</div>' +
      '<div class="ai-messages"></div>' +
      '<div class="ai-composer">' +
        '<input type="text" placeholder="请输入升学问题..." maxlength="500" />' +
        '<button type="button" disabled>发送</button>' +
      '</div>';

    messagesEl = panel.querySelector('.ai-messages');
    inputEl = panel.querySelector('.ai-composer input');
    sendBtn = panel.querySelector('.ai-composer button');

    panel.querySelector('.ai-panel-close').addEventListener('click', close);
    panel.querySelector('.ai-quick-btns').addEventListener('click', function(e){
      var btn = e.target.closest('.ai-quick-btn');
      if (btn) { btn.classList.add('selected'); setTimeout(function(){ btn.classList.remove('selected'); }, 350); ask(btn.dataset.q); }
    });
    inputEl.addEventListener('input', updateState);
    panel.querySelector('.ai-composer').addEventListener('submit', function(e){ e.preventDefault(); ask(inputEl.value); });
    sendBtn.addEventListener('click', function(){ ask(inputEl.value); });
    inputEl.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); ask(inputEl.value); } });

    document.body.appendChild(panel);
    addMsg('assistant', WELCOME);
    inputEl.focus();
  }

  function close() {
    if (!panel) return;
    isOpen = false;
    panel.classList.add('closing');
    setTimeout(function(){ if(panel){ panel.style.display = 'none'; panel.classList.remove('closing'); } }, 200);
  }

  function addMsg(role, text, typing) {
    var row = document.createElement('div');
    row.className = 'ai-msg ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    if (typing) {
      bubble.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
    } else {
      bubble.textContent = text;
    }
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function showWechatCard() {
    var card = document.createElement('div');
    card.className = 'ai-wechat-card';
    var qrHtml = cfg.wechatQrUrl
      ? '<img class="ai-qr" src="'+cfg.wechatQrUrl+'" alt="微信二维码">'
      : '<div class="ai-qr-placeholder">微信二维码</div>';
    card.innerHTML = '<strong>🎓 免费获取升学方案</strong>添加顾问微信，定制专属规划' + qrHtml +
      (cfg.wechatId ? '<div style="font-size:12px;color:#666;margin:4px 0">微信号：'+cfg.wechatId+'</div>' : '') +
      '<button class="ai-wechat-btn">立即添加顾问</button>';
    card.querySelector('.ai-wechat-btn').addEventListener('click', function(){
      fetch(API_BASE + '/api/wechat-click', { method: 'POST' }).catch(function(){});
      if (cfg.wechatId) { try { navigator.clipboard.writeText(cfg.wechatId); } catch(e){} }
      if (typeof window.SEDA_OPEN_WECHAT === 'function') window.SEDA_OPEN_WECHAT('扫码添加 Amy，获取免费择校方案');
      else window.open('/contact/', '_blank');
    });
    messagesEl.appendChild(card);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function updateState() {
    sendBtn.disabled = isLoading || !inputEl.value.trim();
  }

  async function ask(q) {
    var trimmed = (q || '').trim();
    if (!trimmed || isLoading) return;
    isLoading = true;
    inputEl.value = '';
    updateState();
    addMsg('user', trimmed);
    var pending = addMsg('assistant', '', true);
    try {
      var res = await fetch(API_BASE + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed })
      });
      var data = await res.json();
      pending.querySelector('.ai-bubble').textContent = res.ok ? (data.answer || '抱歉，暂时没有获得有效回答。') : (data.error || 'AI 服务暂时无法连接，请稍后重试。');
    } catch(e) {
      pending.querySelector('.ai-bubble').textContent = '网络连接异常，请稍后重试。您也可以直接联系顾问。';
    }
    showWechatCard();
    isLoading = false;
    updateState();
    messagesEl.scrollTop = messagesEl.scrollHeight;
    inputEl.focus();
  }
})();
