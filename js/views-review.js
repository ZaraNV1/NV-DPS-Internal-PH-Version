/* NV-DPS-Internal review pages, on the records in review.js. Three screens:
 *  - Review: one page per person, with three tabs. This month: the monthly review and the evidence added under each
 *    goal. Marks: a quarter's marks, self then manager, which makes them final. History: each review year's quarters,
 *    monthly reviews and evidence, and the appraisal summaries. Quarters are the person's own: they follow the joining date
 *  - Team (managers and the Practice Head) and Reviews (Admin): one list of people and what each one is waiting on
 *  - the Appraisal summary: a printable snapshot of the quarters behind an appraisal, with versions after a correction */
(function (RM) {
  'use strict';
  const { esc, ic, q, fmt, C } = RM;
  const V = RM.views; const store = RM.store; const O = RM.overlay; const RV = RM.RV;
  const first = (p) => fmt.first(p.name);
  const motion = () => !RM.reduced() && window.gsap;
  const pct = (v) => RV.fmtPct(v);
  const markHtml = (rec, v) => (v == null ? '<span class="faint">–</span>' : `<span class="num">${v}<small class="muted"> / ${RV.quarterMax(rec)}</small></span>`);
  const flagBadges = (flags) => (flags || []).map((f) => C.appr(RV.FLAG_LABEL[f] || f)).join(' ');
  const pageMsg = (icon, title, body) => `<div class="page"><div class="card" style="margin-top:24px">${C.empty(icon, title, body)}</div></div>`;
  const ACCESS_TEXT = 'the person, their managers, the Practice Head and Admin';
  const day = (d) => fmt.date(d, { noYear: true });
  const day0 = (d) => { d = new Date(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

  /* ---------- links: every review link opens the person's Review page, on the tab it's about ---------- */
  const own = (me, emp) => !!me && me.id === emp;
  // the Practice Head reads anyone else's reviews on their profile's Reviews tab; the Review page stays for what's theirs to do
  // there: a quarter's marks, and This month for a direct reportee whose monthly feedback they add
  RM.reviewOnProfile = (me, emp, tab) => q.isPH(me) && !own(me, emp) && tab !== 'marks' && (tab === 'history' || !RV.canEditEntry(me, emp, RV.curMonth(), 'mgr'));
  RM.reviewPageHref = (emp, tab, extra, me) => {
    me = me || q.me(); if (RM.reviewOnProfile(me, emp, tab)) return '#/people/' + emp + '?tab=reviews';
    const qs = [tab && tab !== 'month' ? 't=' + tab : ''].concat(Object.entries(extra || {}).filter(([, v]) => v != null).map(([k, v]) => k + '=' + encodeURIComponent(v))).filter(Boolean).join('&');
    return (own(me, emp) ? '#/me/review' : '#/review/' + emp) + (qs ? '?' + qs : '');
  };
  // a month: this month's on This month; an earlier one is in History, with its year open
  RM.formHref = (emp, mk, me) => (!mk || mk >= RV.curMonth() ? RM.reviewPageHref(emp, 'month', null, me) : RM.reviewPageHref(emp, 'history', { m: mk }, me));
  RM.quarterHref = (rec, me) => RM.reviewPageHref(rec.emp, 'marks', { q: rec.key }, me);
  RM.reviewHref = RM.quarterHref;
  RM.reviewsHref = (emp, me) => RM.reviewPageHref(emp, 'history', null, me);
  RM.appraisalHref = (a, v) => '#/appraisal/' + a.id + (v ? '?v=' + v : '');
  // breadcrumbs: someone else's review sits under the viewer's team list (Reviews for Admin, Practice Reviews for the Practice Head)
  const teamCrumb = (me) => (q.isAdmin(me) ? { back: '#/admin/reviews', title: 'Reviews' } : q.isPH(me) ? { back: '#/ph/reviews', title: 'Practice Reviews' } : q.hasReportees(me.id) ? { back: '#/me/team', title: 'Team' } : { back: '#/me/performance', title: 'Dashboard' });
  const docCrumb = (emp, me, what) => { const p = q.person(emp); if (!p) return null; return RV.canSee(me, emp) ? { back: RM.reviewsHref(emp, me), title: own(me, emp) ? 'My review' : p.name, name: what } : { back: '#/' + (q.isAdmin(me) ? 'admin/overview' : q.isPH(me) ? 'ph/overview' : 'me/performance'), title: 'Dashboard', name: p.name + ' · ' + what }; };

  /* ---------- unsaved work: a monthly review's parts, the form's evidence or a goal sheet's marks, kept until saved (app.js asks before leaving) ---------- */
  RM.gs = RM.gs || {};
  const drafts = new Map();
  RM.gs.dirty = false;
  RM.gs.discard = () => { drafts.clear(); RM.gs.dirty = false; };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const partKey = (emp, mk, part) => 'm|' + emp + '|' + mk + '|' + part;
  const saved = (emp, mk, part) => { const m = RV.month(emp, mk); return (m && m[part]) || RV.emptyPart(part); };
  const partWork = (emp, mk, part) => drafts.get(partKey(emp, mk, part)) || saved(emp, mk, part);
  const editPart = (emp, mk, part) => { const k = partKey(emp, mk, part); if (!drafts.has(k)) drafts.set(k, clone(saved(emp, mk, part))); RM.gs.dirty = true; return drafts.get(k); };
  const recKey = (rec, kind) => 'q|' + rec.id + '|' + kind;
  // a goal sheet's side as this viewer edits it: the employee's own draft while changes are requested (RV.selfWorkOf)
  const recBase = (rec, kind) => (kind === 'self' ? RV.selfWorkOf(q.me(), rec) : rec[kind]);
  const recWork = (rec, kind) => drafts.get(recKey(rec, kind)) || recBase(rec, kind);
  const editRec = (rec, kind) => { const k = recKey(rec, kind); if (!drafts.has(k)) drafts.set(k, clone(recBase(rec, kind))); RM.gs.dirty = true; return drafts.get(k); };

  /* ---------- the form's evidence: one running table per evidence form, each row dated to the month it was added ---------- */
  // this month's rows, kept until saved: { tables: { formId: rows }, evKind }; earlier months' rows are read-only (RV-06)
  const evKey = (f) => 'e|' + f.id;
  const curRows = (f, id) => { const d = drafts.get(evKey(f)); return d && d.tables[id] ? d.tables[id] : (f.ev[id] || []).filter((r) => r.mk === RV.curMonth()); };
  const editEv = (f, id) => { const k = evKey(f); if (!drafts.has(k)) drafts.set(k, { tables: {}, evKind: clone(f.evKind || {}) }); const d = drafts.get(k); if (id && !d.tables[id]) d.tables[id] = clone(curRows(f, id)); RM.gs.dirty = true; return d; };
  const pastRows = (f, id) => RV.evRows(f, id).filter((r) => r.mk !== RV.curMonth());
  const SIZES_ITSELF = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));
  // the risks form has Deloitte, Non-Deloitte and Internal versions; it opens on the one for the employee's client
  const riskKey = (f) => { const d = drafts.get(evKey(f)); const k = (d && d.evKind) || f.evKind || {}; return k.risk || ({ deloitte: 'deloitte', internal: 'internal' }[RM.clientOf(q.person(f.emp)).k] || 'other'); };
  // a goal's tables: its parts, or the risk versions in use plus (to add to) the one for the employee's client
  const tablesOf = (f, g, editable) => {
    const d = g.form; if (d.parts) return d.parts; if (!d.variants) return [d];
    const cur = d.variants.find((v) => v.key === riskKey(f)); const used = d.variants.filter((v) => RV.evRows(f, v.id).length || curRows(f, v.id).length);
    return editable ? [cur].concat(used.filter((v) => v !== cur)) : used.length ? used : [cur];
  };
  const dateOf = (v) => (v ? new Date(v.length <= 10 ? v + 'T00:00:00' : v) : null);
  const hostOf = (v) => { if (!/^https?:\/\//i.test(v || '')) return null; try { return new URL(v).hostname.replace(/^www\./, '') || null; } catch (err) { return null; } };
  const linkOut = (v) => (hostOf(v) ? `<a class="gs-ev-link" href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(v))}${ic('arrow-right-up-linear')}</a>` : esc(v));
  const TONE = { Yes: 'b-ok', Completed: 'b-ok', Ready: 'b-ok', Closed: 'b-ok', Joined: 'b-ok', Held: 'b-ok', Adopted: 'b-ok', Won: 'b-ok', No: 'b-warn', 'Not done': 'b-warn', 'Not ready': 'b-warn', Open: 'b-warn', 'Not held': 'b-warn', 'In progress': 'b-info', 'Partly ready': 'b-info', Scheduled: 'b-info' };
  const shrink = (file) => new Promise((res, rej) => {
    const src = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { const k = Math.min(1, 960 / Math.max(img.naturalWidth, img.naturalHeight)); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k)); const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(src); res(cv.toDataURL('image/jpeg', 0.74)); };
    img.onerror = () => { URL.revokeObjectURL(src); rej(new Error('unreadable')); };
    img.src = src;
  });
  function evCell(f, c, row, ri, editable, rowLabel) {
    const v = row[c.k] == null ? '' : String(row[c.k]); const lab = `${c.label}, ${rowLabel}`;
    // a deck table's fixed activities: a pick-list on a row being added, the name otherwise
    if (c.type === 'label') {
      if (!editable) return `<td class="gs-ev-lab" data-label="${esc(c.label)}">${esc(v)}</td>`;
      return `<td class="t-select" data-label="${esc(c.label)}"><select class="gs-ev-in" data-ev="${f.id}" data-row="${ri}" data-col="${c.k}" aria-label="${esc(lab)}"><option value="">Choose</option>${f.fixed.map((x) => x[c.k]).map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
    }
    if (!editable) {
      if (!v.trim()) return `<td class="gs-ev-ro t-${c.type}" data-label="${esc(c.label)}"><span class="faint">–</span></td>`;
      let out = esc(v);
      if (c.type === 'date') out = `<span class="num">${fmt.date(dateOf(v))}</span>`;
      else if (c.type === 'url') out = linkOut(v);
      else if (c.type === 'select') out = `<span class="badge ${TONE[v] || ''}">${esc(v)}</span>`;
      else if (c.type === 'photo') out = v.startsWith('data:image/') ? `<img class="gs-photo-img" src="${esc(v)}" alt="${esc(c.label)}">` : '<span class="faint">–</span>';
      else if (c.type === 'num') out = `<span class="num">${esc(v)}</span>`;
      return `<td class="gs-ev-ro t-${c.type}" data-label="${esc(c.label)}">${out}</td>`;
    }
    const at = `data-ev="${f.id}" data-row="${ri}" data-col="${c.k}" aria-label="${esc(lab)}"`;
    let field;
    if (c.type === 'date') field = `<input class="gs-ev-in" type="date" ${at} value="${esc(v.slice(0, 10))}">`;
    else if (c.type === 'url') field = `<input class="gs-ev-in" type="url" inputmode="url" autocomplete="off" placeholder="https://" ${at} value="${esc(v)}">`;
    else if (c.type === 'num') field = `<input class="gs-ev-in num" inputmode="numeric" autocomplete="off" ${at} value="${esc(v)}">`;
    else if (c.type === 'select') field = `<select class="gs-ev-in" ${at}><option value="">Choose</option>${c.opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (c.type === 'photo') field = v.startsWith('data:image/') ? `<span class="gs-photo"><img class="gs-photo-img" src="${esc(v)}" alt="${esc(lab)}"><button type="button" class="link-btn" data-evphotodel="${f.id}" data-row="${ri}" data-col="${c.k}">Remove</button></span>`
      : `<label class="gs-photo-add">${ic('upload-minimalistic-linear')}<span>Add ${esc(c.label.toLowerCase())}</span><input class="sr-only" type="file" accept="image/*" data-evphoto="${f.id}" data-row="${ri}" data-col="${c.k}" aria-label="${esc(lab)}"></label>`;
    else field = `<textarea class="gs-ev-in" rows="1" ${at}>${esc(v)}</textarea>`;
    return `<td class="t-${c.type}" data-label="${esc(c.label)}">${field}</td>`;
  }
  const monthTag = (mk) => RV.monthShort(mk) + ' ' + mk.slice(2, 4);
  // a running table: earlier rows read-only, rows added this month editable by the employee
  // o: past (rows), cur (this month's rows), editable, month (false hides the Added column, for a single month), empty,
  // limit (show only the latest earlier rows, with a link to the rest)
  function evTable(f, o) {
    const all = o.past || []; const hidden = o.limit && all.length > o.limit ? all.length - o.limit : 0; const past = hidden ? all.slice(hidden) : all;
    const cur = o.cur || []; const ed = !!o.editable; const mcol = o.month !== false;
    const units = f.cols.reduce((a, c) => a + c.w, 0) + (mcol ? 0.6 : 0); const span = f.cols.length + (mcol ? 1 : 0) + (ed ? 1 : 0);
    const lab = (row, i) => (f.fixed && row[f.cols[0].k] ? row[f.cols[0].k] : 'row ' + (i + 1));
    const mcell = (mk) => (mcol ? `<td class="gs-ev-ro gs-ev-mk" data-label="Added"><span class="num">${esc(monthTag(mk))}</span></td>` : '');
    const more = hidden ? `<tr class="gs-ev-more"><td colspan="${span}"><button type="button" class="link-btn small" data-evmore="${f.id}">${ic('alt-arrow-up-linear')}Show ${hidden} earlier ${hidden === 1 ? 'row' : 'rows'}</button></td></tr>` : '';
    const body = more + past.map((row, i) => `<tr class="is-past">${mcell(row.mk)}${f.cols.map((c) => evCell(f, c, row, i, false, lab(row, i))).join('')}${ed ? '<td class="gs-ev-x"></td>' : ''}</tr>`).join('')
      + cur.map((row, i) => `<tr${ed ? ' class="is-now"' : ''}>${mcell(row.mk || RV.curMonth())}${f.cols.map((c) => evCell(f, c, row, i, ed, lab(row, i))).join('')}${ed ? `<td class="gs-ev-x"><button type="button" class="gs-ev-del" data-evdel="${f.id}" data-row="${i}" aria-label="Remove row ${i + 1} added this month" title="Remove row">${ic('close-circle-linear')}</button></td>` : ''}</tr>`).join('');
    return `<div class="gs-ev-wrap" data-lenis-prevent><table class="gs-ev${ed ? ' is-edit' : ''}" data-form="${f.id}" style="--cols:${span}"><colgroup>${mcol ? `<col style="width:${((0.6 / units) * 100).toFixed(2)}%">` : ''}${f.cols.map((c) => `<col style="width:${((c.w / units) * 100).toFixed(2)}%">`).join('')}${ed ? '<col class="gs-ev-xcol">' : ''}</colgroup>
      <thead><tr>${mcol ? '<th scope="col">Added</th>' : ''}${f.cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}${ed ? '<th scope="col"><span class="sr-only">Remove</span></th>' : ''}</tr></thead>
      <tbody>${body || `<tr class="gs-ev-none"><td colspan="${span}">${esc(o.empty || 'Nothing added yet.')}</td></tr>`}</tbody></table></div>
      ${ed ? `<div class="gs-ev-acts" data-acts="${f.id}"><button type="button" class="link-btn" data-evadd="${f.id}">${ic('add-circle-linear')}Add row · ${esc(RV.monthLabel(RV.curMonth()))}</button></div>` : ''}`;
  }
  const simpleTable = (cols, rows, empty) => `<div class="gs-ev-wrap" data-lenis-prevent><table class="gs-ev"><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map((r) => `<tr>${r.map((v, i) => `<td class="gs-ev-ro" data-label="${esc(cols[i])}">${v}</td>`).join('')}</tr>`).join('') : `<tr class="gs-ev-none"><td colspan="${cols.length}">${esc(empty)}</td></tr>`}</tbody></table></div>`;
  const mState = (m) => (!m ? '<span class="faint">–</span>' : m.state === 'complete' ? '<span class="badge b-ok">Done</span>' : m.state === 'incomplete' ? '<span class="badge b-warn">Missed</span>' : m.state === 'open' ? '<span class="badge b-info">Open</span>' : '<span class="badge">Not started</span>');

  /* special forms: built from other records, never typed in */
  // Monthly Status Reviews: the monthly reviews themselves, the last six months
  function checkinsForm(ctx) {
    const f = ctx.f; const months = RV.monthsSoFar(f).slice(-6);
    const strip = `<div class="gs-cycle" aria-label="Recent monthly reviews">${months.map((mk) => { const m = RV.month(f.emp, mk); const st = m.state === 'complete' ? 'is-ok' : m.state === 'incomplete' ? 'is-warn' : ''; return `<span class="gs-cyc ${st}${mk === ctx.mk ? ' is-on' : ''}" title="${esc(RV.monthLabel(mk))}: ${esc(RV.monthNote(m))}"><i></i>${esc(RV.monthShort(mk) + '-' + mk.slice(2, 4))}</span>`; }).join('')}</div>`;
    const mg = ctx.m ? ctx.m.mgr : null;
    return `<div class="gs-ev-title">Monthly reviews</div>${strip}
      <p class="gs-ev-hint">${ic('info-circle-linear')}<span>This goal is the monthly review itself${mg && mg.date ? `: ${esc(RV.monthLabel(ctx.mk))}’s meeting was on ${fmt.date(mg.date)}${mg.status ? ', ' + esc(mg.status.toLowerCase()) : ''}` : ''}. Nothing to add here.</span></p>`;
  }
  // Quarterly Goal Reviews: the latest quarters' marks (the person's own quarters, from their joining date)
  function quartersForm(ctx) {
    const me = q.me(); const p = q.person(ctx.f.emp); const keys = [...new Set(RV.monthsSoFar(ctx.f).map((mk) => RV.quarterFor(p, mk).key))].slice(-4);
    const rows = keys.map((k) => { const qq = RV.quarter(k); const r = RV.recFor(ctx.f.emp, k); const st = RV.qState(qq);
      return [`<b>${esc(qq.fq)}</b>`, esc(qq.span), r ? `<a href="${RM.quarterHref(r)}">${C.status(r.status, q.isFrozen(r), RV.incomplete(r))}</a>` : `<span class="badge">${st === 'upcoming' || st === 'running' ? 'In progress' : 'Not taking part'}</span>`, r && RV.selfShown(me, r) && r.selfMark != null ? markHtml(r, r.selfMark) : '–', r && RV.mgrShown(me, r) && r.mgrMark != null ? markHtml(r, r.mgrMark) : '–']; });
    return `<div class="gs-ev-title">Quarter marks</div>${simpleTable(['Quarter', 'Months', 'Status', 'Self', 'Manager'], rows, 'No quarter yet.')}`;
  }
  // Financial Milestones: the uploaded figures for the latest months
  function financeForm(ctx) {
    const fin = store.db.fin[ctx.f.emp] || {};
    const rows = RV.monthsSoFar(ctx.f).filter((mk) => fin[mk]).slice(-6).map((mk) => { const r = fin[mk]; return [`<span class="num">${esc(monthTag(mk))}</span>`, r.billable ? '<span class="badge b-ok">Billable</span>' : '<span class="badge">Not billable</span>', `<span class="num">${fmt.inr(r.forecast)}</span>`, r.actual != null ? `<span class="num">${fmt.inr(r.actual)}</span>` : '<span class="faint">Not uploaded yet</span>']; });
    return `<div class="gs-ev-title">${esc(ctx.sheet.forms.finance.title)}</div>${simpleTable(['Month', 'Billability', 'Forecast', 'Actual'], rows, 'No figures uploaded yet.')}<p class="gs-ev-hint">${ic('info-circle-linear')}<span>${esc(ctx.sheet.forms.finance.hint)}</span></p>`;
  }
  const teamOf = (ctx) => RV.directsAt(ctx.f.emp, RV.monthEnd(ctx.mk) > RM.TODAY ? RM.TODAY : RV.monthEnd(ctx.mk)).filter(RV.inCycles);
  // Monthly Status Reviews – Reporting Team Member: the team's monthly reviews this month
  function teamMonthlyForm(ctx) {
    const rows = teamOf(ctx).map((x) => { const m = RV.month(x.id, ctx.mk); return [C.who(x), esc(x.designation), m ? mState(m) : '<span class="small faint">–</span>', m && RV.canSee(q.me(), x.id) ? `<a class="link-btn small" href="${RM.formHref(x.id, ctx.mk)}">Open ${ic('arrow-right-linear')}</a>` : '']; });
    return `<div class="gs-ev-title">${esc(ctx.sheet.forms.teamMonthly.title)} <span class="gs-ev-flow">${esc(RV.monthLabel(ctx.mk))}</span></div>${simpleTable(['Team member', 'Designation', 'Monthly review', ''], rows, `No one reported to them in ${RV.monthLabel(ctx.mk)}.`)}`;
  }
  // Quarterly Goal Reviews – Reporting Team Member: each team member's marks for their own quarter holding this month
  function teamQuarterlyForm(ctx) {
    const me = q.me();
    const rows = teamOf(ctx).map((x) => { const qq = RV.quarterFor(x, ctx.mk); const ended = RM.TODAY > qq.end; const r = RV.recFor(x.id, qq.key); return [C.who(x), `<span class="nowrap">${esc(qq.short)}</span>`, r ? `<a href="${RM.quarterHref(r)}">${C.status(r.status, q.isFrozen(r), RV.incomplete(r))}</a>` : `<span class="small faint">${ended ? 'Not taking part' : 'Opens ' + day(new Date(qq.end.getTime() + 864e5))}</span>`, r && RV.mgrShown(me, r) && r.mgrMark != null ? markHtml(r, r.mgrMark) : '–']; });
    return `<div class="gs-ev-title">${esc(ctx.sheet.forms.teamQuarterly.title)} <span class="gs-ev-flow">${esc(RV.monthLabel(ctx.mk))}</span></div>${simpleTable(['Team member', 'Their quarter', 'Marks', 'Manager'], rows, 'No one reported to them this quarter.')}<p class="gs-ev-hint">${ic('info-circle-linear')}<span>Each person’s quarters follow their own joining date, so the quarter holding ${esc(RV.monthLabel(ctx.mk))} differs from person to person.</span></p>`;
  }
  const SPECIAL = { conv: checkinsForm, quarters: quartersForm, finance: financeForm, teamMonthly: teamMonthlyForm, teamQuarterly: teamQuarterlyForm };
  // one table's rows on This month: this month's, after the latest few earlier ones (the rest a click away, or in History)
  const evMore = new Set(); // tables showing every earlier row ('form|table')
  const evOpts = (ctx, x) => ({ past: pastRows(ctx.f, x.id), cur: ctx.showCur ? curRows(ctx.f, x.id) : [], editable: ctx.editable && ctx.showCur, empty: 'Nothing added yet.',
    limit: evMore.has(ctx.f.id + '|' + x.id) ? 0 : 3 });
  function goalForm(ctx, g) {
    const d = g.form; if (d.special) return SPECIAL[d.special](ctx);
    const ed = ctx.editable && ctx.showCur; const list = tablesOf(ctx.f, g, ed);
    const sw = d.variants && ed ? `<div class="gs-ev-kind">${C.seg(d.variants.map((v) => ({ key: v.key, label: v.label })), riskKey(ctx.f), 'aria-label="Which projects"').replace('class="seg"', 'class="seg seg-sm"').replace(/data-seg="/g, `data-evkind="${d.id}" data-v="`)}</div>` : '';
    return sw + list.map((x) => `<div class="gs-ev-title">${esc(x.title)}${x.flow ? ` <span class="gs-ev-flow">${esc(x.flow)}</span>` : ''}</div>${evTable(x, evOpts(ctx, x))}${x.hint ? `<p class="gs-ev-hint">${ic('info-circle-linear')}<span>${esc(x.hint)}</span></p>` : ''}`).join('');
  }
  function goalCard(ctx, g) {
    return `<article class="gs-goal${g.form && g.form.special ? ' is-muted' : ''}" id="gs-goal-${g.i}" data-goal="${g.i}" tabindex="-1" aria-labelledby="gs-goal-t-${g.i}">
      <header class="gs-goal-head"><span class="gs-goal-n num" aria-hidden="true">${g.n}</span>
        <div class="gs-goal-t"><div class="gs-goal-sum">${esc(g.summary)}</div><h4 class="gs-goal-detail" id="gs-goal-t-${g.i}"><span class="sr-only">Goal ${g.n}: </span>${esc(g.detail)}</h4></div>
        <span class="gs-goal-w">Out of <b class="num">${g.weight}</b></span></header>
      <div class="gs-goal-form">${goalForm(ctx, g)}</div>
    </article>`;
  }
  function extraCard(ctx, x, cat) {
    return `<article class="gs-goal is-extra" id="gs-extra-${x.id}" data-extra="${cat.id}" aria-labelledby="gs-extra-t-${x.id}">
      <header class="gs-goal-head"><span class="gs-goal-n" aria-hidden="true">${ic('star-linear')}</span>
        <div class="gs-goal-t"><div class="gs-goal-sum">${esc(cat.name)}</div><h4 class="gs-goal-detail" id="gs-extra-t-${x.id}">${esc(x.detail)}</h4></div>
        <span class="gs-pill">Not marked</span></header>
      <div class="gs-goal-form"><div class="gs-ev-title">${esc(x.title)}</div>${evTable(x, evOpts(ctx, x))}${x.hint ? `<p class="gs-ev-hint">${ic('info-circle-linear')}<span>${esc(x.hint)}</span></p>` : ''}</div>
    </article>`;
  }
  // the evidence, by the template's goal categories
  const catTab = new Map(); // the category tab each form was last on
  function evCtx(me, f, mk) {
    const cur = RV.curMonth();
    return { f, mk, emp: f.emp, sheet: RV.sheetAt(f, RV.formLast(f)), m: RV.readMonth(me, f.emp, mk), editable: RV.canEditEvidence(me, f), showCur: RV.formFor(f.emp, cur) === f };
  }
  function evidencePanel(ctx) {
    const cats = ctx.sheet.categories; const cur = cats.some((c) => c.id === catTab.get(ctx.f.id)) ? catTab.get(ctx.f.id) : cats[0].id; const c = cats.find((x) => x.id === cur);
    return `<div class="gs-tabs" role="tablist" aria-label="Goal categories" data-lenis-prevent>${cats.map((t) => `<button type="button" class="fpill gs-tab" role="tab" aria-selected="${t.id === cur}" tabindex="${t.id === cur ? 0 : -1}" data-rftab="${t.id}">${esc(t.name)} <span class="n">${t.goals.length}</span></button>`).join('')}</div>
      <div class="gs-tabpanel" role="tabpanel" tabindex="0" data-rfpanel>
        <div class="gs-cat-intro"><b>${esc(c.name)}</b><span>Out of <b class="num">${c.weight}</b></span><span>${c.goals.length} ${c.goals.length === 1 ? 'goal' : 'goals'}</span></div>
        <div class="gs-goals">${ctx.sheet.goals.filter((g) => g.cat === cur).map((g) => goalCard(ctx, g)).join('')}${c.extra ? extraCard(ctx, c.extra, c) : ''}</div>
      </div>`;
  }
  // This month's evidence card: rows added under each goal, this month's editable by the employee
  function evidenceSection(me, f, mk) {
    const ctx = evCtx(me, f, mk); const cur = RV.curMonth(); const p = q.person(f.emp);
    const last = Object.values(f.ev).flat().filter((r) => r.mk === cur).map((r) => r.at).sort().pop();
    const status = drafts.has(evKey(f)) ? ic('pen-2-linear') + '<span>Unsaved changes</span>' : last ? ic('check-circle-bold') + `<span>Saved ${fmt.rel(last)}</span>` : ic('info-circle-linear') + `<span>Nothing added in ${esc(RV.monthLabel(cur))} yet</span>`;
    const prev = RV.formsOf(f.emp).find((x) => x.n === f.n - 1); const since = prev ? ` This record started in ${esc(RV.monthLabel(f.start))}, with the review year; earlier years are in History.` : '';
    const lede = ctx.editable ? `Add a row under a goal for each thing you did in ${esc(RV.monthLabel(cur))}. You can change these rows until ${day(RV.monthEnd(cur))}.${since}`
      : `What ${esc(first(p))} added under each goal; this month’s rows come last.${since}`;
    return `<section class="section card rf-ev" id="rf-ev" data-reveal>
      <div class="card-head"><div><h2 class="h3">Evidence</h2><p class="small muted" style="margin-top:3px">${lede}</p></div></div>
      <div class="card-body" data-evbody>${evidencePanel(ctx)}</div>
      ${ctx.editable ? `<div class="card-foot ci-foot"><span class="status-line" data-evstatus>${status}</span><button type="button" class="btn btn-primary btn-sm" data-evsave>${ic('check-circle-linear')}Save evidence</button></div>` : ''}
    </section>`;
  }

  /* ---------- the monthly review: the employee's part and the manager's part of the same entry (RV-05) ---------- */
  // mk: the monthly review's month, which bounds the discussion date
  function partFields(part, data, editable, mk) {
    return RV.CHECKIN[part].map((c) => {
      const v = data && data[c.k] != null ? String(data[c.k]) : ''; const id = `ci-${part}-${c.k}`;
      const lab = `<label for="${id}">${esc(c.label)}${c.required && editable ? ' <span class="muted" style="font-weight:450">· needed</span>' : ''}</label>`;
      if (!editable) {
        let out = v.trim() ? esc(v) : '<span class="faint">–</span>';
        if (v && c.type === 'date') out = `<span class="num">${fmt.date(v)}</span>`;
        if (v && c.type === 'url') out = linkOut(v);
        if (v && c.type === 'select') out = `<span class="badge ${TONE[v] || ''}">${esc(v)}</span>`;
        return `<div class="field ci-f${c.type ? ' is-' + c.type : ''}"><span class="ci-l">${esc(c.label)}</span><div class="rf-ro">${out}</div></div>`;
      }
      const at = `id="${id}" data-ci="${part}" data-k="${c.k}"`;
      let ctl;
      if (c.type === 'date') ctl = `<input class="input" type="date" ${at} value="${esc(v.slice(0, 10))}"${mk ? ` min="${mk}-01" max="${mk}-${String(RV.monthEnd(mk).getDate()).padStart(2, '0')}"` : ''}>`;
      else if (c.type === 'url') ctl = `<input class="input" type="url" inputmode="url" autocomplete="off" placeholder="https://newvision.sharepoint.com/…" ${at} value="${esc(v)}">`;
      else if (c.type === 'select') ctl = `<select class="select" ${at}><option value="">Choose</option>${c.opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      else ctl = `<textarea class="textarea" rows="2" ${at}>${esc(v)}</textarea>`;
      return `<div class="field ci-f${c.type ? ' is-' + c.type : ''}">${lab}${ctl}</div>`;
    }).join('');
  }
  const partChip = (done, open, future) => (done ? `<span class="badge b-ok no-dot">${ic('check-circle-bold')}Done</span>` : future ? '<span class="badge no-dot">Not started</span>' : open ? '<span class="badge b-info no-dot">To do</span>' : '<span class="badge b-warn no-dot">Missed</span>');
  function checkinCard(me, ctx) {
    const p = q.person(ctx.emp); const m = ctx.m; const open = m.state === 'open';
    const rm = q.person(RV.rmAt(p, RV.monthEnd(ctx.mk) > RM.TODAY ? RM.TODAY : RV.monthEnd(ctx.mk)));
    const eE = RV.canEditEntry(me, ctx.emp, ctx.mk, 'emp'); const eM = RV.canEditEntry(me, ctx.emp, ctx.mk, 'mgr');
    const ew = eE ? partWork(ctx.emp, ctx.mk, 'emp') : m.emp; const mw = eM ? partWork(ctx.emp, ctx.mk, 'mgr') : m.mgr;
    const dirty = (part) => drafts.has(partKey(ctx.emp, ctx.mk, part));
    const foot = (part, label) => `<div class="ci-foot"><span class="status-line" data-cistatus="${part}">${dirty(part) ? ic('pen-2-linear') + '<span>Unsaved changes</span>' : (part === 'emp' ? m.emp : m.mgr) ? ic('check-circle-bold') + `<span>Saved ${fmt.rel((part === 'emp' ? m.emp : m.mgr).savedAt)}</span>` : ic('info-circle-linear') + '<span>Not saved yet</span>'}</span><button type="button" class="btn btn-primary btn-sm" data-cisave="${part}">${ic('check-circle-linear')}${label}</button></div>`;
    const mgrBody = m.mgrHidden || (own(me, ctx.emp) && !m.mgrDone && !eM)
      ? `<p class="small muted ci-wait">${ic('hourglass-linear')} ${m.mgrHidden ? `${esc(first(rm || { name: 'Your manager' }))} has started their feedback. You’ll see it once it’s done.` : open ? `${esc(rm ? rm.name : 'Your manager')} adds feedback and follow-ups after you meet.` : 'No feedback was added this month.'}</p>`
      : partFields('mgr', mw, eM, ctx.mk);
    return `<section class="ci" aria-label="Monthly review">
      <div class="ci-part"><div class="ci-head"><div><b>Progress</b><span class="small muted">${esc(p.name)}</span></div>${partChip(m.empDone, open, m.state === 'future')}</div>
        <div class="ci-fields">${partFields('emp', ew, eE)}</div>${eE ? foot('emp', 'Save progress') : ''}</div>
      <div class="ci-part"><div class="ci-head"><div><b>Feedback</b><span class="small muted">${rm ? esc(rm.name) : '–'}</span></div>${partChip(m.mgrDone, open, m.state === 'future')}</div>
        <div class="ci-fields">${mgrBody}</div>${eM ? foot('mgr', 'Save feedback') : ''}</div>
    </section>`;
  }
  /* ---------- several months at once (a goal sheet's quarter, a year, a report): one monthly review table and one evidence
   * record, never a form per month ---------- */
  // the months' monthly reviews in one table, a row a month with both parts, as this viewer may read them
  // hl: a month to pick out (a link to an earlier month lands on its row)
  RM.checkinTable = (me, emp, months, hl) => {
    const ms = months.map((mk) => RV.readMonth(me, emp, mk)).filter(Boolean); if (!ms.length) return '<p class="small muted">No monthly reviews to show.</p>';
    const txt = (v) => String(v == null ? '' : v).trim();
    const sub = (label, v) => (txt(v) ? `<div class="ckt-sub"><span>${label}</span> ${label === 'Review deck' ? linkOut(txt(v)) : esc(txt(v))}</div>` : '');
    const empCell = (m) => { const e = m.emp || {}; return txt(e.work) || txt(e.achievements) ? `${txt(e.work) ? esc(txt(e.work)) : '<span class="faint">No progress written</span>'}${sub('Achievements', e.achievements)}${sub('Projects', e.projects)}${sub('Challenges', e.challenges)}${sub('Review deck', e.ppt)}` : `<span class="faint">${m.state === 'open' ? 'Not added yet' : m.state === 'future' ? 'Not started' : 'Not filled in'}</span>`; };
    const mgrCell = (m) => { if (m.mgrHidden) return `<span class="small muted">${ic('hourglass-linear')} Shown once the feedback is done</span>`; const g = m.mgr || {};
      return txt(g.feedback) || g.date ? `${txt(g.feedback) ? esc(txt(g.feedback)) : '<span class="faint">No feedback written</span>'}${sub('Follow-ups', g.followups)}${g.date ? `<div class="ckt-sub"><span>Met</span> ${fmt.date(g.date)}${g.status ? ` · <span class="badge ${TONE[g.status] || ''}">${esc(g.status)}</span>` : ''}</div>` : ''}` : `<span class="faint">${m.state === 'open' ? 'Not added yet' : m.state === 'future' ? 'Not started' : 'Not filled in'}</span>`; };
    return `<div class="table-wrap"><table class="table ckt"><colgroup><col style="width:15%"><col style="width:43%"><col style="width:42%"></colgroup><thead><tr><th>Month</th><th>Progress</th><th>Feedback</th></tr></thead>
      <tbody>${ms.map((m) => `<tr data-mk="${m.mk}"${m.mk === hl ? ' class="is-hl" id="ckt-hl"' : ''}><td class="ckt-m"><b class="nowrap">${esc(RV.monthLabel(m.mk))}</b><div style="margin-top:6px">${mState(m)}</div></td><td data-label="Progress">${empCell(m)}</td><td data-label="Feedback">${mgrCell(m)}</td></tr>`).join('')}</tbody></table></div>`;
  };
  // the evidence added in those months: one running table per goal across them, each row with the month it was added
  RM.evidenceRecord = (me, emp, months) => {
    const ms = months.map((mk) => ({ mk, f: RV.formFor(emp, mk) })).filter((x) => x.f && RV.readMonth(me, emp, x.mk)); if (!ms.length) return { html: '', rows: 0, goals: 0 };
    const rowsOf = (id) => ms.flatMap(({ mk, f }) => RV.evRows(f, id, mk));
    // goals in the latest template's order, then any only an earlier month's template had (a change of template mid-way)
    const sheets = [...new Set(ms.map(({ mk, f }) => RV.templateAt(f, mk)))].reverse().map(RV.sheet); const seen = new Set(); const goals = [];
    sheets.forEach((sh) => sh.goals.forEach((g) => { if (g.form && !g.form.special && !seen.has(g.detail)) { seen.add(g.detail); goals.push(g); } }));
    const extras = []; sheets.forEach((sh) => sh.categories.forEach((c) => { if (c.extra && !seen.has(c.extra.id)) { seen.add(c.extra.id); extras.push({ c, x: c.extra }); } }));
    const blocks = goals.map((g) => ({ g, ts: (g.form.parts || g.form.variants || [g.form]).map((x) => ({ x, rows: rowsOf(x.id) })).filter((t) => t.rows.length) }));
    const filled = blocks.filter((b) => b.ts.length); const empty = blocks.filter((b) => !b.ts.length);
    const ex = extras.map(({ c, x }) => ({ c, x, rows: rowsOf(x.id) })).filter((e) => e.rows.length);
    const title = (x, many) => (many || x.key ? `<div class="gs-ev-title">${esc(x.title)}</div>` : '');
    const html = (filled.map(({ g, ts }) => `<div class="rf-doc-goal"><b>#${g.n} ${esc(g.detail)} <span class="muted" style="font-weight:450">· out of ${g.weight}</span></b>${ts.map(({ x, rows }) => title(x, ts.length > 1) + evTable(x, { past: rows })).join('')}</div>`).join('')
      + ex.map(({ c, x, rows }) => `<div class="rf-doc-goal"><b>${esc(c.name)} · ${esc(x.detail)} <span class="muted" style="font-weight:450">· not marked</span></b>${evTable(x, { past: rows })}</div>`).join('')) || '<p class="small muted">No evidence added in these months.</p>';
    const none = empty.length ? `<p class="small muted" style="margin-top:12px">${ic('info-circle-linear')} Nothing added for ${empty.map(({ g }) => '#' + g.n).join(', ')}.</p>` : '';
    const rows = filled.reduce((a, b) => a + b.ts.reduce((t, x) => t + x.rows.length, 0), 0) + ex.reduce((a, e) => a + e.rows.length, 0);
    return { html: html + none, rows, goals: filled.length };
  };

  /* ---------- This month ---------- */
  const MSTATE = { complete: ['check-circle-linear', 'is-added'], incomplete: ['danger-triangle-linear', 'is-missing'], open: ['pen-new-square-linear', 'is-now'], future: ['calendar-linear', 'is-future'] };
  // the review year at a glance, by the person's own quarters: each monthly review (done, missed, open) and the quarter's marks
  RM.yearStrip = (me, emp, n) => {
    const p = q.person(emp); const yr = n ? RV.year(p, n) : RV.curYear(p);
    return `<div class="ys" role="list" aria-label="Review year ${esc(yr.label)} by quarter">${yr.quarters.map((qq) => {
      const rec = RV.recFor(emp, qq.key); const st = RV.qState(qq);
      const ms = qq.months.map((mk) => {
        const name = RV.monthShort(mk); const m = RV.month(emp, mk);
        if (!m) return `<span class="ys-m is-before" data-tip="${esc(RV.monthLabel(mk))} · not in reviews">${name}</span>`;
        const tip = `<b>${esc(RV.monthLabel(mk))}</b> · ${esc(RV.monthNote(m))}`; const cls = (MSTATE[m.state] || [])[1] || '';
        return m.state === 'future' ? `<span class="ys-m is-future" data-tip="${tip}">${name}</span>` : `<a class="ys-m ${cls}" href="${RM.formHref(emp, mk, me)}" data-tip="${tip}" aria-label="${esc(RV.monthLabel(mk))}: ${esc(RV.monthNote(m))}">${name}</a>`;
      }).join('');
      return `<div class="ys-q" role="listitem"><b class="ys-n">${qq.fq}</b><div class="ys-ms">${ms}</div><span class="ys-st">${rec ? `<a href="${RM.quarterHref(rec)}" aria-label="${esc(qq.short)} marks">${C.status(rec.status, q.isFrozen(rec), RV.incomplete(rec))}</a>` : `<span class="tiny faint">${st === 'running' ? 'In progress' : st === 'upcoming' ? 'Upcoming' : 'Not taking part'}</span>`}</span></div>`;
    }).join('')}</div>`;
  };
  // this month's monthly review: the employee's progress and the manager's feedback, side by side
  function monthPanel(me, f, mk) {
    const m = RV.readMonth(me, f.emp, mk); const sheet = RV.sheetAt(f, mk); const p = q.person(f.emp);
    const ctx = { f, mk, emp: f.emp, sheet, editable: RV.canEditEntry(me, f.emp, mk, 'emp'), m };
    const secs = RV.sectionsFor(f, mk);
    const sub = m.state === 'open' ? `Due ${fmt.date(RV.monthEnd(mk))}. ${own(me, f.emp) ? 'You add your progress; your manager adds feedback after you meet.' : `${esc(first(p))} adds their progress; their manager adds feedback after they meet.`} Anything not done by then is marked missed.`
      : m.state === 'complete' ? 'Done: both parts were added within the month.' : m.state === 'incomplete' ? `Missed: ${esc(RV.monthNote(m).replace(/^Missed · /, ''))}.` : 'Not started yet.';
    return `<section class="card rf-month" data-reveal id="rf-month" data-mk="${mk}">
      <div class="card-head rf-month-h"><div><h2 class="h3">${esc(RV.monthLabel(mk))} monthly review</h2>
        <p class="small muted" style="margin-top:3px">${sub}${secs.length ? ` Includes ${secs.map((k) => esc(RV.SECTIONS[k].name.toLowerCase())).join(', ')}.` : ''}</p></div>
        <span class="spacer">${mState(m)}</span></div>
      <div class="rf-month-body">${checkinCard(me, ctx)}</div>
    </section>`;
  }
  function monthTab(me, emp) {
    const p = q.person(emp); const mk = RV.curMonth(); const f = RV.formFor(emp, mk);
    if (!f || !RV.month(emp, mk)) return `<div class="card" data-reveal>${C.empty('calendar-linear', `No monthly review for ${esc(RV.monthLabel(mk))}`, !RV.inCycles(p) ? `${esc(first(p))} isn’t in reviews.` : `Monthly reviews start in the month ${own(me, emp) ? 'you join' : 'they join'}.`)}</div>`;
    return `<div data-rfpage data-emp="${emp}" data-form="${esc(f.id)}">${monthPanel(me, f, mk)}${evidenceSection(me, f, mk)}</div>`;
  }
  // Admin: changes to the person's form fields over time (a template change, fields added for reportees)
  function formChanges(emp) {
    const what = (e) => (e.section === 'base' ? (e.action === 'closed' ? 'Closed with the review year' : 'Started') : e.section === 'template' ? 'Template changed to ' + RV.templateName(e.template) : RV.SECTIONS[e.section].name + ' fields added');
    const rows = RV.formsOf(emp).flatMap((f) => f.fieldLog); if (!rows.length) return '';
    return `<details class="fy-x card card-pad" data-reveal><summary>${ic('history-linear')}<b>Form changes</b><span class="small muted">Admin only · fields added during a year apply from their month; earlier months stay as they were</span>${ic('alt-arrow-down-linear')}</summary>
      <div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>Change</th><th>From</th><th>Recorded</th><th>By</th></tr></thead><tbody>${rows.map((e) => `<tr><td><b>${esc(what(e))}</b><div class="tiny muted">${esc(RM.plain(e.note || ''))}</div></td><td class="num nowrap">${esc(RV.monthLabel(e.effective))}</td><td class="small num nowrap">${fmt.date(e.at)}</td><td class="small">${e.by === 'system' ? 'System' : C.who(q.person(e.by))}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  function bindForm(root, ctx) {
    const page = root.querySelector('[data-rfpage]'); if (!page) return; const me = ctx.me; const emp = page.dataset.emp;
    const f = RV.form(page.dataset.form); const mk = page.querySelector('#rf-month').dataset.mk;
    RM.gs.dirty = drafts.size > 0;
    const fit = (ta) => { if (SIZES_ITSELF) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    const settle = (scope) => { scope.querySelectorAll('textarea.gs-ev-in').forEach(fit); RM.motion.segThumb(scope); };
    const redraw = () => {
      const t = document.createElement('div'); t.innerHTML = monthPanel(me, f, mk); const n = t.firstElementChild; n.style.opacity = 1;
      page.querySelector('#rf-month').replaceWith(n); settle(n);
    };
    // the evidence card: its body (a category tab) or the whole card (after a save)
    const redrawEv = (whole) => {
      const y = window.scrollY;
      if (whole) { const sec = page.querySelector('#rf-ev'); const t = document.createElement('div'); t.innerHTML = evidenceSection(me, f, mk); const n = t.firstElementChild; n.style.opacity = 1; sec.replaceWith(n); settle(n); }
      else { const b = page.querySelector('[data-evbody]'); b.innerHTML = evidencePanel(evCtx(me, f, mk)); settle(b); }
      window.scrollTo(0, y);
    };
    const status = (part) => { const s = page.querySelector(`[data-cistatus="${part}"]`); if (s) s.innerHTML = ic('pen-2-linear') + '<span>Unsaved changes</span>'; };
    const evStatus = () => { const s = page.querySelector('[data-evstatus]'); if (s) s.innerHTML = ic('pen-2-linear') + '<span>Unsaved changes</span>'; };
    const rowsOf = (id) => editEv(f, id).tables[id];
    const setEv = (id, ri, col, v) => { const arr = rowsOf(id); while (arr.length <= ri) arr.push({}); arr[ri][col] = v; };
    const reCard = (el) => {
      const card = el.closest('.gs-goal'); if (!card) return null; const c = evCtx(me, f, mk);
      const cat = card.dataset.extra && c.sheet.categories.find((x) => x.id === card.dataset.extra);
      const tmp = document.createElement('div'); tmp.innerHTML = cat ? extraCard(c, cat.extra, cat) : goalCard(c, c.sheet.goals[+card.dataset.goal]);
      const n = tmp.firstElementChild; card.replaceWith(n); settle(n); return n;
    };
    page.addEventListener('click', async (e) => {
      const tab = e.target.closest('[data-rftab]');
      if (tab && tab.getAttribute('aria-selected') !== 'true') {
        const ids = evCtx(me, f, mk).sheet.categories.map((c) => c.id); const dir = Math.sign(ids.indexOf(tab.dataset.rftab) - ids.indexOf(catTab.get(f.id) || ids[0]));
        catTab.set(f.id, tab.dataset.rftab); redrawEv();
        const body = page.querySelector('[data-rfpanel]'); if (body && motion()) gsap.fromTo(body.children, { opacity: 0, x: dir * 12 }, { opacity: 1, x: 0, duration: .22, ease: 'power2.out', clearProps: 'transform' });
        const nt = page.querySelector(`[data-rftab="${tab.dataset.rftab}"]`); if (nt) nt.focus({ preventScroll: true });
        return;
      }
      const more = e.target.closest('[data-evmore]');
      if (more) { evMore.add(f.id + '|' + more.dataset.evmore); reCard(more); return; }
      const add = e.target.closest('[data-evadd]');
      if (add) { rowsOf(add.dataset.evadd).push({}); const n = reCard(add); evStatus(); const last = n && n.querySelector(`.gs-ev.is-edit[data-form="${add.dataset.evadd}"] tbody tr:last-child`); if (last) { const fld = last.querySelector('.gs-ev-in, input[type="file"]'); if (fld) fld.focus(); if (motion()) gsap.fromTo(last, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .24, ease: 'power3.out', clearProps: 'transform,opacity' }); } return; }
      const del = e.target.closest('[data-evdel]');
      if (del) { const id = del.dataset.evdel; const ri = +del.dataset.row; const row = del.closest('tr'); const go = () => { rowsOf(id).splice(ri, 1); const n = reCard(row || del); evStatus(); const b = n && n.querySelector(`[data-evadd="${id}"]`); if (b) b.focus(); }; if (row && motion()) gsap.to(row, { opacity: 0, duration: .14, ease: 'power2.out', onComplete: go }); else go(); return; }
      const kind = e.target.closest('[data-evkind]');
      if (kind && kind.getAttribute('aria-selected') !== 'true') { const d = editEv(f); d.evKind = Object.assign({}, d.evKind, { [kind.dataset.evkind]: kind.dataset.v }); reCard(kind); evStatus(); return; }
      const pdel = e.target.closest('[data-evphotodel]');
      if (pdel) { setEv(pdel.dataset.evphotodel, +pdel.dataset.row, pdel.dataset.col, ''); reCard(pdel); evStatus(); return; }
      const evsave = e.target.closest('[data-evsave]');
      if (evsave) {
        const d = drafts.get(evKey(f)); if (!d) { O.toast('Nothing new to save. Add a row first.', { tone: 'info' }); return; }
        evsave.classList.add('is-loading'); await RM.wait(240);
        const cur = RV.curMonth(); RV.saveEvidence(f, cur, d.tables, d.evKind, me.id); drafts.delete(evKey(f)); RM.gs.dirty = drafts.size > 0; store.save(); redrawEv(true);
        const n = Object.values(f.ev).flat().filter((r) => r.mk === cur).length;
        O.toast(`Evidence saved · ${n} ${n === 1 ? 'row' : 'rows'} added in ${RV.monthLabel(cur)}`, { icon: 'check-circle-bold' });
        return;
      }
      const save = e.target.closest('[data-cisave]');
      if (save) {
        const part = save.dataset.cisave; const k = partKey(emp, mk, part); const c = clone(drafts.get(k) || saved(emp, mk, part));
        if (!RV.partHasContent(part, c)) { O.toast(`Add something for ${RV.monthLabel(mk)} before saving.`, { tone: 'warn' }); return; }
        const bad = part === 'mgr' && RV.discussionError(mk, c);
        if (bad) { const inp = page.querySelector('#ci-mgr-date'); if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); } O.toast(bad, { tone: 'warn' }); return; }
        save.classList.add('is-loading'); await RM.wait(240);
        delete c.savedAt; delete c.by; RV.saveEntry(emp, mk, part, c, me.id); drafts.delete(k); RM.gs.dirty = drafts.size > 0; store.save();
        redraw(); RM.app.refreshNav && RM.app.refreshNav();
        const done = RV.partDone[part](c);
        O.toast(done ? `${part === 'emp' ? 'Your progress' : 'Your feedback'} for ${RV.monthLabel(mk)} is saved and done` : part === 'emp' ? 'Saved. Add your work and progress to finish your part.' : 'Saved. Feedback, the meeting date and a held meeting finish your part.', { icon: done ? 'check-circle-bold' : 'info-circle-linear' });
      }
    });
    page.addEventListener('input', (e) => {
      const ev = e.target.closest('[data-ev]');
      if (ev) {
        if (ev.inputMode === 'numeric') { const clean = ev.value.replace(/[^\d]/g, ''); if (clean !== ev.value) ev.value = clean; }
        setEv(ev.dataset.ev, +ev.dataset.row, ev.dataset.col, ev.value); if (ev.tagName === 'TEXTAREA') fit(ev); evStatus();
        // picking a deck activity fills in its usual frequency
        const def = RV.sheetAt(f, RV.curMonth()).forms[ev.dataset.ev];
        if (def && def.fixed && ev.dataset.col === def.cols[0].k) {
          const fx = def.fixed.find((x) => x[ev.dataset.col] === ev.value); const row = rowsOf(def.id)[+ev.dataset.row];
          if (fx) Object.keys(fx).forEach((k) => { if (k !== ev.dataset.col && !row[k]) row[k] = fx[k]; });
          const n = reCard(ev); const again = n && n.querySelector(`[data-ev="${def.id}"][data-row="${ev.dataset.row}"][data-col="${ev.dataset.col}"]`); if (again) again.focus();
        }
        return;
      }
      const ci = e.target.closest('[data-ci]'); if (ci && ci.tagName !== 'SELECT') { const w = editPart(emp, mk, ci.dataset.ci); w[ci.dataset.k] = ci.type === 'date' ? (ci.value ? new Date(ci.value + 'T10:00:00').toISOString() : null) : ci.value; ci.removeAttribute('aria-invalid'); status(ci.dataset.ci); }
    });
    page.addEventListener('change', async (e) => {
      const ci = e.target.closest('select[data-ci]'); if (ci) { editPart(emp, mk, ci.dataset.ci)[ci.dataset.k] = ci.value; status(ci.dataset.ci); return; }
      const ph = e.target.closest('input[type="file"][data-evphoto]'); if (!ph) return; const file = ph.files && ph.files[0]; if (!file) return;
      if (!/^image\//.test(file.type)) { ph.value = ''; O.toast('Choose an image file, such as a JPG or PNG.', { tone: 'warn' }); return; }
      const lab = ph.closest('.gs-photo-add'); lab.classList.add('is-loading');
      let url; try { url = await shrink(file); } catch (err) { lab.classList.remove('is-loading'); ph.value = ''; O.toast('That image couldn’t be read. Try another one.', { tone: 'warn' }); return; }
      if (JSON.stringify(store.db).length + url.length > 4.6e6) { lab.classList.remove('is-loading'); ph.value = ''; O.toast('This browser’s storage for the demo is full. Remove a photo first.', { tone: 'warn' }); return; }
      setEv(ph.dataset.evphoto, +ph.dataset.row, ph.dataset.col, url); reCard(ph); evStatus();
    });
    settle(page);
  }

  /* ---------- Marks: a quarter's marks, the employee's then the manager's, which makes them final ---------- */
  const STEPS = [['Self marks', ['Not Started', 'Draft', 'Changes Requested']], ['With manager', ['With Reviewer']], ['Final', ['Locked']]];
  RM.lifecycle = (rec, compact) => {
    const idx = STEPS.findIndex((s) => s[1].includes(rec.status)); const fin = rec.status === 'Locked';
    return `<div class="lifecycle${compact ? ' is-compact' : ''}" role="list" aria-label="Where the marks are">${STEPS.map((s, i) => {
      const cls = i < idx ? 'is-done' : i === idx ? (fin ? 'is-done' : 'is-current' + (RV.overdue(rec) || rec.status === 'Changes Requested' ? ' is-alert' : '')) : '';
      const name = i === 0 && rec.status === 'Changes Requested' ? 'Changes asked' : s[0];
      return `<div class="lc-step ${cls}" role="listitem" aria-current="${i === idx ? 'step' : 'false'}"><span class="lc-fill" data-lc-fill="${i <= idx ? 1 : 0}"></span><span class="lc-dot">${i < idx || (i === idx && fin) ? ic('check-read-linear') : ''}</span><span class="lc-name">${name}</span></div>`;
    }).join('')}</div>`;
  };
  const correcting = new Set(); // final marks an admin is correcting on this page
  function qNotice(me, rec) {
    const emp = q.person(rec.emp); const rev = q.person(rec.reviewer); const isEmp = me.id === rec.emp; const isRev = me.id === rec.reviewer; const qq = RV.quarter(rec.key); const lb = RV.lockBy(qq);
    const orig = rec.originalReviewer ? q.person(rec.originalReviewer) : null;
    const blocked = RV.appraisalsOf(rec.emp).find((a) => a.status === 'Not generated' && (a.blocking || []).includes(rec.key));
    const block = blocked ? ` ${isEmp ? 'An appraisal summary' : `${esc(first(emp))}’s appraisal summary (${fmt.date(blocked.date)})`} is waiting on these marks and is created once they’re final.` : '';
    if (q.isFrozen(rec)) return C.notice('lock', 'snowflake-linear', `<b>Kept for the record.</b> ${esc(emp.name)} has left, so these marks are out of every list and count.`);
    if (correcting.has(rec.id)) return C.notice('warn', 'pen-2-linear', '<b>Correcting final marks.</b> Both sides can be edited. Saving keeps the old version and updates any appraisal summary that used them.');
    if (rec.status === 'Changes Requested') { const n = rec.changeNote || {}; return C.notice('warn', 'chat-round-line-linear', `<b>${isRev ? 'You' : esc(rev.name)} asked for changes ${n.at ? fmt.rel(n.at) : ''}.</b> “${esc(n.note || '')}” ${isEmp ? 'Update your marks or comments and send them again. Your first version is kept.' : 'The earlier version is kept.'}${RV.overdue(rec) ? ` They were due ${fmt.date(lb)}, so they’re marked missed.` : ''}`); }
    if (RV.overdue(rec)) return C.notice('bad', 'danger-triangle-linear', `<b>Missed.</b> These marks were due ${fmt.date(lb)} and aren’t final, so they count as missed. They can still be finished: ${RV.needsSelf(rec) ? (isEmp ? 'send your marks' : `${esc(first(emp))} hasn’t sent their marks yet`) : isRev ? 'add your marks to make them final' : `waiting on ${esc(rev.name)}’s marks`}.${block}`);
    if (isEmp) {
      if (RV.needsSelf(rec)) return C.notice('', 'pen-new-square-linear', `<b>Due ${fmt.date(lb)}.</b> Mark each goal against what you did in ${esc(qq.span)}, then send your marks to ${esc(rev.name)}. Their marks make them final.`);
      if (RV.needsMgr(rec)) return C.notice('', 'hourglass-linear', `<b>Sent to ${esc(rev.name)}.</b> You’ll see their marks once they’re final.`);
      return C.notice('lock', 'lock-keyhole-minimalistic-linear', `<b>Final ${fmt.date(rec.lockedAt)}${RV.lateLocked(rec) ? ', after the due date (counted as missed)' : ''}.</b> Your marks and your manager’s are kept side by side.`);
    }
    if (isRev) {
      if (RV.needsSelf(rec)) return C.notice('', 'hourglass-linear', `<b>Waiting for ${esc(first(emp))}’s marks.</b> You can add yours once they send them. Due ${fmt.date(lb)}.`);
      if (RV.needsMgr(rec)) return C.notice('', 'user-check-linear', `<b>${esc(first(emp))} sent marks of ${RV.markText(rec, rec.selfMark)}.</b> Add your mark for each goal; sending them makes the marks final. If something needs fixing first, ask for changes.${orig && orig.id !== me.id ? ` You’re covering for ${esc(orig.name)}.` : ''}`);
      return C.notice('lock', 'lock-keyhole-minimalistic-linear', `<b>Final ${fmt.date(rec.lockedAt)}${RV.lateLocked(rec) ? ', after the due date' : ''}.</b> Only Admin can correct final marks.`);
    }
    return C.notice('', 'eye-linear', `<b>View only.</b> ${esc(rev.name)} gives the manager marks${orig ? `, covering for ${esc(orig.name)}` : ''}.${block}`);
  }
  // each goal out of its own maximum, grouped by category and goal summary
  function gsTable(me, rec) {
    const sheet = RV.sheetOf(rec); const self = recWork(rec, 'self'); const mgr = recWork(rec, 'mgr'); const fix = correcting.has(rec.id);
    const eS = fix || RV.canSelf(me, rec); const eM = fix || RV.canMgr(me, rec); const sShown = RV.selfShown(me, rec); const mShown = RV.mgrShown(me, rec);
    const scorable = new Set(RV.scorable(rec)); const Q = RV.quarter(rec.key).fq; const emp = q.person(rec.emp); const who = rec.emp === me.id ? 'Your' : esc(first(emp)) + '’s';
    const num = (kind, g, v) => `<span class="gs-num"><input class="input gs-input num" inputmode="numeric" autocomplete="off" aria-label="${kind === 'self' ? 'Self' : 'Manager'} ${Q} mark for goal ${g.n}, out of ${g.weight}" data-qscore="${kind}" data-i="${g.i}" data-max="${g.weight}" value="${v == null ? '' : v}"><span class="muted">/ ${g.weight}</span></span>`;
    const chip = (v, max) => (v == null ? '<span class="faint">–</span>' : `<span class="gs-chip num">${v}<small>/ ${max}</small></span>`);
    const hide = (w) => `<span class="mgr-hidden">${ic('eye-closed-linear')}${w}</span>`;
    const rows = sheet.categories.map((c) => {
      const groups = []; c.goals.forEach((g) => { const last = groups[groups.length - 1]; if (last && last.summary === g.summary) last.goals.push(g); else groups.push({ summary: g.summary, goals: [g] }); });
      const sum = (sc) => (c.goals.some((g) => sc[g.i] != null) ? c.goals.reduce((a, g) => a + (+sc[g.i] || 0), 0) : ''); const cs = sum(self.scores); const cm = sum(mgr.scores);
      return `<tr class="gs-cat-row"><th colspan="4" scope="rowgroup">${esc(c.name)} <span class="gs-weight is-inline">Out of <b class="num">${c.weight}</b></span></th><td class="num" data-cattotal="self-${c.id}">${sShown ? cs : ''}</td><td class="num" data-cattotal="mgr-${c.id}">${mShown ? cm : ''}</td></tr>` + groups.map((grp) => grp.goals.map((g, k) => {
        const on = scorable.has(g.i); const s = self.scores[g.i]; const m = mgr.scores[g.i];
        const sc = !on ? '<span class="gs-pill">Marked in Q4</span>' : !sShown ? hide('Shown once sent') : eS ? num('self', g, s) : chip(s, g.weight);
        const mc = !on ? '<span class="gs-pill">Marked in Q4</span>' : !mShown ? hide('Shown once final') : eM ? num('mgr', g, m) : chip(m, g.weight);
        const d = on && sShown && mShown && s != null && m != null && s !== m ? `${m > s ? '+' : '−'}${Math.abs(m - s)} vs self` : '';
        const note = mgr.goalNotes && mgr.goalNotes[g.i];
        const noteCell = eM && !fix ? (note != null ? `<textarea class="textarea gs-comment" rows="1" aria-label="Comment on goal ${g.n}" data-qnote="${g.i}">${esc(note)}</textarea>` : `<button type="button" class="link-btn small" data-qaddnote="${g.i}">${ic('chat-round-line-linear')}Comment</button>`) : mShown && note ? `<span class="small">${esc(note)}</span>` : '';
        return `<tr data-goal="${g.i}" class="${on ? '' : 'is-muted'}"><td class="gs-n num" data-label="#">${g.n}</td>
          ${k === 0 ? `<td class="gs-sum" rowspan="${grp.goals.length}" data-label="Goal">${esc(grp.summary)}</td>` : ''}
          <td class="gs-detail" data-label="Details"><span class="gs-mob-sum">#${g.n} · ${esc(grp.summary)}</span>${esc(g.detail)}${noteCell ? `<div class="gs-qnote">${noteCell}</div>` : ''}</td>
          <td class="num gs-split" data-label="Out of">${g.weight}${g.yearly ? ' <span class="muted small">yearly</span>' : ''}</td>
          <td class="gs-score" data-label="${who} mark">${sc}</td>
          <td class="gs-score gs-mcell${d ? ' is-diff' : ''}" data-mcell="${g.i}" data-label="Manager">${mc}<span class="gs-delta" data-delta="${g.i}">${d}</span></td></tr>`;
      }).join('')).join('');
    }).join('');
    return `<div class="table-wrap"><table class="table gs-table is-quarterly">
      <thead><tr><th class="gs-n">#</th><th>Goal</th><th>Details</th><th>Out of</th><th>${who} mark</th><th>Manager</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="small muted gs-hint">${ic('info-circle-linear')} The total is out of ${RV.quarterMax(rec)}.</p>`;
  }
  // what the marks are given against: the quarter's monthly reviews and the evidence added in it
  function quarterMonths(me, rec) {
    const qq = RV.quarter(rec.key); const months = RV.recMonths(rec).map((x) => x.mk); const ev = RM.evidenceRecord(me, rec.emp, months);
    const open = RV.canSelf(me, rec) || RV.canMgr(me, rec);
    return `<details class="fy-x section card card-pad" data-reveal${open ? ' open' : ''}><summary>${ic('clipboard-list-linear')}<b>Monthly reviews and evidence · ${esc(qq.span)}</b><span class="small muted">What the marks are given against${ev.rows ? ` · ${ev.rows} evidence ${ev.rows === 1 ? 'row' : 'rows'}` : ''}</span>${ic('alt-arrow-down-linear')}</summary>
      <div class="doc-ev stack">${RM.checkinTable(me, rec.emp, months)}${ev.html ? `<div><div class="small strong" style="margin:4px 0 8px">Evidence</div>${ev.html}</div>` : ''}</div></details>`;
  }
  function marksCard(me, rec) {
    const sShown = RV.selfShown(me, rec); const mShown = RV.mgrShown(me, rec); const self = recWork(rec, 'self'); const mgr = recWork(rec, 'mgr');
    const ytd = RV.ytd(rec.emp, rec.cycle); const max = RV.quarterMax(rec); const p = q.person(rec.emp); const yr = RV.year(p, rec.cycle);
    const sm = correcting.has(rec.id) || rec.selfMark == null ? RV.markOf(rec, self.scores) : rec.selfMark; const mm = correcting.has(rec.id) || rec.mgrMark == null ? RV.markOf(rec, mgr.scores) : rec.mgrMark;
    // the appraisal this quarter belongs to: its review year's, on the anniversary after it
    const a = RV.appraisalFor(rec.emp, rec.cycle); const canOpen = a && RV.canOpenReport(me, rec.emp);
    const apprText = a && a.status === 'Generated' ? (canOpen ? `<a href="${RM.appraisalHref(a)}">Used in the ${fmt.date(a.date)} summary</a>` : `Used in the ${fmt.date(a.date)} appraisal`)
      : a ? `${canOpen ? `<a href="${RM.appraisalHref(a)}">The ${fmt.date(a.date)} summary</a>` : `The ${fmt.date(a.date)} appraisal`} ${RV.isLocked(rec) ? 'is waiting on another quarter' : 'is waiting on these marks'}`
      : day0(yr.date) <= day0(RM.TODAY) ? '<span class="muted">Its year began before reviews moved here, so it had no summary</span>' : `<span class="muted">Goes into the ${fmt.date(yr.date)} appraisal summary</span>`;
    return `<div class="card card-pad q-marks" data-reveal id="q-marks"><h2 class="h3" style="margin-bottom:14px">Totals</h2>
      <div class="score-pair">
        <div><div class="small muted">Self</div><div class="v num" data-qmark="self">${sShown && sm != null ? sm : '–'}<small> / ${max}</small></div><div class="tiny muted" data-qtotal="self">${sShown ? RV.total(rec, self.scores) + ' so far' : 'Shown once sent'}</div></div>
        <div><div class="small muted">Manager</div><div class="v num" data-qmark="mgr">${mShown && mm != null ? mm : '–'}<small> / ${max}</small></div><div class="tiny muted" data-qtotal="mgr">${mShown ? RV.total(rec, mgr.scores) + ' so far' : 'Shown once final'}</div></div>
      </div>
      <dl class="kv" style="margin-top:14px;grid-template-columns:130px 1fr"><dt>Review year</dt><dd>${ytd.n ? `Self ${pct(ytd.self)} · manager ${pct(ytd.mgr)} <span class="muted">(${ytd.n} final ${ytd.n === 1 ? 'quarter' : 'quarters'})</span>` : '<span class="muted">No final quarter yet</span>'}<div class="tiny muted">${esc(yr.label)}</div></dd>
        ${RV.incomplete(rec) ? `<dt>On time</dt><dd><span class="badge b-warn">Missed</span> <span class="small muted">Not final by ${day(RV.lockBy(RV.quarter(rec.key)))}</span></dd>` : ''}
        <dt>Appraisal</dt><dd>${apprText}</dd></dl>
      <p class="small muted" style="margin-top:10px">Self and manager totals are kept side by side; neither replaces the other.</p></div>`;
  }
  function notesCard(me, rec) {
    const self = recWork(rec, 'self'); const mgr = recWork(rec, 'mgr'); const eS = RV.canSelf(me, rec); const eM = RV.canMgr(me, rec);
    const sShown = RV.selfShown(me, rec); const mShown = RV.mgrShown(me, rec); const emp = q.person(rec.emp);
    return `<section class="section assess">
      <div class="card" data-reveal><div class="card-head"><h2 class="h3">${me.id === rec.emp ? 'Your comments' : esc(first(emp)) + '’s comments'}</h2>${eS ? '<span class="badge b-info no-dot">Editable by you</span>' : ''}</div>
        <div class="card-body stack"><div class="field" id="f-qself"><label for="q-self-notes">How the quarter went</label><textarea class="textarea" id="q-self-notes" data-qnotes="self" ${eS ? '' : 'readonly'} placeholder="${eS ? 'What went well, what you’d change, and the evidence behind your marks' : ''}">${sShown ? esc(self.notes || '') : ''}</textarea><span class="err">${ic('danger-circle-linear')}Write at least 20 characters.</span></div>
        <div><div class="small strong" style="margin-bottom:8px">Value adds</div>${sShown && (self.valueAdds || []).length ? `<ul class="gs-va-list">${self.valueAdds.map((v, i) => `<li class="gs-va"><span class="notif-ic">${ic('star-linear')}</span><div><b>${esc(v.title)}</b><p class="small muted">${esc(v.note || '')}</p></div>${eS ? `<button type="button" class="link-btn" data-qvadel="${i}">Remove</button>` : ''}</li>`).join('')}</ul>` : '<p class="small faint">None added.</p>'}
          ${eS ? `<div class="hstack" style="margin-top:8px;gap:8px"><input class="input" id="q-va" placeholder="Something you did beyond your goals" maxlength="90" style="flex:1"><button type="button" class="btn btn-secondary btn-sm" data-qvaadd>${ic('add-circle-linear')}Add</button></div>` : ''}</div></div></div>
      <div class="card" data-reveal><div class="card-head"><h2 class="h3">Manager’s comments</h2>${eM ? '<span class="badge b-info no-dot">Editable by you</span>' : ''}</div>
        <div class="card-body stack"><div class="field" id="f-qmgr"><label for="q-mgr-notes">Feedback on the quarter</label><textarea class="textarea" id="q-mgr-notes" data-qnotes="mgr" ${eM ? '' : 'readonly'} placeholder="${eM ? 'Specific feedback, tied to the evidence' : ''}">${mShown ? esc(mgr.notes || '') : ''}</textarea><span class="err">${ic('danger-circle-linear')}Write at least 20 characters.</span></div>
        ${!mShown ? `<p class="small muted">${ic('eye-closed-linear')} Shown once the marks are final.</p>` : ''}</div></div>
    </section>`;
  }
  // earlier versions of the self marks, kept when changes were asked for
  function versionsCard(me, rec) {
    if (!rec.selfVersions.length || !RV.selfShown(me, rec)) return '';
    return `<details class="fy-x section card card-pad" data-reveal><summary>${ic('history-linear')}<b>Earlier versions</b><span class="small muted">${rec.selfVersions.length} · kept as sent when changes were asked for</span>${ic('alt-arrow-down-linear')}</summary>
      <div class="doc-months" style="margin-top:10px">${rec.selfVersions.slice().reverse().map((v) => `<details class="doc-month"><summary><b>Version ${v.version}</b><span class="small muted">${fmt.dateTime(v.at)} · self ${RV.markText(rec, v.selfMark)}</span>${ic('alt-arrow-down-linear')}</summary>
        <div class="doc-month-body"><p class="small" style="margin-top:12px">${esc(v.notes || '')}</p><p class="small muted" style="margin-top:8px">${RV.sheetOf(rec).goals.map((g) => `#${g.n} ${v.scores[g.i] == null ? '–' : v.scores[g.i]}/${g.weight}`).join(' · ')}</p></div></details>`).join('')}</div></details>`;
  }
  function qActions(me, rec) {
    const btns = []; const dirty = drafts.has(recKey(rec, 'self')) || drafts.has(recKey(rec, 'mgr'));
    if (correcting.has(rec.id)) { btns.push('<button class="btn btn-secondary" data-qact="cancel-correct">Cancel</button>'); btns.push(`<button class="btn btn-primary" data-qact="save-correct">${ic('check-circle-linear')}Save correction</button>`); }
    else {
      if (RV.canSelf(me, rec)) { btns.push('<button class="btn btn-secondary" data-qact="save-self">Save draft</button>'); btns.push(`<button class="btn btn-primary" data-qact="submit-self">${rec.status === 'Changes Requested' ? 'Send again' : 'Send'} to ${esc(first(q.person(rec.reviewer)))} ${ic('plain-linear')}</button>`); }
      if (RV.canMgr(me, rec)) { btns.push(`<button class="btn btn-ghost" data-qact="request-changes">${ic('chat-round-line-linear')}Ask for changes</button>`); btns.push('<button class="btn btn-secondary" data-qact="save-mgr">Save draft</button>'); btns.push(`<button class="btn btn-primary" data-qact="lock">${ic('lock-keyhole-minimalistic-linear')}Make final</button>`); }
      if (q.isAdmin(me) && rec.status !== 'Locked' && !q.isFrozen(rec)) btns.push(`<button class="btn btn-secondary" data-qact="reassign">${ic('transfer-horizontal-linear')}Change manager</button>`);
      if (q.isAdmin(me) && rec.status === 'Locked') btns.push(`<button class="btn btn-secondary" data-qact="correct">${ic('pen-2-linear')}Correct marks</button>`);
    }
    if (!btns.length) return '';
    const last = rec.history[rec.history.length - 1];
    return `<div class="action-bar" role="region" aria-label="Marks actions"><div class="status-line" id="q-status">${dirty ? ic('pen-2-linear') + '<span>Unsaved changes</span>' : `${ic('check-circle-bold')}<span>${last ? esc(RM.plainAction(last.action)) + ' · ' + fmt.rel(last.at) : ''}</span>`}</div><div class="btns">${btns.join('')}</div></div>`;
  }
  // a quarter's history entries (stored in the record's own words), in the words the Marks tab uses
  const ACTION_WORDS = { 'Quarter ended · goal sheet opened': 'Quarter ended · marks opened', 'Goal sheet opened': 'Marks opened', 'Self-assessment started': 'Started self marks', 'Self-assessment draft saved': 'Self marks draft saved',
    'Self-mark submitted': 'Self marks sent', 'Self-mark resubmitted': 'Self marks sent again', 'Changes requested': 'Changes asked for', 'Manager mark submitted · goal sheet locked': 'Manager marks sent · final',
    'Manager mark submitted · locked after the lock window': 'Manager marks sent · final, after the due date', 'Reviewer reassigned': 'Manager changed by Admin' };
  RM.plainAction = (t) => ACTION_WORDS[t] || RM.plain(String(t || '').replace(/^Admin correction/, 'Corrected by Admin').replace(/^Used in the cycle \d+ Pre Appraisal Report$/, 'Used in an appraisal summary'));
  RM.plainNote = (t) => RM.plain(String(t || '').replace(/Self-mark /g, 'Self ').replace(/Manager mark /g, 'Manager ').replace(/the earlier submission is kept/g, 'the earlier version is kept').replace(/still counted Incomplete for completion/g, 'still counted as missed').replace(/goal sheet opened/g, 'marks opened').replace(/partial joining quarter/g, 'joined mid-quarter').replace(/months on two forms · /g, '').replace(/ · reviewer /g, ' · manager '));
  // Admin moves an open goal sheet to another reviewer (the reviewer is unavailable); the original stays on record
  RM.reassignDialog = async (rec) => {
    const me = q.me(); const emp = q.person(rec.emp);
    // who can stand in: the employee's own managers first, then anyone else who manages a team; never the employee,
    // anyone who reports to them, or the current reviewer. Nothing is picked until Admin chooses
    const below = new Set(q.descendants(rec.emp).map((d) => d.p.id)); const skip = (p) => !p || p.status !== 'Active' || p.id === rec.emp || p.id === rec.reviewer || below.has(p.id);
    const line = q.chain(rec.emp).filter((p) => !skip(p)); const inLine = new Set(line.map((p) => p.id));
    const others = q.active().filter((p) => !skip(p) && !inLine.has(p.id) && q.hasReportees(p.id)).sort((x, y) => x.name.localeCompare(y.name));
    const opt = (p) => `<option value="${p.id}">${esc(p.name)} · ${esc(p.designation)}</option>`;
    const res = await O.modal({ icon: 'transfer-horizontal-linear', title: 'Change who gives the manager marks', sub: `${RV.quarter(rec.key).short} · ${esc(emp.name)}`, confirm: 'Change',
      body: `<div class="stack">${C.notice('', 'info-circle-linear', 'Use this only when the manager is unavailable. The original manager stays in the record and the audit trail.')}<div class="field" id="f-ra-to"><label for="ra-to">New manager for these marks</label><select class="select" id="ra-to"><option value="" selected disabled>Choose a manager</option>${line.length ? `<optgroup label="${esc(first(emp))}’s managers">${line.map(opt).join('')}</optgroup>` : ''}${others.length ? `<optgroup label="Other managers">${others.map(opt).join('')}</optgroup>` : ''}</select><span class="err">${ic('danger-circle-linear')}Choose who gives the manager marks.</span></div><div class="field" id="f-ra-why"><label for="ra-why">Reason</label><input class="input" id="ra-why" placeholder="e.g. Manager on planned leave"><span class="err">${ic('danger-circle-linear')}Add a reason.</span></div></div>`,
      validate: (m) => {
        const to = m.querySelector('#ra-to').value; const why = m.querySelector('#ra-why').value.trim();
        m.querySelector('#f-ra-to').classList.toggle('has-error', !to); m.querySelector('#f-ra-why').classList.toggle('has-error', why.length < 5);
        return to && why.length >= 5 ? { to, why } : false;
      } });
    if (!res.ok) return false;
    RV.reassign(rec, res.value.to, res.value.why, me.id); store.save();
    O.toast(`Now with ${esc(q.person(res.value.to).name)} · the original manager stays on record`);
    return true;
  };
  // the quarter on the Marks tab: the one asked for, else the one waiting on this viewer, else the latest open, else the latest
  const recsSeen = (me, emp) => RV.recsOf(emp).filter((r) => RV.recAccess(me, r) !== 'none');
  function pickRec(me, emp, key) {
    const recs = recsSeen(me, emp);
    return (key && recs.find((r) => r.key === key)) || recs.find((r) => RV.canSelf(me, r) || RV.canMgr(me, r)) || recs.find((r) => !RV.isLocked(r) && !q.isFrozen(r)) || recs[recs.length - 1] || null;
  }
  function marksTab(me, emp, params) {
    const p = q.person(emp); const rec = pickRec(me, emp, params.q);
    if (!rec) { const nx = RV.runningQuarter(p); const yet = nx.months[0] < String(p.joined).slice(0, 7); const fq = yet ? RV.quarterFor(p, String(p.joined).slice(0, 7)) : nx; return `<div class="card" data-reveal>${C.empty('clipboard-check-linear', 'No marks yet', `Marks open in a quarter’s last month and are due on its last day; quarters follow the joining date. ${esc(fq.fq)} (${esc(fq.span)}) opens on ${fmt.date(RV.marksOpen(fq))}.`)}</div>`; }
    const rev = q.person(rec.reviewer); const qq = RV.quarter(rec.key); const d = RV.due(rec); const orig = rec.originalReviewer ? q.person(rec.originalReviewer) : null;
    // the quarters to switch between: the latest four, and any older one still open
    const recs = recsSeen(me, emp); const list = recs.filter((r, i) => i >= recs.length - 4 || (!RV.isLocked(r) && !q.isFrozen(r)));
    const pick = list.length > 1 ? `<div class="mk-pick"><span class="small muted">Quarter</span>${C.seg(list.map((r) => ({ key: r.key, label: RV.quarter(r.key).short, href: RM.quarterHref(r, me), count: RV.canSelf(me, r) || RV.canMgr(me, r) ? '1' : '' })), rec.key, 'aria-label="Quarter"').replace('class="seg"', 'class="seg seg-sm"')}</div>` : '';
    const activity = `<details class="fy-x section card card-pad" data-reveal><summary>${ic('history-linear')}<b>What happened</b><span class="small muted">${rec.history.length} ${rec.history.length === 1 ? 'step' : 'steps'}</span>${ic('alt-arrow-down-linear')}</summary>
      <ol class="timeline" style="margin-top:14px">${rec.history.slice().reverse().map((h) => `<li><span class="t-dot"></span><div class="t-title">${esc(RM.plainAction(h.action))}</div><div class="t-meta">${h.by === 'system' ? 'System' : esc((q.person(h.by) || {}).name || h.by)} · ${fmt.dateTime(h.at)}</div>${h.note ? `<div class="t-note">${esc(RM.plainNote(h.note))}</div>` : ''}</li>`).join('')}</ol></details>`;
    return `<div data-qpage="${rec.id}">
      ${pick}
      <section class="card card-pad mk-head" data-reveal>
        <div class="gs-head"><div style="min-width:0"><h2 class="h2 gs-title">${esc(qq.fq)} marks <span class="gs-title-sub">${esc(qq.span)}</span></h2>
          <p class="small muted" style="margin-top:6px">Manager ${C.who(rev)}${orig ? ` · covering for ${esc(orig.name)}` : ''} · review year ${esc(RV.year(p, rec.cycle).label)}</p></div>
          <div class="gs-state">${C.status(rec.status, q.isFrozen(rec), RV.incomplete(rec))}<span class="small ${d.over ? 'due-over' : d.soon ? 'due-soon' : 'muted'}">${d.label}</span></div></div>
        <div class="gs-rail">${RM.lifecycle(rec)}</div>
      </section>
      <div class="section" style="margin-top:16px" data-reveal>${qNotice(me, rec)}</div>
      <section class="section"><div class="card" data-reveal><div class="card-head"><h2 class="h3">Goals</h2><span class="spacer small muted">Mark each goal out of its maximum ${C.sample('Sample marks')}</span></div><div id="q-table">${gsTable(me, rec)}</div></div></section>
      <section class="section grid g-2" style="align-items:start">${marksCard(me, rec)}${notesCard(me, rec).replace('<section class="section assess">', '<div class="stack">').replace(/<\/section>\s*$/, '</div>')}</section>
      ${quarterMonths(me, rec)}
      ${versionsCard(me, rec)}
      ${activity}
      ${qActions(me, rec)}
    </div>`;
  }
  function bindQuarter(root, me) {
    const page = root.querySelector('[data-qpage]'); if (!page) return; const rec = RV.rec(page.dataset.qpage); if (!rec || !page.querySelector('#q-table')) return;
    RM.gs.dirty = drafts.size > 0;
    const status = () => { const s = page.querySelector('#q-status'); if (s) s.innerHTML = ic('pen-2-linear') + '<span>Unsaved changes</span>'; };
    const sheet = RV.sheetOf(rec);
    const live = () => {
      ['self', 'mgr'].forEach((k) => {
        const w = recWork(rec, k); const m = RV.markOf(rec, w.scores); const shown = k === 'self' ? RV.selfShown(me, rec) : RV.mgrShown(me, rec); if (!shown) return;
        const el = page.querySelector(`[data-qmark="${k}"]`); if (el) el.innerHTML = (m == null ? '–' : m) + `<small> / ${RV.quarterMax(rec)}</small>`;
        const tt = page.querySelector(`[data-qtotal="${k}"]`); if (tt) tt.textContent = `${RV.total(rec, w.scores)} so far`;
        sheet.categories.forEach((c) => { const ct = page.querySelector(`[data-cattotal="${k}-${c.id}"]`); if (ct) ct.textContent = c.goals.some((g) => w.scores[g.i] != null) ? c.goals.reduce((a, g) => a + (+w.scores[g.i] || 0), 0) : ''; });
      });
    };
    page.addEventListener('click', async (e) => {
      const an = e.target.closest('[data-qaddnote]'); if (an) { const i = +an.dataset.qaddnote; const w = editRec(rec, 'mgr'); w.goalNotes = w.goalNotes || {}; w.goalNotes[i] = ''; const t = document.createElement('div'); t.innerHTML = `<textarea class="textarea gs-comment" rows="1" aria-label="Comment on goal ${sheet.goals[i].n}" data-qnote="${i}"></textarea>`; const ta = t.firstElementChild; an.replaceWith(ta); ta.focus(); status(); return; }
      const va = e.target.closest('[data-qvaadd]'); if (va) { const inp = page.querySelector('#q-va'); const v = inp.value.trim(); if (!v) { inp.focus(); return; } const w = editRec(rec, 'self'); w.valueAdds = (w.valueAdds || []).concat([{ title: v, note: '' }]); RM.app.softRender(); return; }
      const vd = e.target.closest('[data-qvadel]'); if (vd) { const w = editRec(rec, 'self'); w.valueAdds.splice(+vd.dataset.qvadel, 1); RM.app.softRender(); return; }
      const act = e.target.closest('[data-qact]'); if (act) await run(act.dataset.qact, act);
    });
    page.addEventListener('input', (e) => {
      const inp = e.target.closest('input[data-qscore]');
      if (inp) { const max = +inp.dataset.max; const raw = inp.value.trim(); const v = raw === '' ? null : Number(raw); const bad = raw !== '' && (!Number.isInteger(v) || v < 0 || v > max);
        inp.classList.toggle('is-bad', bad); inp.setAttribute('aria-invalid', bad); inp.title = bad ? `Enter a whole number from 0 to ${max}` : '';
        if (!bad) { const i = +inp.dataset.i; const k = inp.dataset.qscore; editRec(rec, k).scores[i] = v; inp.closest('.gs-num').classList.remove('is-missing');
          const cell = page.querySelector(`[data-mcell="${i}"]`); const s = recWork(rec, 'self').scores[i]; const m = recWork(rec, 'mgr').scores[i]; const d = RV.selfShown(me, rec) && RV.mgrShown(me, rec) && s != null && m != null && s !== m ? `${m > s ? '+' : '−'}${Math.abs(m - s)} vs self` : '';
          if (cell) { cell.classList.toggle('is-diff', !!d); cell.querySelector('[data-delta]').textContent = d; }
          live(); status(); }
        return; }
      const nt = e.target.closest('[data-qnotes]'); if (nt) { editRec(rec, nt.dataset.qnotes).notes = nt.value; nt.closest('.field').classList.remove('has-error'); status(); return; }
      const gn = e.target.closest('[data-qnote]'); if (gn) { const w = editRec(rec, 'mgr'); w.goalNotes = Object.assign({}, w.goalNotes, { [gn.dataset.qnote]: gn.value }); status(); }
    });
    const flagMissing = (kind, list) => {
      page.querySelectorAll(`[data-qscore="${kind}"]`).forEach((el) => { if (list.includes(+el.dataset.i)) el.closest('.gs-num').classList.add('is-missing'); });
      const f = page.querySelector('.is-missing input'); if (f) f.focus();
    };
    const listN = (ids) => { const n = ids.map((i) => sheet.goals[i].n); return n.length > 4 ? n.slice(0, 4).join(', ') + ` and ${n.length - 4} more` : n.join(', '); };
    const done = (k) => { drafts.delete(recKey(rec, k)); RM.gs.dirty = drafts.size > 0; store.save(); RM.app.softRender(true); RM.app.refreshNav && RM.app.refreshNav(); };
    async function run(act, btn) {
      const emp = q.person(rec.emp); const rev = q.person(rec.reviewer);
      if (act === 'save-self') { btn.classList.add('is-loading'); await RM.wait(260); RV.saveSelf(rec, recWork(rec, 'self'), me.id); done('self'); O.toast('Draft saved'); return; }
      if (act === 'save-mgr') { btn.classList.add('is-loading'); await RM.wait(260); RV.saveMgr(rec, recWork(rec, 'mgr'), me.id); done('mgr'); O.toast('Saved'); return; }
      if (act === 'submit-self') {
        const w = recWork(rec, 'self'); const gaps = RV.missing(rec, w.scores);
        if (gaps.length) { flagMissing('self', gaps); O.toast(`Mark goal${gaps.length > 1 ? 's' : ''} ${listN(gaps)} before sending.`, { tone: 'warn' }); return; }
        if ((w.notes || '').trim().length < 20) { page.querySelector('#f-qself').classList.add('has-error'); page.querySelector('#q-self-notes').focus(); O.toast('Add your comments before sending.', { tone: 'warn' }); return; }
        const qq = RV.quarter(rec.key); const inc = RV.recMonths(rec).filter((x) => RV.month(rec.emp, x.mk).state === 'incomplete').map((x) => x.mk);
        const m = RV.markOf(rec, w.scores); const again = rec.status === 'Changes Requested';
        const res = await O.modal({ icon: 'plain-linear', title: `Send your ${qq.short} marks${again ? ' again' : ''}?`, body: `<p>Your total of <b>${m} / ${RV.quarterMax(rec)}</b> goes to <b>${esc(rev.name)}</b>.${again ? ` Your earlier version is kept as version ${rec.selfVersions.length}.` : ''}</p>${inc.length ? `<p class="small" style="margin-top:8px;color:var(--warn)">${ic('danger-triangle-linear')} ${inc.map(RV.monthLabel).join(', ')} monthly review${inc.length === 1 ? ' was' : 's were'} missed.</p>` : ''}`, confirm: again ? 'Send again' : 'Send' });
        if (!res.ok) return;
        RV.submitSelf(rec, w, me.id); done('self');
        O.toast(`Sent to ${esc(rev.name)}`, { action: { label: 'Preview as manager', fn: () => RM.app.switchTo(rec.reviewer, RM.quarterHref(rec, q.person(rec.reviewer))) } });
        return;
      }
      if (act === 'request-changes') {
        const res = await O.modal({ icon: 'chat-round-line-linear', title: `Ask ${esc(first(emp))} for changes?`, sub: `${RV.quarter(rec.key).short} · self ${RV.markText(rec, rec.selfMark)}`, confirm: 'Send back',
          body: `<div class="stack"><p>The marks go back to ${esc(first(emp))} to update and send again. This version is kept, and the due date doesn’t move.</p><div class="field" id="f-rc"><label for="rc-why">What needs changing</label><textarea class="textarea" id="rc-why" placeholder="e.g. Add the sprint evidence for goal 5 before I mark it"></textarea><span class="err">${ic('danger-circle-linear')}At least 10 characters.</span></div></div>`,
          validate: (md) => { const v = md.querySelector('#rc-why').value.trim(); if (v.length < 10) { md.querySelector('#f-rc').classList.add('has-error'); return false; } return v; } });
        if (!res.ok) return;
        if (drafts.has(recKey(rec, 'mgr'))) RV.saveMgr(rec, recWork(rec, 'mgr'), me.id);
        RV.requestChanges(rec, res.value, me.id); done('mgr');
        O.toast(`Sent back to ${esc(first(emp))}`, { action: { label: 'Preview as employee', fn: () => RM.app.switchTo(rec.emp, RM.quarterHref(rec, emp)) } });
        return;
      }
      if (act === 'lock') {
        const w = recWork(rec, 'mgr'); const gaps = RV.missing(rec, w.scores);
        if (gaps.length) { flagMissing('mgr', gaps); O.toast(`Mark goal${gaps.length > 1 ? 's' : ''} ${listN(gaps)} first.`, { tone: 'warn' }); return; }
        if ((w.notes || '').trim().length < 20) { page.querySelector('#f-qmgr').classList.add('has-error'); page.querySelector('#q-mgr-notes').focus(); O.toast('Add your feedback first.', { tone: 'warn' }); return; }
        const m = RV.markOf(rec, w.scores); const late = RM.TODAY > RV.lockBy(RV.quarter(rec.key));
        const waits = RV.appraisalsOf(rec.emp).filter((a) => a.status === 'Not generated' && (a.blocking || []).includes(rec.key));
        const res = await O.modal({ icon: 'lock-keyhole-minimalistic-linear', title: 'Make these marks final?', body: `<p>Your total <b>${m} / ${RV.quarterMax(rec)}</b> sits next to ${esc(first(emp))}’s <b>${RV.markText(rec, rec.selfMark)}</b> and never replaces it. Once final, it counts toward ${esc(first(emp))}’s review year and goes into that year’s appraisal summary (${fmt.date(RV.year(emp, rec.cycle).date)}). Only Admin can correct it after that.</p>${late ? `<p class="small" style="margin-top:8px;color:var(--warn)">${ic('danger-triangle-linear')} The due date has passed, so it still counts as missed.</p>` : ''}${waits.length ? `<p class="small" style="margin-top:8px">${ic('file-check-linear')} ${esc(first(emp))}’s appraisal summary is waiting on these marks and is created once they’re final.</p>` : ''}`, confirm: 'Make final' });
        if (!res.ok) return;
        const before = RV.appraisalsOf(rec.emp).filter((a) => a.status === 'Generated').length;
        RV.lockWithMgr(rec, w, me.id); done('mgr');
        const made = RV.appraisalsOf(rec.emp).filter((a) => a.status === 'Generated').length > before;
        O.toast(`${RV.quarter(rec.key).short} marks are final for ${esc(first(emp))}${made ? ' · appraisal summary created' : ''}`, { icon: 'lock-keyhole-minimalistic-bold', action: made ? { label: 'Open the summary', fn: () => { const a = RV.appraisalsOf(rec.emp).filter((x) => x.status === 'Generated').pop(); location.hash = RM.appraisalHref(a); } } : { label: 'Preview as employee', fn: () => RM.app.switchTo(rec.emp, RM.quarterHref(rec, emp)) } });
        return;
      }
      if (act === 'reassign') { if (await RM.reassignDialog(rec)) RM.app.softRender(true); return; }
      if (act === 'correct') {
        const res = await O.modal({ icon: 'pen-2-linear', tone: 'warn', title: 'Correct final marks?', sub: 'Admin only', confirm: 'Start correction', body: '<p>Final marks change only through a correction like this. It’s recorded in the audit trail with your reason, and any appraisal summary that used this quarter gets a new version; the earlier one stays readable.</p>' });
        if (!res.ok) return; correcting.add(rec.id); drafts.set(recKey(rec, 'self'), clone(rec.self)); drafts.set(recKey(rec, 'mgr'), clone(rec.mgr)); RM.gs.dirty = true; RM.app.softRender(); return;
      }
      if (act === 'cancel-correct') { correcting.delete(rec.id); drafts.delete(recKey(rec, 'self')); drafts.delete(recKey(rec, 'mgr')); RM.gs.dirty = drafts.size > 0; RM.app.softRender(); return; }
      if (act === 'save-correct') {
        const s = recWork(rec, 'self').scores; const m = recWork(rec, 'mgr').scores;
        if (RV.missing(rec, s).length || RV.missing(rec, m).length) { O.toast('Every goal needs both marks.', { tone: 'warn' }); return; }
        const res = await O.modal({ icon: 'pen-2-linear', tone: 'warn', title: 'Save the correction?', confirm: 'Save correction', body: `<div class="field" id="f-cor"><label for="cor-why">Reason for the correction</label><textarea class="textarea" id="cor-why" placeholder="What was wrong, and who asked for the change"></textarea><span class="err">${ic('danger-circle-linear')}At least 10 characters.</span></div>`,
          validate: (md) => { const v = md.querySelector('#cor-why').value.trim(); if (v.length < 10) { md.querySelector('#f-cor').classList.add('has-error'); return false; } return v; } });
        if (!res.ok) return; RV.correct(rec, s, m, res.value, me.id); correcting.delete(rec.id); drafts.delete(recKey(rec, 'self')); drafts.delete(recKey(rec, 'mgr')); RM.gs.dirty = drafts.size > 0; store.save(); RM.app.softRender(true);
        O.toast(`Corrected · version ${rec.version}. Appraisal summaries that used it have new versions.`, { icon: 'check-circle-bold' });
      }
    }
    page.querySelectorAll('.gs-rail .lc-fill[data-lc-fill="1"]').forEach((f) => { f.style.width = '100%'; });
  }

  /* ---------- History: each year's quarters, monthly reviews and evidence, and the appraisal summaries ---------- */
  // each quarter's comments, for the appraisal summary
  const assessDetails = (me, emp, quarters) => quarters.map((s) => { const qq = RV.quarter(s.key); const r = RV.recFor(emp, s.key);
    return `<details class="doc-month"><summary><b>${esc(qq.short)}</b><span class="small muted">Self ${s.selfMark == null ? '–' : s.selfMark + ' / ' + s.max} · manager ${s.mgrMark == null ? '–' : s.mgrMark + ' / ' + s.max}${s.lockedAt ? ' · final ' + fmt.date(s.lockedAt) : ''}</span>${ic('alt-arrow-down-linear')}</summary>
      <div class="doc-month-body"><dl class="kv" style="grid-template-columns:150px 1fr;margin-top:12px"><dt>Employee’s comments</dt><dd style="font-weight:450">${s.selfNotes ? esc(s.selfNotes) : '<span class="faint">–</span>'}</dd><dt>Manager’s comments</dt><dd style="font-weight:450">${s.mgrNotes ? esc(s.mgrNotes) : '<span class="faint">–</span>'}</dd><dt>Manager</dt><dd style="font-weight:450">${C.who(q.person(s.reviewer))}${s.version > 1 ? ` · corrected (version ${s.version})` : ''}</dd></dl>
      ${r ? `<a class="link-btn small" style="margin-top:10px" href="${RM.quarterHref(r)}">Open the marks ${ic('arrow-right-linear')}</a>` : ''}</div></details>`; }).join('');
  RM.assessDetails = assessDetails;
  // the review years someone has marks or a monthly review in, newest first (year n runs from the joining month + 12(n − 1))
  const yearList = (emp) => { const p = q.person(emp); if (!p) return []; const set = new Set(RV.recsOf(emp).map((r) => r.cycle)); RV.formsOf(emp).forEach((f) => RV.monthsSoFar(f).forEach((mk) => set.add(RV.yearOf(p, mk).n))); return [...set].sort((a, b) => b - a); };
  // hl: a month to open the year's monthly reviews on (a link to an earlier month)
  function yearBlock(me, emp, n, hl) {
    const p = q.person(emp); const yr = RV.year(p, n); const recs = RV.recsOf(emp).filter((r) => r.cycle === n); const cur = yr.start <= RV.curMonth() && yr.end >= RV.curMonth(); const ytd = RV.ytd(emp, n); const content = ['full', 'own'].includes(RV.access(me, emp));
    const qs = yr.quarters; const val = (r, k) => (r && RV.isLocked(r) && (k === 'self' ? RV.selfShown(me, r) : RV.mgrShown(me, r)) ? RV.pct(r, r[k === 'self' ? 'selfMark' : 'mgrMark']) : null);
    const series = [{ name: 'Manager', color: 'var(--viz-1)', values: qs.map((qq) => val(recs.find((r) => r.key === qq.key), 'mgr')) }, { name: 'Self', color: 'var(--viz-2)', values: qs.map((qq) => val(recs.find((r) => r.key === qq.key), 'self')) }];
    const chart = series.some((x) => x.values.filter((v) => v != null).length) ? RM.charts.lines(series, qs.map((x) => x.short), { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], yFmt: (v) => v + '%', tipFmt: 'pct', w: 640, h: 200, padL: 44, padR: 76, label: `Quarter marks for ${yr.label}, as % of the maximum` }) : `<p class="small muted" style="padding:24px 0">The chart starts once a quarter’s marks are final.</p>`;
    const months = yr.months.filter((mk) => mk <= RV.curMonth() && RV.formFor(emp, mk)); const open = hl && months.includes(hl);
    const ev = content && months.length ? RM.evidenceRecord(me, emp, months) : null;
    // its appraisal: the anniversary after the year ends
    const a = RV.appraisalFor(emp, n); const canOpen = a && RV.canOpenReport(me, emp); const past = day0(yr.date) <= day0(RM.TODAY);
    const appr = a && RV.canSeeAppraisals(me, emp) ? `${canOpen ? `<a href="${RM.appraisalHref(a)}">${C.appr(RV.reportLabel(a))}</a>` : C.appr(RV.reportLabel(a))}` : '';
    return `<article class="card fy-block" data-reveal>
      <div class="card-head"><div><h2 class="h3">${esc(yr.label)} ${cur ? '<span class="badge b-info no-dot">This year</span>' : ''}</h2><p class="small muted" style="margin-top:3px">Review year from the ${fmt.date(p.joined, { noYear: true })} joining date · appraisal ${past ? 'on' : 'due'} ${fmt.date(yr.date)}</p></div>${appr ? `<span class="spacer">${appr}</span>` : ''}</div>
      <div class="fy-body">
        <div class="fy-agg"><div class="kpi-label">${cur ? 'This year so far' : 'Year average'}</div>
          <div class="score-pair"><div><div class="small muted">Self</div><div class="v num">${pct(ytd.self)}</div></div><div><div class="small muted">Manager</div><div class="v num">${pct(ytd.mgr)}</div></div></div>
          <p class="tiny muted">${ytd.n} final ${ytd.n === 1 ? 'quarter' : 'quarters'}, each as % of its maximum${cur ? '; open and future quarters aren’t counted' : ''}</p></div>
        <div class="fy-chart">${chart}</div>
      </div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Quarter</th><th>Status</th><th class="r">Self</th><th class="r">Manager</th><th>Final on</th><th><span class="sr-only">Open</span></th></tr></thead>
        <tbody>${qs.map((qq) => { const r = recs.find((x) => x.key === qq.key); if (!r) return `<tr class="is-muted"><td><b>${qq.fq}</b> <span class="small muted">${esc(qq.span)}</span></td><td colspan="5" class="small faint">${RV.qState(qq) === 'upcoming' ? 'Upcoming' : RV.qState(qq) === 'running' ? 'In progress · marks open ' + day(RV.marksOpen(qq)) : qq.months[0] < RV.GO_LIVE ? 'Before reviews started' : 'Not taking part'}</td></tr>`;
          return `<tr class="is-clickable" data-href="${RM.quarterHref(r)}"><td><b>${qq.fq}</b> <span class="small muted">${esc(qq.span)}</span></td><td class="nowrap">${C.status(r.status, q.isFrozen(r), RV.incomplete(r))} ${C.dueBadge(r)}</td><td class="r num">${RV.selfShown(me, r) ? markHtml(r, r.selfMark) : '–'}</td><td class="r num strong">${RV.mgrShown(me, r) ? markHtml(r, r.mgrMark) : '–'}</td><td class="small num nowrap">${r.lockedAt ? fmt.date(r.lockedAt) + (RV.lateLocked(r) ? ' <span class="badge b-warn no-dot" style="height:20px;font-size:11px">Late</span>' : '') : '<span class="faint">–</span>'}</td><td class="r"><a class="link-btn" href="${RM.quarterHref(r)}" aria-label="Open ${esc(qq.short)} marks">${ic('alt-arrow-right-linear')}</a></td></tr>`; }).join('')}</tbody></table></div>
      ${months.length ? `<div class="fy-more">
          <details class="fy-x"${open ? ' open' : ''}><summary>${ic('clipboard-list-linear')}<b>Monthly reviews</b><span class="small muted">${months.filter((mk) => RV.month(emp, mk).complete).length} of ${months.length} done · ${esc(RV.monthLabel(months[0]))} – ${esc(RV.monthLabel(months[months.length - 1]))}</span>${ic('alt-arrow-down-linear')}</summary><div class="doc-ev">${RM.checkinTable(me, emp, months, hl)}</div></details>
          ${ev && ev.rows ? `<details class="fy-x"><summary>${ic('folder-with-files-linear')}<b>Evidence</b><span class="small muted">${ev.rows} ${ev.rows === 1 ? 'row' : 'rows'} under ${ev.goals} ${ev.goals === 1 ? 'goal' : 'goals'}, each with the month it was added</span>${ic('alt-arrow-down-linear')}</summary><div class="doc-ev">${ev.html}</div></details>` : ''}
        </div>` : ''}
    </article>`;
  }
  const chips = (list) => list.map((r) => { const k = typeof r === 'string' ? r : r.key; const qq = RV.quarter(k); const st = typeof r === 'string' ? 'Locked' : r.status; return `<span class="chip q-chip${st === 'Locked' ? ' is-locked' : ''}" data-tip="<b>${esc(qq.label)}</b> · ${esc(st === 'Upcoming' ? 'not ended yet' : RM.statusLabel(st) || st)}">${st === 'Locked' ? ic('lock-keyhole-minimalistic-bold') : ic('hourglass-linear')}${esc(qq.short)}</span>`; }).join('');
  RM.qChips = chips;
  // the next appraisal and the summaries so far (the person's managers, the Practice Head and Admin)
  function appraisalsBlock(me, emp) {
    const p = q.person(emp); const list = RV.appraisalsOf(emp).slice().reverse(); const pv = RV.inCycles(p) ? RV.preview(p) : null; const canOpen = RV.canOpenReport(me, emp);
    const versions = (a) => (a.versions.length > 1 ? `<span class="small muted"> · ${a.versions.slice(0, -1).map((v) => `<a href="${RM.appraisalHref(a, v.version)}">v${v.version}</a>`).join(', ')}</span>` : '');
    const after = pv ? pv.after : [];
    return `<div class="grid g-2" style="align-items:start;gap:16px">
      ${pv ? `<div class="card card-pad appr-next" data-reveal><div class="hstack" style="justify-content:space-between;align-items:flex-start;gap:12px"><div><div class="eyebrow">Next appraisal</div><div class="h2" style="margin-top:6px">${fmt.date(pv.date)}</div><p class="small muted" style="margin-top:4px">In ${RM.dayDiff(RM.TODAY, pv.date)} days · joined ${fmt.date(p.joined)} · ${pv.ready} of ${pv.window.length} quarters final</p></div>${C.appr(RV.PREVIEW_LABEL[pv.kind])}</div>
        <div style="margin-top:14px"><div class="small strong" style="margin-bottom:8px">The year’s quarters · ${esc(pv.year.label)}</div><div class="hstack" style="gap:6px">${chips(pv.window) || '<span class="small faint">None yet</span>'}</div>
        ${pv.blocking.length ? `<p class="small due-over" style="margin-top:8px">${ic('danger-triangle-linear')} ${pv.blocking.map((r) => `<a href="${RM.quarterHref(RV.recFor(emp, r.key))}">${esc(RV.quarter(r.key).short)}</a>`).join(', ')} wasn’t made final on time. The summary waits until it is; it’s never skipped.</p>` : ''}
        ${after.length ? `<p class="small muted" style="margin-top:8px">${after.map((r) => esc(RV.quarter(r.key).short)).join(', ')} marks are due by ${day(after[after.length - 1].lockBy)}, after the appraisal date. The summary is created on the day if they’re final by then, otherwise as soon as they are.</p>` : ''}
        ${pv.kind === 'partial' ? `<p class="small muted" style="margin-top:6px">${ic('info-circle-linear')} Reviews here started part-way through this year, so it has three quarters; the summary is still created.</p>` : pv.kind === 'short' ? `<p class="small muted" style="margin-top:6px">${ic('info-circle-linear')} With fewer than three quarters, no summary is created.</p>` : ''}
        <p class="small muted" style="margin-top:8px">${ic('history-linear')} This year’s monthly reviews and evidence close with the year on ${fmt.date(RV.monthEnd(pv.year.end), { noYear: true })} and are filed with the summary; the next year starts on 1 ${esc(RV.monthLabel(RV.addMonths(pv.year.end, 1)))}.</p></div></div>` : ''}
      <div class="card" data-reveal><div class="card-head"><h2 class="h3">Appraisal summaries</h2><span class="spacer small muted">One a year, on the joining anniversary</span></div>
        ${list.length ? `<div class="list">${list.map((a) => { const gen = a.status === 'Generated'; return `<div class="list-item${gen && canOpen ? ' is-clickable' : ''}"${gen && canOpen ? ` data-href="${RM.appraisalHref(a)}"` : ''}><span style="min-width:0;flex:1"><span class="strong num" style="display:block">${fmt.date(a.date)}</span><span class="person-sub">${gen ? `${a.quarterKeys.length} quarters · self ${pct(a.snapshot.selfAgg)} · manager ${pct(a.snapshot.mgrAgg)}` : a.reason === 'blocked' ? `Waiting on ${a.blocking.map((k) => esc(RV.quarter(k).short)).join(', ')}` : 'Fewer than three quarters'}</span></span>
          <span class="meta">${C.appr(RV.reportLabel(a))}${canOpen ? `<a class="link-btn small" href="${RM.appraisalHref(a)}">${gen ? 'Open' : 'Details'} ${ic('arrow-right-linear')}</a>${gen ? versions(a) : ''}` : ''}</span></div>`; }).join('')}</div>`
        : `<div class="card-body">${C.empty('cup-star-linear', 'No appraisal yet', pv ? `The first summary is due on ${fmt.date(pv.date)}.` : 'Not in appraisals.')}</div>`}
        ${String(p.joined).slice(0, 7) < RV.GO_LIVE ? `<div class="card-foot small muted">${ic('info-circle-linear')} Earlier appraisals happened before reviews moved here (${esc(RV.monthLabel(RV.GO_LIVE))}).</div>` : ''}</div>
    </div>`;
  }
  // opt.profile: the employee profile's Reviews tab, the same record laid out as a report (profileReviews)
  function historyTab(me, emp, params, opt) {
    if (opt && opt.profile) return profileReviews(me, emp);
    const years = yearList(emp); const hl = /^\d{4}-\d{2}$/.test(params.m || '') ? params.m : null;
    return `<div class="stack">
      ${RV.canSeeAppraisals(me, emp) ? appraisalsBlock(me, emp) : ''}
      ${years.map((n) => yearBlock(me, emp, n, hl)).join('') || `<div class="card">${C.empty('clipboard-list-linear', 'Nothing yet', 'Monthly reviews and marks show here once there are some.')}</div>`}
      ${q.isAdmin(me) ? formChanges(emp) : ''}
    </div>`;
  }
  RM.historyTab = historyTab;

  /* ---------- the employee profile's Reviews tab (Admin and the Practice Head) ----------
     The same record as History, laid out as a report: the appraisal first (when it's due and how many quarters are done, and
     the summaries so far with their status), then each review year: its averages and its quarters as a double bar chart (self
     beside manager), all out of 100, and the quarters table, with the year's monthly reviews and evidence underneath. The
     Review page's History tab keeps its own layout. */
  // the Go to month list for one year: [value, label] pairs, newest first
  const monthOpts = (list) => `<option value="">Month</option>${(list || []).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}`;
  // an appraisal's status on this tab: a summary made from three quarters reads plain Ready (no quarter count)
  const apprTag = (a) => { const l = RV.reportLabel(a); return l === 'Ready · 3 quarters' ? 'Ready' : l; };
  // marks out of 100 (every quarter is out of 100 while no goal is yearly)
  const of100 = (v) => (v == null ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(1));
  function profileAppraisal(me, emp) {
    const p = q.person(emp); const list = RV.appraisalsOf(emp).slice().reverse(); const pv = RV.inCycles(p) ? RV.preview(p) : null; const canOpen = RV.canOpenReport(me, emp);
    const versions = (a) => (a.versions.length > 1 ? `<span class="small muted"> · ${a.versions.slice(0, -1).map((v) => `<a href="${RM.appraisalHref(a, v.version)}">v${v.version}</a>`).join(', ')}</span>` : '');
    // every past appraisal's rating out of 5, newest first (the salary history's, as on Salary & appraisals): the latest two,
    // and the rest behind "+N more"
    const past = RM.salaryHistory(p).filter((e) => e.kind === 'appraisal' && e.rating && e.date <= RM.TODAY).reverse();
    const chip = (e, more) => `<span class="pr-rt${more ? ' is-more' : ''}" data-tip="Annual appraisal · ${esc(fmt.date(e.date))}"${more ? ' hidden' : ''}><span class="pr-rt-y">${e.date.getFullYear()}</span><b class="num">${e.rating.toFixed(1)}</b><small>/ 5</small></span>`;
    const extra = past.length - 2;
    const ratings = past.length ? `<div class="pr-ratings" aria-label="Previous appraisal ratings"><span class="pr-ratings-l">Previous ratings</span><span class="pr-ratings-list">${past.map((e, i) => chip(e, i >= 2)).join('')}</span>${extra > 0 ? `<button type="button" class="link-btn small pr-rt-toggle" data-prrt="${extra}" aria-expanded="false">+${extra} more</button>` : ''}</div>` : '';
    const next = pv ? `<div class="pr-next">
        <div class="pr-next-head"><span class="eyebrow">Next appraisal</span>${C.appr(RV.PREVIEW_LABEL[pv.kind])}</div>
        <div class="pr-next-row"><div class="pr-next-date num">${fmt.date(pv.date)}</div>${ratings}</div>
        <dl class="pr-facts"><div><dt>Due in</dt><dd class="num">${RM.dayDiff(RM.TODAY, pv.date)} days</dd></div><div><dt>Joined</dt><dd class="num">${fmt.date(p.joined)}</dd></div><div><dt>Quarters done</dt><dd class="num">${pv.ready} of ${pv.window.length}</dd></div></dl>
        ${pv.blocking.length ? `<p class="small due-over pr-note">${ic('danger-triangle-linear')}<span>${pv.blocking.map((r) => `<a href="${RM.quarterHref(RV.recFor(emp, r.key))}">${esc(RV.quarter(r.key).short)}</a>`).join(', ')} wasn’t made final on time. The summary waits until it is; it’s never skipped.</span></p>` : ''}
      </div>` : '';
    const sums = `<div class="pr-sums">
        <div class="pr-sums-head"><h2 class="h3">Appraisal summaries</h2></div>
        ${list.length ? `<div class="table-wrap"><table class="table pr-sums-table"><thead><tr><th>Appraisal</th><th>Status</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>${list.map((a) => { const gen = a.status === 'Generated'; const go = gen && canOpen;
          return `<tr${go ? ` class="is-clickable" data-href="${RM.appraisalHref(a)}"` : ''}><td class="num nowrap strong">${fmt.date(a.date)}</td>
            <td class="nowrap">${C.appr(apprTag(a))}</td>
            <td class="r nowrap">${canOpen ? `<a class="link-btn small" href="${RM.appraisalHref(a)}">${gen ? 'Open' : 'Details'} ${ic('arrow-right-linear')}</a>${gen ? versions(a) : ''}` : ''}</td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="pr-empty">${C.empty('cup-star-linear', 'No appraisal yet', pv ? `The first summary is due on ${fmt.date(pv.date)}.` : 'Not in appraisals.')}</div>`}
      </div>`;
    return `<section class="card pr-appr${next ? '' : ' is-single'}" aria-label="Appraisal">${next}${sums}</section>`;
  }
  // open: shown expanded (this year); a closed year's header keeps its averages in view
  function profileYear(me, emp, n, open) {
    const p = q.person(emp); const yr = RV.year(p, n); const recs = RV.recsOf(emp).filter((r) => r.cycle === n); const cur = yr.start <= RV.curMonth() && yr.end >= RV.curMonth(); const ytd = RV.ytd(emp, n); const content = ['full', 'own'].includes(RV.access(me, emp));
    const qs = yr.quarters; const val = (r, k) => (r && RV.isLocked(r) && (k === 'self' ? RV.selfShown(me, r) : RV.mgrShown(me, r)) ? RV.pct(r, r[k === 'self' ? 'selfMark' : 'mgrMark']) : null);
    // the quarters as a double bar chart: self beside manager, out of 100 (each quarter's marks over its maximum, which is 100
    // with no yearly goal); a quarter shows once it's final
    // a quarter with nothing final yet keeps its slot, saying what it's waiting on
    const waits = (qq, r) => (r ? (RV.isLocked(r) ? 'Not shown' : RM.statusLabel(r.status) || 'Open') : RV.qState(qq) === 'upcoming' ? 'Upcoming' : RV.qState(qq) === 'running' ? 'In progress' : qq.months[0] < RV.GO_LIVE ? 'Before reviews' : 'Not taking part');
    const bars = qs.map((qq) => { const r = recs.find((x) => x.key === qq.key); const sv = val(r, 'self'), mv = val(r, 'mgr');
      const row = (sw, l, v) => `<div class='tip-row'><span><i class='sw' style='background:${sw}'></i>${l}</span><b>${v == null ? 'not final' : of100(v) + ' / 100'}</b></div>`;
      return { label: qq.short, self: sv, mgr: mv, empty: sv == null && mv == null ? waits(qq, r) : '', tip: `<b>${esc(qq.label)}</b>${row('var(--pr-self)', 'Self', sv)}${row('var(--viz-1)', 'Manager', mv)}` }; });
    const chart = bars.some((b) => b.self != null || b.mgr != null)
      ? RM.charts.columns(bars, { series: [{ key: 'self', color: 'var(--pr-self)' }, { key: 'mgr', color: 'var(--viz-1)' }], max: 100, barMax: 30, labels: (v) => of100(v), yFmt: (v) => String(v), w: 900, h: 250, label: `Quarter marks for ${yr.label}, self and manager, out of 100` })
      : '<p class="small muted pr-chart-empty">The chart starts once a quarter’s marks are final.</p>';
    const stat = (k, label, color) => { const v = ytd[k];
      return `<div class="pr-stat"><span class="pr-stat-l"><i class="sw" style="background:${color}" aria-hidden="true"></i>${label}</span><span class="pr-stat-n"><b class="pr-stat-v num"${v == null ? '' : ` data-v="${v}"`}>${of100(v)}</b>${v == null ? '' : '<small>/ 100</small>'}</span><span class="pr-meter" aria-hidden="true"><i style="width:${v == null ? 0 : Math.min(100, v)}%;background:${color}" data-meter></i></span></div>`; };
    const months = yr.months.filter((mk) => mk <= RV.curMonth() && RV.formFor(emp, mk));
    const ev = content && months.length ? RM.evidenceRecord(me, emp, months) : null;
    const a = RV.appraisalFor(emp, n); const canOpen = a && RV.canOpenReport(me, emp);
    const appr = a && RV.canSeeAppraisals(me, emp) ? `${canOpen ? `<a href="${RM.appraisalHref(a)}">${C.appr(apprTag(a))}</a>` : C.appr(apprTag(a))}` : '';
    const peek = ytd.self == null && ytd.mgr == null ? 'No final quarters yet' : `Self ${of100(ytd.self)} · Manager ${of100(ytd.mgr)} <span class="faint">/ 100</span>`;
    return `<article class="card pr-year${cur ? ' is-current' : ''}${open ? '' : ' is-collapsed'}" data-year="${n}">
      <header class="pr-year-head"><button type="button" class="pr-year-toggle" data-pryear="${n}" aria-expanded="${open}" aria-controls="pr-y-${n}"><span class="pr-year-chev" aria-hidden="true">${ic('alt-arrow-down-linear')}</span><h2 class="h3">${esc(yr.label)} ${cur ? '<span class="badge b-info no-dot">This year</span>' : ''}</h2></button><span class="pr-year-peek small muted">${peek}</span>${appr ? `<span class="pr-year-appr">${appr}</span>` : ''}</header>
      <div class="pr-year-content" id="pr-y-${n}"${open ? '' : ' hidden'}>
      <div class="pr-year-body">
        <div class="pr-avg"><div class="kpi-label">${cur ? 'This year so far' : 'Year average'}</div>
          <div class="pr-stats">${stat('self', 'Self', 'var(--pr-self)')}${stat('mgr', 'Manager', 'var(--viz-1)')}</div>
</div>
        <div class="pr-chart"><div class="pr-chart-head"><span class="kpi-label">Quarter marks</span><div class="legend"><span><i class="sw" style="background:var(--pr-self)"></i>Self</span><span><i class="sw" style="background:var(--viz-1)"></i>Manager</span></div></div>${chart}</div>
      </div>
      <div class="table-wrap pr-qtable"><table class="table"><thead><tr><th>Quarter</th><th>Status</th><th class="r">Self</th><th class="r">Manager</th><th>Final on</th><th><span class="sr-only">Open</span></th></tr></thead>
        <tbody>${qs.map((qq) => { const r = recs.find((x) => x.key === qq.key); if (!r) return `<tr class="is-muted"><td><b>${qq.fq}</b> <span class="small muted">${esc(qq.span)}</span></td><td colspan="5" class="small faint">${RV.qState(qq) === 'upcoming' ? 'Upcoming' : RV.qState(qq) === 'running' ? 'In progress · marks open ' + day(RV.marksOpen(qq)) : qq.months[0] < RV.GO_LIVE ? 'Before reviews started' : 'Not taking part'}</td></tr>`;
          return `<tr class="is-clickable" data-href="${RM.quarterHref(r)}"><td><b>${qq.fq}</b> <span class="small muted">${esc(qq.span)}</span></td><td class="nowrap">${C.status(r.status, q.isFrozen(r), RV.incomplete(r))} ${C.dueBadge(r)}</td><td class="r num">${RV.selfShown(me, r) ? markHtml(r, r.selfMark) : '–'}</td><td class="r num strong">${RV.mgrShown(me, r) ? markHtml(r, r.mgrMark) : '–'}</td><td class="small num nowrap">${r.lockedAt ? fmt.date(r.lockedAt) + (RV.lateLocked(r) ? ' <span class="badge b-warn no-dot" style="height:20px;font-size:11px">Late</span>' : '') : '<span class="faint">–</span>'}</td><td class="r"><a class="link-btn" href="${RM.quarterHref(r)}" aria-label="Open ${esc(qq.short)} marks">${ic('alt-arrow-right-linear')}</a></td></tr>`; }).join('')}</tbody></table></div>
      ${months.length ? `<div class="pr-more">
          <details class="pr-x" data-pr-months><summary>${ic('clipboard-list-linear')}<b>Monthly reviews</b><span class="small muted">${months.filter((mk) => RV.month(emp, mk).complete).length} of ${months.length} done · ${esc(RV.monthLabel(months[0]))} – ${esc(RV.monthLabel(months[months.length - 1]))}</span>${ic('alt-arrow-down-linear')}</summary><div class="doc-ev">${RM.checkinTable(me, emp, months, null)}</div></details>
          ${ev && ev.rows ? `<details class="pr-x" data-pr-ev><summary>${ic('folder-with-files-linear')}<b>Evidence</b><span class="small muted">${ev.rows} ${ev.rows === 1 ? 'row' : 'rows'} under ${ev.goals} ${ev.goals === 1 ? 'goal' : 'goals'}, each with the month it was added</span>${ic('alt-arrow-down-linear')}</summary><div class="doc-ev">${ev.html}</div></details>` : ''}
        </div>` : ''}
      </div>
    </article>`;
  }
  // the tab opening (a tab click, or a direct link): the appraisal card rises first, its date and figures following, its quarter
  // track filling step by step and the summaries' rows sliding in; then each review year in view rises in turn, its averages
  // counting up as its meters fill and its bars rise. Ease-out throughout, about 0.8s in all; the next tab click kills it
  // (the timeline is returned for that), and reduced motion shows everything at once. opt.charts: false when the page's own
  // entrance already runs the bars and meters (a direct link)
  function reviewsIn(root, opt) {
    const pr = root.querySelector('.pr-reviews'); if (!pr) return null;
    if (!opt || opt.charts !== false) RM.motion.charts(pr);
    if (RM.reduced() || !window.gsap) return null;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } }); const vh = window.innerHeight;
    const appr = pr.querySelector('.pr-appr');
    if (appr) {
      // the card and its content arrive together, so no pane ever sits empty; the track fills just behind them
      tl.from(appr, { opacity: 0, y: 12, duration: .3, clearProps: 'transform,opacity' }, 0);
      tl.from(appr.querySelectorAll('.pr-next-head, .pr-next-date, .pr-rt, .pr-facts > div'), { opacity: 0, y: 6, duration: .24, stagger: .03, clearProps: 'transform,opacity' }, .04);
      tl.from(appr.querySelectorAll('.pr-sums-head, .pr-sums-table thead, .pr-sums-table tbody tr'), { opacity: 0, y: 6, duration: .24, stagger: .04, clearProps: 'transform,opacity' }, .04);
    }
    // the years heading and the first card in view rise together, the rest 60ms apart; those below the fold stay at rest
    const years = RM.$$('.pr-year', pr).filter((y) => y.getBoundingClientRect().top < vh); const yh = pr.querySelector('.pr-years-h');
    if (yh) tl.from(yh, { opacity: 0, y: 10, duration: .3, clearProps: 'transform,opacity' }, .1);
    if (years.length) tl.from(years, { opacity: 0, y: 12, duration: .32, stagger: .06, clearProps: 'transform,opacity' }, .12);
    // averages count up to their value from 60% of it (not from zero), as their meters fill
    years.forEach((y, i) => RM.$$('.pr-stat-v[data-v]', y).forEach((el) => {
      const v = +el.dataset.v; const o = { v: v * 0.6 }; el.textContent = of100(Math.round(o.v * 10) / 10);
      tl.to(o, { v, duration: .55, ease: 'power2.out', onUpdate: () => { el.textContent = of100(Math.round(o.v * 10) / 10); }, onComplete: () => { el.textContent = of100(v); } }, .2 + i * .06);
    }));
    RM.motion.settle([tl]);
    return tl;
  }
  RM.reviewsIn = reviewsIn;
  // a year card opens or closes in place (its bars draw in as it opens); returns the card
  function setYear(card, open) {
    const btn = card.querySelector('[data-pryear]'); const body = card.querySelector('.pr-year-content'); if (!btn || !body) return card;
    if (btn.getAttribute('aria-expanded') === String(open)) return card;
    btn.setAttribute('aria-expanded', open); card.classList.toggle('is-collapsed', !open); body.hidden = !open;
    if (open) { RM.motion.charts(body); if (window.gsap && !RM.reduced()) gsap.from(body, { height: 0, opacity: 0, duration: 0.28, ease: 'power2.out', clearProps: 'height,opacity' }); }
    return card;
  }
  const syncAll = (pr) => { const b = pr.querySelector('[data-pryear-all]'); if (b) b.textContent = RM.$$('.pr-year', pr).every((c) => !c.classList.contains('is-collapsed')) ? 'Collapse all' : 'Expand all'; };
  // the profile's page handler passes its clicks and changes here first (the tab panel is re-drawn, the page isn't)
  RM.reviewsClick = (e) => {
    // previous ratings: the latest two, the rest on click
    const rt = e.target.closest('[data-prrt]');
    if (rt) { const open = rt.getAttribute('aria-expanded') !== 'true'; RM.$$('.pr-rt.is-more', rt.closest('.pr-ratings')).forEach((x) => { x.hidden = !open; }); rt.setAttribute('aria-expanded', open); rt.textContent = open ? 'Show less' : `+${rt.dataset.prrt} more`; return true; }
    const t = e.target.closest('[data-pryear]');
    if (t) { const card = t.closest('.pr-year'); setYear(card, t.getAttribute('aria-expanded') !== 'true'); syncAll(card.closest('.pr-reviews')); return true; }
    const a = e.target.closest('[data-pryear-all]');
    if (a) { const pr = a.closest('.pr-reviews'); const open = a.textContent.trim() === 'Expand all'; RM.$$('.pr-year', pr).forEach((c) => setYear(c, open)); syncAll(pr); return true; }
    return false;
  };
  // a select drawn as an .xsel dropdown shows its new choice when it's set from code
  const xselShow = (sel) => { const v = sel.parentElement.querySelector('.xsel-val'); if (v && sel.options[sel.selectedIndex]) v.textContent = sel.options[sel.selectedIndex].textContent; };
  RM.reviewsChange = (e) => {
    // a new year: its months, keeping the chosen month when the year has it (and going there)
    const yr = e.target.closest('#pr-yr');
    if (yr) {
      const pr = yr.closest('.pr-reviews'); const mo = pr.querySelector('#pr-mo'); const data = JSON.parse(pr.querySelector('.pr-jump').dataset.months);
      const keep = mo.value ? mo.value.slice(-2) : ''; const list = data[yr.value] || [];
      mo.innerHTML = monthOpts(list); const hit = keep && list.find(([v]) => v.slice(-2) === keep); mo.value = hit ? hit[0] : ''; xselShow(mo);
      if (hit) goMonth(pr, mo.value);
      return true;
    }
    const sel = e.target.closest('#pr-mo'); if (!sel) return false; if (sel.value) goMonth(sel.closest('.pr-reviews'), sel.value); return true;
  };
  // open the month's review year and its monthly reviews, and bring its row into view, highlighted
  function goMonth(pr, value) {
    const [n, mk] = value.split('|'); const card = pr.querySelector(`.pr-year[data-year="${n}"]`); if (!card) return;
    setYear(card, true); syncAll(pr);
    const det = card.querySelector('[data-pr-months]'); if (det) det.open = true;
    const row = card.querySelector(`.ckt tr[data-mk="${mk}"]`) || card;
    RM.$$('.ckt tr.is-hl', pr).forEach((r) => r.classList.remove('is-hl'));
    if (row !== card) row.classList.add('is-hl', 'is-flash');
    requestAnimationFrame(() => { const y = row.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.25; window.scrollTo({ top: Math.max(0, y), behavior: RM.reduced() ? 'auto' : 'smooth' }); });
  }
  function profileReviews(me, emp) {
    const p = q.person(emp); const years = yearList(emp); const curMk = RV.curMonth();
    // this year starts open (or the newest, when none is running); the others start closed
    const openN = (years.find((n) => RV.year(p, n).start <= curMk && RV.year(p, n).end >= curMk) || years[0]);
    // Go to: a year, then one of its months with a monthly review (newest first); picking the month opens its review year
    // and its row. The month list is the chosen year's (data-months), rebuilt when the year changes
    const mks = years.flatMap((n) => RV.year(p, n).months.filter((mk) => mk <= curMk && RV.formFor(emp, mk)).map((mk) => ({ n, mk }))).sort((a, b) => b.mk.localeCompare(a.mk));
    const byYear = {}; mks.forEach((x) => { (byYear[x.mk.slice(0, 4)] = byYear[x.mk.slice(0, 4)] || []).push([`${x.n}|${x.mk}`, RV.monthLabel(x.mk).split(' ')[0]]); });
    const ys = Object.keys(byYear).sort().reverse();
    const jump = mks.length ? `<span class="pr-jump" data-months="${esc(JSON.stringify(byYear))}"><span class="small muted">Go to</span>
        <label class="sr-only" for="pr-yr">Year</label><select class="select pr-yr" id="pr-yr">${ys.map((y, i) => `<option value="${y}"${i ? '' : ' selected'}>${y}</option>`).join('')}</select>
        <label class="sr-only" for="pr-mo">Month</label><select class="select pr-mo" id="pr-mo">${monthOpts(byYear[ys[0]])}</select></span>` : '';
    const all = years.length > 1 ? `<button type="button" class="link-btn small" data-pryear-all>${years.every((n) => n === openN) ? 'Collapse all' : 'Expand all'}</button>` : '';
    // what's waiting on this viewer (the Practice Head's direct reportees: their monthly feedback, a quarter's marks), with the
    // Review page to do it on
    const m = RV.month(emp, curMk); const fb = m && m.state === 'open' && !m.mgrDone && RV.canEditEntry(me, emp, curMk, 'mgr');
    const mr = RV.recsOf(emp).find((r) => !q.isFrozen(r) && RV.canMgr(me, r));
    const todo = fb || mr ? C.notice('', 'pen-new-square-linear', `${nextLine(me, emp)} <span class="pr-todo">${mr ? `<a class="link-btn small" href="${RM.quarterHref(mr, me)}">Give marks ${ic('arrow-right-linear')}</a>` : ''}${fb ? `<a class="link-btn small" href="${RM.reviewPageHref(emp, 'month', null, me)}">Add feedback ${ic('arrow-right-linear')}</a>` : ''}</span>`) : '';
    return `<div class="stack pr-reviews">
      ${todo}
      ${RV.canSeeAppraisals(me, emp) ? profileAppraisal(me, emp) : ''}
      ${years.length ? `<div class="pr-years-h"><h2 class="h3">Review years</h2><span class="pr-years-tools">${jump}${all}</span></div>${years.map((n) => profileYear(me, emp, n, n === openN)).join('')}` : `<div class="card">${C.empty('clipboard-list-linear', 'Nothing yet', 'Monthly reviews and marks show here once there are some.')}</div>`}
      ${q.isAdmin(me) ? formChanges(emp) : ''}
    </div>`;
  }

  /* ---------- the Review page ---------- */
  // what's next on this person's review, for this viewer, in a sentence or two
  function nextLine(me, emp) {
    const p = q.person(emp); const mine = own(me, emp); const recs = RV.recsOf(emp).filter((r) => !q.isFrozen(r)); const mk = RV.curMonth(); const m = RV.month(emp, mk); const out = [];
    const short = (r) => esc(RV.quarter(r.key).short); const by = (r) => (RV.overdue(r) ? 'overdue' : 'due ' + day(RV.lockBy(RV.quarter(r.key))));
    if (mine) {
      const ch = recs.find((r) => r.status === 'Changes Requested' && RV.canSelf(me, r)); const self = recs.find((r) => RV.canSelf(me, r)); const wait = recs.find(RV.needsMgr);
      if (ch) out.push(`${esc(first(q.person(ch.reviewer)))} asked you to change your ${short(ch)} marks.`); else if (self) out.push(`Your ${short(self)} marks are ${by(self)}.`);
      if (m && m.state === 'open' && !m.empDone) out.push(`Your ${esc(RV.monthLabel(mk))} monthly review is open until ${day(RV.monthEnd(mk))}.`);
      if (!out.length && wait) out.push(`Your ${short(wait)} marks are with ${esc(first(q.person(wait.reviewer)))}.`);
      return out.join(' ') || 'You’re up to date.';
    }
    const mgr = recs.find((r) => RV.canMgr(me, r)); const self = recs.find((r) => RV.needsSelf(r) && !RV.isLocked(r) && RV.recAccess(me, r) !== 'none');
    if (mgr) out.push(`${esc(first(p))}’s ${short(mgr)} marks are waiting on you.`);
    if (m && RV.canEditEntry(me, emp, mk, 'mgr') && !m.mgrDone) out.push(`Add your ${esc(RV.monthLabel(mk))} feedback by ${day(RV.monthEnd(mk))}.`);
    if (!out.length && self) out.push(`Waiting on ${esc(first(p))}’s ${short(self)} marks, ${by(self)}.`);
    return out.join(' ') || `${esc(first(p))} is up to date.`;
  }
  function reviewPage(me, emp, params) {
    const p = q.person(emp); if (!p) return pageMsg('user-rounded-linear', 'No one with that ID', '');
    const access = RV.access(me, emp); const standIn = access === 'none' && recsSeen(me, emp).length > 0;
    if (access === 'none' && !standIn) return pageMsg('lock-keyhole-minimalistic-linear', 'You can’t open this review', `Reviews are visible to ${ACCESS_TEXT}.`);
    if (!RV.inCycles(p) && !RV.formsOf(emp).length && !RV.recsOf(emp).length) return pageMsg('clipboard-list-linear', 'Not in reviews', `${esc(p.name)} isn’t in reviews.${p.mapPending ? ' Their designation is waiting for Admin to map it to a role.' : ''}`);
    const mine = own(me, emp);
    // a manager covering one quarter sees just those marks
    const tab = standIn ? 'marks' : ['month', 'marks', 'history'].includes(params.t) ? params.t : 'month';
    const m = RV.month(emp, RV.curMonth()); const monthTodo = m && m.state === 'open' && ((mine && !m.empDone) || (RV.canEditEntry(me, emp, RV.curMonth(), 'mgr') && !m.mgrDone));
    const marksTodo = RV.recsOf(emp).filter((r) => RV.canSelf(me, r) || RV.canMgr(me, r)).length;
    const tabs = standIn ? '' : `<div class="rv-tabs">${C.seg([{ key: 'month', label: 'This month', href: RM.reviewPageHref(emp, 'month', null, me), count: monthTodo ? '1' : '' }, { key: 'marks', label: 'Marks', href: RM.reviewPageHref(emp, 'marks', null, me), count: marksTodo || '' }, { key: 'history', label: 'History', href: RM.reviewPageHref(emp, 'history', null, me) }], tab, 'aria-label="Review"')}</div>`;
    const panel = tab === 'marks' ? marksTab(me, emp, params) : tab === 'history' ? historyTab(me, emp, params) : monthTab(me, emp);
    return `<div class="page rv-page">
      <header class="page-head"><div><div class="eyebrow">${mine ? 'My review' : `${esc(p.designation)}${q.person(p.rm) ? ' · reports to ' + esc(q.person(p.rm).name) : ''}`} ${C.sample('Sample review data')}</div>
        <h1 class="display" data-split>${mine ? 'Your <em class="accent">review</em>' : `${esc(first(p))}’s <em class="accent">review</em>`}<span class="dot-o">.</span></h1>
        <p class="lede">${standIn ? `You’re giving ${esc(first(p))}’s manager marks for this quarter.` : nextLine(me, emp)}</p></div>
        ${!mine && q.canOpenProfile(me, p) ? `<div class="head-actions"><button class="btn btn-secondary" data-action="open-person" data-id="${p.id}">${ic('user-id-linear')}Profile</button></div>` : ''}</header>
      ${tabs}
      <div class="rv-panel" data-rvtab="${tab}">${panel}</div>
    </div>`;
  }
  function bindReviewPage(root, ctx) {
    bindForm(root, ctx); bindQuarter(root, ctx.me);
    const hl = root.querySelector('#ckt-hl'); if (hl) setTimeout(() => hl.scrollIntoView({ block: 'center', behavior: RM.reduced() ? 'auto' : 'smooth' }), 260);
  }
  V.myReview = { title: 'My review', render({ me, params }) { return reviewPage(me, me.id, params); }, mount: bindReviewPage };
  V.review = { title: 'Review', crumb: (params, me) => { const p = q.person(params.emp); return p ? Object.assign(teamCrumb(me), { name: p.name }) : null; }, render({ me, params }) { return reviewPage(me, params.emp, params); }, mount: bindReviewPage };

  /* ---------- the Appraisal summary: a snapshot of the quarters behind an appraisal ---------- */
  const versionSeg = (doc, cur, href) => (doc.versions.length > 1 ? `<div class="hstack" style="gap:8px"><span class="small muted">Version</span>${C.seg(doc.versions.map((v) => ({ key: String(v.version), label: 'v' + v.version, href: href(v.version) })), String(cur), 'aria-label="Version"').replace('class="seg"', 'class="seg seg-sm"')}</div>` : '');
  const marksTable = (quarters, emp) => `<div class="table-wrap"><table class="table"><thead><tr><th>Quarter</th><th class="r">Self</th><th class="r">Manager</th><th>Sent</th><th>Final</th><th>Marked by</th></tr></thead>
    <tbody>${quarters.map((s) => { const qq = RV.quarter(s.key); const r = RV.recFor(emp, s.key); return `<tr ${r ? `class="is-clickable" data-href="${RM.quarterHref(r)}"` : ''}><td><b class="nowrap">${esc(qq.fq)}</b> <span class="small muted nowrap">${esc(qq.span)}</span></td><td class="r num">${s.selfMark == null ? '–' : `${s.selfMark}<small class="muted"> / ${s.max}</small>`}<div class="tiny muted">${pct(s.selfPct)}</div></td><td class="r num strong">${s.mgrMark == null ? '–' : `${s.mgrMark}<small class="muted"> / ${s.max}</small>`}<div class="tiny muted">${pct(s.mgrPct)}</div></td><td class="small num nowrap">${s.selfAt ? fmt.date(s.selfAt) : '–'}</td><td class="small num nowrap">${s.lockedAt ? fmt.date(s.lockedAt) : '–'}${s.late ? ' <span class="badge b-warn no-dot" style="height:20px;font-size:11px">Late</span>' : ''}</td><td class="small">${C.who(q.person(s.reviewer))}</td></tr>`; }).join('') || '<tr><td colspan="6" class="small muted">No final quarters.</td></tr>'}</tbody></table></div>`;
  // the review year's record, filed with its appraisal: its monthly reviews, and its evidence (collapsed; print opens it)
  function recordSection(me, emp, mks) {
    if (!mks.length) return ''; const ev = RM.evidenceRecord(me, emp, mks);
    return `<section class="section card" data-reveal><div class="card-head"><h2 class="h3">Monthly reviews and evidence</h2><span class="spacer small muted">${esc(RV.monthLabel(mks[0]))} – ${esc(RV.monthLabel(mks[mks.length - 1]))} · the review year’s record</span></div>
      <div class="card-body stack">${RM.checkinTable(me, emp, mks)}
        ${ev.html ? `<details class="fy-x"><summary>${ic('folder-with-files-linear')}<b>Evidence</b><span class="small muted">${ev.rows} ${ev.rows === 1 ? 'row' : 'rows'} under ${ev.goals} ${ev.goals === 1 ? 'goal' : 'goals'}, each with the month it was added</span>${ic('alt-arrow-down-linear')}</summary><div class="doc-ev">${ev.html}</div></details>` : ''}</div></section>`;
  }
  const recordMonths = (a) => { const f = a.recordId ? RV.form(a.recordId) : null; return f ? RV.formMonths(f) : []; };
  const mksOf = (a) => { const m = recordMonths(a); return m.length ? m : [RV.curMonth()]; };
  function notGenerated(me, a, p, back) {
    const blocked = a.reason === 'blocked'; const recs = (blocked ? a.blocking : []).map((k) => RV.recFor(a.emp, k)).filter(Boolean); const missed = recs.some(RV.overdue);
    const why = (r) => (RV.overdue(r) ? `Its marks weren’t made final by ${day(RV.lockBy(RV.quarter(r.key)))}: ` : `Its marks are due by ${day(RV.lockBy(RV.quarter(r.key)))}, after the appraisal date: `) + (RV.needsSelf(r) ? 'the self marks aren’t in yet' : `it’s waiting on ${esc(q.person(r.reviewer).name)}’s marks`) + '.';
    return `<div class="page doc-page"><div class="hstack" style="margin:6px 0 18px">${back}</div>
      <section class="card card-pad doc-head" data-reveal><div class="profile-hero" style="gap:18px">${C.avatar(p, 'xl')}<div style="min-width:0"><div class="eyebrow">Appraisal summary · ${fmt.date(a.date)}</div><h1 class="h2" style="font-size:26px;margin-top:6px">${esc(p.name)}</h1>
        <p class="small muted" style="margin-top:6px">${esc(p.designation)} · joined ${fmt.date(p.joined)}</p><div class="hstack" style="gap:6px;margin-top:10px">${C.appr(RV.reportLabel(a))}</div></div></div></section>
      <div class="section" data-reveal>${blocked
        ? C.notice(missed ? 'bad' : '', missed ? 'danger-triangle-linear' : 'hourglass-linear', `<b>Waiting on ${recs.map((r) => esc(RV.quarter(r.key).short)).join(', ')}.</b> ${recs.map(why).join(' ')} A quarter is never skipped: the summary is created as soon as ${recs.length === 1 ? 'it’s' : 'they’re'} final.${recs[0] ? ` <a href="${RM.quarterHref(recs[0])}">Open ${esc(RV.quarter(recs[0].key).short)}</a>` : ''}`)
        : C.notice('warn', 'info-circle-linear', `<b>Fewer than three quarters.</b> Reviews here started part-way through this review year, so it had ${a.available.length} ${a.available.length === 1 ? 'quarter' : 'quarters'} with marks and no summary was created.`)}</div>
      ${a.available.length ? `<section class="section card" data-reveal><div class="card-head"><h2 class="h3">Final quarters</h2><span class="spacer small muted">${esc(RV.monthLabel(a.yearStart || mksOf(a)[0]))} – ${esc(RV.monthLabel(a.yearEnd || mksOf(a).slice(-1)[0]))}</span></div><div class="card-body"><div class="hstack" style="gap:6px">${chips(a.available)}</div></div></section>` : ''}
      ${recordSection(me, a.emp, recordMonths(a))}</div>`;
  }
  V.appraisalReport = {
    title: 'Appraisal summary',
    crumb: (params, me) => { const a = RV.appraisal(params.id); return a ? docCrumb(a.emp, me, 'Appraisal summary · ' + fmt.date(a.date)) : null; },
    render({ me, params }) {
      const a = RV.appraisal(params.id); if (!a) return pageMsg('file-remove-linear', 'Summary not found', '');
      if (!RV.canOpenReport(me, a.emp)) return pageMsg('lock-keyhole-minimalistic-linear', 'You can’t open this summary', me.id === a.emp ? 'Appraisal summaries are for your managers, the Practice Head and Admin.' : 'Appraisal summaries open for the person’s managers, the Practice Head and Admin.');
      const p = q.person(a.emp); const back = `<a class="link-btn" href="${RM.reviewsHref(a.emp, me)}">${ic('alt-arrow-left-linear')} ${esc(first(p))}’s review history</a>`;
      if (a.status !== 'Generated') return notGenerated(me, a, p, back);
      const v = a.versions.find((x) => String(x.version) === params.v) || a.versions[a.versions.length - 1]; const s = v.snapshot;
      const keys = s.quarters.map((x) => x.key); const firstQ = RV.quarter(keys[0]); const lastQ = RV.quarter(keys[keys.length - 1]);
      const trend = s.quarters.length >= 2 ? RM.charts.lines([{ name: 'Manager', color: 'var(--viz-1)', values: s.quarters.map((x) => x.mgrPct) }, { name: 'Self', color: 'var(--viz-2)', values: s.quarters.map((x) => x.selfPct) }], keys.map((k) => RV.quarter(k).short), { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], yFmt: (x) => x + '%', tipFmt: 'pct', w: 900, h: 220, padL: 44, padR: 76, label: 'Marks across these quarters, as % of the maximum' }) : '';
      const mks = s.months.map((m) => m.mk);
      return `<div class="page doc-page">
        <div class="hstack doc-tools" style="margin:6px 0 18px;justify-content:space-between;gap:12px;flex-wrap:wrap">${back}<div class="hstack" style="gap:10px">${versionSeg(a, v.version, (n) => RM.appraisalHref(a, n))}<button type="button" class="btn btn-secondary btn-sm" data-print>${ic('download-minimalistic-linear')}Print or save as PDF</button></div></div>
        <section class="card card-pad doc-head" data-reveal><div class="profile-hero" style="gap:18px">${C.avatar(p, 'xl')}<div style="min-width:0"><div class="eyebrow">Appraisal summary · ${fmt.date(a.date)}${a.versions.length > 1 ? ' · version ' + v.version : ''}</div><h1 class="h2" style="font-size:26px;margin-top:6px">${esc(s.name || p.name)}</h1>
          <p class="small muted" style="margin-top:6px">${esc(s.designation || p.designation)} · joined ${fmt.date(p.joined)}</p>
          <p class="small muted">Covers the review year’s ${keys.length} quarters, ${fmt.date(firstQ.start)} – ${fmt.date(lastQ.end)}</p>
          <div class="hstack" style="gap:6px;margin-top:10px">${C.appr(RV.reportLabel(a))}${flagBadges(a.flags.filter((x) => x !== 'PARTIAL_CYCLE'))}</div></div></div>
          <div class="score-pair doc-agg"><div><div class="small muted">Average · self</div><div class="v num">${pct(s.selfAgg)}</div></div><div><div class="small muted">Average · manager</div><div class="v num">${pct(s.mgrAgg)}</div></div></div>
          <p class="tiny muted" style="margin-top:10px">Created ${fmt.dateTime(v.at)}${v.version > 1 ? ' · ' + esc(v.reason) : ''}. Each average is the quarters’ marks as % of their maximum; self and manager are never combined. A later correction adds a new version instead of changing this one.</p></section>
        ${a.flags.includes('PARTIAL_CYCLE') ? `<div class="section" data-reveal>${C.notice('warn', 'info-circle-linear', `<b>Three quarters, not four.</b> Reviews here started in ${esc(RV.monthLabel(RV.GO_LIVE))}, part-way through this review year, so its first quarter has no marks. The appraisal date doesn’t move.`)}</div>` : ''}
        ${(a.missed || []).length ? `<div class="section" data-reveal>${C.notice('', 'hourglass-linear', `<b>Created late.</b> ${a.missed.map((k) => esc(RV.quarter(k).short)).join(', ')} wasn’t final by ${a.missed.length === 1 ? 'its' : 'their'} due date, so the summary waited until ${a.missed.length === 1 ? 'it was' : 'they were'}.`)}</div>`
          : (a.late || []).length ? `<div class="section" data-reveal>${C.notice('', 'calendar-mark-linear', `<b>Created ${fmt.date(a.generatedAt)}, after the ${fmt.date(a.date, { noYear: true })} anniversary.</b> ${a.late.map((k) => esc(RV.quarter(k).short)).join(', ')} ${a.late.length === 1 ? 'was' : 'were'} made final after the appraisal date, within ${a.late.length === 1 ? 'its' : 'their'} due date, so the summary was created then.`)}</div>` : ''}
        <section class="section card" data-reveal><div class="card-head"><h2 class="h3">Marks by quarter</h2></div>${marksTable(s.quarters, a.emp)}
          ${trend ? `<div class="card-body" style="border-top:1px solid var(--line)"><div class="legend" style="margin-bottom:10px"><span><i class="sw sw-line" style="background:var(--viz-1)"></i>Manager</span><span><i class="sw sw-line" style="background:var(--viz-2)"></i>Self</span></div>${trend}</div>` : ''}</section>
        <section class="section card" data-reveal><div class="card-head"><h2 class="h3">Comments</h2><span class="spacer small muted">The employee’s and the manager’s, each quarter</span></div><div class="card-body doc-months">${assessDetails(me, a.emp, s.quarters)}</div></section>
        ${recordSection(me, a.emp, mks)}
        ${a.versions.length > 1 ? `<section class="section card" data-reveal><div class="card-head"><h2 class="h3">Versions</h2></div><div class="list">${a.versions.slice().reverse().map((x) => `<div class="list-item"><span style="flex:1"><b>Version ${x.version}</b><span class="person-sub" style="white-space:normal">${fmt.dateTime(x.at)} · ${esc(x.reason)}</span></span><a class="link-btn small" href="${RM.appraisalHref(a, x.version)}">View</a></div>`).join('')}</div></section>` : ''}
      </div>`;
    },
    // print or save as PDF: the browser's print dialog, with every collapsed part open
    mount(root) {
      const b = root.querySelector('[data-print]'); if (!b) return;
      b.addEventListener('click', () => { const ds = [...root.querySelectorAll('.doc-page details')]; const was = ds.map((d) => d.open); ds.forEach((d) => { d.open = true; }); window.print(); ds.forEach((d, i) => { d.open = was[i]; }); });
    },
  };

  /* ---------- Team (managers), Reviews (Admin) and Practice Reviews (the Practice Head): one list of people ---------- */
  // a person's row: the open marks and who they wait on, this month's monthly review, the last quarter, the next appraisal
  function personState(me, p) {
    const inC = RV.inCycles(p); const mk = RV.curMonth(); const lastQ = RV.marksQuarter(p);
    const open = RV.recsOf(p.id).filter((r) => !RV.isLocked(r) && !q.isFrozen(r));
    // the person's own quarter, with its months ("Q4 Jun–Aug")
    const items = open.map((r) => ({ r, who: RV.needsMgr(r) ? r.reviewer : p.id, what: `${RV.quarter(r.key).short} ${RV.needsMgr(r) ? 'manager marks' : 'self marks'}`, over: RV.overdue(r) }));
    // this month's feedback needs the manager once the progress is in, or in the month's last week
    const m = inC ? RV.month(p.id, mk) : null; const fbMine = !!m && m.state === 'open' && !m.mgrDone && RV.canEditEntry(me, p.id, mk, 'mgr') && (m.empDone || RM.dayDiff(RM.TODAY, RV.monthEnd(mk)) <= 7);
    // an appraisal whose summary still waits on marks comes before the next one
    const held = RV.appraisalsOf(p.id).find((a) => a.status === 'Not generated' && a.reason === 'blocked');
    const nx = !inC || !RM.isEligible(p) ? null : held ? { anniv: new Date(held.date), days: RM.dayDiff(RM.TODAY, new Date(held.date)), status: RV.reportLabel(held), report: held } : q.appraisal(p);
    const mineMarks = items.some((x) => x.who === me.id);
    return { p, inC, items, open, m, fbMine, rec: RV.recFor(p.id, lastQ.key), nx, soon: !!nx && nx.days >= 0 && nx.days <= APPR_SOON,
      you: mineMarks || fbMine, behind: items.some((x) => x.over), tab: mineMarks ? 'marks' : fbMine ? 'month' : items.length ? 'marks' : 'month' };
  }
  const APPR_SOON = 90; // days ahead the Team list calls an appraisal soon
  // a filter's rows: soonest appraisal first when filtering by appraisal, else as listed (who needs you first)
  const teamFilter = (rows, k) => { const list = rows.filter(TEAM_FILTERS[k] || TEAM_FILTERS.all); return k === 'appr' ? list.slice().sort((a, b) => a.nx.days - b.nx.days) : list; };
  const TEAM_FILTERS = { you: (x) => x.you, behind: (x) => x.behind, marks: (x) => x.items.length > 0, appr: (x) => x.soon, all: () => true };
  function teamRows(me, list, opt) {
    if (!list.length) return C.empty('check-circle-linear', 'No one here', 'Nobody matches this filter right now.');
    const mk = RV.curMonth(); const who = (id) => (id === me.id ? '<b>You</b>' : esc(first(q.person(id) || { name: '–' })));
    const chk = (done, label) => `<span class="ck${done ? ' is-done' : ''}">${ic(done ? 'check-circle-bold' : 'clock-circle-linear')}${label}</span>`;
    return `<div class="table-wrap"><table class="table team-table"><thead><tr><th>Person</th><th>Waiting on</th><th>${esc(RV.monthShort(mk))} monthly review</th><th>Last quarter</th><th>Next appraisal</th>${opt.admin ? '<th><span class="sr-only">Actions</span></th>' : ''}</tr></thead>
      <tbody>${list.map((x) => { const p = x.p; const href = x.inC || x.items.length ? RM.reviewPageHref(p.id, x.tab, null, me) : '';
        const d = opt.depth && opt.depth[p.id];
        const sub = esc(p.designation) + (d ? ` · <span class="badge ${d.type === 'Direct' ? 'b-info' : 'b-outline'} no-dot" style="height:20px;font-size:11px">${d.type}</span>` : '');
        const wait = !x.inC ? `<span class="small faint">${p.mapPending ? 'Not in reviews · role mapping pending' : 'Not in reviews'}</span>`
          : x.items.length ? x.items.map((i) => `<div class="small">${who(i.who)} · ${esc(i.what)}${i.over ? ' <span class="badge b-warn no-dot" style="height:20px;font-size:11px">Missed</span>' : ` <span class="muted">· due ${day(RV.lockBy(RV.quarter(i.r.key)))}</span>`}</div>`).join('') : '<span class="small faint">Nothing</span>';
        const nx = x.nx; const rep = nx && nx.report && RV.canOpenReport(me, p.id);
        return `<tr${href ? ` class="is-clickable${x.you ? ' is-you' : ''}" data-href="${href}"` : ''}>
          <td>${C.person(p, sub, { link: true, size: 'sm' })}</td>
          <td data-label="Waiting on">${wait}</td>
          <td data-label="${esc(RV.monthShort(mk))} monthly review">${x.m ? `<div class="ck-pair">${chk(x.m.empDone, 'Progress')}${chk(x.m.mgrDone, 'Feedback')}</div>${x.fbMine ? '<div class="tiny" style="color:var(--blue-800);margin-top:4px">Your feedback to add</div>' : ''}` : '<span class="faint">–</span>'}</td>
          <td class="nowrap" data-label="Last quarter">${x.rec ? `${C.status(x.rec.status, q.isFrozen(x.rec), RV.incomplete(x.rec))}<div class="tiny muted" style="margin-top:4px">${esc(RV.quarter(x.rec.key).short)}</div>` : '<span class="small faint">–</span>'}</td>
          <td class="nowrap" data-label="Next appraisal">${nx ? `<span class="num small">${fmt.date(nx.anniv)}</span>${x.soon || nx.report ? `<div style="margin-top:4px">${rep ? `<a href="${RM.appraisalHref(nx.report)}">${C.appr(nx.status)}</a>` : C.appr(nx.status)}</div>` : ''}` : '<span class="faint">–</span>'}</td>
          ${opt.admin ? `<td class="r team-act">${x.open[0] ? `<button class="btn btn-ghost btn-sm btn-icon" data-action="reassign" data-id="${x.open[0].id}" data-tip="Change who gives the ${esc(RV.quarter(x.open[0].key).short)} manager marks" aria-label="Change ${esc(p.name)}’s manager for ${esc(RV.quarter(x.open[0].key).short)}">${ic('transfer-horizontal-linear')}</button>` : ''}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
  }
  // practice-wide figures: the marks due this month, last month's monthly reviews, and how many of last month's marks were on time.
  // Quarters are each person's own, so marks are grouped by the month they're due (the quarter's last month)
  function practiceStrip(ids) {
    const cur = RV.curMonth(); const pm = RV.addMonths(cur, -1); const live = RV.completion(cur, ids); const mc = RV.monthCompletion(pm, ids); const comp = RV.completion(pm, ids);
    return `<section class="kpis kpis-3">
      ${C.kpi({ label: `Marks due ${day(live.due)}`, icon: 'clipboard-check-linear', value: C.count(live.done), unit: '/ ' + live.total + ' final', sub: `Quarters ending in ${RV.monthShort(cur)}` })}
      ${C.kpi({ label: `${RV.monthShort(pm)} monthly reviews`, icon: 'clipboard-list-linear', value: mc.pct == null ? '–' : C.count(mc.pct), unit: mc.pct == null ? '' : '% done', sub: `${mc.done} of ${mc.total} done in the month`, tone: mc.pct != null && mc.pct < 90 ? 'warn' : '' })}
      ${C.kpi({ label: `Marks due ${day(comp.due)}`, icon: 'calendar-mark-linear', value: comp.pct == null ? '–' : C.count(comp.pct), unit: comp.pct == null ? '' : '% on time', sub: `${comp.done} of ${comp.total} final by the due date`, tone: comp.incomplete.length ? 'warn' : '' })}
    </section>`;
  }
  // Practice Reviews' figures: the year's average rating, manager and self (each final quarter's marks on the rating scale,
  // averaged per person, then across the practice), last year's beneath it, and this month's monthly reviews still pending
  const rate = (v) => (v == null ? '–' : v.toFixed(1));
  const avgOf = (list) => (list.length ? Math.round((list.reduce((a, v) => a + v, 0) / list.length) * 10) / 10 : null);
  function practiceRating(rts) {
    const rs = rts.filter((r) => r.n);
    return { n: rs.length, mgr: avgOf(rs.map((r) => r.mgr).filter((v) => v != null)), self: avgOf(rs.map((r) => r.self).filter((v) => v != null)) };
  }
  // against last year: a small arrow and the change, green up, red down, a grey arrow alone when level; no chip, so the figure stays the focus
  const trend = (v, pv, label) => {
    if (v == null || pv == null) return '';
    const d = Math.round((v - pv) * 10) / 10; const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    const said = dir === 'flat' ? 'Level with' : `${dir === 'up' ? 'Up' : 'Down'} ${Math.abs(d).toFixed(1)} on`;
    return `<span class="rt-trend is-${dir}" data-tip="${said} ${esc(label)} (${pv.toFixed(1)})" aria-label="${said} ${esc(label)}">${ic(dir === 'flat' ? 'arrow-right-linear' : 'arrow-right-up-linear')}${dir === 'flat' ? '' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1)}</span>`;
  };
  function practiceCards(rows, headcount) {
    const fy = RV.curFy(); const pfy = RV.fyKey(RV.fyYear(fy) - 1);
    const cur = practiceRating(rows.map((x) => x.rt)); const prev = practiceRating(rows.map((x) => x.prt));
    const ids = rows.map((x) => x.p.id); const mk = RV.curMonth(); const mc = RV.monthCompletion(mk, ids); const pending = mc.total - mc.done;
    // out of everyone in the practice, so the line leads with those not in reviews: they're why the two numbers differ
    const started = mc.list.filter((x) => x.m.empDone).length; const outside = headcount - ids.length;
    return `<section class="kpis kpis-2">
      <div class="kpi kpi-rating" data-reveal>
        <div class="kpi-label">${ic('star-linear')}Average rating · ${esc(RV.fyLabel(fy))}</div>
        <div class="kpi-duo">
          <div><span class="kpi-duo-l">Manager</span><div class="kpi-value">${cur.mgr == null ? '–' : C.count(cur.mgr, 1)}<small>/ 5</small>${trend(cur.mgr, prev.mgr, RV.fyLabel(pfy))}</div></div>
          <div><span class="kpi-duo-l">Self</span><div class="kpi-value">${cur.self == null ? '–' : C.count(cur.self, 1)}<small>/ 5</small>${trend(cur.self, prev.self, RV.fyLabel(pfy))}</div></div>
        </div>
        <div class="kpi-sub kpi-last">Compared with ${esc(RV.fyLabel(pfy))}: manager <b>${rate(prev.mgr)}</b> · self <b>${rate(prev.self)}</b></div>
      </div>
      ${C.kpi({ label: `${RV.monthShort(mk)} monthly reviews pending`, icon: 'clipboard-list-linear', value: C.count(pending), unit: '/ ' + headcount, sub: `${outside ? `${outside} not in reviews · ` : ''}Due ${day(RV.monthEnd(mk))} · ${started} ${started === 1 ? 'has' : 'have'} added progress` })}
    </section>`;
  }
  // on time by the month marks were due, and by manager, for Admin
  function practiceDetails(ids) {
    const rows = []; for (let i = 0, mk = RV.curMonth(); i < 6; i++, mk = RV.addMonths(mk, -1)) { const c = RV.completion(mk, ids); if (c.total) rows.push(c); }
    const recs = RV.recs().filter((r) => !q.isFrozen(r) && ids.includes(r.emp) && (r.key === RV.marksQuarter(q.person(r.emp)).key || !RV.isLocked(r)));
    const mgrs = [...new Set(recs.map((r) => r.reviewer))].map((id) => { const own = recs.filter((r) => r.reviewer === id); return { p: q.person(id), total: own.length, done: own.filter(RV.isLocked).length, over: own.filter(RV.overdue).length, wait: own.filter(RV.needsMgr).length }; }).sort((a, b) => b.over - a.over || b.wait - a.wait || a.p.name.localeCompare(b.p.name));
    return `<details class="fy-x section card card-pad" data-reveal><summary>${ic('chart-2-linear')}<b>On time, by due date and by manager</b><span class="small muted">Marks made final by their due date. Quarters follow each person’s joining date, so they’re grouped by the month their marks were due</span>${ic('alt-arrow-down-linear')}</summary>
      <div class="stack" style="gap:16px;margin-top:12px">
        <div class="table-wrap"><table class="table"><thead><tr><th>Due</th><th>Quarters that end in</th><th class="r">On time</th><th>Missed</th></tr></thead><tbody>${rows.map((c) => `<tr><td class="num nowrap"><b>${day(c.due)}</b>${c.ended ? '' : ' <span class="small muted">· still open</span>'}</td><td class="small nowrap">${esc(RV.monthLabel(c.mk))}</td><td class="r num nowrap">${c.ended ? `${c.done} / ${c.total}${c.pct == null ? '' : ` <span class="muted">· ${c.pct}%</span>`}` : `<span class="muted">${c.done} / ${c.total} final so far</span>`}</td><td class="small">${c.incomplete.length ? c.incomplete.map((r) => `<a href="${RM.quarterHref(r)}">${esc(q.person(r.emp).name)}</a>${RV.isLocked(r) ? ' <span class="muted">(late)</span>' : ''}`).join(', ') : '<span class="faint">None</span>'}</td></tr>`).join('')}</tbody></table></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Manager</th><th class="r">Final</th><th class="r">Waiting on them</th><th class="r">Missed</th></tr></thead><tbody>${mgrs.map((x) => `<tr><td>${C.person(x.p, esc(x.p.designation), { link: true, size: 'sm' })}</td><td class="r num">${x.done} / ${x.total}</td><td class="r num ${x.wait ? 'strong' : 'faint'}">${x.wait}</td><td class="r num ${x.over ? 'due-over' : 'faint'}">${x.over}</td></tr>`).join('')}</tbody></table></div>
      </div></details>`;
  }
  // appraisal summaries still waiting on marks, or not created, for Admin
  function notCreated(ids) {
    const list = store.db.appraisals.filter((a) => a.status === 'Not generated' && ids.includes(a.emp) && (q.person(a.emp) || {}).status === 'Active'); if (!list.length) return '';
    // waiting only on Q4 (due by the end of the anniversary month) is the usual course; missed marks or no summary are a problem
    const missed = list.filter((a) => a.reason === 'blocked' && RV.waitingOnMissed(a)); const q4 = list.filter((a) => a.reason === 'blocked' && !RV.waitingOnMissed(a)); const none = list.filter((a) => a.reason !== 'blocked');
    const item = (a) => { const p = q.person(a.emp); return `<a href="${RM.appraisalHref(a)}">${esc(p.name)}</a> (${fmt.date(a.date, { noYear: true })}, ${a.reason === 'blocked' ? 'waiting on ' + a.blocking.map((k) => esc(RV.quarter(k).short)).join(', ') : 'fewer than three quarters'})`; };
    const bad = missed.concat(none); const head = [missed.length ? `${missed.length} appraisal ${missed.length === 1 ? 'summary' : 'summaries'} waiting on missed marks` : '', none.length ? `${none.length} not created` : ''].filter(Boolean).join(', ');
    return (bad.length ? `<div class="section" data-reveal>${C.notice('bad', 'danger-triangle-linear', `<b>${head}.</b> ${bad.map(item).join('; ')}.`)}</div>` : '')
      + (q4.length ? `<div class="section" data-reveal>${C.notice('', 'hourglass-linear', `<b>${q4.length} appraisal ${q4.length === 1 ? 'summary' : 'summaries'} waiting on Q4.</b> ${q4.map(item).join('; ')}. Q4’s marks are due by the end of the anniversary month; each summary is created as soon as they’re final.`)}</div>` : '');
  }
  function teamPage(me, params, opt) {
    const admin = !!opt.admin;
    const desc = q.descendants(me.id); const depth = {}; desc.forEach((d) => { depth[d.p.id] = d; });
    let people;
    if (admin) people = q.active().filter((p) => p.id !== me.id && !q.isPH(p) && !p.system && (RV.inCycles(p) || p.mapPending || RV.recsOf(p.id).length));
    else {
      const ids = new Set(desc.map((d) => d.p.id));
      RV.ownedBy(me.id).filter((r) => !RV.isLocked(r) && !q.isFrozen(r)).forEach((r) => ids.add(r.emp));
      people = [...ids].map((id) => q.person(id)).filter((p) => p && p.status === 'Active');
    }
    const rows = people.map((p) => personState(me, p)).sort((a, b) => (b.you - a.you) || (b.behind - a.behind) || (b.items.length > 0) - (a.items.length > 0) || a.p.name.localeCompare(b.p.name));
    const counts = Object.fromEntries(Object.entries(TEAM_FILTERS).map(([k, fn]) => [k, rows.filter(fn).length]));
    const f = TEAM_FILTERS[params.f] ? params.f : 'all';
    const pills = C.filterPills([['all', 'Everyone', counts.all], ['you', 'Needs you', counts.you, 'Marks waiting on your mark, or feedback for you to add this month'], ['behind', 'Missed', counts.behind, 'Marks not made final by their due date'], ['marks', 'Marks open', counts.marks], ['appr', `Appraisal in ${APPR_SOON} days`, counts.appr]].filter(([k, , n]) => k === 'all' || n || k === f), f, 'Filter people');
    const ids = people.map((p) => p.id);
    const you = counts.you; const lede = admin ? 'Everyone in reviews: what each person is waiting on, their monthly review this month, their last quarter and their next appraisal. Open a row for their review.'
      : `${you ? `${you} ${you === 1 ? 'person needs' : 'people need'} you.` : 'Nothing needs you right now.'} Open a row for that person’s review.`;
    const opts = { depth: admin ? null : depth, admin };
    RM._teamRows = (k) => teamRows(me, teamFilter(rows, k), opts);
    return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">${admin ? 'Admin console' : 'My team'} ${C.sample('Sample review data')}</div>
        <h1 class="display" data-split>${admin ? 'Reviews' : 'Your <em class="accent">team</em>'}<span class="dot-o">.</span></h1>
        <p class="lede">${lede}</p></div></header>
      ${admin ? practiceStrip(ids) : ''}
      ${admin ? notCreated(ids) : ''}
      <section class="section card" data-reveal>
        <div class="toolbar">${pills}</div>
        <div id="team-table">${RM._teamRows(f)}</div>
      </section>
      ${admin ? practiceDetails(ids) : ''}
    </div>`;
  }
  // Practice Reviews: how the practice is rated this year, and what's still open this month. Everyone in the practice, A to Z
  // (anyone not in reviews says so, and why), with their last appraisal rating against the one the year before; a row opens their profile's Reviews tab. Resource Allocation's
  // toolbar narrows the list (its search also finds a manager), kept while you go to a profile and back. Nothing here is the
  // Practice Head's to do
  const prSt = () => RM.prFilter || (RM.prFilter = RM.raFilters.state());
  const prOn = (x, st) => { const s = st.q.trim().toLowerCase(); const rm = q.person(x.p.rm);
    return (!s || [x.p.name, x.p.id, rm ? rm.name : ''].some((t) => t.toLowerCase().includes(s))) && RM.raFilters.match(x.p, Object.assign({}, st, { q: '' })); };
  // every appraisal's rating out of 5 so far, oldest first (the salary history's, as on the profile)
  const apprRatings = (p) => RM.salaryHistory(p).filter((e) => e.kind === 'appraisal' && e.rating && e.date <= RM.TODAY);
  let prList = [];
  // why someone isn't in reviews (the row's badge tooltip)
  const outWhy = (p) => (p.contractor ? 'Contractor: paid a consulting fee, with no monthly reviews, marks or annual appraisal' : p.mapPending ? `Their designation (${p.designation}) is waiting for Admin to map it to a review role` : 'Their role isn’t in reviews');
  function prRows(list) {
    if (!list.length) return `<tr class="pr-empty"><td colspan="4">${C.empty('magnifer-linear', 'No one matches', 'Try another name, ID, manager or filter.')}</td></tr>`;
    // the last rating, with its arrow against the appraisal before it; both dates on hover
    const cell = (x) => { const e = x.ar[x.ar.length - 1]; const pe = x.ar[x.ar.length - 2]; const label = 'Last appraisal rating';
      if (!e) return `<td class="num" data-label="${label}"><span class="faint" data-tip="${x.p.contractor ? 'Contractors have no annual appraisal' : `No appraisal yet${x.next ? ' · the first is on ' + esc(fmt.date(x.next)) : ''}`}">–</span></td>`;
      const row = (a) => `<div class='tip-row'><span>${esc(fmt.date(a.date))}</span><b>${rate(a.rating)}</b></div>`;
      return `<td class="num nowrap" data-label="${label}"><span class="rating" data-tip="${esc(`<b>Annual appraisal${pe ? 's' : ''}</b>${row(e)}${pe ? row(pe) : ''}`)}"><b>${rate(e.rating)}</b></span>${pe ? trend(e.rating, pe.rating, `${pe.date.getFullYear()}’s appraisal`) : ''}</td>`; };
    return list.map((x) => { const p = x.p; const rm = q.person(p.rm);
      // the date only, and always the coming anniversary (not a summary that has just happened or waits on marks)
      return `<tr class="is-clickable" data-href="#/people/${p.id}?tab=reviews">
          <td>${C.person(p, esc(p.designation), { link: true, size: 'sm', tab: 'reviews' })}</td>
          <td class="small" data-label="Manager">${rm ? esc(rm.name) : '<span class="faint">–</span>'}</td>
          ${cell(x)}
          <td class="nowrap" data-label="Next appraisal">${x.out ? `<span class="badge b-outline no-dot" data-tip="${esc(outWhy(p))}">Not in reviews</span>` : x.next ? `<span class="num small">${fmt.date(x.next)}</span>` : '<span class="faint">–</span>'}</td></tr>`; }).join('');
  }
  function practicePage(me) {
    const people = q.active().filter((p) => p.id !== me.id && !q.isPH(p) && !p.system); const fy = RV.curFy();
    const pfy = RV.fyKey(RV.fyYear(fy) - 1); const st = prSt();
    const rows = prList = people.map((p) => Object.assign(personState(me, p), { out: !RV.inCycles(p), rt: RV.fyRating(p.id, fy), prt: RV.fyRating(p.id, pfy), next: RM.isEligible(p) ? RV.preview(p).date : null, ar: apprRatings(p) })).sort((a, b) => a.p.name.localeCompare(b.p.name));
    const shown = rows.filter((x) => prOn(x, st));
    return `<div class="page">
      <header class="page-head"><div><h1 class="display" data-split>Practice <em class="accent">Reviews</em><span class="dot-o">.</span></h1></div></header>
      ${practiceCards(rows.filter((x) => !x.out), people.length)}
      <section class="section card" data-reveal>
        ${RM.raFilters.toolbar('pr', people, st, `${shown.length} of ${rows.length}`).replace('placeholder="Search name or ID…"', 'placeholder="Search name, ID or manager…"')}
        <div id="team-table">${rows.length ? `<div class="table-wrap"><table class="table team-table pr-table"><thead><tr><th>Person</th><th>Manager</th><th class="nowrap">Last appraisal rating<span class="th-span">Compared to the year before</span></th><th>Next appraisal</th></tr></thead>
          <tbody id="pr-rows">${prRows(shown)}</tbody></table></div>` : C.empty('check-circle-linear', 'No one here', 'No one in the practice is in reviews yet.')}</div>
      </section>
    </div>`;
  }
  // the toolbar rebuilds the rows (RM.swapRows, lighter while typing) and the count
  function bindPractice(root) {
    const body = root.querySelector('#pr-rows'); if (!body) return; const st = prSt();
    RM.raFilters.wire(root, 'pr', st, (mode) => { const shown = prList.filter((x) => prOn(x, st));
      root.querySelector('#pr-count').textContent = `${shown.length} of ${prList.length}`; RM.tip.hide();
      RM.swapRows(body, prRows(shown), { mode: mode || 'swap' }); });
  }
  function bindTeam(root) {
    RM.bindFilters(root, { group: '.toolbar .filter-pills', target: '#team-table', render: (k) => RM._teamRows(k),
      url: (k) => { const h = location.hash.split('?'); const ps = new URLSearchParams(h[1] || ''); if (k === 'all') ps.delete('f'); else ps.set('f', k); const qs = ps.toString(); return h[0] + (qs ? '?' + qs : ''); } });
  }
  V.team = { title: 'Team', render({ me, params }) { return teamPage(me, params, {}); }, mount(root) { bindTeam(root); } };
  V.adminReviews = { title: 'Reviews', render({ me, params }) { return teamPage(me, params, { admin: true }); }, mount(root) { bindTeam(root); } };
  V.practiceReviews = { title: 'Practice Reviews', render({ me }) { return practicePage(me); }, mount(root) { bindPractice(root); } };
})(window.RM);
