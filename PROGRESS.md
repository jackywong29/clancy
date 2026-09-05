# Clancy — progress & session handoff

> **Read this first when starting a new session.** It records exactly where
> things stand, what is blocked on whom, and what to do next. Update it at the
> end of a working session.
>
> Companion docs: `CLAUDE.md` (canonical spec + full build history) ·
> `OPERATIONS.md` (how the business runs) · `CLANCY_OVERVIEW.txt` (whole-venture
> summary for scaling) · `DESIGN_BRIEF.md` (UI/UX brief).

Last updated: 6 September 2026 · Batch 12 deployed · migrations 001–018 applied

---

## Status in one paragraph

Clancy HQ is built and live at **clancy-hq.vercel.app** (12 build batches,
~48 commits, 18 migrations). It is a genuine two-sided product: Jacky's agency
side (sales pipeline, client intake, two build briefs) and per-client workspaces
(configurable records, stages, tasks, calendar, people, broadcasts, team/roles,
website editor). Two live tenants: **Clancy** (own workspace) and **SGCKL** (a
real KL church — first client site at `/s/sgckl`). Latest deploy is green.
**Automated email is now live** (Gmail SMTP configured in Vercel — verified
with a simple send that landed in the main inbox as important). No
paying client yet; company not yet registered; brand not yet launched.

---

## OPEN ACTIONS FOR JACKY (do these first)

1. **Smoke-test the full Batch 11 broadcast — highest priority.** Automated
   email is live, but so far only a bare "test" (title + one word) has actually
   been sent. The Batch 11 features — file attachment, an **in-message** image,
   and the saved **sign-off** — are built and deployed but **never sent for
   real.** Before using broadcasts on SGCKL's congregation: send yourself one
   with a PDF, a photo toggled to "in message", and your Team sign-off, and
   confirm all three land correctly. "The pipe works" ≠ "the feature works".

2. **Set up the workspace sign-off if you haven't.** Team → Workspace settings
   → Email sign-off (logo, name, contact, small print). It's per-workspace, so
   Clancy and SGCKL each get their own. Empty = broadcasts send without a
   signature.

3. **Smoke-test Batch 12** (small): tick "Clancy staff" on a second account and
   confirm they can switch workspaces; send a broadcast to a typed address.

### Done since last session
- ~~Run migration 017~~ — **DONE**, run before the Batch 11 push. Migrations
  001–017 all applied.
- ~~Run migrations 015 + 016~~ — **DONE, verified.** Broadcasts works; editable
  Clancy homepage (`sites` row `clancy-home`) live at Sites → "Clancy homepage".
- ~~Automated email~~ — **DONE, live & verified.** Gmail SMTP configured in
  Vercel (`GMAIL_USER` + `GMAIL_APP_PASSWORD` on `clancy.hq.ai@gmail.com`).
  Broadcasts now send for real (BCC batches of 40) and invites email
  automatically; the mailto/copy-link paths are now just the fallback when the
  env vars are absent. `lib/email.ts` detects and switches automatically.

### Deferred (off the critical path)
- **Calendar category colour repair (SGCKL).** The old bug minted category keys
  from the first keystroke, so existing SGCKL categories have colliding keys.
  Code is fixed; stored data isn't. Repair when there's calendar activity: Team
  → Calendar categories → delete the three, re-add, save; then re-add any
  mis-coloured events. Low priority until the calendar is in real use.

---

## KNOWN RISKS (unresolved, ranked)

- **No database backups.** Supabase free tier has none. SGCKL's congregation
  data is real people's contact details, and a bad delete is currently
  unrecoverable. *This is the highest-value unresolved item on the whole
  project.* Decided fix path (5 Sep 2026): (a) build an in-app **export**
  feature now — works on any tier, doubles as a client-facing "your data is
  yours" feature and the PDPA portability answer; (b) upgrade to **Supabase
  Pro (~USD 25/mo)** the day the first client pays — daily backups +
  point-in-time recovery; (c) optional third leg — a scheduled dump from
  Supabase onto Jacky's new **UGREEN NAS** (backup target only, NOT a
  production DB — see infra decisions below). Export is a strong candidate for
  the next batch but is **not yet committed** (decide live).
- **Email deliverability from a plain Gmail address.** Automated email is live,
  but sends from `clancy.hq.ai@gmail.com` with no SPF/DKIM on a real sending
  domain, and Gmail caps ~500 recipients/day. Fine at current scale (a simple
  send landed in the main inbox), but HTML newsletters with attachments to
  100+ BCC recipients are a spam-filter target. Proper fix rides on
  registering **clancy.my** → move to Resend. The broadcast code is already
  provider-agnostic and swaps cleanly.
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

## DECIDED THIS SESSION (5 Sep 2026 — canonical home is CLAUDE.md)

- **Database stays on Supabase, NOT Neon.** Neon is Postgres-only; moving there
  means rebuilding auth + storage and rewriting every RLS policy (the one part
  that's genuinely solid). Not worth dodging a ~$25/mo bill.
- **The UGREEN NAS is a backup target, NOT a production database.** Capable
  hardware, wrong place: the app runs on Vercel, so a home-hosted DB puts every
  client site behind Jacky's home internet/power, and one 10TB drive is zero
  redundancy. Use it for scheduled dumps (mirror the drive; add a cheap offsite
  copy as the third leg since NAS + Mac mini share one building).
- **Infrastructure stays Clancy-owned (shared multi-tenant), NOT per-client
  Vercel/Supabase accounts.** Client-owned breaks multi-tenant (1 app = 1 DB),
  turns one bug-fix into N deploys, and kills the template strategy. The
  ownership clients actually care about is delivered by registering each
  client's **domain in their name**, pointed at Clancy infra — costs nothing,
  changes no architecture, and paired with the export feature gives honest
  portability.

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

## NEXT BUILD CANDIDATES (next batch left OPEN — decide live in the terminal)

- **Export / backup (strong recommendation).** In-app, workspace-scoped export
  (CSV per table + one JSON dump incl. `crm_config` and `sites.config`). Kills
  the top risk, is a client-facing feature, and answers PDPA portability in one
  build. ~half a day, likely no migration. Optionally pair with the scheduled
  NAS dump. *Recommended first, but not committed.*
- **UI/UX redesign** — `DESIGN_BRIEF.md` is written and ready to hand to a
  design-focused conversation; implement whatever comes back.
- **Calendar day/week views** (month view only today).
- **Real alert delivery** for calendar events — alert lead-time + department
  fields are captured and stored; email sending is now live, so this only needs
  the **scheduled-jobs** half (cron) to actually fire.
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
