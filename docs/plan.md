# NV-DPS-Internal: Practice Head + Admin build on Supabase (temporary delivery)

> Approved plan. The team builds from this; questions go to Zara through the coordinator.

## Context
The Practice Head (PH) interface is about 95% ready, but it runs on generated sample data in the browser's localStorage, and HR wants to see real data soon. The original plan was to ship a clean slate and have the Admin upload the sensitive data. That's still the plan, delivered quickly:
- **Two roles only:** Practice Head and Admin. PM, PO, Senior BA and BA logins go.
- **Review module removed.**
- **Real backend:** Supabase for Postgres, Auth and Storage. The **Admin owns the Supabase account**, and Zara has zero access to its data.
- **No seed data in the code:** the Admin fills the system by upload.
  - Zara hands the Admin the non-sensitive employee sheet and the photos directly, never through git. The sheet's columns: S.no, Emp Id, Full Name, Role, Level, Reporting Manager, Financial Target (y/n), Date of Joining, Practice, Primary Skill, Office, Project Code, Client, Project.
  - Everything sensitive is uploaded only by the Admin: current CTC, monthly billability, forecasts and actuals, yearly targets, billing rates and project start dates.

**Decided with Zara:**
- Sign-in is email + password.
  - Zara creates both accounts (Admin and PH) with temporary passwords, and each person must set their own password at first sign-in.
  - Both can change their password from the account menu at any time.
  - **Forgot password** works by email.
- Salary data is current CTC only; no appraisal history.
- Hosting is on Zara's Vercel, or Cloudflare Pages if company use has to stay free.
- **No paid plans:** the Supabase free plan, with a keep-alive ping and a data export.
- The repo is made private now, with its history kept.

## Security model ("Zara has zero access")
- **Admin owns everything with data in it.**
  - Zara **sets up** the Supabase organisation and project, then **hands ownership to the Admin and leaves before any real data is loaded**. The Admin then resets the database password and replaces the secret key, the two credentials Zara saw during setup. See *Setup walkthrough* below.
  - The project is on the **free plan** (no cost), in region `ap-south-1` (Mumbai). Free-plan gaps and how they're covered:
    - *Pauses after 7 days of no use:* a scheduled GitHub Action calls a harmless `ping()` function every 3 days. It reads no data, and anon may execute nothing else. If a pause does happen, the Admin restores the project in one click and no data is lost.
    - *No automatic backups:* an **Export all data** button in Admin Settings downloads one CSV per table, and the uploaded source sheets remain the Admin's own backup.
    - *Size:* 500 MB database and 1 GB storage, far more than this needs.
  - Neon was considered and turned down: it has no file storage, and browser access would mean either its newer data API or a backend holding the database password on Zara's hosting, which breaks zero access.
- **Only public values stay with Zara after handover:** the project URL and publishable key in `js/config.js`, both public by design.
  - Row-level security is on for every table, the `anon` role has no grants, and public sign-up is **disabled**. So without an account, the URL and key return nothing.
  - The secret key is replaced at handover, so the new one is never seen by Zara.
- **Who can sign in:** only the two accounts Zara creates in Supabase → Authentication → Users → **Add user** (auto-confirmed, with a temporary password).
  - The role comes from `app_users`: email → `admin` | `ph`, plus the PH's `emp_id`.
  - An account that isn't in `app_users` sees "No access" and is signed out.
- **Temporary passwords stop working once used.**
  - `app_users.must_change_password` starts `true`, and the app allows nothing but **Set a new password** until it is `false`.
  - Settings → Users shows whether each person has set their own password. Once both have, the passwords Zara chose no longer work.
  - Password rules (Auth → Password settings): at least 10 characters, with letters and digits.
- **No data stored in the browser.** The browser keeps only the Supabase session token. The data lives in memory while the tab is open: no more whole-database copy in localStorage.
- **Photos** sit in a **private** Storage bucket and are shown through short-lived signed URLs.
- **Audit:** an `audit_log` row's `actor` is set by a database trigger from the signed-in user's email, so it can't be forged. Rows are insert-only: nobody, the Admin included, can update or delete them through the API.
- **Hosting:** Vercel only serves static code, so the data never passes through Vercel.
  - `vercel.json` sets a Content-Security-Policy whose `connect-src` and `img-src` allow only the Supabase project, plus `X-Frame-Options: DENY` and a referrer policy.
  - Caveat 1: the Vercel Hobby plan is for non-commercial use only. The no-cost alternative is **Cloudflare Pages**, whose free plan allows company use; the same static files deploy unchanged. `vercel.json` headers become a `_headers` file there.
  - Caveat 2: whoever deploys controls the code running in the Admin's browser. That's acceptable for a temporary tool; for the long term, transfer the Vercel project to a company account.
