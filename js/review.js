/* NV-DPS-Internal review & appraisal module: records and rules (PRD §5 Module 2 — Reviews & Appraisals, v5.1, 05 Oct 2026,
 * with quarters that follow the date of joining, 08 Oct 2026).
 * Everything follows the person's joining date. Their review year starts in their joining month and runs twelve months;
 * its quarters are months 1–3, 4–6, 7–9 and 10–12, so Q4 ends the month before the anniversary month and the anniversary
 * month starts the next year. One Quarterly Goal Sheet per quarter, each goal marked out of its own weight. The persistent
 * review form is one running form per review year (from go-live for someone already here). Its evidence is one running
 * record, each row dated to the month it was added, and each month on it is an employee–manager monthly review that closes with
 * the month. The appraisal falls on the anniversary: the Pre Appraisal Report (the appraisal summary) is the year's four
 * quarters, created on that date once they're final (each quarter's marks are due on its last day, so Q4's are due before
 * the anniversary), or as soon as the last one is. Layers 1 (forms) and 2 (goal sheets)
 * hold entered data; layer 3 (reports) is a frozen snapshot. Nothing here creates a form per month or per quarter. The
 * financial year (April–March) is kept only for practice-wide figures, which count a quarter in the year it ends in. */
(function (RM) {
  'use strict';
  const RV = RM.RV = {};
  const store = RM.store;
  const q = RM.q;
  const MON = RM.MONTHS;
  const db = () => RV._db || store.db; // the seed builds its database before the store holds it
  const pad = (n) => String(n).padStart(2, '0');
  const round1 = (n) => Math.round(n * 10) / 10;
  const day = (d) => { d = new Date(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const at6 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 0);
  const mkOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const mkDate = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m - 1, 1); };
  const addMonths = (mk, n) => { const d = mkDate(mk); return mkOf(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
  const iso = (d) => new Date(d).toISOString();
  const avg = (a) => (a.length ? round1(a.reduce((s, v) => s + v, 0) / a.length) : null);
  const has = (v) => v != null && String(v).trim() !== '';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  RV.mkOf = mkOf; RV.mkDate = mkDate; RV.addMonths = addMonths;
  RV.monthLabel = (mk) => MON[+mk.slice(5) - 1] + ' ' + mk.slice(0, 4);
  RV.monthShort = (mk) => MON[+mk.slice(5) - 1];
  RV.monthsBetween = (a, b) => { const out = []; for (let mk = a; mk <= b; mk = addMonths(mk, 1)) out.push(mk); return out; };
  RV.monthEnd = (mk) => { const d = mkDate(mk); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59); };

  /* ---------- settings: go-live ---------- */
  // the platform's go-live month: someone already in the practice got their first form from here
  RV.GO_LIVE = '2024-04';
  RV.cfg = () => Object.assign({}, (db() && db().config && db().config.review) || {});

  /* ---------- financial year (April–March): practice-wide figures only (a quarter counts in the year it ends in) ---------- */
  RV.fyKey = (y) => `${y}-${String(y + 1).slice(2)}`; // 2026 -> '2026-27'
  RV.fyOfDate = (d) => { d = new Date(d); return RV.fyKey(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1); };
  RV.fyOfMonth = (mk) => RV.fyOfDate(mkDate(mk));
  RV.fyYear = (fy) => +fy.slice(0, 4);
  RV.fyLabel = (fy) => `FY ${fy.slice(0, 4)}–${fy.slice(5)}`; // 'FY 2026–27'
  RV.fyShort = (fy) => `FY${fy.slice(2, 4)}-${fy.slice(5)}`; // 'FY26-27'
  RV.fyMonths = (fy) => Array.from({ length: 12 }, (_, i) => addMonths(`${RV.fyYear(fy)}-04`, i));
  RV.fyStartDate = (fy) => new Date(RV.fyYear(fy), 3, 1);
  RV.curFy = () => RV.fyOfDate(RM.TODAY);
  RV.curMonth = () => mkOf(RM.TODAY);

  /* ---------- quarters follow the date of joining: each person's own, three months at a time from their joining month ---------- */
  // Someone who joined on 22 Sep 2025 has Q1 Sep–Nov, Q2 Dec–Feb, Q3 Mar–May and Q4 Jun–Aug, then their 22 Sep 2026
  // appraisal, and their next year starts in September. Keys are stable record IDs: the quarter's first month and its
  // number in the person's year, '2026-06-Q4'
  const joinMk = (p) => String(p.joined).slice(0, 7);
  const mDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5) - +a.slice(5)); // months from a to b
  const QC = {};
  RV.qKey = (start, n) => `${start}-Q${n}`;
  RV.quarter = (key) => {
    if (QC[key]) return QC[key];
    const sm = key.slice(0, 7); const n = +key.slice(9); const start = mkDate(sm); const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    const months = [0, 1, 2].map((i) => addMonths(sm, i)); const a = MON[start.getMonth()]; const b = MON[end.getMonth()];
    // 'Jun–Aug 2026', or 'Dec 2025 – Feb 2026' across a new year
    const span = start.getFullYear() === end.getFullYear() ? `${a}–${b} ${end.getFullYear()}` : `${a} ${start.getFullYear()} – ${b} ${end.getFullYear()}`;
    // fy: the financial year the quarter ends in, for practice-wide figures only
    QC[key] = { key, n, fq: 'Q' + n, fy: RV.fyOfDate(end), short: `Q${n} ${a}–${b}`, span, label: `Q${n} · ${span}`, start, end, months };
    return QC[key];
  };
  // the person's quarter holding a month (or a date)
  RV.quarterFor = (p, mk) => { const i = Math.floor(mDiff(joinMk(p), mk) / 3); return RV.quarter(RV.qKey(addMonths(joinMk(p), i * 3), (((i % 4) + 4) % 4) + 1)); };
  RV.quarterOn = (p, d) => RV.quarterFor(p, mkOf(new Date(d)));
  RV.nextQuarter = (qq) => RV.quarter(RV.qKey(addMonths(qq.months[0], 3), (qq.n % 4) + 1));
  RV.prevQuarter = (qq) => RV.quarter(RV.qKey(addMonths(qq.months[0], -3), ((qq.n + 2) % 4) + 1));
  // the first month of the person's next quarter after a date: when a field change takes effect (never mid-quarter, RV-13)
  RV.nextQuarterStart = (p, d) => RV.nextQuarter(RV.quarterOn(p, d)).months[0];
  // the lock window: the quarter's marks open on the 1st of its last month and the self-mark and manager mark are due on
  // its last day (Jun–Aug: open 1 Aug, due 31 Aug)
  RV.marksOpen = (qq) => new Date(qq.end.getFullYear(), qq.end.getMonth(), 1, 6, 0);
  RV.lockBy = (qq) => new Date(qq.end.getFullYear(), qq.end.getMonth(), qq.end.getDate(), 23, 59);
  // upcoming · running (today is inside it, marks not open yet) · window (its last month: marks open) · closed (it has ended)
  RV.qState = (qq) => { const T = RM.TODAY; return qq.start > T ? 'upcoming' : T < RV.marksOpen(qq) ? 'running' : T <= RV.lockBy(qq) ? 'window' : 'closed'; };
  RV.runningQuarter = (p) => RV.quarterFor(p, RV.curMonth());
  // the person's latest quarter with its marks open: the running one in its last month, else the one before it
  RV.marksQuarter = (p) => { const r = RV.runningQuarter(p); return RM.TODAY >= RV.marksOpen(r) ? r : RV.prevQuarter(r); };
  /* review years: year n runs from the joining month + 12(n − 1) for twelve months; its appraisal is anniversary n, which
   * falls in the first month of the next year. label: 'Sep 2025 – Aug 2026' */
  RV.year = (p, n) => {
    const start = addMonths(joinMk(p), (n - 1) * 12); const end = addMonths(start, 11);
    return { n, start, end, months: RV.monthsBetween(start, end), quarters: [0, 1, 2, 3].map((i) => RV.quarter(RV.qKey(addMonths(start, i * 3), i + 1))), date: RV.appraisalDate(p, n), label: `${RV.monthLabel(start)} – ${RV.monthLabel(end)}` };
  };
  RV.yearOf = (p, mk) => RV.year(p, Math.floor(mDiff(joinMk(p), mk) / 12) + 1);
  RV.curYear = (p) => RV.yearOf(p, RV.curMonth());
  // the review year a quarter (by key) sits in
  RV.cycleOfKey = (p, key) => Math.floor(mDiff(joinMk(p), key.slice(0, 7)) / 12) + 1;

  /* ---------- templates (data.js: the four goal-sheet decks), by platform role ---------- */
  // Admin maps each designation to a platform role; the role carries the default template; an override can pick another (RV-12)
  RV.TEMPLATES = RM.GOALSHEETS;
  RV.ROLE_TEMPLATE = RM.ROLE_TEMPLATE;
  RV.sheet = (k) => RM.GOALSHEETS[k] || null;
  RV.templateName = (k) => (RV.sheet(k) || {}).name || '–';
  // reporting lines over time: before `until` the person reported to `rm` (the seed knows Tejas's move on 2 Apr 2026)
  RV.rmAt = (p, d) => { const h = (db().rmHistory || {})[p.id] || []; const t = new Date(d); const e = h.find((x) => t < new Date(x.until)); return e ? e.rm : p.rm; };
  RV.recordRmChange = (p, from, at) => { const h = db().rmHistory = db().rmHistory || {}; (h[p.id] = h[p.id] || []).push({ rm: from, until: iso(at) }); };
  RV.directsAt = (id, d) => db().people.filter((x) => x.status === 'Active' && !x.contractor && day(x.joined) <= day(d) && RV.rmAt(x, d) === id);
  // the role's template; a PO with direct reportees that day takes the PO form with reportees
  RV.defaultTemplate = (p, at) => { const k = RV.ROLE_TEMPLATE[p.role]; if (!k) return null; return k === 'PO' && RV.directsAt(p.id, at || RM.TODAY).length ? 'PO-R' : k; };
  RV.templateFor = (p, at) => { const o = db().overrides[p.id]; return o && new Date(o.at) <= new Date(at || RM.TODAY) ? o.template : RV.defaultTemplate(p, at); };
  // eligibility (RV-03): active, a platform role with a template, not the Practice Head, not Mapping pending
  RV.inCycles = (p) => !!p && RM.isEligible(p);
  RV.mappingPending = () => db().people.filter((p) => p.status === 'Active' && !p.contractor && p.mapPending);

  /* ---------- layer 1: the running record (a "form"), one per review year ---------- */
  // A form holds one review year: from its first month to the month before the anniversary month, so it holds the year's
  // four quarters. The next form starts on the 1st of the anniversary month, and the closed form is filed with that
  // anniversary's appraisal summary, whatever happens to it (made, waiting on a quarter's marks, or not made).
  // the first form starts in the joining month, or at go-live for someone already in the practice
  RV.firstFormStart = (p) => (joinMk(p) >= RV.GO_LIVE ? joinMk(p) : RV.GO_LIVE);
  // created on the DOJ (a joiner) or at go-live
  const firstOpened = (p) => (joinMk(p) >= RV.GO_LIVE ? at6(day(p.joined)) : at6(mkDate(RV.GO_LIVE)));
  const formId = (emp, start) => emp + '|' + start;
  const inForm = (f, mk) => mk >= f.start && (f.end == null || mk <= f.end);
  RV.form = (id) => db().forms[id] || null;
  RV.formsOf = (emp) => Object.values(db().forms).filter((f) => f.emp === emp).sort((a, b) => a.start.localeCompare(b.start));
  RV.formFor = (emp, mk) => RV.formsOf(emp).find((f) => inForm(f, mk)) || null;
  RV.curForm = (emp) => RV.formFor(emp, RV.curMonth());
  // a running form's months reach this month (a form starting next month shows its first); a closed form's, its
  // appraisal date's month
  RV.formMonths = (f) => RV.monthsBetween(f.start, f.end || (RV.curMonth() < f.start ? f.start : RV.curMonth()));
  RV.monthsSoFar = (f) => RV.formMonths(f).filter((mk) => mk <= RV.curMonth());
  RV.formLast = (f) => (f.end && f.end < RV.curMonth() ? f.end : RV.curMonth() < f.start ? f.start : RV.curMonth());
  RV.formSpan = (f) => (f.end ? `${RV.monthLabel(f.start)} – ${RV.monthLabel(f.end)}` : `since ${RV.monthLabel(f.start)}`);
  RV.formLabel = (f) => `Form ${f.n}`;
  // o: at (created), by, why, template (a renewed form continues the last one's template and its pending changes)
  RV.createForm = (p, start, n, o) => {
    o = o || {}; const id = formId(p.id, start); if (db().forms[id]) return db().forms[id];
    const created = o.at || firstOpened(p); const by = o.by; const why = o.why; const t = o.template || RV.templateFor(p, created); const s = RV.sheet(t);
    const f = db().forms[id] = { id, emp: p.id, n, start, end: null, template: t, templateVersion: s.version, designation: p.designation, created: iso(created), by: by || 'system', fieldLog: [], entries: {}, ev: {}, evKind: {}, gaps: {}, filledThrough: null, closedBy: null, closedAt: null };
    f.fieldLog.push({ section: 'base', action: 'created', effective: start, at: f.created, by: f.by, note: `${why || (joinMk(p) >= RV.GO_LIVE ? 'Created on the joining date' : 'First form from go-live')} · ${s.name}, version ${s.version}, for ${p.designation}` });
    return f;
  };
  // the first form (the system's job, never Admin's: RV-01); `from`: someone who becomes eligible later starts it that
  // month. Someone added with a joining date years back starts with the review year they're in now
  RV.ensureForms = (p, by, from) => {
    if (!RV.inCycles(p) || RV.formsOf(p.id).length) return [];
    const cur = RV.curYear(p).start; const start = [RV.firstFormStart(p), from, cur <= RV.curMonth() ? cur : null].filter(Boolean).sort().pop();
    const late = start > RV.firstFormStart(p);
    return [RV.createForm(p, start, 1, { at: late ? RV.stamp() : null, by, why: from && start === from && late ? 'First form once eligible' : late ? 'First form from this review year' : null })];
  };
  // the review year closes the running form with its last month; the next form starts on the 1st of the anniversary month
  // (start). Each form holds whole quarters, so a goal sheet's months are always on one form
  RV.renewForm = (p, start, at) => {
    const f = RV.formsOf(p.id).find((x) => x.end == null); if (!f || start <= f.start) return null;
    const last = addMonths(start, -1);
    f.end = last; f.closedAt = iso(at);
    f.fieldLog.push({ section: 'base', action: 'closed', effective: last, at: iso(at), by: 'system', note: `Closed with the review year; ${RV.monthLabel(last)} is its last month` });
    const nf = RV.createForm(p, start, f.n + 1, { at: new Date(at), by: 'system', why: `Started with the review year from ${RV.monthLabel(start)}`, template: RV.templateAt(f, start) });
    // changes not yet in effect (fields from the next quarter) carry over, so they still start when they were due
    f.fieldLog.filter((e) => e.section !== 'base' && e.effective > start).forEach((e) => nf.fieldLog.push(clone(e)));
    RV.recsOf(p.id).forEach((r) => { r.formRefs = [...new Set(RV.recMonths(r).map((x) => x.f && x.f.id).filter(Boolean))]; });
    if (!RV._db) audit('system', 'Started a new review form', p.name, `${RV.formLabel(f)} · ${RV.formSpan(f)}`, `${RV.formLabel(nf)} · from ${RV.monthLabel(nf.start)}`, 'A new review year');
    return f;
  };
  // current: holds this month (a closed form's last month included) · upcoming: starts next month · closed: ended before this month
  RV.formState = (f) => (f.start > RV.curMonth() ? 'upcoming' : f.end == null || f.end >= RV.curMonth() ? 'current' : 'closed');
  RV.formClosedAt = (f) => f.closedAt;

  /* ---------- field changes during a form (§5.5): new fields from their effective month on ---------- */
  RV.SECTIONS = {
    reportees: { key: 'reportees', name: 'Reportee management', why: 'Gained a reportee', goals: ['Monthly Status Reviews – Reporting Team Member', 'Quarterly Goal Reviews – Reporting Team Member'] },
  };
  RV.hasSection = (f, s, mk) => f.fieldLog.some((e) => e.section === s && e.action === 'added' && e.effective <= mk);
  RV.sectionsFor = (f, mk) => Object.keys(RV.SECTIONS).filter((k) => RV.hasSection(f, k, mk));
  RV.addSection = (f, section, effective, at, by, note) => {
    if (RV.hasSection(f, section, '9999-12')) return false;
    f.fieldLog.push({ section, action: 'added', effective, at: iso(at), by, note }); return true;
  };
  // the template a month's fields come from: the form's, then any change effective by then; a PO form that has gained the
  // reportee fields carries the reportee goals (the PO form with reportees) from that month on
  RV.templateAt = (f, mk) => {
    let t = f.template;
    f.fieldLog.filter((e) => e.section === 'template' && e.effective <= mk).forEach((e) => { t = e.template; });
    return t === 'PO' && RV.hasSection(f, 'reportees', mk) ? 'PO-R' : t;
  };
  RV.sheetAt = (f, mk) => RV.sheet(RV.templateAt(f, mk));
  // a PO who gains a first reportee keeps their form: the reportee fields are added from the first month of the next quarter
  const runningForm = (p) => RV.formsOf(p.id).find((x) => x.end == null) || RV.curForm(p.id);
  RV.syncReporteeFields = (p, at, by, why) => {
    if (!RV.inCycles(p)) return null; const eff = RV.nextQuarterStart(p, at); const f = RV.formFor(p.id, eff) || runningForm(p); if (!f) return null;
    if (RV.templateAt(f, eff) !== 'PO' || !RV.addSection(f, 'reportees', eff < f.start ? f.start : eff, at, by, why)) return null;
    return eff;
  };
  // an override (or its removal) changes the template from the next quarter; past months and quarters keep theirs
  RV.changeTemplate = (p, key, at, by, note) => {
    const eff = RV.nextQuarterStart(p, at); const f = RV.formFor(p.id, eff) || runningForm(p); if (!f) return null;
    f.fieldLog.push({ section: 'template', action: 'changed', template: key, effective: eff < f.start ? f.start : eff, at: iso(at), by, note }); return { eff };
  };

  /* ---------- a month's entry: the employee–manager monthly review (the evidence runs across the form, below) ---------- */
  RV.CHECKIN = {
    emp: [
      { k: 'work', label: 'Work and progress this month', required: true },
      { k: 'achievements', label: 'Achievements' },
      { k: 'projects', label: 'Projects or features discussed' },
      { k: 'challenges', label: 'Challenges, risks and dependencies' },
      { k: 'ppt', label: 'Monthly review deck (SharePoint link)', type: 'url' }],
    mgr: [
      { k: 'feedback', label: 'Feedback and suggestions', required: true },
      { k: 'followups', label: 'Follow-up actions' },
      { k: 'date', label: 'Meeting date', type: 'date', required: true },
      { k: 'status', label: 'Meeting', type: 'select', opts: ['Scheduled', 'Held', 'Not held'], required: true }],
  };
  // an employee's part is done once the month's progress is written; the manager's once the feedback, date and a held discussion are
  RV.partDone = { emp: (d) => !!d && has(d.work), mgr: (d) => !!d && has(d.feedback) && !!d.date && d.status === 'Held' };
  // the discussion date sits in the monthly review's month; one that was held (or missed) can't be dated after today
  RV.discussionError = (mk, d) => {
    if (!d || !d.date) return null; const t = new Date(d.date);
    if (mkOf(t) !== mk) return `The meeting date must be in ${RV.monthLabel(mk)}.`;
    if (d.status && d.status !== 'Scheduled' && day(t) > day(RM.TODAY)) return 'A meeting that was held or didn’t happen can’t be dated after today. Set it to Scheduled, or change the date.';
    return null;
  };
  const seedCache = new Map();
  // the prototype's sample entry for a month before today: the monthly review's two parts and the evidence added that month
  const seeded = (f, mk) => {
    const k = f.id + mk;
    if (!seedCache.has(k)) { const s = RV.seedMonth(q.person(f.emp) || db().people.find((x) => x.id === f.emp), f, mk); const ev = s.emp.ev || {}; const emp = Object.assign({}, s.emp); delete emp.ev; seedCache.set(k, { emp, mgr: s.mgr, ev }); }
    return seedCache.get(k);
  };
  // a month's entry: what was saved, or the sample entry for months before today. state: future · open (this month) ·
  // complete · incomplete (a past month not finished by month end, RV-06)
  RV.month = (emp, mk) => {
    const f = RV.formFor(emp, mk); if (!f) return null;
    const ed = f.entries[mk] || {}; let e = ed.emp || null; let m = ed.mgr || null; let sample = false;
    if (f.filledThrough && mk <= f.filledThrough) {
      const s = seeded(f, mk); const gap = f.gaps[mk];
      if (!ed.emp && gap !== 'emp' && gap !== 'both') { e = s.emp; sample = true; }
      if (!ed.mgr && gap !== 'mgr' && gap !== 'both') { m = s.mgr; sample = true; }
    }
    const empDone = RV.partDone.emp(e); const mgrDone = RV.partDone.mgr(m); const cur = RV.curMonth();
    const state = mk > cur ? 'future' : empDone && mgrDone ? 'complete' : mk === cur ? 'open' : 'incomplete';
    return { mk, f, emp: e, mgr: m, empDone, mgrDone, complete: empDone && mgrDone, state, sample, template: RV.templateAt(f, mk) };
  };
  RV.monthNote = (m) => {
    if (!m) return '';
    if (m.state === 'complete') return 'Done';
    if (m.state === 'future') return 'Not started';
    const miss = !m.empDone && !m.mgrDone ? 'progress and feedback to add' : !m.empDone ? 'progress to add' : 'feedback to add';
    if (m.state === 'open') return 'Open until ' + RM.fmt.date(RV.monthEnd(m.mk), { noYear: true }) + ' · ' + miss;
    return 'Missed · ' + (!m.empDone && !m.mgrDone ? 'nothing added' : !m.empDone ? 'no progress added' : 'no feedback added');
  };
  RV.emptyPart = (part) => (part === 'emp' ? { work: '', achievements: '', projects: '', challenges: '', ppt: '' } : { feedback: '', followups: '', date: null, status: '' });
  // the entry is made within its own month (RV-06): the employee writes their part, the current Reporting Manager theirs
  RV.canEditEntry = (me, emp, mk, part) => {
    if (!me || mk !== RV.curMonth()) return false; const p = q.person(emp); if (!p || p.status !== 'Active' || !RV.formFor(emp, mk)) return false;
    return part === 'emp' ? me.id === emp : me.id === p.rm;
  };
  RV.saveEntry = (emp, mk, part, data, by) => {
    const f = RV.formFor(emp, mk); const e = f.entries[mk] = f.entries[mk] || {}; const first = !e[part];
    e[part] = Object.assign(clone(data), { savedAt: iso(RV.stamp()), by });
    return first;
  };
  // a part has content when any of its fields does
  RV.partHasContent = (part, d) => !!d && RV.CHECKIN[part].some((c) => has(d[c.k]));
  // past months of a form not finished by their month end
  RV.monthsIncomplete = (emp, f) => { f = f || RV.curForm(emp); return f ? RV.monthsSoFar(f).filter((mk) => mk < RV.curMonth() && RV.month(emp, mk).state === 'incomplete') : []; };

  /* ---------- the form's evidence: one running table per evidence form, each row dated to the month it was added ---------- */
  // A table that lists fixed activities in the deck (PI planning, sprint planning, retro…) becomes a pick-list column. Sample
  // rows stand in for the months before today (the prototype's data); saved rows are what people added here.
  const META = ['mk', 'at', 'by', 'sample'];
  const bare = (r) => { const o = Object.assign({}, r); META.forEach((k) => delete o[k]); return o; };
  // a row counts once it has something beyond its activity name and that activity's usual values (filled in for it)
  RV.evBlank = (def, r) => {
    if (!r) return true; const lk = def && def.fixed ? def.cols[0].k : null; const fx = lk ? def.fixed.find((x) => x[lk] === r[lk]) || {} : {};
    return !Object.keys(bare(r)).some((k) => k !== lk && has(r[k]) && r[k] !== fx[k]);
  };
  const sampleRows = (f, mk, id) => {
    if (!f.filledThrough || mk > f.filledThrough || mk < f.start || ['emp', 'both'].includes(f.gaps[mk])) return [];
    const def = RV.sheetAt(f, mk).forms[id]; const rows = seeded(f, mk).ev[id] || [];
    // a fixed-activity row counts when the month added something to it
    return rows.map((r, i) => (RM.gsBlankRow(r) ? null : def && def.fixed ? Object.assign({}, def.fixed[i], r) : r)).filter(Boolean).map((r) => Object.assign({}, r, { mk, sample: true }));
  };
  // every row of a table on the form, oldest first; with mk, only that month's
  RV.evRows = (f, id, mk) => {
    const out = []; (mk ? [mk] : RV.monthsSoFar(f)).forEach((m) => out.push(...sampleRows(f, m, id)));
    (f.ev[id] || []).forEach((r) => { if (!mk || r.mk === mk) out.push(r); });
    return out.sort((x, y) => x.mk.localeCompare(y.mk));
  };
  // the employee adds rows to their running form; a row can be changed until its month ends (RV-06)
  RV.canEditEvidence = (me, f) => { if (!me || !f || me.id !== f.emp) return false; const p = q.person(f.emp); return !!p && p.status === 'Active' && RV.formFor(f.emp, RV.curMonth()) === f; };
  RV.saveEvidence = (f, mk, tables, evKind, by) => {
    const at = iso(RV.stamp()); const sheet = RV.sheetAt(f, mk);
    Object.keys(tables || {}).forEach((id) => {
      const rows = (tables[id] || []).filter((r) => !RV.evBlank(sheet.forms[id], r)).map((r) => Object.assign(clone(bare(r)), { mk, at, by }));
      f.ev[id] = (f.ev[id] || []).filter((r) => r.mk !== mk).concat(rows); if (!f.ev[id].length) delete f.ev[id];
    });
    if (evKind) f.evKind = Object.assign({}, f.evKind, evKind);
  };

  /* ---------- layer 2: the Quarterly Goal Sheet ---------- */
  RV.recId = (emp, key) => `QR-${key}-${emp}`;
  RV.recs = () => db().quarters;
  RV.rec = (id) => db().quarters.find((r) => r.id === id) || null;
  RV.recFor = (emp, key) => db().quarters.find((r) => r.emp === emp && r.key === key) || null;
  RV.recsOf = (emp) => db().quarters.filter((r) => r.emp === emp).sort((a, b) => a.key.localeCompare(b.key));
  RV.recsIn = (key) => db().quarters.filter((r) => r.key === key);
  // one of the person's own quarters has a goal sheet once it starts at go-live or later. It starts in their joining month
  // at the earliest, so there's no joining mid-quarter: the joining quarter is always a full one
  RV.participation = (p, qq) => (qq.months[0] < RV.GO_LIVE || qq.months[0] < joinMk(p) || (qq.months[0] !== RV.quarterFor(p, qq.months[0]).months[0]) ? null : { partial: false, from: qq.months[0] });
  // the quarter's months, each read from the form it sits on (RV-29); a year's form holds whole quarters
  RV.recMonths = (rec) => RV.quarter(rec.key).months.filter((mk) => mk >= rec.from).map((mk) => ({ mk, f: RV.formFor(rec.emp, mk) }));
  RV.isQ4 = (rec) => RV.quarter(rec.key).n === 4;
  RV.sheetOf = (rec) => RV.sheet(rec.template);
  // every goal is marked out of its own weight (RV-07); a yearly goal only in Q4 (RV-08, none today)
  RV.scorable = (rec) => RV.sheetOf(rec).goals.filter((g) => !g.yearly || RV.isQ4(rec)).map((g) => g.i);
  RV.goalMax = (rec, i) => RV.sheetOf(rec).goals[i].weight;
  RV.quarterMax = (rec) => RM.gsQuarterMax(RV.sheetOf(rec), RV.isQ4(rec));
  RV.missing = (rec, scores) => RV.scorable(rec).filter((i) => scores[i] == null);
  RV.total = (rec, scores) => RV.scorable(rec).reduce((a, i) => a + (scores[i] == null ? 0 : +scores[i]), 0);
  // a mark is the total of the goal scores (RV-07), out of the quarter's applicable weight
  RV.markOf = (rec, scores) => (!scores || RV.missing(rec, scores).length ? null : RV.total(rec, scores));
  // aggregates average each quarter's mark as a share of its applicable weight (the PRD's assumption, pending sign-off)
  RV.pct = (rec, v) => (v == null ? null : round1((v / RV.quarterMax(rec)) * 100));
  // one status while the sheet is with its reviewer: the reviewer's saved draft marks don't change it
  RV.STATUSES = ['Not Started', 'Draft', 'Changes Requested', 'With Reviewer', 'Locked'];
  RV.isLocked = (rec) => rec.status === 'Locked';
  RV.lockedBy = (rec, at) => rec.status === 'Locked' && new Date(rec.lockedAt) <= new Date(at);
  RV.needsSelf = (rec) => ['Not Started', 'Draft', 'Changes Requested'].includes(rec.status);
  RV.needsMgr = (rec) => rec.status === 'With Reviewer';
  RV.lockedInWindow = (rec) => RV.lockedBy(rec, RV.lockBy(RV.quarter(rec.key)));
  // not locked by the end of the lock window: marked Incomplete and counted against completion (RV-19); it can still lock late
  RV.incomplete = (rec) => !RV.lockedInWindow(rec) && RM.TODAY > RV.lockBy(RV.quarter(rec.key));
  RV.overdue = (rec) => RV.incomplete(rec) && !RV.isLocked(rec);
  RV.lateLocked = (rec) => RV.isLocked(rec) && !RV.lockedInWindow(rec);
  RV.due = (rec) => {
    const lb = RV.lockBy(RV.quarter(rec.key));
    if (RV.isLocked(rec)) return { over: false, label: (RV.lateLocked(rec) ? 'Final, late · ' : 'Final ') + RM.fmt.date(rec.lockedAt, { noYear: true }) };
    const d = RM.dayDiff(RM.TODAY, lb);
    if (d < 0) return { over: true, days: d, label: 'Was due ' + RM.fmt.date(lb, { noYear: true }) };
    return { over: false, soon: d <= 5, days: d, label: d === 0 ? 'Due today' : 'Due ' + RM.fmt.date(lb, { noYear: true }) + ' · ' + d + (d === 1 ? ' day' : ' days') };
  };
  const active = (emp) => (q.person(emp) || {}).status === 'Active';
  RV.canSelf = (me, rec) => !!me && me.id === rec.emp && RV.needsSelf(rec) && active(rec.emp);
  RV.canMgr = (me, rec) => !!me && me.id === rec.reviewer && RV.needsMgr(rec) && active(rec.emp);
  RV.blankScores = (sheet) => sheet.goals.map(() => null);
  // the self-assessment a viewer works from: the employee's own draft while changes are requested, else the sheet's
  RV.selfWorkOf = (viewer, rec) => (viewer && viewer.id === rec.emp && rec.selfDraft ? rec.selfDraft : rec.self);
  RV.newRecord = (p, qq, part, at) => {
    const from = part.from; const f = RV.formFor(p.id, from);
    // marked against the template version of the form holding the quarter's first month (the PRD's assumption)
    const t = f ? RV.templateAt(f, from) : RV.templateFor(p, at); const s = RV.sheet(t);
    const formRefs = [...new Set(qq.months.filter((mk) => mk >= from).map((mk) => (RV.formFor(p.id, mk) || {}).id).filter(Boolean))];
    const reviewer = RV.rmAt(p, at || qq.end); const rv = q.person(reviewer) || db().people.find((x) => x.id === reviewer) || {};
    // cycle: the review year it's in (its appraisal); fy: the financial year it ends in (practice-wide figures)
    const rec = {
      id: RV.recId(p.id, qq.key), emp: p.id, key: qq.key, cycle: RV.cycleOfKey(p, qq.key), fy: qq.fy, from, template: t, templateVersion: f ? f.templateVersion : s.version, formRefs, reviewer, partial: !!part.partial, status: 'Not Started',
      self: { scores: RV.blankScores(s), notes: '', valueAdds: [] }, mgr: { scores: RV.blankScores(s), notes: '', goalNotes: {} },
      selfMark: null, mgrMark: null, selfAt: null, mgrAt: null, lockedAt: null, cycleUsed: null, version: 1, corrections: [], selfVersions: [], changeNote: null,
      history: [{ at: iso(at), by: 'system', action: 'Goal sheet opened', note: `${qq.span} · reviewer ${rv.name || '–'}` }],
    };
    db().quarters.push(rec); return rec;
  };
  const personOf = (emp) => q.person(emp) || db().people.find((x) => x.id === emp) || null;
  // the review year so far (this one by default): the average self and manager mark (as % of weight) over its final quarters only
  RV.ytd = (emp, cycle) => {
    const p = personOf(emp); const c = cycle || (p ? RV.curYear(p).n : null);
    const list = RV.recsOf(emp).filter((r) => r.cycle === c && RV.isLocked(r));
    return { n: list.length, cycle: c, self: avg(list.map((r) => RV.pct(r, r.selfMark)).filter((v) => v != null)), mgr: avg(list.map((r) => RV.pct(r, r.mgrMark)).filter((v) => v != null)), keys: list.map((r) => r.key) };
  };

  /* ---------- marks to rating: a quarter's mark (as % of its weight) on the 5-point scale ----------
   * 95+ is 5 only for someone with a financial target they have met; otherwise 95+ is 4.6 to 4.9. 90–94 is 4.3 to 4.5,
   * 80–89 4 to 4.2, 70–79 3.5 to 3.9, below 70 3.2 and below. Within a band the rating rises evenly with the mark, to one
   * decimal; below 70 it runs from 1 at 0 to 3.2 at 69, as the table gives no floor. */
  RV.RATING_BANDS = [
    { min: 95, lo: 5, hi: 5, label: 'Exceptional Performance', inc: '14% or higher', target: true },
    { min: 95, top: 100, lo: 4.6, hi: 4.9, label: 'Outstanding Performance', inc: '12% to 14%' },
    { min: 90, top: 94, lo: 4.3, hi: 4.5, label: 'Exceeds Expectations', inc: '10% to 12%' },
    { min: 80, top: 89, lo: 4, hi: 4.2, label: 'Strong Performance', inc: '8% to 10%' },
    { min: 70, top: 79, lo: 3.5, hi: 3.9, label: 'Meets Expectations', inc: '8% and below' },
    { min: 0, top: 69, lo: 1, hi: 3.2, label: 'Performance Improvement Required', inc: 'PIP' },
  ];
  RV.rating = (pct, targetMet) => {
    if (pct == null) return null;
    const b = RV.RATING_BANDS.find((x) => pct >= x.min && (!x.target || targetMet));
    return b.top == null ? b.lo : round1(b.lo + Math.min(1, (pct - b.min) / (b.top - b.min)) * (b.hi - b.lo));
  };
  // the band an (averaged) rating sits in; an average between two bands' ranges belongs to the lower one
  RV.ratingBand = (v) => (v == null ? null : RV.RATING_BANDS.find((b) => v >= b.lo) || RV.RATING_BANDS[RV.RATING_BANDS.length - 1]);
  // a financial year's average rating, self and manager: each final quarter that ended in it, its mark as a rating, averaged
  // (quarters are each person's own, so the practice compares years by the financial year they end in). Financial targets
  // are only known for the current year (RM.finTargetMet, from Financial Performance), so an earlier year's 95+ is at most 4.9
  RV.fyRating = (emp, fy) => {
    const list = RV.recsOf(emp).filter((r) => r.fy === fy && RV.isLocked(r));
    let met; const hit = () => (met == null ? (met = fy === RV.curFy() && !!(RM.finTargetMet && RM.finTargetMet(emp))) : met);
    const rt = (r, k) => { const v = RV.pct(r, r[k]); return v == null ? null : RV.rating(v, v >= 95 && hit()); };
    const quarters = list.map((r) => ({ key: r.key, self: rt(r, 'selfMark'), mgr: rt(r, 'mgrMark') })).sort((x, y) => (x.key < y.key ? -1 : 1));
    const of = (k) => avg(quarters.map((x) => x[k]).filter((v) => v != null));
    return { n: list.length, self: of('self'), mgr: of('mgr'), quarters, keys: quarters.map((x) => x.key) };
  };

  // the demo's clock: actions are stamped a minute apart after "now", so their order holds
  let tick = 0; RV.stamp = () => new Date(RM.TODAY.getTime() + (++tick) * 60000);
  const audit = (by, action, entity, prev, next, note) => db().audit.unshift({ at: iso(RV.stamp()), by, action, entity, prev, next, note });
  const who = (id) => (q.person(id) || {}).name || id;
  const recEntity = (rec) => `${RV.quarter(rec.key).label} · ${who(rec.emp)}`;
  RV.recEntity = recEntity;
  const out = (rec, v) => (v == null ? '–' : `${v} / ${RV.quarterMax(rec)}`);
  RV.markText = out;
  RV.fmtPct = (v) => (v == null ? '–' : (Number.isInteger(v) ? v : v.toFixed(1)) + '%');

  // while changes are requested the employee's saved edits are a draft of their own: the reviewer keeps seeing the
  // submission they sent back until the employee resubmits
  RV.saveSelf = (rec, work, by) => {
    const was = rec.status;
    if (was === 'Changes Requested') rec.selfDraft = clone(work); else rec.self = clone(work);
    if (was === 'Not Started') rec.status = 'Draft';
    rec.history.push({ at: iso(RV.stamp()), by, action: was === 'Not Started' ? 'Self-assessment started' : 'Self-assessment draft saved' });
  };
  RV.submitSelf = (rec, work, by) => {
    const again = rec.status === 'Changes Requested';
    rec.self = clone(work); delete rec.selfDraft; rec.selfMark = RV.markOf(rec, rec.self.scores); rec.selfAt = iso(RV.stamp()); rec.status = 'With Reviewer';
    rec.history.push({ at: rec.selfAt, by, action: again ? 'Self-mark resubmitted' : 'Self-mark submitted', note: `Self-mark ${out(rec, rec.selfMark)}${again ? ` · the earlier submission is kept (version ${rec.selfVersions.length})` : ''}` });
    audit(by, again ? 'Resubmitted self-mark' : 'Submitted self-mark', recEntity(rec), again ? 'Changes requested' : 'Open', 'With reviewer');
  };
  // the reviewer sends a submitted self-mark back: the submission is kept as it was (RV-17) and the employee edits a copy
  RV.requestChanges = (rec, note, by) => {
    rec.selfVersions.push({ version: rec.selfVersions.length + 1, at: rec.selfAt, selfMark: rec.selfMark, scores: clone(rec.self.scores), notes: rec.self.notes, valueAdds: clone(rec.self.valueAdds || []) });
    const at = iso(RV.stamp()); rec.status = 'Changes Requested'; rec.changeNote = { at, by, note };
    rec.history.push({ at, by, action: 'Changes requested', note });
    audit(by, 'Requested changes to self-mark', recEntity(rec), 'With reviewer', 'Changes requested', note);
  };
  // the reviewer's draft: kept on the sheet, the status stays With Reviewer until they lock it
  RV.saveMgr = (rec, work, by) => {
    rec.mgr = clone(work);
    rec.history.push({ at: iso(RV.stamp()), by, action: 'Manager draft saved' });
  };
  // completing the manager mark locks the goal sheet (RV-15): it is final, part of the record, available to the next report
  RV.lockWithMgr = (rec, work, by) => {
    rec.mgr = clone(work); rec.mgrMark = RV.markOf(rec, rec.mgr.scores); rec.mgrAt = iso(RV.stamp()); rec.lockedAt = rec.mgrAt; rec.status = 'Locked';
    const late = RV.lateLocked(rec);
    rec.history.push({ at: rec.lockedAt, by, action: late ? 'Manager mark submitted · locked after the lock window' : 'Manager mark submitted · goal sheet locked', note: `Manager mark ${out(rec, rec.mgrMark)} · self ${out(rec, rec.selfMark)}${late ? ' · still counted Incomplete for completion' : ''}` });
    audit(by, 'Locked quarterly goal sheet', recEntity(rec), 'With reviewer', 'Locked', `Manager mark ${out(rec, rec.mgrMark)}${late ? ' · after the lock window' : ''}`);
    RV.afterLock(rec, by);
  };
  // a report waiting on this quarter generates now
  RV.afterLock = (rec, by) => RV.resolveReports(rec.emp, by);
  RV.reassign = (rec, to, reason, by) => {
    const from = rec.reviewer; if (!rec.originalReviewer) rec.originalReviewer = from; rec.reviewer = to;
    rec.history.push({ at: iso(RV.stamp()), by, action: 'Reviewer reassigned', note: `${who(from)} → ${who(to)} · ${reason}` });
    audit(by, 'Reassigned quarterly goal sheet', recEntity(rec), who(from), who(to), reason);
  };
  // an authorized admin correction to a locked goal sheet: audited and versioned; reports built on it get a new version
  RV.correct = (rec, selfScores, mgrScores, reason, by) => {
    const prev = { selfMark: rec.selfMark, mgrMark: rec.mgrMark };
    rec.self.scores = selfScores.slice(); rec.mgr.scores = mgrScores.slice();
    rec.selfMark = RV.markOf(rec, rec.self.scores); rec.mgrMark = RV.markOf(rec, rec.mgr.scores); rec.version += 1;
    const at = iso(RV.stamp());
    rec.corrections.push({ at, by, reason, version: rec.version, prev, next: { selfMark: rec.selfMark, mgrMark: rec.mgrMark } });
    rec.history.push({ at, by, action: `Admin correction · version ${rec.version}`, note: `${reason} · self ${out(rec, prev.selfMark)} → ${out(rec, rec.selfMark)} · manager ${out(rec, prev.mgrMark)} → ${out(rec, rec.mgrMark)}` });
    audit(by, 'Corrected locked goal sheet', recEntity(rec), `Self ${out(rec, prev.selfMark)} · manager ${out(rec, prev.mgrMark)}`, `Self ${out(rec, rec.selfMark)} · manager ${out(rec, rec.mgrMark)}`, reason);
    RV.appraisalsOf(rec.emp).filter((a) => a.status === 'Generated' && a.quarterKeys.includes(rec.key)).forEach((a) => RV.reissueAppraisal(a, `Correction to ${RV.quarter(rec.key).short}: ${reason}`, by));
  };

  /* ---------- layer 3: the Pre Appraisal Report ---------- */
  // cycle N is on DOJ + N years; a 29 Feb DOJ uses 28 Feb in non-leap years
  RV.appraisalDate = (p, n) => { const j = new Date(p.joined); const y = j.getFullYear() + n; const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; return new Date(y, j.getMonth(), j.getMonth() === 1 && j.getDate() === 29 && !leap ? 28 : j.getDate()); };
  RV.nextCycle = (p) => { let n = 1; while (day(RV.appraisalDate(p, n)) <= day(RM.TODAY)) n++; return { cycle: n, date: RV.appraisalDate(p, n) }; };
  RV.appraisalsOf = (emp) => db().appraisals.filter((a) => a.emp === emp).sort((a, b) => a.cycle - b.cycle);
  RV.appraisal = (id) => db().appraisals.find((a) => a.id === id) || null;
  RV.appraisalFor = (emp, cycle) => db().appraisals.find((a) => a.emp === emp && a.cycle === cycle) || null;
  /* The year's summary (§5.13, with quarters that follow the joining date), pure so the worked examples can be checked
   * against it. recs: the review year's goal sheets as { key, end, lockBy, status, lockedAt }. It's made on the anniversary
   * A from the year's quarters: all four, or three in the year reviews started here; fewer make none. Q4 ends the month
   * before A's month and its marks are due on its last day, so the summary is created on A if they're all final by then,
   * otherwise as soon as the last one is (until then it waits on them, as their marks were missed). A quarter whose marks were missed holds it
   * too; a quarter is never skipped and never moves to another year. `now` is when the rule runs (A, or later). */
  RV.selectYear = (recs, A, now) => {
    const at = new Date(Math.max(new Date(A).getTime(), new Date(now || A).getTime())); const by = (r) => r.status === 'Locked' && new Date(r.lockedAt) <= at;
    const window = recs.slice().sort((x, y) => x.end - y.end); const waiting = window.filter((r) => !by(r));
    const late = window.filter((r) => by(r) && new Date(r.lockedAt) > new Date(A));
    const kind = window.length < 3 ? 'short' : waiting.length ? 'blocked' : window.length === 3 ? 'partial' : 'full';
    return { window, waiting, late, kind };
  };
  const recLike = (r) => ({ id: r.id, key: r.key, end: RV.quarter(r.key).end, lockBy: RV.lockBy(RV.quarter(r.key)), status: r.status, lockedAt: r.lockedAt, cycleUsed: r.cycleUsed, partial: r.partial });
  // the year's quarters that have goal sheets (or will have, once they end)
  RV.yearKeys = (p, n) => RV.year(p, n).quarters.filter((qq) => RV.participation(p, qq)).map((qq) => qq.key);
  // the snapshot: the selected quarters' marks and details, the months they hold (sliced from each month's form), two averages
  const quarterSnap = (r) => ({ key: r.key, template: r.template, templateVersion: r.templateVersion, max: RV.quarterMax(r), from: r.from, formRefs: r.formRefs.slice(),
    selfMark: r.selfMark, mgrMark: r.mgrMark, selfPct: RV.pct(r, r.selfMark), mgrPct: RV.pct(r, r.mgrMark), selfAt: r.selfAt, lockedAt: r.lockedAt, late: RV.lateLocked(r),
    partial: r.partial, reviewer: r.reviewer, version: r.version, self: clone(r.self.scores), mgr: clone(r.mgr.scores), selfNotes: r.self.notes || '', mgrNotes: r.mgr.notes || '', goalNotes: clone(r.mgr.goalNotes || {}) });
  // the months: the year's record (its monthly reviews and evidence), else the quarters' own months
  const appraisalSnap = (p, recs, a) => {
    const rf = a && a.recordId ? RV.form(a.recordId) : null; const quarters = recs.map(quarterSnap);
    const months = rf ? RV.formMonths(rf).map((mk) => ({ mk, form: rf.id })) : recs.flatMap((r) => RV.recMonths(r).map((x) => ({ mk: x.mk, form: x.f ? x.f.id : null })));
    // no combined score, no band, no weighting between the two (RV-24)
    return { name: p.name, designation: p.designation, quarters, months, formRefs: [...new Set(months.map((m) => m.form).filter(Boolean))],
      selfAgg: avg(quarters.map((x) => x.selfPct).filter((v) => v != null)), mgrAgg: avg(quarters.map((x) => x.mgrPct).filter((v) => v != null)) };
  };
  // on the appraisal date (and again whenever a quarter it waits on locks): generate, generate as a Partial cycle, or not.
  // The year's record, which closed with the year, is filed with the appraisal whatever the outcome
  RV.runAppraisal = (p, cycle, A, now, by) => {
    const id = `AR-${p.id}-${cycle}`; let a = RV.appraisal(id);
    if (a && a.status === 'Generated') return a;
    const yr = RV.year(p, cycle);
    if (!a) {
      const rf = RV.formFor(p.id, yr.end);
      a = { id, emp: p.id, cycle, date: iso(A), yearStart: yr.start, yearEnd: yr.end, status: null, reason: null, flags: [], quarterKeys: [], blocking: [], available: [], version: 0, versions: [], recordId: rf ? rf.id : null }; db().appraisals.push(a);
    }
    const all = RV.yearKeys(p, cycle).map((k) => RV.recFor(p.id, k)).filter(Boolean);
    const sel = RV.selectYear(all.map(recLike), A, now); by = by || 'system'; const at = iso(now || A);
    a.blocking = sel.waiting.map((r) => r.key); a.available = sel.window.filter((r) => !sel.waiting.includes(r)).map((r) => r.key); a.checkedAt = at;
    if (sel.kind === 'blocked' || sel.kind === 'short') {
      const first = a.status == null; a.status = 'Not generated'; a.reason = sel.kind;
      if (first && !RV._db) audit(by, 'Pre Appraisal Report not generated', `${p.name} · cycle ${cycle}`, '–', sel.kind === 'blocked' ? 'Waiting on ' + a.blocking.map((k) => RV.quarter(k).short).join(', ') : `${sel.window.length} ${sel.window.length === 1 ? 'quarter' : 'quarters'} in the year`);
      return a;
    }
    const recs = sel.window.map((r) => RV.rec(r.id)); const flags = [];
    if (sel.kind === 'partial') flags.push('PARTIAL_CYCLE');
    const waited = a.status === 'Not generated' && a.reason === 'blocked';
    a.status = 'Generated'; a.reason = null; a.blocking = []; a.flags = flags; a.quarterKeys = recs.map((r) => r.key); a.fyRefs = [...new Set(recs.map((r) => r.fy))];
    // late: quarters made final after the anniversary (the summary waited for them); missed: final after their own due date
    a.late = sel.late.map((r) => r.key); a.missed = recs.filter(RV.lateLocked).map((r) => r.key);
    a.snapshot = appraisalSnap(p, recs, a); a.formRefs = a.snapshot.formRefs.slice(); a.version = 1; a.generatedAt = at; a.by = by;
    const why = waited ? `Generated once ${a.late.map((k) => RV.quarter(k).short).join(', ')} locked` : 'Generated on the appraisal date';
    a.versions = [{ version: 1, at, by, reason: why, snapshot: a.snapshot }];
    recs.forEach((r) => { r.cycleUsed = a.cycle; r.history.push({ at, by: 'system', action: `Used in the cycle ${a.cycle} Pre Appraisal Report` }); });
    if (!RV._db) audit(by, 'Generated Pre Appraisal Report', `${p.name} · cycle ${a.cycle}`, waited ? 'Not generated' : '–', `${recs.length} quarters${flags.includes('PARTIAL_CYCLE') ? ' · partial cycle' : ''}`, waited ? why : undefined);
    return a;
  };
  // a report waiting on a quarter re-runs when that quarter locks
  RV.resolveReports = (emp, by) => {
    const p = personOf(emp); if (!p) return [];
    return RV.appraisalsOf(emp).filter((a) => a.status === 'Not generated' && a.reason === 'blocked').map((a) => RV.runAppraisal(p, a.cycle, new Date(a.date), RV.stamp(), by || 'system')).filter((a) => a.status === 'Generated');
  };
  RV.reissueAppraisal = (a, reason, by) => {
    const recs = a.quarterKeys.map((k) => RV.recFor(a.emp, k)); const p = q.person(a.emp); a.version += 1; a.snapshot = appraisalSnap(p, recs, a); const at = iso(RV.stamp());
    a.versions.push({ version: a.version, at, by, reason, snapshot: a.snapshot });
    audit(by, 'New version of Pre Appraisal Report', `${who(a.emp)} · cycle ${a.cycle}`, 'Version ' + (a.version - 1), 'Version ' + a.version, reason);
  };
  // what the next report is expected to cover: the quarters of the year that ends before the next anniversary (goal
  // sheets so far, and the ones still to open). blocking: marks already missed; after: due after the anniversary (none
  // while every quarter's marks are due on its last day, Q4's included)
  RV.preview = (p) => {
    const nx = RV.nextCycle(p); const yr = RV.year(p, nx.cycle); const A = day(nx.date);
    const window = RV.yearKeys(p, nx.cycle).map((k) => { const r = RV.recFor(p.id, k); const qq = RV.quarter(k); return r ? recLike(r) : { key: k, end: qq.end, lockBy: RV.lockBy(qq), partial: false, status: 'Upcoming', expected: true }; });
    const locked = (r) => r.status === 'Locked';
    const blocking = window.filter((r) => !locked(r) && !r.expected && new Date(r.lockBy) < RM.TODAY);
    const after = window.filter((r) => !locked(r) && !blocking.includes(r) && new Date(r.lockBy) >= A);
    const waiting = RV.appraisalsOf(p.id).filter((a) => a.status === 'Not generated' && a.reason === 'blocked');
    const kind = window.length < 3 ? 'short' : blocking.length ? 'blocked' : window.length === 3 ? 'partial' : 'full';
    return { cycle: nx.cycle, date: nx.date, year: yr, window, after, blocking, kind, waiting, ready: window.filter(locked).length, open: window.filter((r) => !locked(r)) };
  };
  RV.FLAG_LABEL = { PARTIAL_CYCLE: '3 quarters' };
  // generated · generated as a Partial cycle · not generated: there is no other lifecycle (RV-28). A summary waits on marks
  // that were missed ("Waiting on marks"); Q4's are due before the anniversary, so "Waiting on Q4" only covers marks not yet due
  RV.waitingOnMissed = (a) => (a.blocking || []).some((k) => { const r = RV.recFor(a.emp, k); return !r || RV.overdue(r); });
  RV.reportLabel = (a) => (a.status === 'Generated' ? (a.flags.includes('PARTIAL_CYCLE') ? 'Ready · 3 quarters' : 'Ready') : a.reason === 'blocked' ? (RV.waitingOnMissed(a) ? 'Waiting on marks' : 'Waiting on Q4') : 'Not created');
  RV.PREVIEW_LABEL = { full: 'On track', partial: '3 quarters expected', short: 'Not enough quarters', blocked: 'Waiting on marks' };

  /* ---------- visibility: two tiers ---------- */
  // full: Admin, the Practice Head, the Reporting Manager and every manager above them · own: the employee · none: anyone
  // else. A goal sheet's assigned reviewer also gets that sheet in full, with the monthly reviews for its months, and nothing
  // more of that person (RV.recAccess, RV.monthAccess)
  RV.access = (viewer, emp) => {
    const p = q.person(emp); if (!viewer || !p) return 'none';
    if (q.isAdmin(viewer)) return 'full';
    if (viewer.id === emp) return 'own';
    if (q.isPH(viewer) || q.chain(emp).some((x) => x.id === viewer.id)) return 'full';
    return 'none';
  };
  const reviews = (viewer, rec) => !!viewer && !!rec && rec.reviewer === viewer.id && viewer.id !== rec.emp;
  RV.recAccess = (viewer, rec) => { const a = RV.access(viewer, rec.emp); return a === 'none' && reviews(viewer, rec) ? 'full' : a; };
  // a monthly review: as for the person, or in full to the reviewer of the goal sheet for the month's quarter
  RV.monthAccess = (viewer, emp, mk) => { const a = RV.access(viewer, emp); const p = personOf(emp); return a === 'none' && p && reviews(viewer, RV.recFor(emp, RV.quarterFor(p, mk).key)) ? 'full' : a; };
  RV.canSee = (viewer, emp) => RV.access(viewer, emp) !== 'none';
  RV.contentShown = (viewer, rec) => !!rec && RV.recAccess(viewer, rec) !== 'none';
  // the reviewer and the line see the self-mark once submitted; the employee sees the manager's side once the sheet locks
  RV.selfShown = (me, rec) => { const a = RV.recAccess(me, rec); return a === 'own' || (a !== 'none' && !['Not Started', 'Draft'].includes(rec.status)); };
  RV.mgrShown = (me, rec) => { const a = RV.recAccess(me, rec); return a === 'full' || (a === 'own' && RV.isLocked(rec)); };
  // what a viewer receives when they query a goal sheet: nothing without access; otherwise the sheet, with each side once it's shown
  RV.readRec = (viewer, rec) => {
    const a = RV.recAccess(viewer, rec); if (a === 'none') return null;
    const sS = RV.selfShown(viewer, rec); const mS = RV.mgrShown(viewer, rec);
    return { id: rec.id, emp: rec.emp, key: rec.key, fy: rec.fy, status: rec.status, partial: rec.partial, reviewer: rec.reviewer, template: rec.template, max: RV.quarterMax(rec),
      selfMark: sS ? rec.selfMark : null, mgrMark: mS ? rec.mgrMark : null, selfAt: rec.selfAt, lockedAt: rec.lockedAt, cycleUsed: rec.cycleUsed, version: rec.version, incomplete: RV.incomplete(rec), access: a,
      self: sS ? clone(RV.selfWorkOf(viewer, rec)) : null, mgr: mS ? clone(rec.mgr) : null, selfVersions: sS ? clone(rec.selfVersions) : [], changeNote: rec.changeNote, history: rec.history.slice() };
  };
  // a month as a viewer may read it: the employee sees the manager's part once it's done
  RV.readMonth = (viewer, emp, mk) => {
    const m = RV.month(emp, mk); if (!m) return null; const a = RV.monthAccess(viewer, emp, mk);
    if (a === 'none') return null;
    if (a === 'own' && !m.mgrDone) return Object.assign({}, m, { mgr: null, mgrHidden: !!m.mgr });
    return m;
  };
  // the Pre Appraisal Report: everyone with full access to the person (Admin, the Practice Head, their managers); never the employee (RV-25)
  RV.canOpenReport = (viewer, emp) => !!viewer && viewer.id !== emp && RV.access(viewer, emp) === 'full';
  RV.canSeeAppraisals = (viewer, emp) => !!viewer && viewer.id !== emp && RV.canSee(viewer, emp);
  RV.ownedBy = (id) => db().quarters.filter((r) => r.reviewer === id);
  RV.waitingOn = (me) => RV.ownedBy(me.id).filter((r) => RV.canMgr(me, r));
  RV.mineOpen = (me) => RV.recsOf(me.id).filter((r) => RV.canSelf(me, r));
  // this month's monthly reviews the person still has a part in: their own, and their direct reportees' manager parts
  RV.checkinTodo = (me) => {
    const mk = RV.curMonth(); const outp = [];
    if (RV.inCycles(me)) { const m = RV.month(me.id, mk); if (m && !m.empDone) outp.push({ emp: me.id, mk, part: 'emp' }); }
    q.directs(me.id).filter(RV.inCycles).forEach((p) => { const m = RV.month(p.id, mk); if (m && !m.mgrDone) outp.push({ emp: p.id, mk, part: 'mgr' }); });
    return outp;
  };

  /* ---------- completion (RV-20): complete within the period ÷ generated for active employees; frozen excluded ----------
   * Quarters are each person's own, so the practice's figures group goal sheets by the month their marks are due */
  RV.dueMonth = (rec) => mkOf(RV.lockBy(RV.quarter(rec.key)));
  RV.completion = (dueMk, ids) => {
    const recs = db().quarters.filter((r) => RV.dueMonth(r) === dueMk && active(r.emp) && !q.isFrozen(r) && (!ids || ids.includes(r.emp)));
    const due = RV.monthEnd(dueMk); const done = recs.filter(RV.lockedInWindow); const ended = RM.TODAY > due;
    return { mk: dueMk, due, total: recs.length, done: done.length, pct: recs.length ? Math.round((done.length / recs.length) * 100) : null, ended, recs,
      incomplete: ended ? recs.filter((r) => !RV.lockedInWindow(r)) : [], open: recs.filter((r) => !RV.isLocked(r)) };
  };
  // a monthly reviews: complete by month end ÷ entries for active employees whose form holds the month
  RV.monthCompletion = (mk, ids) => {
    const list = (ids ? ids.map((id) => q.person(id)) : db().people).filter((p) => p && p.status === 'Active' && RV.inCycles(p) && RV.formFor(p.id, mk));
    const ms = list.map((p) => ({ p, m: RV.month(p.id, mk) })); const done = ms.filter((x) => x.m.complete);
    return { mk, total: ms.length, done: done.length, pct: ms.length ? Math.round((done.length / ms.length) * 100) : null, ended: mk < RV.curMonth(), list: ms };
  };

  /* ---------- the prototype's sample data (built once, from the seed) ---------- */
  const rngOf = (k) => RM.rng(k); const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  // a month's sample entry: the employee's progress and evidence, the manager's feedback, as each would have added them
  RV.seedMonth = (p, f, mk) => {
    const r = rngOf('m:' + p.id + mk); const sheet = RV.sheetAt(f, mk); const end = RV.monthEnd(mk);
    const S = RM.SAMPLE.checkin(sheet.key, mk, p, r);
    const emp = Object.assign(S.emp, { ev: RM.SAMPLE.seedEvidence(sheet, mk, p, r), savedAt: iso(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 3 - Math.floor(r() * 6), 17, 10)), by: p.id });
    const disc = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 2 - Math.floor(r() * 5), 11, 0);
    const mgr = Object.assign(S.mgr, { date: iso(disc), status: 'Held', savedAt: iso(new Date(disc.getTime() + 5 * 3600e3)), by: RV.rmAt(p, disc) });
    return { emp, mgr };
  };
  // quarterly scores around the person's level: each goal out of its weight, the manager's a step either side of the self-mark
  const seedScores = (rec, kind, base, rr) => {
    const s = RV.blankScores(RV.sheetOf(rec));
    RV.scorable(rec).forEach((i) => { const max = RV.goalMax(rec, i); s[i] = clamp(Math.round(max * clamp(base / 5 + (rr() - 0.5) * 0.35, 0.2, 1)), 0, max); });
    if (kind === 'mgr') { const self = rec.self.scores; RV.scorable(rec).forEach((i) => { const d = rr(); const max = RV.goalMax(rec, i); s[i] = clamp(self[i] + (d < 0.7 ? 0 : d < 0.86 ? -1 : d < 0.97 ? 1 : -2), 0, max); }); }
    return s;
  };
  RV.seed = (dbx) => {
    // the shared lookups (q.person, q.directs) read the store, so it points at the database being built until the seed is done
    const prev = store.db; store.db = dbx; RV._db = dbx; tick = 0;
    try { seedInto(dbx); } finally { store.db = prev; RV._db = null; }
  };
  function seedInto(dbx) {
    const T = RM.TODAY; const people = dbx.people;
    dbx.forms = {}; dbx.quarters = []; dbx.appraisals = [];
    dbx.config.review = {};
    // Tejas moved from Dhaval to Manisha on 2 Apr 2026 (the audit has the change)
    dbx.rmHistory = { NVS01650: [{ rm: 'NVS00928', until: iso(new Date(2026, 3, 2, 15, 20)) }] };
    const eligible = people.filter((p) => RM.isEligible(p));
    const curMk = RV.curMonth(); const prevMk = addMonths(curMk, -1);
    /* Quarters are each person's own, and a quarter's marks open on the 1st of its last month and are due on its last day.
     * So on 1 Oct 2026 the quarters open for marks are the ones ending on 31 Oct (Aug–Oct: everyone who joined in February,
     * May, August or November); they opened this morning. Those are at every stage below; anyone else's latest quarter
     * ended on 31 Aug or 30 Sep, its marks due that day. 'Marking' is a seed-only step: With Reviewer, with part of the
     * reviewer's mark saved as a draft */
    const STORY = { NVS01831: 'Not Started', NVS01864: 'Draft', NVS01727: 'Draft', NVS01663: 'Changes Requested', NVS01119: 'With Reviewer', NVS01382: 'Marking', NVS00957: 'Locked', NVS01037: 'With Reviewer' };
    const POOL = ['Not Started', 'Not Started', 'Not Started', 'Draft', 'Draft', 'With Reviewer', 'Not Started', 'Draft'];
    // marks past their due date and not final, by quarter: Yogiraj's Q4 May–Jul 2026 (due 31 Jul; it holds their 29 Aug
    // summary) and Nikhil's Q2 Jun–Aug 2026 (due 31 Aug; they never sent their marks)
    const MISSED = { 'NVS00822|2026-05-Q4': 'With Reviewer', 'NVS01753|2026-06-Q2': 'Not Started' };
    // September monthly reviews not finished by month end: the part each one is missing
    const SEP_GAPS = { NVS00822: 'both', NVS01753: 'mgr', NVS01727: 'emp', NVS00932: 'mgr' };
    // October: a few people have started this month's progress
    const OCT_STARTED = ['NVS01864', 'NVS01602', 'NVS01382'];
    eligible.forEach((p) => {
      const base = 3.2 + rngOf('score:' + p.id)() * 1.35;
      const first = RV.firstFormStart(p);
      RV.createForm(p, first, 1);
      /* what happens over time, in order: field changes (the reportee fields, an override), the start of each review year
       * (which closes the last year's form) and appraisal dates, so each runs when its date comes round */
      const timeline = [];
      // reportee fields: a PO form gains them from the first month of the person's quarter after a first reportee arrives (RV-13)
      const firsts = people.filter((x) => x.status === 'Active' && x.rm === p.id).map((x) => ({ x, since: (dbx.rmHistory[x.id] || []).length ? new Date(dbx.rmHistory[x.id].slice(-1)[0].until) : new Date(day(x.joined).getTime() + 9.5 * 3600e3) })).sort((a, b) => a.since - b.since);
      if (firsts.length) { const o = firsts[0]; timeline.push({ at: o.since, run: () => RV.syncReporteeFields(p, new Date(o.since.getTime() + 3600e3), 'system', `Gained a reportee: ${o.x.name} (${o.since.getDate()} ${MON[o.since.getMonth()]} ${o.since.getFullYear()})`) }); }
      // the override takes effect from the person's quarter after it was made
      const ov = dbx.overrides[p.id]; if (ov) timeline.push({ at: new Date(ov.at), run: () => RV.changeTemplate(p, ov.template, new Date(ov.at), ov.by, ov.reason) });
      // each review year after the first form's starts on the 1st of the anniversary month and closes the year before
      for (let n = 2; RV.year(p, n).start <= curMk; n++) {
        const ys = RV.year(p, n).start; if (ys <= first) continue;
        const at = at6(mkDate(ys)); timeline.push({ at, run: () => RV.renewForm(p, ys, at) });
      }
      /* appraisal cycles up to today: each summary is the year's quarters. For someone already here at go-live (Apr 2024),
       * a year that began before it with fewer than three quarters here predates the prototype's records: no summary */
      for (let n = 1; day(RV.appraisalDate(p, n)) <= day(T); n++) {
        const A = RV.appraisalDate(p, n); if (RV.yearKeys(p, n).length < 3) continue;
        timeline.push({ at: A, run: () => {
          const a = RV.runAppraisal(p, n, A, new Date(A.getFullYear(), A.getMonth(), A.getDate(), 6), 'system');
          // waiting on marks made final after the anniversary: the summary was created when the last of them was
          if (a.status !== 'Generated' && a.reason === 'blocked') {
            const recs = a.blocking.map((k) => RV.recFor(p.id, k));
            if (recs.every((r) => r && RV.isLocked(r) && new Date(r.lockedAt) <= T)) RV.runAppraisal(p, n, A, new Date(Math.max(...recs.map((r) => new Date(r.lockedAt).getTime())) + 60000), 'system');
          }
        } });
      }
      timeline.sort((x, y) => x.at - y.at); let ti = 0;
      // run everything dated before day t (a quarter's goal sheet is created after what happened before its marks open)
      const until = (t) => { while (ti < timeline.length && day(timeline[ti].at) < day(t)) timeline[ti++].run(); };
      /* quarterly goal sheets: every one of the person's quarters since go-live (or since they joined) whose marks have
       * opened (on the 1st of its last month) */
      let qq = RV.quarterFor(p, first); if (qq.months[0] < first) qq = RV.nextQuarter(qq);
      while (RV.marksOpen(qq) <= T) {
        const opened = RV.marksOpen(qq); until(opened);
        const part = RV.participation(p, qq);
        if (part) {
          const rr = rngOf('q:' + p.id + qq.key);
          const rec = RV.newRecord(p, qq, part, opened);
          // open: still before its due date today (the quarter ends on 31 Oct)
          const open = T <= RV.lockBy(qq);
          let status = open ? (STORY[p.id] || POOL[Math.floor(rngOf('pool:' + p.id)() * POOL.length)]) : MISSED[p.id + '|' + qq.key] || 'Locked';
          if (open && !STORY[p.id] && SEP_GAPS[p.id] && status !== 'Not Started') status = 'Not Started';
          // days into the quarter's last month (it opened on the 1st): the self-mark within the first fortnight, final by the 25th
          const days = (n, h) => new Date(opened.getFullYear(), opened.getMonth(), 1 + n, h || 10, Math.floor(rr() * 50));
          let selfAt = open ? new Date(T.getFullYear(), T.getMonth(), T.getDate(), 9 + Math.floor(rr() * 3), 10) : days(3 + Math.floor(rr() * 7), 11);
          let lockAt = open ? new Date(T.getFullYear(), T.getMonth(), T.getDate(), 12, 40) : days(14 + Math.floor(rr() * 10), 16);
          // Tejas's Q4 Jun–Aug 2026 was made final on 25 Sep, after its 31 Aug due date and their 22 Sep anniversary: missed
          // for on-time figures, and their first summary waited on it, created that day
          if (p.id === 'NVS01650' && qq.key === '2026-06-Q4') { selfAt = days(6, 11); lockAt = new Date(2026, 8, 25, 15, 20); }
          // Shruti's Q3 Feb–Apr 2026 was made final on 6 Jun, after its 30 Apr due date: missed for on-time figures, final all the same
          if (p.id === 'NVS01382' && qq.key === '2026-02-Q3') { selfAt = days(9, 11); lockAt = new Date(2026, 5, 6, 15, 10); }
          if (status !== 'Not Started') {
            rec.self.scores = seedScores(rec, 'self', base, rr);
            if (status === 'Draft') RV.scorable(rec).forEach((i, k) => { if (k > 8) rec.self.scores[i] = null; });
            rec.self.notes = status === 'Draft' ? RM.SAMPLE.SELF_NOTES[Math.floor(rr() * RM.SAMPLE.SELF_NOTES.length)].split('. ')[0] + '.' : RM.SAMPLE.SELF_NOTES[Math.floor(rr() * RM.SAMPLE.SELF_NOTES.length)];
            if (rr() < 0.5) rec.self.valueAdds = [RM.SAMPLE.GS_VALUE_ADDS[Math.floor(rr() * RM.SAMPLE.GS_VALUE_ADDS.length)]];
            rec.history.push({ at: iso(new Date(selfAt.getTime() - 3600e3 * 26)), by: p.id, action: 'Self-assessment started' });
            rec.status = 'Draft';
          }
          if (['With Reviewer', 'Changes Requested', 'Marking', 'Locked'].includes(status)) {
            rec.selfMark = RV.markOf(rec, rec.self.scores); rec.selfAt = iso(selfAt); rec.status = 'With Reviewer';
            rec.history.push({ at: rec.selfAt, by: p.id, action: 'Self-mark submitted', note: `Self-mark ${out(rec, rec.selfMark)}` });
          }
          if (status === 'Changes Requested') {
            const note = 'Goal 5: add the sprint evidence for 25.3 and 25.4 before I mark backlog refinement, and say which risks you closed.';
            rec.selfVersions.push({ version: 1, at: rec.selfAt, selfMark: rec.selfMark, scores: clone(rec.self.scores), notes: rec.self.notes, valueAdds: clone(rec.self.valueAdds) });
            const cat = iso(new Date(selfAt.getTime() + 95 * 60000)); rec.status = 'Changes Requested'; rec.changeNote = { at: cat, by: rec.reviewer, note };
            rec.history.push({ at: cat, by: rec.reviewer, action: 'Changes requested', note });
          }
          if (['Marking', 'Locked'].includes(status)) {
            rec.mgr.scores = seedScores(rec, 'mgr', base, rr); rec.mgr.notes = RM.SAMPLE.MGR_NOTES[Math.floor(rr() * RM.SAMPLE.MGR_NOTES.length)];
            RV.scorable(rec).forEach((i) => { if (rec.mgr.scores[i] !== rec.self.scores[i] && rr() < 0.5) rec.mgr.goalNotes[i] = RM.SAMPLE.GS_COMMENTS[Math.floor(rr() * RM.SAMPLE.GS_COMMENTS.length)]; });
            if (status === 'Marking') { RV.scorable(rec).forEach((i, k) => { if (k > 9) rec.mgr.scores[i] = null; }); rec.mgr.notes = ''; }
            rec.history.push({ at: iso(new Date(lockAt.getTime() - 3600e3 * 3)), by: rec.reviewer, action: 'Manager draft saved' });
          }
          if (status === 'Locked') {
            rec.mgrMark = RV.markOf(rec, rec.mgr.scores); rec.mgrAt = iso(lockAt); rec.lockedAt = rec.mgrAt; rec.status = 'Locked';
            rec.history.push({ at: rec.lockedAt, by: rec.reviewer, action: RV.lateLocked(rec) ? 'Manager mark submitted · locked after the lock window' : 'Manager mark submitted · goal sheet locked', note: `Manager mark ${out(rec, rec.mgrMark)} · self ${out(rec, rec.selfMark)}` });
          }
        }
        qq = RV.nextQuarter(qq);
      }
      until(new Date(T.getFullYear(), T.getMonth(), T.getDate() + 1));
      /* each form's months: sample entries up to last month; a few months over the years weren't finished by month end */
      RV.formsOf(p.id).forEach((f) => {
        const end = f.end || curMk; const last = end < prevMk ? end : prevMk; f.filledThrough = last >= f.start ? last : null;
        if (f.filledThrough) RV.monthsBetween(f.start, f.filledThrough).forEach((mk) => { const g = rngOf('gap:' + p.id + mk)(); if (g < 0.025) f.gaps[mk] = 'mgr'; else if (g < 0.035) f.gaps[mk] = 'emp'; else if (g < 0.04) f.gaps[mk] = 'both'; });
        if (SEP_GAPS[p.id] && prevMk >= f.start && prevMk <= end) f.gaps[prevMk] = SEP_GAPS[p.id];
        else if (f.gaps[prevMk]) delete f.gaps[prevMk];
        if (OCT_STARTED.includes(p.id) && curMk >= f.start && curMk <= end) {
          const sm = RV.seedMonth(p, f, curMk); const at = new Date(T.getFullYear(), T.getMonth(), T.getDate(), 10 + OCT_STARTED.indexOf(p.id), 5);
          f.entries[curMk] = { emp: { work: sm.emp.work.split('. ')[0] + '.', achievements: '', projects: sm.emp.projects, challenges: '', ppt: '', savedAt: iso(at), by: p.id } };
        }
      });
    });
    // Talha is on planned leave: Admin moved Borad's Q2 Aug–Oct 2026 marks to Kuldeep
    const ar = people.find((x) => x.id === 'NVS01037'); const tq = ar && RV.recFor(ar.id, RV.marksQuarter(ar).key);
    if (tq && !RV.isLocked(tq)) { tq.originalReviewer = tq.reviewer; tq.reviewer = 'NVS00984'; tq.history.push({ at: iso(new Date(T.getFullYear(), T.getMonth(), T.getDate(), 9, 40)), by: 'ADM-0001', action: 'Reviewer reassigned', note: 'Talha Siddiqui → Kuldeep Golani · reviewer on planned leave' }); }
  }
})(window.RM);
