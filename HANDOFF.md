# Clancy — handoff

> **Read this first, then `PROGRESS.md`.** Updated 28 Sep 2026 after Batch 18.
> This is the one current handoff; `HANDOFF-2026-09-15.md` is kept only for its
> login-bug diagnosis and should not be followed for current state.

---

## 1. Where things stand

Clancy HQ is live at **clancyhq.com** (also `clancy-hq.vercel.app`). Next.js 16
on Vercel, functions in **Singapore** since 28 Sep, Supabase in Singapore.
19 build batches, migrations **001–020 applied, 021 pending**. Two tenants:
**Clancy** (own workspace, sales board) and **SGCKL** — a **test tenant, not a
client** (a KL church site at `/s/sgckl`). **No paying client yet.** Clancy Sdn
Bhd was incorporated 19 Sep. The company also sells an unrelated iOS app,
**plancy** (`~/plancy`, own `HANDOFF.md`).

Latest code: **Batch 19, `8be97a7`** — tenancy and permission invariants,
pushed 28 Sep by Ivan Cheah and live. **Its migration 021 has not been
confirmed run** — read the ⚠️ block at the top of `PROGRESS.md` and open
action 0 before anything else. Before that, Batch 18 (`ff97d1a`): the
Overview dashboard plus the stage rules moved into a database trigger. Full
history: the build log in `CLAUDE.md` (Batch 19 not yet logged there).

An **App Store version of Clancy** was discussed 28 Sep – 1 Oct and is
**parked** as a future idea — see *PARKED IDEA* in `PROGRESS.md`.

---

## 2. Starting a session

```bash
cd ~/Developer/Claude/crm-platform
git pull --ff-only
npm run typecheck && npm test      # expect: clean, 55 passed
```

**Machines.** Since 2 Oct the desktop-app sessions run on the **M4 Mac mini
(32GB)**, which stays on, has the UGREEN NAS mounted, and keeps Remote Control
(steer sessions from the iPhone) available. The Mac user is `clancy`, so the
repo is at `/Users/clancy/Developer/Claude/crm-platform`. Node 24 LTS is the
nodejs.org install at `/usr/local/bin/node` (no Homebrew Node, on purpose);
git, `gh` and Xcode 27 all work. The **MacBook Air** is Jacky's personal Mac
again. The repo used to sit on the Air's Desktop, where iCloud made `" 2"`
conflict copies inside `.next/`; `~/Developer` is outside iCloud, so that
"Duplicate identifier" typecheck failure shouldn't come back. Section 9 lists
traps hit on the machine the 15 Sep Ghostty session used.

---

## 3. The rules (unchanged — this is how Clancy is built)

1. **Draft first.** For any nontrivial batch, plan in chat and wait for "go".
2. **No database access for Claude.** SQL goes in chat and in `supabase/`;
   Jacky runs it in the Supabase SQL editor. **The SQL runs before the code that
   needs it deploys** — otherwise production errors on missing columns.
3. **`npm run typecheck` and `npm test` before every push.**
4. **Push to `main` = production deploy.** Permission-gated: ask first.
5. **Product, not projects.** Every client request becomes reusable config or a
   platform feature, never a one-client fork.
6. **No in-product AI** in the client product (decided 7 Jul). Claude Code as
   Jacky's build tool is fine and is the engine behind the brief → config loop.
7. **No database CHECK-constraint enums** (the MegaStar CRM production gotcha).

---

## 4. How to verify a deploy — read this, it was done wrong before

**A signed-out 307 proves nothing.** `proxy.ts` redirects every signed-out
request to `/login` *before* routing, so a route that doesn't exist also
returns 307. `/overview` returned 307 before it was deployed. Earlier sessions
claimed "the new route returns 307, so the new build is live" — that was never
evidence.

What does work — the static-chunk fingerprint of `/login`, which changes with
every build. Record it before pushing, then poll:

```bash
curl -s https://clancyhq.com/login | grep -oE '/_next/static/[^"]+' | sort -u | shasum | cut -c1-12
```

Changed and stable across a few fetches = the new build is serving.

**Function region:** `curl -sI https://clancyhq.com/ | grep -i x-vercel-id` —
the second segment is where functions run. It must read `sin1::sin1`. `iad1`
would mean every database query is crossing the Pacific again.

**Signed-in pages can't be checked from the terminal** — Claude has no login.
Say plainly what was verified (typecheck, tests, build, the SQL verify script)
and hand the signed-in check to Jacky with exact steps.

---

## 5. The stage rules live in the database — don't re-add them in app code

Six code paths change a record's stage: the board dropdown, both edit forms,
both create forms, and the website form's `submit_lead()` SQL. App-level hooks
kept getting missed on some of them (three bugs in a row), so since migration
020 a **trigger on `clients`** does all of it:

- refuses a **forward** move past unfinished "must finish first" items, with
  the message `Finish first: …` (backward moves are never blocked)
