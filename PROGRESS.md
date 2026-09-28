# Clancy — progress & session handoff

> **Read this first when starting a new session.** It records exactly where
> things stand, what is blocked on whom, and what to do next. Update it at the
> end of a working session.
>
> Companion docs: `CLAUDE.md` (canonical spec + full build history) ·
> `OPERATIONS.md` (how the business runs) · `CLANCY_OVERVIEW.txt` (whole-venture
> summary for scaling) · `DESIGN_BRIEF.md` (UI/UX brief).

> **Starting a session? Read `HANDOFF.md` first** — current state, how to
> verify a deploy, environment traps, and what to do next. (`HANDOFF-2026-09-15.md`
> is the previous session's handoff, kept for its login-bug diagnosis.)

Last updated: 28 September 2026 · Batch 19 pushed · production is
**clancyhq.com**, functions in **Singapore** (`sin1`, verified 28 Sep) ·
migrations **001–020** applied — 019 + 020 verified by `020_verify.sql` (15/15
on 28 Sep); 018 reported run by Jacky on 6 Sep but never independently checked

> **⚠️ MIGRATION 021 IS NOT YET RUN.** `supabase/021_security_hardening.sql`
> ships in this push but has not been applied to production. Two things stay
> broken until it is: changing a member's role on **Team** (it calls the new
> `set_member_role()`), and the new **Regenerate link** button on a client's
> intake tab (`regenerate_intake_token()`). Both now report an error rather
> than failing silently. Run the migration in the Supabase SQL editor, then
> run `supabase/021_verify.sql` and expect **ALL 32 CHECKS PASSED**. Read the
> two WARNING blocks first: section 4 prints a cross-workspace reference
> report and every count should be zero on real data.

---

## Status in one paragraph

Clancy HQ is built and live at **clancyhq.com** (18 build batches,
~60 commits, 20 migrations). Client workspaces now open on an **Overview**
dashboard (Batch 18). It is a genuine two-sided product: Jacky's agency
side (sales pipeline, client intake, three build briefs) and per-client workspaces
(configurable records, stages, tasks, calendar, people, broadcasts, team/roles,
website editor). Two live tenants: **Clancy** (own workspace) and **SGCKL** (a
real KL church — first client site at `/s/sgckl`). Latest deploy is green.
**Automated email is now live** (Gmail SMTP configured in Vercel — verified
with a simple send that landed in the main inbox as important). The app is
**responsive** since Batch 12 (works at 360px, unchanged at desktop). No
paying client yet; brand not yet launched. **Clancy Sdn Bhd is now
incorporated** (19 Sep 2026) — contracts can name the company.

Since mid-September the venture has **two product lines**, not one. See the
next section.

---

## SECOND PRODUCT LINE — plancy (iOS), added 16 Sep 2026

Clancy now sells two different things, and they share nothing but the company
and the domain. Keep them straight:

| | **Clancy HQ** (this repo) | **plancy.** (`~/plancy`) |
|---|---|---|
| What | Websites + CRM for local KL businesses | A daily planner for one person |
| Model | RM 1,200/mo managed, 12-month lock-in | US$4.99 once, paid before download |
| Buyer | Small business owners, sold in person | Strangers on the App Store |
| Delivery | Managed service, capacity-bound | Ships itself, capacity-free |
| Stack | Next.js 16 · Supabase · Vercel | Expo SDK 57 · SQLite on the device |
| Status | Live, 2 tenants, no paying client | ~70% built, target submission 9 Nov |

**Why this matters strategically.** Clancy HQ is capacity-bound — 3–5 managed
clients per part-time founder, and software is never the ceiling, delivery
hours are. plancy has the opposite shape: it takes real work up front and then
scales without consuming a single hour. It will not replace agency revenue
(500 units at $4.99 is roughly US$2,100 after Apple's 15%), but it is the
first thing Clancy sells that does not trade time for money, and it puts a
real consumer product under the brand.

**The risk to watch: founder attention.** Jacky has ~1–2 days a week for
Clancy in total, and plancy is currently taking most of it. SGCKL still has no
signed agreement and no agreed price — that is the *revenue* item, and it is
slipping while plancy is built. Do not let the App Store date eat the first
paying client.

**Where plancy's status lives:** `~/plancy/HANDOFF.md` (decisions, App Store
state, what's next) and `~/plancy/docs/` (seven specs written 18 Sep: PRD,
Architecture, UX, Design System, Implementation Guide, Test Spec, Release
Spec). Do not duplicate plancy's build detail into this file — link to it.

