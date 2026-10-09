/* NV-DPS-Internal CSV import: new employees (Dashboard, People, Financial Updates) and a month's financials (Financial Updates) */
(function (RM) {
  'use strict';
  const { esc, ic, q, fmt, C, store } = RM;
  const O = RM.overlay;

  /* ---------------- parsing ---------------- */
  // RFC 4180 CSV, plus the tab-separated text Excel puts on the clipboard and the semicolon files some locales save.
  // Rows keep their spreadsheet row number so problems can be reported against the sheet.
  function parse(text) {
    text = String(text || '').replace(/^﻿/, '');
    const head = text.split(/\r?\n/).find((l) => l.trim()) || '';
    const delim = ['\t', ',', ';'].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', quoted = false, line = 1, start = 1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else { cell += ch; if (ch === '\n') line++; }
      } else if (ch === '"' && !cell.trim()) { quoted = true; cell = ''; }
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\r' || ch === '\n') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push({ n: start, cells: row }); row = []; cell = ''; start = ++line; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push({ n: start, cells: row }); }
    return rows.map((r) => ({ n: r.n, cells: r.cells.map((c) => c.trim()) })).filter((r) => r.cells.some(Boolean));
  }
  // "Forecast (₹ L)" → "forecast", "Employee ID" → "employeeid"
  const norm = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
  function columns(cells, aliases) {
    const idx = {};
    cells.forEach((h, i) => { const k = norm(h); const key = Object.keys(aliases).find((a) => aliases[a].includes(k)); if (key && idx[key] == null) idx[key] = i; });
    return idx;
  }
  const ID_ALIASES = ['employeeid', 'id', 'empid', 'employeecode', 'empcode', 'employeeno', 'empno'];
  const EMAIL_ALIASES = ['workemail', 'email', 'emailid', 'emailaddress'];

  /* ---------------- shared modal ---------------- */
  // cfg: title, sub, help, guide (html), heads, placeholder, copyLabel, template(), analyse(rows) → plan, confirm(plan)
  // plan: { rows: [{ n, cells, error, ready }], ready, readyRows, note } or { error }
  function open(cfg) {
    let plan = null;
    // phones and tablets pick files; only a fine pointer can drag one in
    const pick = window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'Drop a CSV file here' : 'Choose a CSV file';
    return O.modal({
      wide: true, icon: 'upload-minimalistic-linear', title: cfg.title, sub: cfg.sub, confirm: 'Nothing to import yet',
      body: `<div class="imp-drop" id="imp-drop">
          <span class="imp-drop-ic">${ic('upload-minimalistic-linear')}</span>
          <div class="imp-drop-text"><b id="imp-name">${pick}</b><span class="help" id="imp-hint">Saved from Excel with File → Save As → CSV</span></div>
          <button type="button" class="btn btn-secondary btn-sm" id="imp-pick" autofocus>Choose file</button>
          <input type="file" id="imp-file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" hidden>
        </div>
        <div class="field"><label for="imp-text">Or paste cells copied from Excel</label>
          <textarea class="textarea imp-text" id="imp-text" spellcheck="false" autocomplete="off" placeholder="${esc(cfg.placeholder)}"></textarea>
          <span class="help">${cfg.help} <button type="button" class="link-btn" id="imp-copy">${cfg.copyLabel}</button> <span id="imp-copy-st" aria-live="polite"></span></span>
        </div>
        <textarea class="textarea imp-copy-out" id="imp-copy-out" readonly hidden aria-label="Template to copy"></textarea>
        <details class="imp-guide"><summary>Column guide</summary><dl>${cfg.guide}</dl></details>
        <div id="imp-out" aria-live="polite"></div>`,
      onMount: (m) => {
        const $m = (s) => m.querySelector(s); const ok = $m('[data-m="ok"]'); const ta = $m('#imp-text'); const drop = $m('#imp-drop'); const body = $m('.modal-body');
        const setOk = () => { const n = plan && plan.ready; ok.disabled = !n; ok.textContent = n ? cfg.confirm(plan) : 'Nothing to import yet'; };
        const run = () => {
          const had = !!(plan && !plan.error); const rows = parse(ta.value); plan = rows.length ? cfg.analyse(rows) : null;
          $m('#imp-out').innerHTML = plan ? view(plan, cfg) : ''; setOk();
          // once rows are in, the preview is the thing to read: the source area steps back to a compact strip
          body.classList.toggle('imp-has-data', !!plan);
          if (!had && plan && !plan.error && window.gsap && !RM.reduced()) gsap.fromTo(RM.$$('.imp-sum, .imp-table tbody tr', body).slice(0, 14), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: .2, stagger: .025, ease: 'power2.out', clearProps: 'opacity,transform' });
        };
        const source = (name, hint, tone) => { $m('#imp-name').textContent = name; $m('#imp-hint').textContent = hint; drop.classList.toggle('is-loaded', tone === 'ok'); drop.classList.toggle('is-bad', tone === 'bad'); };
        setOk();
        let t; ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { run(); if (!ta.value.trim()) source(pick, 'Saved from Excel with File → Save As → CSV'); else if (!drop.classList.contains('is-loaded')) source('Or replace these rows with a CSV file', 'Pasted rows are in the box below'); }, 160); });
        const load = async (file) => {
          if (!file) return;
          const buf = await file.arrayBuffer(); const b = new Uint8Array(buf.slice(0, 2));
          // .xlsx is a zip (PK), legacy .xls is an OLE file (D0 CF): neither is text
          if ((b[0] === 0x50 && b[1] === 0x4B) || (b[0] === 0xD0 && b[1] === 0xCF)) { source(file.name, 'This is an Excel workbook. Save it as CSV first, or copy the cells and paste them below.', 'bad'); return; }
          let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('windows-1252').decode(buf); } // Excel's plain "CSV" is ANSI
          ta.value = text; run();
          const n = Math.max(0, parse(text).length - 1);
          source(file.name, n ? `${n} data row${n > 1 ? 's' : ''} · the contents are in the box below, where you can still edit them` : 'No data rows found under the header', n ? 'ok' : 'bad');
        };
        $m('#imp-pick').addEventListener('click', () => $m('#imp-file').click());
        $m('#imp-file').addEventListener('change', (e) => { load(e.target.files[0]); e.target.value = ''; });
        // the whole dialog takes a drop, so a near miss never opens the file in the browser tab
        m.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
        m.addEventListener('dragleave', (e) => { if (!m.contains(e.relatedTarget)) drop.classList.remove('is-over'); });
        m.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); load(e.dataTransfer.files[0]); });
        $m('#imp-copy').addEventListener('click', () => {
          // shared pages can't download files, so the template is copied as tab-separated text, which Excel splits into columns on paste
          const text = cfg.template(); const st = $m('#imp-copy-st'); const box = $m('#imp-copy-out');
          const fallback = () => { box.hidden = false; box.value = text; box.focus(); box.select(); st.textContent = 'Copying is blocked here. The text is selected: press Ctrl+C (or Cmd+C).'; };
          try { navigator.clipboard.writeText(text).then(() => { st.textContent = 'Copied. Paste into Excel, fill it in, then paste the cells back here.'; }, fallback); } catch (err) { fallback(); }
        });
      },
      validate: () => (plan && plan.ready ? plan : false),
    });
  }

  function view(plan, cfg) {
    if (plan.error) return C.notice('warn', 'danger-triangle-linear', plan.error, 'style="margin-top:16px"');
    const skipped = plan.rows.filter((r) => r.error).length; const same = plan.rows.length - skipped - plan.readyRows;
    // problems first, so a long sheet never hides them below the fold; row numbers still point at the sheet
    const rank = (r) => (r.error ? 0 : r.ready ? 1 : 2); const rows = plan.rows.slice().sort((a, b) => rank(a) - rank(b));
    return `<div class="imp-sum"><span class="badge ${plan.readyRows ? 'b-ok' : ''}">${plan.readyRows} ready</span>${same ? `<span class="badge">${same} unchanged</span>` : ''}${skipped ? `<span class="badge b-bad">${skipped} skipped</span>` : ''}<span class="small muted">${plan.note}</span></div>
      <div class="table-wrap imp-table"><table class="table"><thead><tr><th class="r">Row</th><th>Status</th>${cfg.heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="r num muted">${r.n}</td><td>${r.error ? `<span class="badge b-bad">Skipped</span><div class="tiny imp-why">${esc(r.error)}</div>` : r.ready ? '<span class="badge b-ok">Ready</span>' : '<span class="badge">No change</span>'}</td>${r.cells.map((c, i) => `<td${(cfg.wrap || []).includes(i) ? ' class="imp-wrap"' : ''}>${c}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  }

  /* ---------------- financials ---------------- */
  const FIN_COLS = { id: ID_ALIASES, email: EMAIL_ALIASES, name: ['name', 'employee', 'employeename', 'fullname'], billable: ['billability', 'billable', 'billing'], forecast: ['forecast'], actual: ['actual', 'actuals'] };
  const FIELDS = ['billable', 'forecast', 'actual']; // there are no per-person goals; targets belong to leads and are set on the page
  const LABEL = { billable: 'Billability', forecast: 'Forecast', actual: 'Actual' };
  const BILL = { billable: '1', yes: '1', y: '1', true: '1', 1: '1', nonbillable: '0', notbillable: '0', no: '0', n: '0', false: '0', 0: '0' };
  const two = (v) => (+v).toFixed(2);
  // at least two decimals, and rupee precision (five decimals of a lakh) when the sheet has it
  const lakhStr = (n) => { const s = String(Math.round(n * 1e5) / 1e5); return (s.split('.')[1] || '').length >= 2 ? s : n.toFixed(2); };
  function money(raw) {
    const t = raw.replace(/[₹,\s]/g, '').replace(/(lakhs?|lacs?|l)$/i, '');
    if (/^-/.test(t)) return { error: 'amounts can’t be negative' };
    if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { error: `“${raw}” isn’t a number` };
    const n = parseFloat(t);
    if (n > 1000) return { error: `${raw} looks like rupees. Amounts are in ₹ lakhs (4,50,000 → 4.5)` };
    return { n };
  }
  function whoFin(r, idx) {
    const cell = (k) => (idx[k] != null ? r.cells[idx[k]] || '' : '');
    const db = store.db; const id = cell('id').toUpperCase(); const email = cell('email').toLowerCase(); const name = cell('name').replace(/\s+/g, ' ');
    if (id) { const p = db.people.find((x) => x.id === id); return p ? { p } : { label: id, error: `No employee with ID ${id}` }; }
    if (email) { const p = db.people.find((x) => x.email === email); return p ? { p } : { label: email, error: `No employee with email ${email}` }; }
    if (name) { const hits = db.people.filter((x) => x.name.toLowerCase() === name.toLowerCase()); return hits.length === 1 ? { p: hits[0] } : { label: name, error: hits.length ? `${hits.length} people are named ${name}. Add their Employee ID` : `No employee named ${name}` }; }
    return { label: '–', error: 'No Employee ID, email or name on this row' };
  }
  function analyseFin(rows, ed, key) {
    const [head, ...body] = rows; const idx = columns(head.cells, FIN_COLS); const fields = FIELDS.filter((f) => idx[f] != null);
    const found = `Found: ${esc(head.cells.join(', '))}.`;
    if (idx.id == null && idx.email == null && idx.name == null) return { error: `<b>No employee column.</b> The first row must be headers, including Employee ID (or Email, or Name). ${found}` };
    if (!fields.length) return { error: `<b>No value columns.</b> Add at least one of Billability, Forecast or Actual. ${found}` };
    if (!body.length) return { error: 'Only a header row. Add one row per employee under it.' };
    const seen = {}; let changes = 0;
    const out = body.map((r) => {
      const who = whoFin(r, idx);
      if (who.error) return { n: r.n, cells: [`<span class="strong">${esc(who.label)}</span>`, ''], error: who.error };
      const p = who.p; const person = C.person(p, esc(p.id), { size: 'sm' }); const tr = ed.querySelector(`tr[data-emp="${p.id}"]`);
      if (!tr) return { n: r.n, cells: [person, ''], error: p.status !== 'Active' ? 'Archived, so not in this month' : 'No financial record for this month' };
      if (seen[p.id]) return { n: r.n, cells: [person, ''], error: `Also on row ${seen[p.id]}, which is used instead` };
      seen[p.id] = r.n;
      const sets = []; const errs = [];
      fields.forEach((f) => {
        const raw = (r.cells[idx[f]] || '').trim(); if (!raw) return; // a blank cell keeps what the table has
        const inp = tr.querySelector(`[data-k="${f}"]`); const cur = inp.value.trim();
        if (f === 'billable') {
          const v = BILL[norm(raw)]; if (!v) { errs.push(`Billability “${raw}” should be Billable or Non-billable`); return; }
          if (v !== cur) sets.push({ inp, v, prev: cur, html: `${LABEL[f]} <b>${v === '1' ? 'Billable' : 'Non-billable'}</b>` });
          return;
        }
        const m = money(raw); if (m.error) { errs.push(`${LABEL[f]}: ${m.error}`); return; }
        const was = parseFloat(cur);
        if (cur === '' || isNaN(was) || Math.abs(was - m.n) > 1e-6) sets.push({ inp, v: lakhStr(m.n), prev: cur, html: `${LABEL[f]} <span>${cur === '' || isNaN(was) ? '–' : two(was)}</span> → <b>${two(m.n)}</b>` });
      });
      // the row as it would be once filled: an actual can't be more than its forecast
      const after = (k) => { const s = sets.find((x) => x.inp.dataset.k === k); const v = s ? s.v : tr.querySelector(`[data-k="${k}"]`).value.trim(); return v === '' ? null : parseFloat(v); };
      const fa = after('actual'), ff = after('forecast');
      if (!errs.length && fa != null && ff != null && Math.round(fa * 1e5) > Math.round(ff * 1e5)) errs.push(`Actual ${two(fa)} is more than the forecast ${two(ff)}; an actual can’t be more than its forecast`);
      if (errs.length) return { n: r.n, cells: [person, ''], error: errs.join(' · ') };
      changes += sets.length;
      return { n: r.n, cells: [person, sets.length ? sets.map((s) => `<span class="imp-chg">${s.html}</span>`).join('') : '<span class="small muted">Matches the table</span>'], ready: sets.length > 0, sets };
    });
    const ready = out.filter((r) => r.ready);
    return { rows: out, ready: changes, readyRows: ready.length, sets: ready.flatMap((r) => r.sets),
      note: changes ? `${changes} value${changes > 1 ? 's change' : ' changes'} in ${fmt.monthLabel(key)} (₹ lakhs)` : 'Everything already matches the table' };
  }
  // the visible control for a cell: styled selects draw a button over the native <select> (see enhanceSelect in ui.js)
  const face = (inp) => (inp.dataset.xsel ? inp.parentElement.querySelector('.xsel-btn') || inp : inp);
  // set a value the way a person would, so the editor's variance, dirty count and styled select all follow
  const put = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
  function financials() {
    const ed = RM.finEditor; if (!ed || !document.contains(ed)) return;
    const key = ed.dataset.key;
    const rows = RM.$$('tr[data-emp]', ed);
    open({
      title: `Fill ${fmt.monthLabel(key)} from CSV or Excel`,
      sub: 'Values land in the table for you to check. Nothing is saved yet.',
      placeholder: 'Employee ID\tBillability\tForecast\tActual',
      help: 'Amounts in ₹ lakhs. Blank cells keep what the table has.',
      copyLabel: 'Copy this table to start from',
      template: () => [['Employee ID', 'Name', 'Billability', 'Forecast (₹ L)', 'Actual (₹ L)'].join('\t'),
        ...rows.map((tr) => { const v = (k) => tr.querySelector(`[data-k="${k}"]`).value; const p = q.person(tr.dataset.emp); return [p.id, p.name, v('billable') === '1' ? 'Billable' : 'Non-billable', v('forecast'), v('actual')].join('\t'); })].join('\n'),
      guide: `<dt>Employee ID</dt><dd>Matches each row to a person. Email or full name also work when there’s no ID column.</dd>
        <dt>Billability</dt><dd>Billable or Non-billable (Yes/No works too).</dd>
        <dt>Forecast, Actual</dt><dd>₹ lakhs, so 4.5 means ₹4,50,000. ₹ signs and commas are ignored. An actual can’t be more than its forecast. A person’s actual counts in the dashboards as soon as it’s saved; until then their forecast does.</dd>
        <dt>Other columns</dt><dd>Ignored, so a Name column can stay for reference.</dd>`,
      heads: ['Employee', 'Changes'], wrap: [1],
      analyse: (rs) => analyseFin(rs, ed, key),
      confirm: (plan) => `Fill ${plan.ready} value${plan.ready > 1 ? 's' : ''}`,
    }).then((res) => {
      if (!res.ok || !document.contains(ed)) return;
      const sets = res.value.sets; const snap = ed._snap();
      ed._filling = true; sets.forEach((s) => { face(s.inp).classList.add('is-imported'); put(s.inp, s.v); }); ed._filling = false; ed._sync();
      ed.scrollIntoView({ behavior: RM.reduced() ? 'auto' : 'smooth', block: 'start' });
      const n = sets.length;
      O.toast(`Filled ${n} value${n > 1 ? 's' : ''} · check the highlighted cells, then Save changes`, { icon: 'file-check-bold', ms: 8000, action: { label: 'Undo', fn: () => {
        if (!document.contains(ed)) return;
        // a cell corrected by hand since the fill has lost its marker and keeps the hand-typed value
        const back = sets.filter((s) => face(s.inp).classList.contains('is-imported'));
        ed._filling = true; back.forEach((s) => { face(s.inp).classList.remove('is-imported'); put(s.inp, s.prev); }); ed._filling = false;
        ed._restore(snap, back.map((s) => s.inp.closest('tr').dataset.emp + '|' + s.inp.dataset.k));
        O.toast(back.length === sets.length ? 'Fill undone · those cells are back as they were' : `Fill undone for ${back.length} cell${back.length === 1 ? '' : 's'} · cells you edited since keep your values`, { tone: 'info' });
      } } });
    });
  }

  /* ---------------- employees ---------------- */
  const EMP_COLS = { id: ID_ALIASES, name: ['fullname', 'name', 'employeename', 'employee'], email: EMAIL_ALIASES, designation: ['designation', 'title', 'jobtitle'], role: ['platformrole', 'role'], alloc: ['allocation', 'client', 'account'], joined: ['joiningdate', 'joined', 'dateofjoining', 'doj', 'joindate', 'startdate'], rm: ['reportingmanager', 'rm', 'manager', 'reportsto', 'reportingmanagerid', 'rmid', 'managerid', 'rmemail', 'manageremail'] };
  const REQUIRED = { name: 'Full name', email: 'Work email', designation: 'Designation', role: 'Platform role', alloc: 'Allocation', joined: 'Joining date', rm: 'Reporting manager' };
  const ROLE = { pm: 'PM', po: 'PO', seniorba: 'Senior BA', sba: 'Senior BA', ba: 'BA', practicehead: 'Practice Head', ph: 'Practice Head', none: '–', na: '–', '': '–' }; // '' is a dash
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  // YYYY-MM-DD, DD/MM/YYYY (Excel's Indian locale) or 5 Sep 2026 → YYYY-MM-DD
  function date(s) {
    let y, m, d, x;
    if ((x = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
    else if ((x = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) { d = +x[1]; m = +x[2]; y = +x[3]; }
    else if ((x = s.match(/^(\d{1,2})[-\s]([a-z]{3})[a-z]*[-\s,]+(\d{4})$/i))) { d = +x[1]; m = MON.indexOf(x[2].toLowerCase()) + 1; y = +x[3]; }
    else return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d || y < 1980 || y > RM.TODAY.getFullYear() + 1) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function analyseEmp(rows) {
    const [head, ...body] = rows; const idx = columns(head.cells, EMP_COLS);
    const missing = Object.keys(REQUIRED).filter((k) => idx[k] == null);
    if (missing.length) return { error: `<b>Missing column${missing.length > 1 ? 's' : ''}: ${missing.map((k) => REQUIRED[k]).join(', ')}.</b> The first row must be the headers. Found: ${esc(head.cells.join(', '))}.` };
    if (!body.length) return { error: 'Only a header row. Add one row per new employee under it.' };
    const db = store.db; const app = RM.app; const cell = (r, k) => (idx[k] != null ? (r.cells[idx[k]] || '').trim() : '');
    const ALLOC = Object.fromEntries(app.ALLOCS.map((a) => [norm(a), a]));
    const byId = new Set(db.people.map((x) => x.id).concat(db.admin.id)); const byEmail = new Set(db.people.map((x) => x.email).concat(db.admin.email));
    const asked = new Set(body.map((r) => cell(r, 'id').toUpperCase()).filter(Boolean)); const seenId = {}; const seenEmail = {};
    let next = Math.max(...db.people.filter((x) => /^NVS\d+$/.test(x.id)).map((x) => +x.id.slice(3))) + 1;
    const recs = body.map((r) => {
      const e = { n: r.n, name: cell(r, 'name').replace(/\s+/g, ' '), email: cell(r, 'email').toLowerCase(), designation: cell(r, 'designation'), rmRaw: cell(r, 'rm'), errs: [] };
      e.id = cell(r, 'id').toUpperCase();
      if (!e.id) { let id; do { id = 'NVS' + String(next++).padStart(5, '0'); } while (byId.has(id) || asked.has(id)); e.id = id; e.autoId = true; }
      else if (!/^NV[SC]\d{5}$/.test(e.id)) e.errs.push(`ID ${e.id} should look like NVS01900`);
      else if (byId.has(e.id)) e.errs.push(`${e.id} already exists`);
      else if (seenId[e.id]) e.errs.push(`ID ${e.id} is also on row ${seenId[e.id]}`);
      seenId[e.id] = seenId[e.id] || r.n;
      if (e.name.length < 3) e.errs.push('Add the full name');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email)) e.errs.push(e.email ? `${e.email} isn’t a valid email` : 'Add a work email');
      else if (byEmail.has(e.email)) e.errs.push(`${e.email} already belongs to ${(db.people.find((x) => x.email === e.email) || db.admin).name}`);
      else if (seenEmail[e.email]) e.errs.push(`${e.email} is also on row ${seenEmail[e.email]}`);
      seenEmail[e.email] = seenEmail[e.email] || r.n;
      if (!e.designation) e.errs.push('Add a designation');
      const role = cell(r, 'role'); e.role = role ? ROLE[norm(role)] : null;
      if (!e.role) e.errs.push(role ? `Role “${role}” should be PM, PO, Senior BA, BA, Practice Head or None` : 'Add a platform role');
      const alloc = cell(r, 'alloc'); e.alloc = ALLOC[norm(alloc)];
      if (!e.alloc) e.errs.push(alloc ? `Allocation “${alloc}” should be one of ${app.ALLOCS.join(', ')}` : 'Add an allocation');
      const joined = cell(r, 'joined'); e.joined = joined ? date(joined) : null;
      if (!e.joined) e.errs.push(joined ? `Joining date “${joined}” should be YYYY-MM-DD or DD/MM/YYYY` : 'Add a joining date');
      return e;
    });
    // a manager is anyone active, or someone else in this file, matched by ID, email or full name
    const match = (list, v) => { const l = v.toLowerCase().replace(/\s+/g, ' '); return list.filter((x) => x.id.toLowerCase() === l || x.email === l || x.name.toLowerCase() === l); };
    recs.forEach((e) => {
      if (!e.rmRaw) { if (e.role !== 'Practice Head') e.errs.push('Add a reporting manager'); return; }
      const hits = [...match(q.active(), e.rmRaw), ...match(recs.filter((x) => x !== e), e.rmRaw)];
      if (hits.length === 1) { e.rm = hits[0].id; e.rmName = hits[0].name; e.rmRec = recs.includes(hits[0]) ? hits[0] : null; }
      else e.errs.push(hits.length ? `${hits.length} people match manager “${e.rmRaw}”. Use their Employee ID` : `No active employee matches manager “${e.rmRaw}”`);
    });
    recs.forEach((e) => { const seen = new Set([e]); let x = e.rmRec; while (x && !seen.has(x)) { seen.add(x); x = x.rmRec; } if (x === e) e.errs.push('The reporting line loops back to this person'); });
    for (let again = true; again;) { again = false; recs.forEach((e) => { if (!e.errs.length && e.rmRec && e.rmRec.errs.length) { e.errs.push(`Their manager on row ${e.rmRec.n} is skipped`); again = true; } }); }
    const ready = recs.filter((e) => !e.errs.length);
    const depth = (e) => (e.rmRec ? 1 + depth(e.rmRec) : 0); ready.sort((a, b) => depth(a) - depth(b)); // managers are created before their reportees
    return { ready: ready.length, readyRows: ready.length, create: ready,
      note: ready.length ? 'Monthly reviews start in each joining month' : '',
      rows: recs.map((e) => ({ n: e.n, error: e.errs.join(' · '), ready: !e.errs.length, cells: [
        `<span class="strong">${esc(e.name || '–')}</span><div class="tiny muted">${esc(e.id)}${e.autoId ? ' <span class="imp-auto" title="Next free ID">auto</span>' : ''} · ${esc(e.email || 'no email')}</div>`,
        `${esc(e.role || '–')}<div class="tiny muted">${esc(e.designation || '–')} · ${esc(e.alloc || '–')}</div>`,
        esc(e.rmName || (e.role === 'Practice Head' && !e.rmRaw ? 'Practice leadership' : e.rmRaw || '–'))] })) };
  }
  function employees() {
    const me = q.me(); if (!q.canEditPeople(me)) { O.toast('Only Admin can add employees.', { tone: 'warn' }); return; }
    const heads = ['Employee ID', 'Full name', 'Work email', 'Designation', 'Platform role', 'Allocation', 'Joining date', 'Reporting manager'];
    open({
      title: 'Import employees from CSV or Excel',
      sub: 'Each row is checked like Add employee before anyone is created.',
      placeholder: heads.join('\t'),
      help: 'One row per new employee. Existing people are left as they are.',
      copyLabel: 'Copy the column headers',
      template: () => heads.join('\t'),
      guide: `<dt>Employee ID</dt><dd>Optional. Leave it blank to use the next free ID.</dd>
        <dt>Platform role</dt><dd>PM, PO, Senior BA, BA, Practice Head or None.</dd>
        <dt>Allocation</dt><dd>${RM.app.ALLOCS.map(esc).join(', ')}.</dd>
        <dt>Joining date</dt><dd>YYYY-MM-DD or DD/MM/YYYY. Sets the appraisal anniversary.</dd>
        <dt>Reporting manager</dt><dd>Their Employee ID, email or full name. Can be someone else in the same sheet.</dd>`,
      heads: ['Employee', 'Role', 'Reporting manager'],
      analyse: analyseEmp,
      confirm: (plan) => `Add ${plan.ready} employee${plan.ready > 1 ? 's' : ''}`,
    }).then((res) => {
      if (!res.ok) return;
      const made = res.value.create.map((e) => RM.app.createEmployee({ id: e.id, name: e.name, email: e.email, designation: e.designation, role: e.role, rm: e.rm || null, alloc: e.alloc, joined: e.joined }, me.id, 'CSV import'));
      store.save(); RM.app.softRender();
      O.toast(`${made.length} employee${made.length > 1 ? 's' : ''} added · audited · monthly reviews start in their joining month`, { icon: 'user-plus-linear', ms: 5200 });
    });
  }

  RM.imports = { parse, financials, employees };
})(window.RM);
