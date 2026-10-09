/* NV-DPS-Internal personal views (PM / PO / Senior BA / BA): the dashboard and the profile; the Practice Head's Upcoming Appraisals */
(function (RM) {
  'use strict';
  const { esc, ic, q, fmt, C } = RM;
  const V = RM.views = RM.views || {};
  const store = RM.store; const RV = RM.RV;
  const first = (p) => fmt.first(p.name);
  const pct = (v) => RV.fmtPct(v);
  const monthList = (mks) => { const l = mks.map((mk) => RV.monthLabel(mk).split(' ')[0]); return l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0] || ''; };
  /* ============== My Performance ============== */
  V.performance = {
    title: 'Dashboard',
    render({ me }) {
      const inC = RV.inCycles(me); const recs = RV.recsOf(me.id); const f = RV.curForm(me.id);
      // quarters follow the joining date: the person's own last quarter, and their review year
      const lastQ = RV.marksQuarter(me); const cur = RV.recFor(me.id, lastQ.key); const yrNow = RV.curYear(me);
      const selfDue = RV.mineOpen(me); const withMgr = recs.filter((r) => RV.needsMgr(r) && !q.isFrozen(r));
      const nowMk = RV.curMonth(); const m = f ? RV.month(me.id, nowMk) : null; const mEnd = fmt.date(RV.monthEnd(nowMk), { noYear: true });
      const inc = f ? RV.monthsIncomplete(me.id, f) : [];
      // this review year so far; early in a year with nothing final yet, the year before
      let ytd = RV.ytd(me.id, yrNow.n); let lastYr = false; if (!ytd.n && yrNow.n > 1) { const py = RV.ytd(me.id, yrNow.n - 1); if (py.n) { ytd = py; lastYr = true; } }
      const locked = recs.filter(RV.isLocked).slice(-6);
      const past = f ? RV.monthsSoFar(f).filter((mk) => mk < nowMk) : []; const done = past.filter((mk) => RV.month(me.id, mk).complete).length;
      const dueBy = (r) => fmt.date(RV.lockBy(RV.quarter(r.key)), { noYear: true }); const Mon = RV.monthShort(nowMk);
      const changes = selfDue.find((r) => r.status === 'Changes Requested'); const team = q.hasReportees(me.id) ? RV.waitingOn(me).length : 0;
      let lede;
      if (!inC) lede = me.mapPending ? 'Your designation is waiting for Admin to map it to a role. Your reviews start once it’s confirmed.' : 'Your role isn’t in reviews.';
      else if (!f) lede = 'Your monthly reviews start in the month you join. Nothing needs you yet.';
      else if (changes) lede = `${esc(q.person(changes.reviewer).name)} asked you to change your ${esc(RV.quarter(changes.key).short)} marks. Update them and send them again${RV.overdue(changes) ? '' : ` by ${dueBy(changes)}`}.`;
      else if (selfDue.length) lede = `Your ${esc(RV.quarter(selfDue[0].key).short)} marks are ${RV.overdue(selfDue[0]) ? 'overdue and counted as missed' : `due ${dueBy(selfDue[0])}`}: mark each goal against what you did in ${esc(RV.quarter(selfDue[0].key).span)}.${m && !m.empDone ? ` Your ${Mon} monthly review is open too.` : ''}`;
      else if (m && !m.empDone) lede = `Your ${Mon} monthly review is open: add your progress and evidence by ${mEnd}.`;
      else if (withMgr.length) lede = `Nothing needs you right now: your ${esc(RV.quarter(withMgr[0].key).short)} marks are with ${esc(q.person(withMgr[0].reviewer).name)}.`;
      else lede = 'You’re up to date.';

      const focus = !f ? null : selfDue[0] ? { kind: 'self', rec: changes || selfDue[0] } : m && !m.empDone ? { kind: 'month', mk: nowMk } : withMgr[0] ? { kind: 'mgr', rec: withMgr[0] } : { kind: 'now', mk: nowMk };
      const fr = focus && focus.rec; const fq = fr && RV.quarter(fr.key);
      const band = !focus ? '' : `<section class="band" data-reveal style="padding:28px 30px">
        <div class="grid g-main-side" style="align-items:center;gap:28px">
          <div>
            <div class="eyebrow">${focus.kind === 'self' || focus.kind === 'month' ? 'Next step' : focus.kind === 'mgr' ? 'In progress' : 'This month'}</div>
            <h2 class="display" style="font-size:clamp(28px,2.6vw,40px);color:#fff;margin-top:12px">${fr ? `${esc(fq.short)} marks <em class="accent">${focus.kind === 'self' ? (fr.status === 'Changes Requested' ? 'need changes' : 'are waiting on you') : 'are with your manager'}</em>` : `${esc(RV.monthLabel(focus.mk))} <em class="accent">${focus.kind === 'month' ? 'monthly review is open' : 'monthly review is done'}</em>`}</h2>
            <p class="lede" style="margin-top:10px;font-size:15px">${fr ? `${esc(fq.span)} · manager ${esc(q.person(fr.reviewer).name)} · ${esc(RV.due(fr).label)}` : `Due ${mEnd}`}</p>
            <div class="hstack" style="margin-top:20px">
              ${focus.kind === 'self' ? `<a class="btn btn-primary btn-lg" href="${RM.quarterHref(fr)}">${fr.status === 'Changes Requested' ? 'Update and send again' : fr.status === 'Draft' ? 'Continue your marks' : 'Start your marks'} ${ic('arrow-right-linear')}</a>`
                : focus.kind === 'mgr' ? `<a class="btn btn-primary btn-lg" href="${RM.quarterHref(fr)}">See what you sent ${ic('arrow-right-linear')}</a>`
                : `<a class="btn btn-primary btn-lg" href="${RM.formHref(me.id, null, me)}">${focus.kind === 'month' ? `Add ${Mon} progress` : 'Open your review'} ${ic('arrow-right-linear')}</a>`}
              ${focus.kind === 'self' && m && !m.empDone ? `<a class="btn btn-ghost" href="${RM.formHref(me.id, null, me)}">Also: ${Mon} monthly review</a>` : ''}
            </div>
          </div>
          <div class="card card-pad" style="color:var(--ink)">
            ${fr ? `<div class="hstack" style="justify-content:space-between;margin-bottom:18px"><span class="h3">Where it is</span>${C.status(fr.status, false, RV.incomplete(fr))}</div>${RM.lifecycle(fr, true)}
              <p class="small" style="margin-top:16px;color:var(--ink-3)">${RV.needsSelf(fr) ? 'You send your marks to your manager; their marks make them final.' : 'Your manager’s marks make them final. You’ll see them then.'}</p>`
              : `<div class="hstack" style="justify-content:space-between;margin-bottom:14px"><span class="h3">${esc(yrNow.label)}</span><a class="link-btn small" href="${RM.reviewsHref(me.id, me)}">History ${ic('arrow-right-linear')}</a></div>${RM.yearStrip(me, me.id)}`}
          </div>
        </div>
      </section>`;

      return `<div class="page">
      <header class="page-head">
        <div>
          <div class="eyebrow">My performance · review year ${esc(yrNow.label)} ${C.sample('Sample review data')}</div>
          <h1 class="display" data-split>Welcome, <em class="accent">${esc(first(me))}</em><span class="dot-o">.</span></h1>
          <p class="lede">${lede}</p>
        </div>
        <div class="head-actions">${q.hasReportees(me.id) ? `<a class="btn btn-secondary" href="#/me/team">${ic('users-group-rounded-linear')}Team${team ? ` <span class="count">${team}</span>` : ''}</a>` : ''}<a class="btn btn-primary" href="#/me/review">${ic('clipboard-list-linear')}My review</a></div>
      </header>

      ${band}

      <section class="kpis section kpis-3">
        ${C.kpi({ label: lastYr ? 'Last review year' : 'This review year', icon: 'star-linear', value: ytd.n ? C.count(ytd.mgr, 1) : '–', unit: ytd.n ? '%' : '', sub: ytd.n ? `Manager marks, as % of the maximum · self ${pct(ytd.self)} · ${ytd.n} final ${ytd.n === 1 ? 'quarter' : 'quarters'} · ${esc(RV.year(me, ytd.cycle).label)}` : 'Starts once a quarter’s marks are final', href: RM.reviewsHref(me.id, me) })}
        ${C.kpi({ label: `${lastQ.short} marks`, icon: 'clipboard-check-linear', value: !cur ? '–' : RV.isLocked(cur) ? C.count(cur.mgrMark) : RV.due(cur).over ? C.count(-RV.due(cur).days) : C.count(RV.due(cur).days), unit: !cur ? '' : RV.isLocked(cur) ? '/ ' + RV.quarterMax(cur) : RV.due(cur).over ? 'days overdue' : 'days left', sub: !cur ? 'You weren’t in this quarter' : RV.isLocked(cur) ? `Final ${fmt.date(cur.lockedAt, { noYear: true })} · self ${RV.markText(cur, cur.selfMark)}` : `${RM.statusLabel(cur.status)} · due ${dueBy(cur)}`, tone: cur && RV.due(cur).over ? 'alert' : cur && RV.needsSelf(cur) ? 'warn' : '', href: cur ? RM.quarterHref(cur) : '' })}
        ${C.kpi({ label: 'Monthly reviews', icon: 'clipboard-list-linear', value: f ? C.count(done) : '–', unit: f ? '/ ' + past.length + ' done' : '', sub: !f ? 'Not started yet' : inc.length ? `${monthList(inc)} missed` : past.length ? `Every month done · ${Mon} open` : `${Mon} open`, tone: inc.length ? 'warn' : '', href: f ? RM.formHref(me.id, null, me) : '' })}
      </section>

      ${q.hasReportees(me.id) ? `<section class="section">${RM.attentionCard(RV.ownedBy(me.id), 'Your team’s marks that need you', '#/me/team?f=you', 'Nothing in your team needs you right now.')}</section>` : ''}

      <section class="section card" data-reveal>
          <div class="card-head"><h2 class="h3">Marks by quarter</h2><a class="spacer link-btn" href="${RM.reviewsHref(me.id, me)}">History ${ic('arrow-right-linear')}</a></div>
          ${recs.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Quarter</th><th>Status</th><th>Manager</th><th class="r">Self</th><th class="r">Manager</th><th><span class="sr-only">Open</span></th></tr></thead>
            <tbody>${recs.slice(-4).reverse().map((r) => { const qq = RV.quarter(r.key); return `<tr class="is-clickable" data-href="${RM.quarterHref(r)}">
              <td class="nowrap"><span class="strong">${esc(qq.fq)}</span> <span class="muted small">${esc(qq.span)}</span></td>
              <td class="nowrap">${C.status(r.status, false, RV.incomplete(r))} ${C.dueBadge(r)}</td>
              <td class="nowrap">${C.who(q.person(r.reviewer))}</td>
              <td class="r num">${RV.selfShown(me, r) && r.selfMark != null ? RV.markText(r, r.selfMark) : '<span class="faint">–</span>'}</td>
              <td class="r num strong">${RV.mgrShown(me, r) && r.mgrMark != null ? RV.markText(r, r.mgrMark) : '<span class="faint">–</span>'}</td>
              <td class="r"><a class="link-btn" href="${RM.quarterHref(r)}" aria-label="Open ${esc(qq.short)} marks">${ic('alt-arrow-right-linear')}</a></td></tr>`; }).join('')}</tbody>
          </table></div>
          ${recs.length > 4 ? `<div class="table-foot">${ic('history-linear')}<span>${recs.length - 4} earlier quarters in <a href="${RM.reviewsHref(me.id, me)}">History</a></span></div>` : ''}`
          : `<div class="card-body">${C.empty('clipboard-check-linear', 'No marks yet', f ? `Your first marks open on ${fmt.date(RV.marksOpen(RV.quarterFor(me, f.start)))}, in the last month of your ${esc(RV.quarterFor(me, f.start).fq)} (${esc(RV.quarterFor(me, f.start).span)}).` : 'Your first marks open in the last month of your first quarter.')}</div>`}
      </section>

      <section class="section grid g-2">
        <div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">Your marks over time</h2><span class="spacer">${C.sample()}</span></div>
          <div class="card-body">
            ${locked.length >= 2 ? `<div class="legend" style="margin-bottom:10px"><span><i class="sw sw-line" style="background:var(--viz-1)"></i>Manager</span><span><i class="sw sw-line" style="background:var(--viz-2)"></i>Self</span></div>
            ${RM.charts.lines([
              { name: 'Manager', color: 'var(--viz-1)', values: locked.map((r) => RV.pct(r, r.mgrMark)) },
              { name: 'Self', color: 'var(--viz-2)', values: locked.map((r) => RV.pct(r, r.selfMark)) },
            ], locked.map((r) => RV.quarter(r.key).short), { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], yFmt: (v) => v + '%', tipFmt: 'pct', w: 520, h: 220, padL: 44, padR: 76, label: 'Self and manager marks by final quarter, as % of the maximum' })}
            <p class="small muted" style="margin-top:10px">${ic('shield-check-linear')} Kept side by side. Your manager’s marks never replace yours.</p>`
            : C.empty('graph-up-linear', 'Not enough history yet', 'The chart appears after two final quarters.')}
          </div>
        </div>
        ${finCard(me)}
      </section>
      </div>`;
    },
  };
  function finCard(me) {
    const finOk = q.finScope(me, me); const lm = q.latestMonth(); const f = q.finRow(me.id, lm); const fHas = f && f.actual != null;
    return `<div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">My financial performance</h2><span class="spacer small muted">${finOk ? fmt.monthLabel(lm) + ' · latest month' : 'PM, Practice Head and Admin only'}</span></div>
          <div class="card-body">
          ${finOk && f ? `<div class="grid g-2" style="gap:1px;background:var(--line);border-radius:var(--r-md);overflow:hidden">
            ${[['Billability', f.billable ? 'Billable' : 'Non-billable', esc(me.alloc) + ' allocation', ''], ['Forecast', fmt.inr(f.forecast), fmt.monthLabel(lm), ''], ['Actual', fHas ? fmt.inr(f.actual) : '–', fHas ? fmt.monthLabel(lm) : 'Not uploaded yet', ''], ['Actual − forecast', f.billable && fHas ? fmt.inr(f.actual - f.forecast, { plus: true }) : '–', f.billable ? (fHas ? 'Uploaded actual' : 'Once the actual is uploaded') : 'Not billed', '']].map(([l, v, s, cls]) => `<div style="background:var(--surface);padding:16px 18px"><div class="small muted">${l}</div><div class="h2 num cell-var ${cls}" style="margin:6px 0 2px">${v}</div><div class="tiny muted">${s}</div></div>`).join('')}
          </div>
          <p class="small muted" style="margin-top:12px">${ic('info-circle-linear')} Figures show here as soon as Admin uploads them.</p>`
          : `<div class="restricted">${C.empty('lock-keyhole-minimalistic-linear', 'Financials aren’t part of your role', `Financial figures, including your own, are visible to PM, Practice Head and Admin roles only. As ${esc(me.role === 'Senior BA' ? 'a Senior BA' : me.role === 'BA' ? 'a BA' : 'a ' + me.role)}, your reviews and appraisal information are unaffected.`)}</div>`}
          </div>
        </div>`;
  }

  /* Team Financials: the Financial Performance page for a PM's cluster (views-org.js) */

  /* ============== Upcoming appraisals (the Practice Head) ============== */
  // a month calendar of joining anniversaries, with the upcoming list beside it
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const APPR_DOT = { 'Ready': 'var(--lock)', 'Ready · 3 quarters': 'var(--warn-dot)', 'Not created': 'var(--bad-dot)', 'Waiting on marks': 'var(--bad-dot)', 'Waiting on Q4': 'var(--info-dot)', 'On track': 'var(--ok-dot)', '3 quarters expected': 'var(--info-dot)', 'Not enough quarters': 'var(--bad-dot)' };
  const APPR_LABEL = { 'Ready': 'Summary ready', 'Ready · 3 quarters': 'Summary ready · 3 quarters', 'Not created': 'Not created', 'Waiting on marks': 'Waiting on missed marks', 'Waiting on Q4': 'Waiting on Q4’s marks', 'On track': 'On track', '3 quarters expected': '3 quarters expected', 'Not enough quarters': 'Not enough quarters' };
  const LEGEND = [['Ready', 'Summary ready'], ['Ready · 3 quarters', 'Summary ready · 3 quarters'], ['Waiting on Q4', 'Waiting on Q4'], ['Not created', 'Not created or waiting on missed marks'], ['On track', 'On track']];
  let calMonth = null; // { y, m } on show; opens on today's month and is kept while you move around the app
  const apprScope = () => q.active().map((p) => p.id);
  const ago = (days) => (days === 0 ? 'today' : days > 0 ? 'in ' + days + (days === 1 ? ' day' : ' days') : Math.abs(days) + (days === -1 ? ' day' : ' days') + ' ago');
  // anniversaries in a month: everyone in scope who is in reviews and has a full year by then. A past one shows
  // its summary; the next one shows what it is expected to cover
  function monthAnniversaries(ids, y, m) {
    return ids.map((id) => q.person(id)).filter((p) => p && RV.inCycles(p)).map((p) => {
      const j = new Date(p.joined); if (j.getMonth() !== m || y <= j.getFullYear()) return null;
      const cycle = y - j.getFullYear(); const date = RV.appraisalDate(p, cycle); const rep = RV.appraisalFor(p.id, cycle);
      const status = rep ? RV.reportLabel(rep) : cycle === RV.nextCycle(p).cycle ? RV.PREVIEW_LABEL[RV.preview(p).kind] : null;
      return { p, date, cycle, status, report: rep, past: RM.dayDiff(date, RM.TODAY) > 0 };
    }).filter(Boolean).sort((a, b) => a.date - b.date || a.p.name.localeCompare(b.p.name));
  }
  function calendarHTML(ids) {
    const { y, m } = calMonth; const T = RM.TODAY;
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; const days = new Date(y, m + 1, 0).getDate(); const weeks = Math.ceil((lead + days) / 7);
    const ann = monthAnniversaries(ids, y, m); const byDay = {}; ann.forEach((x) => (byDay[x.date.getDate()] = byDay[x.date.getDate()] || []).push(x));
    const tipOf = (x) => `<b>${esc(x.p.name)}</b><br>${fmt.date(x.date)} · ${x.status ? esc(APPR_LABEL[x.status]) : x.past ? 'before this prototype’s records' : 'later anniversary'}`;
    const link = (x) => x.report && RV.canOpenReport(q.me(), x.p.id);
    const chip = (x) => `<${link(x) ? 'a' : 'button type="button"'} class="cal-chip${x.past && !x.status ? ' is-past' : ''}" ${link(x) ? `href="${RM.appraisalHref(x.report)}"` : `data-action="open-person" data-id="${x.p.id}"`} data-tip="${esc(tipOf(x))}" aria-label="${esc(x.p.name)}${x.status ? ', ' + esc(APPR_LABEL[x.status]) : ''}"><span class="cal-av">${C.avatar(x.p, 'xs')}${x.status ? `<i class="cal-dot" style="background:${APPR_DOT[x.status]}"></i>` : ''}</span><span class="cal-name">${esc(first(x.p))}</span></${link(x) ? 'a' : 'button'}>`;
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = i - lead + 1;
      if (d < 1 || d > days) { cells += '<div class="cal-day is-out" aria-hidden="true"></div>'; continue; }
      const list = byDay[d] || []; const today = T.getFullYear() === y && T.getMonth() === m && T.getDate() === d;
      cells += `<div class="cal-day${i % 7 >= 5 ? ' is-weekend' : ''}${today ? ' is-today' : ''}" aria-label="${d} ${MONTH_NAMES[m]}${today ? ', today' : ''}${list.length ? ': ' + esc(list.map((x) => x.p.name).join(', ')) : ''}">
        <span class="cal-n">${d}</span>${list.slice(0, 2).map(chip).join('')}${list.length > 2 ? `<span class="cal-more" data-tip="${esc(list.slice(2).map((x) => esc(x.p.name)).join('<br>'))}">+${list.length - 2} more</span>` : ''}</div>`;
    }
    const isNow = y === T.getFullYear() && m === T.getMonth();
    return `<div class="cal-head"><h2 class="h3">${MONTH_NAMES[m]} ${y}</h2><span class="small muted">${ann.length ? ann.length + (ann.length === 1 ? ' anniversary' : ' anniversaries') : 'No anniversaries'}</span>
        <div class="cal-nav"><button type="button" class="icon-btn" data-cal="prev" aria-label="Previous month">${ic('alt-arrow-left-linear')}</button><button type="button" class="btn btn-secondary btn-sm" data-cal="today" ${isNow ? 'disabled' : ''}>Today</button><button type="button" class="icon-btn" data-cal="next" aria-label="Next month">${ic('alt-arrow-right-linear')}</button></div></div>
      <div class="cal-dow" aria-hidden="true">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend cal-legend">${LEGEND.map(([k, label]) => `<span><i class="cal-dot" style="background:${APPR_DOT[k]}"></i>${label}</span>`).join('')}<span><i class="cal-dot is-past"></i>Earlier</span></div>`;
  }
  // the upcoming list: compact rows for the side panel
  function apprItem(p, a) {
    const pv = a.preview; const r = a.report;
    const sub = r ? `${fmt.date(a.anniv)} · ${r.status === 'Generated' ? r.quarterKeys.length + ' quarters' : r.reason === 'blocked' ? 'waiting on ' + r.blocking.map((k) => RV.quarter(k).short).join(', ') : 'fewer than three quarters'}`
      : `${fmt.date(a.anniv)} · ${ago(a.days)} · ${pv ? `${pv.ready} of ${pv.window.length} quarters done` : ''}`;
    return `<div class="list-item appr-item">${C.person(p, sub, { link: true, size: 'sm' })}
      <span class="meta">${C.appr(a.status)}${r && RV.canOpenReport(q.me(), p.id) ? `<a class="link-btn small" href="${RM.appraisalHref(r)}">${r.status === 'Generated' ? 'Open summary' : 'Details'} ${ic('arrow-right-linear')}</a>` : ''}</span></div>`;
  }
  V.appraisals = {
    title: 'Upcoming Appraisals',
    render({ params }) {
      const scope = apprScope(); if (!calMonth) calMonth = { y: RM.TODAY.getFullYear(), m: RM.TODAY.getMonth() };
      const win = ['30', '90', 'all'].includes(params.w) ? params.w : '30';
      const list = q.upcomingAppraisals(scope, win === 'all' ? 400 : +win);
      const base = '#/ph/appraisals';
      return `<div class="page">
      <header class="page-head">
        <div><h1 class="display" data-split>Upcoming <em class="accent">Appraisals</em><span class="dot-o">.</span></h1></div>
      </header>
      <section class="appr-layout">
        <div class="card cal-card" id="appr-cal" data-reveal>${calendarHTML(scope)}</div>
        <div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">Upcoming</h2><span class="spacer">${C.seg([{ key: '30', label: '30 days', href: base + '?w=30' }, { key: '90', label: '90 days', href: base + '?w=90' }, { key: 'all', label: 'All', href: base + '?w=all' }], win).replace('class="seg"', 'class="seg seg-sm"')}</span></div>
          <div class="list">${list.length ? list.map(({ p, a }) => apprItem(p, a)).join('') : `<p class="small muted" style="padding:6px 22px 20px">No appraisals in the ${win === 'all' ? 'coming year' : 'next ' + win + ' days'}. Try a longer window.</p>`}</div>
        </div>
      </section>
      <p class="small muted" style="margin-top:18px">${ic('info-circle-linear')} The summary shows the average self marks and manager marks over its quarters, never combined. It opens for the employee’s managers, the Practice Head and Admin.</p>
      </div>`;
    },
    mount(root) {
      const cal = root.querySelector('#appr-cal');
      cal.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cal]'); if (!b) return;
        const { y, m } = calMonth; const T = RM.TODAY;
        const d = b.dataset.cal === 'today' ? new Date(T.getFullYear(), T.getMonth(), 1) : new Date(y, m + (b.dataset.cal === 'next' ? 1 : -1), 1);
        calMonth = { y: d.getFullYear(), m: d.getMonth() }; RM.tip.hide();
        cal.innerHTML = calendarHTML(apprScope());
        const again = cal.querySelector(`[data-cal="${b.dataset.cal}"]`); if (again && !again.disabled) again.focus(); // keep keyboard focus on the control
        if (!RM.reduced() && window.gsap) gsap.fromTo(cal.querySelector('.cal-grid'), { opacity: 0, x: b.dataset.cal === 'prev' ? -10 : 10 }, { opacity: 1, x: 0, duration: .24, ease: 'power2.out', clearProps: 'transform' });
      });
    },
  };

  /* ============== Profile ============== */
  V.profile = {
    title: 'Profile',
    render({ me }) { return `<div class="page">${profileBody(me, me, true)}</div>`; },
  };
  function profileBody(p, viewer, isPage) {
    const rm = q.person(p.rm); const directs = q.directs(p.id); const appr = RV.inCycles(p) ? q.appraisal(p) : null;
    const ov = store.db.overrides[p.id];
    const lm = q.latestMonth(); const fin = q.finScope(viewer, p) ? q.finRow(p.id, lm) : null;
    const see = RV.canSee(viewer, p.id); const recs = see ? RV.recsOf(p.id) : []; const ytd = RV.ytd(p.id);
    const field = (icon, label, value, cls) => `<div class="field-item ${cls || ''}"><div class="field-item-label">${ic(icon)}${label}</div><div class="field-item-value">${value}</div></div>`;
    return `
      <header class="${isPage ? 'page-head' : ''}" ${isPage ? '' : 'style="padding:4px 0 18px"'}>
        <div class="profile-hero">${C.avatar(p, 'xl')}<div>
          <div class="eyebrow" style="margin-bottom:8px">${esc(p.id)} · ${esc(p.practice)}</div>
          <h1 class="${isPage ? 'display' : 'h2'}" ${isPage ? 'data-split' : ''} style="${isPage ? '' : 'font-size:26px'}">${esc(p.name)}</h1>
          <div class="hstack" style="margin-top:10px;gap:8px"><span class="badge b-info no-dot">${esc(p.role === '–' ? 'No platform role' : p.role)}</span><span class="small muted">${esc(p.designation)}</span>${p.status !== 'Active' ? '<span class="badge">Archived</span>' : ''}${p.mapPending ? '<span class="badge b-warn" data-tip="Designation → platform role mapping awaits Admin confirmation">Mapping pending</span>' : ''}</div>
        </div></div>
      </header>
      <div class="grid ${isPage ? 'g-main-side' : ''}" style="gap:16px;align-items:start">
        <div class="stack">
        <div class="card info-panel" data-reveal style="--accent:var(--info-dot)">
          <div class="info-head"><span class="info-ic" style="background:var(--info-bg);color:var(--info)">${ic('users-group-rounded-linear')}</span><div><h2 class="h3">Role and reporting</h2><div class="small muted">Who they are and where they sit in the practice</div></div></div>
          <div class="field-grid">
            ${field('user-id-linear', 'Employee ID', esc(p.id))}
            ${field('case-linear', 'Designation', esc(p.designation) + (p.level ? ` <span class="muted" style="font-weight:450">· ${esc(p.level)}</span>` : ''))}
            ${field('buildings-2-linear', 'Practice', esc(p.practice))}
            ${field('user-check-linear', 'Reporting manager', rm ? C.who(rm, null, 'link-btn') : p.rmExternal ? `${esc(p.rmExternal)} <span class="muted" style="font-weight:450">· outside the practice</span>` : '<span class="muted">Practice leadership</span>')}
            ${field('users-group-rounded-linear', 'Direct reportees', directs.length ? `<span class="hstack" style="gap:8px">${C.avLinks(directs.slice(0, 5))}${directs.length}</span>` : '<span class="muted">None</span>')}
            ${field('check-circle-linear', 'Status', `<span class="badge ${p.status === 'Active' ? 'b-ok' : ''}">${esc(p.status)}</span>`)}
            ${field('pie-chart-2-linear', 'Client allocation', esc(p.alloc === '–' ? 'None' : p.alloc))}
          </div>
        </div>
        <div class="card info-panel" data-reveal style="--accent:var(--orange)">
          <div class="info-head"><span class="info-ic" style="background:var(--orange-50);color:var(--orange-ink)">${ic('document-text-linear')}</span><div><h2 class="h3">Contact and review setup</h2><div class="small muted">How to reach them and which form they fill in</div></div></div>
          <div class="field-grid">
            ${field('letter-linear', 'Work email', esc(p.email), 'span-2')}
            ${field('calendar-linear', 'Joined', `${fmt.date(p.joined)} <span class="sample-tag">Sample</span>`)}
            ${field('calendar-mark-linear', 'Next appraisal', appr ? fmt.date(appr.preview.date) : '<span class="muted">Not in appraisals</span>')}
            ${field('clipboard-list-linear', 'Review template', (RV.inCycles(p) ? esc(RM.formsLabel(p)) : `<span class="muted">${p.mapPending ? 'Role mapping pending: not in reviews yet' : 'Not in reviews'}</span>`) + (ov ? ' <span class="badge b-orange" data-tip="' + esc(ov.reason) + '">Override</span>' : ''), 'span-2')}
          </div>
          ${isPage ? `<p class="small muted" style="margin-top:16px">${ic('info-circle-linear')} People data is maintained by Admin and the Practice Head. Ask them to correct anything that looks wrong.</p>` : ''}
        </div>
        </div>
        <div class="stack">
          ${recs.length ? `<div class="card" data-reveal><div class="card-head"><h2 class="h3">Marks</h2><span class="spacer small muted">${ytd.n ? `This review year · manager ${pct(ytd.mgr)} · self ${pct(ytd.self)}` : recs.length + ' quarters on record'}</span></div>
            <div class="list">${recs.slice(-4).reverse().map((r) => { const qq = RV.quarter(r.key); return C.linkRow(RM.quarterHref(r, viewer), `Open the ${qq.short} marks`, `<span style="min-width:0"><span class="strong" style="display:block">${esc(qq.short)}</span><span class="person-sub">Manager ${C.who(q.person(r.reviewer))}${RV.mgrShown(viewer, r) && r.mgrMark != null ? ' · ' + RV.markText(r, r.mgrMark) : ''}</span></span><span class="meta">${C.status(r.status, q.isFrozen(r), RV.incomplete(r))}</span>`); }).join('')}</div>
            <div class="card-foot" style="gap:16px;flex-wrap:wrap"><a class="link-btn" href="${RM.reviewPageHref(p.id, 'month', null, viewer)}">${viewer.id === p.id ? 'My review' : 'Open review'} ${ic('arrow-right-linear')}</a><a class="link-btn" href="${RM.reviewsHref(p.id, viewer)}">History ${ic('arrow-right-linear')}</a></div></div>`
            : see ? '' : `<div class="card card-pad" data-reveal><h2 class="h3" style="margin-bottom:12px">Reviews</h2><p class="small muted">${ic('lock-keyhole-minimalistic-linear')} Reviews are visible to the person, their managers, the Practice Head and Admin.</p></div>`}
          <div class="card card-pad" data-reveal><h2 class="h3" style="margin-bottom:12px">Financial · ${fmt.monthLabel(lm)}</h2>
            ${fin ? `<dl class="kv"><dt>Billability</dt><dd>${fin.billable ? 'Billable' : 'Non-billable'}</dd><dt>Forecast</dt><dd class="num">${fmt.inr(fin.forecast)}</dd><dt>Actual</dt><dd class="num">${fin.actual != null ? fmt.inr(fin.actual) : 'Not uploaded yet'}</dd><dt>Actual − forecast</dt><dd class="num">${fin.billable && fin.actual != null ? fmt.inr(fin.actual - fin.forecast, { plus: true }) : '–'}</dd></dl>`
            : `<p class="small muted">${ic('lock-keyhole-minimalistic-linear')} ${q.hasFinance(viewer) ? 'Not in your financial scope.' : 'Financial figures are visible to PM, Practice Head and Admin roles only.'}</p>`}
          </div>
        </div>
      </div>`;
  }
  RM.profileBody = profileBody;

  const wait = (ms) => new Promise((res) => setTimeout(res, RM.reduced() ? 0 : ms));
  RM.wait = wait;
})(window.RM);