**D-U-N-S 473263782 issued 23 Sep 2026; Apple enrolment deliberately ON HOLD
since 24 Sep** while Jacky makes another round of product changes. Nothing is
lost by waiting. When it resumes: confirm the legal name and address D&B holds
against the D-U-N-S match the Sdn Bhd registration exactly first (the most
common organization-enrolment rejection). Order is in `~/plancy/HANDOFF.md`.

**plancy on 24 Sep:** every launch blocker in the code is done, and build 6 is
on Jacky's iPhone with task notes, one global add button, Lock Screen widgets
and drag-to-reorder anytime tasks. Next is tests, then App Store material.
Target submission is still the week of 9 Nov.

---

## OPEN ACTIONS FOR JACKY (do these first)

0. **Batch 18 — set your finish line, then smoke-test on real data.**
   Workflow → **Finish line → Active** → Save workflow. Until then the Overview
   treats *Renewal due* as done and counts every Active client as open work.
   Then: (a) open the Overview and check the numbers look like your business;
   (b) on a record with an unticked "blocks" item, change its Stage in the
   **edit form** — it must refuse with *"Couldn't save: Finish first: …"* (this
   save used to go straight through); (c) if SGCKL's first stage has a
   checklist, a new signup on `/s/sgckl` should now arrive with those tasks.
   020 passed 15/15 on a throwaway workspace; (b) and (c) are its first test on
   real records.

1. **Smoke-test the full Batch 11 broadcast — highest priority.** Automated
   email is live, but so far only a bare "test" (title + one word) has actually
   been sent. The Batch 11 features — file attachment, an **in-message** image,
   and the saved **sign-off** — are built and deployed but **never sent for
   real.** Before using broadcasts on SGCKL's congregation: send yourself one
   with a PDF, a photo toggled to "in message", and your Team sign-off, and
   confirm all three land correctly. "The pipe works" ≠ "the feature works".

