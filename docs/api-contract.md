# Data contract: front end ↔ `RM.api`

This is the one interface between the **front-end** agent (views, screens, imports UI) and the **backend** agent (`js/api.js`, Supabase, mock mode). The backend implements it, and the front end only calls it. A change to it is agreed through the coordinator and recorded here first.

## Loading and boot
- **Script order in `index.html` and `rmfvs.html`** (the front end edits both):
  `js/icons.js`, `js/data.js`, `js/ui.js`, **`js/vendor/supabase.js`, `js/config.js`, `js/api.js`**, `js/tags.js`, `js/views-org.js`, `js/views-plus.js`, `js/import.js`, `js/app.js`.
- **`js/config.js`** sets `window.RM_CONFIG = { supabaseUrl: '', supabaseKey: '' }`. The key is the publishable key, which is public.
- **`RM.api.ready`** is a Promise that resolves once the adapter is chosen. The app awaits it before its first render.
  - `?mock` in the page URL loads `dev/mock.js` (fictional data, in-memory, no network).
  - Otherwise, a blank `supabaseUrl` makes `RM.api.mode` `'unconfigured'`, and the app shows a "Not configured yet" screen.
- `RM.api.mode` is `'supabase' | 'mock' | 'unconfigured'`.

## Errors
Every method returns a Promise. On failure it rejects with `{ code, message }`, where `code` is one of:
`'invalid_login'`, `'no_access'`, `'wrong_current'`, `'weak_password'`, `'not_found'`, `'conflict'`, `'forbidden'`, `'network'`, `'unknown'`.

## Session and passwords
| Method | Resolves to / does |
|---|---|
| `session()` | `{ email, role: 'admin' \| 'ph', empId, mustChange }`, or `null` when signed out |
| `signIn(email, password)` | Same as `session()`. Rejects with `invalid_login` (wrong email or password, never saying which) or `no_access` (the account isn't in `app_users`; the method signs out before rejecting). |
| `signOut()` | Clears the session |
| `setNewPassword(pw)` | Sets the password and clears `mustChange`. Rejects with `weak_password` (at least 10 characters, letters and digits). Used both at first sign-in and after a reset link. |
| `changePassword(current, next)` | Checks `current` first and rejects with `wrong_current` if it's wrong; then like `setNewPassword` |
| `sendResetEmail(email)` | Always resolves, whether or not the email has an account |
| `verifyResetLink()` | When the URL has `?token_hash=…&type=recovery`, verifies it, strips it from the URL and resolves `true` (the app then shows Set a new password). Otherwise resolves `false`. Rejects with `invalid_login` for an expired or used link. |
| `adminResetPassword(email)` | Admin only. Resolves the temporary password (shown once) and turns `mustChange` back on for that user. |

## `loadAll()` → the in-memory database
`RM.store.db` keeps the shape the views already read. Field names are camelCase. Money is in whole **rupees** (₹). Months are `'YYYY-MM'`.

```js
{
  people: [{
    id: 'NVS01234',            // ^NV[SC]\d{5}$ ; NVC = contractor
    name, designation,         // the sheet's "Role" column is the designation
    level, skill,              // primary skill
    rm,                        // manager's id or null
    rmExternal,                // a manager outside the practice (text) or null
    finTarget,                 // bool: leads a cluster with a yearly target
    joined: 'YYYY-MM-DD',
    practice, location,        // location = the sheet's "Office"
    alloc,                     // client name (free text; 'Internal' or '' = internal)
    project, code,             // project name and project code (or null)
    email,                     // may be null
    status: 'Active' | 'Archived',
    contractor,                // true when the id starts NVC
    photo                      // signed image URL or null
  }],
  fin: { [empId]: { 'YYYY-MM': { billable, forecast, actual /* null = not uploaded */ } } },
  targets: { [empId]: amount },             // the current financial year only
  ctc: { [empId]: { annual, from: 'YYYY-MM-DD' } },
  billing: { [empId]: { rate /* USD per hour */, start: 'YYYY-MM-DD' } },
  gapItems: [{ id, scope /* 'practice' | empId */, title, note, impact /* ₹ or null */, status, by, at, editedAt }],
  initiatives: [{ id, name, owner, status, parent /* id or null */, nextStep }],
  settings: { fxUsd: 96.48, fxDate: 'YYYY-MM-DD', overhead: 300000 },
  users: [{ email, role, empId, mustChange, changedAt }],   // admin only; [] for the PH
  audit: [{ at /* ISO */, by /* actor email */, action, entity, prev, next, note }]   // newest first
}
```

## Writes
Each write resolves to the saved record(s) in the shape above. The front end updates the screen immediately; on a rejection it shows a toast and calls `loadAll()` again.

| Method | Who | Notes |
|---|---|---|
| `saveEmployee(person)` | admin | Insert or update by `id` |
| `archiveEmployee(id)` | admin | |
| `importEmployees(people[])` | admin | Upsert by `id`, managers first. Resolves `{ created, updated }`. |
| `saveCtc(rows[{ id, annual, from }])` | admin | Upsert |
| `saveBilling(rows[{ id, rate, start }])` | admin | Upsert |
| `saveMonth('YYYY-MM', rows[{ id, billable, forecast, actual }])` | admin | Upsert. The database also enforces `actual <= forecast`. |
| `saveTargets({ [empId]: amount })` | admin | For the current financial year |
| `saveGapItem(item)` / `deleteGapItem(id)` | ph, admin | |
| `saveInitiative(i)` / `deleteInitiative(id)` | ph, admin | |
| `uploadPhoto(empId, blob)` / `removePhoto(empId)` | admin, or ph for their own `empId` | `uploadPhoto` resolves the new URL |
| `saveSettings({ fxUsd, fxDate, overhead })` | admin | |
| `saveUser({ email, role, empId })` | admin | Links an account to an employee. Accounts themselves are created in Supabase. |
| `audit(entries[{ action, entity, prev, next, note }])` | any signed-in user | The database sets `at` and `by`. Rows are insert-only. |
| `exportAll()` | admin | `{ [tableName]: csvText }` |

## Mock mode (`dev/mock.js`, owned by the backend)
- Mock mode implements this same contract in memory, from **fictional** fixtures in `dev/fixtures/`.
  - No real names, IDs, clients or photos.
  - Nothing is written to localStorage or sessionStorage.
- **Accounts:** `admin@example.test` and `ph@example.test`. Both have password `Temp-pass-123` and `mustChange: true`.
- **Reset link:** `?mock&token_hash=mock&type=recovery`.
- **Empty system:** `?mock=empty` starts with no data at all; `?mock` starts with the fixtures.