- stamps `stage_entered_at` — only when the stage actually changes
- writes a `stage_transitions` row
- calls **`generate_stage_tasks()`**, the one implementation of checklist
  generation; the "Add this stage's tasks" button calls the same function

A trigger on `tasks` stamps `completed_at`. Any new stage-related rule belongs
in that trigger, not in a server action. To prove a trigger change, extend
`supabase/020_verify.sql` — it builds a throwaway workspace, exercises every
rule, and rolls everything back; Jacky runs it and pastes the result.

---

## 6. Recently shipped

| Batch | What |
|---|---|
| 16 | Workflow brief — clients describe their own process on the intake link |
| 17 | Fix: `/workflow` silently wiped checklists (stale `useState` after a redirect) |
| 18 | **Overview** dashboard (home for client workspaces), **finish line** on `/workflow`, stage rules in the database, `/home` decides every post-login landing |

---

## 7. What Jacky needs to do next

Full list with detail in `PROGRESS.md` → *Open actions*. The top three:

1. **Workflow → Finish line → Active**, then smoke-test Batch 18 on real data.
2. **Send one real broadcast to yourself** — PDF, an image set to "in
   message", and the sign-off. Still never done since Batch 11.
3. **Supabase → Authentication → URL Configuration:** Site URL
   `https://clancyhq.com`; Redirect URLs `https://clancyhq.com/auth/callback`,
   `https://clancy-hq.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`.
   Without it, every Google login takes an extra hop via the marketing page.

**Recommended next build:** nightly Supabase → NAS backups, run by the Mac mini.
It closes the top risk on the whole project (there are no database backups).

---

## 8. Decided, and drafted

**Decided — don't reopen:** stay on Supabase, not Neon · the NAS is a backup
target, never a production database · infrastructure stays Clancy-owned, and
clients own their *domain* instead · Overview is home for client workspaces ·
stuck = amber from 7 days, red from 14 · the rules engine will be a curated
list of named automations, not a rule builder.

**The rule for the home machines:** if a client depends on it, it runs in the
cloud; if only Jacky depends on it, it can run on the Mac mini.

**Drafted, awaiting Jacky's confirmation:** positioning as a *curated operations
ERP for service SMEs*, with a five-question sales qualifier — see `PROGRESS.md`
→ *Open decisions*.

---

## 9. Environment traps from the 15 Sep Ghostty session

None of these apply on the Mac mini (nor did they on the MacBook Air). They
were hit on the machine the 15 Sep session ran on — check `which node`, `which git` and `git status` before
trusting a failure there.

- **macOS privacy block on `~/Desktop`.** After an agent update, every read
  failed with `EPERM` and git reported *"Unable to read current working
  directory"*. Fix: grant the terminal **Full Disk Access** again (toggle it off
  and on), or move the repo off the Desktop.
- **System Node was v16**; Next 16 needs 20+. A Node 22 lived at
  `~/.local/node/bin/node`.
- **`/usr/bin/git` failed** with an invalid developer path; `xcode-select --install`
  fixes it, and Homebrew's `/usr/local/bin/git` worked meanwhile.
- A stray `~/package-lock.json` once made Turbopack pick the home directory as
  its root; `next.config.ts` now pins `turbopack.root`.

---

## 10. Gotchas that cost time

- **Never commit a `package-lock.json` rewritten by a different npm version.**
  It dropped the Linux-only native packages Vercel needs to build (reverted in
  `1fc5dcb`). Check `git status` before committing.
- **Run `npm` inside the repo**, never the parent folder — a stray install there
  once broke the Vercel build.
- **A Server Component `redirect()` looks like HTTP 200 in dev**, with the
  target inside the streamed payload. Production gives a real 307.
- **`useState(initial)` only seeds on mount.** After a same-page redirect React
  reuses the component and keeps stale state. Key the component on the server
  data (`WorkflowEditor`, the finish-line `<select>`).
- **PostgREST `or()` filters:** quote values that contain `.` or `:` —
  timestamps have both.
- **PL/pgSQL:** `text[] || 'literal'` can parse as array + array literal and
  fail; use `array_append()`.
- **Four docs were once left uncommitted by a parallel session.** Before
  committing, read `git diff` for anything you didn't write, and commit other
  sessions' edits separately from your own.

---

## Doc map

| File | What it's for |
|---|---|
| `HANDOFF.md` | This file — read first. |
| `PROGRESS.md` | Current state, open actions, risks, open decisions, next builds. |
| `CLAUDE.md` | Canonical spec and the full build history, batch by batch. |
| `OPERATIONS.md` | How the business runs, stage by stage. |
| `CLANCY_OVERVIEW.txt` | Whole-venture summary. |
| `DESIGN_BRIEF.md` | Paste-ready brief for a UI/UX pass. |
| `supabase/*.sql` | Migrations 001–020, plus `020_verify.sql`. |
| `~/plancy/HANDOFF.md` | The separate iOS product. |