- **Zara's development** uses her **own** Supabase project with fictional fixture data (`dev/fixtures/*.csv`), plus an in-memory mock mode that needs no backend at all.

## Data model: `supabase/schema.sql` (one file Zara runs once, during setup)
Amounts are stored in whole rupees, as they are today.

| Table | Columns | Filled by |
|---|---|---|
| `app_users` | `email` pk, `role` (`admin` or `ph`), `emp_id` (nullable fk), `must_change_password` (default `true`), `password_changed_at`, `created_at` | The schema adds both rows from the two emails at the top of the file. The Admin later links the PH to their employee record in Settings → Users. |
| `employees` | `emp_id` pk, checked against `^NV[SC]\d{5}$` (NVC = contractor); `full_name`; `designation` (the sheet's "Role"); `level`; `rm_id` (fk to `employees`, nullable); `rm_external`; `fin_target` bool; `joined` date; `practice`; `primary_skill`; `office`; `project_code`; `client`; `project`; `email` (nullable); `status` (`Active` or `Archived`); `photo_path`; `updated_at` | Employee sheet import, then Admin edits |
| `ctc` | `emp_id` pk, `annual_ctc`, `effective_from`, `updated_at` | Admin, from a CTC CSV or the profile |
| `billing` | `emp_id` pk, `rate_usd_hr`, `project_start` | Admin, from a rates CSV or the profile. This replaces today's synthesised `RM.rateOf` and `RM.projectSince`. |
| `fin_months` | `emp_id`, `month` (date, first of the month) as pk; `billable`; `forecast`; `actual` (nullable); check `actual <= forecast` | Admin, from Financial Updates (by hand or Fill from CSV) |
| `targets` | `emp_id`, `fy` (e.g. `2026-27`) as pk; `amount` | Admin, from the Financial Updates targets card |
| `gap_items` | `id` uuid, `scope` (`practice` or an emp_id), `title`, `note`, `impact`, `status`, `created_by`, `created_at`, `updated_at` | PH, from Target Gap and Initiatives |
| `initiatives` | `id`, `name`, `owner`, `status`, `parent_id` (workstreams), `next_step` | PH and Admin, on the Practice Overview card. This replaces the hard-coded `RM.INITIATIVES`. |
| `settings` | single row: `fx_usd` (96.48), `fx_date`, `overhead` (300000) | Admin, from Settings |
| `audit_log` | `id`, `at` (default `now()`), `actor` (set by trigger from the JWT email), `action`, `entity`, `prev`, `next`, `note` | Client inserts; insert-only |

- **Helper:** `public.app_role()` is `security definer`. It reads `app_users` by `auth.jwt()->>'email'`.
- **Password functions:**
  - `public.password_changed()` lets a signed-in user clear only their own `must_change_password` flag.
  - `public.admin_reset_password(email)` is admin-only and `security definer`. It sets a random temporary password on that account (bcrypt, via `pgcrypto`, in `auth.users`), turns `must_change_password` back on, and returns the temporary password once.
    - This is the no-email backstop for the PH.
    - It writes to Supabase's own `auth` tables, which is acceptable for a temporary tool. The proper replacement later is an Edge Function that calls the admin API.
- **Policies:**
  - Admin: full access to every table.
  - PH: read every table; write `gap_items` and `initiatives`; update their own `employees.photo_path`. No other writes.
  - `anon`: nothing except `execute` on `public.ping()`, which runs `select 1` (the keep-alive).
- **Storage bucket `photos`** (private). Files live at `<emp_id>.jpg`.
  - Read: `admin` or `ph`.
  - Write: `admin`, or `ph` for their own emp_id only.
- **Tests:** `supabase/tests/rls.sql` checks every policy against a local Postgres with a stubbed `auth` schema.

## Scope: what stays and what goes
- **Practice Head keeps:**
  - Practice Overview, without the Appraisals card and appraisal cost.
  - Organization, without rating badges on the cards.
  - Resource Allocation.
  - Financial Performance and Clusters.
  - Target Gap and Initiatives. Cluster-head "ideas" go, because PMs no longer sign in.
  - Profile, with two tabs: Overview and Project allocation.
- **Admin keeps:**
  - Dashboard.
  - People, with full edit, archive and photo upload.
  - Organization and Resource Allocation.
  - Financial Updates: months, Fill from CSV and targets.
  - Audit Trail.
  - Settings, slimmed to Users, FX rate and overhead.
- **Deleted outright:**
  - `js/review.js` (777 lines) and `js/views-review.js` (1255 lines).
  - `js/views-me.js` (273 lines). It holds only the employee dashboard, the drawer profile and Upcoming Appraisals. Its two shared lines move to `js/ui.js`: `RM.views = {}`, and `RM.wait`, which is then removed wherever a real network call replaces the fake delay.
  - In `js/views-org.js`: `V.adminConfig` (Review setup, 1064–1132) and `V.teamFinance` / `V.teamGap` (PM-only, 964 and 972).
  - In `js/views-plus.js`: `V.myFinancials` (PM, 395+).
- **Review pieces stripped from pages that stay:**
  - `js/app.js`:
    - `ROUTES` (17–62): drop every review, `me/*` and legacy-forward route.
    - `navFor` (78–126): drop the Reviews and Appraisal groups and the review counts; the employee nav goes.
    - The login `PERSONAS` (352) and the drawer (535).
    - In `createEmployee` and `editEmployee`: drop the `RV.ensureForms`, `recordRmChange`, overrides and mapping calls.
    - Review notifications.
  - `js/views-org.js`:
    - `curRecs` (9).
    - The Practice Overview's Appraisals card, panel and appraisal cost (312–331, 393–412, 501).
    - The org-map rating block (592–609).
    - In Admin People (997–1060): the marks/appraisal KPIs, the mapping-pending notice, the "in cycles" column and the Upcoming appraisals card.
    - Settings (1272–1314): replaced with Users / FX / overhead.
  - `js/views-plus.js`:
    - The admin dashboard's marks attention card (12–21, 55).
    - Profile tabs `RA_TABS` (212): drop Reviews and Salary & appraisals (272–291).
  - `js/ui.js`: `upgrade16`–`28` and `RV.seed` calls (29–94); `q.appraisal` / `q.upcomingAppraisals` (221–232); review label rewrites (264–268); `C.dueBadge` (287). `RV.fmtPct` (730) moves to `fmt`.
  - `js/data.js`: `RM.formsLabel` / `isEligible` (315–319), `RM.GOALSHEETS` / `ROLE_TEMPLATE`, and the review audit seed.
  - `js/tags.js`: about 40 review and appraisal glossary entries.
  - The review CSS sections in `css/styles.css`.
- **Platform role:** employees no longer need one. The allocation filters already group people by designation and the contractor flag (`roleGroup`, `js/views-plus.js:99`), so `p.role` survives only on the signed-in user (`Practice Head` or `Admin`, from `app_users`).
  - `PH_ID` (`js/views-org.js:10`) comes from the `ph` row's `emp_id`.
- **Real data removed from the code:**
  - `PEOPLE`, `RM.RESOURCE`, `RM.INITIATIVES` and all seeding and upgrades in `js/data.js` and `js/ui.js`.
  - `assets/people/*.jpg` and `prm.png`.
  - README rewritten for the new build.
- **Real clock:** `RM.TODAY = new Date()`. `RM.FY` and the Financial Updates month list are worked out from today (all 12 months of the current April–March year).

## Front-end changes (no build step, so plain scripts as today)
1. **`js/vendor/supabase.js`:** the vendored UMD build of `@supabase/supabase-js@2.116.0`, pinned and served from our own domain.
2. **`js/config.js`:** the Supabase URL and publishable key, provided by the Admin. `?mock` loads `dev/mock.js` for local work; that file is excluded from deployment.
3. **New `js/api.js` (`RM.api`):**
   - `signIn`, `signOut`, `setNewPassword`, `changePassword`, `sendResetEmail`, `verifyResetLink`, `adminResetPassword`, `loadAll()`, and one write function per action: employee save/archive, bulk employee import, CTC import, billing import, month save, targets, gap items, initiatives, photo, settings, users and audit.
   - `loadAll()` fetches every table in parallel after sign-in and builds the **same `RM.store.db` shape** the views already read. So views stay synchronous and mostly untouched.
   - It maps snake_case columns to the current fields (`full_name`→`name`, `rm_id`→`rm`, `client`→`alloc`, `office`→location, …).
   - `RM.resourceOf` and the cost/rate helpers read the loaded rows instead of hard-coded tables.
4. **Replace `store.save()`** at each writer with its `RM.api` call. Update the screen immediately; on error, show a toast and reload from the server. Every `'ADM-0001'` actor is dropped, because the database sets the actor.
5. **Sign-in and passwords** (`js/app.js`, replacing the persona picker):
   - **Sign in:** email + password. A wrong email or password shows one message, "Email or password is incorrect", that never says which.
   - **First sign-in:** while `must_change_password` is `true`, the only screen is **Set a new password** (new + confirm, at least 10 characters with letters and digits). Saving calls `updateUser({password})`, then `password_changed()`, then opens the landing page.
   - **Change password:** in the account menu (top right, beside Sign out). It asks for the current password, which is checked with `signInWithPassword`, then the new one twice. A toast confirms, and an audit row is written.
   - **Forgot password:** a link on the sign-in screen.
     - You enter your email and the screen always says "If that email has an account, a reset link is on its way", so it doesn't reveal which emails exist.
     - `resetPasswordForEmail` sends the link. The **Reset password** email template points to `/?token_hash={{ .TokenHash }}&type=recovery`.
     - The app calls `verifyOtp` and shows **Set a new password**. Using the query string rather than `#` keeps it clear of the app's `#/` routes.
   - **Admin reset (no email needed):** Settings → Users → **Reset password** on the PH's row.
     - It shows a temporary password once, to pass on in person or by phone.
     - The PH must set their own at next sign-in.
   - **Sessions:** supabase-js refreshes the session token automatically. Sign out clears it and the in-memory data.
   - **Email delivery:** Supabase's built-in sender only delivers to members of the Supabase organisation's team, and only a few emails an hour. After handover that covers the Admin (an Owner) but **not the PH**. So setup adds a **free custom SMTP** sender:
     - Google Workspace mail: `smtp.gmail.com` with an app password on a company mailbox.
     - Microsoft 365 or anything else: the Brevo or Resend free tier, with IT adding their DNS records for `newvision-software.com`.
     - Until SMTP is set up, the Admin reset above covers the PH.
6. **Imports** (`js/import.js`):
   - **Employee import:** accepts Zara's sheet exactly. S.no is ignored; Role → designation; Office → location. Level, Financial Target (y/n), Practice, Primary Skill, Project Code, Client and Project are all read.
     - Email becomes optional. The reporting manager is matched by ID or name.
     - Existing IDs **update** rather than error, so the sheet can be re-uploaded.
     - Fixes for an empty system: the next free ID currently becomes `-Infinity`, and the ID padding is wrong.
     - Excel date serials and `DD-MM-YYYY` are accepted.
   - **New CTC import:** Emp Id, Annual CTC (₹), Effective from.
   - **New billing import:** Emp Id, Rate ($/hr), Project start.
   - **Photos:** bulk upload of files named `<EmpId>.jpg`. Reuse `readPhoto` from `js/views-plus.js` to crop and resize to 320 px, then upload to Storage.
   - The financials import stays as it is.
7. **Empty states everywhere.** No people, months, CTC or targets yet must render cleanly, never NaN.
   - Where figures are partial, the gap is shown, e.g. "CTC not uploaded for 4 people", so cost isn't silently understated.
8. **`vercel.json`** (security headers and CSP) and **`.vercelignore`** (excludes `dev/`, `supabase/tests`, `serve.js` and `.tastemaker`).
9. **Setup checklist on the Admin Dashboard** while the system is empty. Seven steps, each ticked from the data as it arrives and each linking to its page:
   1. Import employees
   2. Upload photos
   3. Upload CTC
   4. Upload billing rates
   5. Add monthly figures
   6. Set targets
   7. Link the Practice Head's account to their employee record

   The card hides once all seven are done.
10. **Free-plan upkeep:**
   - **Export all data** in Admin Settings: one CSV per table, built in the browser from the loaded data.
   - `.github/workflows/keepalive.yml`: a cron every 3 days that calls `rpc/ping` with the publishable key, which returns `1` and no data.

## Setup walkthrough (what the Admin goes through)
`supabase/README.md` carries these steps with screenshots of each Supabase screen.

**A. Zara prepares (~30 min, no real data anywhere)**
1. Deploy the site and note its URL (e.g. `https://nv-dps.vercel.app`).
2. In Supabase:
   1. Sign in with your own login and create a new organisation, **NV-DPS**, on the Free plan.
   2. Create a new project, **nv-dps-internal**, in Mumbai. Accept the generated database password; there's no need to keep it.
3. **SQL Editor** → paste `supabase/schema.sql` with the **Admin's and the PH's work emails** filled in at the top → **Run**. This creates the tables, the access rules, both `app_users` rows, the private `photos` bucket, the password functions and `ping()`.
4. **Authentication:**
   - **Sign In / Providers → Email:** on. **Allow new users to sign up:** **off**.
   - **Password settings:** minimum length 10, letters and digits required.
   - **URL Configuration:** Site URL and Redirect URL set to the site's URL.
   - **Emails → Templates → Reset password:** paste the template from the README.
   - **Emails → SMTP Settings:** the free sender for the company's mail (see *Email delivery* above).
5. **Authentication → Users → Add user → Create new user**, twice: once for the Admin and once for the PH.
   - Each gets a temporary password, with **Auto Confirm User** ticked.
   - Give each person their temporary password **directly**, in person or by phone, never in a shared chat.
6. **Project Settings → API Keys:** copy the Project URL and **publishable** key into `js/config.js`, then push and let it deploy.
7. **GitHub → repo Settings → Secrets:** add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the keep-alive job.

**B. Handover (~10 min on a call with the Admin)**
1. Zara: **Organisation → Team → Invite** the Admin's email as **Owner**. The Admin accepts, sets her own Supabase password and turns on two-factor sign-in.
2. Admin: **Organisation → Team** → remove Zara. From here on, Zara has no access to the project.
3. Admin: **Project Settings → Database → Reset database password**.
4. Admin: **Project Settings → API Keys** → create a new **secret** key and delete the old one. The publishable key stays, because it's public.
5. Admin: opens the site and signs in with her temporary password. **Set a new password** appears, and from then on only she knows it.
6. Admin: tries **Forgot password** once to confirm the reset email arrives.

**C. The Admin's first session in the app (~1 hour, her data)**
1. **Dashboard**, still empty, shows the **Setup checklist**.
2. **Import employees:** drop Zara's sheet (CSV, or cells pasted from Excel). The preview shows *N ready, M skipped* with each reason. Confirm.
3. **Upload photos:** drop the `<EmpId>.jpg` files. The preview lists them as matched or no-match. Upload.
4. **CTC** and **billing rates:** copy the template, fill it in Excel, paste, check the preview, save.
5. **Financial Updates:** for each month, **Fill from CSV** → **Save changes**. Then the **Targets** card: one figure per lead → **Save**.
6. **Settings → Users:** link the Practice Head's account to their employee record (a dropdown of employees).
7. The Practice Head signs in with the temporary password from Zara, sets their own at **Set a new password**, and lands on the **Practice Overview** with real figures.
8. **Settings → Users** now shows ✓ *Own password set* for both. The temporary passwords no longer work.

## Build order
Rough effort is in working days. Each step ends with a pushed commit on that day's branch. Nothing is merged into `main` unless Zara or Aaditya asks.

1. **Day 0 (Zara):** make the repo private. The Supabase setup and handover (parts A and B above) happen once the backend step is ready.
2. **Cut (~1–1.5 days):** remove reviews, the other roles, the seed and the real data; switch to the real clock; add empty states. Check it runs in `?mock` mode on fictional fixtures.
   - This alone is already demo-able to HR with fictional data.
3. **Backend (~2–3 days):** write `schema.sql` and the RLS tests; add `js/api.js`; build login; hydrate `db` with `loadAll()`; wire every writer.
4. **Uploads (~1–2 days):** the employee sheet import, CTC, billing and photo imports; Settings → Users / FX / overhead.
   - Client becomes free text taken from the data. It replaces the fixed `ALLOCS` list in `js/app.js:541`, and "Internal" or blank counts as internal.
5. **Handover (~half a day):**
   - Run an end-to-end pass against Zara's **own** dev Supabase project with fixtures.
   - Then do parts A, B and C of the *Setup walkthrough*.

## Verification
- **Database:** `psql` on a local Postgres 16 with a stubbed `auth` schema runs `schema.sql`, then `tests/rls.sql`. It must show:
  - anon sees nothing;
  - PH reads everything but can't write financials;
  - PH can change only their own photo;
  - Admin can do everything;
  - nobody can edit or delete audit rows;
  - a user can clear only their own password flag;
  - only an admin can call `admin_reset_password`, and the password it returns verifies against `auth.users`.
- **Sign-in flows** (Playwright, in `?mock` mode, whose fake auth follows the same states):
  - A first sign-in is forced to Set a new password.
  - Change password rejects a wrong current password and accepts the right one.
  - Forgot password shows the same message for known and unknown emails.
  - A `?token_hash=…&type=recovery` link opens Set a new password.
  - The Admin's reset makes the PH change their password at next sign-in.
- **UI:** Playwright (`/opt/pw-browsers/chromium`) in `?mock` mode:
  - First an empty system: every Admin and PH page renders with no console errors and no NaN.
  - Then import the fixture sheet, CTC, months and targets, and check that the PH dashboards show the expected totals.
  - Screenshots of each page.
- **Live check:** Zara runs the same flow against her own Supabase project. It can't be reached from this sandbox.
- **Keep-alive:** one week after go-live, the Admin's dashboard shows the project as active and the GitHub keep-alive runs are green. A pause only puts the project to sleep; the data is kept and the Admin can restore it.
