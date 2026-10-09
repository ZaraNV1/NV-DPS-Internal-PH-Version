/* NV-DPS-Internal shared UI: store, selectors (access rules), formatting, components, charts, overlays, motion */
(function (RM) {
  'use strict';
  const KEY = 'rmfvs.db.v8'; // v6: the practice's employee sheet; v7: Shweta Mahesh Gupta under Dhaval; v8: Tejas Lohokare under Manisha
  const SKEY = 'rmfvs.session';

  /* ================= store ================= */
  const store = RM.store = {
    db: null,
    load() {
      try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 16) this.upgrade16(d); if (d && d.v === 17) this.upgrade17(d); if (d && d.v === 18) this.upgrade18(d); if (d && d.v === 19) this.upgrade19(d); if (d && d.v === 20) this.upgrade20(d); if (d && d.v === 21) this.upgrade21(d); if (d && d.v === 22) this.upgrade22(d); if (d && d.v === 23) this.upgrade23(d); if (d && d.v === 24) this.upgrade24(d); if (d && d.v === 25) this.upgrade25(d); if (d && d.v === 26) this.upgrade26(d); if (d && d.v === 27) this.upgrade27(d); if (d && d.v === 28) this.upgrade28(d); if (d && d.v === 29) { this.db = d; this.addNewPeople(); return; } } } catch (e) { /* storage unavailable */ }
      this.db = RM.seed();
    },
    // v17: every September actual is uploaded (on 1 Oct). A saved v16 copy gets the seeded actuals it was missing
    // and keeps everything else, so people added and reviews entered in this browser stay.
    upgrade16(d) {
      const s = RM.seed();
      Object.keys(d.fin || {}).forEach((id) => { const a = d.fin[id]['2026-09'], b = s.fin[id] && s.fin[id]['2026-09']; if (a && b && a.billable && a.actual == null && b.actual != null) a.actual = b.actual; });
      d.v = 17; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v18: Submitted and Manager Review are one status, With Reviewer. A saved v17 copy keeps everything else
    upgrade17(d) {
      (d.quarters || []).forEach((r) => { if (r.status === 'Submitted' || r.status === 'Manager Review') r.status = 'With Reviewer'; });
      d.v = 18; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v19: one running review form, closed by each Pre Appraisal Report, with evidence that carries across months. A saved
    // v18 copy keeps its people, financial figures, targets and settings; its review records are rebuilt from the sample
    upgrade18(d) {
      RM.RV.seed(d);
      d.v = 19; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v20: an actual is never more than its forecast. A saved v19 copy has any actual above its forecast brought down to the
    // forecast (as the seed now does) and keeps everything else
    upgrade19(d) {
      Object.values(d.fin || {}).forEach((f) => Object.values(f).forEach((r) => { if (r && r.actual != null && r.forecast != null && r.actual > r.forecast) r.actual = r.forecast; }));
      d.v = 20; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v21: the Practice Head has a photo (assets/people/nvs00697.jpg), so a saved copy drops the initials tile it showed instead;
    // a photo uploaded in this browser still wins
    upgrade20(d) {
      const p = (d.people || []).find((x) => x.id === 'NVS00697'); if (p) delete p.tile;
      d.v = 21; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v22: each appraisal date closes the running record (it used to wait for the appraisal summary). A saved v21 copy keeps
    // its people, financial figures, targets and settings; its review records are rebuilt from the sample. A v20 saved
    // before actuals were capped comes through here too, so the cap is applied again (it changes nothing once applied)
    upgrade21(d) {
      Object.values(d.fin || {}).forEach((f) => Object.values(f).forEach((r) => { if (r && r.actual != null && r.forecast != null && r.actual > r.forecast) r.actual = r.forecast; }));
      RM.RV.seed(d);
      d.v = 22; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v23: marks are due by the end of the month after the quarter ends (they were due 15 days after it). A saved v22 copy
    // keeps its people, financial figures, targets and settings; its review records and appraisal summaries are rebuilt
    // under the new due dates
    upgrade22(d) {
      RM.RV.seed(d);
      d.v = 23; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v24: the sample year is a pessimistic one (actuals under their forecast, stretch targets, Prakhar's cluster the optimistic
    // exception), so the practice shows a gap. A saved v23 copy takes the seeded figures and targets for the seeded people;
    // people added in this browser keep theirs, and reviews, people and settings stay
    upgrade23(d) {
      const s = RM.seed();
      Object.keys(s.fin).forEach((id) => { if (d.fin && d.fin[id]) d.fin[id] = s.fin[id]; });
      d.targets = s.targets;
      d.v = 24; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v25 added the cluster managers' plans to cover their gap; they've gone again (v27), so a saved v24 copy just moves on
    upgrade24(d) {
      d.v = 25; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v26: quarters follow each person's joining date (they followed the financial year), so each review year holds its own
    // four quarters and its appraisal summary is made from them. A saved v25 copy keeps its people, financial figures,
    // targets and settings; its review records and appraisal summaries are rebuilt on the new quarters
    upgrade25(d) {
      RM.RV.seed(d);
      d.v = 26; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v27: the cluster managers' plans (db.gapPlans) are gone. A saved v26 copy drops them and keeps everything else
    upgrade26(d) {
      delete d.gapPlans;
      d.v = 27; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v28: Target Gap Drill Down and Initiatives keeps the Practice Head's initiatives and the cluster heads' ideas (db.gapItems). A saved v27 copy
    // takes the sample ones and keeps everything else
    upgrade27(d) {
      if (!d.gapItems) d.gapItems = RM.seed().gapItems;
      d.v = 28; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // v29: a quarter's marks open on the 1st of its last month and are due on its last day (they were due by the end of the
    // month after it). A saved v28 copy keeps its people, financial figures, targets and settings; its review records and
    // appraisal summaries are rebuilt under the new due dates
    upgrade28(d) {
      RM.RV.seed(d);
      d.v = 29; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    },
    // people added to the org chart after this browser saved its copy come in with their seeded financials;
    // nothing saved is touched (reviews aren't copied: seeded review IDs could clash with saved ones)
    addNewPeople() {
      const s = RM.seed(); const have = new Set(this.db.people.map((p) => p.id));
      s.people.filter((p) => !have.has(p.id)).forEach((p) => { this.db.people.push(p); this.db.fin[p.id] = s.fin[p.id]; });
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.db)); } catch (e) { /* ignore */ } },
    reset() { this.db = RM.seed(); this.save(); },
    get session() { try { return sessionStorage.getItem(SKEY); } catch (e) { return RM._sess || null; } },
    set session(v) { RM._sess = v; try { v ? sessionStorage.setItem(SKEY, v) : sessionStorage.removeItem(SKEY); } catch (e) { /* ignore */ } },
  };

  /* ================= utils ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Solar icons, bundled in js/icons.js and drawn inline (no runtime icon fetches)
  const ic = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${(RM.ICONS && RM.ICONS[name]) || ''}</svg>`;
  RM.$ = $; RM.$$ = $$; RM.esc = esc; RM.ic = ic;
  RM.reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= formatting ================= */
  const MINUS = '−';
  const fmt = RM.fmt = {
    inr(v, opt) {
      if (v == null) return '–';
      const a = Math.abs(v); const sign = v < 0 ? MINUS : (opt && opt.plus && v > 0 ? '+' : '');
      if (a >= 1e7) return sign + '₹' + (a / 1e7).toFixed(2) + ' Cr';
      if (a >= 1e5) return sign + '₹' + (a / 1e5).toFixed(a >= 1e6 ? 1 : 2).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m)) + ' L';
      if (a === 0) return '₹0';
      return sign + '₹' + (a / 1e5).toFixed(2) + ' L';
    },
    inrL(v) { if (v == null) return '–'; return (v < 0 ? MINUS : '') + '₹' + (Math.abs(v) / 1e5).toFixed(2) + ' L'; },
    varCls(v) { return v == null || v === 0 ? '' : v > 0 ? 'pos' : 'neg'; }, // zero is neutral: exactly on the forecast or target
    date(d, o) { d = new Date(d); return d.getDate() + ' ' + RM.MONTHS[d.getMonth()] + (o && o.noYear ? '' : ' ' + d.getFullYear()); },
    dateTime(d) { d = new Date(d); return fmt.date(d) + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); },
    rel(d) {
      d = new Date(d); const diff = (RM.TODAY - d) / 60000;
      if (diff < 1) return 'just now'; if (diff < 60) return Math.round(diff) + ' min ago';
      const days = dayDiff(d, RM.TODAY);
      const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (days === 0) return 'Today, ' + hm; if (days === 1) return 'Yesterday, ' + hm;
      if (days < 7) return days + ' days ago'; return fmt.date(d);
    },
    monthLabel(key) { const [y, m] = key.split('-'); return RM.MONTHS[+m - 1] + ' ' + y; },
    monthShort(key) { const [, m] = key.split('-'); return RM.MONTHS[+m - 1]; },
    score(v) { return v == null ? '–' : Number(v).toFixed(1); },
    pct(n, d) { return d ? Math.round((n / d) * 100) : 0; },
    first(name) { return String(name).split(' ')[0]; },
    monthYear(d) { d = new Date(d); return RM.MONTHS[d.getMonth()] + ' ' + d.getFullYear(); },
    usd(v, dec) { return (v < 0 ? MINUS : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); },
    // compact US dollars for dashboards: $1.27M, $540K, $3.1K
    usdShort(v, opt) {
      if (v == null) return '–';
      const a = Math.abs(v); const sign = v < 0 ? MINUS : (opt && opt.plus && v > 0 ? '+' : '');
      if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
      if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
      return sign + '$' + Math.round(a);
    },
    rate(v) { return fmt.usd(v, v % 1 ? 2 : 0) + '/hr'; },
    // whole months from a date to today, and that span as "2 yr 5 mo"
    monthsSince(d) { d = new Date(d); const t = RM.TODAY; return Math.max(0, (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth() - (t.getDate() < d.getDate() ? 1 : 0)); },
    age(m) { return m < 1 ? 'Under a month' : m < 12 ? m + ' mo' : Math.floor(m / 12) + ' yr' + (m % 12 ? ' ' + (m % 12) + ' mo' : ''); },
  };
  function startOfDay(d) { d = new Date(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function dayDiff(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
  RM.dayDiff = dayDiff;

  /* ================= selectors & access rules ================= */
  const q = RM.q = {
    db: () => store.db,
    person(id) { const db = store.db; if (!id) return null; if (db.admin.id === id) return db.admin; return db.people.find((p) => p.id === id) || null; },
    me() { return q.person(store.session); },
    all() { return store.db.people; },
    active() { return store.db.people.filter((p) => p.status === 'Active'); },
    directs(id, incArchived) { return store.db.people.filter((p) => p.rm === id && (incArchived || p.status === 'Active')); },
    descendants(id) { const out = []; const walk = (pid, depth) => q.directs(pid).forEach((c) => { out.push({ p: c, depth, type: depth === 1 ? 'Direct' : 'Indirect' }); walk(c.id, depth + 1); }); walk(id, 1); return out; },
    indirect(id) { return q.descendants(id).filter((d) => d.type === 'Indirect').map((d) => d.p); },
    chain(id) { const out = []; let p = q.person(id); while (p && p.rm) { p = q.person(p.rm); if (p) out.push(p); } return out; },
    hasReportees(id) { return q.directs(id).length > 0; },
    isAdmin(p) { return p && p.role === 'Admin'; },
    isPH(p) { return p && p.role === 'Practice Head'; },
    // --- reviews: quarterly review records live in review.js (RM.RV); these are the shortcuts the views share
    isFrozen(rec) { const p = q.person(rec.emp); return !!p && p.status !== 'Active' && rec.status !== 'Locked'; },

    // --- visibility & financial scope (independent dimensions, BR-03 / BR-05)
    canSeePerson(viewer, target) {
      if (!viewer || !target) return false;
      if (q.isAdmin(viewer) || q.isPH(viewer)) return true;
      if (viewer.id === target.id) return true;
      return q.descendants(viewer.id).some((d) => d.p.id === target.id);
    },
    // anyone can open a colleague's profile (reviews and figures stay scoped); only Admin and Practice Head edit people records
    // editing employee records is Admin's alone; the Practice Head views them and can change their own photo
    canEditPeople(viewer) { return !!viewer && q.isAdmin(viewer); },
    canEditPhoto(viewer, target) { return !!viewer && !!target && viewer.id === target.id && q.isPH(viewer); },
    // profiles: Admin and the Practice Head open anyone's; everyone else their own and their direct and indirect reportees'
    canOpenProfile(viewer, target) { return !!target && !target.system && q.canSeePerson(viewer, target); },
    // financial access is limited to Admin, Practice Head and PM roles
    hasFinance(viewer) { return !!viewer && (q.isAdmin(viewer) || q.isPH(viewer) || viewer.role === 'PM'); },
    finScope(viewer, target) {
      if (!viewer || !target || !q.hasFinance(viewer)) return false;
      if (q.isAdmin(viewer) || q.isPH(viewer)) return true;
      if (viewer.id === target.id) return true;                              // PM: own figures
      return q.descendants(viewer.id).some((d) => d.p.id === target.id);     // PM: direct and indirect reportees
    },
    // --- financials: Admin uploads each month's figures and there are no locks. A month appears once anyone has figures for it;
    // a person's actual counts once it's uploaded.
    finMonths() { const ks = new Set(); Object.values(store.db.fin).forEach((f) => Object.keys(f).forEach((k) => ks.add(k))); return [...ks].sort(); },
    latestMonth() { const ks = q.finMonths(); return ks[ks.length - 1]; },
    finRow(id, month) { const f = store.db.fin[id]; return f ? f[month] : null; },
    finSum(ids, month) {
      const s = { forecast: 0, actual: 0, billable: 0, nonBillable: 0, missing: 0, uploaded: 0, fVar: 0 };
      ids.forEach((id) => {
        const r = q.finRow(id, month); if (!r) return;
        if (r.billable) s.billable++; else s.nonBillable++;
        s.forecast += r.forecast;
        if (r.actual == null) { if (r.billable) s.missing++; return; } // missing: billable people whose actual isn't uploaded yet
        s.actual += r.actual; if (r.billable) s.uploaded++;
        // the variance compares uploaded actuals with their own forecast, so a month part-way through its uploads isn't a shortfall
        s.fVar += r.actual - r.forecast;
      });
      return s;
    },
    // --- appraisals: the next DOJ anniversary and what its report is expected to cover, or a report generated (or not) in the last 30 days
    appraisal(p) {
      const RV = RM.RV; const nx = RV.preview(p); const days = dayDiff(RM.TODAY, nx.date);
      const recent = RV.appraisalsOf(p.id).filter((a) => dayDiff(new Date(a.date), RM.TODAY) <= 30).pop();
      if (recent) return { anniv: new Date(recent.date), days: dayDiff(RM.TODAY, new Date(recent.date)), cycle: recent.cycle, status: RV.reportLabel(recent), report: recent, preview: nx };
      return { anniv: nx.date, days, cycle: nx.cycle, status: RV.PREVIEW_LABEL[nx.kind], preview: nx };
    },
    // each person's next anniversary within `within` days (the lead time by default), soonest first; reports already
    // generated or due are not upcoming, so they're left out (q.appraisal has the recent one)
    upcomingAppraisals(ids, within) {
      const RV = RM.RV; const lead = within == null ? store.db.config.appraisalLeadDays : within;
      return ids.map((id) => q.person(id)).filter((p) => p && RM.isEligible(p)).map((p) => { const nx = RV.preview(p); return { p, a: { anniv: nx.date, days: dayDiff(RM.TODAY, nx.date), cycle: nx.cycle, status: RV.PREVIEW_LABEL[nx.kind], preview: nx } }; })
        .filter((x) => x.a.days >= 0 && x.a.days <= lead).sort((a, b) => a.a.days - b.a.days);
    },

  };

  /* ================= components ================= */
  const C = RM.C = {};
  C.avatar = (p, size, extra, style) => {
    const cls = 'av' + (size ? ' av-' + size : '') + (extra ? ' ' + extra : '');
    const st = style || '';
    if (!p) return `<span class="${cls}" style="${st}"></span>`;
    if (p.system) return `<span class="${cls} av-system" style="${st}" role="img" aria-label="${esc(p.name)} (system account)">${ic('shield-keyhole-bold')}</span>`;
    if (p.photo) return `<span class="${cls}" style="${st}"><img src="${p.photo}" alt="${esc(p.name)}" decoding="async"></span>`; // a photo the person uploaded
    if (p.tile) return `<span class="${cls} av-tile" role="img" aria-label="${esc(p.name)}" style="background:${p.tile.bg};${st}">${esc(p.tile.letter)}</span>`;
    const t = (p.name || '?')[0];
    return `<span class="${cls}" style="${st}"><img src="assets/people/${p.id.toLowerCase()}.jpg" alt="${esc(p.name)}" decoding="async" data-fallback="${esc(t)}"></span>`;
  };
  C.person = (p, sub, opt) => {
    opt = opt || {};
    const inner = `${C.avatar(p, opt.size || 'md')}<span style="min-width:0"><span class="person-name">${esc(p.name)}${opt.you ? ' <span class="faint" style="font-weight:500">(you)</span>' : ''}</span><span class="person-sub">${sub != null ? sub : esc(p.designation)}</span></span>`;
    // opt.tab: the profile tab it opens on (Practice Reviews' names open Reviews)
    if (opt.link && q.canOpenProfile(q.me(), p)) return `<button type="button" class="person" data-action="open-person" data-id="${p.id}"${opt.tab ? ` data-tab="${opt.tab}"` : ''}>${inner}</button>`;
    return `<span class="person">${inner}</span>`;
  };
  // a colleague's name inside a row (reviewer, manager, actor): opens their profile when the viewer may open it, else plain text
  C.who = (p, label, cls) => (!p ? '–' : q.canOpenProfile(q.me(), p) ? `<button type="button" class="${cls || 'name-link'}" data-action="open-person" data-id="${p.id}">${esc(label || p.name)}</button>` : esc(label || p.name));
  // audit text ("Jul 2026 · Rehan Akhtarkhan Pathan", or a manager change's before and after): any part naming a colleague opens their profile
  RM.auditEntity = (text) => String(text == null ? '' : text).split(' · ').map((part) => { const p = store.db.people.find((x) => x.name === part); return p ? C.who(p) : esc(RM.plain(part)); }).join(' · ');
  // stored review wording (audit entries, form notes, saved before the plain words) in the words the screens use
  RM.plain = (t) => String(t == null ? '' : t)
    .replace(/^Locked quarterly goal sheet/, 'Made quarter marks final').replace(/^Corrected locked goal sheet/, 'Corrected final marks').replace(/^Marked quarterly goal sheets Incomplete/, 'Marked quarters missed')
    .replace(/(BA & Sr BA|PM|PO) goal sheet/g, '$1 template').replace(/the cycle \d+ Pre Appraisal Report/g, 'the appraisal summary').replace(/Pre Appraisal Reports/g, 'appraisal summaries').replace(/Pre Appraisal Report/g, 'appraisal summary')
    .replace(/[Qq]uarterly goal sheets?/g, (m) => (m[0] === 'Q' ? 'Quarter marks' : 'quarter marks')).replace(/goal sheets?/g, 'marks').replace(/Self-mark/g, 'Self marks').replace(/self-mark/g, 'self marks')
    .replace(/With reviewer/g, 'With manager').replace(/\b[Rr]eviewer\b/g, (m) => (m[0] === 'R' ? 'Manager' : 'manager')).replace(/lock window/g, 'due date').replace(/Lock by/g, 'Due')
    .replace(/\bIncomplete\b/g, 'missed').replace(/\bLocked\b/g, 'Final').replace(/\blocked\b/g, 'made final').replace(/\bcycle (\d+)\b/g, 'appraisal $1')
    .replace(/^Generated appraisal summary/, 'Created appraisal summary').replace(/appraisal summary not generated/, 'appraisal summary not created').replace(/^Generated$/, 'Created').replace(/^Not generated$/, 'Not created')
    .replace(/Started a new review form/, 'Started a new review period').replace(/First form from go-live/, 'Started at go-live').replace(/^Form (\d+)\b/, 'Period $1');
  // a row of small avatars, each opening that person's profile
  C.avLinks = (list) => `<span class="av-stack">${list.map((d) => (q.canOpenProfile(q.me(), d) ? `<button type="button" class="av-link" data-action="open-person" data-id="${d.id}" data-tip="${esc(d.name)}" aria-label="${esc(d.name)}">${C.avatar(d, 'xs')}</button>` : C.avatar(d, 'xs'))).join('')}</span>`;
  // a list row that opens href (usually a review) while the names in it open profiles; the arrow is its keyboard link
  C.linkRow = (href, label, inner) => `<div class="list-item is-clickable" data-href="${href}">${inner}<a class="go-link" href="${href}" aria-label="${esc(label)}">${ic('alt-arrow-right-linear', 'go')}</a></div>`;
  // a quarter's marks: the employee marks, the manager marks (or asks for changes), and the manager's marks make them final
  const STATUS = {
    'Not Started': ['', 'Not started'], 'Draft': ['', 'Draft'], 'Changes Requested': ['b-warn', 'Changes asked'],
    'With Reviewer': ['b-info', 'With manager'], 'Locked': ['b-lock has-icon', 'Final'],
  };
  // missed: not final by the due date; shown beside the status, which still says where it stands
  C.status = (s, frozen, incomplete) => {
    if (frozen) return `<span class="badge b-outline has-icon">${ic('snowflake-linear')}Kept · has left</span>`;
    const m = STATUS[s] || ['', s];
    const b = `<span class="badge ${m[0]}">${s === 'Locked' ? ic('lock-keyhole-minimalistic-bold') : ''}${m[1]}</span>`;
    return incomplete ? (s === 'Locked' ? b + ' <span class="badge b-warn no-dot" data-tip="Made final after the due date, so it counts as missed">Late</span>' : `<span class="badge b-bad">Missed</span> ${b}`) : b;
  };
  RM.statusLabel = (s) => (STATUS[s] || ['', s])[1];
  C.dueBadge = (rec) => { const d = RM.RV.due(rec); if (rec.status === 'Locked') return ''; return `<span class="small ${d.over ? 'due-over' : d.soon ? 'due-soon' : 'muted'}">${d.label}</span>`; };
  // appraisal summaries: ready (from four quarters, or three), or not created; and what the next one is expected to be
  const APPR = { 'On track': 'b-ok', 'Ready': 'b-lock has-icon', 'Ready · 3 quarters': 'b-warn has-icon', 'Not created': 'b-bad', '3 quarters expected': 'b-warn', 'Not enough quarters': 'b-bad', 'Waiting on marks': 'b-bad', 'Waiting on Q4': 'b-info', '3 quarters': 'b-warn' };
  C.appr = (s) => `<span class="badge ${APPR[s] || ''}">${/^Ready/.test(s) ? ic('file-check-bold') : ''}${s}</span>`;
  C.kpi = (o) => `<div class="kpi${o.tone ? ' is-' + o.tone : ''}" data-reveal>
      <div class="kpi-label">${o.icon ? ic(o.icon) : ''}${esc(o.label)}</div>
      <div class="kpi-value">${o.value}${o.unit ? `<small>${o.unit}</small>` : ''}</div>
      <div class="kpi-sub">${o.sub || ''}</div>${o.href ? `<span class="kpi-go" aria-hidden="true">${ic('arrow-right-up-linear')}</span><a class="kpi-link" href="${o.href}" aria-label="${esc(o.label)}: open"></a>` : ''}${o.extra || ''}
    </div>`;
  C.pick = () => `<span class="kpi-pick" aria-hidden="true">${ic('tuning-2-linear', 'is-rest')}${ic('check-circle-bold', 'is-on')}</span>`;
  C.count = (n, dec) => `<span data-count="${n}"${dec ? ` data-dec="${dec}"` : ''}>${dec ? Number(n).toFixed(dec) : n}</span>`;
  C.sample = (t) => `<span class="sample-tag" title="Generated sample data for the prototype">${ic('test-tube-minimalistic-linear')}${t || 'Sample data'}</span>`;
  C.empty = (icon, title, body, action) => `<div class="empty"><div class="e-ic">${ic(icon)}</div><h3>${title}</h3><p>${body}</p>${action || ''}</div>`;
  C.seg = (items, current, attrs) => `<div class="seg" role="tablist" ${attrs || ''}>${items.map((it) => it.href
    ? `<a href="${it.href}" role="tab" ${it.disabled ? 'aria-disabled="true" tabindex="-1" data-tip="' + esc(it.tip || '') + '"' : ''} aria-selected="${it.key === current}" ${it.key === current ? 'aria-current="page"' : ''}>${it.label}${it.count ? `<span class="count">${it.count}</span>` : ''}</a>`
    : `<button type="button" role="tab" data-seg="${it.key}" aria-selected="${it.key === current}" ${it.disabled ? 'aria-disabled="true"' : ''}>${it.label}${it.count ? `<span class="count">${it.count}</span>` : ''}</button>`).join('')}<span class="seg-thumb" aria-hidden="true"></span></div>`;
  // filter pills are buttons: they re-render one region in place and mirror the choice into the URL
  // items: [key, label, count, tip?]; a tip explains a pill whose scope isn't obvious from its label
  C.filterPills = (items, current, label) => `<div class="filter-pills" role="group" aria-label="${esc(label)}">${items.map(([k, l, n, tip]) => `<button type="button" class="fpill" data-filter="${esc(k)}" aria-pressed="${k === current}"${tip ? ` data-tip="${esc(tip)}"` : ''}>${l} <span class="n">${n}</span></button>`).join('')}</div>`;
  // Swap a list's rows in place: the old rows fade out at once (90ms ease-out, so the click reads instantly), the box tweens to the
  // new height so the page below glides instead of jumping, and only the rows in view rise in, with the whole stagger held under
  // ~200ms however long the list is. A newer swap on the same box wins; reduced motion swaps instantly.
  // opt.mode: 'swap' (a filter pick, the default), 'quick' (typing: no fade-out, rows lift from 40% in 140ms), 'grow' (show all /
  // fewer: only the height glides, so rows already on screen stay put). opt.after runs once the new rows are in.
  const swapTurn = new WeakMap();
  RM.swapRows = (box, html, opt) => {
    opt = opt || {}; const mode = opt.mode || 'swap';
    const body = box.tagName === 'TBODY'; const shell = body ? box.closest('.table-wrap') || box : box; // a <tbody> can't take a height, its wrapper can
    const rowsOf = () => box.querySelectorAll(body ? 'tr' : 'tbody tr, .empty');
    const me = (swapTurn.get(box) || 0) + 1; swapTurn.set(box, me);
    const motion = !RM.reduced() && window.gsap;
    const out = body ? [box] : [...box.querySelectorAll('tbody, .empty')];
    const swap = () => {
      if (swapTurn.get(box) !== me) return;
      const h0 = shell.offsetHeight;
      box.innerHTML = html; if (opt.after) opt.after();
      if (!motion) return;
      gsap.set(body ? box : [], { clearProps: 'opacity' });
      const h1 = shell.offsetHeight;
      if (Math.abs(h1 - h0) > 2) gsap.fromTo(shell, { height: h0, overflow: 'hidden' }, { height: h1, duration: Math.min(mode === 'quick' ? .2 : .3, .18 + Math.abs(h1 - h0) / 6000), ease: 'power2.inOut', clearProps: 'height,overflow' });
      if (mode === 'grow') return;
      const vh = innerHeight; const rows = [...rowsOf()].filter((r) => r.getBoundingClientRect().top < vh);
      if (!rows.length) return;
      if (mode === 'quick') gsap.fromTo(rows, { opacity: .4 }, { opacity: 1, duration: .14, ease: 'power2.out', clearProps: 'opacity' });
      else gsap.fromTo(rows, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .24, stagger: Math.min(.03, .2 / rows.length), ease: 'power2.out', clearProps: 'opacity,transform' });
    };
    if (!motion) { swap(); return; }
    gsap.killTweensOf([shell, ...out, ...rowsOf()]); gsap.set(shell, { clearProps: 'height,overflow' });
    if (mode !== 'swap' || !out.length) { gsap.set(out, { clearProps: 'opacity' }); swap(); return; }
    gsap.to(out, { opacity: 0, duration: .09, ease: 'power2.out', onComplete: swap });
  };
  // filter pills that swap one region's rows (RM.swapRows) and mirror the choice into the URL, announcing what's shown
  RM.bindFilters = (root, opt) => {
    const group = root.querySelector(opt.group); const box = root.querySelector(opt.target); if (!group || !box) return;
    const live = document.createElement('span'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); group.after(live);
    group.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
      const f = b.dataset.filter;
      group.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      try { history.replaceState(null, '', opt.url(f)); } catch (err) { /* sandboxed frames may block this */ }
      RM.tip.hide();
      RM.swapRows(box, opt.render(f), { after: () => { if (opt.after) opt.after(f); const n = b.querySelector('.n'); live.textContent = `${b.firstChild.textContent.trim()}: ${n ? n.textContent : ''} shown`; } });
    });
  };
  // Styled combobox. Replaces native <datalist>, whose popup ignores the design system and opens off-target inside the artifact frame.
  // Markup: <div class="combo"> <input role="combobox" aria-controls="ID"> <div class="combo-list" id="ID" role="listbox" hidden></div> </div>
  const hlMatch = (s, t) => { if (!t) return esc(s); const i = s.toLowerCase().indexOf(t); return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + t.length)) + '</mark>' + esc(s.slice(i + t.length)); };
  RM.combo = (input, opt) => {
    const list = document.getElementById(input.getAttribute('aria-controls')); if (!list) return null;
    let items = []; let sel = 0;
    const mark = () => { list.querySelectorAll('[data-i]').forEach((el) => el.setAttribute('aria-selected', +el.dataset.i === sel)); input.setAttribute('aria-activedescendant', items.length ? list.id + '-' + sel : ''); };
    const draw = () => {
      const t = input.value.trim().toLowerCase(); items = opt.search(t); sel = Math.min(sel, Math.max(0, items.length - 1));
      list.innerHTML = items.length ? items.map((x, i) => `<div class="combo-item" role="option" id="${list.id}-${i}" data-i="${i}" aria-selected="${i === sel}">${opt.render(x, (s) => hlMatch(s, t))}</div>`).join('')
        : `<div class="combo-empty">${esc(opt.empty ? opt.empty(input.value.trim()) : 'No matches')}</div>`;
      input.setAttribute('aria-activedescendant', items.length ? list.id + '-' + sel : '');
    };
    const open = () => { if (input.disabled || input.readOnly) return; draw(); list.hidden = false; input.setAttribute('aria-expanded', 'true'); };
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
    const choose = (i) => { const x = items[i]; if (x === undefined) return; close(); opt.onPick(x); };
    const move = (d) => { if (list.hidden) { open(); return; } if (!items.length) return; sel = (sel + d + items.length) % items.length; mark(); const el = list.querySelector('[aria-selected="true"]'); if (el) el.scrollIntoView({ block: 'nearest' }); };
    input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', open);
    input.addEventListener('click', () => { if (list.hidden) open(); });
    input.addEventListener('input', () => { sel = 0; open(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && !list.hidden && items.length) { e.preventDefault(); choose(sel); }
      else if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); close(); }
      else if (e.key === 'Tab') close();
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
    list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input while picking
    list.addEventListener('click', (e) => { const it = e.target.closest('[data-i]'); if (it) choose(+it.dataset.i); });
    list.addEventListener('pointermove', (e) => { const it = e.target.closest('[data-i]'); if (it && +it.dataset.i !== sel) { sel = +it.dataset.i; mark(); } });
    return { open, close };
  };
  // Styled select. Native <select> menus are drawn by the OS and can't take the design system, so every .select is
  // upgraded in place to a select-only combobox (WAI-ARIA pattern). The native element stays in the DOM, visually hidden,
  // as the source of truth: code that reads .value or listens for 'change' keeps working unchanged.
  let selSeq = 0; let openSel = null;
  function enhanceSelect(sel) {
    if (sel.dataset.xsel || sel.multiple) return; sel.dataset.xsel = '1';
    const wrap = document.createElement('div'); wrap.className = 'xsel'; if (sel.style.cssText) wrap.style.cssText = sel.style.cssText;
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
    const listId = 'xsel-' + (++selSeq);
    const btn = document.createElement('button'); btn.type = 'button';
    btn.className = [...sel.classList].join(' ') + ' xsel-btn'; sel.className = 'xsel-native'; sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    btn.setAttribute('role', 'combobox'); btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', listId);
    btn.innerHTML = `<span class="xsel-val"></span>${ic('alt-arrow-down-linear', 'xsel-chev')}`;
    const lab = sel.id && document.querySelector(`label[for="${sel.id}"]`);
    if (lab) { if (!lab.id) lab.id = sel.id + '-lbl'; btn.setAttribute('aria-labelledby', lab.id); lab.addEventListener('click', (e) => { e.preventDefault(); btn.focus(); }); }
    else if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
    wrap.appendChild(btn);
    const val = btn.querySelector('.xsel-val');
    const sync = () => { const o = sel.options[sel.selectedIndex]; val.textContent = o ? o.textContent : ''; btn.disabled = sel.disabled; };
    sync(); sel.addEventListener('change', sync); sel.addEventListener('focus', () => btn.focus()); // form validation focuses the native field
    let list = null; let active = 0; let typed = ''; let typedT = 0;
    const opts = () => [...sel.options];
    const setActive = (i) => { active = i; list.querySelectorAll('[data-i]').forEach((el) => el.classList.toggle('is-active', +el.dataset.i === i)); btn.setAttribute('aria-activedescendant', listId + '-' + i); const el = list.querySelector('.is-active'); if (el) el.scrollIntoView({ block: 'nearest' }); };
    const step = (from, d) => { const o = opts(); let i = from; for (let n = 0; n < o.length; n++) { i = Math.max(0, Math.min(o.length - 1, i + d)); if (!o[i].disabled) return i; } return from; };
    const place = () => {
      const r = btn.getBoundingClientRect(); const below = innerHeight - r.bottom - 12; const h = Math.min(list.scrollHeight, 300);
      list.style.minWidth = r.width + 'px'; list.style.left = Math.max(8, Math.min(r.left, innerWidth - list.offsetWidth - 8)) + 'px';
      list.style.top = (below < h && r.top > below ? r.top - h - 6 : r.bottom + 6) + 'px';
    };
    const close = (refocus) => {
      if (!list) return; list.remove(); list = null; openSel = null; btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-activedescendant');
      document.removeEventListener('pointerdown', outside, true); document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', close);
      if (refocus) btn.focus();
    };
    const outside = (e) => { if (!list || list.contains(e.target) || btn.contains(e.target)) return; close(); };
    const onScroll = (e) => { if (list && e.target !== list && !list.contains(e.target)) close(); };
    const choose = (i) => {
      const o = opts()[i]; if (!o || o.disabled) return;
      const changed = sel.selectedIndex !== i; sel.selectedIndex = i; close(true);
      if (changed) { sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    const open = () => {
      if (btn.disabled || list) return; if (openSel) openSel();
      list = document.createElement('div'); list.className = 'xsel-list'; list.id = listId; list.setAttribute('role', 'listbox'); list.setAttribute('data-lenis-prevent', '');
      if (btn.getAttribute('aria-labelledby')) list.setAttribute('aria-labelledby', btn.getAttribute('aria-labelledby'));
      list.innerHTML = opts().map((o, i) => `<div class="xsel-opt" role="option" id="${listId}-${i}" data-i="${i}" aria-selected="${i === sel.selectedIndex}"${o.disabled ? ' aria-disabled="true"' : ''}><span>${esc(o.textContent)}</span>${ic('check-read-linear')}</div>`).join('');
      document.body.appendChild(list); btn.setAttribute('aria-expanded', 'true'); openSel = () => close();
      place(); setActive(Math.max(0, sel.selectedIndex));
      const cur = list.querySelector('.is-active'); if (cur) list.scrollTop = cur.offsetTop - (list.clientHeight - cur.offsetHeight) / 2; // open with the current choice centred
      list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on the button
      list.addEventListener('click', (e) => { const it = e.target.closest('[data-i]'); if (it) choose(+it.dataset.i); });
      list.addEventListener('pointermove', (e) => { const it = e.target.closest('[data-i]'); if (it && +it.dataset.i !== active && it.getAttribute('aria-disabled') !== 'true') setActive(+it.dataset.i); });
      document.addEventListener('pointerdown', outside, true); document.addEventListener('scroll', onScroll, true); window.addEventListener('resize', close);
      if (!RM.reduced() && window.gsap) gsap.fromTo(list, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: .16, ease: 'power2.out', clearProps: 'opacity,transform' });
    };
    btn.addEventListener('click', () => (list ? close() : open()));
    btn.addEventListener('keydown', (e) => {
      const k = e.key;
      if (!list) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); open(); } return; }
      if (k === 'ArrowDown') { e.preventDefault(); setActive(step(active, 1)); }
      else if (k === 'ArrowUp') { e.preventDefault(); setActive(step(active, -1)); }
      else if (k === 'Home') { e.preventDefault(); setActive(step(-1, 1)); }
      else if (k === 'End') { e.preventDefault(); setActive(step(opts().length, -1)); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (k === 'Tab') close();
      else if (k.length === 1 && /\S/.test(k)) { // type-ahead
        clearTimeout(typedT); typed += k.toLowerCase(); typedT = setTimeout(() => { typed = ''; }, 600);
        const o = opts(); const hit = o.findIndex((x, i) => i > (typed.length > 1 ? active - 1 : active) && !x.disabled && x.textContent.toLowerCase().startsWith(typed));
        const any = hit >= 0 ? hit : o.findIndex((x) => !x.disabled && x.textContent.toLowerCase().startsWith(typed)); if (any >= 0) setActive(any);
      }
    });
  }
  RM.enhanceSelects = (root) => { (root || document).querySelectorAll('select.select:not([data-xsel])').forEach(enhanceSelect); };
  // upgrade selects as views, drawers and modals render them (microtask timing, so the native control never paints)
  new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches('select.select')) enhanceSelect(n); else if (n.querySelector('select.select')) RM.enhanceSelects(n); } })
    .observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => { if (openSel) openSel(); });
  C.notice = (tone, icon, html, extra) => `<div class="notice${tone ? ' is-' + tone : ''}" ${extra || ''}>${ic(icon)}<div class="notice-body">${html}</div></div>`;
  C.progressStack = (parts, total) => `<div class="progress" role="img" aria-label="${parts.map((p) => p.label + ' ' + p.n).join(', ')}">${parts.filter((p) => p.n).map((p) => `<i style="width:${(p.n / total) * 100}%;background:${p.color}" data-tip="<b>${esc(p.label)}</b> · ${p.n} of ${total}" data-grow></i>`).join('')}</div>`;

  /* ---------- billability split: Deloitte · Non-Deloitte clients · Internal / Investments ---------- */
  // billable status comes from the period's financial record; the client comes from the person's allocation
  const BL_GROUPS = [
    { k: 'deloitte', label: 'Deloitte', cls: 'bl-d' },
    { k: 'other', label: 'Non-Deloitte clients', cls: 'bl-o' },
    { k: 'internal', label: 'Internal / Investments', cls: 'bl-i' },
  ];
  function billSplit(ids, month) {
    const g = { deloitte: [], other: [], internal: [] }; const clients = {};
    ids.forEach((id) => {
      const p = q.person(id); if (!p) return;
      const f = q.finRow(id, month); const billable = f ? f.billable : !['Internal', '–'].includes(p.alloc);
      if (!billable) g.internal.push(p);
      else if (p.alloc === 'Deloitte') g.deloitte.push(p);
      else { g.other.push(p); (clients[p.alloc] = clients[p.alloc] || []).push(p); }
    });
    const total = g.deloitte.length + g.other.length + g.internal.length;
    return { g, clients, total, billable: g.deloitte.length + g.other.length };
  }
  RM.billSplit = billSplit;
  // one person's client group, by the same rule as the billability split
  RM.clientOf = (p, month) => {
    const s = billSplit([p.id], month || q.latestMonth());
    const k = s.g.deloitte.length ? 'deloitte' : s.g.other.length ? 'other' : 'internal';
    return { k, cls: BL_GROUPS.find((b) => b.k === k).cls, name: k === 'deloitte' ? 'Deloitte' : k === 'other' ? p.alloc : 'Investment / Internal', group: k === 'deloitte' ? 'Deloitte client' : k === 'other' ? 'Non-Deloitte client' : 'Non-billable' };
  };
  // the Client filter: Deloitte, then each other client by name, then the bench. Internal and investment people have no client
  // option of their own ('none'); the Investment / Internal card finds them.
  RM.clientKey = (p, month) => { const c = RM.clientOf(p, month); return c.k === 'deloitte' ? 'deloitte' : c.k === 'other' ? 'c:' + p.alloc : RM.resourceOf(p.id).projects.length ? 'none' : 'bench'; };
  RM.clientOptions = (people, month) => {
    const names = [...new Set(people.filter((p) => RM.clientOf(p, month).k === 'other').map((p) => p.alloc))].sort((a, b) => a.localeCompare(b));
    return [['deloitte', 'Deloitte'], ...names.map((n) => ['c:' + n, n]), ['bench', 'Bench']];
  };

  /* ---------- how each person is used: Billable · Investment / Internal · Bench ---------- */
  // billable comes from the month's figures, as in the split above; a non-billable person on a project is on internal or
  // investment work, and one with no project recorded is on the bench
  RM.USE = [
    { k: 'billable', label: 'Billable', cls: 'bl-d', icon: 'case-linear', sub: 'On client work' },
    { k: 'internal', label: 'Investment / Internal', cls: 'bl-i', icon: 'lightbulb-bolt-linear', sub: 'Non-billable · on an internal or investment project' },
    { k: 'bench', label: 'Bench', cls: 'bl-b', icon: 'hourglass-linear', sub: 'Non-billable · no project recorded' },
  ];
  RM.useOf = (p, month) => (RM.clientOf(p, month).k !== 'internal' ? 'billable' : RM.resourceOf(p.id).projects.length ? 'internal' : 'bench');
  const nameList = (list) => list.slice(0, 8).map((p) => esc(p.name)).join(', ') + (list.length > 8 ? ` +${list.length - 8} more` : '');
  C.billability = (ids, opt) => {
    opt = opt || {};
    const month = opt.month || q.latestMonth(); const s = billSplit(ids, month);
    if (!s.total) return '';
    const pct = (n) => fmt.pct(n, s.total);
    const segs = BL_GROUPS.map((b) => ({ ...b, list: s.g[b.k], n: s.g[b.k].length }));
    const tip = (x) => `<b>${esc(x.label)}</b> · ${x.n} ${x.n === 1 ? 'person' : 'people'} (${pct(x.n)}%)<br>${nameList(x.list)}`;
    const clients = Object.entries(s.clients).sort((a, b) => b[1].length - a[1].length);
    return `<div class="card billability" data-reveal>
      <div class="bl-head"><h3 class="h3">Billability <span class="muted" style="font-weight:450">· ${esc(opt.scope || 'Practice')}</span></h3><span class="bl-pct"><b class="num">${pct(s.billable)}%</b> billable <span class="muted">· ${fmt.monthLabel(month)}</span></span></div>
      <div class="bl-bar" role="img" aria-label="${segs.map((x) => `${x.label} ${x.n}`).join(', ')} of ${s.total}">${segs.filter((x) => x.n).map((x, i) => `<i class="${x.cls}" style="flex-grow:${x.n}" data-tip="${esc(tip(x))}" data-grow data-delay="${i * 0.08}"></i>`).join('')}</div>
      <div class="bl-legend">${segs.map((x) => `<span class="bl-item" data-tip="${esc(tip(x))}"><i class="bl-sw ${x.cls}"></i><b class="num">${x.n}</b> ${esc(x.label)} <em class="num">${pct(x.n)}%</em></span>`).join('')}</div>
      ${clients.length ? `<div class="bl-clients"><span class="bl-clabel">Non-Deloitte clients</span>${clients.map(([c, list]) => `<span class="bl-chip" data-tip="<b>${esc(c)}</b><br>${nameList(list)}">${esc(c)} <b class="num">${list.length}</b></span>`).join('')}</div>` : ''}
    </div>`;
  };
  // compact version for table cells
  C.billMini = (ids, month) => {
    const s = billSplit(ids, month || q.latestMonth()); if (!s.total) return '<span class="faint">–</span>';
    const segs = BL_GROUPS.map((b) => ({ ...b, n: s.g[b.k].length }));
    return `<span class="bl-mini" data-tip="${esc(segs.map((x) => `${x.label}: <b>${x.n}</b>`).join('<br>'))}"><span class="bl-mbar">${segs.filter((x) => x.n).map((x) => `<i class="${x.cls}" style="flex-grow:${x.n}"></i>`).join('')}</span><span class="num small">${s.billable}/${s.total}</span></span>`;
  };

  /* ---------- theme: follows the OS until the viewer picks one (a per-viewer convenience, stored locally) ---------- */
  // Dark mode is parked, not deleted: with DARK_MODE off the app is always light (the OS setting and any saved
  // choice are ignored) and the theme button isn't drawn. The dark tokens stay in styles.css; set this to true to bring it back.
  const DARK_MODE = false;
  const THEME_KEY = 'rmfvs.theme';
  RM.theme = {
    enabled: DARK_MODE,
    get() { const s = document.documentElement.dataset.theme; if (s === 'dark' || s === 'light') return s; return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; },
    apply(v) { if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme; },
    init() {
      if (!DARK_MODE) { RM.theme.apply('light'); return; } // data-theme="light" also overrides the OS dark preference in the CSS
      let v = null; try { v = localStorage.getItem(THEME_KEY); } catch (e) { /* storage blocked */ } if (v === 'dark' || v === 'light') RM.theme.apply(v);
    },
    icon() { return ic(RM.theme.get() === 'dark' ? 'sun-2-linear' : 'moon-linear'); },
    label() { return RM.theme.get() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'; },
    button(cls) { return DARK_MODE ? `<button type="button" class="icon-btn ${cls || ''}" data-action="theme" aria-label="${RM.theme.label()}" data-tip="${RM.theme.label()}">${RM.theme.icon()}</button>` : ''; },
    toggle() {
      if (!DARK_MODE) return 'light';
      const next = RM.theme.get() === 'dark' ? 'light' : 'dark'; RM.theme.apply(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage blocked */ }
      $$('[data-action="theme"]').forEach((b) => { b.innerHTML = RM.theme.icon(); b.setAttribute('aria-label', RM.theme.label()); b.dataset.tip = RM.theme.label(); });
      RM.tip.hide(); return next;
    },
  };
  // New Vision logo: the supplied file byte for byte (assets/brand/nv-logo.png, 842x596, transparent), shown exactly as is:
  // no outline, filter, recolouring, cropping or backing (owner's direction). h = height of the artwork itself.
  RM.nvLogo = (h) => `<span class="logo-plate" style="--logo-h:${h}px"><img class="nv-logo" src="assets/brand/nv-logo.png" alt="New Vision, Think Forward. A SoftServe Company" width="842" height="596"></span>`;

  /* ================= charts (inline SVG) ================= */
  const CH = RM.charts = {};
  // Bullet rows: forecast bar (light) and actual bar (dark), one per team or person. actual: null when nothing is uploaded yet;
  // fVar (optional): actual − forecast over the uploaded actuals only, for a month part-way through its uploads; it shows in the
  // row's tooltip only (no figure at the bar's end).
  // opt.f formats an amount (rupees by default); pass values already in its currency (US dollars: fmt.usdShort)
  CH.bullets = (rows, opt) => {
    opt = opt || {}; const M = opt.f || fmt.inr;
    const W = 720, rowH = 46, padL = 170, padR = 20, top = 8;
    const max = Math.max(1, ...rows.map((r) => Math.max(r.forecast, r.actual || 0))) * 1.06;
    const x = (v) => padL + (v / max) * (W - padL - padR);
    const H = top + rows.length * rowH + 26;
    const ticks = niceTicks(max, 4);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Forecast and actual by team')}">`;
    ticks.forEach((t) => { s += `<line class="grid-line" x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - 22}"/><text class="tick" x="${x(t)}" y="${H - 6}" text-anchor="middle">${M(t)}</text>`; });
    rows.forEach((r, i) => {
      const y = top + i * rowH; const cy = y + rowH / 2;
      const has = r.actual != null; const d = r.fVar != null ? r.fVar : (r.actual || 0) - r.forecast;
      const tip = `<b>${esc(r.name)}</b><div class='tip-row'><span><i class='sw' style='background:var(--viz-actual)'></i>Actual</span><b>${has ? M(r.actual) : 'not uploaded'}</b></div><div class='tip-row'><span><i class='sw' style='background:var(--viz-forecast)'></i>Forecast</span><b>${M(r.forecast)}</b></div><div class='tip-row'><span>Actual − forecast</span><b>${has ? M(d, { plus: true }) : '–'}</b></div>${r.note ? `<div class='tip-row'><span>${esc(r.note)}</span></div>` : ''}`;
      // a row drills into a team, or opens the person's profile
      s += `<g class="row-g" tabindex="0" data-tip="${esc(tip)}" ${r.drill ? `data-action="drill" data-id="${r.drill}" style="cursor:pointer"` : r.person && q.canOpenProfile(q.me(), q.person(r.person)) ? `data-action="open-person" data-id="${r.person}" style="cursor:pointer"` : ''}>`;
      s += `<rect class="hover-band" x="0" y="${y + 3}" width="${W}" height="${rowH - 6}" rx="10"/>`;
      s += `<text class="lbl${r.strong ? '-strong' : ''}" x="${padL - 14}" y="${cy + 4}" text-anchor="end">${esc(r.name.length > 22 ? r.name.slice(0, 21) + '…' : r.name)}</text>`;
      s += `<rect data-grow x="${padL}" y="${cy - 9}" width="${Math.max(0, x(r.forecast) - padL)}" height="18" rx="4" fill="var(--viz-forecast)"/>`;
      s += `<rect data-grow data-delay=".12" x="${padL}" y="${cy - 4}" width="${Math.max(0, x(r.actual || 0) - padL)}" height="8" rx="4" fill="var(--viz-actual)"/>`;
      s += `<rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}"/></g>`;
    });
    s += `<line class="axis-line" x1="${padL}" x2="${padL}" y1="${top}" y2="${H - 22}"/></svg>`;
    return `<div class="chart">${s}</div>`;
  };
  // Grouped monthly columns with a budget tick across each group. opt.series: [{ key, color }], drawn left to right with a
  // 2px gap; a null value leaves its slot empty. rows: [{ label, budget, [series key]: value, zone, tip }] (zone shades the month)
  // opt.stack: the series stack in one column (a 2px surface gap between segments) instead of standing side by side.
  // opt.ref: { value, label } draws a dashed reference line (a monthly target) across the plot, labelled at its right end.
  // row.mark: { ok, solid, label } puts a status marker above the column: a check (ok) or a cross, filled when it's settled
  // (actuals) and outlined when it rests on the forecast
  // opt.line: { key, color, label } draws one more measure in the same unit as a line with dots through the column centres,
  // on the same axis (never a second scale), ringed in the surface colour where it crosses the columns and labelled at its end.
  // A line value below zero takes the axis below zero.
  CH.columns = (rows, opt) => {
    opt = opt || {}; const series = opt.series || [{ key: 'value', color: 'var(--viz-actual)' }]; const stack = !!opt.stack; const ref = opt.ref || null; const line = opt.line || null;
    const W = opt.w || 600, H = opt.h || 236, padL = 54, padR = ref || line ? 74 : 6, top = rows.some((r) => r.mark) ? 34 : 26, bot = 26, gap = 2;
    const colMax = (r) => (stack ? series.reduce((a, se) => a + (r[se.key] || 0), 0) : Math.max(0, ...series.map((se) => r[se.key] || 0)));
    // opt.max fixes the top of the scale (a percentage chart runs to 100); opt.barMax widens a grouped column (16px by default);
    // opt.labels(v) writes each value over its column; a row's empty text holds its place while it has no values
    const max = opt.max || Math.max(1, ref ? ref.value : 0, ...rows.flatMap((r) => [r.budget || 0, colMax(r), line ? r[line.key] || 0 : 0])) * 1.06;
    const min = Math.min(0, ...(line ? rows.map((r) => r[line.key] || 0) : [])) * 1.06;
    const y = (v) => top + (1 - (v - min) / (max - min)) * (H - top - bot); const base = y(0); const floor = H - bot;
    const band = (W - padL - padR) / rows.length; const bw = stack ? Math.min(26, band * 0.56) : Math.min(opt.barMax || 16, (band * 0.7 - gap * (series.length - 1)) / series.length);
    const gw = stack ? bw : bw * series.length + gap * (series.length - 1);
    const colPath = (x0, w, yb, yt, round) => { const rr = round ? Math.min(4, yb - yt, w / 2) : 0;
      return `M${x0.toFixed(1)} ${yb.toFixed(1)}V${(yt + rr).toFixed(1)}Q${x0.toFixed(1)} ${yt.toFixed(1)} ${(x0 + rr).toFixed(1)} ${yt.toFixed(1)}H${(x0 + w - rr).toFixed(1)}Q${(x0 + w).toFixed(1)} ${yt.toFixed(1)} ${(x0 + w).toFixed(1)} ${(yt + rr).toFixed(1)}V${yb.toFixed(1)}Z`; };
    const yf = opt.yFmt || ((v) => fmt.inr(v));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Monthly values against budget')}">`;
    const f0 = rows.findIndex((r) => r.zone);
    if (f0 >= 0) s += `<rect class="fc-zone" x="${padL + band * f0}" y="2" width="${band * (rows.length - f0)}" height="${floor - 2}" rx="10"/><text class="tick" x="${padL + band * f0 + 10}" y="17">${esc(opt.zoneLabel || 'Forecast')}</text>`;
    niceTicks(max, 4, min).forEach((t) => { s += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${padL - 10}" y="${y(t) + 4}" text-anchor="end">${yf(t)}</text>`; });
    rows.forEach((r, i) => {
      const cx = padL + band * (i + 0.5); const gx = cx - gw / 2;
      s += `<g class="row-g" tabindex="0" data-tip="${esc(r.tip || '')}">`;
      s += `<rect class="hover-band" x="${cx - band / 2 + 2}" y="${top - 6}" width="${band - 4}" height="${floor - top + 6}" rx="8"/>`;
      if (stack) {
        // segments bottom up; only the top one gets the 4px rounded data end, and each sits 2px above the one below
        const segs = series.map((se) => ({ v: r[se.key] || 0, color: se.color })).filter((g) => g.v > 0); let acc = 0;
        segs.forEach((g, k) => { const yb = k ? y(acc) - gap : base; acc += g.v; const yt = y(acc); if (yb - yt < 0.5) return;
          s += `<path data-rise data-delay="${(i * 0.03).toFixed(2)}" d="${colPath(gx, bw, yb, yt, k === segs.length - 1)}" fill="${g.color}"/>`; });
      } else series.forEach((se, k) => {
        const v = r[se.key]; if (v == null) return;
        // 4px rounded data end, square at the baseline
        s += `<path data-rise data-delay="${(i * 0.03 + k * 0.06).toFixed(2)}" d="${colPath(gx + k * (bw + gap), bw, base, y(v), true)}" fill="${se.color}"/>`;
        // opt.labels: the value over its column, landing once the column is up
        if (opt.labels) s += `<text class="col-val" data-pop data-delay="${(.36 + i * 0.03 + k * 0.06).toFixed(2)}" x="${(gx + k * (bw + gap) + bw / 2).toFixed(1)}" y="${(y(v) - 6).toFixed(1)}" text-anchor="middle">${esc(opt.labels(v))}</text>`;
      });
      // r.empty: a row with no values yet keeps its place, a dashed outline with what it's waiting on
      if (!stack && r.empty && series.every((se) => r[se.key] == null)) s += `<g data-pop data-delay="${(.12 + i * 0.03).toFixed(2)}"><rect class="col-empty" x="${gx.toFixed(1)}" y="${(base - 30).toFixed(1)}" width="${gw.toFixed(1)}" height="30" rx="4"/><text class="col-empty-l" x="${cx}" y="${(base - 38).toFixed(1)}" text-anchor="middle">${esc(r.empty)}</text></g>`;
      if (r.mark) {
        // above its column, and above the reference line when the column stops short of it, so the marker never sits on the dashes
        const my = Math.min(y(colMax(r)), ref ? y(ref.value) : Infinity) - 12; const c = r.mark.ok ? 'var(--ok-dot)' : 'var(--warn-dot)'; const ink = r.mark.solid ? 'var(--surface)' : c;
        // the marker lands once its own column has risen under it
        s += `<g class="col-mark" aria-hidden="true" data-pop data-delay="${(.3 + i * .03).toFixed(2)}"><circle cx="${cx}" cy="${my}" r="7" fill="${r.mark.solid ? c : 'var(--surface)'}" stroke="${c}" stroke-width="1.5"/>`
          + (r.mark.ok ? `<path d="M${cx - 3.2} ${my + 0.2}l2.2 2.2 4.2-4.4" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
            : `<path d="M${cx - 2.6} ${my - 2.6}l5.2 5.2M${cx + 2.6} ${my - 2.6}l-5.2 5.2" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`) + '</g>';
      }
      if (r.budget) s += `<rect x="${(gx - 4).toFixed(1)}" y="${(y(r.budget) - 1.25).toFixed(1)}" width="${(gw + 8).toFixed(1)}" height="2.5" rx="1" fill="var(--viz-goal)" stroke="var(--surface)" stroke-width="1.5" paint-order="stroke"/>`;
      s += `<text class="tick" x="${cx}" y="${H - 7}" text-anchor="middle">${esc(r.label)}</text>`;
      s += `<rect class="hit" x="${cx - band / 2}" y="${top - 6}" width="${band}" height="${H - top + 6}"/></g>`;
    });
    if (ref) { const ry = y(ref.value); s += `<line class="ref-line" x1="${padL}" x2="${W - padR + 4}" y1="${ry.toFixed(1)}" y2="${ry.toFixed(1)}"/><text class="ref-lbl" x="${W - padR + 8}" y="${(ry - 3).toFixed(1)}">${esc(ref.label)}</text><text class="tick" x="${W - padR + 8}" y="${(ry + 11).toFixed(1)}">${esc(yf(ref.value))}</text>`; }
    if (line) {
      // over the columns, so it never takes the hover from them; the surface ring keeps it apart where it crosses a column
      const pts = rows.map((r, i) => (r[line.key] == null ? null : [padL + band * (i + 0.5), y(r[line.key])]));
      const d = pts.reduce((acc, p, i) => (p ? acc + (acc && pts[i - 1] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) : acc), '');
      // it draws once the columns have mostly risen (0.6s, ease-out), each dot appearing as the line reaches it
      const n = pts.length; const at = (i) => (.22 + (n > 1 ? i / (n - 1) : 0) * .6).toFixed(2);
      s += `<g class="col-line" aria-hidden="true"><path data-draw data-delay=".2" data-dur=".6" d="${d}" fill="none" stroke="var(--surface)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path data-draw data-delay=".2" data-dur=".6" d="${d}" fill="none" stroke="${line.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach((p, i) => { if (p) s += `<circle data-pop data-delay="${at(i)}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--surface)" stroke="${line.color}" stroke-width="2"/>`; });
      const last = pts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0).pop();
      if (last != null && last >= 0) { const ly = Math.abs(pts[last][1] - (ref ? y(ref.value) : -99)) < 30 ? pts[last][1] + 18 : pts[last][1]; s += `<text class="ref-lbl" x="${W - padR + 8}" y="${(ly - 3).toFixed(1)}" style="fill:${line.color}">${esc(line.label)}</text><text class="tick" x="${W - padR + 8}" y="${(ly + 11).toFixed(1)}">${esc(yf(rows[last][line.key]))}</text>`; }
      s += '</g>';
    }
    s += `<line class="axis-line" x1="${padL}" x2="${W - padR}" y1="${base.toFixed(1)}" y2="${base.toFixed(1)}"/></svg>`;
    return `<div class="chart cols-chart">${s}</div>`;
  };
  // Multi-line chart with direct end labels + crosshair tooltip
  CH.lines = (series, labels, opt) => {
    opt = opt || {};
    const W = opt.w || 720, H = opt.h || 260, padL = opt.padL || 56, padR = opt.padR || 92, top = 16, bot = 30;
    const all = series.flatMap((s) => s.values.filter((v) => v != null));
    let min = opt.min != null ? opt.min : Math.min(...all), max = opt.max != null ? opt.max : Math.max(...all);
    if (opt.min == null) { const pad = (max - min) * 0.25 || max * 0.1; min = Math.max(0, min - pad); max = max + pad * 0.6; }
    if (!(max > min)) max = min + 1; // flat or empty series: avoid a zero-height scale
    const n = labels.length;
    const x = (i) => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
    const y = (v) => top + (1 - (v - min) / (max - min)) * (H - top - bot);
    const ticks = opt.ticks || niceTicks(max, 4, min);
    const yf = opt.yFmt || ((v) => v);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Trend')}" data-linechart>`;
    ticks.forEach((t) => { if (t < min || t > max) return; s += `<line class="grid-line" x1="${padL}" x2="${W - padR + 8}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${padL - 10}" y="${y(t) + 4}" text-anchor="end">${yf(t)}</text>`; });
    labels.forEach((l, i) => { s += `<text class="tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>`; });
    const endLabels = [];
    series.forEach((se) => {
      const pts = se.values.map((v, i) => (v == null ? null : [x(i), y(v)]));
      const d = pts.reduce((acc, p, i) => (p ? acc + (acc && pts[i - 1] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) : acc), '');
      s += `<path data-draw d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${se.dash ? 'stroke-dasharray="5 5"' : ''}/>`;
      pts.forEach((p) => { if (p && !se.noDots) s += `<circle data-pop cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--surface)" stroke="${se.color}" stroke-width="2"/>`; });
      const li = pts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0).pop();
      if (li != null && li >= 0) endLabels.push({ y: pts[li][1], x: pts[li][0], label: se.name, color: se.color, v: se.values[li] });
    });
    // de-collide end labels
    endLabels.sort((a, b) => a.y - b.y); for (let i = 1; i < endLabels.length; i++) if (endLabels[i].y - endLabels[i - 1].y < 15) endLabels[i].y = endLabels[i - 1].y + 15;
    endLabels.forEach((e) => { s += `<text class="lbl" x="${e.x + 10}" y="${e.y + 4}" style="font-weight:600">${esc(e.label)}</text>`; });
    s += `<line class="crosshair" x1="0" x2="0" y1="${top}" y2="${H - bot}" stroke="var(--ink-4)" stroke-dasharray="3 3" opacity="0"/>`;
    s += `<rect class="hit" x="${padL - 10}" y="${top}" width="${W - padL - padR + 20}" height="${H - top - bot}" data-lc-hit/>`;
    s += `</svg>`;
    const payload = esc(JSON.stringify({ labels, series: series.map((se) => ({ name: se.name, color: se.color, values: se.values })), fmt: opt.tipFmt || 'inr', geo: { W, padL, padR, n } }));
    return `<div class="chart" data-lc="${payload}">${s}</div>`;
  };
  function niceTicks(max, count, min) {
    min = min || 0; const span = max - min; const raw = span / count; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || mag * 10;
    const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6)); return out;
  }
  CH.niceTicks = niceTicks;

  /* ================= tooltip ================= */
  let tipEl;
  function tipShow(html, x, y) {
    if (!tipEl || !tipEl.isConnected) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    tipEl.innerHTML = html; tipEl.classList.add('is-on');
    const r = tipEl.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    tipEl.style.left = Math.max(8, left) + 'px'; tipEl.style.top = Math.max(8, top) + 'px';
  }
  function tipHide() { if (tipEl) tipEl.classList.remove('is-on'); }
  RM.tip = { show: tipShow, hide: tipHide };
  document.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-tip]'); if (t && t.dataset.tip) { tipShow(t.dataset.tip, e.clientX, e.clientY); } });
  document.addEventListener('pointermove', (e) => { const t = e.target.closest('[data-tip]'); if (t && t.dataset.tip) tipShow(t.dataset.tip, e.clientX, e.clientY); else if (!e.target.closest('[data-lc]')) tipHide(); });
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('[data-tip],[data-lc]')) tipHide(); });
  document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.dataset.tip) { const r = t.getBoundingClientRect(); tipShow(t.dataset.tip, r.left + Math.min(r.width, 220) / 2, r.bottom - 6); } });
  document.addEventListener('focusout', tipHide);
  // line-chart crosshair
  document.addEventListener('pointermove', (e) => {
    const hit = e.target.closest && e.target.closest('[data-lc-hit]'); if (!hit) return;
    const wrap = hit.closest('[data-lc]'); const svg = wrap.querySelector('svg'); const data = JSON.parse(wrap.dataset.lc);
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const { W, padL, padR, n } = data.geo; const i = Math.max(0, Math.min(n - 1, Math.round(((loc.x - padL) / (W - padL - padR)) * (n - 1))));
    const cx = padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
    const ch = svg.querySelector('.crosshair'); ch.setAttribute('x1', cx); ch.setAttribute('x2', cx); ch.setAttribute('opacity', 1);
    const f = data.fmt === 'score' ? fmt.score : data.fmt === 'pct' ? (v) => RM.RV.fmtPct(v) : data.fmt === 'usd' ? fmt.usdShort : fmt.inr;
    tipShow(`<b>${esc(data.labels[i])}</b>` + data.series.map((s) => `<div class='tip-row'><span><i class='sw' style='background:${s.color}'></i>${esc(s.name)}</span><b>${f(s.values[i])}</b></div>`).join(''), e.clientX, e.clientY);
  });
  document.addEventListener('pointerout', (e) => { const hit = e.target.closest && e.target.closest('[data-lc-hit]'); if (hit) { const ch = hit.closest('svg').querySelector('.crosshair'); if (ch) ch.setAttribute('opacity', 0); } });
  // avatar fallback
  document.addEventListener('error', (e) => {
    const img = e.target; if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
    const av = img.parentElement; av.classList.add('av-tile'); av.style.background = '#9FB8C9'; av.textContent = img.dataset.fallback;
  }, true);

  /* ================= overlays ================= */
  const O = RM.overlay = {};
  let stackDepth = 0;
  // Lock on <body>, never <html>: hidden overflow on the root stops body's overflow from propagating to the
  // viewport, which turns <body> into the scroll container and unpins the sticky sidebar mid-page.
  function lockScroll(on) { document.body.style.overflow = on ? 'hidden' : ''; }
  function trap(root, e) {
    if (e.key !== 'Tab') return;
    const f = $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', root).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  O.drawer = (html, opt) => {
    opt = opt || {};
    O.closeDrawer(true);
    const prev = document.activeElement;
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.dataset.drawerScrim = '';
    const d = document.createElement('aside'); d.className = 'drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', opt.label || 'Details'); d.setAttribute('data-lenis-prevent', '');
    d.innerHTML = html; document.body.append(scrim, d); stackDepth++; lockScroll(true);
    const close = () => O.closeDrawer();
    scrim.addEventListener('click', close);
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.querySelector('.modal')) { e.stopPropagation(); close(); } trap(d, e); });
    d._prev = prev; d._onClose = opt.onClose;
    if (RM.reduced() || !window.gsap) { scrim.style.opacity = 1; d.style.transform = 'none'; }
    else { gsap.to(scrim, { opacity: 1, duration: .3, ease: 'power2.out' }); gsap.fromTo(d, { x: '110%' }, { x: '0%', duration: .56, ease: 'expo.out' }); const rv = d.querySelectorAll('[data-reveal]'); gsap.fromTo(rv, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .5, stagger: .05, delay: .18, ease: 'power3.out', clearProps: 'opacity,transform' });
      setTimeout(() => rv.forEach((el) => { gsap.killTweensOf(el); el.style.opacity = ''; el.style.transform = ''; }), 2000); } // throttled frames never leave content hidden
    requestAnimationFrame(() => { const f = d.querySelector('[autofocus]') || d.querySelector('.x-btn'); if (f) f.focus(); });
    if (opt.onMount) opt.onMount(d);
    return d;
  };
  O.closeDrawer = (instant) => {
    const d = $('.drawer'), s = $('[data-drawer-scrim]'); if (!d) return;
    const done = () => { d.remove(); s && s.remove(); stackDepth = Math.max(0, stackDepth - 1); if (!stackDepth) lockScroll(false); if (d._prev && d._prev.focus && document.contains(d._prev)) d._prev.focus(); if (d._onClose) d._onClose(); };
    if (instant || RM.reduced() || !window.gsap) return done();
    let fired = false; const once = () => { if (!fired) { fired = true; done(); } };
    gsap.to(s, { opacity: 0, duration: .22 }); gsap.to(d, { x: '110%', duration: .34, ease: 'power3.in', onComplete: once }); setTimeout(once, 450);
  };
  // modal: returns Promise<{ok, value}>
  O.modal = (opt) => new Promise((resolve) => {
    const prev = document.activeElement;
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.style.zIndex = 94;
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
    const id = 'm' + Math.random().toString(36).slice(2, 7);
    wrap.innerHTML = `<div class="modal${opt.wide ? ' is-wide' : ''}" role="${opt.tone === 'bad' ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-b" data-lenis-prevent>
      <div class="modal-head"><div class="m-ic ${opt.tone ? 'is-' + opt.tone : ''}">${ic(opt.icon || 'info-circle-linear')}</div><div style="min-width:0"><h2 class="h3" id="${id}-t" style="font-size:18px">${opt.title}</h2>${opt.sub ? `<p class="small muted" style="margin-top:3px">${opt.sub}</p>` : ''}</div><button class="x-btn" type="button" data-m="cancel" aria-label="Close">${ic('close-circle-linear')}</button></div>
      <div class="modal-body" id="${id}-b">${opt.body || ''}</div>
      <div class="modal-foot"><button type="button" class="btn btn-secondary" data-m="cancel">${opt.cancel || 'Cancel'}</button><button type="button" class="btn ${opt.tone === 'bad' ? 'btn-danger-solid' : 'btn-primary'}" data-m="ok">${opt.confirm || 'Confirm'}</button></div></div>`;
    document.body.append(scrim, wrap); stackDepth++; lockScroll(true);
    const m = wrap.querySelector('.modal');
    const finish = (ok) => {
      let value = null;
      if (ok && opt.validate) { value = opt.validate(m); if (value === false) return; }
      let ended = false;
      const end = () => { if (ended) return; ended = true; scrim.remove(); wrap.remove(); stackDepth = Math.max(0, stackDepth - 1); if (!stackDepth) lockScroll(false); if (prev && prev.focus) prev.focus(); resolve({ ok, value }); };
      if (RM.reduced() || !window.gsap) return end();
      gsap.to(scrim, { opacity: 0, duration: .18 }); gsap.to(m, { opacity: 0, y: 6, scale: .985, duration: .18, ease: 'power2.in', onComplete: end }); setTimeout(end, 300);
    };
    wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) finish(b.dataset.m === 'ok'); });
    scrim.addEventListener('click', () => finish(false));
    m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(false); } trap(m, e); if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); finish(true); } });
    if (RM.reduced() || !window.gsap) { scrim.style.opacity = 1; m.style.opacity = 1; m.style.transform = 'none'; }
    else { gsap.to(scrim, { opacity: 1, duration: .22 }); gsap.to(m, { opacity: 1, y: 0, scale: 1, duration: .32, ease: 'power3.out' }); }
    requestAnimationFrame(() => { const f = m.querySelector('[autofocus]') || m.querySelector('[data-m="ok"]'); f && f.focus(); });
    if (opt.onMount) opt.onMount(m);
  });
  // toast with optional action
  O.toast = (msg, opt) => {
    opt = opt || {};
    let host = $('.toasts'); if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
    const t = document.createElement('div'); t.className = 'toast' + (opt.tone ? ' is-' + opt.tone : '');
    t.innerHTML = `${ic(opt.icon || (opt.tone === 'warn' ? 'danger-circle-bold' : opt.tone === 'info' ? 'info-circle-bold' : 'check-circle-bold'))}<span>${msg}</span>${opt.action ? `<button type="button" class="t-act">${esc(opt.action.label)}</button>` : ''}`;
    host.appendChild(t);
    const kill = () => { if (!t.isConnected) return; if (RM.reduced() || !window.gsap) return t.remove(); gsap.to(t, { opacity: 0, y: 10, duration: .2, onComplete: () => t.remove() }); };
    if (opt.action) t.querySelector('.t-act').addEventListener('click', () => { opt.action.fn(); kill(); });
    if (!RM.reduced() && window.gsap) gsap.from(t, { opacity: 0, y: 16, scale: .96, duration: .36, ease: 'back.out(1.6)' });
    setTimeout(kill, opt.ms || (opt.action ? 6500 : 4200));
  };
  // popover anchored to a button
  O.popover = (anchor, html, label) => {
    const existing = $('.popover'); const same = existing && existing._anchor === anchor; O.closePopover(); if (same) return;
    const p = document.createElement('div'); p.className = 'popover'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', label || 'Menu'); p.innerHTML = html; p._anchor = anchor; p.setAttribute('data-lenis-prevent', '');
    document.body.appendChild(p);
    // open from the anchor's nearer edge: right-aligned under top-bar buttons, left-aligned under the sidebar's account button
    const r = anchor.getBoundingClientRect(); const pw = p.offsetWidth; const fromLeft = r.left + r.width / 2 < window.innerWidth / 2;
    p.style.top = (r.bottom + 10) + 'px'; p.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, fromLeft ? r.left : r.right - pw)) + 'px';
    p.style.transformOrigin = fromLeft ? 'top left' : 'top right';
    anchor.setAttribute('aria-expanded', 'true');
    if (RM.reduced() || !window.gsap) { p.style.opacity = 1; p.style.transform = 'none'; } else gsap.to(p, { opacity: 1, y: 0, duration: .24, ease: 'power3.out' });
    const f = p.querySelector('button, a'); f && f.focus();
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
    p.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); O.closePopover(); anchor.focus(); } }); // Escape closes the menu only, not the drawer it came from
    function outside(e) { if (!p.contains(e.target) && !anchor.contains(e.target)) O.closePopover(); }
    p._outside = outside;
  };
  O.closePopover = () => { const p = $('.popover'); if (!p) return; document.removeEventListener('pointerdown', p._outside); p._anchor && p._anchor.setAttribute('aria-expanded', 'false'); p.remove(); };

  /* ================= motion ================= */
  const M = RM.motion = {};
  M.split = (root) => {
    $$('[data-split]', root).forEach((el) => {
      if (el.dataset.splitDone) return; el.dataset.splitDone = '1';
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      const nodes = Array.from(el.childNodes); el.textContent = '';
      nodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return; if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(' ')); return; }
            const line = document.createElement('span'); line.className = 'split-line'; line.setAttribute('aria-hidden', 'true');
            const word = document.createElement('span'); word.className = 'split-word'; word.textContent = w; line.appendChild(word); el.appendChild(line);
          });
        } else if (n.nodeType === 1) {
          const line = document.createElement('span'); line.className = 'split-line'; line.setAttribute('aria-hidden', 'true');
          const word = document.createElement('span'); word.className = 'split-word'; word.appendChild(n); line.appendChild(word); el.appendChild(line);
        }
      });
    });
  };
  // every intro animation is settled to its final frame after a short timer, so a paused or
  // throttled frame (background tab, thumbnail capture) never leaves content hidden or half-drawn
  const settle = (anims, ms) => { const list = anims.filter(Boolean); if (list.length) setTimeout(() => list.forEach((a) => { if (a.progress() < 1) a.progress(1); }), ms || 1900); };
  M.settle = settle;
  M.countUp = (root, instant) => {
    const tw = [];
    $$('[data-count]', root).forEach((el) => {
      const to = parseFloat(el.dataset.count); const dec = +(el.dataset.dec || 0);
      if (instant || RM.reduced() || !window.gsap || isNaN(to)) { el.textContent = dec ? to.toFixed(dec) : Math.round(to); return; }
      const o = { v: 0 }; tw.push(gsap.to(o, { v: to, duration: .9, ease: 'power3.out', delay: .15, onUpdate: () => { el.textContent = dec ? o.v.toFixed(dec) : Math.round(o.v); } }));
    });
    settle(tw);
  };
  M.charts = (root, instant) => {
    const grows = $$('[data-grow]', root); const rises = $$('[data-rise]', root); const draws = $$('[data-draw]', root); const pops = $$('[data-pop]', root); const meters = $$('[data-meter]', root);
    if (instant || RM.reduced() || !window.gsap) return;
    const tw = [];
    grows.forEach((el) => { tw.push(gsap.from(el, { scaleX: 0, transformOrigin: '0% 50%', duration: .8, delay: .25 + (+el.dataset.delay || 0), ease: 'expo.out' })); });
    rises.forEach((el) => { tw.push(gsap.from(el, { scaleY: 0, transformOrigin: '50% 100%', duration: .8, delay: .25 + (+el.dataset.delay || 0), ease: 'expo.out' })); });
    meters.forEach((el) => tw.push(gsap.from(el, { scaleX: 0, transformOrigin: '0% 50%', duration: .9, delay: .3, ease: 'expo.out' })));
    // a draw or a pop can carry its own timing (data-delay, data-dur): the profit line waits for the columns under it
    draws.forEach((el) => { const L = el.getTotalLength ? el.getTotalLength() : 0; if (!L) return; const dash = el.getAttribute('stroke-dasharray'); tw.push(gsap.fromTo(el, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: +(el.dataset.dur || 1.1), delay: .25 + (+el.dataset.delay || 0), ease: el.dataset.dur ? 'power2.out' : 'power2.inOut', onComplete: () => { if (dash) el.setAttribute('stroke-dasharray', dash); else el.removeAttribute('stroke-dasharray'); el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; } })); });
    pops.forEach((el, i) => tw.push(gsap.from(el, { opacity: 0, duration: el.dataset.delay ? .18 : .3, delay: el.dataset.delay ? .25 + +el.dataset.delay : .6 + i * .02 })));
    settle(tw, 2200);
  };
  M.page = (root) => {
    M.split(root);
    const heads = $$('[data-split] .split-word', root);
    const reveals = $$('[data-reveal]', root);
    if (RM.reduced() || !window.gsap) { reveals.forEach((el) => { el.style.opacity = 1; }); M.countUp(root, true); return; }
    const tl = gsap.timeline();
    if (heads.length) tl.from(heads, { yPercent: 105, duration: .8, stagger: .04, ease: 'expo.out' }, 0);
    const above = [], below = [];
    reveals.forEach((el) => (el.getBoundingClientRect().top < window.innerHeight * 0.96 ? above : below).push(el));
    if (above.length) tl.fromTo(above, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .64, stagger: .055, ease: 'power3.out', clearProps: 'transform' }, heads.length ? .18 : 0);
    below.forEach((el) => { el.style.opacity = 1; }); // below the fold is readable at rest; nothing waits on a scroll trigger
    settle([tl]);
    M.countUp(root); M.charts(root);
  };
  M.segThumb = (root) => {
    $$('.seg', root).forEach((seg) => {
      const thumb = seg.querySelector('.seg-thumb'); const act = seg.querySelector('[aria-selected="true"]');
      if (!thumb) return; if (!act) { thumb.style.opacity = 0; return; }
      thumb.style.opacity = 1; thumb.style.width = act.offsetWidth + 'px'; thumb.style.transform = `translateX(${act.offsetLeft}px)`;
    });
  };
  // the nav scrolls when a role's pages don't fit: fade whichever edge has more behind it
  M.navFade = () => {
    const nav = $('.nav'); if (!nav) return;
    nav.style.setProperty('--sbw', (nav.offsetWidth - nav.clientWidth) + 'px');
    nav.classList.toggle('can-up', nav.scrollTop > 1);
    nav.parentElement.classList.toggle('nav-scrolled', nav.scrollTop > 1);
    nav.classList.toggle('can-down', nav.scrollTop + nav.clientHeight < nav.scrollHeight - 1);
  };
  M.navThumb = (instant) => {
    const nav = $('.nav'); if (!nav) return; const thumb = nav.querySelector('.nav-thumb'); const act = nav.querySelector('[aria-current="page"]');
    M.navFade();
    if (!thumb) return; if (!act) { thumb.style.opacity = 0; return; }
    if (instant) thumb.style.transition = 'none';
    thumb.style.opacity = 1; thumb.style.height = act.offsetHeight + 'px'; thumb.style.transform = `translateY(${act.offsetTop}px)`;
    if (instant) requestAnimationFrame(() => { thumb.style.transition = ''; });
    // keep the current page in view (the nav is its own scroller, so this never moves the page)
    const pad = 28, top = act.offsetTop, bottom = top + act.offsetHeight;
    if (top - pad < nav.scrollTop) nav.scrollTo({ top: Math.max(0, top - pad), behavior: instant || RM.reduced() ? 'auto' : 'smooth' });
    else if (bottom + pad > nav.scrollTop + nav.clientHeight) nav.scrollTo({ top: bottom + pad - nav.clientHeight, behavior: instant || RM.reduced() ? 'auto' : 'smooth' });
  };
})(window.RM);
