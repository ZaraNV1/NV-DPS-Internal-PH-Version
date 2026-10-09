/* NV-DPS-Internal data layer
 * People, reporting lines, designations, IDs and allocations come from
 * "Organization Chart.png" (Digital Product Studio). Photos are cropped from
 * the same chart. Everything else (joining dates, reviews, scores, notes,
 * financials, audit entries) is deterministic SAMPLE data for this prototype,
 * generated from a seeded PRNG so every reload tells the same story.
 */
window.RM = window.RM || {};
(function (RM) {
  'use strict';

  const TODAY = new Date(2026, 9, 1, 14, 20); // Thu 1 Oct 2026: quarters follow each person's joining date; those ending on 31 Oct have marks open, due that day
  RM.TODAY = TODAY;
  RM.DOMAIN = 'newvision-software.com';

  /* ---------- seeded randomness ---------- */
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = hash(seed); return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  RM.rng = rng;
  const round1 = (n) => Math.round(n * 10) / 10;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* ---------- people (the practice's employee sheet; Brian Okuno and the platform roles come from the org chart) ---------- */
  // level, primary skill and financial target (Y/N) are as the sheet gives them; blanks are left out.
  // tile: the chart shows a letter tile instead of a photo for these people
  const P = (id, name, designation, role, rm, alloc, joined, extra) => Object.assign({ id, name, designation, role, rm, alloc, joined, status: 'Active', practice: 'Digital Product Studio' }, extra || {});
  const S = (level, skill, finTarget, more) => Object.assign({ level, skill, finTarget }, more || {});
  const PEOPLE = [
    // Shine reports to Kapil Godani, outside the practice, so the practice tree starts with her
    P('NVS00697', 'Shine Pushpan', 'Practice Head', 'Practice Head', null, '–', '2022-04-04', S('L0', 'Management', true, { rmExternal: 'Kapil Godani' })), // photo: assets/people/nvs00697.jpg
    P('NVS00212', 'Prakhar Singh Gaherwar', 'Product Manager', 'PM', 'NVS00697', 'Deloitte', '2019-07-22', S('L1', 'Product Owner', true)),
    P('NVS00207', 'Komal Gharge', 'Product Manager', 'PM', 'NVS00697', 'Deloitte', '2019-07-03', S('L1', 'Product Owner', true, { tile: { letter: 'K', bg: '#4A86E8' } })),
    P('NVS00247', 'Talha Siddiqui', 'Product Owner', 'PO', 'NVS00697', 'Deloitte', '2019-12-26', S('L2', 'Product Owner', true)),
    // list order sets the order around Shine on the org map: between Talha's and Kopal's teams his tile overlaps nothing
    P('NVC00110', 'Brian Okuno', 'Consultant', '–', 'NVS00697', 'E&Y Staff-Aug', '2026-02-02', { tile: { letter: 'B', bg: '#9AA6B8' }, contractor: true }),
    P('NVS01478', 'Kopal Sharma', 'Product Owner', 'PO', 'NVS00697', 'Internal', '2024-12-16', S('L2', 'Business Analyst', false)),
    P('NVS01607', 'Mustufa Kalabhai', 'Senior Manager', 'PM', 'NVS00697', 'E&Y Staff-Aug', '2025-07-08', S('L0', 'CA', false)),
    P('NVS01119', 'Pooja Heda', 'Product Manager', 'PM', 'NVS00697', 'Deloitte', '2023-08-14', S('L1', 'Product Owner', true)),
    P('NVS00984', 'Kuldeep Golani', 'Product Manager', 'PM', 'NVS00697', 'Deloitte', '2023-03-31', S('L1', 'Product Owner', true)),
    // the sheet leaves Robert's manager and client blank; he stays under Shine as on the org chart
    P('NVC00109', 'Robert Carpenter', 'Consultant', '–', 'NVS00697', '–', '2026-02-15', { tile: { letter: 'R', bg: '#9AA6B8' }, contractor: true }),
    P('NVS00712', 'Pratik Jaiswal', 'UX Lead', 'PM', 'NVS00697', 'Deloitte', '2022-04-26', S('L2', 'UI-UX Designer', true, { tile: { letter: 'P', bg: '#F2A36A' }, mapPending: true })),
    P('NVS00822', 'Yogiraj Singh Kushwah', 'Senior Business Analyst', 'Senior BA', 'NVS00212', 'ECN', '2022-08-29', S('L3', 'Business Analyst', false)),
    P('NVS01822', 'Shristi Chaurasia', 'Product Owner', 'PO', 'NVS00212', 'Deloitte', '2026-07-20', S('L2', null, false)),
    P('NVS01753', 'Nikhil Konasirasgi', 'Business Analyst', 'BA', 'NVS00212', 'SFC/RFC', '2026-03-26', S('L3', null, false)),
    P('NVS01602', 'Shivangi Upadhyay', 'Business Analyst', 'BA', 'NVS00212', 'Internal', '2025-06-30', S('L3', 'Business Analyst', false)),
    // Zara and Aaditya report to Kopal (the sheet's manager column for them is out of date)
    P('NVS01864', 'Zara Nasir', 'Junior Business Analyst', 'BA', 'NVS01478', 'Internal', '2026-05-06', { finSelf: false }),
    P('NVS01831', 'Aaditya Mukherjee', 'Trainee Business Analyst', 'BA', 'NVS01478', 'Internal', '2026-08-03', { finSelf: false }),
    P('NVS01812', 'Nithya Annadurai', 'Senior Business Analyst', 'Senior BA', 'NVS00247', 'Deloitte', '2026-07-06', S('L3', null, false)),
    P('NVS00957', 'Rehan Akhtarkhan Pathan', 'Product Owner', 'PO', 'NVS00247', 'Deloitte', '2023-02-27', S('L2', 'Business Analyst', false)),
    P('NVS01685', 'Deepanshu Khanna', 'Senior Business Analyst', 'Senior BA', 'NVS00247', 'Deloitte', '2025-12-11', S('L3', 'Business Analyst', false)),
    P('NVS01037', 'Borad Hiral Ramnikbhai', 'Senior Business Analyst', 'Senior BA', 'NVS00247', 'Deloitte', '2023-05-18', S('L3', 'Business Analyst', false, { email: 'hiral.borad' })),
    P('NVS01727', 'Chitansee Kirar', 'Business Analyst', 'BA', 'NVS01119', 'Deloitte', '2026-02-16', S('L3', null, false)),
    P('NVS01382', 'Shruti Yawalkar', 'Senior Business Analyst', 'Senior BA', 'NVS01119', 'Deloitte', '2024-08-26', S('L3', 'Business Analyst', false)),
    P('NVS01663', 'Shweta Achchha', 'Senior Business Analyst', 'Senior BA', 'NVS01119', 'Deloitte', '2025-11-04', S('L3', 'Business Analyst', false)),
    P('NVS00928', 'Dhaval Kishor Malte', 'Product Manager', 'PM', 'NVS00984', 'Deloitte', '2023-01-16', S('L2', 'Product Owner', false)),
    P('NVS00975', 'Shweta Mahesh Gupta', 'Business Analyst', 'BA', 'NVS00928', 'Deloitte', '2023-03-22', S('L3', 'Business Analyst', false)), // under Dhaval (the sheet says Kuldeep; corrected)
    P('NVS00996', 'Manisha Sisodia', 'Product Owner', 'PO', 'NVS00928', 'Deloitte', '2023-04-14', S('L2', 'Business Analyst', false)),
    P('NVS01805', 'Muskan Kapuria', 'Product Owner', 'PO', 'NVS00928', 'Deloitte', '2026-06-05', S('L2', null, false)),
    P('NVS00932', 'Archana Khewariya', 'Product Owner', 'PO', 'NVS00928', 'Deloitte', '2023-01-23', S('L2', 'Business Analyst', false)),
    P('NVS01650', 'Tejas Lohokare', 'Senior Business Analyst', 'Senior BA', 'NVS00996', 'RSM', '2025-09-22', S('L3', 'Business Analyst', false)), // under Manisha (the sheet says Dhaval; corrected)
    P('NVS01726', 'Chanchal Bagaddeo', 'UX Designer', 'BA', 'NVS00712', 'Deloitte', '2026-02-16', S('L3', null, false, { mapPending: true })),
    P('NVS01388', 'Sejal Nagarkar', 'Designer', 'BA', 'NVS00712', 'Internal', '2024-08-29', S('L3', 'UI-UX Designer', false, { mapPending: true })),
    P('NVS01482', 'Urvashi Trivedi', 'UX Designer', 'BA', 'NVS00712', 'Internal', '2024-12-23', S('L3', 'UI-UX Designer', false, { mapPending: true })),
  ];
  const ADMIN = { id: 'ADM-0001', name: 'Imran Qureshi', designation: 'Platform Admin', role: 'Admin', rm: null, alloc: '–', joined: '2020-01-06', status: 'Active', practice: 'People Operations', system: true, sampleAccount: true };

  /* ---------- platform roles in review cycles and their default templates (Admin maps each designation to a role) ---------- */
  // a PO with direct reportees takes 'PO-R' (review.js); the Practice Head and contractors are outside review cycles
  RM.ROLE_TEMPLATE = { 'BA': 'BA-SBA', 'Senior BA': 'BA-SBA', 'PM': 'PM', 'PO': 'PO' };

  /* ---------- review templates (from the four Quarterly Goal Review decks: BA & Sr BA, PM, PO, PO with direct reportees) ----------
   * A template is goals grouped into the five brand-value categories. Each goal is marked out of its own weight (RV-07); the
   * quarter's total is the sum. No goal is yearly today (set yearly: true to mark one in Q4 only, RV-08). A goal's evidence
   * form is the deck's table for it. Form columns: k (stored key), label, type (text | date | url | num | select | photo |
   * label), w (relative width), opts (select options). fixed: rows that are always there. special: built from other records
   * (conv: the monthly review; quarters: this FY's quarterly sheets; finance: the uploaded figures; teamMonthly and
   * teamQuarterly: the reporting team's monthly reviews and quarterly sheets). parts: more than one form for a goal. */
  const GG = (summary, detail, weight, extra) => Object.assign({ summary, detail, weight, yearly: false, monthly: true }, extra || {});
  const F = (k, label, type, o) => Object.assign({ k, label, type: type || 'text', w: 1 }, o || {});
  const YN = ['Yes', 'No']; const DONE3 = ['Completed', 'In progress', 'Not done']; const OPEN2 = ['Open', 'Closed'];
  const READY = { opts: ['Ready', 'Partly ready', 'Not ready'] };
  const backlog = (id, refine) => ({ id, title: 'Sprint-wise evidence',
    cols: [F('sprint', 'Sprint', 'text', { w: .8 }), F('timeline', 'Sprint timeline'), F('prioritized', 'Backlog prioritized', 'select', { opts: YN, w: .95 }), F('refinement', refine, 'select', { opts: DONE3 }), F('grooming', 'Grooming', 'select', { opts: DONE3 }), F('readiness', 'Story readiness', 'select', READY), F('challenge', 'Any challenge', 'text', { w: 1.4 })] });
  const FM = {
    roadmap: { id: 'roadmap', title: 'Product Roadmap (Now · Next · Later)', hint: 'Now: high-priority enhancements, critical customer needs, tech or product gaps. Next: strategic initiatives, process improvements, integrations. Later: future capabilities, innovation and AI opportunities, long-term vision.',
      cols: [F('now', 'Now', 'text', { w: 1.4 }), F('next', 'Next', 'text', { w: 1.4 }), F('later', 'Later', 'text', { w: 1.4 })] },
    pideck: { id: 'pideck', title: 'PI Deck / Domain Knowledge',
      cols: [F('project', 'Project'), F('domain', 'Domain'), F('topic', 'Topic', 'text', { w: 1.5 }), F('date', 'Date', 'date'), F('audience', 'Audience'), F('link', 'PPT link', 'url')] },
    pipres: { id: 'pipres', title: 'PI Deck Presentation (Team / DPS / Sales / Marketing / Leadership)',
      cols: [F('date', 'Date', 'date'), F('topic', 'Topic', 'text', { w: 1.6 }), F('audience', 'Audience', 'select', { opts: ['Team', 'DPS', 'Sales', 'Marketing', 'Leadership'] }), F('outcome', 'Key outcome', 'text', { w: 2 })] },
    risk: { id: 'risk', variants: [
      { id: 'riskD', key: 'deloitte', label: 'Deloitte', title: 'Identified Risks & Dependencies – Deloitte', flow: 'PI Planning → Identify → Create on ADO → Assign → Track → Resolve',
        hint: 'Evaluation focus: proactive identification during PI Planning and execution, creation on ADO, ownership, tracking and closure.',
        cols: [F('sprint', 'PI / Sprint'), F('risk', 'Risk / dependency', 'text', { w: 1.5 }), F('ado', 'ADO created? (link)', 'url'), F('owner', 'Owner / due date'), F('action', 'Corrective action / follow-up', 'text', { w: 1.6 }), F('status', 'Status', 'select', { opts: OPEN2, w: .9 })] },
      { id: 'riskN', key: 'other', label: 'Non-Deloitte', title: 'Identified Risks & Dependencies – Non-Deloitte', flow: 'Project / Client Dependency → Capture Risk → Define Mitigation → Track → Close',
        hint: 'Evaluation focus: early identification of client and project risks and dependencies, clear communication, documented corrective action and follow-through.',
        cols: [F('project', 'Project / period'), F('risk', 'Dependency / risk', 'text', { w: 1.5 }), F('impact', 'Impact'), F('action', 'Corrective action / mitigation', 'text', { w: 1.6 }), F('evidence', 'Evidence / tracking'), F('status', 'Status', 'select', { opts: OPEN2, w: .9 })] },
      // internal and investment projects: the Non-Deloitte table, with team rather than client dependencies
      { id: 'riskI', key: 'internal', label: 'Internal', title: 'Identified Risks & Dependencies – Internal', flow: 'Project / Team Dependency → Capture Risk → Define Mitigation → Track → Close',
        hint: 'Evaluation focus: early identification of project and team risks and dependencies, clear communication, documented corrective action and follow-through.',
        cols: [F('project', 'Project / period'), F('risk', 'Dependency / risk', 'text', { w: 1.5 }), F('impact', 'Impact'), F('action', 'Corrective action / mitigation', 'text', { w: 1.6 }), F('evidence', 'Evidence / tracking'), F('status', 'Status', 'select', { opts: OPEN2, w: .9 })] }] },
    recog: { id: 'recog', title: 'Client / PO / Stakeholder Recognitions',
      cols: [F('from', 'Received from'), F('date', 'Date', 'date'), F('context', 'Context', 'text', { w: 1.3 }), F('what', 'What was appreciated', 'text', { w: 1.4 }), F('impact', 'Business / customer impact', 'text', { w: 1.4 }), F('shot', 'Screenshot', 'photo')] },
    recogPM: { id: 'recogPM', title: 'Client / Stakeholder Recognitions',
      cols: [F('by', 'Recognized by', 'text', { w: 1.3 }), F('occasion', 'Occasion', 'text', { w: 1.6 }), F('evidence', 'Evidence / note', 'text', { w: 1.3 }), F('shot', 'Screenshot', 'photo')] },
    backlogBA: backlog('backlogBA', 'Refinement with PO'),
    backlogPM: backlog('backlogPM', 'Roadmap alignment'),
    backlogPO: backlog('backlogPO', 'Refinement with delivery team'),
    ceremony: { id: 'ceremony', title: 'PI / Sprint Planning / Retro Participation',
      fixed: [{ activity: 'PI Planning', frequency: 'PI cycle' }, { activity: 'Sprint Planning', frequency: 'Sprint-wise' }, { activity: 'Retrospective', frequency: 'Sprint-wise' }, { activity: 'Release Readiness', frequency: 'As applicable' }, { activity: 'Product Guide', frequency: '' }],
      cols: [F('activity', 'Activity', 'label'), F('sprint', 'Sprint'), F('contribution', 'Contribution', 'text', { w: 1.6 }), F('frequency', 'Frequency', 'text', { w: .9 }), F('outcome', 'Outcome', 'text', { w: 1.6 })] },
    status: { id: 'status', title: 'Periodic Status Reports',
      cols: [F('project', 'Project', 'text', { w: .9 }), F('epic', 'Epic'), F('feature', 'Feature', 'text', { w: 1.2 }), F('stories', '# Stories', 'num', { w: .6 }), F('outcome', 'Business outcome', 'text', { w: 1.5 }), F('measure', 'Measurement', 'text', { w: 1.5 })] },
    statusPO: { id: 'statusPO', title: 'Effective Reporting — Periodic Status Reports',
      cols: [F('report', 'Report', 'text', { w: 1.2 }), F('frequency', 'Frequency', 'select', { opts: ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'], w: .9 }), F('audience', 'Audience'), F('format', 'Format'), F('content', 'Key content', 'text', { w: 1.5 }), F('sent', 'Last sent', 'date')] },
    stories: { id: 'stories', title: 'Quality of User Stories',
      hint: 'Evaluation focus: user stories should be reviewed before Sprint Planning, and feedback incorporated to improve story readiness, clarity and development quality.',
      cols: [F('connected', 'Connected on', 'date'), F('sprint', 'Project / sprint'), F('review', 'Review date', 'date'), F('feedback', 'Manager feedback', 'text', { w: 1.6 }), F('action', 'Action taken / outcome', 'text', { w: 1.6 })] },
    prd: { id: 'prd', title: 'Quality of PRDs / Epics / User Stories',
      cols: [F('artifact', 'Artifact', 'text', { w: 1.4 }), F('cadence', 'Review cadence', 'select', { opts: ['Per release', 'Sprint-wise', 'Bi-weekly', 'Monthly'] }), F('reviewer', 'Reviewer'), F('check', 'Quality check', 'text', { w: 1.3 }), F('outcome', 'Outcome', 'text', { w: 1.2 }), F('last', 'Last reviewed', 'date')] },
    finance: { id: 'finance', special: 'finance', title: 'Financial Milestones (CoE billing plan)', hint: 'Numbers come from the uploaded financial figures, never typed in: the month’s forecast and actual for you.' },
    billability: { id: 'billability', title: 'Financial — Maintain Billability',
      cols: [F('period', 'Period'), F('project', 'Project name', 'text', { w: 1.3 }), F('billable', 'Billable', 'select', { opts: YN, w: .8 }), F('reason', 'Reason (if project change)', 'text', { w: 1.5 }), F('done', 'Successfully completed', 'select', { opts: YN, w: .9 })] },
    thanks: { id: 'thanks', title: 'Appreciated / Thanked a Team Member, Peer or Manager',
      cols: [F('who', 'Who'), F('date', 'Date', 'date'), F('what', 'What for', 'text', { w: 2 }), F('ref', 'Link or reference', 'url')] },
    thanksPhoto: { id: 'thanksPhoto', title: 'Appreciated / Thanked a Team Member, Peer or Reporting Manager', hint: 'A photo of the recognition moment, with the date and who was recognized.',
      cols: [F('who', 'Who'), F('date', 'Date', 'date'), F('what', 'What for', 'text', { w: 1.8 }), F('photo', 'Photo', 'photo')] },
    outing: { id: 'outing', title: 'Team Outing', hint: 'Add one photo per quarter as proof of the team outing, with the date and who attended.',
      cols: [F('date', 'Date', 'date'), F('occasion', 'Occasion'), F('who', 'Who attended', 'text', { w: 1.8 }), F('photo', 'Photo', 'photo')] },
    conv: { id: 'conv', special: 'conv', title: 'Monthly Goal Reviews' },
    quarters: { id: 'quarters', special: 'quarters', title: 'Quarterly Goal Reviews (this financial year)' },
    teamMonthly: { id: 'teamMonthly', special: 'teamMonthly', title: 'Monthly Reviews — Reporting Team' },
    teamQuarterly: { id: 'teamQuarterly', special: 'teamQuarterly', title: 'Quarterly Reviews — Reporting Team' },
    teambuild: { id: 'teambuild', title: 'Team Building Activities', hint: 'For example leading a Chai pe Charcha session.',
      cols: [F('date', 'Date', 'date'), F('activity', 'Activity', 'text', { w: 1.6 }), F('role', 'Led or joined', 'select', { opts: ['Led', 'Joined'], w: .8 }), F('note', 'Note', 'text', { w: 1.4 }), F('photo', 'Photo', 'photo')] },
    certs: { id: 'certs', title: 'Training & Certifications', hint: 'Evidence: certificate name, issuing body and completion date; attach the certificate or a link.',
      cols: [F('name', 'Certificate / training', 'text', { w: 1.8 }), F('body', 'Issuing body'), F('date', 'Completion date', 'date'), F('link', 'Certificate or link', 'url')] },
    teamTraining: { id: 'teamTraining', title: 'Reporting Team — Training & Certifications',
      cols: [F('member', 'Team member'), F('training', 'Training / certification', 'text', { w: 1.5 }), F('date', 'Completed', 'date'), F('evidence', 'Evidence', 'url'), F('status', 'Status', 'select', { opts: ['Completed', 'In progress', 'Planned'], w: .9 })] },
    cases: { id: 'cases', title: 'Case Studies / Product Launch Success Stories', hint: 'Evidence: the published story or launch, its customer or business outcome, your contribution and a link.',
      cols: [F('product', 'Project / product'), F('kind', 'Story type', 'select', { opts: ['Case study', 'Launch story'], w: .9 }), F('date', 'Launch / publish date', 'date'), F('outcome', 'Business / customer outcome', 'text', { w: 1.5 }), F('contribution', 'Your contribution', 'text', { w: 1.2 }), F('link', 'Evidence / link', 'url')] },
    gtm: { id: 'gtm', title: 'GTM Support', hint: 'Webinars, case studies, sales enablement, demos, blogs, product collateral or other market-facing content.',
      cols: [F('kind', 'Type', 'select', { opts: ['Webinar', 'Case study', 'Sales enablement', 'Demo', 'Blog', 'Collateral'] }), F('title', 'Title', 'text', { w: 1.6 }), F('date', 'Date', 'date'), F('link', 'Link', 'url')] },
    activities: { id: 'activities', title: 'Participation in Activities & Celebrations',
      cols: [F('date', 'Date', 'date'), F('activity', 'Activity / celebration', 'text', { w: 1.6 }), F('note', 'Note', 'text', { w: 1.4 }), F('photo', 'Photo', 'photo')] },
    townhall: { id: 'townhall', title: 'Townhall Recognitions', hint: 'Evidence: a screenshot or note from the townhall recognition, with the date and occasion.',
      cols: [F('date', 'Date', 'date'), F('occasion', 'Occasion'), F('note', 'Note', 'text', { w: 2 }), F('shot', 'Screenshot', 'photo')] },
    peerRecog: { id: 'peerRecog', title: 'Peer / Subordinate Recognitions',
      cols: [F('from', 'From'), F('date', 'Date', 'date'), F('note', 'Recognition note', 'text', { w: 2 })] },
    feedback: { id: 'feedback', title: '360° Feedback & Improvement Actions', hint: 'Evidence: a summary of feedback themes and the actions taken.',
      cols: [F('from', 'Feedback from', 'select', { opts: ['Self', 'Team', 'Practice', 'Peers', 'Managers'], w: .9 }), F('themes', 'Feedback themes', 'text', { w: 2 }), F('actions', 'Improvement actions taken', 'text', { w: 2 })] },
    improve: { id: 'improve', title: 'Product / Process Improvements', hint: 'Evidence: what changed, why, and the measurable effect (time saved, errors reduced, adoption).',
      cols: [F('what', 'What changed', 'text', { w: 1.5 }), F('why', 'Why', 'text', { w: 1.5 }), F('effect', 'Measurable effect', 'text', { w: 1.5 })] },
    ideas: { id: 'ideas', title: 'Idea Generation for Practice',
      cols: [F('idea', 'Idea', 'text', { w: 1.6 }), F('problem', 'Problem or opportunity', 'text', { w: 1.5 }), F('status', 'Status', 'select', { opts: ['Proposed', 'In progress', 'Adopted'], w: .9 })] },
    opps: { id: 'opps', title: 'Engage in New Opportunity', hint: 'Proposal creation and other new-business work.',
      cols: [F('opportunity', 'Opportunity', 'text', { w: 1.5 }), F('kind', 'Contribution', 'select', { opts: ['Proposal', 'Estimate', 'Demo', 'Discovery'] }), F('date', 'Date', 'date'), F('status', 'Status', 'select', { opts: ['Submitted', 'Won', 'Lost', 'In progress'], w: .9 })] },
    referrals: { id: 'referrals', title: 'Help in Hiring (Referrals)', hint: 'Evidence: the referrals made and their current status in the pipeline.',
      cols: [F('candidate', 'Candidate'), F('role', 'Role'), F('date', 'Referred on', 'date'), F('status', 'Pipeline status', 'select', { opts: ['Referred', 'Screening', 'Interviewing', 'Offered', 'Joined', 'Not taken forward'] })] },
    hiring: { id: 'hiring', title: 'Help in Hiring (Referrals 4 / Interviews 10)', hint: 'Referrals made and interviews taken this quarter.',
      cols: [F('kind', 'Referral or interview', 'select', { opts: ['Referral', 'Interview'], w: .9 }), F('candidate', 'Candidate'), F('role', 'Role'), F('date', 'Date', 'date'), F('status', 'Status', 'select', { opts: ['Referred', 'Interviewed', 'Offered', 'Joined', 'Not taken forward'] })] },
    linkedin: { id: 'linkedin', title: 'LinkedIn Posts / Reposts', hint: 'Evidence: links to the posts published.',
      cols: [F('kind', 'Post or repost', 'select', { opts: ['Post', 'Repost'], w: .9 }), F('date', 'Date', 'date'), F('topic', 'Topic', 'text', { w: 1.8 }), F('link', 'Link', 'url')] },
  };
  // the wins celebration photo sits with Win Together in every deck; it isn't a goal, so it isn't marked
  const WINS = { id: 'wins', title: 'Wins Celebration', detail: 'Wins celebration photo', hint: 'A photo from the team’s wins celebration. Not marked.',
    cols: [F('date', 'Date', 'date'), F('occasion', 'Occasion', 'text', { w: 2 }), F('photo', 'Photo', 'photo')] };
  const CAT = { got: 'Guardians of Trust', life: 'Life Positive', open: 'We are Open', win: 'Win Together', way: 'Way Finders' };
  const cat = (id, weight, goals, extra) => ({ id, name: CAT[id], weight, goals, extra });
  const V1 = (at) => [{ version: 1, at, note: 'From the Quarterly Goal Review deck' }];
  // the PO forms share Guardians of Trust and most of Way Finders
  const poTrust = () => cat('got', 52, [
    GG('Customer Satisfaction', 'Product Roadmap', 6, { form: FM.roadmap }),
    GG('Customer Satisfaction', 'Backlog Prioritization / Refinements / Grooming Session', 8, { form: FM.backlogPO }),
    GG('Customer Satisfaction', 'PI Planning / Sprint Planning / Retro Participation / Release / Product Guide', 6, { form: FM.ceremony }),
    GG('Product Expertise', 'PI Deck (Domain Knowledge)', 6, { form: FM.pideck }),
    GG('Product Expertise', 'PI Deck Presentation (Team, DPS, Sales, Marketing, Leadership)', 6, { form: FM.pipres }),
    GG('Product Expertise', 'Identified Risk / Corrective Actions / Dependencies', 6, { form: FM.risk }),
    GG('Effective Reporting', 'Periodic Status Reports', 4, { form: FM.statusPO }),
    GG('Financial', 'Maintain Billability', 10, { form: FM.billability })]);
  const poWin = () => cat('win', 8, [
    GG('Team’s Value / Culture', 'Participating in HR Activities & Celebrations', 2, { form: FM.activities }),
    GG('Team’s Value / Culture', 'Townhall Recognitions (1)', 2, { form: FM.townhall }),
    GG('Team’s Value / Culture', 'Peer / Subordinate Recognitions', 2, { form: FM.peerRecog }),
    GG('Team’s Value / Culture', '360° Feedback (self, team, practice, peers, managers) & Improvement Actions', 2, { form: FM.feedback })], WINS);
  const poWay = () => cat('way', 14, [
    GG('Scaled Growth Mindset', 'Idea Generation for Practice', 2, { form: FM.ideas }),
    GG('Scaled Growth Mindset', 'Product Improvements', 4, { form: FM.improve }),
    GG('Scaled Growth Mindset', 'Help in Hiring (Referrals 4 / Take Interviews 10)', 4, { form: FM.hiring }),
    GG('Scaled Growth Mindset', 'Engage in New Opportunity (Proposal Creation, etc.)', 2, { form: FM.opps }),
    GG('Scaled Growth Mindset', 'LinkedIn Posts / Repost', 2, { form: FM.linkedin })]);
  RM.GOALSHEETS = {
    'BA-SBA': { key: 'BA-SBA', name: 'BA & Sr BA template', short: 'BA & Sr BA', roles: ['BA', 'Senior BA'], version: 1, versions: V1('2024-04-01'), categories: [
      cat('got', 60, [
        GG('Product Expertise', 'PI Deck (Domain Knowledge)', 6, { form: FM.pideck }),
        GG('Product Expertise', 'PI deck presentation (Team, DPS, Sales, Marketing, Kapil)', 8, { form: FM.pipres }),
        GG('Customer Satisfaction', 'Identified risks / corrective actions / dependencies', 8, { form: FM.risk }),
        GG('Customer Satisfaction', 'Client / PO / stakeholder recognitions (2)', 4, { form: FM.recog }),
        GG('Customer Satisfaction', 'Backlog prioritization / refinements / grooming sessions', 12, { form: FM.backlogBA }),
        GG('Customer Satisfaction', 'PI planning / sprint planning / retro participation / release / product guide', 8, { form: FM.ceremony }),
        GG('Effective Reporting', 'Periodic status reports', 6, { form: FM.status }),
        GG('Quality of User Stories', 'Quality of user stories', 8, { form: FM.stories })]),
      cat('life', 20, [
        GG('Value Team', 'Appreciated / thanked team member / peer / reporting manager (4)', 4, { form: FM.thanks }),
        GG('Value Team', 'Team outing (being part of it) (4)', 4, { form: FM.outing }),
        GG('Value Team', 'Monthly status reviews', 6, { form: FM.conv }),
        GG('Value Team', 'Quarterly goal reviews (PPT)', 6, { monthly: false, form: FM.quarters })]),
      cat('open', 4, [
        GG('Training & Certifications', 'Certifications / training (Product management, Agile SAFe, User Design (UX), Process Excellence) (=>2)', 4, { form: FM.certs })]),
      cat('win', 6, [
        GG('Team’s Value / Culture', 'Townhall recognitions (1)', 2, { form: FM.townhall }),
        GG('Team’s Value / Culture', '360 degree feedback (self, team, practice, peers, managers) and activities for improvement (2)', 4, { form: FM.feedback })], WINS),
      cat('way', 10, [
        GG('Scaled Growth Mindset', 'Product / process improvements', 2, { form: FM.improve }),
        GG('Scaled Growth Mindset', 'Help in hiring (referrals) (4)', 4, { form: FM.referrals }),
        GG('Scaled Growth Mindset', 'LinkedIn posts / reposts', 4, { form: FM.linkedin })])] },
    PM: { key: 'PM', name: 'PM template', short: 'PM', roles: ['PM'], version: 1, versions: V1('2024-04-01'), categories: [
      cat('got', 61, [
        GG('Product Expertise', 'Product Roadmap / PI Deck (Market & Domain Knowledge)', 10, { form: { id: 'pmDeck', parts: [FM.roadmap, FM.pideck] } }),
        GG('Product Expertise', 'PI Deck Presentation (Team, DPS, Sales, Marketing, Leadership)', 10, { form: FM.pipres }),
        GG('Customer Satisfaction', 'Client / Stakeholder Recognitions (1)', 4, { form: FM.recogPM }),
        GG('Customer Satisfaction', 'Product Backlog Prioritization & Roadmap Alignment', 12, { form: FM.backlogPM }),
        GG('Customer Satisfaction', 'PI Planning / Sprint Planning / Retro', 6, { form: FM.ceremony }),
        GG('Customer Satisfaction', 'Identified Risk / Corrective Actions / Dependencies', 4, { form: FM.risk }),
        GG('Quality of Product Deliverables', 'Quality of Product Requirements (PRDs / Epics / User Stories)', 5, { form: FM.prd }),
        GG('Financial Milestones', 'Financial Milestones Completed as per CoE Plan', 10, { form: FM.finance })]),
      cat('life', 16, [
        GG('Value Team', 'Appreciated / Thanked Team Member, Peer or Reporting Manager (4)', 4, { form: FM.thanksPhoto }),
        GG('Value Team', 'Conduct Team Outing (4)', 2, { form: FM.outing }),
        GG('Value Team', 'Monthly Status Reviews', 3, { form: FM.conv }),
        GG('Value Team', 'Quarterly Goal Reviews', 3, { monthly: false, form: FM.quarters }),
        GG('Value Team', 'Monthly Status Reviews – Reporting Team Member', 2, { form: FM.teamMonthly }),
        GG('Value Team', 'Quarterly Goal Reviews – Reporting Team Member', 2, { monthly: false, form: FM.teamQuarterly })]),
      cat('open', 10, [
        GG('Training & Certifications', 'Certifications / Training (Product Mgmt, Agile/SAFe, UX Design, Data Analytics, Process Excellence) =>2', 4, { form: FM.certs }),
        GG('Training & Certifications', 'Training Completed by Team', 2, { form: FM.teamTraining }),
        GG('Ready to Market', 'Case Studies / Product Launch Success Stories', 4, { form: FM.cases })]),
      cat('win', 6, [
        GG('Team’s Value / Culture', 'Participating in Goal Sessions, Activities & Celebrations', 2, { form: FM.activities }),
        GG('Team’s Value / Culture', 'Townhall Recognitions (1)', 2, { form: FM.townhall }),
        GG('Team’s Value / Culture', '360° Feedback (self, team, practice, peers, managers) & Improvement Actions', 2, { form: FM.feedback })], WINS),
      cat('way', 7, [
        GG('Scaled Growth Mindset', 'Product / Process Improvements', 3, { form: FM.improve }),
        GG('Scaled Growth Mindset', 'Help in Hiring (Referrals) – 4', 2, { form: FM.referrals }),
        GG('Scaled Growth Mindset', 'LinkedIn Posts / Repost', 2, { form: FM.linkedin })])] },
    PO: { key: 'PO', name: 'PO template · without direct reportees', short: 'PO', roles: ['PO'], version: 1, versions: V1('2024-04-01'), categories: [
      poTrust(),
      cat('life', 18, [
        GG('Value Team', 'Appreciated / Thanked Team / Peer Member & Manager (4)', 4, { form: FM.thanksPhoto }),
        GG('Value Team', 'Conduct Team Outing (4)', 4, { form: FM.outing }),
        GG('Value Team', 'Monthly Status Reviews', 4, { form: FM.conv }),
        GG('Value Team', 'Quarterly Goal Reviews', 4, { monthly: false, form: FM.quarters }),
        GG('Value Team', 'Team Building Activities (e.g. leading Chai pe Charcha)', 2, { form: FM.teambuild })]),
      cat('open', 8, [
        GG('Training & Certifications', 'Certifications (Product management, Agile SAFe, User Design (UX), Process Excellence) =>2', 4, { form: FM.certs }),
        GG('Ready to Market', 'GTM Support (webinars, case studies, sales enablement, demos, blogs, product collateral, market-facing content)', 4, { form: FM.gtm })]),
      poWin(), poWay()] },
    'PO-R': { key: 'PO-R', name: 'PO template · with direct reportees', short: 'PO with reportees', roles: ['PO'], version: 1, versions: V1('2024-04-01'), categories: [
      poTrust(),
      cat('life', 20, [
        GG('Value Team', 'Appreciated / Thanked Team / Peer Member & Manager (4)', 4, { form: FM.thanksPhoto }),
        GG('Value Team', 'Conduct Team Outing (4)', 4, { form: FM.outing }),
        GG('Value Team', 'Monthly Status Reviews', 2, { form: FM.conv }),
        GG('Value Team', 'Quarterly Goal Reviews', 2, { monthly: false, form: FM.quarters }),
        GG('Value Team', 'Monthly Status Reviews – Reporting Team Member', 4, { form: FM.teamMonthly }),
        GG('Value Team', 'Quarterly Goal Reviews – Reporting Team Member', 4, { monthly: false, form: FM.teamQuarterly })]),
      cat('open', 6, [
        GG('Training & Certifications', 'Certifications (Product Management, Agile/SAFe, UX, Process Excellence) =>2', 4, { form: FM.certs }),
        GG('Ready to Market', 'GTM Support (webinars, case studies, sales enablement, demos, blogs, collateral)', 2, { form: FM.gtm })]),
      poWin(), poWay()] },
  };
  // templates the PRD names whose content isn't confirmed yet: no form is created from them
  RM.PENDING_TEMPLATES = [{ name: 'UX', note: 'For UX Lead, UX Designer and Designer, once their role mapping is confirmed' }, { name: 'Consultant', note: 'Contractors aren’t in reviews until this is confirmed' }];
  // flat goal list with numbers and their category, and every evidence form by id
  Object.values(RM.GOALSHEETS).forEach((s) => {
    let n = 0; s.goals = []; s.forms = {};
    s.categories.forEach((c) => {
      c.goals.forEach((g) => { g.n = ++n; g.cat = c.id; g.i = n - 1; s.goals.push(g); if (g.form) (g.form.variants || g.form.parts || [g.form]).forEach((f) => { s.forms[f.id] = f; }); });
      if (c.extra) s.forms[c.extra.id] = c.extra;
    });
    s.total = s.goals.reduce((a, g) => a + g.weight, 0);
  });

  /* ---------- months and the financial year (April to March) ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  RM.MONTHS = MONTHS;
  // a month's financial year and quarter ('2026-08' -> FY 2026–27, Q2, month 2 of 3); quarters and their records live in review.js
  const fyOf = (y, m) => { const s = m >= 4 ? y : y - 1; return { fy: `${s}–${String(s + 1).slice(2)}`, label: `FY ${s}–${String(s + 1).slice(2)}`, fq: 'Q' + (Math.floor(((m + 8) % 12) / 3) + 1), pos: ((m + 8) % 12) % 3 + 1 }; };
  RM.fyOfMonth = (key) => { const [y, m] = key.split('-').map(Number); return fyOf(y, m); };
  RM.FIN_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

  /* ---------- sample note templates ---------- */
  const SELF_NOTES = [
    'Closed the analysis for the onboarding epic a sprint early and ran two walkthroughs with the client team. Documentation slipped once during the release crunch; I have set a same-day notes habit since.',
    'Most stories were accepted on first pass. I want to get sharper at edge-case acceptance criteria. Two stories came back for missing negative paths.',
    'Took ownership of the reporting module backlog and kept it groomed two sprints ahead. Stakeholder updates were consistent; one workshop needed a follow-up session.',
    'Delivered the milestones committed for the period and kept 1:1s with everyone on the team. Client reporting moved to a weekly written digest which was well received.',
  ];
  const MGR_NOTES = [
    'Strong period. The early epic analysis gave the team real runway. Keep pushing on negative-path acceptance criteria; that is the gap between good and excellent here.',
    'Reliable delivery and clear communication with stakeholders. Next focus: lead one domain walkthrough end to end rather than co-presenting.',
    'Good ownership of the backlog. Documentation timeliness needs to hold during release weeks, not just steady-state sprints.',
    'Solid quarter. Team health visibly improved; client reporting cadence is now a model for other pods.',
  ];


  /* ---------- helpers ---------- */
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
  RM.addDays = addDays;
  const iso = (d) => d.toISOString();

  // the review template someone fills in this month: their current form's (review.js), or their role's default
  RM.formsLabel = (p) => { const RV = RM.RV; if (!RV || !RV.inCycles(p)) return 'Not in reviews'; const f = RV.curForm(p.id); return RV.templateName(f ? RV.templateAt(f, RV.curMonth()) : RV.templateFor(p)); };

  // eligibility (RV-03): active employees whose platform role has a template; not the Practice Head, not contractors,
  // and not Mapping pending (they are listed for Admin instead of getting a default form)
  function isEligible(p) { return p.status === 'Active' && !p.contractor && !!RM.ROLE_TEMPLATE[p.role] && !p.mapPending; }
  RM.isEligible = isEligible;

  /* ---------- sample entries: the monthly review and evidence, and the quarterly notes ---------- */
  const GS_COMMENTS = [
    'Book the Sales and Marketing slot now; the PI window is tight.',
    'Add the mitigation owner for each open risk.',
    'No posts again this month. One learning post from the project would do it.',
    'Good grooming rhythm. Keep two sprints ready.',
    'Status reports went out late twice. Same day as the review, please.',
  ];
  const GS_VALUE_ADDS = [
    { title: 'Story template with acceptance-criteria checklist', note: 'Adopted by the team in Aug; cut story rework in grooming.' },
    { title: 'Weekly release-notes digest for the client', note: 'One page the PO now forwards to stakeholders.' },
    { title: 'Onboarding walkthrough for two new BAs', note: 'Recorded session, now in the team wiki.' },
  ];
  // the project and sprint a month's sample entries talk about (PI numbers run on from Feb 2024)
  const ctxOf = (mk, p) => {
    const [y, mo] = mk.split('-').map(Number); const k = Math.max(0, (y - 2024) * 12 + mo - 2); const pi = 15 + Math.floor(k / 3); const sp = (k % 3) * 2 + 1;
    const deloitte = p.alloc === 'Deloitte';
    return { y, mo, M: MONTHS[mo - 1], pi, s1: `${pi}.${sp}`, s2: `${pi}.${sp + 1}`, deloitte, proj: deloitte ? 'Omnia Data' : p.alloc === 'Internal' ? 'RMG Internal Portal' : p.alloc + ' portal',
      day: (d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
  };
  const FEATURES = { deloitte: ['localization of screens and data input forms', 'data validation improvements', 'workflow improvements', 'the DC Preview export'], other: ['self-serve sign-up and verification', 'the monthly summary export', 'workflow improvements', 'role-based access'] };
  // the monthly review, by template: the employee's progress and the manager's feedback (date and status come from review.js)
  function checkin(key, mk, p, rr) {
    const c = ctxOf(mk, p); const pick = (a) => a[Math.floor(rr() * a.length)]; const fs = FEATURES[c.deloitte ? 'deloitte' : 'other'];
    const f1 = pick(fs); const f2 = pick(fs.filter((x) => x !== f1));
    const WORK = {
      'BA-SBA': [`Wrote and refined the stories for ${f1} on ${c.proj}; grooming twice a week with the PO kept sprints ${c.s1} and ${c.s2} ready.`, `Closed the requirements for ${f1} and ran two walkthroughs with the client team. Reworked acceptance criteria after QA feedback.`, `Kept the ${c.proj} backlog two sprints ready and supported acceptance for ${f2}. Status reports went out each sprint.`],
      PO: [`Prioritised the ${c.proj} backlog for sprints ${c.s1} and ${c.s2} and agreed two scope changes with the client.`, `Ran refinement with the delivery team for ${f1}; cleared the open dependencies before PI ${c.pi} planning.`, `Accepted ${f1} in the sprint review and published the roadmap update for ${c.M}.`],
      PM: [`Steered PI ${c.pi} work on ${c.proj}: roadmap Now and Next refreshed with the client, ${f1} on track.`, `Reviewed the team’s forecasts against the CoE billing plan; one milestone moved a week after a client dependency.`, `Held 1:1s with the team, ran the monthly reviews and unblocked ${f2} with the client’s data team.`],
    };
    const ACH = ['Stories accepted first pass in both sprints.', 'The client PO thanked the team for a clear sprint demo.', `Release for ${f1} went out on the committed date.`, 'Rework in grooming down to one story a sprint.', 'Two open risks closed before planning.'];
    const CH = ['Design sign-off for two stories is late; following up with the UX lead.', 'Client data access is still pending; raised through the PO.', 'Release week squeezed documentation time.', 'None this month.'];
    const FB = ['Good month. Keep sharing acceptance-criteria drafts two days before grooming.', 'Solid progress. Next month, own the demo end to end.', 'Status reports went out late twice; send them the same day as the review.', 'Strong backlog hygiene. Add an owner to every open risk.', 'Clear updates to the client this month. Write up the scope change as a short decision note.'];
    const FU = ['Share the PI deck draft by the 20th.', 'Book a Sales slot for the PI deck presentation.', 'Pick a certification for the quarter.', 'Close the two open risks on ADO.', 'Pair with a peer on the next refinement session.'];
    const wk = WORK[key === 'PO-R' ? 'PO' : key] || WORK['BA-SBA'];
    return {
      emp: { work: pick(wk), achievements: rr() < 0.8 ? pick(ACH) : '', projects: `${c.proj}: ${f1}; ${f2}`, challenges: pick(CH), ppt: `https://newvision.sharepoint.com/sites/dps/monthly-reviews/${p.id.toLowerCase()}-${mk}.pptx` },
      mgr: { feedback: pick(FB), followups: pick(FU) },
    };
  }
  // a month's evidence for the template's forms, from the decks' sample entries: the regular forms every month, the
  // occasional ones only some months
  function seedEvidence(sheet, mk, p, rr) {
    const c = ctxOf(mk, p); const { M, pi, s1, s2, deloitte, proj, day } = c; const mo = c.mo;
    const pick = (a) => a[Math.floor(rr() * a.length)]; const some = (pct) => rr() < pct; const has = (id) => !!sheet.forms[id];
    const nm = (x) => x.name.split(' ').slice(0, 2).join(' ');
    const peers = PEOPLE.filter((x) => x.id !== p.id && (x.rm === p.rm || x.id === p.rm)).map(nm);
    const team = PEOPLE.filter((x) => x.rm === p.id).map(nm);
    const ev = {};
    const backlog = () => [
      { sprint: 'Sprint ' + s1, timeline: `3 – 14 ${M}`, prioritized: 'Yes', refinement: 'Completed', grooming: 'Completed', readiness: 'Ready', challenge: '' },
      { sprint: 'Sprint ' + s2, timeline: `17 – 28 ${M}`, prioritized: 'Yes', refinement: 'Completed', grooming: some(0.7) ? 'Completed' : 'In progress', readiness: some(0.75) ? 'Ready' : 'Partly ready', challenge: pick(['', 'Two stories waiting on design sign-off', 'PO on leave for refinement; covered async']) }];
    ['backlogBA', 'backlogPM', 'backlogPO'].forEach((id) => { if (has(id)) ev[id] = backlog(); });
    if (has('ceremony')) ev.ceremony = [
      mo % 3 === 2 ? { sprint: `PI ${pi}`, contribution: 'Prepared priorities, dependencies and scope inputs', outcome: 'Improved alignment on upcoming work' } : {},
      { sprint: `${s1}, ${s2}`, contribution: 'Validated story readiness and priorities', outcome: 'Clear sprint commitment' },
      { sprint: s1, contribution: 'Raised process improvements and action items', outcome: 'Actions tracked for continuous improvement' },
      { sprint: s2, contribution: 'Supported acceptance and dependency checks', outcome: 'Reduced last-minute ambiguity' },
      { sprint: 'NA' }];
    if (has('roadmap') && some(0.8)) ev.roadmap = [deloitte
      ? { now: 'Localization of DC Summary and Preview; validation defect backlog', next: 'Data-check integrations with the audit suite; SSO for client admins', later: 'AI-assisted data checks; self-serve onboarding' }
      : { now: 'Self-serve sign-up and verification; critical client fixes', next: 'Reporting export API; role-based access', later: 'Usage analytics; AI-assisted request triage' }];
    if (has('status')) ev.status = (deloitte ? [
      { project: proj, epic: 'Omnia – Localization & Translation', feature: 'Localization of screens & data input forms', stories: '3', outcome: 'Enables multi-language support across reports, screens and data checks', measure: 'Successful localization of DC Summary, Preview & DC Preview' },
      { project: proj, epic: 'Omnia – Validation', feature: 'Data validation improvements', stories: '4', outcome: 'Improves confidence in data quality before downstream use', measure: 'Validation defects down from 9 to 3 this month' },
      { project: proj, epic: 'Omnia – UX', feature: 'Workflow improvements', stories: '5', outcome: 'Simplifies user workflow and reduces manual clarification', measure: 'Clarification calls down from 6 to 2 a sprint' }] : [
      { project: proj, epic: 'Onboarding', feature: 'Self-serve sign-up and verification', stories: '4', outcome: 'New users onboard without a support call', measure: 'Sign-up support tickets down 30%' },
      { project: proj, epic: 'Reporting', feature: 'Monthly summary export', stories: '3', outcome: 'Stakeholders get the month’s numbers in one file', measure: 'Export used by three teams' },
      { project: proj, epic: 'UX', feature: 'Workflow improvements', stories: '2', outcome: 'Fewer steps to finish a request', measure: 'Steps per request down from 7 to 4' }]).slice(0, 2 + Math.floor(rr() * 2));
    if (has('statusPO')) ev.statusPO = [
      { report: 'Sprint status report', frequency: 'Bi-weekly', audience: 'Client PO and delivery team', format: 'Email + Confluence', content: 'Burn-up, scope changes, open risks', sent: day(26) },
      { report: 'Monthly steering update', frequency: 'Monthly', audience: deloitte ? 'Deloitte engagement leads' : 'Client leadership', format: 'PPT', content: 'Outcomes, roadmap, decisions needed', sent: day(28) }];
    if (has('stories')) ev.stories = [
      { connected: day(6), sprint: `${proj} / Sprint ${s1}`, review: day(7), feedback: pick(['Split the export story; the AC is too broad', 'Add negative scenarios to the AC', 'Clear AC and test notes']), action: pick(['Split into two stories, both ready for planning', 'Added four negative scenarios; accepted in grooming', 'No change needed']) },
      { connected: day(20), sprint: `${proj} / Sprint ${s2}`, review: day(21), feedback: pick(['Link the design and data mapping', 'Good: dependencies called out up front']), action: pick(['Linked the design and mapping sheet before planning', 'Kept as the team’s example story']) }];
    if (has('prd')) ev.prd = [
      { artifact: `PRD: ${pick(FEATURES[deloitte ? 'deloitte' : 'other'])}`, cadence: 'Per release', reviewer: 'Practice Head', check: 'AC complete, NFRs and analytics events listed', outcome: 'Approved for build', last: day(14) },
      { artifact: `Epics for PI ${pi + 1}`, cadence: 'Sprint-wise', reviewer: 'Delivery leads', check: 'Sized, dependencies mapped', outcome: pick(['Ready for PI planning', 'Two epics split before planning']), last: day(22) }];
    if (has('billability')) ev.billability = [{ period: `${M} ${c.y}`, project: proj, billable: ['Internal', '–'].includes(p.alloc) ? 'No' : 'Yes', reason: '', done: 'Yes' }];
    if (has('riskD')) {
      if (deloitte) ev.riskD = [
        { sprint: `PI Planning / PI ${pi}`, risk: 'Upstream data dependency for validation', ado: `https://dev.azure.com/omnia/_workitems/edit/${48100 + mo * 7}`, owner: `Data team · 12 ${M}`, action: 'Align with owning team and track completion', status: some(0.6) ? 'Closed' : 'Open' },
        { sprint: `PI Planning / PI ${pi}`, risk: 'Design confirmation required before development', ado: `https://dev.azure.com/omnia/_workitems/edit/${48102 + mo * 7}`, owner: `UX lead · 0${4 + (mo % 5)} ${M}`, action: 'Obtain confirmation and update US / AC', status: 'Closed' },
        { sprint: 'Sprint ' + s2, risk: 'Potential delivery risk identified during execution', ado: `https://dev.azure.com/omnia/_workitems/edit/${48105 + mo * 7}`, owner: `PO · 26 ${M}`, action: 'Assess impact and agree mitigation', status: 'Open' }].slice(0, 2 + Math.floor(rr() * 2));
      else if (p.alloc === 'Internal') ev.riskI = [
        { project: `${proj} / ${M}`, risk: 'Data needed from another internal team', impact: 'Delivery delay', action: 'Agree an owner and target date with that team', evidence: 'Email / meeting notes / tracker', status: some(0.6) ? 'Closed' : 'Open' },
        { project: `${proj} / ${M}`, risk: 'Design sign-off pending from the UX lead', impact: 'Rework risk', action: 'Share the design and capture the decision', evidence: 'Approval / notes', status: 'Closed' },
        { project: `${proj} / ${M}`, risk: 'Business confirmation needed on US / AC', impact: 'Story not development-ready', action: 'Clarify with the product owner and update US / AC', evidence: 'US / meeting notes', status: 'Open' }].slice(0, 2 + Math.floor(rr() * 2));
      else ev.riskN = [
        { project: `${proj} / ${M}`, risk: 'Client data required for analysis / validation', impact: 'Delivery delay', action: 'Raise with client; agree owner and target date', evidence: 'Email / meeting notes / tracker', status: some(0.6) ? 'Closed' : 'Open' },
        { project: `${proj} / ${M}`, risk: 'Client confirmation required on UI / design', impact: 'Rework risk', action: 'Share design and capture approval / decision', evidence: 'Client approval / notes', status: 'Closed' },
        { project: `${proj} / ${M}`, risk: 'Business confirmation needed on US / AC', impact: 'Story not development-ready', action: 'Clarify with client / PO and update US / AC', evidence: 'US / meeting notes', status: 'Open' }].slice(0, 2 + Math.floor(rr() * 2));
    }
    if (has('pideck') && some(0.6)) ev.pideck = [{ project: proj, domain: deloitte ? 'Audit data & analytics' : pick(['Fintech', 'Logistics', 'HR tech']), topic: `PI ${pi + 1} scope and domain walkthrough`, date: day(18), audience: 'Team and PO', link: `https://newvision.sharepoint.com/sites/dps/pi-${pi + 1}-deck` }];
    if (has('pipres') && some(0.5)) ev.pipres = [{ date: day(21), topic: `PI ${pi} deck: ${proj} highlights`, audience: pick(['DPS', 'Sales', 'Marketing', 'Leadership']), outcome: pick(['Sales reused two slides in a pitch', 'Asked to present again at the DPS townhall', 'Leadership asked for a quarterly version']) }];
    if (has('recog') && some(0.25)) ev.recog = [{ from: deloitte ? 'Deloitte PO' : 'Client product owner', date: day(16), context: `Sprint ${s1} review`, what: 'Clear acceptance criteria that let the team demo without rework', impact: 'Release accepted in the review, no follow-up sprint needed' }];
    if (has('recogPM') && some(0.3)) ev.recogPM = [{ by: deloitte ? 'Deloitte engagement lead' : 'Client sponsor', occasion: `PI ${pi} demo`, evidence: 'Email to the practice: the clearest PI demo this year' }];
    const thank = () => ({ who: pick(peers.length ? peers : ['A peer']), date: day(9), what: pick(['Covered my grooming session while I was on leave', 'Helped untangle the data mapping before planning', 'Quick turnaround on the design review']) });
    if (has('thanks') && some(0.8)) ev.thanks = [Object.assign(thank(), { ref: '' })];
    if (has('thanksPhoto') && some(0.8)) ev.thanksPhoto = [thank()];
    if (has('outing') && some(0.3)) ev.outing = [{ date: day(23), occasion: pick(['Team lunch', 'Monsoon trek', 'Bowling night', 'Quarter-end dinner']), who: 'The whole team' }];
    if (has('teambuild') && some(0.3)) ev.teambuild = [{ date: day(15), activity: pick(['Led a Chai pe Charcha on writing good stories', 'Ran a Friday product quiz', 'Organised a lunch-and-learn on SAFe']), role: 'Led', note: pick(['Twelve people joined', 'Now a monthly slot', 'Recorded for the wiki']) }];
    if (has('certs') && some(0.2)) { const x = pick([['Certified Scrum Product Owner (CSPO)', 'Scrum Alliance'], ['SAFe 6 POPM', 'Scaled Agile'], ['Google UX Design Certificate', 'Google / Coursera'], ['Lean Six Sigma Yellow Belt', 'IASSC']]); ev.certs = [{ name: x[0], body: x[1], date: day(26), link: '' }]; }
    if (has('teamTraining') && team.length && some(0.35)) ev.teamTraining = [{ member: pick(team), training: pick(['SAFe 6 POPM', 'CSPO', 'Google UX Design Certificate', 'SQL for analysts']), date: day(20), evidence: '', status: pick(['Completed', 'In progress']) }];
    if (has('cases') && some(0.15)) ev.cases = [{ product: proj, kind: pick(['Case study', 'Launch story']), date: day(24), outcome: pick(['Onboarding time down from 3 days to 1', 'Validation defects down 60% across two releases']), contribution: 'Wrote the story and gathered the numbers', link: '' }];
    if (has('gtm') && some(0.25)) ev.gtm = [{ kind: pick(['Webinar', 'Case study', 'Demo', 'Blog']), title: pick([`How ${proj} cut validation rework`, 'Running PI planning with a distributed team', 'A product owner’s checklist for release readiness']), date: day(25), link: '' }];
    if (has('activities') && some(0.45)) ev.activities = [{ date: day(12), activity: pick(['Goal-setting session', 'Sports day', 'Founders’ day quiz', 'Festival celebration']), note: pick(['Joined the quiz team', 'Helped organise', 'Took part with the team']) }];
    if (has('townhall') && some(0.12)) ev.townhall = [{ date: day(28), occasion: `${M} townhall`, note: 'Called out in the delivery shout-outs for the client release' }];
    if (has('peerRecog') && some(0.3)) ev.peerRecog = [{ from: pick(peers.length ? peers : ['A peer']), date: day(17), note: pick(['Thanks for covering the steering update', 'Great help unblocking the data team']) }];
    if (has('feedback') && some(0.25)) ev.feedback = [{ from: pick(['Peers', 'Team', 'Managers']), themes: pick(['Wants earlier visibility of scope changes', 'Clear stories; could share AC sooner']), actions: pick(['Started a weekly scope note to the team', 'AC drafts now shared two days before grooming']) }];
    if (has('improve') && some(0.45)) ev.improve = [pick([{ what: 'Added an AC checklist to the story template', why: 'Stories came back from grooming for missing cases', effect: 'Rework in grooming down from 5 stories to 1 a sprint' },
      { what: 'Moved status reports to a shared tracker', why: 'Reports were copied by hand each week', effect: 'About 2 hours saved a week' }])];
    if (has('ideas') && some(0.2)) ev.ideas = [{ idea: pick(['A shared library of acceptance-criteria patterns', 'A practice-wide release-readiness checklist']), problem: 'Each team reinvents the same artefacts', status: pick(['Proposed', 'In progress']) }];
    if (has('opps') && some(0.15)) ev.opps = [{ opportunity: pick(['Claims analytics MVP', 'Learning portal revamp']), kind: pick(['Proposal', 'Estimate', 'Demo']), date: day(19), status: pick(['Submitted', 'In progress']) }];
    if (has('referrals') && some(0.3)) ev.referrals = [{ candidate: pick(['Ritika Sharma', 'Aman Verma', 'Neha Patil']), role: pick(['Business Analyst', 'QA Engineer', 'UX Designer']), date: day(11), status: pick(['Referred', 'Screening', 'Interviewing']) }];
    if (has('hiring') && some(0.4)) ev.hiring = [{ kind: pick(['Referral', 'Interview']), candidate: pick(['Ritika Sharma', 'Aman Verma', 'Neha Patil', 'Karan Joshi']), role: pick(['Product Owner', 'Business Analyst']), date: day(13), status: pick(['Referred', 'Interviewed', 'Offered']) }];
    if (has('linkedin') && some(0.55)) ev.linkedin = [{ kind: pick(['Post', 'Repost']), date: day(19), topic: pick(['What a good acceptance criterion looks like', 'Our team’s PI planning in three photos', 'New Vision is hiring BAs']), link: 'https://www.linkedin.com/feed/' }];
    if (has('wins') && some(0.2)) ev.wins = [{ date: day(27), occasion: pick([`${proj} release go-live`, 'Client renewal', `PI ${pi} demo`]) }];
    return ev;
  }
  // a quarter's marks out of: every goal's weight, less the yearly goals outside Q4 (none today)
  RM.gsQuarterMax = (sheet, q4) => sheet.goals.reduce((a, g) => a + (g.yearly && !q4 ? 0 : g.weight), 0);
  RM.gsBlankRow = (row) => !row || Object.keys(row).every((k) => row[k] == null || String(row[k]).trim() === '');
  RM.SAMPLE = { seedEvidence, checkin, SELF_NOTES, MGR_NOTES, GS_COMMENTS, GS_VALUE_ADDS };


  /* ---------- seed the database ---------- */
  function seed() {
    const people = PEOPLE.map((p) => Object.assign({}, p, { email: p.email ? p.email + '@' + RM.DOMAIN : emailFor(p.name) }));
    const admin = Object.assign({}, ADMIN, { email: 'imran.qureshi@' + RM.DOMAIN });
    // Rehan fills in the PM review form while he covers PM duties (his designation's own is the PO form)
    const overrides = {
      'NVS00957': { template: 'PM', reason: 'Covering PM duties on the Deloitte claims account until March 2027', by: 'ADM-0001', at: iso(new Date(2026, 5, 18, 11, 5)) },
    };

    /* financials: billable when allocated to a client (anything but Internal or none). Admin uploads each month's billability,
     * forecast and actual per person; there are no per-person goals and no locks. Sep's actuals were uploaded on the morning of 1 Oct, so every month to Sep is in.
     * An actual is never more than its forecast. */
    const fin = {};
    const RATE = { 'PM': 520000, 'PO': 460000, 'Senior BA': 405000, 'BA': 320000 };
    // the sample year is a pessimistic one: actuals land under their forecast, so most clusters will miss their target. Prakhar's
    // cluster is the optimistic exception: its actuals come in at or near the forecast
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    const inCluster = (p, lead) => { let x = p; while (x) { if (x.id === lead) return true; x = byId[x.rm]; } return false; };
    people.forEach((p) => {
      const upbeat = inCluster(p, 'NVS00212');
      const billable = !['Internal', '–'].includes(p.alloc); const joined = new Date(p.joined);
      fin[p.id] = {};
      RM.FIN_MONTHS.forEach((mk) => {
        const r = rng('fin:' + p.id + mk);
        const [y, m] = mk.split('-').map(Number); const before = new Date(y, m, 0) < joined; // nothing billed before they joined
        if (!billable || before) { fin[p.id][mk] = { billable: false, forecast: 0, actual: 0 }; return; }
        let rate = RATE[p.role] || 380000; if (p.designation === 'Senior Manager') rate = 610000; if (/Design|UX/.test(p.designation)) rate = 300000;
        const base = Math.round(rate / 1000) * 1000;
        const forecast = Math.round(base * (0.93 + r() * 0.1) / 1000) * 1000;
        const actual = Math.min(forecast, Math.round(forecast * (upbeat ? 0.975 + r() * 0.08 : 0.85 + r() * 0.15) / 1000) * 1000); // never more than the forecast
        fin[p.id][mk] = { billable: true, forecast, actual };
      });
    });
    const uploadedIn = (mk) => Object.values(fin).filter((f) => f[mk] && f[mk].billable && f[mk].actual != null).length;
    // yearly revenue targets (₹, April to March): only the people the employee sheet gives a financial target, and never the practice
    const targets = { NVS00212: 17000000, NVS00207: 6500000, NVS00247: 27000000, NVS01119: 23000000, NVS00984: 42000000, NVS00712: 9200000 };

    const config = {
      appraisalLeadDays: 30,
      reminderEvery: 3,
      mappings: [
        { designation: 'Product Manager', role: 'PM', confirmed: true },
        { designation: 'Senior Manager', role: 'PM', confirmed: true },
        { designation: 'Product Owner', role: 'PO', confirmed: true },
        { designation: 'Senior Business Analyst', role: 'Senior BA', confirmed: true },
        { designation: 'Business Analyst', role: 'BA', confirmed: true },
        { designation: 'Junior Business Analyst', role: 'BA', confirmed: true },
        { designation: 'Trainee Business Analyst', role: 'BA', confirmed: true },
        { designation: 'UX Lead', role: 'PM', confirmed: false },
        { designation: 'UX Designer', role: 'BA', confirmed: false },
        { designation: 'Designer', role: 'BA', confirmed: false },
        { designation: 'Consultant', role: '–', confirmed: false, note: 'Contractor (NVC), outside review cycles' },
      ],
    };

    /* the initiatives to close the gap (Target Gap Drill Down and Initiatives): the Practice Head's, for the practice or a cluster, and the cluster
     * heads' ideas for their own clusters (status Idea until the Practice Head takes one up). impact: rupees added by March */
    const $k = (usd) => Math.round(usd * RM.FX_USD);
    const gapItems = [
      { id: 'GI-1', scope: 'practice', title: 'Speed up TA for open profiles', note: 'Weekly syncs with TA and a referral bonus, so the open BA and PO profiles are filled and billing from November.', impact: $k(14000), status: 'In progress', by: 'NVS00697', at: iso(new Date(2026, 8, 28, 10, 30)) },
      { id: 'GI-2', scope: 'practice', title: 'Push allocation for benched resources to billable projects', note: 'Move the people on bench and internal work onto open client seats from November.', impact: $k(9000), status: 'Planned', by: 'NVS00697', at: iso(new Date(2026, 8, 28, 10, 45)) },
      { id: 'GI-3', scope: 'NVS00984', title: 'Revise rates at the Deloitte renewal', note: 'A 4% rise from January on the claims and portal work.', impact: $k(8000), status: 'Planned', by: 'NVS00697', at: iso(new Date(2026, 8, 29, 15, 10)) },
      { id: 'GI-4', scope: 'NVS00247', title: 'Extend the claims backlog engagement through March', note: 'Deloitte has asked for two more sprints of backlog work.', impact: $k(12000), status: 'In progress', by: 'NVS00697', at: iso(new Date(2026, 8, 29, 15, 25)) },
      { id: 'GI-5', scope: 'NVS00984', title: 'Pitch a second pod for the E&Y pilot', note: 'We hear back by mid-October.', impact: $k(18000), status: 'Idea', by: 'NVS00984', at: iso(new Date(2026, 8, 30, 11, 5)) },
      { id: 'GI-6', scope: 'NVS01119', title: 'Convert the RSM pilot into a paid phase', note: 'The client liked the pilot; a paid phase could start in December.', impact: $k(10000), status: 'Idea', by: 'NVS01119', at: iso(new Date(2026, 8, 26, 18, 40)) },
      { id: 'GI-7', scope: 'NVS00712', title: 'Move an internal designer onto the Deloitte UX seat', note: 'From November, once the seat is confirmed.', impact: $k(6000), status: 'Idea', by: 'NVS00712', at: iso(new Date(2026, 9, 1, 9, 15)) },
    ];
    const db = { v: 29, people, admin, overrides, fin, targets, gapItems, audit: [], config, reads: {} };
    // the review module: running review forms (one per review year), quarterly goal sheets (each person's own quarters,
    // from their joining date) and the reports
    RM.RV.seed(db);
    const RV = RM.RV;
    const person = (id) => db.people.find((p) => p.id === id);
    const yogi = db.appraisals.find((a) => a.emp === 'NVS00822' && a.cycle === 4);
    const tejas = db.appraisals.filter((a) => a.emp === 'NVS01650' && a.status === 'Generated').pop();
    const kf = Object.values(db.forms).find((f) => f.emp === 'NVS01478' && f.fieldLog.some((e) => e.section === 'reportees')); const kopal = kf && kf.fieldLog.find((e) => e.section === 'reportees');
    const tf = Object.values(db.forms).filter((f) => f.emp === 'NVS01650').sort((x, y) => x.start.localeCompare(y.start));
    // quarters follow each person's joining date, and marks open in a quarter's last month: the ones ending on 31 Oct opened on 1 Oct
    const opened = db.quarters.filter((r) => RV.quarter(r.key).months[2] === '2026-10').length;
    const sepGaps = Object.values(db.forms).filter((f) => f.gaps['2026-09']).length;
    const asked = db.quarters.find((r) => r.changeNote && r.status === 'Changes Requested');
    const moved = db.quarters.find((r) => r.emp === 'NVS01037' && r.originalReviewer);
    // marks not final by their due date (the quarter's last day: 31 Jul, 31 Aug, 30 Sep), marked missed the next morning
    const missedBy = (mk) => db.quarters.filter((r) => RV.dueMonth(r) === mk && !RV.lockedInWindow(r));
    const rehan = person('NVS00957'); const rehanFrom = rehan ? RV.nextQuarterStart(rehan, new Date(2026, 5, 18, 11, 5)) : null;
    db.audit = [
      { at: iso(new Date(2026, 9, 1, 11, 5)), by: 'ADM-0001', action: 'Uploaded financials from CSV', entity: 'Sep 2026', prev: '–', next: 'Actuals for ' + uploadedIn('2026-09') + ' people' },
      asked ? { at: asked.changeNote.at, by: asked.changeNote.by, action: 'Requested changes to self-mark', entity: RV.quarter(asked.key).label + ' · ' + person(asked.emp).name, prev: 'With reviewer', next: 'Changes requested', note: asked.changeNote.note } : null,
      moved ? { at: iso(new Date(2026, 9, 1, 9, 40)), by: 'ADM-0001', action: 'Reassigned quarterly goal sheet', entity: RV.quarter(moved.key).label + ' · Borad Hiral Ramnikbhai', prev: 'Talha Siddiqui', next: 'Kuldeep Golani', note: 'Reviewer on planned leave' } : null,
      { at: iso(new Date(2026, 9, 1, 6, 0)), by: 'system', action: 'Opened quarterly goal sheets', entity: 'Quarters ending on 31 Oct · ' + opened + ' employees', prev: '–', next: 'Lock by 31 Oct' },
      { at: iso(new Date(2026, 9, 1, 0, 0)), by: 'system', action: 'Marked monthly reviews Incomplete', entity: 'Sep 2026 · ' + sepGaps + ' employees', prev: 'Open', next: 'Incomplete', note: 'Not finished by month end' },
      missedBy('2026-09').length ? { at: iso(new Date(2026, 9, 1, 0, 0)), by: 'system', action: 'Marked quarterly goal sheets Incomplete', entity: 'Due 30 Sep · ' + missedBy('2026-09').map((r) => person(r.emp).name + ' · ' + RV.quarter(r.key).short).join(', '), prev: 'Open', next: 'Incomplete', note: 'Not locked by the quarter’s last day' } : null,
      tejas ? { at: tejas.generatedAt, by: 'system', action: 'Generated Pre Appraisal Report', entity: 'Tejas Lohokare · cycle ' + tejas.cycle, prev: 'Not generated', next: tejas.quarterKeys.length + ' quarters' + (tejas.flags.includes('PARTIAL_CYCLE') ? ' · partial cycle' : ''), note: (tejas.late || []).length ? 'Generated once ' + tejas.late.map((k) => RV.quarter(k).short).join(', ') + ' locked' : undefined } : null,
      tejas && (tejas.late || []).length ? { at: iso(new Date(new Date(tejas.date).getTime() + 6 * 3600e3)), by: 'system', action: 'Pre Appraisal Report not generated', entity: 'Tejas Lohokare · cycle ' + tejas.cycle, prev: '–', next: 'Waiting on ' + tejas.late.map((k) => RV.quarter(k).short).join(', '), note: 'Q4’s marks were due on 31 Aug and aren’t final yet' } : null,
      { at: iso(new Date(2026, 8, 22, 17, 11)), by: 'ADM-0001', action: 'Updated actual', entity: 'Jul 2026 · Rehan Akhtarkhan Pathan', prev: '₹4.21 L', next: '₹4.36 L', note: 'Correct Deloitte claims actual' },
      { at: iso(new Date(2026, 8, 21, 16, 40)), by: 'ADM-0001', action: 'Uploaded financials from CSV', entity: 'Aug 2026', prev: '–', next: 'Actuals for ' + uploadedIn('2026-08') + ' people' },
      tf.length > 1 ? { at: tf[tf.length - 1].created, by: 'system', action: 'Started a new review form', entity: 'Tejas Lohokare', prev: RV.formLabel(tf[tf.length - 2]) + ' · ' + RV.formSpan(tf[tf.length - 2]), next: RV.formLabel(tf[tf.length - 1]) + ' · from ' + RV.monthLabel(tf[tf.length - 1].start), note: 'A new review year' } : null,
      { at: iso(new Date(2026, 8, 1, 9, 0)), by: 'ADM-0001', action: 'Uploaded financials from CSV', entity: 'Sep 2026', prev: '–', next: 'Billability and forecast for everyone' },
      missedBy('2026-08').length ? { at: iso(new Date(2026, 8, 1, 0, 0)), by: 'system', action: 'Marked quarterly goal sheets Incomplete', entity: 'Due 31 Aug · ' + missedBy('2026-08').map((r) => person(r.emp).name + ' · ' + RV.quarter(r.key).short).join(', '), prev: 'Open', next: 'Incomplete', note: 'Not locked by the quarter’s last day' } : null,
      missedBy('2026-07').length ? { at: iso(new Date(2026, 7, 1, 0, 0)), by: 'system', action: 'Marked quarterly goal sheets Incomplete', entity: 'Due 31 Jul · ' + missedBy('2026-07').map((r) => person(r.emp).name + ' · ' + RV.quarter(r.key).short).join(', '), prev: 'Open', next: 'Incomplete', note: 'Not locked by the quarter’s last day' } : null,
      yogi ? { at: yogi.checkedAt, by: 'system', action: 'Pre Appraisal Report not generated', entity: 'Yogiraj Singh Kushwah · cycle ' + yogi.cycle, prev: '–', next: yogi.status === 'Generated' ? 'Generated' : 'Waiting on ' + (yogi.blocking || []).map((k) => RV.quarter(k).short).join(', '), note: (yogi.blocking || []).map((k) => RV.quarter(k).short).join(', ') + ' marks were due on 31 Jul and aren’t final yet' } : null,
      { at: iso(new Date(2026, 7, 3, 6, 0)), by: 'system', action: 'Created persistent review form', entity: 'Aaditya Mukherjee', prev: '–', next: 'Form 1 · from Aug 2026' },
      kopal ? { at: kopal.at, by: 'system', action: 'Added review form fields', entity: 'Kopal Sharma · form ' + kf.n, prev: '–', next: 'Reportee management from ' + RV.monthLabel(kopal.effective), note: kopal.note + '; from the first month of their next quarter' } : null,
      { at: iso(new Date(2026, 5, 18, 11, 5)), by: 'ADM-0001', action: 'Created template override', entity: 'Rehan Akhtarkhan Pathan', prev: 'PO goal sheet · without direct reportees', next: 'PM goal sheet', note: rehanFrom ? `From ${RV.monthLabel(rehanFrom)}, the start of their next quarter` : undefined },
      { at: iso(new Date(2026, 3, 2, 15, 20)), by: 'ADM-0001', action: 'Changed reporting manager', entity: 'Tejas Lohokare', prev: 'Dhaval Kishor Malte', next: 'Manisha Sisodia' },
    ].filter(Boolean);
    db.audit.sort((a, b) => (a.at < b.at ? 1 : -1));
    return db;
  }

  RM.seed = seed;

  /* ---------- resource allocation: location, project and project code from the employee sheet ---------- */
  // blanks in the sheet stay blank ('Not set', no project, no code); allocation % is parked sample data (SHOW_ALLOC_PCT in views-plus.js)
  const A = (allocation, location, projects, code) => ({ allocation, location: location || 'Not set', projects, code: code || null });
  const LEVVIA = 'Levvia Transformation - NV', OMNIA_DATA = 'Omnia Data - NV', INTERNAL = 'Internal';
  // the practice works from these locations only; USA is rare (one person here)
  RM.LOCATIONS = ['Pune', 'Bhopal', 'Hyderabad', 'USA'];
  RM.RESOURCE = {
    NVS00697: A(0, 'Bhopal', [INTERNAL], 'NV000197'), NVS00212: A(80, 'Pune', [OMNIA_DATA], 'NV000303'), NVS00207: A(0, 'Pune', ['DataLens - NV'], 'NV000265'),
    NVS00247: A(80, 'Bhopal', [OMNIA_DATA], 'NV000264'), NVS01478: A(60, 'Bhopal', [INTERNAL], 'NV000302'), NVS01607: A(0, 'Pune', ['E&Y'], 'NV000305'),
    NVS01119: A(60, 'Bhopal', [LEVVIA], 'NV000281'), NVS00984: A(0, 'Bhopal', ['Omnia Products - NV'], 'NV000300'), NVC00109: A(100, null, []),
    NVS00712: A(60, 'Pune', [LEVVIA], 'NV000281'), NVS00822: A(40, 'Bhopal', ['FB'], 'NV000174'), NVS01822: A(100, null, ['Data Lens']),
    NVS01753: A(100, null, ['SFC MVP development/RFC']), NVS01602: A(60, 'Pune', [INTERNAL], 'NV000276'), NVS01812: A(100, null, ['Omnia Data New Vision JE SOW']),
    NVS00957: A(100, 'Pune', [LEVVIA], 'NV000281'), NVS01685: A(100, 'Pune', ['Omnia Data - NV - Second SoW'], 'NV000302'), NVS01037: A(60, 'Pune', ['CBM Datalake - phase 2'], 'NV000259'),
    NVS01727: A(100, null, []), NVS01382: A(80, 'Pune', [LEVVIA], 'NV000281'), NVS01663: A(60, 'Pune', [LEVVIA], 'NV000281'),
    NVS00928: A(40, 'Pune', [LEVVIA], 'NV000281'), NVS01726: A(80, null, ['Levia']), NVS01388: A(60, 'Pune', [INTERNAL], 'NV000188'),
    NVS01482: A(100, 'Pune', [INTERNAL], 'NV000175'), NVS01864: A(60, null, [INTERNAL]), NVS01831: A(40, null, [INTERNAL]),
    NVS00996: A(40, 'Bhopal', ['DWP (Distributed Work Portal) Transformation Project - NV'], 'NV000290'), NVS01805: A(40, null, []),
    NVS00975: A(60, 'Pune', [LEVVIA], 'NV000281'), NVS00932: A(100, 'Bhopal', ['DT Solutions – POD Team to support Global Learning'], 'NV000291'),
    NVS01650: A(80, 'Pune', ['RSM'], 'NV000197'),
    NVC00110: A(100, 'USA', []), // Brian Okuno: not on the employee sheet, kept as before
  };
  RM.resourceOf = (id) => RM.RESOURCE[id] || A(0, null, []);
  // allocation status: kept for when the allocation tags return (SHOW_ALLOC_TAGS in views-plus.js)
  RM.allocStatus = (p) => { if (p.status !== 'Active') return 'Inactive'; const a = RM.resourceOf(p.id).allocation; return a === 0 ? 'Available' : a < 100 ? 'Partially Allocated' : 'Fully Allocated'; };

  /* ---------- DPS dashboard (SAMPLE): financial year, employee cost, project start dates, initiatives ---------- */
  // Revenue, cost and profit for the practice or a team (a lead plus all their direct and indirect reportees), for the year:
  // revenue = actuals for months with actuals (locked), forecasts for the rest; cost = (CTC + ₹3 lakh) per person; profit = revenue − cost
  // the financial year runs April to March
  RM.FY = { label: 'FY 2026–27', span: 'Apr 2026 – Mar 2027', start: new Date(2026, 3, 1), end: new Date(2027, 2, 31),
    months: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'] };
  // monthly cost to company (₹) by designation, then by platform role for imported titles
  const COST = { 'Practice Head': 420000, 'Senior Manager': 340000, 'Product Manager': 290000, 'UX Lead': 280000, 'Product Owner': 240000, 'Senior Business Analyst': 190000, 'Business Analyst': 140000, 'Junior Business Analyst': 90000, 'Trainee Business Analyst': 55000, 'UX Designer': 150000, 'Designer': 120000, 'Consultant': 200000 };
  const COST_BY_ROLE = { 'PM': 290000, 'PO': 240000, 'Senior BA': 190000, 'BA': 140000 };
  // salary & appraisal history: an annual appraisal on every work anniversary (a rating and the increment it brought).
  // Built backwards from today's CTC, so the latest salary is always the monthly cost the dashboards use. Contractors aren't appraised.
  const salCache = {};
  RM.salaryHistory = (p) => {
    const key = [p.joined, p.designation, p.role, p.contractor ? 1 : 0].join('|');
    if (salCache[p.id] && salCache[p.id].key === key) return salCache[p.id].list;
    const monthly = (COST[p.designation] || COST_BY_ROLE[p.role] || 150000) * (0.95 + rng('cost:' + p.id)() * 0.1);
    const joined = new Date(p.joined); const appraisals = [];
    for (let y = joined.getFullYear() + 1; !p.contractor; y++) {
      const date = new Date(y, joined.getMonth(), joined.getDate()); if (date > TODAY) break;
      const r = rng('appr:' + p.id + y); const rating = round1(3 + r() * 1.9);
      const [lo, hi] = rating >= 4.5 ? [9, 12] : rating >= 4 ? [6, 9] : rating >= 3.5 ? [4, 6] : [2, 4];
      appraisals.push({ date, kind: 'appraisal', rating, inc: Math.round((lo + r() * (hi - lo)) * 2) / 2 });
    }
    let ctc = Math.round((monthly * 12) / appraisals.reduce((g, a) => g * (1 + a.inc / 100), 1) / 10000) * 10000;
    const list = [{ date: joined, kind: 'join', ctc }];
    appraisals.forEach((a) => { ctc = Math.round((ctc * (1 + a.inc / 100)) / 1000) * 1000; list.push(Object.assign(a, { ctc })); });
    salCache[p.id] = { key, list }; return list;
  };
  // annual CTC in effect on a date, and today's as a monthly cost
  RM.ctcAt = (p, d) => { let c = null; for (const e of RM.salaryHistory(p)) { if (c === null || e.date <= d) c = e.ctc; else break; } return c; };
  RM.costOf = (p) => Math.round(RM.ctcAt(p, TODAY) / 12);
  // what a person costs the practice in a year: today's CTC plus ₹3 lakh. Practice and team cost are the sum of this.
  RM.OVERHEAD = 300000;
  RM.yearCost = (p) => RM.ctcAt(p, TODAY) + RM.OVERHEAD;
  // in the practice in a month ('YYYY-MM'): from the month they joined, the whole month counting. A person costs
  // RM.yearCost ÷ 12 for each such month, so the year's cost (CTC and the ₹3 lakh alike) runs from their joining month.
  RM.inPractice = (p, mk) => String(p.joined).slice(0, 7) <= mk;
  RM.fyShare = (p) => RM.FY.months.filter((mk) => RM.inPractice(p, mk)).length / 12;
  // monthly pay split (SAMPLE): a performance-linked variable share of CTC by level, the rest in-hand (fixed) pay.
  // Both are before tax and PF, so in-hand + variable = CTC / 12. Contractors have no variable pay.
  const VARIABLE = { L0: 0.2, L1: 0.15, L2: 0.12, L3: 0.1 };
  RM.variableShare = (p) => (p.contractor ? 0 : VARIABLE[p.level] != null ? VARIABLE[p.level] : 0.08);
  RM.payParts = (p, ctc) => { const monthly = Math.round(ctc / 12); const variable = Math.round((ctc * RM.variableShare(p)) / 12); return { monthly, variable, inHand: monthly - variable }; };
  // billing: the latest month's forecast revenue as an hourly USD rate at 40 hours a week (null when not billable)
  // rupees per US dollar: the market rate on 5 Oct 2026 (Trading Economics). Billing rates and the Practice Head's dashboard use it.
  RM.FX_USD = 96.48;
  RM.FX_DATE = '5 Oct 2026';
  RM.HOURS_MONTH = (40 * 52) / 12;
  RM.rateOf = (p) => { const f = RM.q.finRow(p.id, RM.q.latestMonth()); return f && f.billable && f.forecast ? Math.round((f.forecast / RM.HOURS_MONTH / RM.FX_USD) * 2) / 2 : null; };
  // profitability on the current project: billed at the rate since joining it, against the CTC in effect each month, by financial year
  RM.profitability = (p) => {
    const rate = RM.rateOf(p); const since = RM.projectSince(p); if (!rate || !since) return null;
    const usdMonth = rate * RM.HOURS_MONTH; const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()); const byFy = {};
    for (let m = new Date(since.getFullYear(), since.getMonth(), 1); m <= TODAY; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0); const from = since > m ? since : m; const to = TODAY < end ? TODAY : end;
      const frac = (Math.round((day(to) - day(from)) / 864e5) + 1) / end.getDate(); if (frac <= 0) continue;
      const fy = m.getMonth() >= 3 ? m.getFullYear() : m.getFullYear() - 1;
      const y = byFy[fy] || (byFy[fy] = { fy, label: 'FY ' + fy + '–' + String(fy + 1).slice(2), months: 0, usd: 0, cost: 0 });
      y.months += frac; y.usd += usdMonth * frac; y.cost += (RM.ctcAt(p, new Date((from.getTime() + to.getTime()) / 2)) / 12) * frac;
    }
    const money = (y) => { const inr = y.usd * RM.FX_USD; return Object.assign(y, { inr, profit: inr - y.cost, margin: inr ? (inr - y.cost) / inr : null }); };
    const years = Object.values(byFy).sort((a, b) => a.fy - b.fy).map(money);
    const total = money(years.reduce((t, y) => ({ months: t.months + y.months, usd: t.usd + y.usd, cost: t.cost + y.cost }), { months: 0, usd: 0, cost: 0 }));
    const revMonth = usdMonth * RM.FX_USD; const costMonth = RM.costOf(p);
    return { rate, since, hours: 40, usdMonth, revMonth, costMonth, years, total, current: (revMonth - costMonth) / revMonth };
  };
  // when someone started on their current project (drives project ageing); no project, no start date
  RM.projectSince = (p) => {
    if (!RM.resourceOf(p.id).projects.length) return null;
    const from = Math.max(new Date(p.joined).getTime(), new Date(2021, 3, 1).getTime()); const to = addDays(TODAY, -45).getTime();
    return new Date(to <= from ? from : from + rng('proj:' + p.id)() * (to - from));
  };
  // the Practice Head's key internal initiatives; owners are employee IDs, status is 'In progress' or 'Completed'
  RM.INITIATIVES = [
    { id: 'ld', name: 'L&D', sub: 'Learning & development', icon: 'lightbulb-bolt-linear', owners: ['NVS00984', 'NVS00928'], status: 'In progress' },
    { id: 'eco', name: 'Internal Ecosystem', icon: 'widget-2-linear', owners: ['NVS01602'], items: [
      { name: 'Accounts List', icon: 'buildings-2-linear', status: 'In progress', next: 'Share the accounts list' },
      { name: 'RMG – Internal Portal', icon: 'users-group-two-rounded-linear', status: 'In progress' },
      { name: 'Revenue Forecasting', icon: 'graph-up-linear', status: 'In progress' },
    ] },
    { id: 'mkt', name: 'DPS Marketing & Research', icon: 'plain-linear', owners: ['NVS01864', 'NVS01831'], status: 'Completed' },
  ];

  function emailFor(name) {
    const parts = name.replace(/\./g, '').toLowerCase().split(/\s+/);
    return parts[0] + '.' + parts[parts.length - 1] + '@' + RM.DOMAIN;
  }
})(window.RM);
