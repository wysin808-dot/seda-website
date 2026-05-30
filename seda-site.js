document.querySelector(".lead-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.textContent = "已收到，顾问会尽快联系";
  button.disabled = true;
});

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
  const wechat = document.createElement("a");
  wechat.className = "wechat-float";
  wechat.href = "/contact/";
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

/* ── Scroll CTA Popup ── */
(function(){
  var shown = false;
  window.addEventListener('scroll', function(){
    if (shown) return;
    var scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    if (scrollPct > 0.4) {
      shown = true;
      var el = document.getElementById('scrollCta');
      if (el) el.style.display = 'flex';
    }
  });
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
