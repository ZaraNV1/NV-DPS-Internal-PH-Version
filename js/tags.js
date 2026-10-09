/* NV-DPS-Internal tag glossary: a hover / focus / tap card that explains every tag in plain language,
 * shows where it sits in its workflow and who acts next.
 * Tags are recognised by text + context, so every badge on every screen is covered without per-call wiring.
 * Motion: 280ms hover intent, instant hand-off between tags, 220ms ease-out entrance, glide between tags,
 * opacity-only under reduced motion. Hover behaviour is limited to fine pointers; touch uses tap. */
(function (RM) {
  'use strict';
  const { esc, ic } = RM;

  /* ---------- workflow rails ---------- */
  const REVIEW_STEPS = ['Self marks', 'With manager', 'Final'];
  const APPR_STEPS = ['Quarters final', 'Anniversary', 'Summary'];
  const PERIOD_STEPS = ['Nothing', 'Some', 'All uploaded'];
  const INIT_STEPS = ['In progress', 'Completed'];

  const T = {
    // a quarter's marks
    'review:Not started': { cat: 'Status', tone: 'neutral', title: 'Not started', def: 'Nothing has been added yet. For a quarter’s marks: the quarter (the person’s own, from their joining date) has ended and the employee hasn’t started marking it.', who: 'Employee', rail: [REVIEW_STEPS, 0] },
    'review:Draft': { cat: 'Quarter marks', tone: 'neutral', title: 'Draft', def: 'The employee is marking each goal against what they did in the quarter. Only they can see it until they send it.', who: 'Employee', rail: [REVIEW_STEPS, 0] },
    'review:Changes asked': { cat: 'Quarter marks', tone: 'warn', title: 'Changes asked', def: 'The manager sent the marks back with a note. The employee updates them and sends them again; the first version is kept.', who: 'Employee', rail: [REVIEW_STEPS, 0, 'Changes'] },
    'review:With manager': { cat: 'Quarter marks', tone: 'info', title: 'With manager', def: 'The employee sent their marks. The manager now marks each goal, or asks for changes. Their marks sit next to the employee’s and make them final.', who: 'Manager', rail: [REVIEW_STEPS, 1] },
    'review:Final': { cat: 'Quarter marks', tone: 'lock', title: 'Final', def: 'The manager’s marks made this quarter final. It counts toward the review year and goes into that year’s appraisal summary. Only Admin can correct it.', who: 'No one (Admin can correct)', rail: [REVIEW_STEPS, 2] },
    'review:Kept': { cat: 'Quarter marks', tone: 'neutral', title: 'Kept for the record', def: 'The employee left while these marks were open. They’re kept, but taken out of every list and count.', who: 'No one' },
    'Missed': { cat: 'Due dates', tone: 'bad', title: 'Missed', def: 'Not finished on time: a monthly review by the end of the month, or a quarter’s marks by their due date. It counts against on-time figures. Marks can still be finished afterwards.', who: 'Whoever’s part is missing' },
    'Late': { cat: 'Due dates', tone: 'warn', title: 'Final, but late', def: 'These marks were made final after their due date, so they still count as missed in the on-time figures.', who: 'No one' },
    'Done': { cat: 'Monthly review', tone: 'ok', title: 'Done', def: 'Finished within the month: the employee’s progress, or the manager’s feedback with a held meeting. A month is done when both are.', who: 'Employee and manager' },
    'To do': { cat: 'Monthly review', tone: 'info', title: 'To do', def: 'This part of the monthly review isn’t done yet. It can be added until the month ends.', who: 'Its owner' },
    // appraisal summaries
    'appr:On track': { cat: 'Appraisal', tone: 'ok', title: 'On track', def: 'None of the year’s four quarters has missed its marks. Each quarter’s marks are due on its last day, so Q4’s are due before the anniversary and the summary is created that day.', who: 'System, on the anniversary', rail: [APPR_STEPS, 0] },
    'appr:3 quarters expected': { cat: 'Appraisal', tone: 'warn', title: '3 quarters expected', def: 'Reviews here started part-way through this review year, so it has three quarters. The summary is still created, from three.', who: 'System', rail: [APPR_STEPS, 0] },
    'appr:Not enough quarters': { cat: 'Appraisal', tone: 'bad', title: 'Not enough quarters', def: 'Reviews here started too late in this review year for three of its quarters to have marks, so no summary will be created.', who: 'System', rail: [APPR_STEPS, 0] },
    'appr:Waiting on marks': { cat: 'Appraisal', tone: 'bad', title: 'Waiting on marks', def: 'One of the year’s quarters wasn’t made final by its due date, so the summary waits until it is; a quarter is never skipped. The year’s monthly reviews and evidence are already filed with it.', who: 'That quarter’s employee and manager', rail: [APPR_STEPS, 1] },
    'appr:Waiting on Q4': { cat: 'Appraisal', tone: 'info', title: 'Waiting on Q4', def: 'The anniversary has come and the year’s other quarters are final. Q4’s marks aren’t due yet, so the summary is created as soon as they’re final.', who: 'Q4’s employee and manager', rail: [APPR_STEPS, 1] },
    'appr:Ready': { cat: 'Appraisal', tone: 'lock', title: 'Ready', def: 'A snapshot of the quarters’ marks, comments, monthly reviews and evidence, with the self and manager averages side by side. A later correction adds a new version.', who: 'Managers, the Practice Head and Admin can open it', rail: [APPR_STEPS, 2] },
    'appr:Ready · 3 quarters': { cat: 'Appraisal', tone: 'warn', title: 'Ready, from three quarters', def: 'Reviews here started part-way through this review year, so the summary was created from its three quarters instead of four. The appraisal date doesn’t move.', who: 'System', rail: [APPR_STEPS, 2, 'Summary · 3'] },
    'appr:3 quarters': { cat: 'Appraisal', tone: 'warn', title: 'Three quarters', def: 'This summary covers three quarters instead of four: reviews here started part-way through the year.', who: 'System' },
    'appr:Not created': { cat: 'Appraisal', tone: 'bad', title: 'Not created', def: 'The review year had fewer than three quarters with marks, so there are no summary marks this year. The year’s monthly reviews and evidence are still filed with it.', who: 'System', rail: [APPR_STEPS, 1] },
    // monthly financial uploads: no locks, a month's figures count as soon as they're saved
    'period:Nothing uploaded': { cat: 'Financial upload', tone: 'neutral', title: 'Nothing uploaded', def: 'No one has figures for this month yet. Dashboards carry each person’s latest forecast into it (run-rate).', who: 'Admin', ref: 'Financial Updates', rail: [PERIOD_STEPS, 0] },
    'period:Actuals to upload': { cat: 'Financial upload', tone: 'warn', title: 'Actuals to upload', def: 'Some billable people have no actual for this month yet. Their forecast counts until it’s uploaded; uploaded actuals count straight away.', who: 'Admin', ref: 'Financial Updates', rail: [PERIOD_STEPS, 1] },
    'period:All uploaded': { cat: 'Financial upload', tone: 'ok', title: 'All uploaded', def: 'Every billable person has an actual for this month, so the month counts actuals only. Figures can still be corrected, and every change is audited.', who: 'Admin', ref: 'Financial Updates', rail: [PERIOD_STEPS, 2] },
    // access
    'Authorised': { cat: 'Financial scope', tone: 'info', title: 'Authorised', def: 'You can see this person’s financial figures. Financial access belongs to Admin, Practice Head and PM roles only.', who: 'Set by platform role', ref: 'PRD §18 · BR-05', scope: true },
    'Not authorised': { cat: 'Financial scope', tone: 'neutral', title: 'Not authorised', def: 'Financial figures are limited to Admin, Practice Head and PM roles. Seeing someone or owning their review doesn’t include their numbers.', who: 'Set by platform role', ref: 'PRD §18 · BR-05', scope: false },
    'Has access': { cat: 'Financial access', tone: 'ok', title: 'Has access', def: 'This role can see financial figures: Admin and Practice Head for the whole practice, PMs for themselves and their team.', who: 'Set by platform role', ref: 'PRD §13 · §18' },
    'No access': { cat: 'Financial access', tone: 'neutral', title: 'No access', def: 'POs, Senior BAs and BAs don’t see financial figures, including their own. Reviews and appraisals are unaffected.', who: 'Set by platform role', ref: 'PRD §13 · §18' },
    'Billable': { cat: 'Billability', tone: 'ok', title: 'Billable', def: 'Allocated to a client engagement, so they carry a monthly forecast and actual.', who: 'Admin updates it monthly', ref: 'PRD §13' },
    'Non-billable': { cat: 'Billability', tone: 'neutral', title: 'Non-billable', def: 'Internal allocation with no revenue. Still counted in the team’s billable and non-billable totals.', who: 'Admin updates it monthly', ref: 'PRD §13' },
    'reportee:Direct': { cat: 'Reportee type', tone: 'info', title: 'Direct reportee', def: 'Reports straight to you. Their reviews are normally assigned to you.', who: 'You, as Reporting Manager', ref: 'PRD §6 · BR-02', tree: 1 },
    'reportee:Indirect': { cat: 'Reportee type', tone: 'neutral', title: 'Indirect reportee', def: 'Sits further down your hierarchy. You can see them, but their own manager owns their reviews.', who: 'Their own manager', ref: 'BR-02 · BR-03', tree: 2 },
    // forms, mapping, assignment
    'Override': { cat: 'Review template', tone: 'orange', title: 'Template override', def: 'This person fills in a different template from their role’s default, from the start of their next quarter. Their role, manager, hierarchy and financial scope don’t change, and a role change doesn’t clear it.', who: 'Admin, with a recorded reason', ref: 'RV-12' },
    'Mapping': { cat: 'Role mapping', tone: 'warn', title: 'Mapping pending', def: 'Their org-chart title isn’t mapped to a platform role yet. They’re listed for Admin instead of getting a default form, and join review cycles once the mapping is confirmed.', who: 'Admin', ref: 'RV-03 · PO-04' },
    'Confirmed': { cat: 'Role mapping', tone: 'ok', title: 'Confirmed', def: 'Admin confirmed this title-to-role mapping. Everyone with this designation gets that role’s default forms.', who: 'Admin', ref: 'PRD §4 · §8' },
    'Scheduled': { cat: 'Review cycle', tone: 'info', title: 'Scheduled', def: 'The quarter is running. Quarters follow each person’s joining date; on the 1st of a quarter’s last month its marks open, due on its last day, with their manager giving the manager marks. Nobody sets them up by hand.', who: 'System' },
    'Active': { cat: 'Employee status', tone: 'ok', title: 'Active', def: 'Part of review cycles and every active view.', who: 'Admin manages status', ref: 'PRD §6' },
    'Archived': { cat: 'Employee status', tone: 'neutral', title: 'Archived', def: 'No longer in new review cycles or active views. Reviews, financials and audit history are kept, never deleted.', who: 'Admin', ref: 'PRD §11 · BR-06' },
    // resource allocation (sample resourcing data). Parked with the tags themselves: see SHOW_ALLOC_TAGS in views-plus.js
    'Fully Allocated': { cat: 'Allocation status', tone: 'warn', title: 'Fully allocated', def: 'Booked at 100% across their projects. Adding work means moving something else first.', who: 'Practice Head and Admin plan capacity', ref: 'Sample resourcing' },
    'Partially Allocated': { cat: 'Allocation status', tone: 'info', title: 'Partially allocated', def: 'Booked between 1% and 99%. The remainder is open capacity that can take a project share.', who: 'Practice Head and Admin plan capacity', ref: 'Sample resourcing' },
    'Available': { cat: 'Allocation status', tone: 'ok', title: 'Available', def: 'Active but not booked on any project this period, so free to take new work straight away.', who: 'Practice Head and Admin plan capacity', ref: 'Sample resourcing' },
    'Inactive': { cat: 'Allocation status', tone: 'neutral', title: 'Inactive', def: 'An archived record. It keeps its history but is left out of capacity planning.', who: 'Admin', ref: 'Sample resourcing · BR-06' },
    // DPS dashboard initiatives (Practice Head's list)
    'init:In progress': { cat: 'Initiative status', tone: 'info', title: 'In progress', def: 'Work on this initiative is under way. It moves to Completed when its owners deliver it; one with workstreams completes when every workstream does.', who: 'The initiative’s owners', ref: 'DPS dashboard', rail: [INIT_STEPS, 0] },
    'init:Completed': { cat: 'Initiative status', tone: 'ok', title: 'Completed', def: 'Delivered by its owners. It stays on the dashboard as a record of what the practice finished this year.', who: 'No one, it’s done', ref: 'DPS dashboard', rail: [INIT_STEPS, 1] },
    'Editable by you': { cat: 'Who writes here', tone: 'info', title: 'Editable by you', def: 'You can change this now: your marks until you send them, or your manager marks until you make them final.', who: 'You' },
    'sample': { cat: 'Prototype data', tone: 'steel', title: 'Sample data', def: 'Generated for this prototype. People, reporting lines and allocations come from your org chart; this value doesn’t.', who: 'Replaced by live data at launch', ref: 'Prototype' },
    // platform roles
    'role:PM': { cat: 'Platform role', tone: 'info', title: 'PM', role: 'PM', def: 'Product Manager role. Includes financial access for themselves and their team. Never decides who reports to them.', ref: 'PRD §4 · BR-01' },
    'role:PO': { cat: 'Platform role', tone: 'info', title: 'PO', role: 'PO', def: 'Product Owner role. Some POs manage people and some don’t. No financial access.', ref: 'PRD §4 · BR-01' },
    'role:Senior BA': { cat: 'Platform role', tone: 'info', title: 'Senior BA', role: 'Senior BA', def: 'Senior Business Analyst role. May have personal reviews and review reportees at the same time. No financial access.', ref: 'PRD §4 · BR-01' },
    'role:BA': { cat: 'Platform role', tone: 'info', title: 'BA', role: 'BA', def: 'Business Analyst role. Can still be a Reporting Manager if someone is assigned to them. No financial access.', ref: 'PRD §4 · BR-01' },
    'role:Practice Head': { cat: 'Platform role', tone: 'info', title: 'Practice Head', def: 'Sees the whole practice: organization, completion, financials and appraisals. Owns only the reviews explicitly assigned to them.', ref: 'PRD §4 · BR-03' },
    'role:No platform role': { cat: 'Platform role', tone: 'neutral', title: 'No platform role', def: 'Outside the PRD roles, for example a contractor, so not part of review cycles.', ref: 'PRD §4' },
  };
  const REVIEW = { 'Not started': 1, 'Draft': 1, 'Changes asked': 1, 'With manager': 1, 'Final': 1 };
  const APPR = { 'On track': 1, '3 quarters expected': 1, 'Not enough quarters': 1, 'Waiting on marks': 1, 'Ready': 1, 'Ready · 3 quarters': 1, '3 quarters': 1, 'Waiting on Q4': 1, 'Not created': 1 };
  const ROLES = { 'PM': 1, 'PO': 1, 'Senior BA': 1, 'BA': 1, 'Practice Head': 1, 'No platform role': 1 };

  function resolve(el) {
    // a badge outside reviews whose words happen to match a review term (Target progress's "On track") opts out
    if (el.hasAttribute('data-no-tag')) return null;
    if (el.dataset.tagKey) return el.dataset.tagKey;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    let key = null;
    if (el.classList.contains('sample-tag')) key = 'sample';
    else if (el.closest('.period')) key = 'period:' + text;
    else if (/^Kept · has left/.test(text)) key = 'review:Kept';
    else if (/^Indirect/.test(text)) key = 'reportee:Indirect';
    else if (text === 'Direct') key = 'reportee:Direct';
    else if (/^Mapping/.test(text)) key = 'Mapping';
    else if (APPR[text]) key = 'appr:' + text;
    else if (REVIEW[text]) key = 'review:' + text;
    else if (ROLES[text] && el.classList.contains('b-info')) key = 'role:' + text;
    else if (T[text]) key = text;
    return key && T[key] ? key : null;
  }

  /* ---------- visuals ---------- */
  function rail(steps, idx, alt) {
    return `<div class="tc-rail" role="img" aria-label="Step ${idx + 1} of ${steps.length}">${steps.map((s, i) => `<span class="tc-step ${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}"><i></i><b>${esc(i === idx && alt ? alt : s)}</b></span>`).join('')}</div>`;
  }
  function scope(on) {
    const dims = [['Role', 'what you can do'], ['Organization', 'who you can see'], ['Review', 'whose reviews you own'], ['Financial', 'whose figures you see']];
    return `<div class="tc-dims">${dims.map(([d, s], i) => `<span class="tc-dim ${i === 3 ? (on ? 'is-on' : 'is-off') : ''}"><b>${d}</b><small>${s}</small></span>`).join('')}</div><p class="tc-cap">Four separate permissions. No one grants another.</p>`;
  }
  function tree(level) {
    const row = (lbl, l) => `<span class="tc-tnode ${l === level ? 'is-now' : l < level ? 'is-path' : ''}" style="margin-left:${l * 18}px"><i></i>${lbl}</span>`;
    return `<div class="tc-tree">${row('You', 0)}${row('Direct reportee', 1)}${row('Indirect reportee', 2)}</div>`;
  }
  function roleForms(role) {
    const k = RM.ROLE_TEMPLATE[role]; if (!k) return '';
    const ks = k === 'PO' ? ['PO', 'PO-R'] : [k];
    return `<div class="tc-forms">${ks.map((x) => `<span>${esc(RM.GOALSHEETS[x].name)}</span>`).join('')}</div><p class="tc-cap">Default template for this role${k === 'PO' ? ' (with reportees, the second)' : ''}. Admin can override it per person.</p>`;
  }

  function cardHTML(key, note) {
    const g = T[key];
    let visual = '';
    if (g.rail) visual = rail(g.rail[0], g.rail[1], g.rail[2]);
    else if (g.scope !== undefined) visual = scope(g.scope);
    else if (g.tree) visual = tree(g.tree);
    else if (g.role) visual = roleForms(g.role);
    return `<div class="tc-accent"></div><div class="tc-body">
      <div class="tc-top"><span class="tc-cat">${esc(g.cat)}</span></div>
      <div class="tc-title">${esc(g.title)}</div>
      <p class="tc-def">${esc(g.def)}</p>
      ${visual ? `<div class="tc-visual">${visual}</div>` : ''}
      ${note ? `<div class="tc-note">${ic('info-circle-linear')}<span>${esc(note)}</span></div>` : ''}
      ${g.who ? `<div class="tc-foot">${ic('user-hand-up-linear')}<span><span class="tc-muted">Next move</span> ${esc(g.who)}</span></div>` : ''}
    </div>`;
  }

  /* ---------- the card ---------- */
  let card, inner, arrow, current = null, visible = false, lastHide = 0, showT = 0, hideT = 0, touchOpen = false;
  function ensure() {
    if (card && card.isConnected) return;
    card = document.createElement('div'); card.className = 'tag-card'; card.id = 'tag-card'; card.setAttribute('role', 'tooltip');
    card.innerHTML = '<div class="tc-inner"></div><span class="tc-arrow" aria-hidden="true"></span>';
    document.body.appendChild(card); inner = card.firstChild; arrow = card.lastChild; visible = false;
  }
  function place(el) {
    const r = el.getBoundingClientRect(); const w = card.offsetWidth; const h = card.offsetHeight; const gap = 12;
    const vw = document.documentElement.clientWidth; // excludes the scrollbar, unlike innerWidth
    let top = r.top - h - gap; let side = 'top';
    if (top < 8) { top = r.bottom + gap; side = 'bottom'; }
    const left = Math.max(8, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2));
    const ax = Math.max(18, Math.min(w - 18, r.left + r.width / 2 - left));
    card.dataset.side = side; arrow.style.left = ax + 'px';
    inner.style.transformOrigin = `${ax}px ${side === 'top' ? '100%' : '0%'}`;
    return { x: left, y: top, side };
  }
  function show(el) {
    const key = resolve(el); if (!key) return;
    ensure(); clearTimeout(hideT);
    const g = T[key]; card.dataset.tone = g.tone;
    inner.innerHTML = cardHTML(key, el.dataset.tagNote || '');
    if (current && current !== el) current.removeAttribute('aria-describedby');
    current = el; el.setAttribute('aria-describedby', 'tag-card');
    const wasVisible = visible; visible = true;
    card.style.visibility = 'hidden'; card.style.display = 'block';
    const pos = place(el); card.style.visibility = '';
    const reduce = RM.reduced() || !window.gsap;
    if (reduce) { card.style.transform = `translate(${pos.x}px, ${pos.y}px)`; inner.style.opacity = 1; return; }
    if (wasVisible) {
      gsap.to(card, { x: pos.x, y: pos.y, duration: .24, ease: 'power3.out', overwrite: 'auto' });
      gsap.fromTo(inner.querySelector('.tc-body'), { opacity: .35 }, { opacity: 1, duration: .2, ease: 'power2.out' });
    } else {
      gsap.set(card, { x: pos.x, y: pos.y });
      gsap.fromTo(inner, { opacity: 0, y: pos.side === 'top' ? 6 : -6, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .22, ease: 'power3.out', overwrite: 'auto' });
      const steps = inner.querySelectorAll('.tc-step.is-done i, .tc-step.is-now i');
      if (steps.length) gsap.fromTo(steps, { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .3, stagger: .035, delay: .06, ease: 'back.out(2)', clearProps: 'transform,opacity' });
    }
  }
  function hide(now) {
    clearTimeout(showT);
    if (!visible) return;
    const go = () => {
      visible = false; lastHide = Date.now(); touchOpen = false;
      if (current) { current.removeAttribute('aria-describedby'); current = null; }
      if (RM.reduced() || !window.gsap) { card.style.display = 'none'; return; }
      gsap.to(inner, { opacity: 0, y: card.dataset.side === 'top' ? 4 : -4, scale: .98, duration: .14, ease: 'power1.in', overwrite: 'auto', onComplete: () => { if (!visible) card.style.display = 'none'; } });
    };
    clearTimeout(hideT); if (now) go(); else hideT = setTimeout(go, 90);
  }
  RM.tagCard = { show, hide, resolve, glossary: T };

  /* ---------- make every tag focusable & recognisable ---------- */
  function enhance(root) {
    (root || document).querySelectorAll('.badge:not([data-tag-ready]), .sample-tag:not([data-tag-ready])').forEach((el) => {
      el.dataset.tagReady = '1';
      const key = resolve(el); if (!key) return;
      el.dataset.tagKey = key;
      if (el.dataset.tip) { el.dataset.tagNote = el.dataset.tip.replace(/<[^>]+>/g, ''); delete el.dataset.tip; }
      el.removeAttribute('title');
      el.classList.add('has-glossary'); el.tabIndex = 0;
    });
  }
  RM.enhanceTags = enhance;
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; enhance(document); }); })
    .observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- triggers ---------- */
  const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let lastPointer = 'mouse';
  document.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, true);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !fine()) return;
    const el = e.target.closest && e.target.closest('.has-glossary'); if (!el) return;
    clearTimeout(hideT); clearTimeout(showT);
    if (el === current && visible) return;
    const warm = visible || Date.now() - lastHide < 400; // hand-off between neighbouring tags skips the intent delay
    if (warm) show(el); else showT = setTimeout(() => show(el), 280);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest('.has-glossary'); if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    clearTimeout(showT); hide();
  });
  document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('.has-glossary'); if (el && lastPointer !== 'touch') { clearTimeout(showT); show(el); } });
  document.addEventListener('focusout', (e) => { if (e.target.closest && e.target.closest('.has-glossary')) hide(); });
  // touch: tap a tag to open its card (and don't trigger the row it sits in); tap anywhere else to close
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.has-glossary');
    if (lastPointer === 'touch' || lastPointer === 'pen') {
      if (el) { e.preventDefault(); e.stopPropagation(); if (current === el && visible) hide(true); else { show(el); touchOpen = true; } return; }
      if (touchOpen) hide(true);
    }
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && visible) { hide(true); } });
  window.addEventListener('scroll', () => { if (visible) hide(true); }, { passive: true });
  window.addEventListener('resize', () => { if (visible) hide(true); });
  window.addEventListener('hashchange', () => hide(true));
})(window.RM);
