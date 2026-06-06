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
      'A-Level / O-Level 路径',
      'WACE 课程规划',
      '学费预算分析',
      '一对一专业咨询',
    ].map(function(text){ return '<li>'+text+'</li>'; }).join('');
  }

  function qrCard(extraClass) {
    var cfg = window.SEDA_CONTACT;
    return '<div class="seda-wechat-card '+(extraClass || '')+'">' +
      '<div class="seda-wechat-head">' +
        '<div><strong>'+cfg.title+'</strong><span>扫码添加，获取免费择校方案</span></div>' +
        '<button type="button" class="seda-copy-wechat" data-wechat="'+cfg.wechatId+'">复制微信号</button>' +
      '</div>' +
      '<div class="seda-wechat-body">' +
        '<img class="seda-wechat-qr" src="'+cfg.wechatQrUrl+'" alt="新加坡择校顾问 Amy 微信二维码" loading="lazy" decoding="async">' +
        '<div class="seda-wechat-info">' +
          '<p class="seda-wechat-id">微信号：<b>'+cfg.wechatId+'</b></p>' +
          '<ul>'+benefitList()+'</ul>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function openWechatModal(title) {
    var existing = document.querySelector('.seda-wechat-modal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.className = 'seda-wechat-modal';
    overlay.innerHTML =
      '<div class="seda-wechat-dialog" role="dialog" aria-modal="true" aria-label="微信咨询">' +
        '<button type="button" class="seda-wechat-close" aria-label="关闭">×</button>' +
        '<p class="eyebrow">免费咨询</p>' +
        '<h2>'+(title || '添加顾问微信，获取择校方案')+'</h2>' +
        qrCard('seda-wechat-card-modal') +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.seda-wechat-close').addEventListener('click', function(){ overlay.remove(); });
    overlay.addEventListener('click', function(event){ if (event.target === overlay) overlay.remove(); });
  }

  function copyWechat(button) {
    var id = button.getAttribute('data-wechat') || window.SEDA_CONTACT.wechatId;
    if (navigator.clipboard) navigator.clipboard.writeText(id).catch(function(){});
    button.textContent = '已复制';
    setTimeout(function(){ button.textContent = '复制微信号'; }, 1600);
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
    var trigger = event.target.closest('.wechat-float, .js-wechat-open, a[href="weixin://"]');
    if (trigger) {
      event.preventDefault();
      openWechatModal('扫码添加 Amy，获取免费择校方案');
    }
  });

  document.addEventListener('DOMContentLoaded', function(){
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
        window.SEDA_OPEN_WECHAT('已收到，扫码添加 Amy 加快沟通');
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

/* ── Scroll CTA Popup — only attach on pages that have the element ── */
(function(){
  var el = document.getElementById('scrollCta');
  if (!el) return;
  var shown = false;
  window.addEventListener('scroll', function(){
    if (shown) return;
    var scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    if (scrollPct > 0.4) { shown = true; el.style.display = 'flex'; }
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

/* ── Exit Intent Popup ── */
(function(){
  // Only show once per session
  if (sessionStorage.getItem('exitShown')) return;
  // Don't show on contact page
  if (location.pathname === '/contact/') return;

  var shown = false;
  var minTimeMs = 15000; // must be on page ≥15s
  var pageEnter = Date.now();

  function buildPopup(){
    var overlay = document.createElement('div');
    overlay.className = 'exit-overlay';
    overlay.id = 'exitIntent';
    overlay.innerHTML =
      '<div class="exit-box">' +
        '<button class="exit-close" aria-label="关闭">×</button>' +
        '<div class="exit-box-top">' +
          '<span class="exit-emoji">🎓</span>' +
          '<h2>别走！先拿份免费升学方案</h2>' +
          '<p>WACE · O-Level · AEIS · 国际学校<br>专属顾问为你的孩子量身规划</p>' +
        '</div>' +
        '<div class="exit-box-body">' +
          '<ul class="exit-points">' +
            '<li>按年龄 & 英文水平推荐最优路径</li>' +
            '<li>新加坡学费 / 生活费全面核算</li>' +
            '<li>AEIS / WACE 备考时间线定制</li>' +
            '<li>顾问回复 < 24小时，无骚扰承诺</li>' +
          '</ul>' +
          '<div class="exit-btns">' +
            '<a href="/contact/" class="exit-btn-primary">📋 免费获取升学方案</a>' +
            '<a href="/pathway/" class="exit-btn-secondary">先了解升学路径 →</a>' +
          '</div>' +
          '<p class="exit-dismiss" id="exitDismiss">暂时不需要，继续浏览</p>' +
        '</div>' +
      '</div>';

    function close(){
      overlay.style.animation = 'exitFadeIn 0.2s ease reverse';
      setTimeout(function(){ overlay.remove(); }, 200);
      sessionStorage.setItem('exitShown', '1');
    }

    overlay.querySelector('.exit-close').addEventListener('click', close);
    overlay.querySelector('#exitDismiss').addEventListener('click', close);
    // Click outside box to close
    overlay.addEventListener('click', function(e){
      if (e.target === overlay) close();
    });

    return overlay;
  }

  function show(){
    if (shown) return;
    if (Date.now() - pageEnter < minTimeMs) return;
    shown = true;
    sessionStorage.setItem('exitShown', '1');
    document.body.appendChild(buildPopup());
  }

  // Desktop: mouse leaves viewport through top edge
  document.addEventListener('mouseleave', function(e){
    if (e.clientY <= 0) show();
  });

  // Mobile/tablet: back button (popstate) or tab visibility change
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') show();
  });
})();
