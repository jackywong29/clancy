# Clancy — progress & session handoff

> **Read this first when starting a new session.** It records exactly where
> things stand, what is blocked on whom, and what to do next. Update it at the
> end of a working session.
>
> Companion docs: `CLAUDE.md` (canonical spec + full build history) ·
> `OPERATIONS.md` (how the business runs) · `CLANCY_OVERVIEW.txt` (whole-venture
> summary for scaling) · `DESIGN_BRIEF.md` (UI/UX brief).

Last updated: 30 July 2026 · last commit `542150f`

---

## Status in one paragraph

Clancy HQ is built and live at **clancy-hq.vercel.app** (10 build batches,
~44 commits, 16 migrations). It is a genuine two-sided product: Jacky's agency
side (sales pipeline, client intake, two build briefs) and per-client workspaces
(configurable records, stages, tasks, calendar, people, broadcasts, team/roles,
website editor). Two live tenants: **Clancy** (own workspace) and **SGCKL** (a
real KL church — first client site at `/s/sgckl`). Latest deploy is green. No
paying client yet; company not yet registered; brand not yet launched.

---

## BLOCKED ON JACKY (do these first — everything below is waiting)

1. ~~Run migrations 015 + 016~~ — **DONE 30 Jul 2026, verified.** All
   migrations 001–016 are now applied. Broadcasts works; the editable Clancy
   homepage (`sites` row `clancy-home`) is live and saveable at
   Sites → "Clancy homepage".

2. **Automated email** — not live yet. Needs, on `clancy.hq.ai@gmail.com`:
   2-Step Verification on, then an App Password from
   myaccount.google.com/apppasswords. Add to Vercel env vars as
   `GMAIL_USER` and `GMAIL_APP_PASSWORD`, then redeploy.
   Until then: Broadcasts fall back to mail-app BCC batches, and Team invites
   fall back to a "Copy invite" button. Code is already written for both paths
   (`lib/email.ts` detects the env vars and switches automatically).

3. **Fix the calendar category colours (data repair).** The old bug minted
   category keys from the first keystroke, so existing SGCKL categories have
   colliding keys. The code is fixed; the stored data isn't. Repair: Team →
   Calendar categories → delete the three categories, re-add them, save. Then
   delete and re-add any events showing the wrong colour.

---

## KNOWN RISKS (unresolved, ranked)

- **No database backups.** Supabase free tier has none. SGCKL's congregation
  data is real people's contact details, and a bad delete is currently
  unrecoverable. Fix: upgrade Supabase to Pro (~USD 25/mo → daily backups +
  point-in-time recovery), or have Claude build an export-to-file feature.
  *This is the highest-value unresolved item on the whole project.*
- **Intra-workspace roles are enforced in the application layer**, not the
  database. The wall *between* client businesses IS database-enforced (RLS) and
  is solid. Harden roles to RLS before a client with adversarial-insider risk.
- **No entity registered** — contracts would name Jacky personally. Also the
  Vercel project still sits under a personal account named "MSA"; move it once
  the company exists.
- **PDPA** applies (storing clients' customers' data on their behalf).
- **Hours-per-client is not being tracked** — the number that drives the
  full-time gate and the hiring trigger. Start logging.

---

## OPEN DECISIONS (need Jacky's answer)

- **Full-time gate number** — the monthly revenue at which leaving the MegaStar
  Arena Director role becomes rational. Proposed placeholder: 3 consecutive
  months at RM 18k MRR with churn under 3%. Not confirmed.
- **SGCKL commercial terms** — live client, no agreement or pricing agreed.
  Pilot rate (RM 600/mo) or full (RM 1,200/mo)?
- **Vertical #1** — the plan says car workshops, but the first real client is a
  church. Churches look like a stronger vertical (recurring events, retention
  pipelines, weekly comms, tight referral networks). Worth reconsidering.
- **clancy.my** — not registered. Needed for credibility, email deliverability,
  and to move off Gmail SMTP to a proper email API.

---

## NEXT BUILD CANDIDATES (nothing started)

- **UI/UX redesign** — `DESIGN_BRIEF.md` is written and ready to hand to a
  design-focused conversation; implement whatever comes back.
- **Calendar day/week views** (month view only today).
- **Real alert delivery** for calendar events — the alert lead-time and
  department fields are captured and stored, but nothing sends yet (needs
  scheduled jobs + the email setup above).
- **Booking engine** (build-plan phase 2) — currently booking is a WhatsApp
  deep-link placeholder on client sites.
- **Vertical template packs** — snapshot SGCKL's configuration as the first
  reusable template so the next client starts pre-configured. Biggest lever on
  delivery time.
- **Export / backup feature** (see risks).
- **Follow-up sequences** (phase 2, needs email).

---

## TOOLING NOTE — Graphify (installed 30 Jul 2026)

A knowledge graph of the codebase is available. Installed via
`pip3 install --user uv` then `uv tool install "graphifyy[sql]"` (the standard
`curl | sh` installer was declined; `graphifyy` needs Python 3.10+, which uv
provides — system Python is 3.9.6 and was left untouched).

- Rebuild after code changes: `graphify update .` (free, local, no API key)
- Outputs in `graphify-out/` (gitignored): `graph.html` (interactive map),
  `GRAPH_REPORT.md` (summary), `graph.json`
- Current graph: 442 nodes · 1094 edges · 31 communities · 100% EXTRACTED
- Most-connected abstractions: `createClient()` (92 edges), `getMembership()`,
  `requireOrg()`, `Header()`, `requireEditorOrg()`. No import cycles.
- **Gotcha:** a rebuild can silently reuse a cached graph — delete
  `graphify-out/` first if results look unchanged.
- **Limitation:** the 9 business docs are NOT in the graph; semantic extraction
  of docs needs an LLM API key (a few cents per run). Code parsing needs none.

---

## WORKING RULES (unchanged — carry these into every session)

- **Draft-first**: plan a nontrivial batch in chat and get confirmation before
  coding.
- **Claude has no database access.** Paste SQL inline in chat; Jacky runs it in
  the Supabase SQL Editor; the file also lands in `supabase/` for history.
- **`npm run typecheck` before every push.** Push = production deploy (Vercel
  auto-deploys `main`) and stays permission-gated.
- **Product, not projects**: every client request lands as reusable config or a
  platform feature — never a bespoke fork for one client. This is the rule that
  makes scale possible.
- **No in-product AI** for clients (decided 7 Jul 2026). Don't re-suggest it.
- **No CHECK-constraint enums** in the database (the recurring MegaStar CRM
  production gotcha).
- Run npm commands from `~/Desktop/Claude/crm-platform` — the shell cwd resets
  between calls, and a stray `npm install` in the parent folder once broke the
  Vercel build.

---

## HARD LESSONS ALREADY PAID FOR (don't repeat)

1. Never save Vercel env values with browser autofill active — a silently
   corrupted anon key once broke every login.
2. Never delete rows in the Supabase Table Editor — `profiles`,
   `organizations`, `pipeline_stages` are load-bearing. Once wiped the profiles
   table and locked everyone out.
3. An unfiltered `.maybeSingle()` on `profiles` locked all admins out the
   moment a second user existed — always filter by the authed user's id.
4. Deps must be installed inside the project folder, not the parent.
5. Server time is UTC; Malaysia is +8. All date math goes through `lib/dates.ts`.