2. **Delete the QA account now that Batch 12 is live.** A password account,
   `clancy.hq.ai+qa@gmail.com`, was created 2 Sep 2026 so the responsive pass
   could be verified on real pages (existing accounts are Google-OAuth-only and
   can't log in with a password). It currently holds Clancy workspace + admin.
   Revoke with:
   `delete from profiles where email = 'clancy.hq.ai+qa@gmail.com';`
   then delete the user in Supabase → Authentication → Users.
   Note `.env.local` now exists locally (gitignored) with the public Supabase
   URL + anon key, so `npm run dev` works on this machine.

3. **Set up the workspace sign-off if you haven't.** Team → Workspace settings
   → Email sign-off (logo, name, contact, small print). It's per-workspace, so
   Clancy and SGCKL each get their own. Empty = broadcasts send without a
   signature.

4. **Smoke-test Batch 13** (small): tick "Clancy staff" on a second account and
   confirm they can switch workspaces; send a broadcast to a typed address.

5. **Try the Workflow brief (Batch 16).** On a client: Intake → *Workflow
   mapping → Your process, step by step* now captures each step plus five
   questions (what happens here / who / how long / what blocks / what you wish
   was automatic). The whole section is **client-facing**, so you can send the
   intake link and let them describe it themselves. Then open the new
   **Workflow brief** tab and paste it here. Gaps are marked `_not given_`
   rather than guessed.

### Done since last session
- ~~Move the Vercel function region to Singapore~~ — **DONE 28 Sep, verified**:
  `x-vercel-id` now reads `sin1::sin1` (was `sin1::iad1` — functions in
  Washington, every query crossing the Pacific twice).
- ~~Migration 020~~ — **DONE 28 Sep, verified 15/15** by `020_verify.sql`.
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

## LATENCY PASS (9 Sep 2026)

Symptom: several seconds of loading on any click. Cause was request count, not
slow queries — every navigation ran the same auth work three times over, and
each Supabase round-trip is KL→Supabase→KL.

- **`createClient()` and membership are now memoised per request** (React
  `cache` in `lib/supabase/server.ts` and `loadMembership` in
  `lib/permissions.ts`), and the profile query embeds the organization, so slug
  + `crm_config` arrive in the same round-trip.
- **`Header` runs no auth queries of its own.** It reads the membership the
  page already loaded, then fetches unread count, own-site slug and (for
  platform admins) the org list in one parallel batch.
- **`requireOrg`/`requireAdmin` delegate to the cached membership**, and the
  server actions that only needed a user id (`addTask`, `addEvent`,
  `addRecord`) take it from there instead of calling `getUser()` again.
- **`proxy.ts` no longer validates the session over the network on every
  request.** It reads `expires_at` out of the session cookie and only calls
  `getUser()` when the token is within 120s of expiry (or the path is
  `/login`). This is a skip-work optimisation only — the cookie is unverified,
  every page and action still validates the user, and a forged unexpired
  cookie lands on `/login` (verified live). `/login` is deliberately excluded:
  bouncing to `/pipeline` on an invalid-but-unexpired cookie loops forever.
- **`/people` filters and searches in the browser** (`PeopleDirectory`).
  Chips were `?f=` links, so each click was a full server render: measured
  4–9ms and **zero network requests** now. The URL no longer carries the
  filter, which is the deliberate trade.
- **Broadcast previews reuse still-valid signed URLs** (`lib/signed-urls.ts`).
  A fresh token per render meant a guaranteed browser-cache miss, so the
  preview re-downloaded every image each time a broadcast was opened.
- `next.config.ts` pins `turbopack.root`: a stray `~/package-lock.json` was
  making Next infer the home directory as the workspace root.

Dev server on this machine: system node is v16 (Next 16 needs 20+). A
self-contained Node 22 lives at `~/.local/node/bin/node` — run
`~/.local/node/bin/node node_modules/next/dist/bin/next dev`.

---

## KNOWN RISKS (unresolved, ranked)

- **No database backups.** Supabase free tier has none. SGCKL's congregation
  data is real people's contact details, and a bad delete is currently
  unrecoverable. *This is the highest-value unresolved item on the whole
  project.* Decided fix path (5 Sep 2026): (a) build an in-app **export**
  feature now — works on any tier, doubles as a client-facing "your data is
  yours" feature and the PDPA portability answer; (b) upgrade to **Supabase
  Pro (~USD 25/mo)** the day the first client pays — daily backups +
  point-in-time recovery; (c) a scheduled dump from Supabase onto the
  **UGREEN NAS**, run by the **M4 Mac mini** (backup target only, NOT a
  production DB — see infra decisions below). As of 28 Sep the recommended next
  build is (c): nightly database + all three storage buckets → NAS, 14 daily /
  8 weekly / 12 monthly copies, and an alert if a night fails. ~Half a day.
  Mirror the NAS drive first — it is a single 10TB disk.
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
- ~~**No entity registered**~~ — **resolved 19 Sep 2026: Clancy Sdn Bhd is
  incorporated.** Two follow-ups remain: the Vercel project still sits under a
  personal account named "MSA" and should move to the company, and the SGCKL
  agreement should be issued in the company's name, not Jacky's.
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

- **Confirm the positioning drafted 21 Sep:** Clancy as a *curated operations
  ERP for service SMEs* — businesses where work moves through 3+ steps and 2+
  people touch each job (workshops, clinics, salons, contractors, tuition,
  events, churches, agencies). Not a fit: high-volume retail/F&B (need POS),
  manufacturing, stock-heavy distribution, accounting-led pain, solo operators.
  Sales qualifier: a fit if yes to 3+ of — 3+ steps? 2+ people per job? can
  name where jobs get lost? repeat/follow-up value? pain is coordination, not
  books or stock? Drafted, not yet confirmed.

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

## NEXT BUILD CANDIDATES (recommended order as of 28 Sep — confirm live)

1. **Nightly backups → NAS** (Mac mini runs it). Closes the top risk. Rule for
   anything on the home machines: **if a client depends on it, it runs in the
   cloud; if only Jacky depends on it, it can run at home.**
2. **Move Clancy's Claude Code sessions to the Mac mini.** This session ran on
   the MacBook Air (M2, 8GB), which sleeps with the lid closed and takes Remote
   Control with it; the mini stays on and holds the NAS.
3. **Monday client report** — a scheduled check across every client workspace
   (stuck records, overdue tasks, uncontacted leads, failed sends). Builds on
   Batch 18's `stage_entered_at` / `stage_transitions`.
4. **Rules engine** — curated, named automations picked per client (the
   Workflow brief's automation wishlist says which first). **Not** a rule
   builder: Dolibarr's workflow module is a checkbox list for a reason.
5. **Workflow packs** — snapshot a client's stages + checklists + config as a
   reusable pack. The lever that cuts hours per client, i.e. the route to the
   full-time gate.
6. **Time tracking** against records — closes the hours-per-client risk.
7. Later / demand-gated: record linking + global search, audit trail (stage
   history is already being recorded), calendar day/week views, alert delivery
   (needs cron), booking engine, follow-up sequences, UI/UX redesign
   (`DESIGN_BRIEF.md`), export feature, inventory.

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
- **`npm test` covers the pure logic** (stage checklists, broadcast recipients,
  workflow-step parsing, KL dates). Dependency-free: it compiles `tests/` with
  the project's own `tsc` and runs it on plain node, so it works on any machine
  and adds nothing to the Vercel build. Run it after touching `lib/checklist.ts`,
  `lib/audience.ts`, `lib/intake.ts`, or `lib/dates.ts`.
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
