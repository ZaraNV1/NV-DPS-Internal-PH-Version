/* NV-DPS-Internal Practice Head & Admin views, org constellation */
(function (RM) {
  'use strict';
  const { esc, ic, q, fmt, C } = RM;
  const V = RM.views = RM.views || {};
  const store = RM.store; const RV = RM.RV;
  const unitIds = (id) => [id, ...q.descendants(id).map((d) => d.p.id)];
  // the quarterly records in play: each person's last quarter, plus any earlier one that never locked (active people only)
  const curRecs = () => RV.recs().filter((r) => { const p = q.person(r.emp); return !q.isFrozen(r) && !!p && p.status === 'Active' && (r.key === RV.marksQuarter(p).key || !RV.isLocked(r)); });
  const PH_ID = () => (store.db.people.find((p) => p.role === 'Practice Head') || {}).id;
  const profileHref = (id) => '#/people/' + id; // the employee profile (Admin and Practice Head)
  // Clusters on Financial Performance: everyone with a financial target (from the employee sheet) leads one, as does the
  // Practice Head. A cluster is its lead plus their reportees, down to the next lead (finScope). Only leads get a page there.
  const isLead = (p) => !!p && p.status === 'Active' && (p.id === PH_ID() || p.finTarget === true);
  RM.leadsCluster = (p) => isLead(p) && p.id !== PH_ID(); // a cluster of their own below the practice (the profile links to it)
  const nowISO = (n) => new Date(RM.TODAY.getTime() + ((store.db.audit.length + (n || 0)) % 50) * 60000).toISOString();
  const audit = (by, action, entity, prev, next, note) => store.db.audit.unshift({ at: nowISO(), by, action, entity, prev, next, note });
  RM.audit = audit;

  /* ================= ORG CONSTELLATION ================= */
  RM.constellation = function (rootId, opt) {
    opt = opt || {};
    const radii = opt.radii || [0, 0.34, 0.62, 0.8, 0.95];
    const sizes = opt.sizes || [12.5, 7.4, 5.6, 5.2, 5]; // % of the canvas's shorter side (cqmin)
    const nodes = []; const links = [];
    const weight = (id, depth) => { const kids = q.directs(id); if (!kids.length) return depth === 1 ? 1.8 : 1; return kids.reduce((a, k) => a + weight(k.id, depth + 1), 0); };
    const place = (id, depth, a0, a1, parent) => {
      const a = (a0 + a1) / 2; const r = radii[Math.min(depth, 4)];
      const n = { id, depth, a, r, x: 50 + Math.cos(a) * r * 50, y: 50 + Math.sin(a) * r * 50, parent };
      nodes.push(n); if (parent) links.push({ from: parent, to: n });
      const kids = q.directs(id); const tw = kids.reduce((s, k) => s + weight(k.id, depth + 1), 0); let cur = a0;
      kids.forEach((k) => { const w = weight(k.id, depth + 1); const span = (a1 - a0) * (w / tw); place(k.id, depth + 1, cur, cur + span, n); cur += span; });
    };
    place(rootId, 0, -Math.PI * 1.5, Math.PI * 0.5, null);
    const path = (l, dx1, dy1, dx2, dy2) => {
      const p = l.from, c = l.to; const mid = (p.r + c.r) / 2;
      const x1 = (p.x + (dx1 || 0)) * 10, y1 = (p.y + (dy1 || 0)) * 10, x2 = (c.x + (dx2 || 0)) * 10, y2 = (c.y + (dy2 || 0)) * 10;
      const pa = p.depth === 0 ? c.a : p.a;
      const c1x = (50 + Math.cos(pa) * mid * 50 + (dx1 || 0)) * 10, c1y = (50 + Math.sin(pa) * mid * 50 + (dy1 || 0)) * 10;
      const c2x = (50 + Math.cos(c.a) * mid * 50 + (dx2 || 0)) * 10, c2y = (50 + Math.sin(c.a) * mid * 50 + (dy2 || 0)) * 10;
      return `M${x1.toFixed(1)} ${y1.toFixed(1)}C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };
    // viewBox is stretched to the canvas (preserveAspectRatio none) so a wide canvas becomes an ellipse;
    // strokes stay 1px via vector-effect in CSS
    const svg = `<svg class="links" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${radii.slice(1, 4).map((r) => `<ellipse class="ring" cx="500" cy="500" rx="${r * 500}" ry="${r * 500}"/>`).join('')}${links.map((l, i) => `<path data-link="${i}" data-to="${l.to.id}" data-depth="${l.to.depth}" d="${path(l)}"/>`).join('')}</svg>`;
    const html = nodes.map((n) => {
      const p = q.person(n.id); const s = sizes[Math.min(n.depth, 4)];
      const tip = `<b>${esc(p.name)}</b><br>${esc(p.designation)}${p.alloc && p.alloc !== '–' ? ' · ' + esc(p.alloc) : ''}`;
      const label = opt.labels && n.depth <= 1 ? `<span class="c-label" data-label="${n.id}" style="left:${n.x}%;top:calc(${n.y}% + ${s / 2}cqmin + 6px)" aria-hidden="true">${esc(n.depth ? fmt.first(p.name) : p.name)}</span>` : '';
      return `<button type="button" class="c-node" data-node="${n.id}" data-depth="${n.depth}" style="left:${n.x}%;top:${n.y}%" data-tip="${esc(tip)}" aria-label="${esc(p.name)}, ${esc(p.designation)}" ${opt.static ? 'tabindex="-1"' : ''}>${C.avatar(p, '', '', `--s:${s}cqmin`)}</button>${label}`;
    }).join('');
    const out = `<div class="constellation ${opt.light ? 'on-light' : ''}" data-constellation>${svg}${html}</div>`;
    return { html: out, nodes, links, path };
  };
  RM.mountConstellation = function (el, model, opt) {
    opt = opt || {};
    const reduce = RM.reduced() || !window.gsap;
    const nodesEl = RM.$$('.c-node', el); const pathsEl = RM.$$('path[data-link]', el); const rings = RM.$$('.ring', el);
    if (!reduce) {
      const tl = gsap.timeline({ delay: opt.delay || 0 });
      setTimeout(() => { if (tl.progress() < 1) tl.progress(1); }, 4000); // never leave the map half-drawn
      tl.fromTo(rings, { opacity: 0 }, { opacity: 1, duration: 1.1, stagger: .12, ease: 'expo.out', clearProps: 'opacity' }, 0);
      [0, 1, 2, 3, 4].forEach((d) => {
        const ns = nodesEl.filter((n) => +n.dataset.depth === d); const ps = pathsEl.filter((p) => +p.dataset.depth === d);
        // non-scaling strokes dash in screen units; 3x the user-space length covers any canvas size
        ps.forEach((p) => { const L = p.getTotalLength() * 3; gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
        if (ps.length) tl.to(ps, { strokeDashoffset: 0, duration: .7, stagger: .02, ease: 'power2.out', onComplete: () => ps.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }) }, .15 + d * .22);
        // explicit end state + cleared props: the avatar's CSS transform transition must never capture a mid-tween value
        const avs = ns.map((n) => n.querySelector('.av'));
        if (avs.length) { gsap.set(avs, { transition: 'none', scale: .4, opacity: 0 }); tl.to(avs, { scale: 1, opacity: 1, duration: .6, stagger: .03, ease: 'back.out(1.7)', clearProps: 'transform,scale,opacity,transition' }, .1 + d * .22 + (d ? .18 : 0)); }
      });
    }
    // pointer parallax: additive, fine pointers only
    if (opt.parallax && !reduce && window.matchMedia('(pointer: fine)').matches) {
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, active = false;
      const byId = Object.fromEntries(model.nodes.map((n) => [n.id, n]));
      const frame = () => {
        cx += (tx - cx) * .08; cy += (ty - cy) * .08;
        const off = (n) => [cx * n.depth * .9, cy * n.depth * .9];
        nodesEl.forEach((b) => { const n = byId[b.dataset.node]; const [dx, dy] = off(n); b.style.left = (n.x + dx) + '%'; b.style.top = (n.y + dy) + '%'; });
        pathsEl.forEach((p, i) => { const l = model.links[i]; const a = off(l.from), b = off(l.to); p.setAttribute('d', model.path(l, a[0], a[1], b[0], b[1])); });
        if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002 || active) raf = requestAnimationFrame(frame); else raf = 0;
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
      const host = opt.host || el;
      const move = (e) => { const r = host.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5) * 1.4; ty = ((e.clientY - r.top) / r.height - .5) * 1.4; active = true; kick(); };
      const leave = () => { tx = 0; ty = 0; active = false; kick(); };
      const vis = () => { if (document.hidden) leave(); };
      host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave); window.addEventListener('blur', leave);
      document.addEventListener('visibilitychange', vis);
      el._cleanup = () => { host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave); window.removeEventListener('blur', leave); document.removeEventListener('visibilitychange', vis); cancelAnimationFrame(raf); };
    }
  };
  // light up one person's reporting line and dim the rest; no id puts the map back as drawn
  RM.highlightNode = function (el, id) {
    const isRoot = !id || !(q.person(id) || {}).rm; // selecting the practice head would light up everything, so keep the map calm
    const chain = new Set(id ? [id, ...q.chain(id).map((p) => p.id)] : []);
    const sub = new Set(id ? q.descendants(id).map((d) => d.p.id) : []);
    const dim = (nid) => !isRoot && !chain.has(nid) && !sub.has(nid);
    RM.$$('.c-node', el).forEach((b) => { b.classList.toggle('is-sel', b.dataset.node === id); b.classList.toggle('is-dim', dim(b.dataset.node)); b.setAttribute('aria-pressed', b.dataset.node === id); });
    RM.$$('.c-label', el).forEach((l) => l.classList.toggle('is-dim', dim(l.dataset.label)));
    RM.$$('path[data-link]', el).forEach((p) => p.classList.toggle('is-hl', !isRoot && (chain.has(p.dataset.to) || sub.has(p.dataset.to))));
  };

  /* ================= PRACTICE HEAD: DPS DASHBOARD ================= */
  // Three areas in priority order: DPS Financials (revenue, cost & profit) → Team Investment → DPS Initiatives.
  // Revenue for the year, person by person and month by month: their actual once it's uploaded, else their forecast. There are no
  // locks. Months with nothing uploaded for someone carry their latest forecast to March (run-rate). Cost: CTC + ₹3 lakh for each
  // person (RM.yearCost), from the month they joined (RM.fyShare). Profit: revenue − cost. There are no per-person goals: only a lead the employee sheet gives a financial
  // target has a yearly Target (db.targets); the practice's target is the sum of theirs. The overview shows money in US dollars.
  const monthEnd = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0); };
  const span = (list) => (list.length ? fmt.monthShort(list[0].mk) + (list.length > 1 ? ' – ' + fmt.monthShort(list[list.length - 1].mk) : '') : '–');
  const pct1 = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
  // ids: the practice's active people, or a team (its lead and all their direct and indirect reportees)
  function fyRollup(ids) {
    const people = ids.map((id) => q.person(id)).filter(Boolean);
    // per month: fromActual + fromForecast is what the month counts as; actual and forecast are the totals for the bars
    const months = RM.FY.months.map((mk) => ({ mk, forecast: 0, fromActual: 0, fromForecast: 0, fVar: 0, rows: 0, billable: 0, uploaded: 0 }));
    people.forEach((p) => {
      let last = null; // the person's latest month on record; later months carry its forecast (run-rate)
      months.forEach((m) => {
        const r = q.finRow(p.id, m.mk);
        if (!r) { if (last) { m.forecast += last.forecast; m.fromForecast += last.forecast; } return; }
        last = r; m.rows++; m.forecast += r.forecast; if (r.billable) m.billable++;
        if (r.actual == null) { m.fromForecast += r.forecast; return; }
        m.fromActual += r.actual; if (r.billable) { m.uploaded++; m.fVar += r.actual - r.forecast; }
      });
    });
    months.forEach((m) => {
      // actual: every actual uploaded · partial: some · forecast: none yet · runrate: no one has figures for the month
      m.kind = !m.rows ? 'runrate' : m.uploaded === m.billable && !m.fromForecast ? 'actual' : m.uploaded ? 'partial' : 'forecast';
      m.value = m.fromActual + m.fromForecast; m.actual = m.kind === 'actual' || m.kind === 'partial' ? m.fromActual : null;
      // the month's cost is a twelfth of the year's for everyone in the practice that month; profit is what's left of its revenue
      m.cost = people.reduce((a, p) => a + (RM.inPractice(p, m.mk) ? RM.yearCost(p) / 12 : 0), 0); m.profit = m.value - m.cost;
    });
    const sum = (list, k) => list.reduce((a, m) => a + m[k], 0);
    const withActuals = months.filter((m) => m.actual != null); const withForecasts = months.filter((m) => m.kind !== 'actual');
    const actual = sum(months, 'fromActual'); const forecast = sum(months, 'fromForecast'); const revenue = actual + forecast;
    const cost = people.reduce((a, p) => a + RM.yearCost(p) * RM.fyShare(p), 0); const overhead = people.reduce((a, p) => a + RM.OVERHEAD * RM.fyShare(p), 0);
    return { months, withActuals, withForecasts, partial: months.filter((m) => m.kind === 'partial'), people: people.length, actual, forecast, revenue, ctc: cost - overhead, overhead, cost, profit: revenue - cost, margin: pct1(revenue - cost, revenue) };
  }
  RM.fyRollup = fyRollup;
  // money on a page: rupees by default, or US dollars at RM.FX_USD (amounts are kept in rupees). f formats a rupee amount,
  // of converts one for a chart, axis formats a chart tick that's already converted.
  const cur = (usd) => (usd
    ? { usd: true, f: (v, o) => (v == null ? '–' : fmt.usdShort(v / RM.FX_USD, o)), of: (v) => (v == null ? v : v / RM.FX_USD), axis: (v) => fmt.usdShort(v).replace(/\.0+(?=[MK])/, '') }
    : { usd: false, f: fmt.inr, of: (v) => v, axis: (v) => fmt.inr(v).replace('.00 ', ' ').replace(' L', 'L').replace(' Cr', 'Cr') });
  const INR = cur(false), USD = cur(true);
  // big money figures: the unit (L / Cr, or M / K) drops to the small suffix
  const money = (v, c) => { const m = (c || INR).f(v).match(/^(.*?)\s?(Cr|L|M|K)?$/); return { value: esc(m[1]), unit: m[2] ? esc(m[2]) : '' }; };
  const delta = (v, what, c) => `<span class="dps-delta ${v >= 0 ? 'is-up' : 'is-down'}">${ic('arrow-right-up-linear')}<b>${(c || INR).f(v, { plus: true })}</b> ${esc(what)}</span>`;
  // a target progress card's arrow: v against where it should be. Up (green) is ahead, down (red) behind; within 1% of ref
  // it is level (grey) and says so in words. up / down / flat: what the chip says each way
  const trend = (v, ref, c, up, down, flat) => {
    const dir = Math.abs(v) < Math.abs(ref || 0) * 0.01 ? 'flat' : v > 0 ? 'up' : 'down';
    return `<span class="dps-delta is-${dir}">${ic(dir === 'flat' ? 'arrow-right-linear' : 'arrow-right-up-linear')}${dir === 'flat' ? esc(flat) : `<b>${c.f(v, { plus: true })}</b> ${esc(dir === 'up' ? up : down)}`}</span>`;
  };
  // actual (solid) then forecast (lighter step of the same hue), against a budget or target marker when there is one
  // tips: { a, f, mark }, what each part shows on hover (segTip rows: its name and amount)
  const segTip = (color, label, v) => esc(`<div class='tip-row'><span>${color ? `<i class='sw' style='background:${color}'></i>` : ''}${label}</span><b>${v}</b></div>`);
  const fyBar = (done, rest, budget, label, tips) => {
    const max = Math.max(done + rest, budget || 0, 1) * 1.04; const w = (v) => ((Math.max(0, v) / max) * 100).toFixed(2); const t = tips || {};
    const tipAt = (x) => (x ? ` data-tip="${x}"` : '');
    return `<div class="fy-bar" role="img" aria-label="${esc(label)}"><div class="fy-track"><i class="fy-a" style="width:${w(done)}%"${tipAt(t.a)} data-grow></i><i class="fy-f" style="width:${w(rest)}%"${tipAt(t.f)} data-grow data-delay=".12"></i></div>${budget ? `<span class="fy-mark" style="left:${w(budget)}%"${tipAt(t.mark)}></span>` : ''}</div>`;
  };
  const fyLegend = (a, f, mark) => `<div class="legend fy-legend"><span><i class="sw" style="background:var(--viz-actual)"></i>${a}</span><span><i class="sw" style="background:var(--viz-forecast)"></i>${f}</span>${mark === false ? '' : `<span><i class="sw sw-tick"></i>${mark || 'Budget'}</span>`}</div>`;
  // initiatives: a parent with workstreams is completed once every workstream is
  const initStatus = (it) => (it.items ? (it.items.every((x) => x.status === 'Completed') ? 'Completed' : 'In progress') : it.status);
  const initBadge = (s) => `<span class="badge ${s === 'Completed' ? 'b-ok' : 'b-info'}" data-tag-key="init:${esc(s)}">${esc(s)}</span>`;
  const initOwners = (ids) => {
    const ps = (ids || []).map((id) => q.person(id)).filter(Boolean);
    if (!ps.length) return '<span class="faint small">No owner named</span>';
    return `<span class="init-owners"><span class="av-stack">${ps.map((p) => C.avatar(p, 'sm')).join('')}</span><span class="small">${ps.map((p) => `<button type="button" class="link-btn" data-action="open-person" data-id="${p.id}">${esc(p.name)}</button>`).join(' <span class="muted">&amp;</span> ')}</span></span>`;
  };
  // the yearly revenue target for the practice: the sum of the targets of everyone the employee sheet gives one
  const practiceTarget = () => { const ls = targetLeads().filter((p) => store.db.targets[p.id] != null); return { total: ls.reduce((a, p) => a + store.db.targets[p.id], 0), leads: ls.length }; };
  // a lead's yearly target is met once their cluster's uploaded actuals this year reach it (the rating's 5 needs it)
  RM.finTargetMet = (id) => { const t = store.db.targets[id]; return t != null && fyRollup(unitIds(id)).actual >= t; };

  // Revenue, Cost & Profit for the year: the figures, the months behind the revenue, and how the year adds up.
  // Shared by the DPS overview, Financial performance and Team financials. opt.target: the yearly revenue target, when there is
  // one, shown as a figure beside Cost. opt.usd: US dollars instead of rupees. opt.tracker: target progress (what's met, what's
  // left and whether the forecast covers it) in place of "How the year adds up" (the DPS overview). opt.lean: the figures
  // without their working (no sub-lines explaining revenue and cost, no chart subtitle), for the DPS overview.
  const revenueIntro = (fy, c) => `${RM.FY.label} revenue takes each person’s actual for a month once it’s uploaded, and their forecast until then (actuals so far: ${span(fy.withActuals)}). Cost is each person’s CTC plus ${(c || INR).f(RM.OVERHEAD)}; profit is revenue minus cost.`;
  RM.revenueIntro = revenueIntro;
  function revenueCard(fy, opt) {
    opt = opt || {}; const c = opt.usd ? USD : INR; const M = c.f;
    const target = opt.target != null ? opt.target : null; const aSpan = span(fy.withActuals); const fSpan = span(fy.withForecasts);
    const people = fy.people + (fy.people === 1 ? ' person' : ' people');
    // each month pairs its uploaded actuals with its forecast; revenue takes each person's actual where uploaded, else their forecast
    const fcLabel = (m) => (m.kind === 'runrate' ? 'Forecast (run-rate)' : 'Forecast');
    const upl = (m) => (m.kind === 'partial' ? ` · ${m.uploaded} of ${m.billable} uploaded` : '');
    const row = (sw, label, v) => `<div class='tip-row'><span>${sw ? `<i class='sw' style='background:${sw}'></i>` : ''}${label}</span><b>${v}</b></div>`;
    const cols = fy.months.map((m) => ({ label: fmt.monthShort(m.mk), actual: c.of(m.actual), forecast: c.of(m.forecast), zone: m.kind !== 'actual', profit: c.of(m.profit),
      tip: `<b>${fmt.monthLabel(m.mk)}</b>${m.actual != null ? row('var(--viz-actual)', 'Actual' + upl(m), M(m.actual)) : row('', 'Actual', 'not uploaded yet')}${row('var(--viz-forecast)', fcLabel(m), M(m.forecast))}`
        + (m.actual != null ? row('', 'Actual − forecast' + (m.kind === 'partial' ? ' (uploaded)' : ''), M(m.fVar, { plus: true })) : '')
        + row('', 'Counted in revenue', M(m.value) + ' · ' + (m.kind === 'actual' ? 'actual' : m.kind === 'partial' ? 'actual + forecast' : 'forecast'))
        + row('', 'Cost', M(m.cost)) + row('var(--viz-profit)', 'Profit', M(m.profit)) }));
    const metric = (o) => `<div class="dps-metric${o.hero ? ' is-hero' : ''}"><div class="kpi-label">${ic(o.icon)}${o.fy ? `<span>${esc(o.label)}<span class="kpi-fy">${RM.FY.label}</span></span>` : esc(o.label)}</div><div class="dps-value${o.neg ? ' is-neg' : ''}${c.usd ? ' is-tight' : ''}">${o.value}${o.unit ? `<small>${o.unit}</small>` : ''}</div>${o.delta || ''}${o.sub ? `<div class="kpi-sub">${o.sub}</div>` : ''}</div>`;
    const lean = !!opt.lean; // the Practice Overview: the figures without their working
    const rev = money(fy.revenue, c), cost = money(fy.cost, c), prof = money(fy.profit, c), tgt = target != null ? money(target, c) : null;
    const dash = '<span class="faint" style="font-weight:400">–</span>';
    const tracker = opt.tracker && tgt;
    const outlook = opt.tracker ? '' : `<div class="dps-outlook">
              <h3 class="h3">How the year adds up</h3><p class="small muted">${RM.FY.span}</p>
              ${fyBar(fy.actual, fy.forecast, target || 0, `Revenue ${M(fy.revenue)}: ${M(fy.actual)} actual and ${M(fy.forecast)} forecast${tgt ? `, against a ${M(target)} target` : ''}`,
                { a: segTip('var(--viz-actual)', `Actual · ${aSpan}`, M(fy.actual)), f: segTip('var(--viz-forecast)', `Forecast · ${fSpan}`, M(fy.forecast)), mark: tgt ? segTip('', 'Target', M(target)) : '' })}
              ${fyLegend(`Actual · ${aSpan}`, `Forecast · ${fSpan}`, tgt ? 'Target' : false)}
              <dl class="dps-kv">
                <div><dt>Actuals uploaded · ${aSpan}</dt><dd class="num">${M(fy.actual)}</dd></div>
                <div><dt>Forecast where none · ${fSpan}</dt><dd class="num">${M(fy.forecast)}</dd></div>
                <div class="is-total"><dt>Revenue</dt><dd class="num">${M(fy.revenue)}</dd></div>
                <div><dt>CTC · ${people}</dt><dd class="num">${M(fy.ctc)}</dd></div>
                <div><dt>${M(RM.OVERHEAD)} a person</dt><dd class="num">${M(fy.overhead)}</dd></div>
                <div class="is-total"><dt>Cost</dt><dd class="num">${M(fy.cost)}</dd></div>
                <div class="is-total"><dt>Profit</dt><dd class="num cell-var ${fy.profit < 0 ? 'neg' : ''}">${M(fy.profit)}</dd></div>
                <div><dt>Profit margin</dt><dd class="num">${fy.margin != null ? fy.margin + '%' : '–'}</dd></div>
                ${tgt ? `<div><dt>Target</dt><dd class="num">${M(target)}</dd></div><div><dt>Revenue vs target</dt><dd class="num cell-var ${fmt.varCls(fy.revenue - target)}">${M(fy.revenue - target, { plus: true })}</dd></div>` : ''}
              </dl>
            </div>`;
    return `<div class="card dps-hero" data-reveal>
          <div class="dps-metrics${tgt ? '' : ' is-3'}${opt.fyLabels ? ' has-fy' : ''}">
            ${metric({ hero: true, label: 'Revenue', fy: opt.fyLabels, icon: 'wallet-money-linear', value: rev.value, unit: rev.unit, delta: tgt && target ? delta(fy.revenue - target, 'vs target', c) : '', sub: lean ? '' : `${RM.FY.label} · ${M(fy.actual)} actual (${aSpan}) + ${M(fy.forecast)} forecast (${fSpan})` })}
            ${metric({ label: opt.costLabel || 'Cost', fy: opt.fyLabels, icon: 'users-group-rounded-linear', value: cost.value, unit: cost.unit, sub: lean ? opt.costSub || '' : `CTC + ${M(RM.OVERHEAD)} for each of ${people} · <span class="nowrap">${RM.FY.label}</span>` })}
            ${tgt ? metric({ label: 'Target', fy: opt.fyLabels, icon: 'target-linear', value: tgt.value, unit: tgt.unit, delta: opt.targetDelta || '', sub: opt.targetDelta ? '' : opt.targetSub || `Yearly revenue target · <span class="nowrap">${RM.FY.label}</span>` }) : ''}
            ${metric({ label: 'Profit', fy: opt.fyLabels, icon: 'pie-chart-2-linear', value: prof.value, unit: prof.unit, neg: fy.profit < 0, sub: `${lean ? '' : 'Revenue − cost · '}${fy.margin != null ? fy.margin + '% margin' : 'no revenue this year'}` })}
          </div>
          ${tracker ? targetHighlight(fy, target, c, opt.gapHref, opt.gapCta) + monthlyTarget(fy, target, c) : `<div class="dps-hero-body${outlook ? '' : ' is-single'}">
            <div class="dps-chart" id="dps-rev">
              <div class="dps-chart-head"><div><h3 class="h3">Revenue by month</h3>${lean ? '' : `<p class="small muted">Uploaded actuals and forecast · ${RM.FY.span}</p>`}</div>
                ${C.seg([{ key: 'chart', label: 'Chart' }, { key: 'table', label: 'Table' }], 'chart', 'aria-label="Show revenue as"').replace('class="seg"', 'class="seg seg-sm"')}</div>
              <div data-rev-panel="chart">
                ${RM.charts.columns(cols, { series: [{ key: 'actual', color: 'var(--viz-actual)' }, { key: 'forecast', color: 'var(--viz-forecast)' }], line: { key: 'profit', color: 'var(--viz-profit)', label: 'Profit' }, label: `Uploaded actual and forecast revenue by month, with each month's profit, ${RM.FY.span}`, zoneLabel: 'Includes forecast', yFmt: c.axis })}
                <div class="legend fy-legend"><span><i class="sw" style="background:var(--viz-actual)"></i>Actual (uploaded)</span><span><i class="sw" style="background:var(--viz-forecast)"></i>Forecast</span><span><i class="sw sw-profit"></i>Profit</span></div>
              </div>
              <div data-rev-panel="table" hidden><div class="table-wrap dps-mtable"><table class="table"><thead><tr><th>Month</th><th class="r">Actual</th><th class="r">Forecast</th><th class="r">Revenue</th><th class="r">Actual − forecast</th><th class="r">Profit</th></tr></thead>
                <tbody>${fy.months.map((m) => `<tr><td class="num nowrap">${fmt.monthLabel(m.mk)}${m.kind === 'runrate' ? ' <span class="faint small">run-rate</span>' : m.kind === 'partial' ? ` <span class="faint small">${m.uploaded} of ${m.billable} uploaded</span>` : ''}</td><td class="r num">${m.actual != null ? M(m.actual) : dash}</td><td class="r num">${M(m.forecast)}</td><td class="r num strong">${M(m.value)}</td><td class="r num">${m.actual != null ? M(m.fVar, { plus: true }) : '<span class="faint">–</span>'}</td><td class="r num${m.profit < 0 ? ' cell-var neg' : ''}">${M(m.profit)}</td></tr>`).join('')}
                  <tr class="is-total"><td>${RM.FY.label}</td><td class="r num">${M(fy.actual)}</td><td></td><td class="r num strong">${M(fy.revenue)}</td><td></td><td class="r num${fy.profit < 0 ? ' cell-var neg' : ''}">${M(fy.profit)}</td></tr></tbody></table></div></div>
              ${lean ? '' : `<p class="tiny muted dps-foot">Each person’s month counts their actual once it’s uploaded, and their forecast until then.${fy.partial.map((m) => ` ${fmt.monthShort(m.mk)} has ${m.uploaded} of ${m.billable} actuals uploaded, so its actual − forecast covers those.`).join('')} Months with nothing uploaded yet carry each person’s latest forecast forward (run-rate).</p>`}
            </div>
            ${outlook}
          </div>`}
        </div>`;
  }
  // Target progress (the DPS overview's highlight): how much of the yearly target the uploaded actuals have met, what's left,
  // and whether the forecast for the rest of the year covers it, so the target is met by March. Achieved carries an arrow
  // against its pace (the yearly target ÷ 12 for each month that's in), Remaining what it needs a month to March, the forecast
  // an arrow against the target for the months still to come. The fourth figure is the Gap: what remains less what the
  // forecast brings in (the remaining months' shortfall). With one, it opens the Target Gap Drill Down (gapHref) and says what's there
  // (gapCta: a function, so it's only worked out when there is a gap). The card shows no link text: its corner arrow says it
  // opens; gapCta is its tooltip on hover and focus, and is read out with the link's name.
  function targetHighlight(fy, target, c, gapHref, gapCta) {
    const M = c.f; const done = fy.actual; const left = Math.max(0, target - done); const gap = fy.revenue - target; const ok = gap >= 0;
    const short = Math.max(0, -gap); // the gap: remaining − forecast, when the forecast falls short
    const aSpan = span(fy.withActuals); const fSpan = span(fy.withForecasts); const pct = target ? Math.round((done / target) * 100) : 0;
    const big = (v) => { const m = money(v, c); return `${m.value}${m.unit ? `<small>${m.unit}</small>` : ''}`; };
    const max = Math.max(fy.revenue, target, 1) * 1.04; const w = (v) => ((Math.max(0, v) / max) * 100).toFixed(2);
    const per = target / 12; const inMonths = fy.months.filter((m) => m.kind === 'actual').length; const pace = per * inMonths; const restPlan = target - pace;
    const nLeft = fy.withForecasts.length || 1; const need = left / nLeft; // what each month to March has to bring in
    const href = !ok && gapHref ? gapHref : '';
    const gapFig = `<div class="dps-tp-fig is-gap${ok ? ' is-clear' : ''}${href ? ' is-link' : ''}"><div class="kpi-label"><i class="sw sw-gap" aria-hidden="true"></i>Gap</div><div class="dps-value is-tight">${big(short)}</div>`
      + (ok ? trend(gap, target, c, 'forecast surplus', '', 'Level with the forecast')
        : href ? '<span aria-hidden="true"></span>' : trend(gap, target, c, '', 'forecast short', 'Level with the forecast'))
      + `<div class="kpi-sub">${ok ? 'the forecast covers what remains' : `remaining ${M(left)} − forecast ${M(fy.forecast)}`}</div>`
      + (href ? `<span class="kpi-go" aria-hidden="true">${ic('arrow-right-up-linear')}</span><a class="kpi-link" href="${href}" data-nav-dir="1" data-tip="${esc(`${gapCta ? gapCta() + ' · ' : ''}Open the drill down`)}" aria-label="${esc(`Gap ${M(short)}${gapCta ? ` (${gapCta()})` : ''}: open the drill down`)}"></a>` : '') + '</div>';
    return `<section class="dps-tp" aria-labelledby="dps-tp-h">
          <div class="dps-tp-head"><h3 class="h3" id="dps-tp-h">Target progress</h3><span class="badge ${ok ? 'b-ok' : 'b-warn'} has-icon" data-no-tag>${ic(ok ? 'check-circle-linear' : 'danger-triangle-linear')}${ok ? 'On track' : 'At risk'}</span></div>
          <div class="dps-tp-figs">
            <div class="dps-tp-fig is-met"><div class="kpi-label">Achieved</div><div class="dps-value is-tight">${big(done)}</div>${trend(done - pace, pace, c, 'ahead of pace', 'behind pace', 'On pace')}<div class="kpi-sub"><b>${pct}%</b> of the ${M(target)} target · till date</div></div>
            <div class="dps-tp-fig is-key"><div class="kpi-label">Remaining</div><div class="dps-value is-tight">${big(left)}</div><span class="dps-delta is-need">${ic('calendar-linear')}<b>${M(need)}</b> a month needed</span><div class="kpi-sub">by March · ${100 - pct}% of the target</div></div>
            <div class="dps-tp-fig is-fc"><div class="kpi-label">Forecast for the remaining months</div><div class="dps-value is-tight">${big(fy.forecast)}</div>${trend(fy.forecast - restPlan, restPlan, c, 'vs monthly target', 'vs monthly target', 'On the monthly target')}<div class="kpi-sub">${fSpan} · year-end projection ${M(fy.revenue)}</div></div>
            ${gapFig}
          </div>
          <div class="dps-tp-bar" role="img" aria-label="${esc(`${M(done)} achieved of a ${M(target)} target; ${M(left)} remaining; the forecast adds ${M(fy.forecast)}, ${ok ? M(gap) + ' more than needed' : 'leaving a gap of ' + M(short)}`)}">
            <div class="fy-track"><i class="fy-a" style="width:${w(done)}%" data-tip="${segTip('var(--viz-actual)', `Achieved · ${aSpan}`, M(done))}" data-grow></i><i class="fy-f" style="width:${w(fy.forecast)}%" data-tip="${segTip('var(--viz-forecast)', `Forecast · ${fSpan}`, M(fy.forecast))}" data-grow data-delay=".12"></i>${short ? `<i class="fy-gap" style="width:${w(short)}%" data-tip="${segTip('', 'Gap · not covered by the forecast', M(short))}" data-grow data-delay=".24"></i>` : ''}</div>
            <span class="fy-mark" style="left:${w(target)}%" data-tip="${segTip('', 'Target', M(target))}"></span><span class="dps-tp-tgt" style="left:${w(target)}%">Target ${M(target)}</span>
          </div>
          <div class="legend fy-legend"><span><i class="sw" style="background:var(--viz-actual)"></i>Achieved · ${aSpan}</span><span><i class="sw" style="background:var(--viz-forecast)"></i>Forecast · ${fSpan}</span>${short ? '<span><i class="sw sw-gap"></i>Gap</span>' : ''}<span><i class="sw sw-tick"></i>Target</span></div>
        </section>`;
  }
  // the monthly target (the yearly target ÷ 12): each month's revenue against it, met or short. A month with every actual in
  // is settled; one still uploading, or ahead of us, is judged on what it counts as so far (its forecast). Each month's profit
  // (its revenue less its cost) runs across the columns as a line on the same axis.
  function monthlyTarget(fy, target, c) {
    const M = c.f; const per = target / 12;
    const st = fy.months.map((m) => ({ m, met: m.value >= per, settled: m.kind === 'actual', diff: m.value - per }));
    const state = (x) => (x.settled ? (x.met ? 'Met' : 'Short') : x.m.kind === 'partial' ? (x.met ? 'On course' : 'Short so far') : x.met ? 'Forecast meets it' : 'Forecast short');
    const row = (sw, label, v) => `<div class='tip-row'><span>${sw ? `<i class='sw' style='background:${sw}'></i>` : ''}${label}</span><b>${v}</b></div>`;
    const cols = st.map((x) => ({ label: fmt.monthShort(x.m.mk), actual: c.of(x.m.fromActual), forecast: c.of(x.m.fromForecast), zone: x.m.kind !== 'actual',
      mark: { ok: x.met, solid: x.settled },
      tip: `<b>${fmt.monthLabel(x.m.mk)}</b>${x.m.fromActual ? row('var(--viz-actual)', 'Actual' + (x.m.kind === 'partial' ? ` · ${x.m.uploaded} of ${x.m.billable} in` : ''), M(x.m.fromActual)) : ''}${x.m.fromForecast ? row('var(--viz-forecast)', x.m.kind === 'runrate' ? 'Forecast (run-rate)' : 'Forecast', M(x.m.fromForecast)) : ''}`
        + row('', 'Monthly target', M(per)) + row('', 'vs target', M(x.diff, { plus: true })) + row('', 'Cost', M(x.m.cost)) + row('var(--viz-profit)', 'Profit', M(x.m.profit)) + row('', state(x), ''),
      profit: c.of(x.m.profit) }));
    // the chart's status marker, for the legend
    const mk = (ok, solid) => { const col = ok ? 'var(--ok-dot)' : 'var(--warn-dot)'; const ink = solid ? 'var(--surface)' : col;
      return `<svg class="mk" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="${solid ? col : 'var(--surface)'}" stroke="${col}" stroke-width="1.5"/>${ok ? `<path d="M4.8 8.2l2.2 2.2 4.2-4.4" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`}</svg>`; };
    const dash = '<span class="faint" style="font-weight:400">–</span>';
    return `<section class="dps-chart dps-mt" id="dps-rev" aria-labelledby="dps-mt-h">
          <div class="dps-chart-head"><h3 class="h3" id="dps-mt-h">Monthly target and profit <span class="muted" style="font-weight:450">· ${RM.FY.label}</span></h3>
            ${C.seg([{ key: 'chart', label: 'Chart' }, { key: 'table', label: 'Table' }], 'chart', 'aria-label="Show the monthly target as"').replace('class="seg"', 'class="seg seg-sm"')}</div>
          <div data-rev-panel="chart">
            ${RM.charts.columns(cols, { stack: true, series: [{ key: 'actual', color: 'var(--viz-actual)' }, { key: 'forecast', color: 'var(--viz-forecast)' }], ref: { value: c.of(per), label: 'Monthly target' }, line: { key: 'profit', color: 'var(--viz-profit)', label: 'Profit' }, label: `Revenue by month against the monthly target of ${M(per)}, with each month's profit, ${RM.FY.span}`, zoneLabel: 'Includes forecast', yFmt: c.axis, h: 260 })}
            <div class="legend fy-legend"><span><i class="sw" style="background:var(--viz-actual)"></i>Actual (uploaded)</span><span><i class="sw" style="background:var(--viz-forecast)"></i>Forecast</span><span><i class="sw sw-ref"></i>Monthly target</span><span><i class="sw sw-profit"></i>Profit</span><span>${mk(true, true)}Met</span><span>${mk(false, true)}Short</span><span>${mk(true, false)}${mk(false, false)}Outlined: on the forecast</span></div>
          </div>
          <div data-rev-panel="table" hidden><div class="table-wrap dps-mtable"><table class="table"><thead><tr><th>Month</th><th class="r">Forecast</th><th class="r">Actual</th><th class="r">Actual − forecast</th><th class="r">Revenue</th><th class="r">Monthly target</th><th class="r">vs target</th><th class="r">Cost</th><th class="r">Profit</th><th>Status</th></tr></thead>
            <tbody>${st.map((x) => `<tr><td class="num nowrap">${fmt.monthLabel(x.m.mk)}${x.m.kind === 'partial' ? ` <span class="faint small">${x.m.uploaded} of ${x.m.billable} in</span>` : ''}</td><td class="r num">${M(x.m.forecast)}</td><td class="r num">${x.m.actual != null ? M(x.m.actual) : dash}</td><td class="r num">${x.m.actual != null ? M(x.m.fVar, { plus: true }) : dash}</td><td class="r num strong">${M(x.m.value)}</td><td class="r num">${M(per)}</td><td class="r num cell-var ${fmt.varCls(x.diff)}">${M(x.diff, { plus: true })}</td><td class="r num">${M(x.m.cost)}</td><td class="r num${x.m.profit < 0 ? ' cell-var neg' : ''}">${M(x.m.profit)}</td><td><span class="badge ${x.met ? 'b-ok' : 'b-warn'}${x.settled ? '' : ' b-soft'}">${state(x)}</span></td></tr>`).join('')}
              <tr class="is-total"><td>${RM.FY.label}</td><td class="r num">${M(fy.months.reduce((a, m) => a + m.forecast, 0))}</td><td class="r num">${M(fy.actual)}</td><td class="r num">${M(fy.months.reduce((a, m) => a + (m.actual != null ? m.fVar : 0), 0), { plus: true })}</td><td class="r num strong">${M(fy.revenue)}</td><td class="r num">${M(target)}</td><td class="r num cell-var ${fmt.varCls(fy.revenue - target)}">${M(fy.revenue - target, { plus: true })}</td><td class="r num">${M(fy.cost)}</td><td class="r num${fy.profit < 0 ? ' cell-var neg' : ''}">${M(fy.profit)}</td><td></td></tr></tbody></table></div></div>
        </section>`;
  }
  RM.revenueCard = revenueCard;
  // the Appraisals card opens this under its row: this financial year's appraisals so far (rating, increment, the CTC before
  // and after, and what each adds to the practice's yearly cost) and the ones still to come, with a line summing them up
  function apprPanel(done, next, n) {
    const rows = done.slice().sort((a, b) => b.e.date - a.e.date); const mgr = (p) => (q.person(p.rm) ? esc(q.person(p.rm).name) : '<span class="faint">–</span>');
    const avg = (list, f) => (list.length ? list.reduce((a, x) => a + f(x), 0) / list.length : null); const r1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
    const rating = avg(rows, (x) => x.e.rating); const inc = avg(rows, (x) => x.e.inc); const added = rows.reduce((a, x) => a + x.rise, 0);
    const sum = [`<b>${rows.length}</b> of ${n} done`, `<b>${next.length}</b> still to come`, rating != null ? `average rating <b>${r1(rating)}</b> / 5` : '', inc != null ? `average increment <b>${r1(inc)}%</b>` : '', rows.length ? `<b>${esc(USD.f(added))}</b> a year added to the cost` : ''].filter(Boolean).join(' · ');
    const doneT = rows.length ? `<div class="table-wrap"><table class="table appr-table"><thead><tr><th>Employee</th><th>Manager</th><th>Appraisal</th><th class="r">Rating</th><th class="r">Increment</th><th class="r">CTC before → after</th><th class="r">Added a year</th></tr></thead>
        <tbody>${rows.map((x) => `<tr><td>${C.person(x.p, esc(x.p.designation), { size: 'sm', link: true })}</td><td class="small" data-label="Manager">${mgr(x.p)}</td><td class="nowrap num small" data-label="Appraisal">${fmt.date(x.e.date)}</td>
          <td class="r num" data-label="Rating"><b>${r1(x.e.rating)}</b><span class="muted"> / 5</span></td><td class="r num" data-label="Increment">+${x.e.inc % 1 ? x.e.inc.toFixed(1) : x.e.inc}%</td>
          <td class="r num nowrap small" data-label="CTC before → after"><span class="muted">${esc(fmt.inr(x.before))}</span> → ${esc(fmt.inr(x.e.ctc))}</td><td class="r num" data-label="Added a year">${esc(USD.f(x.rise))}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="card-body">${C.empty('cup-star-linear', 'None yet', `No appraisals so far in ${RM.FY.label}.`)}</div>`;
    const nextT = next.length ? `<div class="table-wrap"><table class="table appr-table"><thead><tr><th>Employee</th><th>Manager</th><th>Appraisal</th><th class="r">In</th></tr></thead>
        <tbody>${next.map((x) => { const d = RM.dayDiff(RM.TODAY, x.d); return `<tr><td>${C.person(x.p, esc(x.p.designation), { size: 'sm', link: true })}</td><td class="small" data-label="Manager">${mgr(x.p)}</td><td class="nowrap num small" data-label="Appraisal">${fmt.date(x.d)}</td><td class="r num small" data-label="In">${d} ${d === 1 ? 'day' : 'days'}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="card-body">${C.empty('calendar-linear', 'Nothing left', `Every appraisal in ${RM.FY.label} is done.`)}</div>`;
    return `<section class="card dps-row dps-appr-panel" id="dps-appr-panel" aria-labelledby="dps-appr-h" hidden>
        <div class="card-head"><div><h3 class="h3" id="dps-appr-h">Appraisals · ${RM.FY.label}</h3><p class="small muted" style="margin-top:3px">${sum}</p></div>
          <span class="spacer">${C.seg([{ key: 'done', label: 'Done', count: rows.length }, { key: 'next', label: 'Still to come', count: next.length }], 'done', 'aria-label="Show appraisals"').replace('class="seg"', 'class="seg seg-sm"')}</span></div>
        <div data-appr-list="done">${doneT}</div><div data-appr-list="next" hidden>${nextT}</div>
        <div class="card-foot"><a class="link-btn" href="#/ph/appraisals" data-nav-dir="1">Upcoming Appraisals${ic('arrow-right-linear')}</a></div>
      </section>`;
  }
  // this year's cost is a year of CTC and overhead for the people in the practice, assumed from who's here today: said quietly
  const COST_NOTE = '<span class="cost-note">Assumed yearly cost till date</span>';
  // the DPS Financials card: the same on the Practice Overview and on every level of Financial Performance and Team
  // Financials. US dollars, the four figures for the year and, with a yearly target, its progress and the monthly target and
  // profit; without one, revenue and profit by month. costLabel names the cost (the practice's, or a cluster's); gapHref is
  // where the Gap card leads (the Target Gap Drill Down) and gapCta what its link says
  function dpsCard(fy, target, costLabel, gapHref, gapCta) {
    return revenueCard(fy, { usd: true, lean: true, tracker: true, target: target || null, costLabel, costSub: COST_NOTE, fyLabels: true, gapHref, gapCta,
      targetDelta: target ? `<span class="dps-delta is-met">${ic('target-linear')}<b>${Math.round((fy.actual / target) * 100)}%</b> achieved</span>` : '' });
  }
  RM.dpsCard = dpsCard;
  // the card's Chart / Table switch; true when the click was on it. The panels cross over: the outgoing one fades (120ms,
  // ease-out, so the click answers at once, as page exits do), the card glides to the incoming one's height (240ms) as it rises in (220ms, ease-out). A click mid-way takes
  // over from wherever it is; reduced motion swaps at once.
  function revenueSeg(root, e) {
    const sg = e.target.closest('#dps-rev [data-seg]'); if (!sg) return false;
    const k = sg.dataset.seg; const box = root.querySelector('#dps-rev');
    box.querySelectorAll('[data-seg]').forEach((b) => b.setAttribute('aria-selected', b === sg));
    RM.motion.segThumb(box);
    const panels = RM.$$('[data-rev-panel]', box); const from = panels.find((p) => !p.hidden); const to = panels.find((p) => p.dataset.revPanel === k);
    const show = () => { panels.forEach((p) => { p.hidden = p !== to; }); if (k === 'chart') RM.motion.charts(box); };
    if (RM.reduced() || !window.gsap || !from || !to) { show(); return true; }
    const h0 = box.offsetHeight; gsap.killTweensOf([box, ...panels]); gsap.set(box, { clearProps: 'height,overflow' });
    if (from === to) { gsap.to(to, { opacity: 1, y: 0, duration: .16, ease: 'power2.out', clearProps: 'opacity,transform' }); return true; }
    gsap.to(from, { opacity: 0, duration: .12, ease: 'power2.out', onComplete: () => {
      show(); gsap.set(from, { clearProps: 'opacity,transform' });
      const h1 = box.offsetHeight;
      gsap.fromTo(box, { height: h0, overflow: 'hidden' }, { height: h1, duration: .24, ease: 'power2.inOut', clearProps: 'height,overflow' });
      gsap.fromTo(to, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .22, ease: 'power2.out', clearProps: 'opacity,transform' });
    } });
    return true;
  }
  // the target progress arrows settle in once the figures are up: each chip fades in as its arrow travels the last 3px in the
  // direction it points (a level one slides in flat). 280ms, ease-out, 50ms apart; nothing under reduced motion
  function settleTrends(root) {
    if (RM.reduced() || !window.gsap) return;
    RM.$$('.dps-tp .dps-delta', root).forEach((chip, i) => {
      const icon = chip.querySelector('.ic'); const up = chip.classList.contains('is-up'), down = chip.classList.contains('is-down');
      gsap.from(chip, { opacity: 0, duration: .28, delay: .42 + i * .05, ease: 'power2.out', clearProps: 'opacity' });
      if (icon) gsap.from(icon, { x: -3, y: up ? 3 : down ? -3 : 0, duration: .28, delay: .42 + i * .05, ease: 'power2.out', clearProps: 'transform' });
    });
  }
  RM.revenueSeg = revenueSeg;

  V.phOverview = {
    title: 'Practice Overview',
    render({ me }) {
      const all = q.active(); const ids = all.map((p) => p.id); const lm = q.latestMonth();
      const team = all; // the whole practice headcount, the Practice Head included

      /* 1 · revenue, cost & profit, in US dollars, against the practice's target */
      const fy = fyRollup(ids); const pt = practiceTarget();

      /* 2 · team investment: what the whole practice costs, and how everyone is used */
      // the cost follows the Cost figure above (today's CTC + overhead for each person); each month is a twelfth of the year
      const past = RM.FY.months.filter((mk) => monthEnd(mk) <= RM.TODAY).map((mk) => ({ mk })); const rest = RM.FY.months.slice(past.length).map((mk) => ({ mk }));
      const monthCost = (mk) => team.filter((p) => RM.inPractice(p, mk)).reduce((a, p) => a + RM.yearCost(p) / 12, 0);
      const runRate = monthCost(RM.FY.months[past.length] || RM.FY.months[11]); const spent = past.reduce((a, x) => a + monthCost(x.mk), 0); const sp = money(spent, USD);
      const groups = RM.USE.map((u) => { const list = team.filter((p) => RM.useOf(p, lm) === u.k); return { ...u, list, n: list.length, month: list.reduce((a, p) => a + RM.yearCost(p) / 12, 0) }; });
      // appraisals, from the salary history: one on each work anniversary, with a rating out of 5 and an increment.
      // An appraisal costs the practice what it adds to the person's yearly CTC (the CTC after it minus the CTC before it).
      // They count everyone in the practice but the Practice Head.
      const staff = team.filter((p) => !q.isPH(p));
      const apprIn = (from, to) => staff.flatMap((p) => RM.salaryHistory(p).map((e, i, l) => (e.kind === 'appraisal' && e.date >= from && e.date <= to ? { p, e, before: l[i - 1].ctc, rise: e.ctc - l[i - 1].ctc } : null)).filter(Boolean));
      // the work anniversary that falls between from and to (none in the joining year), if any
      const annivOn = (p, from, to) => { const j = new Date(p.joined); return [from.getFullYear(), to.getFullYear()].map((y) => new Date(y, j.getMonth(), j.getDate())).find((d) => d.getFullYear() > j.getFullYear() && d >= from && d <= to) || null; };
      const annivIn = (p, from, to) => !p.contractor && !!annivOn(p, from, to);
      const apprDone = apprIn(RM.FY.start, RM.TODAY); const tmrw = new Date(RM.TODAY.getTime() + 1);
      const apprNext = staff.filter((p) => annivIn(p, tmrw, RM.FY.end)).map((p) => ({ p, d: annivOn(p, tmrw, RM.FY.end) })).sort((a, b) => a.d - b.d); const apprLeft = apprNext.length;
      const apprCost = money(apprDone.reduce((a, x) => a + x.rise, 0), USD);
      // the average rating covers the previous financial year's appraisals
      const fy0 = RM.FY.start.getFullYear() - 1; const prevFy = { label: `FY ${fy0}–${String(fy0 + 1).slice(2)}`, start: new Date(fy0, 3, 1), end: new Date(fy0 + 1, 2, 31, 23, 59) };
      const prevAppr = apprIn(prevFy.start, prevFy.end); const avgRating = prevAppr.length ? Math.round((prevAppr.reduce((a, x) => a + x.e.rating, 0) / prevAppr.length) * 10) / 10 : null;
      // team investment cost by financial year: last year's at the CTC each person was on that month (plus the ₹3 lakh), for the
      // months they were in the practice; this year's is the Practice cost above
      const prevMonths = Array.from({ length: 12 }, (_, i) => { const d = new Date(fy0, 3 + i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
      const prevCost = team.reduce((a, p) => a + prevMonths.reduce((b, mk) => b + (RM.inPractice(p, mk) ? (RM.ctcAt(p, monthEnd(mk)) + RM.OVERHEAD) / 12 : 0), 0), 0);
      const costPair = [[prevFy.label, prevCost], [RM.FY.label, fy.cost, COST_NOTE]].map(([l, v, note]) => { const m = money(v, USD); return `<div><span class="kpi-duo-l">${l}</span><span class="kpi-value">${m.value}${m.unit ? `<small>${m.unit}</small>` : ''}</span>${note || ''}</div>`; }).join('');
      const costGrowth = prevCost ? Math.round(((fy.cost - prevCost) / prevCost) * 100) : null;
      // each card filters the allocation table below it (Total employees shows everyone); the selected card again shows everyone
      const st = RM.raStates.dps;
      const useCard = (g) => C.kpi({ label: g.label, icon: g.icon, value: C.count(g.n), sub: `<b class="use-pct">${fmt.pct(g.n, team.length)}%</b> of the practice`,
        extra: `${C.pick()}<button type="button" class="kpi-link" data-use="${g.k}" aria-pressed="${st.use === g.k}" aria-label="${esc(g.label)}: ${st.use === g.k ? 'show everyone' : 'show only these people in the allocation table'}"></button>` })
        .replace('class="kpi', `class="kpi is-filter is-use-${g.k}${st.use === g.k ? ' is-selected' : ''}`);
      const allCard = C.kpi({ label: 'Total employees', icon: 'users-group-rounded-linear', value: C.count(team.length), sub: 'Everyone in the practice',
        extra: `${C.pick()}<button type="button" class="kpi-link" data-use="all" aria-pressed="${st.use === 'all'}" aria-label="Total employees: show everyone in the allocation table"></button>` })
        .replace('class="kpi', `class="kpi is-filter is-use-all${st.use === 'all' ? ' is-selected' : ''}`);

      /* 3 · initiatives */
      // initiatives, and their workstreams, A to Z
      const az = (a, b) => a.name.localeCompare(b.name);
      const inits = RM.INITIATIVES.slice().sort(az).map((it) => (it.items ? { ...it, items: it.items.slice().sort(az) } : it)); const inProgress = inits.filter((it) => initStatus(it) === 'In progress').length;

      const head = (id, title, sub, extra) => `<div class="section-head"><div><h2 class="h2" id="${id}-h" tabindex="-1">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${extra || ''}</div>`;
      return `<div class="page">
      <header class="page-head">
        <div><div class="eyebrow">${esc(me.practice)} · ${RM.FY.label}</div>
        <h1 class="display" data-split>DPS <em class="accent">Overview</em><span class="dot-o">.</span></h1>
        <nav class="dps-flow" aria-label="Dashboard sections">${[['dps-revenue', 'DPS Financials'], ['dps-team', 'Team Investment'], ['dps-init', 'DPS Initiatives']].map(([id, l], i) => `${i ? ic('alt-arrow-right-linear') : ''}<button type="button" data-jump="${id}"><span class="dps-n${i ? '' : ' is-first'}">${i + 1}</span>${l}</button>`).join('')}</nav></div>
      </header>

      <section class="dps-sec is-first" id="dps-revenue" aria-labelledby="dps-revenue-h">
        ${head('dps-revenue', 'DPS Financials', '', `<a class="spacer link-btn" href="#/ph/finance">Financial Performance ${ic('arrow-right-linear')}</a>`)}
        ${dpsCard(fy, pt.leads ? pt.total : null, 'Practice cost', '#/ph/gap?from=ov', () => gapCta('ph', me, null))}
      </section>

      <section class="dps-sec" id="dps-team" aria-labelledby="dps-team-h">
        ${head('dps-team', 'Team Investment', '', `<a class="spacer link-btn" href="#/ph/resources">Resource Allocation ${ic('arrow-right-linear')}</a>`)}
        <div class="card card-pad dps-inv" data-reveal>
          <div class="dps-inv-col">
            <h3 class="h3 dps-inv-t">Team investment cost</h3>
            <div class="dps-inv-head"><span class="dps-value is-tight">${sp.value}<small>${sp.unit}</small></span><span class="small muted">spent · ${span(past)}</span></div>
            ${fyBar(spent, fy.cost - spent, 0, `${USD.f(spent)} spent of ${USD.f(fy.cost)} for the year`,
              { a: segTip('var(--viz-actual)', `Spent · ${span(past)}`, USD.f(spent)), f: segTip('var(--viz-forecast)', `Still to come · ${span(rest)}`, USD.f(fy.cost - spent)) })}
            ${fyLegend(`Spent · ${span(past)}`, `Still to come · ${span(rest)}`, false)}
            <div class="dps-inv-year"><span>Full year<small>${RM.FY.span}</small></span><b class="num">${USD.f(fy.cost)}</b></div>
          </div>
          <div class="dps-inv-col">
            <h3 class="h3 dps-inv-t">Monthly cost by allocation</h3>
            <div class="dps-inv-head"><span class="dps-value is-tight">${money(runRate, USD).value}<small>${money(runRate, USD).unit}</small></span><span class="small muted">a month</span></div>
            <div class="fy-bar"><div class="bl-bar dps-use-bar" role="img" aria-label="${groups.map((g) => `${g.label} ${USD.f(g.month)} a month`).join(', ')}">${groups.filter((g) => g.n).map((g, i) => `<i class="${g.cls}" style="flex-grow:${g.month}" data-tip="${esc(`<b>${esc(g.label)}</b> · ${USD.f(g.month)} a month (${fmt.pct(g.month, runRate)}%)`)}" data-grow data-delay="${i * 0.08}"></i>`).join('')}</div></div>
            <div class="dps-proj dps-use">${groups.map((g) => `<div><span class="small strong"><i class="bl-sw ${g.cls}"></i>${esc(g.label)} <span class="muted" style="font-weight:450">· ${g.n} ${g.n === 1 ? 'person' : 'people'}</span></span><span class="small"><b class="num">${USD.f(g.month)}</b> <span class="muted">a month · ${fmt.pct(g.month, runRate)}%</span></span></div>`).join('')}</div>
          </div>
        </div>
        <div class="kpis kpis-appr dps-row" id="dps-appr">
          <div class="kpi kpi-pair kpi-appr" data-reveal>
            <div class="kpi-label">${ic('cup-star-linear')}Appraisals</div>
            <div class="kpi-pair-row"><div class="kpi-value">${C.count(apprDone.length)}<small>/ ${staff.length}</small></div><div class="kpi-value">${apprCost.value}${apprCost.unit ? `<small>${apprCost.unit}</small>` : ''}</div></div>
            <div class="kpi-pair-row"><div class="kpi-sub">Completed so far in <span class="nowrap">${RM.FY.label}</span> · ${apprLeft} still to come</div><div class="kpi-sub">Cost till date · <span class="nowrap">${RM.FY.label}</span></div></div>
            <span class="kpi-go" aria-hidden="true">${ic('alt-arrow-down-linear')}</span><button type="button" class="kpi-link" data-appr-toggle aria-expanded="false" aria-controls="dps-appr-panel" aria-label="Appraisals: show the table"></button>
          </div>
          ${C.kpi({ label: 'Average rating', icon: 'star-linear', value: avgRating != null ? C.count(avgRating, 1) : '–', unit: '/ 5', sub: prevFy.label })}
          <div class="kpi kpi-fy-cost" data-reveal>
            <div class="kpi-label">${ic('wallet-money-linear')}Team investment cost</div>
            <div class="kpi-duo">${costPair}</div>
            <div class="kpi-sub">${costGrowth != null ? `<b>${costGrowth > 0 ? '+' : costGrowth < 0 ? '−' : ''}${Math.abs(costGrowth)}%</b> on ${prevFy.label}` : 'Nothing for ' + prevFy.label}</div>
          </div>
        </div>
        ${apprPanel(apprDone, apprNext, staff.length)}
        <div class="kpis kpis-use dps-row" id="dps-use">${allCard}${groups.map(useCard).join('')}</div>
        <div class="card dps-row" data-reveal id="dps-alloc-card">
          <div class="card-head"><h3 class="h3">Employee-wise project allocation</h3></div>
          ${RM.raTable.render(me, st, { p: 'dps', limit: 8 })}
        </div>
      </section>

      <section class="dps-sec" id="dps-init" aria-labelledby="dps-init-h">
        ${head('dps-init', 'DPS Initiatives', '', `<div class="legend spacer"><span><i class="sw" style="background:var(--info-dot)"></i>In progress <b class="num">${inProgress}</b></span><span><i class="sw" style="background:var(--ok-dot)"></i>Completed <b class="num">${inits.length - inProgress}</b></span></div>`)}
        <div class="card" data-reveal><div class="table-wrap"><table class="table init-table"><thead><tr><th>Initiative</th><th>Owners</th><th>Status</th></tr></thead>
          <tbody>${inits.map((it) => `<tr><td><span class="init-name"><span class="notif-ic">${ic(it.icon)}</span><span><b>${esc(it.name)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : it.items ? `<small>${it.items.length} workstreams · ${it.items.filter((x) => x.status === 'Completed').length} completed</small>` : ''}${it.next ? `<small>Next: ${esc(it.next)}</small>` : ''}</span></span></td><td>${initOwners(it.owners)}</td><td>${initBadge(initStatus(it))}</td></tr>`
            + (it.items || []).map((x) => `<tr class="sub-row"><td><span class="init-name is-sub">${ic(x.icon)}<span>${esc(x.name)}${x.next ? `<small>Next: ${esc(x.next)}</small>` : ''}</span></span></td><td>${x.owners ? initOwners(x.owners) : ''}</td><td>${initBadge(x.status)}</td></tr>`).join('')).join('')}</tbody></table></div></div>
      </section></div>`;
    },
    mount(root, { me }) {
      const pg = root.querySelector('.page');
      // the allocation table is the resource allocation table (RM.raTable): it wires its own filters and the use cards above it
      RM.raTable.mount(root, me, RM.raStates.dps, { p: 'dps', limit: 8, cards: '#dps-use' });
      settleTrends(root);
      pg.addEventListener('click', (e) => {
        // the flow in the header jumps to its section
        const j = e.target.closest('[data-jump]');
        if (j) {
          const sec = root.querySelector('#' + j.dataset.jump); const h = root.querySelector('#' + j.dataset.jump + '-h'); if (!sec) return;
          sec.scrollIntoView({ behavior: RM.reduced() ? 'auto' : 'smooth', block: 'start' });
          if (h) h.focus({ preventScroll: true });
          return;
        }
        // appraisals: the card opens and closes the panel under its row; the panel shows done or still to come
        const at = e.target.closest('[data-appr-toggle]');
        if (at) {
          const panel = root.querySelector('#dps-appr-panel'); const open = panel.hidden; panel.hidden = !open;
          at.setAttribute('aria-expanded', open); at.setAttribute('aria-label', `Appraisals: ${open ? 'hide' : 'show'} the table`); at.closest('.kpi').classList.toggle('is-open', open);
          if (open) { RM.motion.segThumb(panel); if (window.gsap && !RM.reduced()) gsap.from(panel, { height: 0, opacity: 0, duration: 0.38, ease: 'power2.out', clearProps: 'height,opacity' }); panel.scrollIntoView({ behavior: RM.reduced() ? 'auto' : 'smooth', block: 'nearest' }); }
          return;
        }
        const as = e.target.closest('#dps-appr-panel [data-seg]');
        if (as) {
          const panel = root.querySelector('#dps-appr-panel'); panel.querySelectorAll('[data-seg]').forEach((b) => b.setAttribute('aria-selected', b === as)); RM.motion.segThumb(panel);
          RM.$$('[data-appr-list]', panel).forEach((l) => { l.hidden = l.dataset.apprList !== as.dataset.seg; });
          return;
        }
        // revenue: chart or table
        if (revenueSeg(root, e)) return;
      });
    },
  };
  V.phOrg = {
    title: 'Organization',
    render({ me, params }) {
      const sel = params.id && q.person(params.id) ? params.id : null; // the tree opens as drawn; a person's details open only when asked for
      const model = RM.constellation(PH_ID(), { light: true, labels: true, sizes: [10.5, 7.2, 6, 5.6, 5.4], radii: [0, 0.4, 0.72, 0.88, 0.97] }); this._model = model;
      return `<div class="page">
      <header class="page-head">
        <div><h1 class="display" data-split>${esc(q.person(PH_ID()).practice)} <em class="accent">Organization Chart</em><span class="dot-o">.</span></h1></div>
        <div class="head-actions"><div class="combo"><label class="search-field" style="min-width:280px"><span class="sr-only">Find a person</span>${ic('magnifer-linear')}<input id="org-find" type="search" placeholder="Find a person…" role="combobox" aria-controls="org-find-list"></label><div class="combo-list" id="org-find-list" role="listbox" aria-label="People" hidden data-lenis-prevent></div></div></div>
      </header>
      <section class="stage stage-sky org-stage${sel ? ' has-panel' : ''}" data-reveal>
        <div class="org-canvas">${model.html}</div>
        <aside class="org-panel" id="org-panel" aria-label="Person details" tabindex="-1" data-lenis-prevent>${sel ? orgPanel(sel, me) : ''}</aside>
      </section></div>`;
    },
    mount(root, { me, params }) {
      const el = root.querySelector('[data-constellation]'); const page = root.querySelector('.page');
      const stage = root.querySelector('.org-stage'); const pnl = root.querySelector('#org-panel');
      RM.mountConstellation(el, this._model, { delay: .2 });
      // the map opens as drawn; picking someone lights up their reporting line and opens the details card beside it
      let openId = params.id && q.person(params.id) ? params.id : null; let opener = null;
      if (openId) RM.highlightNode(el, openId);
      const setHash = (h) => { try { history.replaceState(null, '', h); } catch (err) { /* sandboxed frames may refuse */ } };
      const open = (id, from) => {
        const swap = !!openId;
        openId = id; if (from) opener = from;
        RM.highlightNode(el, id);
        pnl.innerHTML = orgPanel(id, me); RM.$$('[data-reveal]', pnl).forEach((x) => { x.style.opacity = 1; });
        stage.classList.add('has-panel');
        if (!swap && window.matchMedia('(max-width: 1024px)').matches) { // phones: lift the tree above the sheet
          const bar = document.querySelector('.topbar'); const y = stage.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 8;
          window.scrollTo({ top: y, behavior: RM.reduced() ? 'auto' : 'smooth' });
        }
        if (swap && !RM.reduced() && window.gsap) gsap.from(pnl.children, { opacity: 0, y: 8, duration: .28, ease: 'power3.out', clearProps: 'transform' }); // keep the inline opacity: the card is [data-reveal], which CSS hides until revealed
        pnl.focus({ preventScroll: true });
        setHash('#/ph/org?id=' + id);
      };
      const close = () => {
        if (!openId) return;
        const back = opener && opener.isConnected ? opener : el.querySelector(`.c-node[data-node="${openId}"]`);
        openId = null; opener = null;
        RM.highlightNode(el, null);
        stage.classList.remove('has-panel');
        setHash('#/ph/org');
        if (back) back.focus({ preventScroll: true });
      };
      el.addEventListener('click', (e) => {
        const b = e.target.closest('.c-node, .c-label'); if (!b) return;
        const id = b.dataset.node || b.dataset.label;
        open(id, b.classList.contains('c-node') ? b : el.querySelector(`.c-node[data-node="${id}"]`));
      });
      page.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="org-close"]')) { close(); return; }
        const b = e.target.closest('[data-action="org-pick"]'); if (b) open(b.dataset.id);
      });
      page.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && openId && !e.target.closest('.combo') && !document.querySelector('.drawer, .modal, .popover, .cmdk')) { e.stopPropagation(); close(); }
      });
      const f = root.querySelector('#org-find');
      const people = q.active().filter((p) => p.role !== 'Admin').sort((a, b) => a.name.localeCompare(b.name));
      RM.combo(f, {
        search: (t) => (t ? people.filter((p) => (p.name + ' ' + p.designation + ' ' + p.id).toLowerCase().includes(t)) : people),
        render: (p, hl) => `${C.avatar(p, 'sm')}<span class="combo-text"><b>${hl(p.name)}</b><small>${hl(p.designation)}</small></span>${p.role !== '–' ? `<span class="combo-meta">${esc(p.role)}</span>` : ''}`,
        empty: (v) => `No one matches “${v}”. Try a first name, a designation or an ID.`,
        onPick: (p) => { open(p.id, f); f.value = ''; },
      });
    },
  };
  function orgPanel(id, me) {
    const p = q.person(id); const rm = q.person(p.rm); const dd = q.descendants(id); const dir = dd.filter((d) => d.type === 'Direct');
    // open to every role: review status only within visibility, billability only within financial scope; the full profile only within profile access
    // the year's average rating, manager and self, each with an arrow against last year's
    const see = RV.canSee(me, id); const fy = RV.curFy(); const pfy = RV.fyKey(RV.fyYear(fy) - 1);
    const rt = see ? RV.fyRating(id, fy) : { n: 0 }; const prt = see ? RV.fyRating(id, pfy) : { n: 0 };
    const rate = (k, label) => { const v = rt[k]; const pv = prt[k]; const d = v == null || pv == null ? null : Math.round((v - pv) * 10) / 10;
      const dir = d == null ? null : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      const chip = dir ? `<span class="dps-delta is-sm is-${dir}" aria-label="${dir === 'flat' ? 'Level with' : dir === 'up' ? 'Up ' + d.toFixed(1) + ' on' : 'Down ' + (-d).toFixed(1) + ' on'} ${esc(RV.fyLabel(pfy))}">${ic(dir === 'flat' ? 'arrow-right-linear' : 'arrow-right-up-linear')}<b>${dir === 'flat' ? 'Level' : (d > 0 ? '+' : '−') + Math.abs(d).toFixed(1)}</b></span>` : '';
      return `<span class="org-rt"><span class="small muted">${label}</span><b class="num">${v == null ? '–' : v.toFixed(1)}</b>${chip}</span>`; };
    const lm = q.latestMonth(); const f = q.finScope(me, p) ? q.finRow(id, lm) : null;
    return `<div class="card card-pad" data-reveal>
      <div class="profile-hero" style="gap:16px">${C.avatar(p, 'lg')}<div style="min-width:0"><div class="h3" style="font-size:18px">${esc(p.name)}</div><div class="small muted">${esc(p.designation)}</div><div class="small muted">${esc(p.id)}</div></div><button type="button" class="x-btn org-x" data-action="org-close" aria-label="Close details">${ic('close-circle-linear')}</button></div>
      <div class="divider"></div>
      <dl class="kv org-kv">
        <dt>Reports to</dt><dd>${rm ? `<button class="link-btn" data-action="org-pick" data-id="${rm.id}">${esc(rm.name)}</button>` : '<span class="muted">Practice leadership</span>'}</dd>
        <dt>Platform role</dt><dd>${esc(p.role === '–' ? 'None (contractor)' : p.role)}</dd>
        <dt>Allocation</dt><dd>${esc(p.alloc)}${f ? ` · <span class="muted">${f.billable ? 'billable' : 'non-billable'}</span>` : ''}</dd>
        <dt>Team</dt><dd>${dir.length} direct${dd.length - dir.length ? ' · ' + (dd.length - dir.length) + ' indirect' : ''}</dd>
        ${rt.n || prt.n ? `<dt class="org-kv-full">Average rating · ${esc(RV.fyLabel(fy))}</dt><dd class="org-kv-full org-reviews">
          <a class="org-rating" href="${RM.reviewPageHref(id, 'history', null, me)}" aria-label="${esc(p.name)}’s review history">${rate('mgr', 'Manager')}${rate('self', 'Self')}</a>
          <div class="tiny muted">${rt.n ? '' : 'No final marks yet this year · '}${prt.n ? `Arrows compare with ${esc(RV.fyLabel(pfy))}: manager ${prt.mgr == null ? '–' : prt.mgr.toFixed(1)}, self ${prt.self == null ? '–' : prt.self.toFixed(1)}` : `No ratings in ${esc(RV.fyLabel(pfy))} to compare with`}</div></dd>` : ''}
      </dl>
      ${dir.length ? `<div class="divider"></div><div class="small muted" style="margin-bottom:10px">Direct reportees</div><div class="stack" style="gap:8px">${dir.map((d) => `<button class="person" data-action="org-pick" data-id="${d.p.id}" style="width:100%">${C.avatar(d.p, 'sm')}<span style="min-width:0"><span class="person-name" style="display:block">${esc(d.p.name)}</span><span class="person-sub">${esc(d.p.designation)}</span></span></button>`).join('')}</div>` : ''}
      ${q.canOpenProfile(me, p) ? `<div class="org-foot"><button class="btn btn-secondary btn-sm" data-action="open-person" data-id="${p.id}">Open profile ${ic('arrow-right-linear')}</button></div>` : ''}
    </div>`;
  }

  // a row's year, in US dollars: the forecast for the rest of the year, the actuals uploaded so far, actual − forecast over the
  // uploaded actuals (a hyphen when nothing is uploaded: a non-billable person), revenue (the two together), cost, the
  // yearly target when the row has one (noTarget: a table without the column), profit, and the profit margin: (revenue − cost)
  // ÷ revenue (a hyphen with no revenue)
  function fyCells(y, target, noTarget) {
    const M = USD.f; const up = y.months.reduce((a, m) => a + m.uploaded, 0); const fVar = y.months.reduce((a, m) => a + m.fVar, 0);
    return `<td class="r num">${M(y.forecast)}</td><td class="r num">${M(y.actual)}</td><td class="r num">${up ? M(fVar, { plus: true }) : '<span class="faint">–</span>'}</td><td class="r num">${M(y.revenue)}</td><td class="r num">${M(y.cost)}</td>${noTarget ? '' : `<td class="r num">${target != null ? M(target) : '<span class="faint">–</span>'}</td>`}<td class="r num strong cell-var ${fmt.varCls(y.profit)}">${M(y.profit)}</td><td class="r num cell-var ${y.margin == null ? '' : fmt.varCls(y.margin)}">${y.margin == null ? '<span class="faint">–</span>' : (y.margin < 0 ? '−' + Math.abs(y.margin).toFixed(1) : y.margin.toFixed(1)) + '%'}</td>`;
  }
  // fyCells' headings: one line each, with what it covers or how it's worked out under it (target: the Clusters table's column)
  const figHeads = (fy, target) => [['Forecast', span(fy.withForecasts)], ['Actual', span(fy.withActuals)], ['Variance', 'Actual − forecast'], ['Revenue', 'Full year'], ['Cost', 'Full year'],
    ...(target ? [['Target', 'Full year']] : []), ['Profit', 'Revenue − cost'], ['Margin', 'Profit ÷ revenue']].map(([l, sub]) => `<th class="r">${l}<span class="th-span">${esc(sub)}</span></th>`).join('');
  // who a person bills and what they work on (the latest month with figures)
  const workCell = (p) => { const use = RM.useOf(p); const pr = RM.resourceOf(p.id).projects;
    return `<span class="fin-client">${esc(use === 'bench' ? 'Bench' : RM.clientOf(p).name)}</span><span class="person-sub">${pr.length ? esc(pr.join(', ')) : 'No project'}</span>`; };
  // a unit's figures added up over every month with figures (the year so far); counts are person-months
  const finSumAll = (ids, months) => months.reduce((t, mk) => { const x = q.finSum(ids, mk); Object.keys(t).forEach((k) => { t[k] += x[k]; }); return t; }, { forecast: 0, actual: 0, billable: 0, nonBillable: 0, missing: 0, uploaded: 0, fVar: 0 });

  // Financial Performance (the Practice Head: the practice, then each cluster in it) and Team Financials (a PM: their cluster,
  // then each cluster inside it) are one page. A cluster is a lead and everyone below them, down to the next lead; everyone
  // with a financial target leads one, as do the Practice Head and, on their own page, the PM.
  function finScope(mode, me) {
    const rootId = mode === 'pm' ? me.id : PH_ID();
    const lead = (p) => !!p && (isLead(p) || p.id === rootId);
    const above = (p) => { let x = q.person(p.rm); while (x && !lead(x)) x = q.person(x.rm); return x || null; };
    return { mode, rootId, lead, above, base: mode === 'pm' ? '#/me/finance' : '#/ph/finance',
      inScope: (id) => mode === 'ph' || id === rootId || q.descendants(rootId).some((d) => d.p.id === id),
      leadOf: (id) => { const p = q.person(id); return !p ? null : lead(p) ? p : above(p); },
      // the people in a lead's cluster, and the leads directly below them (each heads a cluster of their own)
      rows: (id) => q.descendants(id).filter((d) => { const l = above(d.p); return l && l.id === id; }) };
  }
  // drilling a level deeper pushes the page forward, the breadcrumb pushes it back
  const finMorph = (mode) => (prev, next) => {
    const root = finScope(mode, q.me()).rootId; const a = prev.u || root, b = next.u || root; if (a === b) return null;
    const depth = (id) => (id === root ? 0 : q.chain(id).length);
    return { dir: depth(b) >= depth(a) ? 1 : -1, after: (el) => { const c = el.querySelector('.drill-path [aria-current="true"]'); if (c && !RM.reduced() && window.gsap) gsap.fromTo(c, { scale: .85, opacity: 0 }, { scale: 1, opacity: 1, duration: .36, delay: .12, ease: 'back.out(2)', clearProps: 'transform' }); } };
  };
  // Show profile: the row itself opens the cluster, so the profile has its own button
  // an icon button with a tooltip, so the Clusters table's ten figure columns fit the page
  const profBtn = (p) => (q.canOpenProfile(q.me(), p) ? `<button type="button" class="btn btn-ghost btn-sm btn-icon fin-prof" data-action="open-person" data-id="${p.id}" aria-label="Show ${esc(p.name)}’s profile" data-tip="Show profile">${ic('user-rounded-linear')}</button>` : '');
  // one person's billability in the latest month: Yes (the client it bills, in the tooltip) or No (internal / investment, or
  // bench). Rows of several people keep the bar (C.billMini), which counts them
  const billYN = (p, last) => { const u = RM.useOf(p, last); const yes = u === 'billable';
    return `<span class="bill-yn ${yes ? 'is-yes' : 'is-no'}" data-tip="${esc(yes ? 'Billable · ' + RM.clientOf(p, last).name : u === 'bench' ? 'Not billable · bench' : 'Not billable · internal / investment')}">${ic(yes ? 'check-circle-linear' : 'close-circle-linear')}${yes ? 'Yes' : 'No'}</span>`; };
  const rowGo = (lead) => (lead ? `<span class="fin-go" aria-hidden="true">${ic('alt-arrow-right-linear')}</span>` : '<span class="fin-go is-none" aria-hidden="true"></span>');
  // a cluster's rows under it: the head's own figures first, then everyone below them, so they add up to the cluster's row
  function clusterSubs(S, id, last) {
    const head = q.person(id); const row = (p, sub, depth, lead) => `<tr class="sub-row${lead ? ' is-clickable' : ''}${depth ? '' : ' is-own'}" data-sub-of="${id}" ${lead ? `data-href="${S.base}?u=${p.id}"` : ''}><td><div style="padding-left:${Math.max(0, depth - 1) * 22}px">${C.person(p, sub, { size: 'sm' })}</div></td>
          <td>${billYN(p, last)}</td>${fyCells(fyRollup([p.id]), null)}<td class="r nowrap fin-acts">${profBtn(p)}${rowGo(lead)}</td></tr>`;
    return row(head, `${esc(head.designation)} · their own figures`, 0, false)
      + q.descendants(id).map((d) => row(d.p, esc(d.p.designation) + (d.depth > 1 ? ' · via ' + esc(fmt.first(q.person(d.p.rm).name)) : ''), d.depth, S.lead(d.p))).join('');
  }
  // one row a cluster: its total; expanding it opens its people
  function clusterRows(S, kids, last) {
    return kids.map((k) => {
      const sub = k.ids.length > 1 ? `Cluster total · ${k.ids.length} people` : `${esc(k.p.designation)} · 1 in the cluster`;
      return `<tr data-row="${k.id}" class="is-clickable" data-href="${S.base}?u=${k.id}"><td><div class="hstack" style="gap:4px;flex-wrap:nowrap">${k.ids.length > 1 ? `<button class="expander" aria-expanded="false" aria-label="Show ${esc(k.p.name)}’s cluster" data-fexpand="${k.id}">${ic('alt-arrow-right-linear')}</button>` : '<span style="width:32px;display:inline-block;flex:none"></span>'}${C.person(k.p, sub, { size: 'sm' })}</div></td><td>${k.ids.length > 1 ? C.billMini(k.ids, last) : billYN(k.p, last)}</td>${fyCells(fyRollup(k.ids), store.db.targets[k.id])}<td class="r nowrap fin-acts">${profBtn(k.p)}${rowGo(true)}</td></tr>`;
    }).join('');
  }
  /* All employees: everyone in the practice, one row each (the Practice Head and the people outside every cluster included, so
   * with no filter the total row matches DPS Financials), with Resource Allocation's search and filters (RM.raFilters, kept
   * for the visit) and a total row adding up who's showing */
  const finSt = () => RM.finFilter || (RM.finFilter = RM.raFilters.state());
  const finOn = (p) => !RM.raFilters.active(finSt()) || RM.raFilters.match(p, finSt());
  const empPeople = () => q.active().filter((p) => !p.system);
  const empCount = () => { const all = empPeople(); return `${all.filter(finOn).length} of ${all.length} people`; };
  function empRows(S, last) {
    const list = empPeople().filter(finOn).map((p) => ({ p, y: fyRollup([p.id]) })).sort((a, b) => b.y.revenue - a.y.revenue || a.p.name.localeCompare(b.p.name));
    if (!list.length) return `<tr><td colspan="11">${C.empty('magnifer-linear', 'No one matches', 'Try another name, role, client, location or project.')}</td></tr>`;
    return list.map(({ p, y }) => { const l = S.leadOf(p.id);
      const cl = q.isPH(p) ? '<span class="muted">Practice Head</span>' : l && l.id !== S.rootId ? `<a class="fin-cl" href="${S.base}?u=${l.id}" data-nav-dir="1">${esc(l.name)}</a>` : '<span class="faint">No cluster</span>';
      return `<tr><td>${C.person(p, esc(p.designation), { size: 'sm' })}</td><td class="small">${cl}</td><td>${billYN(p, last)}</td>${fyCells(y, null, true)}<td class="r nowrap fin-acts">${profBtn(p)}</td></tr>`; }).join('');
  }
  const empTotal = (last) => { const ids = empPeople().filter(finOn).map((p) => p.id); if (!ids.length) return '';
    return `<tr class="fin-total"><td><b>Total</b> <span class="muted">· ${ids.length} ${ids.length === 1 ? 'person' : 'people'}</span></td><td></td><td>${C.billMini(ids, last)}</td>${fyCells(fyRollup(ids), null, true)}<td></td></tr>`; };
  function finPage(mode, { me, params }) {
    const S = finScope(mode, me); const months = q.finMonths(); const last = months[months.length - 1];
    // the breakdown covers every month with figures (the year so far); billability is the latest month's
    const pLabel = `${fmt.monthShort(months[0])} – ${fmt.monthLabel(last)}`;
    // only cluster leads have a page; anyone else's link opens the page of the cluster they're in
    const asked = params.u && q.person(params.u) && S.inScope(params.u) ? params.u : S.rootId; const u = (S.leadOf(asked) || { id: S.rootId }).id;
    const unit = q.person(u); const practice = mode === 'ph' && u === S.rootId;
    const path = [unit, ...q.chain(u)].reverse().filter((p) => p && S.lead(p) && S.inScope(p.id));
    const ids = practice ? q.active().map((p) => p.id) : unitIds(u);
    const fy = fyRollup(ids); const pt = practiceTarget(); const target = practice ? (pt.leads ? pt.total : null) : store.db.targets[u];
    // the practice: one row per cluster. A lead's page: the lead, each person in their cluster, and any cluster led below them
    const team = S.rows(u);
    const asKid = (d) => (S.lead(d.p) ? { id: d.p.id, name: d.p.name, ids: unitIds(d.p.id), p: d.p, lead: true } : { id: d.p.id, name: d.p.name, ids: [d.p.id], p: d.p, via: d.depth > 1 ? q.person(d.p.rm) : null });
    const kids = practice ? team.filter((d) => S.lead(d.p)).map(asKid) : [{ id: u, name: unit.name + ' (individual)', ids: [u], p: unit, self: true }, ...team.map(asKid)];
    const kidRows = kids.map((k) => ({ k, s: finSumAll(k.ids, months) }));
    const trend = months.map((mk) => q.finSum(ids, mk)); const partTrend = trend.some((t) => t.missing);
    const leaf = !practice && !team.length; const clusters = kids.some((k) => k.lead);
    const qs = (o) => S.base + '?' + Object.entries(Object.assign({ u }, o)).map(([k, v]) => k + '=' + v).join('&');
    const title = practice ? 'DPS <em class="accent">Financials</em>' : `${esc(fmt.first(unit.name))}’s <em class="accent">${leaf ? 'Numbers' : 'Cluster'}</em>`;
    // a lead's cluster page leads back to their profile, the other half of the profile's cluster link: the page slides back
    const backToProfile = mode === 'ph' && !practice && q.canOpenProfile(me, unit) ? `<div class="head-actions"><a class="link-pill" href="#/people/${unit.id}" data-nav-dir="-1" aria-label="Show ${esc(unit.name)}’s profile">${ic('user-rounded-linear')}<span>Show profile</span></a></div>` : '';
    return `<div class="page">
      <header class="page-head"><div><h1 class="display" data-split>${title}<span class="dot-o">.</span></h1></div>${backToProfile}</header>
      ${path.length > 1 ? `<nav class="drill-path" aria-label="Drill path" data-reveal style="margin-bottom:18px">${path.map((p, i) => `${i ? ic('alt-arrow-right-linear') : ''}<button type="button" data-go="${qs({ u: p.id })}" aria-current="${p.id === u}">${mode === 'ph' && p.id === S.rootId ? 'Financial Performance' : esc(p.name)}</button>`).join('')}</nav>` : ''}
      <section aria-label="DPS Financials">${dpsCard(fy, target, practice ? 'Practice cost' : 'Cluster cost', gapHref(mode, me, practice ? null : u), () => gapCta(mode, me, practice ? null : u))}</section>
      <section class="section grid g-main-side">
        <div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">${leaf ? 'This person' : practice ? 'By cluster' : 'By cluster member'} <span class="muted" style="font-weight:450">· ${pLabel}</span></h2><div class="legend spacer"><span><i class="sw" style="background:var(--viz-actual)"></i>Actual</span><span><i class="sw" style="background:var(--viz-forecast)"></i>Forecast</span></div></div>
          <div class="card-body">${(() => { const br = kidRows.filter((x) => x.s.billable > 0); return br.length ? RM.charts.bullets(br.map((x) => ({ name: x.k.self ? fmt.first(x.k.p.name) + ' (self)' : x.k.name, forecast: USD.of(x.s.forecast), actual: x.s.uploaded ? USD.of(x.s.actual) : null, fVar: USD.of(x.s.fVar), note: x.s.missing && x.s.uploaded ? `${x.s.missing} actual${x.s.missing > 1 ? 's' : ''} still to upload` : '', drill: x.k.lead ? x.k.id : null, person: x.k.lead ? null : x.k.p.id })), { label: 'Financials by cluster', f: fmt.usdShort }) : C.empty('case-linear', 'Non-billable', 'No one in this cluster has been billable this year.'); })()}
            <p class="small muted" style="margin-top:6px">${practice ? 'Select a cluster to drill down.' : clusters ? 'Select a cluster to drill down, or a person to open their profile.' : 'Select a person to open their profile.'}</p></div>
        </div>
        <div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">Trend</h2><span class="spacer small muted">${fmt.monthShort(months[0])} – ${fmt.monthShort(last)}</span></div>
          <div class="card-body">${RM.charts.lines([
            { name: 'Forecast', color: 'var(--viz-forecast)', dash: true, values: trend.map((t) => USD.of(t.forecast)) },
            // a month's actual is drawn once all its actuals are uploaded, so a month part-way through isn't read as a drop
            { name: 'Actual', color: 'var(--viz-actual)', values: trend.map((t) => (t.missing ? null : USD.of(t.actual))) },
          ], months.map(fmt.monthShort), { yFmt: USD.axis, tipFmt: 'usd', w: 460, h: 260, padL: 56, padR: 76, label: 'Forecast and actual trend' })}
            ${partTrend ? `<p class="small muted" style="margin-top:6px">The actual line joins a month once all its actuals are uploaded.</p>` : ''}</div>
        </div>
      </section>
      <section class="section card" data-reveal>
        <div class="card-head"><h2 class="h3">${practice ? 'Clusters' : 'Cluster breakdown'} <span class="muted" style="font-weight:450">· ${RM.FY.label}</span></h2></div>
        ${practice ? `<div class="table-wrap"><table class="table fin-table"><thead><tr><th>Cluster</th><th>Billable<span class="th-span">${fmt.monthLabel(last)}</span></th>${figHeads(fy, true)}<th><span class="sr-only">Profile</span></th></tr></thead>
        <tbody id="fin-units">${clusterRows(S, kids, last)}</tbody></table></div>`
        : (() => {
          // everyone in the cluster, the lead included, by the revenue they bring in this year; a cluster led below this one counts as one row.
          // The same figures as the Clusters table (fyCells), without the target: no one person has one
          const rows = kids.map((k) => { const y = fyRollup(k.ids); return { k, y, rev: y.revenue }; }).sort((a, b) => b.rev - a.rev || a.k.p.name.localeCompare(b.k.p.name));
          return `<div class="table-wrap"><table class="table fin-table fin-people"><thead><tr><th>Employee</th><th>Client · project</th>${figHeads(fy, false)}</tr></thead>
          <tbody id="fin-units">${rows.map(({ k, y }) => `<tr data-row="${k.id}"${k.lead ? ` class="is-clickable" data-href="${qs({ u: k.id })}"` : ''}><td>${C.person(k.p, esc(k.p.designation) + (k.self ? ' · leads this cluster' : k.lead ? ` · leads ${k.ids.length - 1} more` : ''), { size: 'sm', link: true })}</td>
            <td class="small">${workCell(k.p)}</td>${fyCells(y, null, true)}</tr>`).join('')}</tbody></table></div>`;
        })()}
      </section>
      ${practice ? `<section class="section card" data-reveal>
        <div class="card-head"><h2 class="h3">All employees <span class="muted" style="font-weight:450">· ${RM.FY.label}</span></h2></div>
        ${RM.raFilters.toolbar('fin', empPeople(), finSt(), empCount())}
        <div class="table-wrap"><table class="table fin-table fin-emps"><thead><tr><th>Employee</th><th>Cluster</th><th>Billable<span class="th-span">${fmt.monthLabel(last)}</span></th>${figHeads(fy, false)}<th><span class="sr-only">Profile</span></th></tr></thead>
        <tbody id="fin-emps">${empRows(S, last)}</tbody><tfoot id="fin-emps-total">${empTotal(last)}</tfoot></table></div>
      </section>` : ''}</div>`;
  }
  function finMount(mode, root, { params, me }) {
    const S = finScope(mode, me); const go = (h) => { location.hash = h.replace(/^#/, ''); };
    const months = q.finMonths(); const last = months[months.length - 1];
    settleTrends(root);
    root.querySelector('.page').addEventListener('click', (e) => {
      if (revenueSeg(root, e)) return;
      const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
      const d = e.target.closest('[data-action="drill"]'); if (d && d.dataset.id && d.dataset.id !== 'null') go(`${S.base}?u=${d.dataset.id}`);
    });
    root.querySelector('.page').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const d = e.target.closest('[data-action="drill"]'); if (d) d.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    // expand a cluster in place; a lead's row opens their cluster, and every row has Show profile. The table's height glides
    // between the two states (as a filter swap does), rows arrive top-down with their bars, and leave last-first
    // All employees: the toolbar rebuilds the rows (RM.swapRows, lighter while typing), the total and the count
    const emps = root.querySelector('#fin-emps');
    if (emps) RM.raFilters.wire(root, 'fin', finSt(), (mode) => {
      root.querySelector('#fin-count').textContent = empCount(); RM.tip.hide();
      RM.swapRows(emps, empRows(S, last), { mode: mode || 'swap', after: () => { root.querySelector('#fin-emps-total').innerHTML = empTotal(last); RM.motion.charts(emps); } });
    });
    const units = root.querySelector('#fin-units'); if (!units) return;
    const wrap = units.closest('.table-wrap'); const motion = () => !RM.reduced() && window.gsap;
    const glide = (h0) => { const h1 = wrap.offsetHeight; if (Math.abs(h1 - h0) > 2) gsap.fromTo(wrap, { height: h0, overflow: 'hidden' }, { height: h1, duration: Math.min(.32, .18 + Math.abs(h1 - h0) / 4000), ease: 'power2.inOut', clearProps: 'height,overflow' }); };
    units.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fexpand]'); if (!b) return;
      const id = b.dataset.fexpand; const tr = b.closest('tr'); const open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', !open); b.setAttribute('aria-label', (open ? 'Show ' : 'Hide ') + q.person(id).name + '’s cluster');
      if (motion()) { gsap.killTweensOf(wrap); gsap.set(wrap, { clearProps: 'height,overflow' }); }
      const subs = RM.$$(`tr[data-sub-of="${id}"]`, root);
      if (open) {
        subs.forEach((r) => r.removeAttribute('data-sub-of')); // leaving: a quick re-open builds fresh rows
        const done = () => { const h0 = wrap.offsetHeight; subs.forEach((r) => r.remove()); if (motion()) glide(h0); };
        if (motion()) gsap.to(subs.slice().reverse(), { opacity: 0, y: -4, duration: .12, stagger: .015, ease: 'power1.in', onComplete: done }); else done();
        return;
      }
      const rows = clusterSubs(S, id, last);
      const h0 = wrap.offsetHeight; tr.insertAdjacentHTML('afterend', rows);
      const added = RM.$$(`tr[data-sub-of="${id}"]`, root);
      if (!motion()) return;
      glide(h0);
      gsap.fromTo(added, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .3, stagger: .035, ease: 'power2.out', clearProps: 'opacity,transform' });
      added.forEach((r) => RM.motion.charts(r));
    });
  }
  /* ================= TARGET GAP DRILL DOWN AND INITIATIVES: WHICH CLUSTERS ARE SHORT, AND WHAT'S PLANNED ================= */
  // The Gap card on DPS Financials opens this page when the forecast falls short of the target. The Practice Head (#/ph/gap)
  // sees every cluster against its target, the ones short of it first, and keeps the initiatives to fill the gap, for the
  // practice or for one cluster. A cluster head (a PM who leads a cluster with a target, #/me/gap) sees their own cluster and
  // adds ideas for it; the Practice Head sees them beside their initiatives. Items live in db.gapItems:
  // { id, scope: 'practice' | a lead's id, title, note, impact (₹ added by March, or null), status, by, at }. Status:
  // Idea (a cluster head's, not taken up yet) · Planned · In progress · Done; only the Practice Head sets it.
  const GAP_STATUS = ['Planned', 'In progress', 'Done'];
  const O = RM.overlay;
  const gapItems = () => store.db.gapItems || (store.db.gapItems = []);
  const isClusterHead = (me) => !!me && me.role === 'PM' && q.hasReportees(me.id) && store.db.targets[me.id] != null;
  RM.isClusterHead = isClusterHead;
  // initiatives count toward the gap once the Practice Head plans them; an idea doesn't until it's taken up
  const counts = (x) => x.status !== 'Idea';
  // each cluster against its target: the year-end (actuals plus the forecast to March), short of the target or ahead of it,
  // its items and how many of them are ideas not taken up yet
  function clusterGaps() {
    return targetLeads().filter((p) => store.db.targets[p.id] != null).map((p) => {
      const fy = fyRollup(unitIds(p.id)); const target = store.db.targets[p.id]; const gap = target - fy.revenue;
      const items = gapItems().filter((x) => x.scope === p.id);
      return { p, fy, target, gap, short: gap > 0, items, ideas: items.filter((x) => !counts(x)).length };
    }).sort((a, b) => b.gap - a.gap);
  }
  const practiceGap = () => { const fy = fyRollup(q.active().map((p) => p.id)); const pt = practiceTarget(); return { fy, target: pt.total, gap: pt.total - fy.revenue }; };
  // where the Gap card leads, and what its link says
  const gapHref = (mode, me, u) => (mode === 'pm' ? (u == null || u === me.id) && isClusterHead(me) ? '#/me/gap' : '' : '#/ph/gap' + (u ? '?u=' + u : ''));
  function gapCta(mode, me, u) {
    const its = (list) => { const n = list.filter(counts).length; const i = list.length - n; return [n ? `${n} ${n === 1 ? 'initiative' : 'initiatives'}` : '', i ? `${i} ${i === 1 ? 'idea' : 'ideas'}` : ''].filter(Boolean).join(' · '); };
    if (mode === 'pm') { const mine = gapItems().filter((x) => x.scope === me.id); return mine.length ? its(mine) : 'Add your ideas'; }
    if (!u) { const cl = clusterGaps(); return `${cl.filter((c) => c.short).length} of ${cl.length} clusters short`; }
    return its(gapItems().filter((x) => x.scope === u)) || 'No initiatives yet';
  }
  const scopeName = (scope) => (scope === 'practice' ? 'Practice-wide' : (q.person(scope) || { name: '–' }).name);
  const gapBadge = (s) => `<span class="badge ${s === 'Done' ? 'b-ok' : s === 'In progress' ? 'b-info' : s === 'Idea' ? 'b-outline' : 'b-orange'} no-dot" data-no-tag>${esc(s)}</span>`;
  // one item. edit: the viewer may change or remove it (the Practice Head their initiatives, a cluster head their ideas
  // until they're taken up); setStatus: the Practice Head's status picker
  function gapItem(x, me) {
    const by = q.person(x.by) || { name: '–' }; const idea = q.isPH(by) ? '' : x.by === me.id ? 'Your idea' : 'Idea from ' + by.name;
    const mine = x.by === me.id; const ph = q.isPH(me); const edit = ph ? q.isPH(by) || x.status === 'Idea' : mine && x.status === 'Idea';
    const status = ph ? `<select class="select gx-status" data-gx-status="${x.id}" aria-label="Status of ${esc(x.title)}">${(x.status === 'Idea' ? ['Idea'] : []).concat(GAP_STATUS).map((s) => `<option${s === x.status ? ' selected' : ''}>${s}</option>`).join('')}</select>` : gapBadge(x.status);
    return `<li class="gx-item${x.status === 'Idea' ? ' is-idea' : ''}" data-gx="${x.id}">
        <span class="gx-ic" aria-hidden="true">${ic(x.status === 'Idea' ? 'lightbulb-bolt-linear' : 'target-linear')}</span>
        <div class="gx-body"><b class="gx-title">${esc(x.title)}</b>${x.note ? `<p class="gx-note">${esc(x.note)}</p>` : ''}
          <span class="tiny muted">${idea ? `<b class="gx-from">${esc(idea)}</b> · ` : `Added by ${x.by === me.id ? 'you' : esc(by.name)} · `}${fmt.date(x.at, { noYear: true })}</span></div>
        <div class="gx-side"><span class="gx-amt num${x.impact ? '' : ' faint'}">${x.impact ? '+' + USD.f(x.impact) : 'No amount'}</span>${status}
          ${edit ? `<span class="gx-acts"><button type="button" class="icon-btn" data-gx-edit="${x.id}" aria-label="Change ${esc(x.title)}">${ic('pen-2-linear')}</button><button type="button" class="icon-btn" data-gx-del="${x.id}" aria-label="Remove ${esc(x.title)}">${ic('close-circle-linear')}</button></span>` : ''}</div>
      </li>`;
  }
  const gapList = (list, me, empty) => (list.length ? `<ul class="gx-list">${list.slice().sort((a, b) => (counts(b) - counts(a)) || String(b.at).localeCompare(String(a.at))).map((x) => gapItem(x, me)).join('')}</ul>` : `<p class="small muted gx-empty">${empty}</p>`);
  // the figures at the top: the target and the year-end (the actuals so far and the forecast to March), then how the gap adds
  // up: what remains of the target less the forecast for the months to March
  function gapKpis(target, fy, gap) {
    const left = Math.max(0, target - fy.actual); const n = fy.withForecasts.length; const ok = gap <= 0;
    return `<section class="kpis kpis-2">
      ${C.kpi({ label: 'Target', icon: 'wallet-money-linear', value: big$(target), sub: RM.FY.label })}
      ${C.kpi({ label: 'Year end current forecasted revenue', icon: 'chart-2-linear', value: big$(fy.revenue) })}
    </section>
    <section class="card gx-eq" data-reveal aria-label="How the gap adds up">
      <div class="gx-term"><span class="kpi-label">Remaining</span><span class="dps-value is-tight">${big$(left)}</span><span class="kpi-sub">left to earn by March</span></div>
      <span class="gx-op" aria-hidden="true">−</span>
      <div class="gx-term"><span class="kpi-label">Forecast</span><span class="dps-value is-tight">${big$(fy.forecast)}</span><span class="kpi-sub">${n ? `${span(fy.withForecasts)} · ${USD.f(fy.forecast / n)} a month` : 'No months left to forecast'}</span></div>
      <span class="gx-op" aria-hidden="true">=</span>
      <div class="gx-term is-gap${ok ? ' is-clear' : ''}"><span class="kpi-label"><i class="sw ${ok ? 'sw-clear' : 'sw-gap'}" aria-hidden="true"></i>Gap</span><span class="dps-value is-tight">${big$(Math.max(0, gap))}</span>
        <span class="kpi-sub">${ok ? `The forecast covers it${gap < 0 ? `, with ${USD.f(-gap)} to spare` : ''}` : n ? `${USD.f(left / n)} a month needed · ${n} ${n === 1 ? 'month' : 'months'} left` : 'Short of the target'}</span></div>
    </section>`;
  }
  const big$ = (v) => { const m = money(v, USD); return `${m.value}${m.unit ? `<small>${m.unit}</small>` : ''}`; };
  function gapPage(mode, { me, params }) {
    const ph = mode === 'ph'; const from = RM.app.fromHash || '';
    const back = ph ? (params.from === 'ov' || from.startsWith('#/ph/overview') ? ['#/ph/overview', 'Practice Overview'] : [params.u ? '#/ph/finance?u=' + params.u : '#/ph/finance', params.u ? `${fmt.first((q.person(params.u) || { name: '' }).name)}’s Cluster` : 'DPS Financials']) : ['#/me/finance', 'Team Financials'];
    const backLink = `<a class="link-btn gx-back" href="${back[0]}" data-nav-dir="-1">${ic('alt-arrow-left-linear')}${esc(back[1])}</a>`;
    if (!ph) {
      // a cluster head: their cluster's gap, their ideas, and what the Practice Head has planned for it
      const fy = fyRollup(unitIds(me.id)); const target = store.db.targets[me.id]; const gap = target - fy.revenue; const items = gapItems().filter((x) => x.scope === me.id);
      const ideas = items.filter((x) => x.by === me.id); const theirs = items.filter((x) => x.by !== me.id); const wide = gapItems().filter((x) => x.scope === 'practice' && counts(x));
      return `<div class="page gx-page" data-gx-mode="pm">${backLink}
        <header class="page-head"><div><h1 class="display" data-split>Target Gap <em class="accent">Drill Down</em> and Initiatives<span class="dot-o">.</span></h1></div></header>
        ${gapKpis(target, fy, gap)}
        <section class="section card" data-reveal><div class="card-head"><div><h2 class="h3">Your ideas</h2><p class="small muted" style="margin-top:3px">For your cluster. ${esc((q.person(PH_ID()) || { name: 'The Practice Head' }).name)} sees them and decides which to take up.</p></div><button type="button" class="btn btn-primary btn-sm spacer" data-gx-add="${me.id}">${ic('add-circle-linear')}Add an idea</button></div>
          ${gapList(ideas, me, 'No ideas yet. Add what could bring in more revenue for your cluster by March.')}</section>
        <section class="section card" data-reveal><div class="card-head"><h2 class="h3">Planned for your cluster</h2></div>
          ${gapList(theirs, me, 'Nothing planned for your cluster yet.')}
          ${wide.length ? `<div class="gx-sub">Across the practice</div>${gapList(wide, me, '')}` : ''}</section>
      </div>`;
    }
    const pg = practiceGap(); const cl = clusterGaps(); const hl = params.u || '';
    const wide = gapItems().filter((x) => x.scope === 'practice');
    const row = (c) => `<tr class="gx-row is-clickable${c.p.id === hl ? ' is-hl' : ''}" data-gx-go="${c.p.id}">
        <td>${C.person(c.p, `${c.fy.people} ${c.fy.people === 1 ? 'person' : 'people'}`, { link: true, size: 'sm' })}</td>
        <td class="r num">${USD.f(c.target)}</td><td class="r num">${USD.f(c.fy.revenue)}</td>
        <td class="r num">${c.short ? `<b class="gx-short">${USD.f(c.gap)}</b>` : `<span class="gx-ahead">${USD.f(-c.gap, { plus: true })} ahead</span>`}</td>
        <td class="small nowrap">${c.ideas ? `${ic('lightbulb-bolt-linear')} ${c.ideas} ${c.ideas === 1 ? 'idea' : 'ideas'}` : '<span class="faint">–</span>'}</td></tr>`;
    const group = (c) => `<section class="gx-group${c.p.id === hl ? ' is-hl' : ''}" id="gx-g-${c.p.id}" aria-labelledby="gx-h-${c.p.id}">
        <div class="gx-group-head"><div><h3 class="h3" id="gx-h-${c.p.id}">${esc(c.p.name)}</h3><span class="small muted">${c.short ? `Short by ${USD.f(c.gap)}` : `${USD.f(-c.gap)} ahead of its target`}</span></div>
          <button type="button" class="link-btn" data-gx-add="${c.p.id}">${ic('add-circle-linear')}Add for ${esc(c.p.name)}</button></div>
        ${gapList(c.items, me, c.short ? `Nothing planned yet, and no ideas from ${esc(c.p.name)}.` : 'On track: nothing needed.')}
      </section>`;
    return `<div class="page gx-page" data-gx-mode="ph" data-gx-hl="${esc(hl)}">${backLink}
      <header class="page-head"><div><h1 class="display" data-split>Target Gap <em class="accent">Drill Down</em> and Initiatives<span class="dot-o">.</span></h1></div></header>
      ${gapKpis(pg.target, pg.fy, pg.gap)}
      <section class="section card" data-reveal>
        <div class="card-head"><h2 class="h3">Missing the mark</h2></div>
        <div class="table-wrap"><table class="table gx-table"><thead><tr><th>Cluster</th><th class="r">Target</th><th class="r">Year-end</th><th class="r">Gap</th><th>Ideas</th></tr></thead>
          <tbody>${cl.map(row).join('')}</tbody></table></div>
      </section>
      <section class="section card" data-reveal>
        <div class="card-head"><h2 class="h3">Initiatives to fill the gap</h2><button type="button" class="btn btn-primary btn-sm spacer" data-gx-add="practice">${ic('add-circle-linear')}Add an initiative</button></div>
        <div class="gx-groups">
          <section class="gx-group" id="gx-g-practice" aria-labelledby="gx-h-practice"><div class="gx-group-head"><div><h3 class="h3" id="gx-h-practice">Practice-wide</h3><span class="small muted">Short by ${USD.f(Math.max(0, pg.gap))} across the practice</span></div><button type="button" class="link-btn" data-gx-add="practice">${ic('add-circle-linear')}Add practice-wide</button></div>
            ${gapList(wide, me, 'Nothing practice-wide yet.')}</section>
          ${cl.map(group).join('')}
        </div>
      </section>
    </div>`;
  }
  // add or change an item: the Practice Head picks where it's for and its status; a cluster head's idea is for their cluster
  async function gapEdit(me, scope, x) {
    const ph = q.isPH(me); const cl = ph ? clusterGaps() : []; const cur = x || { scope, title: '', note: '', impact: null, status: ph ? 'Planned' : 'Idea' };
    const usd = cur.impact ? Math.round(cur.impact / RM.FX_USD) : '';
    const res = await O.modal({ icon: ph ? 'target-linear' : 'lightbulb-bolt-linear', title: x ? (ph && q.isPH(q.person(x.by) || {}) ? 'Change the initiative' : 'Change the idea') : ph ? 'Add an initiative' : 'Add an idea', sub: ph ? '' : `For ${esc(me.name)} · ${esc((q.person(PH_ID()) || { name: 'The Practice Head' }).name)} will see it`, confirm: x ? 'Save' : 'Add',
      body: `<div class="stack">
        <div class="field" id="f-gx-t"><label for="gx-t">${ph ? 'Initiative' : 'Idea'}</label><input class="input" id="gx-t" maxlength="90" value="${esc(cur.title)}" placeholder="e.g. Speed up TA for open profiles" autofocus><span class="err">${ic('danger-circle-linear')}Name it in a few words.</span></div>
        ${ph ? `<div class="field"><label for="gx-s">For</label><select class="select" id="gx-s"><option value="practice"${cur.scope === 'practice' ? ' selected' : ''}>The whole practice</option>${cl.map((c) => `<option value="${c.p.id}"${cur.scope === c.p.id ? ' selected' : ''}>${esc(c.p.name)}${c.short ? ` · short by ${esc(USD.f(c.gap))}` : ''}</option>`).join('')}</select></div>` : ''}
        <div class="field" id="f-gx-a"><label for="gx-a">Expected to add by March <span class="opt">US$, optional</span></label><input class="input num" id="gx-a" inputmode="numeric" autocomplete="off" value="${usd}" placeholder="e.g. 12000"><span class="err">${ic('danger-circle-linear')}Enter an amount in dollars, or leave it blank.</span></div>
        ${ph && cur.status !== 'Idea' ? `<div class="field"><label for="gx-st">Status</label><select class="select" id="gx-st">${GAP_STATUS.map((s) => `<option${s === cur.status ? ' selected' : ''}>${s}</option>`).join('')}</select></div>` : ''}
        <div class="field"><label for="gx-n">Note <span class="opt">optional</span></label><textarea class="textarea" id="gx-n" rows="3" maxlength="300" placeholder="What it depends on, and who's on it">${esc(cur.note || '')}</textarea></div></div>`,
      validate: (m) => {
        const t = m.querySelector('#gx-t').value.trim(); const a = m.querySelector('#gx-a').value.replace(/[$,\s]/g, ''); const okA = !a || /^\d+(\.\d+)?$/.test(a);
        m.querySelector('#f-gx-t').classList.toggle('has-error', t.length < 3); m.querySelector('#f-gx-a').classList.toggle('has-error', !okA);
        if (t.length < 3 || !okA) return false;
        const st = m.querySelector('#gx-st'); const sc = m.querySelector('#gx-s');
        return { title: t, impact: a ? Math.round(+a * RM.FX_USD) : null, note: m.querySelector('#gx-n').value.trim(), scope: sc ? sc.value : cur.scope, status: st ? st.value : cur.status };
      } });
    if (!res.ok) return false;
    const v = res.value; const at = new Date(RM.TODAY.getTime() + (store.db.audit.length % 50) * 60000).toISOString();
    if (x) Object.assign(x, v, { editedAt: at });
    else gapItems().push(Object.assign({ id: 'GI-' + Date.now().toString(36), by: me.id, at }, v));
    RM.audit(me.id, x ? (ph ? 'Changed a gap initiative' : 'Changed a gap idea') : ph ? 'Added a gap initiative' : 'Added a gap idea', `${scopeName(v.scope)} · ${v.title}`, x ? '–' : '–', v.impact ? '+' + USD.f(v.impact) : 'No amount', v.note || undefined);
    store.save(); O.toast(x ? 'Saved' : ph ? 'Initiative added' : `Idea added · ${esc((q.person(PH_ID()) || { name: 'the Practice Head' }).name)} can see it`);
    return true;
  }
  function gapMount(root, ctx) {
    const page = root.querySelector('.gx-page'); if (!page) return; const me = ctx.me;
    const find = (id) => gapItems().find((x) => x.id === id);
    const hl = page.dataset.gxHl; if (hl) { const g = root.querySelector('#gx-g-' + hl); if (g) setTimeout(() => g.scrollIntoView({ block: 'start', behavior: RM.reduced() ? 'auto' : 'smooth' }), 280); }
    page.addEventListener('click', async (e) => {
      const add = e.target.closest('[data-gx-add]'); if (add) { if (await gapEdit(me, add.dataset.gxAdd, null)) RM.app.softRender(); return; }
      const ed = e.target.closest('[data-gx-edit]'); if (ed) { const x = find(ed.dataset.gxEdit); if (x && await gapEdit(me, x.scope, x)) RM.app.softRender(); return; }
      const del = e.target.closest('[data-gx-del]');
      if (del) {
        const x = find(del.dataset.gxDel); if (!x) return;
        const res = await O.modal({ icon: 'close-circle-linear', tone: 'bad', title: `Remove “${esc(x.title)}”?`, body: '<p>It comes off the list for everyone. The audit trail keeps a record.</p>', confirm: 'Remove' });
        if (!res.ok) return;
        store.db.gapItems = gapItems().filter((y) => y !== x); RM.audit(me.id, 'Removed a gap ' + (x.status === 'Idea' ? 'idea' : 'initiative'), `${scopeName(x.scope)} · ${x.title}`, x.status, 'Removed');
        store.save(); RM.app.softRender(); O.toast('Removed'); return;
      }
      if (e.target.closest('a, button, select, input')) return;
      const go = e.target.closest('[data-gx-go]');
      if (go) { const g = root.querySelector('#gx-g-' + go.dataset.gxGo); if (g) { g.scrollIntoView({ block: 'start', behavior: RM.reduced() ? 'auto' : 'smooth' }); root.querySelectorAll('.gx-group.is-hl, .gx-row.is-hl').forEach((n) => n.classList.remove('is-hl')); g.classList.add('is-hl'); go.classList.add('is-hl'); } }
    });
    // the Practice Head moves an item along: taking up an idea plans it
    page.addEventListener('change', (e) => {
      const s = e.target.closest('[data-gx-status]'); if (!s) return; const x = find(s.dataset.gxStatus); if (!x || x.status === s.value) return;
      const was = x.status; x.status = s.value; RM.audit(me.id, was === 'Idea' ? 'Took up a gap idea' : 'Updated a gap initiative', `${scopeName(x.scope)} · ${x.title}`, was, x.status);
      store.save(); RM.app.softRender(); O.toast(was === 'Idea' ? `Idea taken up · ${esc(x.status)}` : `${esc(x.title)} · ${esc(x.status)}`);
    });
  }
  const GAP_TITLE = 'Target Gap Drill Down and Initiatives';
  const gapCrumb = (mode) => (params) => (mode === 'pm' ? { back: '#/me/finance', title: 'Team Financials', name: GAP_TITLE }
    : params.from === 'ov' ? { back: '#/ph/overview', title: 'Practice Overview', name: GAP_TITLE } : { back: '#/ph/finance', title: 'Financial Performance', name: GAP_TITLE });
  V.phGap = { title: GAP_TITLE, crumb: gapCrumb('ph'), nav: (params) => (params.from === 'ov' ? 'ph/overview' : 'ph/finance'), render: (ctx) => gapPage('ph', ctx), mount: gapMount };
  V.teamGap = { title: GAP_TITLE, crumb: gapCrumb('pm'), nav: () => 'me/finance', render: (ctx) => gapPage('pm', ctx), mount: gapMount };
  V.phFinance = {
    title: 'Financial Performance',
    morph: finMorph('ph'),
    render: (ctx) => finPage('ph', ctx),
    mount: (root, ctx) => finMount('ph', root, ctx),
  };
  // a PM's Team Financials: the same page, for their cluster only
  V.teamFinance = {
    title: 'Team Financials',
    morph: finMorph('pm'),
    render: (ctx) => finPage('pm', ctx),
    mount: (root, ctx) => finMount('pm', root, ctx),
  };

  /* ================= ADMIN ================= */
  function adminKpis() {
    const db = store.db; const act = q.active(); const arch = db.people.filter((p) => p.status !== 'Active');
    const toUpload = q.finMonths().map(upStatus).filter((u) => u.s.missing);
    // quarters follow each person's joining date: the marks due this month are the quarters ending this month
    const due = RV.completion(RV.curMonth()); const over = curRecs().filter(RV.overdue).length;
    const recent = store.db.appraisals.filter((a) => a.status === 'Generated' && (q.person(a.emp) || {}).status === 'Active' && RM.dayDiff(new Date(a.generatedAt), RM.TODAY) >= 0 && RM.dayDiff(new Date(a.generatedAt), RM.TODAY) <= 30);
    const blocked = store.db.appraisals.filter((a) => a.status === 'Not generated' && a.reason === 'blocked' && (q.person(a.emp) || {}).status === 'Active');
    const soon = q.upcomingAppraisals(act.map((p) => p.id)).filter((x) => x.a.days > 0).length;
    return `<section class="kpis">
      ${C.kpi({ label: 'Active employees', icon: 'users-group-rounded-linear', value: C.count(act.length), sub: arch.length + ' archived · kept in history' })}
      ${C.kpi({ label: `Marks due ${fmt.date(due.due, { noYear: true })}`, icon: 'lock-keyhole-minimalistic-linear', value: C.count(due.done), unit: '/ ' + due.total + ' final', sub: `Quarters ending in ${RV.monthShort(RV.curMonth())}${over ? ` · ${over} missed` : ''}`, tone: over ? 'alert' : '', href: '#/admin/reviews' })}
      ${C.kpi({ label: 'Actuals to upload', icon: 'wallet-money-linear', value: C.count(toUpload.reduce((a, u) => a + u.s.missing, 0)), sub: toUpload.map((u) => fmt.monthLabel(u.mk)).join(', ') || 'Every actual uploaded', href: '#/admin/finance' })}
      ${C.kpi({ label: 'Appraisal summaries', icon: 'cup-star-linear', value: C.count(recent.length), sub: `Created in the last 30 days${blocked.length ? ` · ${blocked.length} waiting on marks` : ''} · ${soon} due in the next ${store.db.config.appraisalLeadDays} days`, href: '#/admin/reviews?f=appr', tone: blocked.length ? 'warn' : '' })}
    </section>`;
  }
  RM.adminKpis = adminKpis;

  V.adminPeople = {
    title: 'People & Organization',
    render() {
      const db = store.db; const people = db.people.slice().sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'Active' ? -1 : 1));
      const roles = ['PM', 'PO', 'Senior BA', 'BA'];
      const pend = db.config.mappings.filter((m) => !m.confirmed).length;
      const upcoming = q.upcomingAppraisals(q.active().map((p) => p.id)).slice(0, 4);
      return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">Admin console · people &amp; organization</div>
        <h1 class="display" data-split>People &amp; <em class="accent">Organization</em><span class="dot-o">.</span></h1>
        <p class="lede">Create and edit employees, assign roles and Reporting Managers, archive. A manager change applies from the next quarterly review; open and locked reviews keep their reviewer.</p></div>
        <div class="head-actions"><button class="btn btn-secondary" data-action="import-employees">${ic('upload-minimalistic-linear')}Import employees</button><button class="btn btn-primary" data-action="add-employee">${ic('user-plus-linear')}Add employee</button></div>
      </header>
      ${adminKpis()}
      ${pend ? `<div class="section" data-reveal>${C.notice('warn', 'danger-triangle-linear', `<b>${pend} designation mappings need confirmation.</b> ${RV.mappingPending().length} people with UX and design titles aren’t in reviews until they’re confirmed, and the contractor isn’t in reviews. <a href="#/admin/config">Review mappings</a>`)}</div>` : ''}
      <section class="section card" data-reveal>
        <div class="toolbar">
          <label class="search-field"><span class="sr-only">Search people</span>${ic('magnifer-linear')}<input type="search" id="dir-q" placeholder="Search name, ID or email…" autocomplete="off"></label>
          <div class="filter-pills" role="group" aria-label="Filter by role"><button class="fpill" data-f="all" aria-pressed="true">All</button>${roles.map((r) => `<button class="fpill" data-f="${r}" aria-pressed="false">${r} <span class="n">${db.people.filter((p) => p.role === r && p.status === 'Active').length}</span></button>`).join('')}<button class="fpill" data-f="other" aria-pressed="false">Other</button><button class="fpill" data-f="archived" aria-pressed="false">Archived <span class="n">${db.people.filter((p) => p.status !== 'Active').length}</span></button></div>
          <span class="small muted" id="dir-count" style="margin-left:auto">${people.length} employees</span>
        </div>
        <div class="table-wrap"><table class="table" id="dir">
          <thead><tr><th class="sortable" data-sort="name" aria-sort="ascending">Employee ${ic('sort-vertical-linear', 'sort-ic')}</th><th class="sortable" data-sort="id">ID ${ic('sort-vertical-linear', 'sort-ic')}</th><th>Allocation</th><th class="sortable" data-sort="rm">Reporting manager ${ic('sort-vertical-linear', 'sort-ic')}</th><th>Status</th><th>Review template</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${people.map((p) => { const rm = q.person(p.rm); const inC = RV.inCycles(p) || (p.status !== 'Active' && RV.formsOf(p.id).length); const ov = db.overrides[p.id];
            return `<tr class="is-clickable ${p.status !== 'Active' ? 'is-archived' : ''}" data-edit="${p.id}" data-name="${esc(p.name.toLowerCase())}" data-id="${p.id}" data-email="${esc(p.email)}" data-role="${esc(p.role)}" data-status="${p.status}" data-rm="${esc(rm ? rm.name : '')}">
              <td>${C.person(p, esc(p.designation) + ' · ' + esc(p.role === '–' ? 'no platform role' : p.role), { link: true })}</td>
              <td class="mono muted">${p.id}</td>
              <td class="small">${esc(p.alloc)}</td>
              <td class="small">${rm ? C.who(rm) : '<span class="muted">Practice leadership</span>'}</td>
              <td><span class="badge ${p.status === 'Active' ? 'b-ok' : ''}">${p.status}</span></td>
              <td class="small">${inC ? `${esc(RM.formsLabel(p))}${ov ? ' <span class="badge b-orange" style="height:20px;font-size:11px" data-tip="' + esc(ov.reason) + '">Override</span>' : ''}` : p.mapPending && p.status === 'Active' ? '<span class="badge b-warn" style="height:20px;font-size:11px" data-tip="Their designation isn’t mapped to a role yet, so they aren’t in reviews">Mapping pending</span>' : `<span class="muted">${p.role === 'Practice Head' ? 'Not reviewed' : 'Not in reviews'}</span>`}</td>
              <td class="r"><button class="btn btn-secondary btn-sm" data-action="edit-employee" data-id="${p.id}">${p.status === 'Active' ? 'Edit' : 'View'}</button></td></tr>`; }).join('')}
            <tr class="dir-empty" hidden><td colspan="7">${C.empty('magnifer-linear', 'No one matches', 'Try a different name, ID or filter. Archived employees live under “Archived”.')}</td></tr>
          </tbody></table></div>
      </section>
      <section class="section grid g-3">
        <div class="card" data-reveal><div class="card-head"><h2 class="h3">Financial uploads</h2><a class="spacer link-btn" href="#/admin/finance">Manage</a></div>
          <div>${q.finMonths().slice(-2).reverse().map(upStatus).map((u) => `<div class="period ${u.cls}" style="padding:14px 22px"><div class="p-ic">${ic(u.s.missing ? 'upload-minimalistic-linear' : 'check-circle-linear')}</div><div><div class="strong">${fmt.monthLabel(u.mk)}</div><div class="small muted">${u.s.missing ? `${u.s.uploaded} of ${u.s.billable} actuals uploaded` : 'Every billable actual uploaded'}</div></div><span class="p-actions">${upBadge(u)}</span></div>`).join('')}</div></div>
        <div class="card" data-reveal><div class="card-head"><h2 class="h3">Upcoming appraisals</h2><a class="spacer link-btn" href="#/admin/appraisals">All</a></div>
          <div class="list">${upcoming.map(({ p, a }) => `<div class="list-item" style="padding:11px 22px">${C.avatar(p, 'sm')}<span style="min-width:0"><span class="person-name" style="display:block">${esc(p.name)}</span><span class="person-sub">${fmt.date(a.anniv, { noYear: true })} · cycle ${a.cycle}</span></span><span class="meta">${C.appr(a.status)}</span></div>`).join('') || '<p class="small muted" style="padding:6px 22px 20px">None in the next 30 days.</p>'}</div></div>
        <div class="card" data-reveal><div class="card-head"><h2 class="h3">Audit Trail · latest</h2><a class="spacer link-btn" href="#/admin/audit">All</a></div>
          <div class="list">${db.audit.slice(0, 4).map((a) => `<div class="list-item" style="padding:11px 22px;align-items:flex-start"><span style="min-width:0"><span class="strong small" style="display:block">${esc(RM.plain(a.action))}</span><span class="person-sub" style="white-space:normal">${RM.auditEntity(a.entity)}</span></span><span class="meta tiny">${fmt.rel(a.at)}</span></div>`).join('')}</div></div>
      </section></div>`;
    },
    mount(root) {
      const tb = root.querySelector('#dir tbody'); const inp = root.querySelector('#dir-q'); let f = 'all';
      const apply = () => {
        const s = inp.value.trim().toLowerCase(); let n = 0;
        RM.$$('tr[data-edit]', tb).forEach((tr) => {
          const d = tr.dataset; const active = d.status === 'Active';
          const roleOk = f === 'all' ? true : f === 'archived' ? !active : f === 'other' ? active && !['PM', 'PO', 'Senior BA', 'BA'].includes(d.role) : active && d.role === f;
          const qOk = !s || d.name.includes(s) || d.id.toLowerCase().includes(s) || d.email.includes(s);
          const show = roleOk && qOk; tr.hidden = !show; if (show) n++;
        });
        tb.querySelector('.dir-empty').hidden = n > 0; root.querySelector('#dir-count').textContent = n + (n === 1 ? ' employee' : ' employees');
      };
      inp.addEventListener('input', apply);
      root.querySelector('.filter-pills').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; f = b.dataset.f; RM.$$('[data-f]', root).forEach((x) => x.setAttribute('aria-pressed', x === b)); apply(); });
      root.querySelector('#dir thead').addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort]'); if (!th) return; const k = th.dataset.sort; const dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
        RM.$$('th[data-sort]', root).forEach((x) => x.removeAttribute('aria-sort')); th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
        const rows = RM.$$('tr[data-edit]', tb); rows.sort((a, b) => (a.dataset[k] || '').localeCompare(b.dataset[k] || '') * dir); rows.forEach((r) => tb.insertBefore(r, tb.querySelector('.dir-empty')));
      });
      tb.addEventListener('click', (e) => { if (e.target.closest('button,a')) return; const tr = e.target.closest('tr[data-edit]'); if (tr) RM.app.editEmployee(tr.dataset.edit); });
    },
  };

  V.adminConfig = {
    title: 'Review setup',
    render() {
      const db = store.db; const cur = RV.curMonth(); const due = RV.completion(cur);
      const flow = ['Someone joins', 'Monthly reviews and evidence', 'Marks open in the quarter’s last month', 'Self marks', 'Manager marks make them final by its last day', 'Appraisal summary on the anniversary'];
      const inC = q.active().filter((p) => RV.inCycles(p)); const pend = RV.mappingPending();
      // quarters follow each person's joining date: whose quarter's last month is next month (their marks open on its 1st)
      const nextMk = RV.addMonths(cur, 1); const ending = inC.filter((p) => RV.quarterFor(p, nextMk).months[2] === nextMk && String(p.joined).slice(0, 7) <= nextMk);
      const tmplName = (k) => RV.templateName(k);
      const using = (k) => inC.filter((p) => { const f = RV.curForm(p.id); return f && RV.templateAt(f, RV.curMonth()) === k; }).length;
      const rule = (icon, t, d) => `<div class="list-item" style="align-items:flex-start"><span class="notif-ic">${ic(icon)}</span><span style="min-width:0;flex:1"><span class="strong" style="display:block">${t}</span><span class="person-sub" style="white-space:normal">${d}</span></span></div>`;
      const sheetRow = (s) => `<details class="list-item tmpl" style="display:block"><summary class="hstack" style="cursor:pointer;list-style:none;gap:12px"><span class="strong">${esc(s.name)}</span><span class="badge b-outline no-dot" style="height:20px;font-size:11px">Version ${s.version}</span><span class="small muted" style="margin-left:auto;white-space:nowrap">${s.goals.length} goals · ${using(s.key)} in use</span>${ic('alt-arrow-down-linear')}</summary>
        <div class="small" style="margin:12px 0 4px;color:var(--ink-2)">${s.categories.map((c) => `<div style="margin:10px 0 4px"><b>${esc(c.name)}</b> <span class="muted">· weight ${c.weight}</span></div><ol style="padding-left:18px;margin:0" start="${c.goals[0].n}">${c.goals.map((g) => `<li style="margin:3px 0">${esc(g.detail)} <span class="muted">· out of ${g.weight}${g.form && g.form.special ? ' · built from other records' : ''}</span></li>`).join('')}</ol>`).join('')}
        <p class="muted" style="margin-top:10px">Weights total ${s.total}. ${s.versions.map((v) => `Version ${v.version} · ${fmt.date(v.at)} · ${esc(v.note)}`).join('<br>')}</p></div></details>`;
      return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">Admin console · review setup</div>
        <h1 class="display" data-split>Set it up once. <em class="accent">The rest</em> runs itself<span class="dot-o">.</span></h1>
        <p class="lede">Pick a template for each role. From then on, monthly reviews open each month, marks open in the last month of each person’s quarter and are due on its last day (quarters follow their joining date), with their manager giving the manager marks, and appraisal summaries are made on each joining anniversary. Nobody sets up a review by hand.</p></div></header>
      <section class="band" data-reveal style="padding:26px 28px">
        <div class="eyebrow" style="margin-bottom:14px">How a year runs</div>
        <div class="steps-inline" style="gap:8px">${flow.map((x, i) => `<span style="background:rgba(255,255,255,${i === 0 ? .95 : .12});color:${i === 0 ? 'var(--blue-900)' : '#fff'}">${String(i + 1).padStart(2, '0')} ${x}</span>`).join(`<span style="background:none;padding:0;color:var(--gold)">→</span>`)}</div>
        <div class="grid g-2" style="margin-top:22px;gap:14px">
          <div class="card card-pad" style="color:var(--ink)"><div class="hstack" style="justify-content:space-between"><span class="small muted">Marks open now</span><span class="badge b-info no-dot">Open</span></div><div class="h2" style="margin-top:6px">Due ${fmt.date(due.due)}</div><div class="small muted" style="margin-top:4px">Quarters ending in ${esc(RV.monthLabel(cur))} · ${due.total} ${due.total === 1 ? 'person' : 'people'} · ${due.done} final so far</div></div>
          <div class="card card-pad" style="color:var(--ink)"><div class="hstack" style="justify-content:space-between"><span class="small muted">Opening next month</span><span class="badge b-outline no-dot">Scheduled</span></div><div class="h2" style="margin-top:6px">${ending.length} ${ending.length === 1 ? 'quarter' : 'quarters'}</div><div class="small muted" style="margin-top:4px">Marks open ${fmt.date(new Date(RV.monthEnd(cur).getTime() + 864e5), { noYear: true })} · due ${fmt.date(RV.monthEnd(nextMk), { noYear: true })} · ${inC.length} people in reviews, each on their own quarters</div></div>
        </div>
      </section>
      <section class="section grid g-2" style="align-items:start">
        <div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">How reviews work</h2></div>
          <div class="list">
            ${rule('chat-round-line-linear', 'Every month: a monthly review', `The employee adds their progress and evidence under each goal; their manager adds feedback after they meet. Both are due by the end of the month; anything not done is marked missed. Reviews here started in ${esc(RV.monthLabel(RV.GO_LIVE))}, or in the month someone joins.`)}
            ${rule('calendar-linear', 'Quarters follow the joining date', 'Each person’s review year starts in the month they join. Its quarters are that month and the next two, then every three months: someone who joined on 22 Sep has Q1 Sep–Nov, Q2 Dec–Feb, Q3 Mar–May and Q4 Jun–Aug, and their appraisal on 22 Sep. The joining quarter always counts as a full quarter. Someone already here when reviews started keeps the quarters of their joining date.')}
            ${rule('clipboard-check-linear', 'Every quarter: marks, due on its last day', 'Marks open on the 1st of the quarter’s last month. The employee marks each goal out of its maximum and sends the marks to their manager (their manager when the marks opened). The manager can ask for changes; their marks make the quarter final. Not final by the quarter’s last day (Jun–Aug: open 1 Aug, due 31 Aug): missed.')}
            ${rule('cup-star-linear', 'Every year: an appraisal on the joining anniversary', 'The year’s four quarters end the month before the anniversary month, and the appraisal summary is made from them: on the anniversary if they’re all final, otherwise as soon as the last one is (Q4’s marks are due on its last day, before the anniversary). A quarter whose marks were missed holds the summary until they’re final; it’s never skipped or moved to another year. The year’s monthly reviews and evidence close with the year and are filed with the summary; the next year starts on the 1st of the anniversary month. In the year reviews started here, three quarters still make a summary; fewer don’t. The self and manager averages are kept side by side.')}
            ${rule('pen-2-linear', 'Only Admin corrects final marks', 'A correction is recorded in the audit trail and makes a new version of any appraisal summary that used those marks.')}
          </div>
        </div>
        <div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">Default template by role</h2><span class="spacer small muted">Designation → role → template</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Role</th><th>Template</th><th class="r">People</th></tr></thead>
          <tbody>${[['BA', 'BA-SBA'], ['Senior BA', 'BA-SBA'], ['PM', 'PM']].map(([role, k]) => `<tr><td class="strong">${role}</td><td class="small">${esc(tmplName(k))}</td><td class="r num">${inC.filter((p) => p.role === role && !db.overrides[p.id]).length}</td></tr>`).join('')}
            <tr><td class="strong">PO</td><td class="small">${esc(tmplName('PO'))}<div class="tiny muted">With direct reportees: ${esc(tmplName('PO-R'))}. A PO who gains a first reportee gets the reportee fields from the start of their next quarter.</div></td><td class="r num">${inC.filter((p) => p.role === 'PO' && !db.overrides[p.id]).length}</td></tr>
            <tr><td class="strong">Practice Head</td><td class="small muted">Not reviewed; gives the manager marks for their direct reportees</td><td class="r num">${q.active().filter((p) => p.role === 'Practice Head').length}</td></tr>
            <tr><td class="strong">Mapping pending</td><td class="small muted">Not in reviews until their designation is mapped to a role</td><td class="r num">${pend.length}</td></tr></tbody></table></div>
        </div>
      </section>
      <section class="section card" data-reveal>
        <div class="card-head"><h2 class="h3">Individual overrides</h2><span class="small muted">A different template for one person. Their role, manager and financial access don’t change</span><button class="btn btn-secondary btn-sm spacer" data-action="add-override">${ic('add-circle-linear')}Add override</button></div>
        ${Object.keys(db.overrides).length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Employee</th><th>Role</th><th>Default</th><th>Override</th><th>Reason</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${Object.entries(db.overrides).map(([id, o]) => { const p = q.person(id); return `<tr><td>${C.person(p, esc(p.designation), { size: 'sm', link: true })}</td><td>${esc(p.role)}</td><td class="small muted">${esc(tmplName(RV.defaultTemplate(p)))}</td><td class="small"><span class="badge b-orange no-dot">${esc(tmplName(o.template))}</span></td><td class="small" style="max-width:280px">${esc(o.reason)}</td><td class="r"><button class="btn btn-ghost btn-sm" data-action="remove-override" data-id="${id}">Remove</button></td></tr>`; }).join('')}</tbody></table></div>` : C.empty('tuning-2-linear', 'No overrides', 'Everyone fills in the default template for their role.')}
        <div class="card-foot">${ic('info-circle-linear')} An override applies from the start of the person’s next quarter (quarters follow their joining date); earlier months and marks keep their template. A later role change doesn’t clear it.</div>
      </section>
      <section class="section grid g-2" style="align-items:start">
        <div class="card" data-reveal>
          <div class="card-head"><h2 class="h3">Templates</h2><span class="spacer small muted">From the Quarterly Goal Review decks · read-only</span></div>
          <div class="list">${Object.values(RV.TEMPLATES).map(sheetRow).join('')}
            ${RM.PENDING_TEMPLATES.map((t) => `<div class="list-item"><span style="min-width:0;flex:1"><span class="strong" style="display:block">${esc(t.name)} template</span><span class="person-sub" style="white-space:normal">${esc(t.note)}</span></span><span class="badge b-warn no-dot">Pending confirmation</span></div>`).join('')}</div>
          <div class="card-foot small muted">${ic('info-circle-linear')} Editing a template makes a new version; everything already recorded keeps the version it used. No goal is yearly today, so every quarter is out of 100.</div>
        </div>
        <div class="stack">
        <div class="card" data-reveal id="mappings">
          <div class="card-head"><h2 class="h3">Designation → platform role</h2><span class="spacer small muted">Each org-chart title mapped to a role</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Designation</th><th>Role</th><th><span class="sr-only">Status</span></th></tr></thead><tbody>${db.config.mappings.map((m, i) => `<tr><td>${esc(m.designation)}${m.note ? `<div class="tiny muted">${esc(m.note)}</div>` : ''}</td><td class="strong">${esc(m.role)}</td><td class="r">${m.confirmed ? '<span class="badge b-ok">Confirmed</span>' : `<button class="btn btn-secondary btn-sm" data-action="confirm-map" data-i="${i}">Confirm</button>`}</td></tr>`).join('')}</tbody></table></div>
        </div>
        <div class="card" data-reveal><div class="card-head"><h2 class="h3">Mapping pending</h2><span class="spacer small muted">Not in reviews until their title is mapped</span></div>
          ${pend.length ? `<div class="list">${pend.map((p) => `<div class="list-item">${C.person(p, esc(p.designation) + ' · provisionally ' + esc(p.role), { size: 'sm', link: true })}<span class="meta"><span class="badge b-warn no-dot">Not in reviews</span></span></div>`).join('')}</div><div class="card-foot small muted">${ic('info-circle-linear')} Confirming a mapping starts their monthly reviews that month.</div>` : `<div class="card-body">${C.empty('check-circle-linear', 'Nobody waiting', 'Every designation in use is mapped.')}</div>`}</div>
        </div>
      </section></div>`;
    },
  };

  // a month's uploads across active people: billable people with no actual yet are what's left to upload. There are no locks.
  function upStatus(mk) {
    const s = q.finSum(q.active().map((p) => p.id), mk); const rows = s.billable + s.nonBillable;
    const k = !rows ? 'Nothing uploaded' : s.missing ? 'Actuals to upload' : 'All uploaded';
    return { mk, s, rows, k, cls: !rows ? '' : s.missing ? 'is-open' : 'is-done', badge: !rows ? '' : s.missing ? 'b-warn' : 'b-ok', label: !rows ? 'Nothing uploaded' : s.missing ? s.missing + ' to upload' : 'All uploaded',
      sub: !rows ? 'No figures for anyone yet' : s.missing ? `${s.uploaded} of ${s.billable} billable actuals uploaded · forecasts count for the rest` : `Every billable actual uploaded · ${s.billable} billable, ${s.nonBillable} non-billable` };
  }
  const upBadge = (u) => `<span class="badge ${u.badge}" data-tag-key="period:${u.k}">${u.label}</span>`;
  RM.upStatus = upStatus; RM.upBadge = upBadge;
  // leads with a yearly revenue target: the people the employee sheet gives a financial target (never the practice)
  const targetLeads = () => q.active().filter((p) => p.finTarget === true && p.id !== PH_ID());

  V.adminFinance = {
    title: 'Financial Updates',
    render({ params }) {
      const db = store.db; const keys = RM.FIN_MONTHS.slice().reverse(); const ups = keys.map(upStatus);
      // the month on the table: the one asked for, else the latest with actuals still to upload, else the latest with figures
      const edit = params.p && keys.includes(params.p) ? params.p : (ups.find((u) => u.s.missing) || ups.find((u) => u.rows) || ups[0]).mk;
      const people = q.active(); const s = q.finSum(people.map((p) => p.id), edit);
      // a month nobody has figures for yet starts from each person's latest billability
      const lastRow = (p) => { const f = db.fin[p.id] || {}; const k = Object.keys(f).filter((x) => x < edit).sort().pop(); return k ? f[k] : null; };
      const fillBtn = `<button class="btn btn-secondary btn-sm" data-action="import-fin">${ic('upload-minimalistic-linear')}Fill from CSV</button>`;
      const L = (v) => (v == null ? '' : (v / 1e5).toFixed(2));
      const leads = targetLeads();
      return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">Admin console · financial updates ${C.sample('Sample financials')}</div>
        <h1 class="display" data-split>Financial <em class="accent">Updates</em><span class="dot-o">.</span></h1>
        <p class="lede">Upload each month’s billability, forecast and actual for every person, from a CSV or by editing the table. An actual can’t be more than its forecast. Saved figures show in the dashboards straight away, and a person’s forecast counts until their actual is uploaded. There are no locks: any month can be changed, and every change is audited.</p></div>
        <div class="head-actions"><button class="btn btn-secondary" data-action="import-employees">${ic('upload-minimalistic-linear')}Import employees</button><button class="btn btn-secondary" data-action="add-employee">${ic('user-plus-linear')}Add employee</button></div></header>
      <section class="card" data-reveal>
        ${ups.map((u) => `<div class="period ${u.cls}${u.mk === edit ? ' is-current' : ''}" ${u.mk === edit ? 'aria-current="true"' : ''}>
          <div class="p-ic">${ic(!u.rows ? 'calendar-linear' : u.s.missing ? 'upload-minimalistic-linear' : 'check-circle-linear')}</div>
          <div style="min-width:0"><div class="strong">${fmt.monthLabel(u.mk)}</div><div class="small muted">${u.sub}</div></div>
          <div class="p-actions">${u.rows ? upBadge(u) : ''}${u.mk === edit ? `<span class="small muted">On the table below</span>` : `<a class="btn btn-secondary btn-sm" href="#/admin/finance?p=${u.mk}">${u.rows ? 'Edit' : 'Upload'}</a>`}</div></div>`).join('')}
      </section>
      <section class="section card" data-reveal id="fin-editor" data-key="${edit}">
        <div class="card-head"><h2 class="h3">${fmt.monthLabel(edit)}</h2><span class="small muted">${s.billable} billable · ${s.nonBillable} non-billable · <span id="fin-missing" class="${s.missing ? 'due-soon' : ''}">${s.missing} actuals to upload</span></span><span class="spacer">${fillBtn}</span></div>
        <div class="table-wrap"><table class="table" id="fin-table"><thead><tr><th>Employee</th><th>Billability</th><th class="r">Forecast (₹ L)</th><th class="r">Actual (₹ L)</th><th class="r">Actual − forecast</th></tr></thead>
        <tbody>${people.map((p) => { const own = (db.fin[p.id] || {})[edit]; const prev = own ? null : lastRow(p); const f = own || { billable: prev ? prev.billable : !['Internal', '–'].includes(p.alloc), forecast: null, actual: null }; return `<tr data-emp="${p.id}">
          <td>${C.person(p, esc(p.alloc), { size: 'sm', link: true })}</td>
          <td><select class="select" style="height:36px;width:150px;font-size:13.5px" data-k="billable" aria-label="Billability for ${esc(p.name)}"><option value="1" ${f.billable ? 'selected' : ''}>Billable</option><option value="0" ${!f.billable ? 'selected' : ''}>Non-billable</option></select></td>
          ${['forecast', 'actual'].map((k) => `<td class="r"><input class="input money-input" data-k="${k}" inputmode="decimal" value="${L(f[k])}" placeholder="${k === 'actual' && f.billable ? 'Upload' : '0.00'}" aria-label="${k} for ${esc(p.name)} in lakhs"></td>`).join('')}
          <td class="r num" data-var>${f.actual != null && f.billable ? fmt.inr(f.actual - f.forecast, { plus: true }) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="card-foot" style="gap:10px;flex-wrap:wrap"><span id="fin-dirty">No unsaved changes</span><span style="margin-left:auto"></span>
          <button class="btn btn-primary btn-sm" data-action="save-fin">Save changes</button></div>
      </section>
      <section class="section card" data-reveal id="fin-targets">
        <div class="card-head"><div><h2 class="h3">Targets · ${RM.FY.label}</h2><p class="small muted" style="margin-top:3px">One revenue target a year for each lead the employee sheet gives a financial target. Team revenue is the lead and everyone below them; the practice has no target.</p></div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Lead</th><th class="r">People</th><th class="r">Team revenue</th><th class="r">Target (₹ L)</th><th class="r">Revenue vs target</th></tr></thead>
        <tbody>${leads.map((p) => { const ids = unitIds(p.id); const fy = fyRollup(ids); const t = db.targets[p.id]; return `<tr>
          <td>${C.person(p, esc(p.designation), { size: 'sm', link: true })}</td><td class="r num">${ids.length}</td><td class="r num">${fmt.inr(fy.revenue)}</td>
          <td class="r"><input class="input money-input" data-target="${p.id}" inputmode="decimal" value="${t == null ? '' : (t / 1e5).toFixed(2)}" placeholder="No target" aria-label="${RM.FY.label} target for ${esc(p.name)} in lakhs"></td>
          <td class="r num cell-var ${t != null ? fmt.varCls(fy.revenue - t) : ''}">${t != null ? fmt.inr(fy.revenue - t, { plus: true }) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="card-foot" style="gap:10px;flex-wrap:wrap"><span class="small muted">Team revenue: each person’s actual once uploaded, else their forecast, for ${RM.FY.span}.</span><span style="margin-left:auto"></span><button class="btn btn-primary btn-sm" data-action="save-targets">Save targets</button></div>
      </section></div>`;
    },
    mount(root) {
      const ed = root.querySelector('#fin-editor'); if (!ed) return;
      const key = ed.dataset.key; const dirty = new Map();
      const upd = () => {
        const n = dirty.size; const f = ed.querySelectorAll('.is-imported').length; // cells filled from a CSV stay marked until saved or edited by hand
        root.querySelector('#fin-dirty').innerHTML = (n ? `<b style="color:var(--ink)">${n} unsaved change${n > 1 ? 's' : ''}</b>` : 'No unsaved changes') + (f ? `<span class="imp-key">${f} filled from CSV</span>` : '');
      };
      ed.addEventListener('input', (e) => {
        const el = e.target.closest('[data-k]'); if (!el) return; const tr = el.closest('tr'); const id = tr.dataset.emp;
        if (!ed._filling) [el, el.parentElement.querySelector('.xsel-btn')].forEach((x) => x && x.classList.remove('is-imported'));
        dirty.set(id + '|' + el.dataset.k, el.value); upd();
        const get = (k) => { const v = tr.querySelector(`[data-k="${k}"]`).value; return k === 'billable' ? v === '1' : v === '' ? null : Math.round(parseFloat(v) * 1e5); };
        const a = get('actual'), fc = get('forecast'), b = get('billable'); const cell = tr.querySelector('[data-var]');
        if (b && a != null && fc != null && !isNaN(a) && !isNaN(fc)) { cell.textContent = fmt.inr(a - fc, { plus: true }); } else { cell.textContent = '–'; }
        el.style.boxShadow = '';
        overFlag(tr);
      });
      // an actual can't be more than its forecast: the actual is outlined while it is
      const OVER = 'inset 0 0 0 1px var(--bad), 0 0 0 4px var(--bad-bg)';
      const amt = (tr, k) => { const v = tr.querySelector(`[data-k="${k}"]`).value.trim(); return v === '' ? null : parseFloat(v); };
      const isOver = (tr) => { const a = amt(tr, 'actual'), fc = amt(tr, 'forecast'); return a != null && fc != null && !isNaN(a) && !isNaN(fc) && Math.round(a * 1e5) > Math.round(fc * 1e5); };
      function overFlag(tr) {
        const inp = tr.querySelector('[data-k="actual"]'); const over = isOver(tr);
        if (over) { inp.style.boxShadow = OVER; inp.setAttribute('aria-invalid', 'true'); inp.title = 'An actual can’t be more than the forecast'; }
        else if (inp.getAttribute('aria-invalid')) { inp.style.boxShadow = ''; inp.removeAttribute('aria-invalid'); inp.removeAttribute('title'); }
      }
      ed._commit = () => {
        const db = store.db; let changes = 0; let bad = false;
        // nothing saves while a changed row has an actual above its forecast
        const over = [...new Set([...dirty.keys()].map((k) => k.split('|')[0]))].map((id) => ed.querySelector(`tr[data-emp="${id}"]`)).filter((tr) => tr && isOver(tr));
        if (over.length) { over.forEach(overFlag); over[0].querySelector('[data-k="actual"]').focus(); RM.overlay.toast(`An actual can’t be more than its forecast. Fix the ${over.length === 1 ? 'highlighted cell' : over.length + ' highlighted cells'}.`, { tone: 'warn' }); return -1; }
        dirty.forEach((val, k) => {
          // a person's first figures for the month start from the billability shown on their row
          const [id, field] = k.split('|'); const fin = db.fin[id] || (db.fin[id] = {});
          const row = fin[key] || (fin[key] = { billable: ed.querySelector(`tr[data-emp="${id}"] [data-k="billable"]`).value === '1', forecast: 0, actual: null });
          let nv; if (field === 'billable') nv = val === '1'; else { if (val.trim() === '') nv = null; else { nv = Math.round(parseFloat(val) * 1e5); if (isNaN(nv) || nv < 0) { bad = true; const inp = ed.querySelector(`tr[data-emp="${id}"] [data-k="${field}"]`); inp.style.boxShadow = 'inset 0 0 0 1px var(--bad), 0 0 0 4px #FBE0DD'; return; } } }
          const prev = row[field]; if (prev === nv) return;
          row[field] = nv; changes++;
          audit('ADM-0001', 'Updated ' + field, fmt.monthLabel(key) + ' · ' + q.person(id).name, field === 'billable' ? (prev ? 'Billable' : 'Non-billable') : fmt.inr(prev), field === 'billable' ? (nv ? 'Billable' : 'Non-billable') : fmt.inr(nv));
        });
        if (bad) { RM.overlay.toast('Some values aren’t valid amounts. Fix the highlighted cells.', { tone: 'warn' }); return -1; }
        dirty.clear(); return changes;
      };
      ed._dirty = () => dirty.size;
      ed._sync = upd;
      ed._snap = () => new Map(dirty);
      // put back only the given cells' unsaved state, so edits made elsewhere since the snapshot still save
      ed._restore = (snap, keys) => { keys.forEach((k) => (snap.has(k) ? dirty.set(k, snap.get(k)) : dirty.delete(k))); upd(); };
      RM.finEditor = ed;
    },
  };

  // an audit event's category, by its action: figures first, then settings (templates, mappings, notifications), then the
  // review records (forms, monthly reviews, goal sheets, reports); everything else is about people
  const AUDIT_RULES = [['Financial', /financial|actual|target|forecast|billab/i], ['Configuration', /override|cadence|mapping|config|lead time|notification|reminder/i], ['Reviews', /review|goal sheet|self-mark|monthly review|appraisal|cycle/i]];
  const auditCat = (a) => (AUDIT_RULES.find(([, re]) => re.test(a.action)) || ['People'])[0];
  RM.auditCat = auditCat;
  const AUDIT_CATS = ['All', 'People', 'Reviews', 'Financial', 'Configuration'];
  const auditList = (f) => (f === 'All' ? store.db.audit : store.db.audit.filter((a) => auditCat(a) === f));
  const auditRows = (list) => list.length ? list.map((a) => { const u = a.by === 'system' ? null : q.person(a.by); return `<tr><td>${u ? C.person(u, esc(u.designation), { size: 'sm', link: true }) : `<span class="person"><span class="av av-sm av-system" style="background:var(--slate)">${ic('settings-bold')}</span><span class="person-name">System</span></span>`}</td>
          <td><span class="strong">${esc(RM.plain(a.action))}</span>${a.note ? `<div class="tiny muted" style="max-width:280px">${esc(RM.plain(a.note))}</div>` : ''}</td><td class="small">${RM.auditEntity(a.entity)}</td>
          <td class="small num"><span class="muted">${a.prev ? RM.auditEntity(a.prev) : '–'}</span> <span class="faint">→</span> <b>${a.next ? RM.auditEntity(a.next) : '–'}</b></td><td class="small muted num" style="white-space:nowrap">${fmt.rel(a.at)}</td></tr>`; }).join('') : `<tr><td colspan="5">${C.empty('history-linear', 'No events in this category', 'Changes of this kind will appear here as soon as they happen.')}</td></tr>`;
  V.adminAudit = {
    title: 'Audit Trail',
    mount(root) {
      RM.bindFilters(root, { group: '.toolbar .filter-pills', target: '#audit-rows', render: (f) => auditRows(auditList(f)), url: (f) => '#/admin/audit?f=' + f, after: (f) => { root.querySelector('#audit-count').textContent = auditList(f).length + ' events'; } });
    },
    render({ params }) {
      const cats = AUDIT_CATS; const f = cats.includes(params.f) ? params.f : 'All'; const all = store.db.audit; const list = auditList(f);
      return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">Admin console · audit trail</div>
        <h1 class="display" data-split>Nothing changes <em class="accent">silently</em><span class="dot-o">.</span></h1>
        <p class="lede">Every material change (people, managers, archival, assignment, submissions, financial updates, locks and overrides) with who, what, when, and the before and after.</p></div>
        <div class="head-actions"><button class="btn btn-secondary" data-action="export-audit">${ic('download-minimalistic-linear')}Export CSV</button></div></header>
      <section class="card" data-reveal>
        <div class="toolbar">${C.filterPills(cats.map((c) => [c, c, c === 'All' ? all.length : all.filter((a) => auditCat(a) === c).length]), f, 'Filter audit events')}<span class="small muted" id="audit-count" style="margin-left:auto">${list.length} events</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Action</th><th>Entity</th><th>Previous → new</th><th>Timestamp</th></tr></thead>
        <tbody id="audit-rows">${auditRows(list)}</tbody></table></div>
      </section></div>`;
    },
  };

  V.adminSettings = {
    title: 'Settings',
    render() {
      const c = store.db.config; c.notif = c.notif || {};
      // §5.20: in-app notifications by event and audience; each one can be muted. Email is out of v1.
      const EVENTS = [['generated', 'Marks open', 'Employee'], ['due', 'Marks or monthly review due', 'Employee, Manager'], ['submitted', 'Employee sent their marks', 'Manager'], ['changes', 'Changes asked for', 'Employee'], ['completed', 'Marks final', 'Employee'], ['incomplete', 'Missed by the due date', 'Employee, Manager, Admin'], ['appraisal', 'Upcoming appraisal', 'Manager, Admin']];
      const AUD = [['emp', 'Employee'], ['mgr', 'Manager'], ['admin', 'Admin']];
      const sw = (k, label) => `<input type="checkbox" class="switch" data-n="${k}" data-label="${esc(label)}" ${c.notif[k] !== false ? 'checked' : ''} aria-label="${esc(label)}">`;
      const EXTRA = [['reassigned.mgr', 'Manager', 'Someone’s marks moved to you'], ['report.admin', 'Admin', 'Appraisal summary created or waiting on marks'], ['fin.admin', 'Admin', 'Financial actuals to upload'], ['mapping.admin', 'Admin', 'People waiting on a role mapping']];
      return `<div class="page">
      <header class="page-head"><div><div class="eyebrow">Admin console · settings</div><h1 class="display" data-split>Settings<span class="dot-o">.</span></h1><p class="lede">Notification lead times, reminder cadence and templates. Sign-in providers are managed by IT.</p></div></header>
      <section class="grid g-2">
        <form class="card" data-reveal id="set-form"><div class="card-head"><h2 class="h3">Timing</h2></div><div class="card-body stack">
          <div class="field"><label for="lead">Upcoming appraisal lead time</label><div class="hstack"><input class="input num" id="lead" type="number" min="7" max="120" value="${c.appraisalLeadDays}" style="width:110px"><span class="small muted">days before the anniversary</span></div></div>
          <div class="field"><label for="remind">Reminder frequency</label><select class="select" id="remind"><option value="1" ${c.reminderEvery === 1 ? 'selected' : ''}>Daily while overdue</option><option value="3" ${c.reminderEvery === 3 ? 'selected' : ''}>Every 3 days</option><option value="7" ${c.reminderEvery === 7 ? 'selected' : ''}>Weekly</option></select><span class="small muted">A due or missed notification someone has read comes back after this long, for as long as it’s still outstanding.</span></div>
        </div><div class="card-foot"><button class="btn btn-primary btn-sm" style="margin-left:auto" type="submit">Save</button></div></form>
        <div class="card" data-reveal><div class="card-head"><h2 class="h3">Notifications</h2><span class="spacer small muted">In-app</span></div>
          <div class="table-wrap"><table class="table notif-matrix"><thead><tr><th>Event</th>${AUD.map(([, l]) => `<th class="c">${l}</th>`).join('')}</tr></thead>
          <tbody>${EVENTS.map(([k, label, who]) => `<tr><td class="small strong">${label}</td>${AUD.map(([a, l]) => `<td class="c">${who.includes(l) ? sw(k + '.' + a, label + ' · ' + l) : '<span class="faint">–</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
          <div class="list">${EXTRA.map(([k, who, label]) => `<label class="list-item" style="cursor:pointer"><span style="min-width:0"><span class="strong small" style="display:block">${label}</span><span class="person-sub">${who} · also in-app</span></span><span style="margin-left:auto">${sw(k, label)}</span></label>`).join('')}</div>
          <div class="card-foot small muted">${ic('info-circle-linear')} In-app only at go-live; email comes later, from a company no-reply address (an assumption awaiting sign-off). Reminders come back on the frequency set under Timing.</div></div>
      </section>
      <section class="section card" data-reveal>
        <div class="card-head"><h2 class="h3">Financial access</h2><span class="spacer small muted">Set by platform role, not by hierarchy or review ownership</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Role</th><th>Access</th><th>Sees</th><th class="r">People</th></tr></thead><tbody>
          ${[['Admin', true, 'Every employee, every month, plus the uploads and targets'], ['Practice Head', true, 'The whole practice, drillable by team and person'], ['PM', true, 'Their own figures and their direct and indirect reportees'], ['PO', false, 'No financial figures, including their own'], ['Senior BA', false, 'No financial figures, including their own'], ['BA', false, 'No financial figures, including their own']].map(([r, ok, s]) => `<tr><td class="strong">${r}</td><td><span class="badge ${ok ? 'b-ok' : ''}">${ok ? 'Has access' : 'No access'}</span></td><td class="small">${s}</td><td class="r num">${r === 'Admin' ? 1 : q.active().filter((p) => p.role === r).length}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section class="section grid g-2">
        <div class="card card-pad" data-reveal><h2 class="h3">Sign-in</h2><p class="small muted" style="margin:6px 0 14px">SSO/SAML and Google Workspace are shown on the login screen but aren’t connected in this prototype.</p><div class="hstack"><span class="badge">SSO / SAML · not connected</span><span class="badge">Google Workspace · not connected</span></div></div>
        <div class="card card-pad" data-reveal><h2 class="h3">Prototype data</h2><p class="small muted" style="margin:6px 0 14px">Reset every review, financial figure and audit event you changed back to the seeded sample state.</p><button class="btn btn-danger" data-action="reset-demo">${ic('restart-linear')}Reset demo data</button></div>
      </section></div>`;
    },
    mount(root) {
      const c = store.db.config;
      root.querySelector('#set-form').addEventListener('submit', (e) => { e.preventDefault(); const lead = +root.querySelector('#lead').value; if (lead < 7 || lead > 120) { RM.overlay.toast('Lead time must be 7–120 days.', { tone: 'warn' }); return; } const by = (q.me() || {}).id || 'ADM-0001'; const prev = c.appraisalLeadDays; const prevR = c.reminderEvery; c.appraisalLeadDays = lead; c.reminderEvery = +root.querySelector('#remind').value;
        const every = (n) => ({ 1: 'Daily while overdue', 3: 'Every 3 days', 7: 'Weekly' }[n] || n + ' days');
        if (prev !== lead) audit(by, 'Changed appraisal lead time', 'Notification settings', prev + ' days', lead + ' days');
        if (prevR !== c.reminderEvery) audit(by, 'Changed reminder frequency', 'Notification settings', every(prevR), every(c.reminderEvery));
        store.save(); RM.overlay.toast('Settings saved'); });
      root.querySelector('.page').addEventListener('change', (e) => { const s = e.target.closest('[data-n]'); if (!s) return; c.notif[s.dataset.n] = s.checked; audit((q.me() || {}).id || 'ADM-0001', s.checked ? 'Enabled notification' : 'Muted notification', 'Notification settings', s.checked ? 'Muted' : 'On', s.checked ? 'On' : 'Muted', s.dataset.label); store.save(); RM.overlay.toast((s.checked ? 'Enabled: ' : 'Muted: ') + s.dataset.label, { tone: 'info', ms: 2400 }); });
    },
  };
})(window.RM);
