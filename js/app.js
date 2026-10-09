/* NV-DPS-Internal shell, router, login, global actions */
(function (RM) {
  'use strict';
  const { $, $$, esc, ic, q, fmt, C, store } = RM;
  const O = RM.overlay; const V = RM.views; const RV = RM.RV;
  const EMP = ['PM', 'PO', 'Senior BA', 'BA'];
  // Admin and the Practice Head open people on the full employee profile (tabs include salary and rates);
  // everyone else keeps the scoped profile drawer
  const hasProfiles = (me) => q.isAdmin(me) || q.isPH(me);
  const profilePath = (id, tab) => 'people/' + id + (tab && tab !== 'overview' ? '?tab=' + tab : '');

  // When published as an artifact the page arrives wrapped in <body>, so its stylesheets and title sit there.
  // Every screen replaces body.innerHTML, which would delete them: hoist them into <head> first.
  document.querySelectorAll('body > link, body > style, body > title, body > meta').forEach((el) => document.head.appendChild(el));

  /* ---------------- routing ---------------- */
  const ROUTES = [
    { path: 'login', view: 'login', public: true },
    { path: 'me/performance', view: 'performance', ok: (me) => EMP.includes(me.role) },
    // reviews: one Review page per person (This month · Marks · History), the Team list, and the Appraisal summary. The Practice
    // Head reads someone else's on their profile's Reviews tab instead, except a quarter's marks and a reportee's month to add to
    { path: 'me/review', view: 'myReview', ok: (me) => EMP.includes(me.role) },
    { path: 'review/:emp', view: 'review', ok: () => true, redirect: (p, me) => { const r = RV.rec(p.emp); if (r) return RM.quarterHref(r, me).slice(2); if (RM.reviewOnProfile(me, p.emp, p.t)) return 'people/' + p.emp + '?tab=reviews'; return p.emp === me.id ? 'me/review' + qsOf(p, ['t', 'q', 'm']) : null; } },
    { path: 'appraisal/:id', view: 'appraisalReport', ok: () => true },
    // earlier addresses, now tabs of the Review page or parts of Team
    { path: 'me/form', view: 'myReview', ok: (me) => EMP.includes(me.role), redirect: (p) => 'me/review' + (p.m && p.m < RV.curMonth() ? '?t=history&m=' + p.m : '') },
    { path: 'form/:emp', view: 'review', ok: () => true, redirect: (p, me) => RM.formHref(p.emp, p.m, me).slice(2) },
    { path: 'me/reviews', view: 'myReview', ok: (me) => EMP.includes(me.role), redirect: () => 'me/review?t=history' },
    { path: 'reviews/:emp', view: 'review', ok: () => true, redirect: (p, me) => RM.reviewsHref(p.emp, me).slice(2) },
    { path: 'quarter/:id', view: 'review', ok: () => true, redirect: (p, me) => { const r = RV.rec(p.id); return r ? RM.quarterHref(r, me).slice(2) : landing(me); } },
    { path: 'me/goalsheet', view: 'myReview', ok: (me) => EMP.includes(me.role), redirect: () => 'me/review?t=marks' },
    { path: 'me/history', view: 'myReview', ok: (me) => EMP.includes(me.role), redirect: () => 'me/review?t=history' },
    { path: 'me/appraisal', view: 'myReview', ok: (me) => EMP.includes(me.role), redirect: () => 'me/review?t=history' },
    { path: 'annual/:id', view: 'review', ok: () => true, redirect: (p, me) => RM.reviewsHref(String(p.id).split('-').pop(), me).slice(2) },
    { path: 'me/goalsheets', view: 'team', ok: (me) => q.hasReportees(me.id), redirect: () => 'me/team' },
    { path: 'me/appraisals', view: 'team', ok: (me) => q.hasReportees(me.id), redirect: () => 'me/team?f=appr' },
    { path: 'admin/monitoring', view: 'adminReviews', ok: q.isAdmin, redirect: () => 'admin/reviews' },
    { path: 'admin/appraisals', view: 'adminReviews', ok: q.isAdmin, redirect: () => 'admin/reviews?f=appr' },
    { path: 'me/financials', view: 'myFinancials', ok: (me) => me.role === 'PM' },
    { path: 'admin/overview', view: 'adminOverview', ok: q.isAdmin },
    // a person opened from Resource Allocation is the employee profile (old ?id= links still work)
    { path: 'admin/resources', view: 'resources', ok: q.isAdmin, redirect: (p) => (p.id ? profilePath(p.id, p.tab) : null) },
    { path: 'ph/resources', view: 'resources', ok: q.isPH, redirect: (p) => (p.id ? profilePath(p.id, p.tab) : null) },
    { path: 'people/:id', view: 'employee', ok: hasProfiles },
    // the Practice Head's list is Practice Reviews; their old Team addresses land there
    { path: 'me/team', view: 'team', ok: (me) => q.hasReportees(me.id) && !q.isAdmin(me), redirect: (p, me) => (q.isPH(me) ? 'ph/reviews' : null) },
    { path: 'admin/reviews', view: 'adminReviews', ok: q.isAdmin },
    { path: 'me/finance', view: 'teamFinance', ok: (me) => me.role === 'PM' && q.hasReportees(me.id) },
    { path: 'me/gap', view: 'teamGap', ok: (me) => RM.isClusterHead(me) }, // a cluster head's own gap: their ideas to close it
    { path: 'me/profile', view: 'profile', ok: (me) => !q.isAdmin(me), redirect: (p, me) => (hasProfiles(me) ? profilePath(me.id) : null) },
    { path: 'ph/overview', view: 'phOverview', ok: q.isPH },
    { path: 'ph/org', view: 'phOrg', ok: () => true }, // the org chart is open to every role; its side panel keeps reviews and figures scoped
    { path: 'ph/finance', view: 'phFinance', ok: q.isPH },
    { path: 'ph/gap', view: 'phGap', ok: q.isPH }, // the Gap card: which clusters are short, and the initiatives to close it
    { path: 'ph/reviews', view: 'practiceReviews', ok: q.isPH },
    { path: 'ph/appraisals', view: 'appraisals', ok: q.isPH },
    { path: 'admin/people', view: 'adminPeople', ok: q.isAdmin },
    { path: 'admin/config', view: 'adminConfig', ok: q.isAdmin },
    { path: 'admin/finance', view: 'adminFinance', ok: q.isAdmin },
    { path: 'admin/audit', view: 'adminAudit', ok: q.isAdmin },
    { path: 'admin/settings', view: 'adminSettings', ok: q.isAdmin },
  ];
  // a redirect's query string, from the params it keeps
  const qsOf = (p, keys) => { const s = keys.filter((k) => p[k]).map((k) => k + '=' + encodeURIComponent(p[k])).join('&'); return s ? '?' + s : ''; };
  const landing = (me) => (q.isAdmin(me) ? 'admin/overview' : q.isPH(me) ? 'ph/overview' : 'me/performance');
  function parse() {
    const raw = location.hash.replace(/^#\/?/, ''); const [path, qs] = raw.split('?'); const params = {};
    (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    for (const r of ROUTES) {
      const ps = r.path.split('/'), xs = path.split('/'); if (ps.length !== xs.length) continue;
      // a route's :params count only when the whole route matches (a near miss like review/:id must not leave an id behind)
      const got = {}; let ok = true; ps.forEach((p, i) => { if (p.startsWith(':')) got[p.slice(1)] = xs[i]; else if (p !== xs[i]) ok = false; });
      if (ok) return { route: r, params: Object.assign(params, got), path };
    }
    return { route: null, params, path };
  }

  function navFor(me) {
    if (q.isAdmin(me)) {
      const over = RV.recs().filter((r) => RV.overdue(r) && !q.isFrozen(r)).length;
      const ids = q.active().map((p) => p.id); const fin = q.finMonths().filter((mk) => q.finSum(ids, mk).missing).length; // months with actuals to upload
      // grouped by the job being done (IA), mirroring the PRD's administration domains
      return [{ label: 'Overview' },
        { href: 'admin/overview', label: 'Dashboard', icon: 'widget-2-linear' },
        { label: 'People & Organization' },
        { href: 'admin/people', label: 'People', icon: 'users-group-rounded-linear' },
        { href: 'ph/org', label: 'Organization', icon: 'structure-linear' },
        { href: 'admin/resources', label: 'Resource Allocation', icon: 'pie-chart-2-linear' },
        { label: 'Reviews' },
        { href: 'admin/reviews', label: 'Reviews', icon: 'clipboard-check-linear', count: over || '' },
        { href: 'admin/config', label: 'Review setup', icon: 'tuning-2-linear' },
        { label: 'Financial Management' },
        { href: 'admin/finance', label: 'Financial Updates', icon: 'wallet-money-linear', count: fin || '' },
        { label: 'Governance' },
        { href: 'admin/audit', label: 'Audit Trail', icon: 'history-linear' },
        { href: 'admin/settings', label: 'Settings', icon: 'settings-linear' }];
    }
    if (q.isPH(me)) {
      return [{ label: 'Overview' },
        { href: 'ph/overview', label: 'Practice Overview', icon: 'widget-2-linear' },
        { label: 'Practice' },
        { href: 'ph/org', label: 'Organization', icon: 'structure-linear' },
        { href: 'ph/resources', label: 'Resource Allocation', icon: 'pie-chart-2-linear' },
        { href: 'ph/reviews', label: 'Practice Reviews', icon: 'clipboard-check-linear' },
        { href: 'ph/finance', label: 'Financial Performance', icon: 'chart-2-linear' },
        { label: 'Appraisal' },
        { href: 'ph/appraisals', label: 'Upcoming Appraisals', icon: 'calendar-mark-linear' },
        { label: 'You' },
        { href: profilePath(me.id), label: 'Profile', icon: 'user-id-linear' }];
    }
    const has = q.hasReportees(me.id);
    const mine = RV.mineOpen(me).length; const own = RV.waitingOn(me).length;
    // this month's monthly review, once the month is into its last week and your part isn't done
    const toAdd = RM.dayDiff(RM.TODAY, RV.monthEnd(RV.curMonth())) <= 7 ? RV.checkinTodo(me).filter((x) => x.part === 'emp').length : 0;
    const pm = me.role === 'PM'; // financials: PM, Practice Head and Admin only
    return [{ label: 'Overview' },
      { href: 'me/performance', label: 'Dashboard', icon: 'widget-2-linear' },
      { href: 'ph/org', label: 'Organization', icon: 'structure-linear' },
      { label: 'Me' },
      { href: 'me/review', label: 'My review', icon: 'clipboard-list-linear', count: (toAdd + mine) || '' },
      ...(pm ? [{ href: 'me/financials', label: 'My Financials', icon: 'wallet-money-linear' }] : []),
      { href: 'me/profile', label: 'Profile', icon: 'user-id-linear' },
      { label: 'My team' },
      { href: 'me/team', label: 'Team', icon: 'users-group-rounded-linear', count: own || '', disabled: !has, hint: has ? '' : '0', tip: 'This opens once someone reports to you' },
      ...(has && pm ? [{ href: 'me/finance', label: 'Team Financials', icon: 'chart-2-linear' }] : [])];
  }

  /* ---------------- shell ---------------- */
  function navHTML(me) {
    return `<span class="nav-thumb" aria-hidden="true"></span>` + navFor(me).map((n) => n.label && !n.href ? `<div class="nav-label">${esc(n.label)}</div>`
      : n.disabled ? `<span class="nav-item is-disabled" aria-disabled="true" data-tip="${esc(n.tip)}" tabindex="0">${ic(n.icon)}${esc(n.label)}<span class="hint">${n.hint}</span></span>`
      : `<a class="nav-item" href="#/${n.href}" data-nav="${n.href}">${ic(n.icon)}<span>${esc(n.label)}</span>${n.count ? `<span class="count" aria-label="${n.count} need action">${n.count}</span>` : ''}</a>`).join('');
  }
  // the menu panel: closed by default on a wide screen, and stays open once opened (this browser remembers); on a narrow
  // one it slides in over the page instead (nav-open). While it's open its button sits inside it; while it's closed, in the bar
  const NAV_KEY = 'rmfvs.nav';
  const navClosed = () => { try { return localStorage.getItem(NAV_KEY) !== 'open'; } catch (e) { return true; } };
  const narrow = () => window.matchMedia('(max-width: 1024px)').matches;
  function shell(me) {
    const closed = navClosed();
    return `<a class="skip-link" href="#view" data-skip>Skip to content</a>
    <div class="app${closed ? ' nav-collapsed' : ''}" id="app">
      <aside class="sidebar" id="sidebar" aria-label="Primary"${closed && !narrow() ? ' inert' : ''}>
        <div class="sidebar-inner">
          <div class="side-top"><button class="icon-btn menu-btn side-menu-btn" data-action="menu" aria-controls="sidebar" aria-expanded="true" aria-label="Hide the menu" data-tip="Hide the menu">${ic('hamburger-menu-linear')}</button></div>
          <nav class="nav" id="nav" data-lenis-prevent>${navHTML(me)}</nav>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn bar-menu-btn" data-action="menu" aria-controls="sidebar" aria-expanded="false" aria-label="Show the menu" data-tip="Show the menu">${ic('hamburger-menu-linear')}</button>
          <a class="top-brand" href="#/${landing(me)}" aria-label="NV-DPS-Internal, Digital Product Studio: home">${RM.nvLogo(48)}<span class="brand-text"><span class="brand-name">NV-DPS-Internal</span><span class="brand-sub">Digital Product Studio</span></span></a>
          <div class="crumbs" id="crumbs"></div>
          <div class="topbar-actions">
            <button class="search-btn" data-action="cmdk" aria-label="Search people, pages and reviews">${ic('magnifer-linear')}<span><span class="lbl-long">Search people, pages, reviews</span></span><span class="kbd">Ctrl K</span></button>
            ${RM.theme.button()}
            <button class="icon-btn" data-action="notifs" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false">${ic('bell-linear')}<span class="pip" id="pip" hidden></span></button>
            <button class="account-btn who top-who" data-action="account" aria-label="Account: ${esc(me.name)}" aria-haspopup="dialog" aria-expanded="false">${C.avatar(me, 'md')}<span class="top-who-text"><span class="person-name">${esc(me.name)}</span><span class="person-sub">${esc(me.role === 'Admin' ? 'Platform Admin' : me.role)}${q.hasReportees(me.id) && !q.isPH(me) ? ' · Reporting Manager' : ''}</span></span>${ic('alt-arrow-down-linear', 'chev')}</button>
          </div>
        </header>
        <main class="view" id="view" tabindex="-1"></main>
      </div>
    </div>`;
  }
  // after the panel opens or closes the page width changes: the bar's background, the menu marker and tab thumbs follow
  const afterNav = () => { alignBar(); RM.motion.navThumb(true); RM.motion.segThumb(document); };
  // the narrow screen's slide-in menu closes (a link followed, a tap outside, Escape, a new page); its button says so
  const shutMenu = () => { const ap = $('#app'); if (!ap || !ap.classList.contains('nav-open')) return; ap.classList.remove('nav-open'); const mb = $('.bar-menu-btn'); if (mb) mb.setAttribute('aria-expanded', 'false'); };

  let shellFor = null; let lastHash = ''; let lastPath = ''; let lastParams = {}; let ignoreHash = false; let first = true;
  const app = RM.app = {};
  app.reshell = () => { shellFor = null; route(); }; // redraw the shell (sidebar, account avatar) after the signed-in person changes

  // a review page lights up the menu item it belongs to: your own, or the team's (Reviews for Admin, Practice Reviews
  // or Upcoming Appraisals for the Practice Head)
  function reviewNav(me, r, params) {
    const emp = r.view === 'appraisalReport' ? (RV.appraisal(params.id) || {}).emp : r.view === 'review' ? params.emp : null;
    if (!emp) return null;
    if (emp === me.id) return 'me/review';
    if (q.isPH(me)) return r.view === 'appraisalReport' ? 'ph/appraisals' : 'ph/reviews';
    return q.isAdmin(me) ? 'admin/reviews' : 'me/team';
  }
  function setNavCurrent(me, r, params, path) {
    const reviewKey = reviewNav(me, r, params) || (r.view === 'employee' && params.id !== me.id ? 'ph/org' : null) || (V[r.view].nav ? V[r.view].nav(params, me) : null); // a detail page can name the menu item it belongs to
    $$('#nav [data-nav]').forEach((a) => a.setAttribute('aria-current', path === a.dataset.nav || a.dataset.nav === reviewKey ? 'page' : 'false'));
  }

  // the section name leads back to this role's dashboard; a detail view (view.crumb) adds its page as a link and names itself
  function setCrumbs(me, r, params, path) {
    const view = V[r.view]; const section = q.isAdmin(me) ? 'Admin Console' : q.isPH(me) ? 'Practice' : 'My Workspace';
    const title = view.title;
    const leaf = view.crumb && view.crumb(params, me); const sep = `<span class="crumb-parent">${ic('alt-arrow-right-linear')}</span>`;
    $('#crumbs').innerHTML = `<a class="crumb-parent crumb-home" href="#/${landing(me)}">${section}</a>${sep}`
      + (leaf ? `<a class="crumb-parent crumb-home" href="${leaf.back}">${esc(leaf.title || title)}</a>${sep}<b>${esc(leaf.name)}</b>` : `<b>${esc(title)}</b>`);
    document.title = (leaf ? leaf.name + ' · ' : '') + title + ' · NV-DPS-Internal';
  }

  async function route() {
    const me = q.me();
    const { route: r, params, path } = parse();
    if (!me) { if (path !== 'login') { location.replace('#/login'); return; } return renderLogin(); }
    if (r && r.public) { location.replace('#/' + landing(me)); return; }
    if (!r || (r.ok && !r.ok(me))) { location.replace('#/' + landing(me)); return; }
    if (r.redirect) { const to = r.redirect(params, me); if (to) { location.replace('#/' + to); return; } }
    if (shellFor !== me.id || !$('#app')) { document.body.innerHTML = shell(me); shellFor = me.id; bindShell(); alignBar(); first = true; }
    // same page, different query: list <-> detail views morph via a shared element; other query changes
    // (month, period, drill level) update in place with no page intro and keep scroll
    if (!first && path === lastPath) {
      const shared = V[r.view].morph && V[r.view].morph(lastParams, params);
      const prev = lastParams; lastHash = location.hash; lastParams = params; app.navDir = 0; // same page: its own morph, no page slide
      setCrumbs(me, r, params, path);
      if (shared) await morph(V[r.view], { me, params, path }, shared, prev); else app.softRender(false, { query: true });
      return;
    }
    const view = V[r.view]; const root = $('#view');
    setCrumbs(me, r, params, path);
    setNavCurrent(me, r, params, path);
    const ctx = { me, params, path };
    // exit fade, raced against a timer so a throttled/background tab never blocks navigation. A link with data-nav-dir moves the
    // page sideways instead: forward, the old page leaves to the left (140ms, ease-out, the click's first response) and the new
    // one arrives from the right (340ms, ease-out); back, the other way
    const dir = app.navDir || 0; app.navDir = 0;
    const exit = { opacity: 0, duration: .14, ease: 'power2.out' }; Object.assign(exit, dir ? { x: -16 * dir } : { y: -6 }); // eases out, as morph's exit does
    if (!first && !RM.reduced() && window.gsap) await Promise.race([new Promise((res) => gsap.to(root, Object.assign(exit, { onComplete: res }))), new Promise((res) => setTimeout(res, 200))]);
    RM.tip.hide(); O.closePopover(); O.closeDrawer(true); RM.gs.discard(); // a drawer (profile, report) never stays over a new page; unsaved review work stays behind
    app.fromHash = first ? '' : lastHash; // the page we came from, for views that offer a way back
    root.innerHTML = view.render(ctx);
    if (window.gsap) { gsap.killTweensOf(root); gsap.set(root, { opacity: 1, x: 0, y: 0, clearProps: 'transform' }); } // a leftover transform would pin position: fixed children (the org sheet) to the page
    if (dir && !first && !RM.reduced() && window.gsap) gsap.from(root, { x: 16 * dir, duration: .34, ease: 'power3.out', clearProps: 'transform' });
    window.scrollTo(0, 0);
    if (view.mount) view.mount(root, ctx);
    RM.motion.page(root); RM.motion.segThumb(root); RM.motion.navThumb(first);
    $$('.lc-fill[data-lc-fill="1"]', root).forEach((f) => { f.style.width = '100%'; });
    if (!first) root.focus({ preventScroll: true });
    first = false; lastHash = location.hash; lastPath = path; lastParams = params;
    updatePip(me);
    shutMenu();
  }

  // Shared-element transition between a list and its detail (container continuity).
  // The source element is cloned into a fixed "ghost", the old view fades out (ease-out, 140ms), the new view renders,
  // then the ghost flies to the matching element (ease-in-out, 360ms) while the new content rises in (ease-out, 40ms stagger).
  async function morph(view, ctx, shared) {
    const root = $('#view'); const motion = !RM.reduced() && window.gsap;
    const src = motion && shared.from ? root.querySelector(shared.from) : null;
    let ghost = null;
    if (src) {
      const r0 = src.getBoundingClientRect();
      if (r0.bottom > 0 && r0.top < innerHeight) {
        ghost = src.cloneNode(true); ghost.classList.add('morph-ghost');
        Object.assign(ghost.style, { position: 'fixed', left: r0.left + 'px', top: r0.top + 'px', margin: '0', zIndex: 60, pointerEvents: 'none' });
        ghost.style.setProperty('--s', r0.width + 'px'); document.body.appendChild(ghost); src.style.visibility = 'hidden';
      }
    }
    // dir: +1 deeper into a hierarchy (content pushes left), -1 back up (content pushes right); no dir = plain fade
    // fadeOut / fadeIn: that side has a position: fixed child (the org sheet) or a CSS-transformed part (the org canvas),
    // so it only fades: a transform would unpin the sheet from the viewport or fight the canvas's own shift
    const dx = shared.dir ? 28 * shared.dir : 0;
    // the exit is the click's first visible response, so it eases out: it moves at once instead of lingering at full opacity
    const out = { opacity: 0, duration: .14, ease: 'power2.out' }; if (dx && !shared.fadeOut) out.x = -dx;
    if (motion) await Promise.race([new Promise((res) => gsap.to(root, Object.assign(out, { onComplete: res }))), new Promise((res) => setTimeout(res, 200))]);
    RM.tip.hide(); O.closePopover();
    root.innerHTML = view.render(ctx);
    if (view.mount) view.mount(root, ctx);
    if (window.gsap) { gsap.killTweensOf(root); gsap.set(root, { opacity: 1, x: 0, y: 0, clearProps: 'transform' }); }
    $$('[data-reveal]', root).forEach((el) => { el.style.opacity = 1; });
    const y = shared.scrollTo ? Math.max(0, shared.scrollTo(root)) : 0;
    window.scrollTo(0, y);
    RM.motion.split(root); RM.motion.segThumb(root); RM.motion.countUp(root, true); RM.motion.charts(root);
    const dst = shared.to ? root.querySelector(shared.to) : null;
    if (ghost && dst) {
      const r1 = dst.getBoundingClientRect(); dst.style.visibility = 'hidden';
      const land = () => { dst.style.visibility = ''; ghost.remove(); };
      gsap.to(ghost, { left: r1.left, top: r1.top, '--s': r1.width + 'px', duration: .36, ease: 'power3.inOut', onComplete: land });
      setTimeout(land, 800); // never leave the destination hidden if frames are throttled
    } else if (ghost) ghost.remove();
    if (motion) {
      const parts = $$(shared.stagger || '.page > *', root);
      // opacity stays inline at 1: clearing it would hand [data-reveal] blocks back to their hidden-until-revealed CSS
      const enter = { opacity: 1, duration: .32, stagger: .04, ease: 'power3.out' };
      if (shared.fadeIn) gsap.fromTo(parts, { opacity: 0 }, enter);
      else gsap.fromTo(parts, dx ? { opacity: 0, x: dx } : { opacity: 0, y: 10 }, Object.assign(enter, { x: 0, y: 0, clearProps: 'transform' }));
    }
    if (shared.after) shared.after(root);
    if (!root.contains(document.activeElement)) root.focus({ preventScroll: true }); // unless after() already placed focus in the new view
  }

  // re-render in place (after an action) without the page intro
  app.softRender = (animLifecycle, opts) => {
    opts = opts || {};
    const me = q.me(); const { route: r, params, path } = parse(); if (!r || !me || !$('#view')) return;
    if (r.ok && !r.ok(me)) { route(); return; }
    const root = $('#view'); const y = window.scrollY; const view = V[r.view];
    const prevThumbs = $$('.seg .seg-thumb', root).map((t) => ({ tf: t.style.transform, w: t.style.width }));
    RM.tip.hide();
    root.innerHTML = view.render({ me, params, path });
    if (view.mount) view.mount(root, { me, params, path });
    $$('[data-reveal]', root).forEach((el) => { el.style.opacity = 1; });
    RM.motion.split(root);
    // segmented controls: start the thumb where it was, then let CSS slide it to the new tab
    const thumbs = $$('.seg .seg-thumb', root);
    thumbs.forEach((t, i) => { if (prevThumbs[i] && prevThumbs[i].tf) { t.style.transition = 'none'; t.style.transform = prevThumbs[i].tf; t.style.width = prevThumbs[i].w; } });
    void root.offsetWidth; thumbs.forEach((t) => { t.style.transition = ''; });
    RM.motion.segThumb(root);
    if (opts.query) { RM.motion.countUp(root); RM.motion.charts(root); } else RM.motion.countUp(root, true);
    const navEl = $('#nav'); if (navEl) { navEl.innerHTML = navHTML(me); setNavCurrent(me, r, params, path); RM.motion.navThumb(true); }
    updatePip(me);
    window.scrollTo(0, y);
    const fills = $$('.lc-fill[data-lc-fill="1"]', root);
    if (animLifecycle && !RM.reduced() && window.gsap) {
      gsap.fromTo(fills, { width: 0 }, { width: '100%', duration: .5, stagger: .08, ease: 'power2.inOut' });
      const cur = $('.lc-step.is-current .lc-dot', root); if (cur) gsap.fromTo(cur, { scale: .6 }, { scale: 1, duration: .6, delay: .3, ease: 'back.out(2.2)' });
      const b = $('.gs-head .badge', root); if (b) gsap.fromTo(b, { scale: .8, opacity: 0 }, { scale: 1, opacity: 1, duration: .4, ease: 'back.out(2)' });
    } else fills.forEach((f) => { f.style.width = '100%'; });
  };
  // in-page state (a tab, a person) written into the URL without a navigation; the router keeps it as the current page
  app.replaceHash = (h) => {
    try { history.replaceState(null, '', h); } catch (err) { /* sandboxed frames may refuse */ }
    lastHash = location.hash; lastParams = parse().params;
  };
  // sidebar counts after an in-page action (submitting, completing)
  app.refreshNav = () => { const me = q.me(); const navEl = $('#nav'); if (!me || !navEl) return; const { route: r, params, path } = parse(); navEl.innerHTML = navHTML(me); if (r) setNavCurrent(me, r, params, path); RM.motion.navThumb(true); updatePip(me); };
  app.switchTo = (id, hash) => {
    RM.gs.discard(); store.session = id; shellFor = null; const p = q.person(id);
    const target = hash || '#/' + landing(p);
    if (location.hash === target) route(); else location.hash = target;
    setTimeout(() => O.toast(`Now previewing as <b>${esc(p.name)}</b> · ${esc(p.role)}`, { tone: 'info', icon: 'user-rounded-bold' }), 350);
  };

  window.addEventListener('hashchange', async () => {
    if (ignoreHash) { ignoreHash = false; return; }
    if (RM.gs.dirty && /#\/(review\/|me\/review)/.test(lastHash) && location.hash.split('?')[0] !== lastHash.split('?')[0]) {
      const target = location.hash; ignoreHash = true; location.hash = lastHash;
      const res = await O.modal({ icon: 'danger-triangle-linear', tone: 'warn', title: 'Leave with unsaved changes?', body: '<p>Your edits on this page haven’t been saved. Leaving discards them.</p>', confirm: 'Discard & leave', cancel: 'Keep editing' });
      if (res.ok) { RM.gs.discard(); location.hash = target; }
      return;
    }
    // Financial Updates: unsaved values in the period table (its names open profiles, so leaving is one click away)
    const ed = RM.finEditor;
    if (ed && document.contains(ed) && ed._dirty() && location.hash !== lastHash) {
      const target = location.hash; const n = ed._dirty(); ignoreHash = true; location.hash = lastHash;
      const res = await O.modal({ icon: 'danger-triangle-linear', tone: 'warn', title: 'Leave with unsaved values?', body: `<p>${n} value${n > 1 ? 's' : ''} in the table ${n > 1 ? 'haven’t' : 'hasn’t'} been saved. Leaving discards ${n > 1 ? 'them' : 'it'}.</p>`, confirm: 'Discard & leave', cancel: 'Keep editing' });
      if (res.ok) { RM.finEditor = null; location.hash = target; }
      return;
    }
    route();
  });
  window.addEventListener('beforeunload', (e) => { if (RM.gs.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- login ---------------- */
  // demo roles, one real colleague each (the Admin account is a sample, it isn't on the org chart)
  const PERSONAS = [
    { id: 'NVS00697', role: 'Practice Head', mode: 'emp' },
    { id: 'NVS00212', role: 'PM', mode: 'emp' },
    { id: 'NVS01478', role: 'PO', mode: 'emp' },
    { id: 'NVS00822', role: 'Senior BA', mode: 'emp' },
    { id: 'NVS00975', role: 'BA', mode: 'emp' }, // Shweta has a full review history (Aaditya joined in Aug 2026)
    { id: 'ADM-0001', role: 'Admin', mode: 'admin' },
  ];
  function renderLogin() {
    shellFor = null; document.title = 'Sign in · NV-DPS-Internal';
    const pill = (x) => { const p = q.person(x.id); return p ? `<button type="button" class="role-pill" data-persona="${p.id}" data-mode="${x.mode}" aria-pressed="false">${C.avatar(p, 'sm')}<span class="rp-text"><b>${esc(x.role)}</b><small>${esc(fmt.first(p.name))}</small></span></button>` : ''; };
    document.body.innerHTML = `<main class="login" id="login">
      <section class="login-hero band" aria-label="About NV-DPS-Internal">
        <div class="brand"><div class="brand-text"><div class="brand-name">NV-DPS-Internal</div><div class="brand-sub">Review &amp; financial visibility</div></div></div>
        <div class="lh-main">
          <div class="eyebrow lh-eyebrow">Digital Product Studio · New Vision</div>
          <h1 class="display-xl" data-split>Your reviews and <em class="accent">growth</em> in one place<span style="color:var(--orange)">.</span></h1>
          <p class="lede">Meet your manager for a monthly review, mark each quarter’s goals and see your manager’s marks, all in one place. Managers and practice leads follow their team’s progress and appraisals here too.</p>
        </div>
        <ul class="login-points" aria-label="What you can do here">
          <li>A monthly review, with evidence under each goal</li><li>Quarter marks: yours, then your manager’s</li><li>An appraisal summary on each anniversary</li><li>Team progress &amp; financials for leads</li>
        </ul>
        <div class="lh-foot"><span>© 2026 New Vision Software · A SoftServe Company</span></div>
      </section>
      <section class="login-side">
        <div class="login-card">
          <div class="lc-top" data-reveal>${RM.nvLogo(60)}${RM.theme.button()}</div>
          <h2 class="h2" data-reveal>Welcome back<span class="dot-o">.</span></h2>
          <p class="small muted" style="margin-top:4px" data-reveal>Sign in with your New Vision work account.</p>
          <div class="login-tabs" data-reveal>${C.seg([{ key: 'emp', label: 'Employee / Manager' }, { key: 'admin', label: 'Admin' }], 'emp', 'aria-label="Account type (cosmetic; routing comes from your account)" id="login-seg"')}</div>
          <form id="login-form" novalidate class="stack" style="gap:14px" data-reveal>
            <div class="field" id="f-email"><label for="email">Work email</label><input class="input" id="email" type="email" autocomplete="username" placeholder="name@${RM.DOMAIN}" aria-describedby="email-err"><span class="err" id="email-err" role="alert"></span></div>
            <div class="field" id="f-pw"><label for="pw">Password</label><div class="pw-wrap"><input class="input" id="pw" type="password" autocomplete="current-password" placeholder="Your password" aria-describedby="pw-err"><button type="button" class="pw-toggle" data-action="pw" aria-label="Show password" aria-pressed="false">${ic('eye-linear')}</button></div><span class="err" id="pw-err" role="alert"></span></div>
            <fieldset class="role-pick"><legend class="label">Sign in as <span class="opt">(prototype role picker)</span></legend><div class="role-pills" id="role-pills">${PERSONAS.map(pill).join('')}</div></fieldset>
            <div class="hstack" style="justify-content:space-between"><label class="check"><input type="checkbox" id="remember" checked> Remember this device</label><button type="button" class="link-btn" data-action="forgot">Forgot password?</button></div>
            <button class="btn btn-primary btn-lg" type="submit" id="login-btn" style="width:100%">Log in ${ic('arrow-right-linear')}</button>
          </form>
        </div>
        <div class="login-foot"><span>${ic('lock-keyhole-minimalistic-linear')} Access is checked separately for role, visibility, review ownership and financial scope.</span></div>
      </section></main>`;
    const root = $('#login');
    RM.motion.page(root); RM.motion.segThumb(root);
    const form = $('#login-form'); const email = $('#email'), pw = $('#pw');
    const setErr = (f, msg) => { const el = $('#' + f); el.classList.toggle('has-error', !!msg); el.querySelector('.err').innerHTML = msg ? ic('danger-circle-linear') + esc(msg) : ''; };
    // the account-type toggle follows the chosen pill, so the two controls never disagree
    const setMode = (mode) => { const segs = $$('#login-seg [data-seg]'); if (segs.find((b) => b.getAttribute('aria-selected') === 'true')?.dataset.seg === mode) return; segs.forEach((b) => b.setAttribute('aria-selected', b.dataset.seg === mode)); RM.motion.segThumb(root); };
    const pick = (id) => {
      $$('#role-pills [data-persona]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.persona === id));
      const pill = $(`#role-pills [data-persona="${id}"]`); if (pill) setMode(pill.dataset.mode);
      const p = q.person(id); if (p) { email.value = p.email; pw.value = 'prototype'; setErr('f-email', ''); setErr('f-pw', ''); }
    };
    pick('NVS00212'); // opens ready to try, like the reference: PM selected
    email.addEventListener('blur', () => { const v = email.value.trim(); if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) setErr('f-email', 'That doesn’t look like an email address.'); });
    email.addEventListener('input', () => { setErr('f-email', ''); $$('#role-pills [data-persona]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.persona && q.person(b.dataset.persona).email === email.value.trim().toLowerCase())); });
    pw.addEventListener('input', () => setErr('f-pw', ''));
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action],[data-persona],[data-seg]'); if (!t) return;
      if (t.dataset.seg) { pick(t.dataset.seg === 'admin' ? 'ADM-0001' : 'NVS00212'); return; }
      if (t.dataset.persona) { pick(t.dataset.persona); return; }
      const a = t.dataset.action;
      if (a === 'theme') { RM.theme.toggle(); return; }
      if (a === 'pw') { const show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; t.setAttribute('aria-pressed', show); t.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); t.innerHTML = ic(show ? 'eye-closed-linear' : 'eye-linear'); }
      if (a === 'forgot') O.toast('Password resets go through your identity provider. Contact IT.', { tone: 'info' });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = email.value.trim().toLowerCase(); let bad = false;
      if (!v) { setErr('f-email', 'Enter your work email.'); bad = true; } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { setErr('f-email', 'That doesn’t look like an email address.'); bad = true; }
      if (!pw.value) { setErr('f-pw', 'Enter your password.'); bad = true; }
      if (bad) { (form.querySelector('.has-error input') || email).focus(); return; }
      const btn = $('#login-btn'); btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true');
      await RM.wait(650);
      const db = store.db; const p = db.admin.email === v ? db.admin : db.people.find((x) => x.email === v);
      btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy');
      if (!p) { setErr('f-email', 'No active account for this email. Check the spelling.'); email.focus(); return; }
      if (p.status !== 'Active') { setErr('f-email', 'This account is archived. Contact your Admin.'); return; }
      store.session = p.id;
      const go = () => { const target = '#/' + landing(p); if (location.hash === target) route(); else location.hash = target; };
      if (!RM.reduced() && window.gsap) gsap.to('#login', { opacity: 0, scale: .985, duration: .35, ease: 'power2.in', onComplete: go }); else go();
    });
  }

  /* ---------------- notifications (§5.20): in-app; Admin can mute each one in Settings ---------------- */
  const notifOn = (k) => ((store.db.config.notif || {})[k] !== false);
  function notifications(me) {
    // due and missed notifications are reminders: once read, they come back on the reminder frequency (isRead)
    const out = []; const push = (k, o) => { if (notifOn(k)) out.push(Object.assign(o, { remind: /^(due|incomplete)\./.test(k) })); };
    const cur = RV.curMonth(); const prevMk = RV.addMonths(cur, -1); const lead = store.db.config.appraisalLeadDays;
    const sh = (r) => RV.quarter(r.key).short; const nm = (id) => (q.person(id) || {}).name || id;
    const names = (list) => (list.length > 3 ? list.slice(0, 3).join(', ') + ` and ${list.length - 3} more` : list.join(', '));
    const blockedBy = (r) => store.db.appraisals.find((a) => a.emp === r.emp && a.status === 'Not generated' && (a.blocking || []).includes(r.key));
    if (q.isAdmin(me)) {
      const ids = q.active().map((p) => p.id); q.finMonths().forEach((mk) => { const miss = q.finSum(ids, mk).missing; if (miss) push('fin.admin', { icon: 'wallet-money-linear', tone: 'warn', title: `Actuals to upload · ${fmt.monthLabel(mk)}`, sub: `${miss} billable ${miss === 1 ? 'person has' : 'people have'} no actual yet; their forecast counts until it’s uploaded`, href: '#/admin/finance?p=' + mk }); });
      const inc = RV.recs().filter((r) => RV.overdue(r) && !q.isFrozen(r));
      if (inc.length) push('incomplete.admin', { icon: 'danger-triangle-linear', tone: 'warn', title: `${inc.length} quarter${inc.length > 1 ? 's’' : '’s'} marks missed`, sub: names(inc.map((r) => nm(r.emp) + ' · ' + sh(r))) + ' · not final by the due date', href: '#/admin/reviews?f=behind' });
      const mc = RV.monthCompletion(prevMk).list.filter((x) => !x.m.complete);
      if (mc.length) push('incomplete.admin', { icon: 'clipboard-list-linear', tone: 'warn', title: `${mc.length} ${RV.monthLabel(prevMk)} monthly review${mc.length > 1 ? 's' : ''} missed`, sub: names(mc.map((x) => x.p.name)), href: '#/admin/reviews' });
      // a summary waits only on missed marks (every quarter's are due on its last day, Q4's before the anniversary)
      const blocked = store.db.appraisals.filter((a) => a.status === 'Not generated' && a.reason === 'blocked' && RV.waitingOnMissed(a) && (q.person(a.emp) || {}).status === 'Active');
      if (blocked.length) push('report.admin', { icon: 'file-remove-linear', tone: 'warn', title: `${blocked.length} appraisal ${blocked.length > 1 ? 'summaries' : 'summary'} waiting on missed marks`, sub: blocked.map((a) => `${nm(a.emp)} · ${fmt.date(a.date, { noYear: true })} · waiting on ${a.blocking.map((k) => RV.quarter(k).short).join(', ')}`).join('; '), href: '#/admin/reviews' });
      const gen = store.db.appraisals.filter((a) => a.status === 'Generated' && (q.person(a.emp) || {}).status === 'Active' && RM.dayDiff(new Date(a.generatedAt), RM.TODAY) >= 0 && RM.dayDiff(new Date(a.generatedAt), RM.TODAY) <= 14);
      if (gen.length) push('report.admin', { icon: 'file-check-linear', tone: '', title: `${gen.length} appraisal ${gen.length > 1 ? 'summaries' : 'summary'} created in the last 2 weeks`, sub: gen.map((a) => nm(a.emp) + ' · ' + fmt.date(a.date, { noYear: true }) + (a.flags.includes('PARTIAL_CYCLE') ? ' · 3 quarters' : '')).join(', '), href: '#/admin/reviews?f=appr' });
      const up = q.upcomingAppraisals(ids).filter((x) => !x.a.report);
      if (up.length) push('appraisal.admin', { icon: 'calendar-mark-linear', tone: '', title: `${up.length} appraisal${up.length > 1 ? 's' : ''} in the next ${lead} days`, sub: names(up.map(({ p, a }) => `${p.name} · ${fmt.date(a.anniv, { noYear: true })}`)), href: '#/admin/reviews?f=appr' });
      const pend = RV.mappingPending(); if (pend.length) push('mapping.admin', { icon: 'danger-triangle-linear', tone: '', title: `${pend.length} ${pend.length === 1 ? 'person' : 'people'} waiting on a role mapping`, sub: 'Not in reviews until their designation is mapped: ' + names(pend.map((p) => p.name)), href: '#/admin/config' });
      return out;
    }
    // as the employee: your marks and monthly reviews
    if (RV.inCycles(me)) {
      RV.recsOf(me.id).filter((r) => r.status === 'Changes Requested' && !q.isFrozen(r)).forEach((r) => push('changes.emp', { icon: 'chat-round-line-linear', tone: 'warn', title: `${nm(r.reviewer)} asked you to change your ${sh(r)} marks`, sub: (r.changeNote || {}).note || '', href: RM.quarterHref(r) }));
      RV.mineOpen(me).filter((r) => r.status !== 'Changes Requested').forEach((r) => {
        if (RV.overdue(r)) push('incomplete.emp', { icon: 'danger-triangle-linear', tone: 'warn', title: `Your ${sh(r)} marks were missed`, sub: `They were due ${fmt.date(RV.lockBy(RV.quarter(r.key)), { noYear: true })}; you can still send them`, href: RM.quarterHref(r) });
        else push(r.status === 'Not Started' ? 'generated.emp' : 'due.emp', { icon: 'clock-circle-linear', tone: '', title: r.status === 'Not Started' ? `Your ${sh(r)} marks are open` : `Your ${sh(r)} marks are due`, sub: `${RV.due(r).label} · ${RM.statusLabel(r.status)}`, href: RM.quarterHref(r) });
      });
      RV.recsOf(me.id).filter((r) => RV.overdue(r) && RV.needsMgr(r)).forEach((r) => push('incomplete.emp', { icon: 'danger-triangle-linear', tone: 'warn', title: `Your ${sh(r)} marks were missed`, sub: `You sent yours; they’re waiting on ${nm(r.reviewer)}’s marks`, href: RM.quarterHref(r) }));
      const m = RV.month(me.id, cur); if (m && !m.empDone) push('due.emp', { icon: 'clipboard-list-linear', tone: '', title: `Your ${RV.monthLabel(cur)} monthly review is open`, sub: `Add your progress by ${fmt.date(RV.monthEnd(cur), { noYear: true })}`, href: RM.formHref(me.id, cur, me) });
      const pm = RV.month(me.id, prevMk); if (pm && pm.state === 'incomplete') push('incomplete.emp', { icon: 'danger-triangle-linear', tone: 'warn', title: `Your ${RV.monthLabel(prevMk)} monthly review was missed`, sub: RV.monthNote(pm).replace('Missed · ', '') + ' at month end', href: RM.formHref(me.id, prevMk, me) });
      RV.recsOf(me.id).filter((r) => RV.isLocked(r) && RM.dayDiff(new Date(r.lockedAt), RM.TODAY) <= 14).slice(-1).forEach((r) => push('completed.emp', { icon: 'lock-keyhole-minimalistic-linear', tone: 'ok', title: `Your ${sh(r)} marks are final`, sub: `Manager ${RV.markText(r, r.mgrMark)} · self ${RV.markText(r, r.selfMark)}`, href: RM.quarterHref(r) }));
    }
    // as a manager: the marks and monthly reviews that are yours to give (the Practice Head watches the practice and isn't
    // told about marks waiting on them)
    if (!q.isPH(me)) {
      RV.waitingOn(me).forEach((r) => push('submitted.mgr', { icon: 'user-check-linear', tone: '', title: `${nm(r.emp)} sent their ${sh(r)} marks`, sub: `Self ${RV.markText(r, r.selfMark)} · your marks make them final · ${RV.due(r).label}`, href: RM.quarterHref(r) }));
      RV.ownedBy(me.id).filter((r) => RV.overdue(r) && !q.isFrozen(r)).forEach((r) => { const b = blockedBy(r); push('incomplete.mgr', { icon: 'danger-triangle-linear', tone: 'warn', title: `${nm(r.emp)}’s ${sh(r)} marks were missed`, sub: (RV.needsSelf(r) ? 'Their self marks are missing' : 'Waiting on your marks') + (b ? ` · their appraisal summary waits until they’re final` : ''), href: RM.quarterHref(r) }); });
      RV.ownedBy(me.id).filter((r) => !RV.isLocked(r) && r.originalReviewer && r.originalReviewer !== me.id).forEach((r) => push('reassigned.mgr', { icon: 'transfer-horizontal-linear', tone: '', title: `You’re giving ${nm(r.emp)}’s ${sh(r)} manager marks`, sub: `Admin moved them to you from ${nm(r.originalReviewer)}`, href: RM.quarterHref(r) }));
    }
    const team = q.directs(me.id).filter(RV.inCycles);
    const fb = team.filter((p) => { const x = RV.month(p.id, cur); return x && !x.mgrDone; });
    if (fb.length) push('due.mgr', { icon: 'chat-round-line-linear', tone: '', title: `${fb.length} ${RV.monthLabel(cur)} monthly review${fb.length > 1 ? 's' : ''} to give feedback on`, sub: `${names(fb.map((p) => p.name))} · by ${fmt.date(RV.monthEnd(cur), { noYear: true })}`, href: '#/me/team?f=you' });
    const pinc = team.map((p) => ({ p, m: RV.month(p.id, prevMk) })).filter((x) => x.m && x.m.state === 'incomplete');
    if (pinc.length) push('incomplete.mgr', { icon: 'clipboard-list-linear', tone: 'warn', title: `${pinc.length} ${RV.monthLabel(prevMk)} monthly review${pinc.length > 1 ? 's' : ''} missed`, sub: pinc.map((x) => `${x.p.name} · ${RV.monthNote(x.m).replace('Missed · ', '')}`).join('; '), href: '#/me/team' });
    const scope = q.isPH(me) ? q.active().map((p) => p.id) : q.descendants(me.id).map((d) => d.p.id);
    q.upcomingAppraisals(scope).filter((x) => !x.a.report).slice(0, 3).forEach(({ p, a }) => push('appraisal.mgr', { icon: 'calendar-mark-linear', tone: '', title: `Upcoming appraisal · ${p.name}`, sub: `${fmt.date(a.anniv, { noYear: true })} · ${a.status}`, href: q.isPH(me) ? '#/ph/appraisals' : '#/me/team?f=appr' }));
    return out;
  }
  // read once, a notification stays read; a reminder comes back once the reminder frequency (Settings) has passed since it
  // was read, for as long as it's still outstanding
  const isRead = (me, n) => { const r = store.db.reads[me.id + n.title]; if (!r) return false; if (!n.remind || r === 1) return true; return RM.dayDiff(new Date(r), RM.TODAY) < (store.db.config.reminderEvery || 3); };
  function updatePip(me) { const pip = $('#pip'); if (!pip) return; const n = notifications(me).filter((x) => !isRead(me, x)).length; pip.hidden = !n; }

  /* ---------------- command palette ---------------- */
  function openCmdk() {
    const me = q.me(); if (!me || $('.cmdk')) return;
    const pages = navFor(me).filter((n) => n.href && !n.disabled).map((n) => ({ kind: 'Pages', label: n.label, sub: '', icon: n.icon, href: '#/' + n.href }));
    const people = q.all().filter((p) => (p.status === 'Active' || hasProfiles(me)) && q.canOpenProfile(me, p)).map((p) => ({ kind: 'People', label: p.name, sub: p.designation + ' · ' + p.id, person: p, id: p.id }));
    const revs = [...RV.recsOf(me.id), ...RV.ownedBy(me.id)].filter((r, i, a) => a.indexOf(r) === i && !RV.isLocked(r) && !q.isFrozen(r)).map((r) => ({ kind: 'Open marks', label: `${q.person(r.emp).name} · ${RV.quarter(r.key).short} marks`, sub: RM.statusLabel(r.status), icon: 'document-text-linear', href: RM.quarterHref(r) }));
    const all = [...pages, ...revs, ...people];
    const prev = document.activeElement;
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.style.zIndex = 95;
    const w = document.createElement('div'); w.className = 'cmdk';
    w.innerHTML = `<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Search" data-lenis-prevent><div class="cmdk-input">${ic('magnifer-linear')}<input id="cmdk-q" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" placeholder="Search people, pages, open marks…" autocomplete="off"><span class="kbd">Esc</span></div><div class="cmdk-list" id="cmdk-list" role="listbox"></div><div class="cmdk-foot"><span><span class="kbd">↑↓</span> move</span><span><span class="kbd">Enter</span> open</span><span style="margin-left:auto">${people.length} people</span></div></div>`;
    document.body.append(scrim, w); const panel = w.querySelector('.cmdk-panel'); const inp = w.querySelector('input'); const list = w.querySelector('#cmdk-list');
    let sel = 0; let shown = [];
    const hl = (s, t) => { if (!t) return esc(s); const i = s.toLowerCase().indexOf(t); return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + t.length)) + '</mark>' + esc(s.slice(i + t.length)); };
    const draw = () => {
      const t = inp.value.trim().toLowerCase();
      shown = (t ? all.filter((x) => (x.label + ' ' + x.sub).toLowerCase().includes(t)) : [...pages, ...revs.slice(0, 4), ...people.slice(0, 4)]).slice(0, 14);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      let html = ''; let lastK = '';
      shown.forEach((x, i) => { if (x.kind !== lastK) { html += `<div class="cmdk-group" role="presentation">${x.kind}</div>`; lastK = x.kind; } html += `<div class="cmdk-item" role="option" id="ck-${i}" aria-selected="${i === sel}" data-i="${i}">${x.person ? C.avatar(x.person, 'sm') : `<span class="ic">${ic(x.icon)}</span>`}<span style="min-width:0"><span style="display:block;font-weight:550">${hl(x.label, t)}</span>${x.sub ? `<span class="person-sub">${esc(x.sub)}</span>` : ''}</span><span class="meta">${x.person ? 'Profile' : 'Go'}</span></div>`; });
      list.innerHTML = html || `<div class="empty" style="padding:28px"><p>No match for “${esc(inp.value)}”. Try a first name, an ID like NVS01831, or a page name.</p></div>`;
      inp.setAttribute('aria-activedescendant', shown.length ? 'ck-' + sel : '');
      const s = list.querySelector('[aria-selected="true"]'); if (s) s.scrollIntoView({ block: 'nearest' });
    };
    const rm = () => { scrim.remove(); w.remove(); };
    const close = () => { if (!RM.reduced() && window.gsap) { gsap.to(scrim, { opacity: 0, duration: .15 }); gsap.to(panel, { opacity: 0, y: -6, duration: .15, onComplete: rm }); setTimeout(rm, 260); } else rm(); document.body.style.overflow = ''; if (prev && prev.focus) prev.focus(); };
    const pick = (x) => { close(); if (!x) return; if (x.person) app.openPerson(x.id); else location.hash = x.href; };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); } else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); } else if (e.key === 'Enter') { e.preventDefault(); pick(shown[sel]); } else if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'Tab') e.preventDefault(); });
    list.addEventListener('click', (e) => { const it = e.target.closest('[data-i]'); if (it) pick(shown[+it.dataset.i]); });
    list.addEventListener('pointermove', (e) => { const it = e.target.closest('[data-i]'); if (it && +it.dataset.i !== sel) { sel = +it.dataset.i; list.querySelectorAll('[aria-selected]').forEach((x) => x.setAttribute('aria-selected', +x.dataset.i === sel)); inp.setAttribute('aria-activedescendant', 'ck-' + sel); } });
    scrim.addEventListener('click', close);
    document.body.style.overflow = 'hidden'; // the page stays put behind the palette
    draw(); inp.focus();
    if (!RM.reduced() && window.gsap) { gsap.to(scrim, { opacity: 1, duration: .2 }); gsap.to(panel, { opacity: 1, y: 0, scale: 1, duration: .3, ease: 'power3.out' }); } else { scrim.style.opacity = 1; panel.style.opacity = 1; panel.style.transform = 'none'; }
  }

  /* ---------------- person / employee drawers ---------------- */
  app.openPerson = (id, tab) => {
    const me = q.me(); const p = q.person(id); if (!p) return;
    // Admin and the Practice Head open anyone's profile; everyone else their own and their reportees' (direct and indirect)
    if (!q.canOpenProfile(me, p) && !(p.system && q.isAdmin(me))) { O.toast('You can open your own profile and your reportees’ profiles only', { tone: 'info', icon: 'lock-keyhole-minimalistic-linear' }); return; }
    if (hasProfiles(me) && !p.system) { O.closeDrawer(true); O.closePopover(); location.hash = '#/' + profilePath(p.id, tab); return; }
    // the profile drawer (roles without the full employee profile); profileBody keeps reviews and financials to their own scopes
    O.drawer(`<div class="drawer-head"><div class="eyebrow" style="padding-top:8px">Profile</div><button class="x-btn" data-close aria-label="Close">${ic('close-circle-linear')}</button></div>
      <div class="drawer-body">${RM.profileBody(p, me, false)}</div>
      <div class="drawer-foot">${q.canEditPeople(me) ? `<button class="btn btn-primary" data-action="edit-employee" data-id="${p.id}">${ic('pen-linear')}Edit employee</button>` : ''}<button class="btn btn-secondary" data-close>Close</button></div>`, { label: p.name + ' profile' });
  };

  const ALLOCS = ['Deloitte', 'ECN', 'SFC/RFC', 'E&Y Staff-Aug', 'RSM', 'Internal'];
  const ROLES = ['PM', 'PO', 'Senior BA', 'BA', 'Practice Head', '–'];
  const tmplName = (k) => (RV.TEMPLATES[k] || {}).name || 'None';
  app.ALLOCS = ALLOCS;
  // a PO whose first reportee arrives keeps their form; it gains the reportee fields from the next quarter (RV-13, audited)
  const reporteeFields = (rmId, who, by) => {
    const rm = q.person(rmId); if (!rm) return;
    const eff = RV.syncReporteeFields(rm, RV.stamp(), by, 'Gained a reportee: ' + who.name);
    if (eff) { const f = RV.formFor(rm.id, eff) || RV.curForm(rm.id); RM.audit(by, 'Added review form fields', rm.name + ' · ' + RV.formLabel(f).toLowerCase(), 'Without reportee fields', RV.SECTIONS.reportees.name + ' from ' + RV.monthLabel(eff), 'First reportee: ' + who.name + '; from the first month of the next quarter'); }
  };
  // a template change (an override, its removal, or a new role) applies to the current form from the next quarter
  const templateChange = (p, key, by, why) => {
    const r = RV.changeTemplate(p, key, RV.stamp(), by, why); if (!r) return '';
    return `from ${RV.monthLabel(r.eff)}, the start of their next quarter`;
  };
  // shared by the Add employee drawer and CSV import: validation happens before this
  app.createEmployee = (np, by, note) => {
    const db = store.db;
    np = Object.assign({ status: 'Active', practice: 'Digital Product Studio', tile: { letter: np.name[0].toUpperCase(), bg: '#9FB8C9' } }, np);
    db.people.push(np); db.fin[np.id] = {};
    // a row for every month with figures: nothing billed before, and the latest month waiting for its upload
    const lm = q.latestMonth(); q.finMonths().forEach((mk) => { db.fin[np.id][mk] = { billable: np.alloc !== 'Internal', forecast: 0, actual: mk === lm ? null : 0 }; });
    RM.audit(by, 'Created employee', np.name + ' · ' + np.id, '–', np.role + ' · RM ' + ((q.person(np.rm) || {}).name || '–'), note);
    // the system creates their first form on the joining date, from the joining month (RV-04); none before it
    if (RV.inCycles(np)) RV.ensureForms(np, by);
    if (np.rm) reporteeFields(np.rm, np, by);
    return np;
  };
  app.editEmployee = (id) => {
    const me = q.me();
    if (!q.canEditPeople(me)) { O.toast('Only Admin can edit employee records.', { tone: 'warn' }); return; }
    const db = store.db; const p = id ? q.person(id) : null; const isNew = !p; const archived = p && p.status !== 'Active';
    const invalidRM = p ? new Set([p.id, ...q.descendants(p.id).map((d) => d.p.id)]) : new Set();
    const rmOpts = q.active().filter((x) => !invalidRM.has(x.id)).sort((a, b) => a.name.localeCompare(b.name));
    const ov = p && db.overrides[p.id];
    const nextId = 'NVS0' + (Math.max(...db.people.filter((x) => x.id.startsWith('NVS')).map((x) => +x.id.slice(3))) + 1);
    const dis = archived ? 'disabled' : '';
    const html = `<div class="drawer-head">${p ? C.avatar(p, 'lg') : `<span class="av av-lg av-system" style="background:var(--blue-50);color:var(--blue-800)">${ic('user-plus-linear')}</span>`}<div style="min-width:0"><div class="eyebrow" style="margin-bottom:6px">${isNew ? 'New employee' : esc(p.id) + (archived ? ' · archived' : '')}</div><h2 class="h2">${isNew ? 'Add employee' : esc(p.name)}</h2>${p ? `<p class="small muted">${esc(p.designation)}</p>` : '<p class="small muted">Every active employee needs a Reporting Manager.</p>'}</div><button class="x-btn" data-close aria-label="Close">${ic('close-circle-linear')}</button></div>
      <form class="drawer-body" id="emp-form" novalidate>
        ${archived ? C.notice('lock', 'archive-linear', '<b>Archived.</b> Out of new reviews and active views; their history, financial records and audit stay. Fields are read-only.', 'style="margin-bottom:18px"') : ''}
        <div class="form-grid" data-reveal>
          <div class="field span-2" id="fe-name"><label for="e-name">Full name</label><input class="input" id="e-name" value="${p ? esc(p.name) : ''}" ${dis} autofocus><span class="err">${ic('danger-circle-linear')}Enter the employee’s full name.</span></div>
          <div class="field" id="fe-id"><label for="e-id">Employee ID</label><input class="input mono" id="e-id" value="${p ? p.id : nextId}" ${isNew ? '' : 'readonly'}><span class="err">${ic('danger-circle-linear')}Use a unique ID like NVS01900.</span></div>
          <div class="field" id="fe-email"><label for="e-email">Work email</label><input class="input" id="e-email" type="email" value="${p ? esc(p.email) : ''}" ${dis}><span class="err">${ic('danger-circle-linear')}Enter a unique, valid work email.</span></div>
          <div class="field" id="fe-des"><label for="e-des">Designation</label><div class="combo"><input class="input" id="e-des" role="combobox" aria-controls="e-des-list" value="${p ? esc(p.designation) : ''}" ${dis}><div class="combo-list combo-under" id="e-des-list" role="listbox" aria-label="Designations" hidden data-lenis-prevent></div></div><span class="err">${ic('danger-circle-linear')}Add a designation.</span></div>
          <div class="field" id="fe-role"><label for="e-role">Platform role</label><select class="select" id="e-role" ${dis}>${!p ? '<option value="">Choose…</option>' : ''}${ROLES.map((r) => `<option ${p && p.role === r ? 'selected' : ''} value="${r}">${r === '–' ? 'None (outside cycles)' : r}</option>`).join('')}</select><span class="err">${ic('danger-circle-linear')}Choose a platform role.</span></div>
          <div class="field" id="fe-alloc"><label for="e-alloc">Allocation</label><select class="select" id="e-alloc" ${dis}>${ALLOCS.map((a) => `<option ${p && p.alloc === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
          <div class="field" id="fe-join"><label for="e-join">Joining date</label><input class="input" id="e-join" type="date" value="${p ? p.joined : ''}" ${isNew ? '' : 'readonly'}><span class="help">${isNew ? 'Sets the appraisal anniversary.' : 'Anniversary is fixed by joining date.'}</span><span class="err">${ic('danger-circle-linear')}Add a joining date.</span></div>
          <div class="field span-2" id="fe-rm"><label for="e-rm">Reporting manager</label><select class="select" id="e-rm" ${dis}>${!p || !p.rm ? `<option value="">${p && p.role === 'Practice Head' ? 'Practice leadership (none)' : 'Choose a Reporting Manager…'}</option>` : ''}${rmOpts.map((x) => `<option value="${x.id}" ${p && p.rm === x.id ? 'selected' : ''}>${esc(x.name)} · ${esc(x.designation)}</option>`).join('')}</select><span class="err">${ic('danger-circle-linear')}Every active employee needs an explicit Reporting Manager.</span></div>
        </div>
        <div id="emp-notices" class="stack" style="gap:10px;margin-top:16px" aria-live="polite"></div>
        <div class="divider" style="margin:22px 0"></div>
        <fieldset data-reveal style="border:0;padding:0;margin:0"><legend class="h3" style="margin-bottom:4px;padding:0">Review template</legend><p class="small muted" style="margin-bottom:12px">An override changes only the template, never the role, manager or financial access.</p>
          <div class="stack" style="gap:10px">
            <label class="check"><input type="radio" name="forms" value="default" ${!ov ? 'checked' : ''} ${dis} style="border-radius:50%"> Default for role <span class="muted small" id="def-forms"></span></label>
            <label class="check"><input type="radio" name="forms" value="override" ${ov ? 'checked' : ''} ${dis} style="border-radius:50%"> Override</label>
            <div class="form-grid" id="ov-fields" ${ov ? '' : 'hidden'} style="margin-left:27px">
              <div class="field"><label for="e-ov">Template</label><select class="select" id="e-ov" ${dis}>${Object.values(RV.TEMPLATES).map((t) => `<option value="${t.key}" ${ov && ov.template === t.key ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
              <div class="field" id="fe-ovr"><label for="e-ovr">Reason</label><input class="input" id="e-ovr" value="${ov ? esc(ov.reason) : ''}" ${dis}><span class="err">${ic('danger-circle-linear')}Overrides need a reason for the audit trail.</span></div>
            </div>
          </div></fieldset>
        <div class="divider" style="margin:22px 0"></div>
        <div class="hstack" style="justify-content:space-between;flex-wrap:nowrap" data-reveal><span><span class="h3" style="display:block">Financial access</span><span class="small muted">Comes from the platform role: Admin, Practice Head and PM only</span></span><span class="badge" id="fin-access"></span></div>
      </form>
      <div class="drawer-foot">${p && !archived ? `<button class="btn btn-danger" data-action="archive" data-id="${p.id}" style="margin-right:auto">${ic('archive-linear')}Archive</button>` : ''}<button class="btn btn-secondary" data-close>${archived ? 'Close' : 'Cancel'}</button>${archived ? '' : `<button class="btn btn-primary" id="emp-save">${isNew ? 'Create employee' : 'Save changes'}</button>`}</div>`;
    O.drawer(html, { label: isNew ? 'Add employee' : 'Edit ' + p.name, onMount: (d) => {
      const $d = (s) => d.querySelector(s);
      const notices = () => {
        const out = []; const role = $d('#e-role').value; const rm = $d('#e-rm').value;
        const def = RV.ROLE_TEMPLATE[role]; $d('#def-forms').textContent = def ? '· ' + tmplName(def) : '· none for this role';
        const finOk = ['PM', 'Practice Head'].includes(role); const fa = $d('#fin-access'); fa.className = 'badge ' + (finOk ? 'b-ok' : ''); fa.textContent = finOk ? 'Has access' : 'No access';
        if (p && rm && rm !== p.rm) {
          const open = RV.recsOf(p.id).filter((r) => !RV.isLocked(r));
          out.push(C.notice('', 'transfer-horizontal-linear', `<b>From the next quarter, ${esc(q.person(rm).name)} gives ${esc(fmt.first(p.name))}’s manager marks.</b> The manager when a quarter’s marks open gives them. ${open.length ? `${open.map((r) => esc(RV.quarter(r.key).short)).join(' and ')} stay${open.length === 1 ? 's' : ''} with ${esc(q.person(open[0].reviewer).name)} unless you change it.` : ''} Final marks, monthly reviews and the appraisal date don’t change.`));
          const rf = RV.curForm(rm); const nq = RV.nextQuarterStart(q.person(rm), RM.TODAY); if (!q.directs(rm).length && rf && RV.templateAt(rf, nq) === 'PO') out.push(C.notice('', 'clipboard-list-linear', `<b>${esc(q.person(rm).name)} gets reportee fields.</b> This is their first reportee, so their monthly reviews add ${esc(RV.SECTIONS.reportees.name.toLowerCase())} from ${esc(RV.monthLabel(nq))}, the start of their next quarter; earlier months stay as they were.`));
        }
        if (p && role !== p.role && store.db.overrides[p.id]) out.push(C.notice('warn', 'danger-triangle-linear', '<b>This employee has a template override.</b> Changing the role won’t remove it.'));
        if (p && role !== p.role && !store.db.overrides[p.id]) out.push(C.notice('', 'info-circle-linear', `They move to the new role’s template (${esc(def ? tmplName(def) : 'none')}) from ${esc(RV.monthLabel(RV.nextQuarterStart(p, RM.TODAY)))}, the start of their next quarter; earlier months and marks keep theirs. Reporting lines stay as they are.`));
        $d('#emp-notices').innerHTML = out.join('');
      };
      const des = [...new Set([...db.config.mappings.map((m) => m.designation), ...db.people.map((x) => x.designation)])].sort();
      RM.combo($d('#e-des'), {
        search: (t) => (t ? des.filter((x) => x.toLowerCase().includes(t)) : des),
        render: (x, hl) => `<span class="combo-text"><b>${hl(x)}</b></span>`,
        empty: () => 'A new designation. Admin confirms its role mapping.',
        onPick: (x) => { $d('#e-des').value = x; $d('#fe-des').classList.remove('has-error'); },
      });
      d.addEventListener('change', (e) => { if (e.target.name === 'forms') $d('#ov-fields').hidden = e.target.value !== 'override'; notices(); });
      d.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('has-error'); });
      notices();
      const save = $d('#emp-save'); if (!save) return;
      save.addEventListener('click', async () => {
        const v = (s) => $d(s).value.trim(); const err = (fid, bad) => { $d('#' + fid).classList.toggle('has-error', !!bad); return !!bad; };
        const email = v('#e-email').toLowerCase(); const nid = v('#e-id').toUpperCase(); const role = v('#e-role'); const rm = v('#e-rm');
        let bad = false;
        bad = err('fe-name', v('#e-name').length < 3) || bad;
        bad = err('fe-email', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || db.people.some((x) => x.email === email && (!p || x.id !== p.id))) || bad;
        bad = err('fe-des', !v('#e-des')) || bad;
        bad = err('fe-role', !role) || bad;
        bad = err('fe-rm', !rm && role !== 'Practice Head') || bad;
        if (isNew) { bad = err('fe-id', !/^NV[SC]\d{5}$/.test(nid) || db.people.some((x) => x.id === nid)) || bad; bad = err('fe-join', !v('#e-join')) || bad; }
        const useOv = d.querySelector('input[name="forms"]:checked').value === 'override';
        if (useOv) bad = err('fe-ovr', v('#e-ovr').length < 5) || bad;
        if (bad) { const f = d.querySelector('.has-error input, .has-error select'); if (f) f.focus(); O.toast('Fix the highlighted fields to save.', { tone: 'warn' }); return; }
        save.classList.add('is-loading'); await RM.wait(420);
        if (isNew) {
          const np = app.createEmployee({ id: nid, name: v('#e-name'), designation: v('#e-des'), role, rm: rm || null, alloc: v('#e-alloc'), joined: v('#e-join'), email }, me.id);
          if (useOv) { db.overrides[nid] = { template: v('#e-ov'), reason: v('#e-ovr'), by: me.id, at: RV.stamp().toISOString() }; RM.audit(me.id, 'Created template override', np.name, 'Default', tmplName(v('#e-ov'))); }
          store.save(); O.closeDrawer(); app.softRender();
          const f = RV.formsOf(np.id)[0];
          O.toast(`${esc(np.name)} added${f ? ` · monthly reviews start in ${esc(RV.monthLabel(f.start))}` : ''}`);
          return;
        }
        const changes = [];
        const set = (field, label, nv, fmtv) => { if (p[field] !== nv) { changes.push([label, fmtv ? fmtv(p[field]) : p[field], fmtv ? fmtv(nv) : nv]); p[field] = nv; } };
        set('name', 'name', v('#e-name')); set('email', 'email', email); set('designation', 'designation', v('#e-des'));
        const oldRole = p.role; set('role', 'role', role); set('alloc', 'allocation', v('#e-alloc'));
        const oldRm = p.rm; set('rm', 'reporting manager', rm || null, (x) => (x ? q.person(x).name : '–'));
        if (oldRm !== p.rm && oldRm) RV.recordRmChange(p, oldRm, RV.stamp());
        const curOv = db.overrides[p.id];
        if (useOv) { const nt = v('#e-ov'); if (!curOv || curOv.template !== nt || curOv.reason !== v('#e-ovr')) { const when = !curOv || curOv.template !== nt ? templateChange(p, nt, me.id, v('#e-ovr')) : ''; changes.push(['template override', curOv ? tmplName(curOv.template) : 'Default', tmplName(nt) + (when ? ' · ' + when : '')]); db.overrides[p.id] = { template: nt, reason: v('#e-ovr'), by: me.id, at: RV.stamp().toISOString() }; } }
        else if (curOv) { delete db.overrides[p.id]; const when = templateChange(p, RV.defaultTemplate(p), me.id, 'Override removed'); changes.push(['template override', tmplName(curOv.template), 'Removed, default form' + (when ? ' · ' + when : '')]); }
        if (oldRole !== p.role && !db.overrides[p.id] && RV.inCycles(p)) { const f = RV.curForm(p.id); const nt = RV.defaultTemplate(p); if (f && nt && RV.templateAt(f, RV.nextQuarterStart(p, RM.TODAY)) !== nt) templateChange(p, nt, me.id, 'Role changed to ' + p.role); }
        if (!changes.length) { save.classList.remove('is-loading'); O.toast('No changes to save', { tone: 'info' }); return; }
        changes.forEach(([label, a, b]) => RM.audit(me.id, label === 'reporting manager' ? 'Changed reporting manager' : label.includes('override') ? 'Updated template override' : 'Updated ' + label, p.name, String(a == null ? '–' : a), String(b == null ? '–' : b)));
        if (oldRole !== p.role) delete p.mapPending;
        if (changes.some(([label]) => label === 'reporting manager') && p.rm) reporteeFields(p.rm, p, me.id);
        store.save(); O.closeDrawer(); app.softRender();
        O.toast(`Saved ${changes.length} change${changes.length > 1 ? 's' : ''} to ${esc(p.name)} · audited`);
      });
    } });
  };

  /* ---------------- global actions ---------------- */
  async function act(a, el) {
    const db = store.db; const me = q.me();
    switch (a) {
      case 'open-person': return app.openPerson(el.dataset.id, el.dataset.tab);
      case 'edit-employee': return app.editEmployee(el.dataset.id);
      case 'add-employee': if (await keepFinEdits()) app.editEmployee(null); return;
      case 'import-employees': if (await keepFinEdits()) RM.imports.employees(); return;
      case 'import-fin': return RM.imports.financials();
      case 'archive': {
        if (!q.canEditPeople(me)) return;
        const p = q.person(el.dataset.id); const inflight = RV.recsOf(p.id).filter((r) => !RV.isLocked(r));
        const res = await O.modal({ icon: 'archive-linear', tone: 'bad', title: `Archive ${esc(p.name)}?`, body: `<p>${esc(fmt.first(p.name))} will be left out of new reviews and active views. ${inflight.length ? `${inflight.length} open quarter${inflight.length > 1 ? 's are' : ' is'} kept for the record but taken out of every list.` : ''} History, financial records and the audit trail stay. Nothing is deleted.</p>${q.directs(p.id).length ? C.notice('warn', 'danger-triangle-linear', `<b>${q.directs(p.id).length} people report to ${esc(fmt.first(p.name))}.</b> Assign them a new Reporting Manager afterwards.`, 'style="margin-top:12px"') : ''}`, confirm: 'Archive employee' });
        if (!res.ok) return;
        p.status = 'Archived'; RM.audit(me.id, 'Archived employee', p.name + ' · ' + p.id, 'Active', 'Archived', inflight.length ? inflight.length + ' in-flight review(s) frozen' : '');
        store.save(); O.closeDrawer(); app.softRender(); O.toast(`${esc(p.name)} archived · history retained`, { icon: 'archive-bold' });
        return;
      }
      case 'add-override': {
        const cands = q.active().filter((p) => RV.inCycles(p) && !db.overrides[p.id]).sort((x, y) => x.name.localeCompare(y.name));
        const res = await O.modal({ icon: 'tuning-2-linear', title: 'Add template override', sub: 'Gives one person a different template. Their role doesn’t change.', confirm: 'Create override',
          body: `<div class="stack"><div class="field"><label for="o-emp">Employee</label><select class="select" id="o-emp">${cands.map((p) => `<option value="${p.id}">${esc(p.name)} · ${esc(p.role)}</option>`).join('')}</select></div>
            <div class="field"><label for="o-forms">Template</label><select class="select" id="o-forms">${Object.values(RV.TEMPLATES).map((t) => `<option value="${t.key}">${esc(t.name)}</option>`).join('')}</select></div>
            <div class="field" id="f-or"><label for="o-reason">Reason</label><input class="input" id="o-reason" placeholder="e.g. Covering PM duties on the account through Q4"><span class="err">${ic('danger-circle-linear')}Add a reason (at least 10 characters).</span></div>
            <p class="small muted">${ic('info-circle-linear')} It applies from the start of the person’s next quarter (quarters follow their joining date); earlier months and marks keep their template.</p></div>`,
          validate: (m) => { const r = m.querySelector('#o-reason').value.trim(); const fe = m.querySelector('#f-or'); if (r.length < 10) { fe.classList.add('has-error'); m.querySelector('#o-reason').focus(); return false; } const emp = m.querySelector('#o-emp').value; const template = m.querySelector('#o-forms').value; if (RV.defaultTemplate(q.person(emp)) === template) { fe.classList.add('has-error'); fe.querySelector('.err').innerHTML = ic('danger-circle-linear') + 'That’s already the default form for this role.'; return false; } return { emp, template, reason: r }; } });
        if (!res.ok) return;
        const p = q.person(res.value.emp); const when = templateChange(p, res.value.template, 'ADM-0001', res.value.reason); db.overrides[p.id] = { template: res.value.template, reason: res.value.reason, by: 'ADM-0001', at: RV.stamp().toISOString() };
        RM.audit('ADM-0001', 'Created template override', p.name, tmplName(RV.defaultTemplate(p)), tmplName(res.value.template), res.value.reason + (when ? ' · ' + when : ''));
        store.save(); app.softRender(); O.toast(`Override created for ${esc(p.name)} ${esc(when)} · role unchanged (${esc(p.role)})`);
        return;
      }
      case 'remove-override': {
        const p = q.person(el.dataset.id);
        const res = await O.modal({ icon: 'tuning-2-linear', tone: 'warn', title: `Remove ${esc(fmt.first(p.name))}’s override?`, body: `<p>From ${esc(RV.monthLabel(RV.nextQuarterStart(p, RM.TODAY)))}, the start of their next quarter, ${esc(fmt.first(p.name))}’s template goes back to the default, ${esc(tmplName(RV.ROLE_TEMPLATE[p.role] === 'PO' ? RV.defaultTemplate(p) : RV.ROLE_TEMPLATE[p.role]))}. Earlier months and marks keep theirs.</p>`, confirm: 'Remove override' });
        if (!res.ok) return;
        const o = db.overrides[p.id]; delete db.overrides[p.id]; const when = templateChange(p, RV.defaultTemplate(p), 'ADM-0001', 'Override removed');
        RM.audit('ADM-0001', 'Removed template override', p.name, tmplName(o.template), 'Default' + (when ? ' · ' + when : '')); store.save(); app.softRender(); O.toast('Override removed · audited');
        return;
      }
      case 'confirm-map': {
        const m = db.config.mappings[+el.dataset.i]; if (!m || m.confirmed) return;
        const who = db.people.filter((p) => p.designation === m.designation && p.mapPending && p.status === 'Active'); const mon = RV.monthLabel(RV.curMonth());
        const res = await O.modal({ icon: 'user-check-linear', title: `Confirm ${esc(m.designation)} → ${esc(m.role)}?`, confirm: 'Confirm mapping',
          body: `<p>${who.length ? `${who.length === 1 ? 'This person joins' : 'These people join'} reviews as ${esc(m.role)}, and ${who.length === 1 ? 'their' : 'each one’s'} monthly reviews start in ${esc(mon)}:` : `Nobody holds this designation right now. Anyone who joins with it is reviewed as ${esc(m.role)}.`}</p>${who.length ? `<ul class="small" style="margin:8px 0 0 18px">${who.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ul>` : ''}<p class="small muted" style="margin-top:10px">You can undo it from the message that follows, until anyone adds a monthly review or evidence.</p>` });
        if (!res.ok) return;
        // confirm: the role sticks, the mapping-pending flag goes, and each person's first form starts this month, as at go-live
        const was = {}; who.forEach((p) => { was[p.id] = p.role; delete p.mapPending; p.role = m.role; }); m.confirmed = true;
        const forms = who.flatMap((p) => (RV.inCycles(p) ? RV.ensureForms(p, me.id, RV.curMonth()) : [])); const made = [...new Set(forms.map((f) => f.emp))].map((id) => q.person(id));
        RM.audit(me.id, 'Confirmed designation mapping', m.designation, 'Pending', m.role, made.length ? `Review forms created for ${made.map((p) => p.name).join(', ')}` : ''); store.save(); app.softRender();
        // undo, while the new forms are still empty
        const undo = () => {
          if (!m.confirmed) return;
          if (forms.some((f) => Object.keys(f.entries).length || Object.keys(f.ev || {}).length)) { O.toast('This can’t be undone now: someone has already added a monthly review or evidence.', { tone: 'warn' }); return; }
          m.confirmed = false; who.forEach((p) => { p.mapPending = true; p.role = was[p.id]; }); forms.forEach((f) => { delete db.forms[f.id]; });
          RM.audit(me.id, 'Undid designation mapping', m.designation, m.role, 'Pending', made.length ? `Review forms removed for ${made.map((p) => p.name).join(', ')}` : ''); store.save(); app.softRender();
          O.toast(`${esc(m.designation)} is back to Mapping pending${made.length ? ' · their monthly reviews are removed' : ''}`, { tone: 'info' });
        };
        O.toast(`${esc(m.designation)} → ${esc(m.role)} confirmed${made.length ? ` · monthly reviews start for ${made.length} ${made.length > 1 ? 'people' : 'person'}` : ''}`, { ms: 8000, action: { label: 'Undo', fn: undo } });
        return;
      }
      case 'reassign': { const r = RV.rec(el.dataset.id); if (r && await RM.reassignDialog(r)) app.softRender(); return; }
      case 'save-fin': { const n = RM.finEditor._commit(); if (n < 0) return; store.save(); app.softRender(); O.toast(n ? `${n} value${n > 1 ? 's' : ''} saved · audited · the dashboards show them now` : 'No changes to save', { tone: n ? '' : 'info' }); return; }
      case 'save-targets': {
        // yearly revenue targets, one per person the employee sheet gives a financial target; every change is audited
        let n = 0; let bad = false;
        RM.$$('[data-target]').forEach((inp) => {
          const id = inp.dataset.target; const v = inp.value.trim(); const nv = v === '' ? null : Math.round(parseFloat(v) * 1e5);
          if (v !== '' && (isNaN(nv) || nv < 0)) { bad = true; inp.style.boxShadow = 'inset 0 0 0 1px var(--bad), 0 0 0 4px #FBE0DD'; return; }
          const prev = db.targets[id] == null ? null : db.targets[id]; if (prev === nv) return;
          if (nv == null) delete db.targets[id]; else db.targets[id] = nv; n++;
          RM.audit(me.id, 'Updated target', RM.FY.label + ' · ' + q.person(id).name, prev == null ? 'None' : fmt.inr(prev), nv == null ? 'None' : fmt.inr(nv));
        });
        if (bad) { O.toast('Some targets aren’t valid amounts. Fix the highlighted cells.', { tone: 'warn' }); return; }
        store.save(); app.softRender(); O.toast(n ? `${n} target${n > 1 ? 's' : ''} saved · audited` : 'No changes to save', { tone: n ? '' : 'info' }); return;
      }
      case 'export-audit': {
        const rows = [['Timestamp', 'User', 'Action', 'Entity', 'Previous', 'New', 'Note']].concat(db.audit.map((x) => [x.at, x.by === 'system' ? 'System' : (q.person(x.by) || {}).name || x.by, x.action, x.entity, x.prev || '', x.next || '', x.note || '']));
        const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
        // shared pages can't download files, so the export is copied instead
        await O.modal({ icon: 'download-minimalistic-linear', title: 'Export audit trail', sub: `${db.audit.length} events as CSV. Paste into Excel or Google Sheets.`, confirm: 'Copy CSV', cancel: 'Done',
          body: `<div class="field"><label for="csv-out">CSV</label><textarea class="textarea mono" id="csv-out" readonly style="min-height:180px;font-size:12px;white-space:pre">${esc(csv)}</textarea><span class="help" id="csv-status" aria-live="polite"></span></div>`,
          validate: (m) => {
            const ta = m.querySelector('#csv-out'); const st = m.querySelector('#csv-status');
            const fallback = () => { ta.focus(); ta.select(); st.textContent = 'Copying is blocked here. The text is selected: press Ctrl+C (or Cmd+C).'; };
            try { navigator.clipboard.writeText(csv).then(() => { st.textContent = 'Copied ' + db.audit.length + ' events to your clipboard.'; }, fallback); } catch (err) { fallback(); }
            return false; // keep the panel open so the result stays visible
          } });
        return;
      }
      case 'reset-demo': {
        const res = await O.modal({ icon: 'restart-linear', tone: 'bad', title: 'Reset all demo data?', body: '<p>Every review, financial value, override and audit event you changed in this browser goes back to the seeded sample state.</p>', confirm: 'Reset data' });
        if (!res.ok) return; const id = store.session; store.reset(); if (!q.person(id)) store.session = null; O.closePopover(); shellFor = null; route(); O.toast('Demo data reset'); return;
      }
      case 'theme': RM.theme.toggle(); return;
      case 'cmdk': return openCmdk();
      case 'notifs': {
        const list = notifications(me);
        O.popover(el, `<div class="popover-head"><span class="h3">Notifications</span>${list.length ? '<button class="link-btn" style="margin-left:auto" data-action="read-all">Mark all read</button>' : ''}</div>
          <div class="list" style="max-height:60vh;overflow:auto">${list.length ? list.map((n) => `<a class="list-item" href="${n.href}" data-close-pop><span class="notif-ic ${n.tone ? 'is-' + n.tone : ''}">${ic(n.icon)}</span><span style="min-width:0"><span class="strong small" style="display:block;${isRead(me, n) ? 'font-weight:500;color:var(--ink-3)' : ''}">${esc(n.title)}</span><span class="person-sub" style="white-space:normal">${esc(n.sub)}</span></span></a>`).join('') : C.empty('bell-linear', 'All quiet', 'Nothing needs your attention right now.')}</div>`, 'Notifications');
        return;
      }
      case 'read-all': { notifications(me).forEach((n) => { store.db.reads[me.id + n.title] = RM.TODAY.toISOString(); }); store.save(); updatePip(me); O.closePopover(); O.toast('All caught up', { tone: 'info', icon: 'bell-off-bold' }); return; }
      case 'account': {
        O.popover(el, `<div class="popover-head" style="gap:12px">${C.avatar(me, 'md')}<span style="min-width:0"><span class="person-name" style="display:block">${esc(me.name)}</span><span class="person-sub">${esc(me.email)}</span></span></div>
          <div style="padding:6px 0">${!q.isAdmin(me) ? `<a class="menu-item" href="#/me/profile" data-close-pop>${ic('user-id-linear')}My profile</a>` : ''}
          <button class="menu-item" data-action="switch-account">${ic('users-group-two-rounded-linear')}Preview another role</button>
          <button class="menu-item" data-action="reset-demo">${ic('restart-linear')}Reset demo data</button>
          <div class="divider" style="margin:6px 0"></div>
          <button class="menu-item" data-action="signout">${ic('logout-2-linear')}Sign out</button></div>`, 'Account');
        return;
      }
      case 'switch-account': case 'signout': {
        if (RM.gs.dirty) { const res = await O.modal({ icon: 'danger-triangle-linear', tone: 'warn', title: 'Leave with unsaved changes?', body: '<p>Your edits on this page haven’t been saved.</p>', confirm: 'Discard & continue' }); if (!res.ok) return; RM.gs.discard(); }
        O.closePopover(); store.session = null; shellFor = null;
        if (location.hash === '#/login') route(); else location.hash = '#/login';
        if (a === 'signout') setTimeout(() => O.toast('Signed out', { tone: 'info', icon: 'logout-2-bold' }), 300);
        return;
      }
      case 'menu': {
        const ap = $('#app'); const sb = $('#sidebar'); const bar = $('.bar-menu-btn'); const side = $('.side-menu-btn'); RM.tip.hide();
        // a narrow screen: the menu slides in over the page; the button inside it closes it again
        if (narrow()) { const open = !ap.classList.contains('nav-open'); ap.classList.toggle('nav-open', open); bar.setAttribute('aria-expanded', open); (open ? side : bar).focus(); RM.tip.hide(); return; }
        // a wide one: the panel opens or closes beside the page, and this browser remembers which. The button moves with it:
        // inside the panel while it's open, in the bar while it's closed, so focus follows it
        const closed = !ap.classList.contains('nav-collapsed'); ap.classList.toggle('nav-collapsed', closed); sb.inert = closed;
        bar.setAttribute('aria-expanded', !closed); (closed ? bar : side).focus({ preventScroll: true }); RM.tip.hide(); // focus moves with the button, without its tooltip popping up
        try { localStorage.setItem(NAV_KEY, closed ? 'closed' : 'open'); } catch (e) { /* storage unavailable */ }
        const done = () => { sb.removeEventListener('transitionend', done); afterNav(); }; sb.addEventListener('transitionend', done); setTimeout(afterNav, RM.reduced() ? 0 : 420);
        return;
      }
    }
  }

  // Adding people re-renders the page. On Financial Updates that would drop unsaved values in the table, so offer to save them first.
  async function keepFinEdits() {
    const ed = RM.finEditor; if (!ed || !document.contains(ed) || !ed._dirty()) return true;
    const key = ed.dataset.key; const n = ed._dirty();
    const res = await O.modal({ icon: 'danger-triangle-linear', tone: 'warn', title: 'Save the table first?', body: `<p>${fmt.monthLabel(key)} has ${n} unsaved value${n > 1 ? 's' : ''}. Adding employees refreshes the table, so they’re saved first.</p>`, confirm: 'Save & continue' });
    if (!res.ok) return false;
    const saved = ed._commit(); if (saved < 0) return false;
    store.save(); app.softRender(); O.toast(`${saved} value${saved === 1 ? '' : 's'} saved · audited`);
    return true;
  }

  let shellBound = false;
  function bindShell() {
    if (shellBound) return; shellBound = true;
    document.addEventListener('scroll', (e) => { if (e.target.id === 'nav') RM.motion.navFade(); }, { capture: true, passive: true });
    document.body.addEventListener('click', (e) => {
      if (!$('#app')) return;
      const dirLink = e.target.closest('a[data-nav-dir]'); if (dirLink) app.navDir = +dirLink.dataset.navDir || 0; // read by route() for this one change
      if (e.target.closest('[data-close]')) { O.closeDrawer(); return; }
      if (e.target.closest('[data-close-pop]')) O.closePopover();
      const skip = e.target.closest('[data-skip]'); if (skip) { e.preventDefault(); $('#view').focus(); return; }
      const t = e.target.closest('[data-action]');
      if (t && !t.closest('.cmdk') && !['drill', 'org-pick', 'org-close'].includes(t.dataset.action)) { act(t.dataset.action, t); return; }
      const row = e.target.closest('tr[data-href], .list-item[data-href]'); if (row && !e.target.closest('button, a, input, select')) { location.hash = row.dataset.href.replace(/^#/, ''); return; }
      const ap = $('#app');
      if (e.target.closest('.nav a') && ap.classList.contains('nav-open')) shutMenu();
      else if (ap.classList.contains('nav-open') && !e.target.closest('.sidebar, .popover') && !e.target.closest('.menu-btn')) shutMenu(); // a menu opened from the drawer counts as inside it
    });
  }
  document.addEventListener('keydown', (e) => {
    const inApp = !!(q.me() && $('#app'));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { if (inApp) { e.preventDefault(); openCmdk(); } }
    else if (e.key === '/' && inApp && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('.drawer,.modal,.cmdk')) { e.preventDefault(); openCmdk(); }
    else if (e.key === 'Escape' && $('.popover')) { const a = $('.popover')._anchor; O.closePopover(); if (a) a.focus(); } // an open menu closes before the drawer behind it
    else if (e.key === 'Escape' && $('#app') && $('#app').classList.contains('nav-open')) shutMenu();
    // a chart row (an SVG group) that opens someone's profile: Enter acts like a click
    else if (e.key === 'Enter' && inApp && e.target.closest && e.target.closest('.row-g[data-action="open-person"]')) app.openPerson(e.target.closest('.row-g').dataset.id);
  });
  // the top bar paints the page background sized to the window and shifted by where the bar sits, so it lines up with
  // the fixed page layer behind it (see .topbar::before); it only moves when the layout does
  function alignBar() {
    const bar = $('.topbar'); if (!bar) return; const de = document.documentElement;
    de.style.setProperty('--tb-x', -bar.getBoundingClientRect().left + 'px'); de.style.setProperty('--vw', de.clientWidth + 'px'); de.style.setProperty('--vh', de.clientHeight + 'px');
  }
  window.addEventListener('resize', () => {
    RM.motion.segThumb(document); RM.motion.navThumb(true); alignBar();
    const ap = $('#app'); const sb = $('#sidebar'); if (!ap || !sb) return;
    sb.inert = !narrow() && ap.classList.contains('nav-collapsed');
    const mb = $('.bar-menu-btn'); if (mb) mb.setAttribute('aria-expanded', narrow() ? ap.classList.contains('nav-open') : !ap.classList.contains('nav-collapsed'));
  });

  /* ---------------- boot ---------------- */
  function boot() {
    RM.theme.init(); store.load();
    if (window.gsap && !RM.reduced()) document.documentElement.classList.add('js-motion');
    // scrolling is the browser's own: it runs off the main thread and stops when the wheel or finger does
    // (a smooth-scroll library here kept pages gliding for about 0.7s after each flick and tripled main-thread work)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { RM.motion.segThumb(document); RM.motion.navThumb(true); alignBar(); });
    if (!location.hash) location.replace('#/' + (q.me() ? landing(q.me()) : 'login'));
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.RM);
