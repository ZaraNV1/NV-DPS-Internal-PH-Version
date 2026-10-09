/* NV-DPS-Internal: views carried over from the Meridian prototype and rebuilt on this platform's data and access rules.
 * Admin dashboard, Resource Allocation and the employee profile (Admin + Practice Head), My Financials (PM only). */
(function (RM) {
  'use strict';
  const { esc, ic, q, fmt, C } = RM;
  const V = RM.views = RM.views || {};
  const store = RM.store; const RV = RM.RV;

  /* ---------- shared list cards ---------- */
  // marks that need someone to act: missed (past the due date) first, then waiting on a manager's marks, then changes asked for, then self marks
  function attentionList(recs, limit) {
    const rank = (r) => (RV.overdue(r) ? 0 : RV.needsMgr(r) ? 1 : r.status === 'Changes Requested' ? 2 : r.status === 'Draft' ? 3 : 4);
    return recs.filter((r) => !RV.isLocked(r) && !q.isFrozen(r)).sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key) || q.person(a.emp).name.localeCompare(q.person(b.emp).name)).slice(0, limit || 6);
  }
  function attentionCard(recs, title, href, empty) {
    const list = attentionList(recs);
    return `<div class="card" data-reveal>
      <div class="card-head"><h2 class="h3">${esc(title)}</h2>${href ? `<a class="spacer link-btn" href="${href}">See all ${ic('arrow-right-linear')}</a>` : ''}</div>
      <div class="list">${list.length ? list.map((r) => { const p = q.person(r.emp); const d = RV.due(r); const qq = RV.quarter(r.key); return C.linkRow(RM.quarterHref(r), `Open ${p.name}’s ${qq.short} marks`, `
        ${C.avatar(p, 'sm')}<span style="min-width:0;flex:1"><span class="person-name">${C.who(p)}</span><span class="person-sub">${esc(qq.short)} · manager ${C.who(q.person(r.reviewer))}</span></span>
        <span class="meta att-meta">${C.status(r.status, false, RV.incomplete(r))}<span class="tiny ${d.over ? 'due-over' : d.soon ? 'due-soon' : ''}">${d.label}</span></span>`); }).join('')
        : `<p class="small muted" style="padding:6px 22px 20px">${esc(empty || 'Nothing needs attention right now.')}</p>`}</div>
    </div>`;
  }
  RM.attentionCard = attentionCard;
  // the same categories as the Audit Trail's filters (RM.auditCat in views-org.js)
  const AUDIT_ICON = { Financial: 'wallet-money-linear', Configuration: 'tuning-2-linear', People: 'users-group-rounded-linear' };
  const auditIcon = (a) => { const c = RM.auditCat(a); return c === 'Reviews' ? (/appraisal/i.test(a.action) ? 'cup-star-linear' : 'clipboard-check-linear') : AUDIT_ICON[c]; };
  function auditCard(limit) {
    const list = store.db.audit.slice(0, limit || 5);
    return `<div class="card" data-reveal>
      <div class="card-head"><h2 class="h3">Recent audit activity</h2><a class="spacer link-btn" href="#/admin/audit">Audit Trail ${ic('arrow-right-linear')}</a></div>
      <div class="list">${list.map((a) => { const u = a.by === 'system' ? null : q.person(a.by); return `<div class="list-item" style="align-items:flex-start">
        <span class="notif-ic">${ic(auditIcon(a))}</span><span style="min-width:0;flex:1"><span class="strong small" style="display:block">${esc(RM.plain(a.action))}</span><span class="person-sub" style="white-space:normal">${RM.auditEntity(a.entity)} · ${u ? C.who(u) : 'System'}</span></span>
        <span class="meta tiny">${fmt.rel(a.at)}</span></div>`; }).join('')}</div>
    </div>`;
  }

  /* ================= ADMIN DASHBOARD ================= */
  V.adminOverview = {
    title: 'Dashboard',
    render({ me }) {
      const act = q.active(); const lm = q.latestMonth();
      return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">Admin console · overview</div>
        <h1 class="display" data-split>Welcome, <em class="accent">${esc(fmt.first(me.name))}</em><span class="dot-o">.</span></h1>
        <p class="lede">People, quarterly reviews, financial uploads and appraisals across the Digital Product Studio, in one place.</p></div>
        <div class="head-actions"><a class="btn btn-secondary" href="#/admin/people">${ic('users-group-rounded-linear')}People</a><button class="btn btn-secondary" data-action="import-employees">${ic('upload-minimalistic-linear')}Import employees</button><button class="btn btn-primary" data-action="add-employee">${ic('user-plus-linear')}Add employee</button></div></header>
      ${RM.adminKpis()}
      <section class="section">
        <div class="section-head"><div><h2 class="h2">Billability</h2><p>${fmt.monthLabel(lm)}, the latest month with figures.</p></div><a class="spacer link-btn" href="#/admin/finance">Financial Updates ${ic('arrow-right-linear')}</a></div>
        ${C.billability(act.map((p) => p.id), { scope: 'Digital Product Studio', month: lm })}
      </section>
      <section class="section grid g-2" style="align-items:start">
        ${attentionCard(RV.recs(), 'Marks needing attention', '#/admin/reviews?f=marks', 'Every quarter’s marks are on track.')}
        ${auditCard(6)}
      </section></div>`;
    },
  };

  /* ================= RESOURCE ALLOCATION ================= */
  // Allocation status tags (Available / Partially Allocated / Fully Allocated / Inactive) are parked, not deleted.
  // Everything stays wired: RM.allocStatus (data.js), the tones below and the glossary cards (tags.js).
  // To bring the tags back, set SHOW_ALLOC_TAGS to true.
  const SHOW_ALLOC_TAGS = false;
  // Allocation percentage (profile header chip, "Allocation" field, "Share of allocation" project column) is parked the same way.
  // The data stays in RM.RESOURCE (data.js). To bring it back, set SHOW_ALLOC_PCT to true.
  const SHOW_ALLOC_PCT = false;
  const ALLOC_TONE = { 'Fully Allocated': 'b-warn', 'Partially Allocated': 'b-info', 'Available': 'b-ok', 'Inactive': '' };
  const allocBadge = (s) => (SHOW_ALLOC_TAGS ? `<span class="badge ${ALLOC_TONE[s] || ''}">${s}</span>` : '');
  const raBase = (me) => (q.isPH(me) ? '#/ph/resources' : '#/admin/resources');
  const profileHref = (id) => '#/people/' + id; // the employee profile (Admin and Practice Head)
  const raScope = () => store.db.people.slice().sort((a, b) => a.name.localeCompare(b.name));
  // client: Deloitte, the other client by name, or for the non-billable, internal / investment work or the bench
  const clientCell = (p) => { const c = RM.clientOf(p); const bench = c.k === 'internal' && RM.useOf(p) === 'bench';
    return `<span class="client-cell"><i class="bl-sw ${bench ? 'bl-b' : c.cls}"></i><span><b>${esc(bench ? 'Bench' : c.name)}</b><small>${esc(bench ? 'No project · non-billable' : c.group)}</small></span></span>`; };
  RM.clientCell = clientCell;
  // the ongoing project's start date, and how long the person has been on it
  const startCell = (p) => { const d = RM.projectSince(p); return d ? fmt.monthYear(d) : '<span class="faint">–</span>'; };
  const ageCell = (p) => { const d = RM.projectSince(p); if (!d) return '<span class="faint">–</span>'; const m = fmt.monthsSince(d); return `<span class="${m >= 24 ? 'strong' : ''}">${fmt.age(m)}</span>`; };
  function raRows(me, list) {
    if (!list.length) return `<tr><td colspan="7">${C.empty('magnifer-linear', 'No one matches', 'Try another name, role, client, location or project.')}</td></tr>`;
    return list.map((p) => { const r = RM.resourceOf(p.id); return `<tr class="is-clickable ${p.status !== 'Active' ? 'is-archived' : ''}" data-href="${profileHref(p.id)}">
      <td>${C.person(p, esc(p.id) + ' · ' + esc(p.designation), { size: 'sm', link: true })}</td>
      <td class="small hide-md">${esc(r.location)}</td>
      <td class="nowrap">${clientCell(p)}</td>
      <td class="small ra-proj">${r.projects.length ? esc(r.projects.join(', ')) : '<span class="faint">None</span>'}</td>
      <td class="small num nowrap">${startCell(p)}</td>
      <td class="small num nowrap">${ageCell(p)}</td>
      <td class="r"><a class="btn btn-ghost btn-sm btn-icon" href="${profileHref(p.id)}" aria-label="Open ${esc(p.name)}’s employee profile">${ic('eye-linear')}</a></td></tr>`; }).join('');
  }
  // The resource allocation table: its toolbar (search, Billable | Non-billable, Role, Client, Location, Project, count) and its rows,
  // A to Z. Resource Allocation shows every row; the Practice Overview shows the same table as "Employee-wise project
  // allocation", 8 rows at a time with Show all. Each page keeps its own filters, and they survive a trip into a profile and back.
  // use: the cards (billable / internal / bench) and the toggle ('nonbillable' is internal and bench together)
  const raNew = () => ({ q: '', use: 'all', role: 'all', client: 'all', loc: 'all', project: 'all', every: false, lastId: null });
  // the role filter's groups: the product roles (PO, PM and BA, the Practice Head with them), UX and design titles, contractors
  const ROLE_GROUPS = [['core', 'PO, PM & BA'], ['ux', 'UX'], ['con', 'Consultants']];
  const roleGroup = (p) => (p.contractor ? 'con' : /\bUX\b|Designer/i.test(p.designation) ? 'ux' : 'core');
  const raState = raNew();
  RM.raStates = { ra: raState, dps: raNew() };
  const useMatch = (p, use) => use === 'all' || (use === 'nonbillable' ? RM.useOf(p) !== 'billable' : RM.useOf(p) === use);
  // non-billable people bill no client or client project, so the Client and Project filters hide while Non-billable is on
  // (and go back to All, so nothing hidden keeps narrowing the list)
  const billOff = (st) => st.use === 'nonbillable';
  // (each select is drawn as an .xsel dropdown: its label is refreshed here, and the CSS hides it with the hidden select)
  const syncNonBill = (root, P, st) => ['client', 'project'].forEach((k) => {
    const el = root.querySelector(`#${P}-${k}`); if (!el) return; const off = billOff(st);
    if (off && el.value !== 'all') { el.value = 'all'; const v = el.parentElement.querySelector('.xsel-val'); if (v) v.textContent = el.options[el.selectedIndex].textContent; }
    if (off) st[k] = 'all'; el.hidden = off;
  });
  const raMatch = (p, st) => { const s = st.q.trim().toLowerCase(); return (!s || p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s))
    && useMatch(p, st.use)
    && (st.role === 'all' || roleGroup(p) === st.role)
    && (st.client === 'all' || billOff(st) || RM.clientKey(p) === st.client)
    && (st.loc === 'all' || RM.resourceOf(p.id).location === st.loc)
    && (st.project === 'all' || billOff(st) || RM.resourceOf(p.id).projects.includes(st.project)); };
  const raFilter = (all, st) => all.filter((p) => raMatch(p, st));
  const raActive = (st) => !!st.q.trim() || ['use', 'role', 'client', 'loc', 'project'].some((k) => st[k] !== 'all');
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label || v)}</option>`;
  // the Billable | Non-billable toggle: pressed only when it is the filter. Non-billable is Investment and Bench together, so
  // the Investment or Bench card (one of the two) leaves it unpressed
  const raToggle = (all, st) => `<div class="filter-pills ra-bill" role="group" aria-label="Billability">${[['billable', 'Billable'], ['nonbillable', 'Non-billable']].map(([k, l]) => `<button type="button" class="fpill" data-bill="${k}" aria-pressed="${st.use === k}">${l} <span class="n">${all.filter((p) => useMatch(p, k)).length}</span></button>`).join('')}</div>`;
  // opt.limit: rows shown until Show all (the Practice Overview's 8)
  const raShown = (list, st, o) => (o.limit && !st.every ? list.slice(0, o.limit) : list);
  const raFoot = (list, st, o) => (o.limit && list.length > o.limit ? `<div class="table-foot"><span>Showing ${raShown(list, st, o).length} of ${list.length} · A to Z</span><button type="button" class="link-btn" style="margin-left:auto" data-ra-every>${st.every ? 'Show fewer' : 'Show all ' + list.length}</button></div>` : '');
  // o.p prefixes the element IDs (one table per page)
  function raTable(me, st, o) {
    const P = o.p; const all = raScope(); const list = raFilter(all, st);
    return `${raToolbar(P, all, st, `${list.length} of ${all.length}`)}
        <div class="table-wrap"><table class="table ra-table"><thead><tr><th>Employee</th><th class="hide-md">Location</th><th>Client</th><th>Projects</th><th>Start date</th><th>Ageing</th><th><span class="sr-only">Open</span></th></tr></thead>
        <tbody id="${P}-rows">${raRows(me, raShown(list, st, o))}</tbody></table></div>
        <div id="${P}-foot">${raFoot(list, st, o)}</div>`;
  }
  // the toolbar: search, Billable | Non-billable, Role, Client, Location, Project and the count (P prefixes the IDs). The
  // Clusters table on Financial Performance has the same one (RM.raFilters)
  function raToolbar(P, all, st, count) {
    const projects = [...new Set(all.flatMap((p) => RM.resourceOf(p.id).projects))].sort();
    const locations = [...new Set([...RM.LOCATIONS, ...all.map((p) => RM.resourceOf(p.id).location)])]; // the practice's locations, plus any "Not set"
    return `<div class="toolbar">
          <label class="search-field"><span class="sr-only">Search people</span>${ic('magnifer-linear')}<input type="search" id="${P}-q" placeholder="Search name or ID…" autocomplete="off" value="${esc(st.q)}"></label>
          <div class="ra-bill-box" id="${P}-bill">${raToggle(all, st)}</div>
          <label class="sr-only" for="${P}-role">Role</label><select class="select ra-select" id="${P}-role">${opt('all', st.role, 'All roles')}${ROLE_GROUPS.map(([v, l]) => opt(v, st.role, `${l} · ${all.filter((p) => roleGroup(p) === v).length}`)).join('')}</select>
          <label class="sr-only" for="${P}-client">Client</label><select class="select ra-select" id="${P}-client"${billOff(st) ? ' hidden' : ''}>${opt('all', st.client, 'All clients')}${RM.clientOptions(all).map(([v, l]) => opt(v, st.client, l)).join('')}</select>
          <label class="sr-only" for="${P}-loc">Location</label><select class="select ra-select" id="${P}-loc">${opt('all', st.loc, 'All locations')}${locations.map((l) => opt(l, st.loc)).join('')}</select>
          <label class="sr-only" for="${P}-project">Project</label><select class="select ra-select" id="${P}-project"${billOff(st) ? ' hidden' : ''}>${opt('all', st.project, 'All projects')}${projects.map((x) => opt(x, st.project)).join('')}</select>
          <span class="small muted num" id="${P}-count" style="margin-left:auto" aria-live="polite">${count}</span>
        </div>`;
  }
  // wires a toolbar: each change updates st and calls apply ('quick' while typing); Billable | Non-billable: pressing the
  // side that's already on goes back to no filter
  function raWire(root, P, st, apply) {
    const $id = (x) => root.querySelector(`#${P}-${x}`); const sel = ['role', 'client', 'loc', 'project'];
    const read = () => { st.q = $id('q').value; sel.forEach((k) => { st[k] = $id(k).value; }); };
    $id('q').addEventListener('input', () => { read(); apply('quick'); });
    sel.forEach((k) => $id(k).addEventListener('change', () => { read(); apply(); }));
    $id('bill').addEventListener('click', (e) => { const b = e.target.closest('[data-bill]'); if (!b) return; st.use = st.use === b.dataset.bill ? 'all' : b.dataset.bill; read(); syncNonBill(root, P, st); $id('bill').querySelectorAll('[data-bill]').forEach((x) => x.setAttribute('aria-pressed', st.use === x.dataset.bill)); apply(); });
  }
  // o.cards: the container of the page's use cards ([data-use]); picking the selected card again goes back to everyone
  function mountRaTable(root, me, st, o) {
    const P = o.p; const $id = (x) => root.querySelector(`#${P}-${x}`);
    const qEl = $id('q'), rEl = $id('role'), cEl = $id('client'), lEl = $id('loc'), pEl = $id('project'), rowsEl = $id('rows');
    const cards = o.cards ? root.querySelector(o.cards) : null;
    // back from a profile opened here: scroll to that row and flash it
    const from = (RM.app.fromHash || '').split('?')[0];
    if (st.lastId && from === profileHref(st.lastId)) {
      const row = rowsEl.querySelector(`tr[data-href="${profileHref(st.lastId)}"]`);
      if (row) { const y = Math.max(0, row.getBoundingClientRect().top + window.scrollY - innerHeight * .42); window.scrollTo(0, y); row.classList.add('is-flash'); }
    }
    st.lastId = null;
    rowsEl.addEventListener('click', (e) => { const row = e.target.closest('tr[data-href]'); if (row) st.lastId = row.dataset.href.split('/').pop(); });
    // the cards, toggle and count answer at once; the rows swap with the shared transition (RM.swapRows), lighter while typing,
    // and Show all / fewer only glides the height
    const apply = (mode) => {
      st.q = qEl.value; st.role = rEl.value; st.client = cEl.value; st.loc = lEl.value; st.project = pEl.value; syncNonBill(root, P, st); if (mode !== 'grow') st.every = false;
      const all = raScope(); const list = raFilter(all, st);
      $id('count').textContent = `${list.length} of ${all.length}`;
      if (cards) cards.querySelectorAll('[data-use]').forEach((b) => { const on = b.dataset.use === st.use; b.setAttribute('aria-pressed', on); b.closest('.kpi').classList.toggle('is-selected', on); });
      $id('bill').querySelectorAll('[data-bill]').forEach((b) => b.setAttribute('aria-pressed', st.use === b.dataset.bill));
      RM.tip.hide();
      RM.swapRows(rowsEl, raRows(me, raShown(list, st, o)), { mode: mode || 'swap', after: () => { $id('foot').innerHTML = raFoot(list, st, o); RM.motion.charts(rowsEl); } });
    };
    qEl.addEventListener('input', () => apply('quick')); [rEl, cEl, lEl, pEl].forEach((el) => el.addEventListener('change', () => apply()));
    if (cards) cards.addEventListener('click', (e) => { const b = e.target.closest('[data-use]'); if (!b) return; const k = b.dataset.use; st.use = k === st.use && k !== 'all' ? 'all' : k; apply(); });
    // Billable | Non-billable: pressing the side that's already on goes back to no filter
    $id('bill').addEventListener('click', (e) => { const b = e.target.closest('[data-bill]'); if (!b) return; st.use = st.use === b.dataset.bill ? 'all' : b.dataset.bill; apply(); });
    $id('foot').addEventListener('click', (e) => {
      if (!e.target.closest('[data-ra-every]')) return; st.every = !st.every; apply('grow');
      if (!st.every) $id('rows').closest('.card').scrollIntoView({ block: 'nearest' }); // showing fewer: keep the table in view
    });
  }
  RM.raTable = { render: raTable, mount: mountRaTable };
  RM.raFilters = { state: raNew, match: raMatch, active: raActive, toolbar: raToolbar, wire: raWire };
  V.resources = {
    title: 'Resource Allocation',
    render({ me }) {
      const all = raScope(); const st = raState;
      // each card filters the table to how people are used (Total employees shows everyone); the Billable | Non-billable toggle
      // is a filter of its own (Non-billable: Investment and Bench together)
      const tile = (k, label, icon, n, sub) => C.kpi({ label, icon, value: C.count(n), sub, extra: `${C.pick()}<button type="button" class="kpi-link" data-use="${k}" aria-pressed="${st.use === k}" aria-label="${esc(label)}: show ${k === 'all' ? 'everyone' : 'only these people'}"></button>` })
        .replace('class="kpi', `class="kpi is-filter is-use-${k}${st.use === k ? ' is-selected' : ''}`);
      return `<div class="page">
      <header class="page-head"><div><h1 class="display" data-split>Resource <em class="accent">Allocation</em><span class="dot-o">.</span></h1></div></header>
      <section class="kpis" id="ra-tiles">
        ${tile('all', 'Total employees', 'users-group-rounded-linear', all.length, '')}
        ${RM.USE.map((u) => tile(u.k, u.label, u.icon, all.filter((p) => RM.useOf(p) === u.k).length, '')).join('')}
      </section>
      <section class="section card" data-reveal>${raTable(me, st, { p: 'ra' })}</section></div>`;
    },
    mount(root, { me }) { mountRaTable(root, me, raState, { p: 'ra', cards: '#ra-tiles' }); },
  };
  const RA_TABS = [{ key: 'overview', label: 'Overview' }, { key: 'projects', label: 'Project allocation' }, { key: 'reviews', label: 'Reviews' }, { key: 'pay', label: 'Salary &amp; appraisals' }];
  // the Practice Head isn't on client projects or in review cycles, so their profile leaves those two tabs out
  const tabsFor = (p) => (q.isPH(p) ? RA_TABS.filter((t) => t.key !== 'projects' && t.key !== 'reviews') : RA_TABS);
  const moneyParts = (v) => { const [n, u] = fmt.inr(v).split(' '); return { value: n, unit: u || '' }; };
  const pct1 = (v) => (v == null ? '–' : (Math.round(v * 1000) / 10).toFixed(1) + '%');
  function raPanel(me, p, tab, v) {
    const r = RM.resourceOf(p.id); const rm = q.person(p.rm);
    const field = (icon, label, value) => `<div class="field-item"><div class="field-item-label">${ic(icon)}${label}</div><div class="field-item-value">${value}</div></div>`;
    if (tab === 'projects') return projectsPanel(p, r);
    if (tab === 'reviews') return reviewsPanel(me, p);
    if (tab === 'pay') return payPanel(p);
    const since = RM.projectSince(p); const directs = q.directs(p.id); const notSet = '<span class="muted" style="font-weight:450">Not set</span>';
    return `<div class="stack">
      <div class="card info-panel" data-reveal style="--accent:var(--info-dot)">
        <div class="info-head"><span class="info-ic" style="background:var(--info-bg);color:var(--info)">${ic('users-group-rounded-linear')}</span><div><div class="h3">Role and reporting</div><div class="small muted">Where this person sits in the practice</div></div></div>
        <div class="field-grid">${field('user-id-linear', 'Employee ID', esc(p.id))}${field('case-linear', 'Designation', esc(p.designation) + (p.mapPending ? ' <span class="badge b-warn" data-tip="Designation → review role mapping awaits Admin confirmation">Mapping pending</span>' : ''))}
          ${field('star-linear', 'Level', p.level ? esc(p.level) : notSet)}${field('lightbulb-bolt-linear', 'Primary skill', p.skill ? esc(p.skill) : notSet)}
          ${field('buildings-2-linear', 'Practice', esc(p.practice))}
          ${field('user-check-linear', 'Reporting manager', rm ? `<button class="link-btn" data-action="open-person" data-id="${rm.id}">${esc(rm.name)}</button>` : p.rmExternal ? `${esc(p.rmExternal)} <span class="muted" style="font-weight:450">· outside the practice</span>` : 'Practice leadership')}${field('users-group-rounded-linear', 'Direct reportees', directs.length ? `<span class="hstack" style="gap:8px">${C.avLinks(directs.slice(0, 5))}${directs.length}</span>` : '<span class="muted">None</span>')}
          ${field('target-linear', 'Financial target', p.finTarget == null ? notSet : p.finTarget ? 'Yes' : 'No')}${field('letter-linear', 'Work email', `<a class="link-btn" href="mailto:${esc(p.email)}">${esc(p.email)}</a>`)}</div>
      </div>
      <div class="card info-panel" data-reveal style="--accent:var(--orange)">
        <div class="info-head"><span class="info-ic" style="background:var(--orange-50);color:var(--orange-ink)">${ic('pie-chart-2-linear')}</span><div><div class="h3">Allocation summary</div><div class="small muted">${SHOW_ALLOC_PCT ? 'Capacity and client for this period' : 'Client, location and project for this period'}</div></div></div>
        <div class="field-grid">${field('map-point-linear', 'Location', r.location === 'Not set' ? notSet : esc(r.location))}${field('calendar-linear', 'Joined', fmt.date(p.joined))}${SHOW_ALLOC_PCT ? field('pie-chart-2-linear', 'Allocation', r.allocation + '%') : ''}${field('case-linear', 'Client allocation', esc(p.alloc === '–' ? 'None' : p.alloc))}${SHOW_ALLOC_PCT ? '' : field('buildings-2-linear', 'Client group', esc(RM.useOf(p) === 'bench' ? 'Bench · no project' : { deloitte: 'Deloitte', other: 'Non-Deloitte client', internal: 'Investment / Internal' }[RM.clientOf(p).k]))}
          ${field('folder-with-files-linear', 'Current project', r.projects.length ? esc(r.projects.join(', ')) + (r.code ? ` <span class="muted num" style="font-weight:450">· ${esc(r.code)}</span>` : '') : 'None recorded')}${field('clock-circle-linear', 'Current project ageing', since ? `${fmt.age(fmt.monthsSince(since))} <span class="muted" style="font-weight:450">· since ${fmt.monthYear(since)}</span>` : '–')}</div>
      </div></div>`;
  }
  // project allocation: the billing rate, with profitability right under the projects for billable work
  function projectsPanel(p, r) {
    const rate = RM.rateOf(p);
    const projects = `<div class="card" data-reveal><div class="card-head"><h2 class="h3">Assigned projects</h2><span class="spacer small muted">${r.projects.length}</span></div>
      ${r.projects.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Project</th><th>Role on project</th>${SHOW_ALLOC_PCT ? '<th class="r">Share of allocation</th>' : ''}<th>Rate</th><th>Start date</th><th>Ageing</th><th>Status</th></tr></thead><tbody>${r.projects.map((pr) => `<tr><td><span class="hstack" style="gap:10px;flex-wrap:nowrap"><span class="notif-ic">${ic('folder-with-files-linear')}</span><span style="min-width:0"><span class="strong" style="display:block">${esc(pr)}</span>${r.code ? `<span class="person-sub num">Project code ${esc(r.code)}</span>` : ''}</span></span></td><td class="small">${esc(p.designation)}</td>${SHOW_ALLOC_PCT ? `<td class="r num">${Math.round(r.allocation / r.projects.length)}%</td>` : ''}
        <td class="nowrap">${rate ? `<span class="strong num">${fmt.rate(rate)}</span><span class="person-sub">40 hours a week</span>` : '<span class="faint small">Not billed</span>'}</td>
        <td class="small num nowrap">${startCell(p)}</td><td class="small num nowrap">${ageCell(p)}</td><td><span class="badge b-ok">Active</span></td></tr>`).join('')}</tbody></table></div>`
        : C.empty('folder-with-files-linear', 'Not assigned to a project', SHOW_ALLOC_PCT ? 'This person has open capacity for new work.' : 'No project assignment is recorded for this period.')}</div>`;
    return `<div class="stack">${projects}${rate && r.projects.length ? profitCard(p, r.projects[0]) : ''}</div>`;
  }
  // what the company has made on this person since they joined the project: billed at the rate, less their CTC, by year
  function profitCard(p, project) {
    const x = RM.profitability(p); if (!x) return '';
    const first = esc(fmt.first(p.name)); const nowFy = RM.TODAY.getMonth() >= 3 ? RM.TODAY.getFullYear() : RM.TODAY.getFullYear() - 1;
    const months = (m) => (m < 0.5 ? '<1' : Math.round(m));
    const stat = (label, value, sub, cls) => `<div class="field-item"><div class="field-item-label">${label}</div><div class="field-item-value num ${cls || ''}">${value}</div>${sub ? `<div class="tiny muted" style="margin-top:3px">${sub}</div>` : ''}</div>`;
    const bar = (m) => `<span class="pf-margin"><span class="meter"><i style="width:${Math.max(0, Math.min(100, (m || 0) * 100)).toFixed(1)}%"></i></span><b class="num ${m < 0 ? 'cell-var neg' : ''}">${pct1(m)}</b></span>`;
    return `<div class="card pf-card" data-reveal>
      <div class="card-head"><div><h2 class="h3">NV-DPS’s margin on this project</h2><p class="small muted" style="margin-top:3px">${esc(project)} · ${fmt.rate(x.rate)} · since ${fmt.monthYear(x.since)}</p></div></div>
      <div class="card-body"><p class="pf-intro">${first} joined <b>${esc(project)}</b> in ${fmt.monthYear(x.since)}, billed at <b>${fmt.rate(x.rate)}</b> for ${x.hours} hours a week: about ${fmt.usd(x.usdMonth)} (${fmt.inr(x.revMonth)}) a month.</p>
      <div class="pf-stats">
        ${stat('Billed since joining', fmt.usd(x.total.usd), fmt.inr(x.total.inr))}
        ${stat('CTC cost since joining', fmt.inr(x.total.cost), months(x.total.months) + ' months on the project')}
        ${stat('Profit since joining', fmt.inr(x.total.profit), pct1(x.total.margin) + ' margin', 'cell-var ' + fmt.varCls(x.total.profit))}
        ${stat('Current margin', pct1(x.current), `${fmt.inr(x.revMonth)} billed, ${fmt.inr(x.costMonth)} CTC a month`)}
      </div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Year</th><th class="r">Months</th><th class="r">Billed</th><th class="r">CTC cost</th><th class="r">Profit</th><th>Margin</th></tr></thead>
        <tbody>${x.years.map((y) => `<tr><td class="nowrap strong">${y.label}${y.fy === nowFy ? ' <span class="muted" style="font-weight:450">to date</span>' : ''}</td><td class="r num">${months(y.months)}</td><td class="r num">${fmt.usd(y.usd)}<span class="person-sub">${fmt.inr(y.inr)}</span></td><td class="r num">${fmt.inr(y.cost)}</td><td class="r num cell-var ${fmt.varCls(y.profit)}">${fmt.inr(y.profit)}</td><td>${bar(y.margin)}</td></tr>`).join('')}
          <tr class="pf-now"><td class="nowrap strong">Current</td><td class="r num muted">a month</td><td class="r num">${fmt.usd(x.usdMonth)}<span class="person-sub">${fmt.inr(x.revMonth)}</span></td><td class="r num">${fmt.inr(x.costMonth)}</td><td class="r num cell-var ${fmt.varCls(x.revMonth - x.costMonth)}">${fmt.inr(x.revMonth - x.costMonth)}</td><td>${bar(x.current)}</td></tr></tbody></table></div>
    </div>`;
  }
  // reviews: the person's review history; their Review page has the rest
  function reviewsPanel(me, p) {
    if (!RV.formsOf(p.id).length) return `<div class="stack"><div class="card" data-reveal>${C.empty('clipboard-list-linear', 'Nothing yet', p.contractor ? 'Contractors aren’t in reviews.' : p.mapPending ? 'Their role mapping is pending; reviews start once it’s confirmed.' : RV.inCycles(p) ? 'Monthly reviews start in the month they join.' : 'This role isn’t in reviews.')}</div></div>`;
    return RM.historyTab(me, p.id, {}, { profile: true });
  }
  // salary & appraisal history: starting CTC, then each anniversary's rating, increment and new CTC
  function payPanel(p) {
    const list = RM.salaryHistory(p); const start = list[0]; const now = list[list.length - 1]; const apprs = list.filter((e) => e.kind === 'appraisal'); const last = apprs[apprs.length - 1];
    const j = new Date(p.joined); let next = new Date(RM.TODAY.getFullYear(), j.getMonth(), j.getDate()); if (next <= RM.TODAY) next = new Date(RM.TODAY.getFullYear() + 1, j.getMonth(), j.getDate());
    const s = moneyParts(start.ctc), c = moneyParts(now.ctc); const inc = (v) => '+' + (v % 1 ? v.toFixed(1) : v) + '%';
    return `<div class="stack">
      <section class="kpis">
        ${C.kpi({ label: 'Starting CTC', icon: 'wallet-money-linear', value: s.value, unit: s.unit, sub: `A year · joined ${fmt.monthYear(start.date)}` })}
        ${C.kpi({ label: 'Current CTC', icon: 'wallet-money-linear', value: c.value, unit: c.unit, sub: (() => { const pp = RM.payParts(p, now.ctc); return pp.variable ? `A year · ${fmt.inr(pp.inHand)} in-hand + ${fmt.inr(pp.variable)} variable a month` : `A year · ${fmt.inr(pp.inHand)} a month`; })() })}
        ${C.kpi({ label: 'Growth since joining', icon: 'graph-up-linear', value: apprs.length ? inc(Math.round((now.ctc / start.ctc - 1) * 1000) / 10) : '–', sub: `${apprs.length} ${apprs.length === 1 ? 'appraisal' : 'appraisals'}` })}
        ${C.kpi({ label: p.contractor ? 'Appraisals' : 'Next appraisal', icon: 'calendar-mark-linear', value: p.contractor ? 'None' : fmt.date(next), sub: p.contractor ? 'Contractor' : last ? `Last: ${inc(last.inc)} in ${fmt.monthYear(last.date)}` : 'The first one is on their work anniversary' })}
      </section>
      ${p.contractor ? C.notice('', 'info-circle-linear', '<b>Contractor.</b> Paid a consulting fee with no annual appraisal, so there is no increment history.', 'data-reveal') : ''}
      ${list.length >= 2 ? `<div class="card" data-reveal><div class="card-head"><h2 class="h3">Annual CTC after each appraisal</h2></div><div class="card-body">${RM.charts.lines([{ name: 'CTC', color: 'var(--viz-1)', values: list.map((e) => e.ctc) }], list.map((e) => String(e.date.getFullYear())), { yFmt: (v) => fmt.inr(v).replace(' L', 'L').replace(' Cr', 'Cr'), h: 220, padL: 62, padR: 52, label: 'Annual CTC after each appraisal' })}</div></div>` : ''}
      <div class="card" data-reveal><div class="card-head"><h2 class="h3">Salary &amp; appraisal history</h2><span class="spacer small muted">Visible to Practice Head and Admin only</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Event</th><th class="r">Rating</th><th class="r">Increment</th><th class="r">Annual CTC</th><th class="r">Monthly in-hand</th><th class="r">Monthly variable</th></tr></thead>
        <tbody>${list.slice().reverse().map((e) => `<tr><td class="num nowrap">${fmt.date(e.date)}</td><td class="nowrap ${e.kind === 'join' ? 'strong' : ''}">${e.kind === 'join' ? 'Joined · starting salary' : 'Annual appraisal ' + e.date.getFullYear()}</td><td class="r num">${e.rating ? e.rating.toFixed(1) + '<span class="muted"> / 5</span>' : '<span class="faint">–</span>'}</td><td class="r">${e.inc ? `<span class="badge b-ok no-dot num">${inc(e.inc)}</span>` : '<span class="faint">–</span>'}</td><td class="r num strong">${fmt.inr(e.ctc)}</td><td class="r num">${fmt.inr(RM.payParts(p, e.ctc).inHand)}</td><td class="r num">${RM.payParts(p, e.ctc).variable ? fmt.inr(RM.payParts(p, e.ctc).variable) : '<span class="faint">–</span>'}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  }
  // a cluster lead's profile links to their cluster on Financial Performance (the Practice Head's page). It leaves the profile,
  // so it sits beside the tabs at their height but reads as a link: outlined, with an arrow, and the page moves forward
  const clusterLink = (me, p) => (q.isPH(me) && RM.leadsCluster && RM.leadsCluster(p)
    ? `<a class="link-pill" href="#/ph/finance?u=${p.id}" data-nav-dir="1" aria-label="Open ${esc(fmt.first(p.name))}’s cluster on Financial Performance">${ic('chart-2-linear')}<span>${esc(fmt.first(p.name))}’s Cluster</span>${ic('arrow-right-linear', 'link-pill-go')}</a>` : '');
  function resourceDetail(me, p, tab, v) {
    const r = RM.resourceOf(p.id); const s = RM.allocStatus(p); const lm = q.latestMonth(); const f = q.finRow(p.id, lm);
    tab = tabsFor(p).some((t) => t.key === tab) ? tab : 'overview';
    // back to wherever the profile was opened from; a profile opened directly goes back to Organization, where profiles live
    const from = RM.app.fromHash; const back = from && !from.startsWith(profileHref(p.id));
    return `<div class="page">
      <div class="hstack" style="margin:6px 0 18px;justify-content:space-between">${back ? `<a class="link-btn ra-back" href="${esc(from)}" data-back>${ic('alt-arrow-left-linear')} Back</a>` : `<a class="link-btn ra-back" href="#/ph/org">${ic('alt-arrow-left-linear')} Organization</a>`}
        ${q.canEditPeople(me) ? `<button type="button" class="btn btn-secondary btn-sm" data-action="edit-employee" data-id="${p.id}">${ic('pen-linear')}Edit employee</button>` : ''}</div>
      <section class="card card-pad ra-profile" data-reveal>
        <div class="profile-hero" style="gap:18px;min-width:0">${C.avatar(p, 'xl')}<div style="min-width:0">
          <div class="eyebrow" style="margin-bottom:6px">Employee profile · ${esc(p.id)} · ${esc(p.practice)}</div>
          <h1 class="h2" style="font-size:26px">${esc(p.name)}</h1>
          <div class="hstack" style="gap:8px;margin-top:10px"><span class="badge ${p.status === 'Active' ? 'b-ok' : ''}">${p.status}</span>${allocBadge(s)}${f && q.hasFinance(me) ? `<span class="badge ${f.billable ? 'b-ok' : ''}">${f.billable ? 'Billable' : 'Non-billable'}</span>` : ''}</div>
          ${q.canEditPhoto(me, p) ? `<div class="hstack" style="gap:12px;margin-top:12px"><button type="button" class="btn btn-secondary btn-sm" data-photo="pick">${ic('upload-minimalistic-linear')}${p.photo ? 'Change photo' : 'Upload a photo'}</button>${p.photo ? '<button type="button" class="link-btn" data-photo="remove">Remove photo</button>' : ''}<input type="file" id="photo-in" accept="image/png,image/jpeg,image/webp" hidden></div>` : ''}
        </div></div>
        <div class="ra-chips${SHOW_ALLOC_PCT ? '' : ' is-3'}">
          <div class="ra-chip" style="--c:var(--info);--cb:var(--info-bg)"><span>${ic('map-point-linear')}Location</span><b>${esc(r.location)}</b></div>
          ${SHOW_ALLOC_PCT ? `<div class="ra-chip" style="--c:var(--orange-ink);--cb:var(--orange-50)"><span>${ic('pie-chart-2-linear')}Allocation</span><b class="num">${r.allocation}%</b></div>` : ''}
          <div class="ra-chip" style="--c:var(--ok);--cb:var(--ok-bg)"><span>${ic('folder-with-files-linear')}Projects</span><b class="num">${r.projects.length}</b></div>
          <div class="ra-chip" style="--c:var(--warn);--cb:var(--warn-bg)"><span>${ic('calendar-linear')}Joined</span><b class="num">${new Date(p.joined).getFullYear()}</b></div>
        </div>
      </section>
      <div class="section ra-tabrow" style="margin-top:18px"><div class="ra-tabs">${C.seg(tabsFor(p), tab, 'aria-label="Employee profile sections"').replace(/data-seg="(\w+)"/g, 'data-ratab="$1"')}</div>${clusterLink(me, p)}</div>
      <div class="section" style="margin-top:16px" id="ra-panel">${raPanel(me, p, tab, v)}</div>
    </div>`;
  }

  /* ================= EMPLOYEE PROFILE ================= */
  // Admin and the Practice Head open every person here: from Resource Allocation, any name, search or the org chart
  V.employee = {
    title: 'Employee Profile',
    // profiles live under Organization: Practice › Organization › the person (your own stays under Profile)
    crumb(params, me) { const p = q.person(params.id); return p && p.id !== me.id && !p.system ? { back: '#/ph/org', title: 'Organization', name: p.name } : null; },
    render({ me, params }) {
      const p = q.person(params.id);
      if (!p || p.system) return `<div class="page"><div class="card" style="margin-top:24px">${C.empty('user-rounded-linear', 'No one with that ID', 'The person may have been removed, or the link is mistyped.', `<a class="btn btn-secondary" href="${raBase(me)}">Resource Allocation</a>`)}</div></div>`;
      return resourceDetail(me, p, params.tab, params.v);
    },
    mount(root, { me, params }) {
      const p = q.person(params.id); if (!p || p.system) return; const pg = root.querySelector('.page');
      if (params.tab === 'reviews' && RM.reviewsIn) { const panel = pg.querySelector('#ra-panel'); panel._tl = RM.reviewsIn(panel, { charts: false }); }
      pg.addEventListener('click', (e) => {
        if (e.target.closest('[data-back]')) { e.preventDefault(); history.back(); return; }
        // the Practice Head's own photo: pick a file, or go back to the letter tile
        const ph = e.target.closest('[data-photo]');
        if (ph) { if (ph.dataset.photo === 'pick') pg.querySelector('#photo-in').click(); else setPhoto(me, p, null); return; }
        // the Reviews tab: a review year opens and closes, Expand all
        if (RM.reviewsClick && RM.reviewsClick(e)) return;
        // tabs swap only their panel (crossfade), so the header and avatar never replay
        const b = e.target.closest('[data-ratab]'); if (!b) return; e.preventDefault();
        if (b.getAttribute('aria-selected') === 'true') return;
        const tab = b.dataset.ratab;
        pg.querySelectorAll('[data-ratab]').forEach((x) => x.setAttribute('aria-selected', x === b)); RM.motion.segThumb(pg);
        const panel = pg.querySelector('#ra-panel'); const motion = !RM.reduced() && window.gsap;
        // a quick second click takes over: the last tab's entrance stops where it is
        if (panel._tl) { panel._tl.kill(); panel._tl = null; } if (motion) { gsap.killTweensOf(panel); gsap.set(panel, { opacity: 1 }); }
        const show = () => {
          panel.innerHTML = raPanel(me, p, tab);
          panel.querySelectorAll('[data-reveal]').forEach((x) => { x.style.opacity = 1; });
          // Reviews has its own entrance (RM.reviewsIn); the other tabs rise in as one, their charts drawing in
          if (tab === 'reviews' && RM.reviewsIn) { panel._tl = RM.reviewsIn(panel); return; }
          RM.motion.charts(panel);
          if (motion) gsap.fromTo(panel.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .26, ease: 'power2.out', clearProps: 'transform' });
        };
        // opening Reviews, the tab it replaces fades first (120ms, ease-out: the click's first response)
        if (tab === 'reviews' && motion && panel.children.length) gsap.to(panel, { opacity: 0, duration: .12, ease: 'power2.out', onComplete: () => { gsap.set(panel, { opacity: 1 }); show(); } });
        else show();
        try { history.replaceState(null, '', profileHref(p.id) + (tab === 'overview' ? '' : '?tab=' + tab)); } catch (err) { /* sandboxed frames may refuse */ }
      });
      // the Reviews tab's Go to month
      pg.addEventListener('change', (e) => { if (RM.reviewsChange) RM.reviewsChange(e); });
      const inp = pg.querySelector('#photo-in');
      if (inp) inp.addEventListener('change', () => { const file = inp.files[0]; inp.value = ''; if (file) readPhoto(file).then((url) => setPhoto(me, p, url), (msg) => RM.overlay.toast(msg, { tone: 'warn' })); });
    },
  };
  // an uploaded photo becomes a 320px square JPEG (centre crop), small enough to keep with the demo data in the browser
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject('Choose a PNG, JPEG or WebP image.');
      if (file.size > 8 * 1024 * 1024) return reject('That image is over 8 MB. Choose a smaller one.');
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const n = 320; const side = Math.min(img.naturalWidth, img.naturalHeight); const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
        cv.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, n, n);
        URL.revokeObjectURL(url); resolve(cv.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject('That file couldn’t be read as an image.'); };
      img.src = url;
    });
  }
  function setPhoto(me, p, url) {
    const had = !!p.photo; if (url) p.photo = url; else delete p.photo;
    RM.audit(me.id, url ? (had ? 'Changed profile photo' : 'Added profile photo') : 'Removed profile photo', p.name, '', '');
    store.save(); RM.app.reshell(); // the sidebar and account avatars change too
    RM.overlay.toast(url ? 'Photo updated' : 'Photo removed · back to your initial', { icon: 'check-circle-bold' });
  }

  /* ================= MY FINANCIALS (PM only) ================= */
  V.myFinancials = {
    title: 'My Financials',
    render({ me }) {
      const months = q.finMonths(); const lm = months[months.length - 1]; const f = q.finRow(me.id, lm); const fHas = f && f.actual != null;
      const rows = months.map((mk) => ({ mk, f: q.finRow(me.id, mk) })).filter((x) => x.f);
      return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">My performance · financials ${C.sample('Sample financials')}</div>
        <h1 class="display" data-split>My <em class="accent">Financials</em><span class="dot-o">.</span></h1>
        <p class="lede">Your own billability, forecast and actuals by month. They show as soon as Admin uploads them; until your actual for a month is uploaded, your forecast counts.</p></div></header>
      ${f ? `<section class="kpis">
        ${C.kpi({ label: 'Billability', icon: 'case-linear', value: `<span style="font-size:22px">${f.billable ? 'Billable' : 'Non-billable'}</span>`, sub: f.billable ? esc(me.alloc) + ' · ' + fmt.monthLabel(lm) : 'Internal allocation' })}
        ${C.kpi({ label: 'Forecast', icon: 'chart-2-linear', value: fmt.inr(f.forecast), sub: fmt.monthLabel(lm) })}
        ${C.kpi({ label: 'Actual', icon: 'wallet-money-linear', value: fHas ? fmt.inr(f.actual) : '–', sub: fHas ? fmt.monthLabel(lm) : 'Not uploaded yet' })}
        ${C.kpi({ label: 'Actual − forecast', icon: 'graph-up-linear', value: f.billable && fHas ? fmt.inr(f.actual - f.forecast, { plus: true }) : '–', sub: f.billable ? (fHas ? fmt.monthLabel(lm) : 'Once the actual is uploaded') : 'Not billed' })}
      </section>` : ''}
      <section class="section grid g-main-side" style="align-items:start">
        <div class="card" data-reveal><div class="card-head"><h2 class="h3">Trend</h2><span class="spacer small muted">By month</span></div>
          <div class="card-body">${rows.some((x) => x.f.billable) ? RM.charts.lines([{ name: 'Forecast', color: 'var(--viz-2)', values: rows.map((x) => x.f.forecast) }, { name: 'Actual', color: 'var(--viz-1)', values: rows.map((x) => x.f.actual) }], rows.map((x) => fmt.monthShort(x.mk)), { yFmt: (v) => fmt.inr(v).replace(' L', 'L'), w: 620, h: 250, padL: 56, padR: 76, label: 'Your forecast and actual by month' }) : C.empty('case-linear', 'No revenue to track', 'You’re on a non-billable allocation every month so far.')}</div></div>
        <div class="card card-pad" data-reveal><h2 class="h3" style="margin-bottom:10px">How this is calculated</h2>
          <dl class="kv" style="grid-template-columns:130px 1fr"><dt>Variance</dt><dd>Actual − forecast, once the actual is uploaded</dd><dt>Targets</dt><dd class="muted" style="font-weight:450">Set for a lead’s whole team, not per person</dd><dt>Percentages</dt><dd class="muted" style="font-weight:450">Not shown until approved</dd></dl>
          <p class="small muted" style="margin-top:14px">${ic('history-linear')} Admin uploads each month’s figures and can correct them later; every change is audited.</p></div>
      </section>
      <section class="section card" data-reveal>
        <div class="card-head"><h2 class="h3">Financial history</h2><span class="spacer small muted">By month</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Month</th><th>Billability</th><th class="r">Forecast</th><th class="r">Actual</th><th class="r">Actual − forecast</th><th>Upload</th></tr></thead>
        <tbody>${rows.slice().reverse().map((x) => { const has = x.f.actual != null; return `<tr><td class="strong">${fmt.monthLabel(x.mk)}</td><td><span class="badge ${x.f.billable ? 'b-ok' : ''}">${x.f.billable ? 'Billable' : 'Non-billable'}</span></td><td class="r num">${fmt.inr(x.f.forecast)}</td><td class="r num strong">${has ? fmt.inr(x.f.actual) : '–'}</td><td class="r num">${x.f.billable && has ? fmt.inr(x.f.actual - x.f.forecast, { plus: true }) : '–'}</td><td>${has || !x.f.billable ? '<span class="badge b-ok">Uploaded</span>' : '<span class="badge b-warn">To upload</span>'}</td></tr>`; }).join('')}</tbody></table></div>
      </section></div>`;
    },
  };
})(window.RM);
