# Clancy — terminal handoff

> One-time orientation for continuing Clancy from **Ghostty + Claude Code CLI**
> (instead of the Claude desktop app). Written 5 Sep 2026. Once you're
> comfortable driving from the terminal, the living docs below are the real
> source of truth — this file just gets you launched.

---

## Launch

```bash
cd ~/Desktop/Claude/crm-platform && claude
```

Claude auto-reads `CLAUDE.md` on start. **First thing to tell it each session:**
"read PROGRESS.md, then tell me where we left off." That's the session handoff —
current state, open actions, decisions, risks.

Always run from `~/Desktop/Claude/crm-platform`, never the parent
`~/Desktop/Claude`. A stray `npm install` in the parent once broke the Vercel
build. (The shell cwd can reset between Claude's tool calls — this only matters
for commands you run yourself.)

---

## The golden rules (unchanged — these are how Clancy is built)

1. **Draft-first.** For any nontrivial batch, Claude plans in chat and waits for
   your "go" before writing code. Hold it to this.
2. **No database access.** Claude can't touch Supabase. It pastes SQL inline in
   chat → you run it in the Supabase SQL Editor → the file also lands in
   `supabase/` for history. **Run the SQL before the code that needs it deploys.**
3. **`npm run typecheck` before every push.** Non-negotiable.
4. **Push = production deploy.** Vercel auto-deploys `main`. Pushing is
   permission-gated — Claude asks first. Nothing reaches SGCKL without your yes.
5. **Product, not projects.** Every client request lands as reusable config or a
   platform feature — never a bespoke fork. This is the rule that makes scale
   possible.

---

## What's different in the terminal vs the desktop app

- **Interactive slash-commands now work:** `/permissions`, `/config`, `/model`,
  `/hooks`, `/fast`. These were blocked in the desktop app — in Ghostty they
  open real dialogs.
- **Install `gh`** so Claude can check Vercel deploy status and manage PRs:
  ```bash
  brew install gh && gh auth login
  ```
  (It's not installed yet — noticed this session when Claude couldn't read the
  deploy status after a push.)
- **Verify the toolchain** if anything acts up: `node -v` (was v24.16.0),
  `npm -v` (11.13.0), `git status`.
- **If `npm run typecheck` fails with "Duplicate identifier" errors in
  `.next/types/…d 2.ts`** — that's iCloud sync making conflict copies inside
  the build cache, not a real error. This recurs. Clear it with:
  ```bash
  find .next -name "* 2.*" -delete
  ```
  Your source tree is unaffected; only the gitignored `.next/` cache gets hit.
- **Browser preview / Artifacts** may not be available the same way as the app.
  For UI changes, `npm run dev` and check in your own browser.

---

## Where things stand (5 Sep 2026)

Clancy HQ is live at **clancy-hq.vercel.app** — 11 build batches, 17 migrations,
deploy green. Two live tenants: **Clancy** (own workspace) + **SGCKL** (real KL
church, first client site at `/s/sgckl`). No paying client yet; entity not
registered; brand not launched.

**Latest work (Batch 11):** broadcasts got file/image attachments, HTML email,
and a per-workspace sign-off block. **Automated email is now live** (Gmail SMTP
in Vercel) — broadcasts and invites send for real.

---

## Do these first (from PROGRESS.md — full detail there)

1. **Smoke-test the full broadcast — top priority.** Email is live, but only a
   bare "test" has actually been sent. The Batch 11 features (attachment,
   in-message image, saved sign-off) have **never been sent for real.** Before
   any congregation-wide send: mail yourself one with a PDF, a photo set to "in
   message", and your sign-off; confirm all three land.
2. **Set your workspace sign-off** if you haven't (Team → Workspace settings →
   Email sign-off).

**Next batch is left OPEN — decide it live.** Strong recommendation:
**export / backup** (kills the top risk = no DB backups, doubles as a
client-facing "your data is yours" feature + PDPA portability, ~half a day, no
migration). Other candidates: UI/UX redesign (`DESIGN_BRIEF.md` is ready),
calendar day/week views, real alert delivery (email half is done, needs cron).

---

## Decisions locked this session (don't relitigate — full reasoning in CLAUDE.md)

- **Stay on Supabase, not Neon** — Neon is Postgres-only; switching means
  rebuilding auth + storage + every RLS policy.
- **NAS = backup target, not production DB** — app is on Vercel; home-hosting
  puts client sites behind home internet/power, and one drive is zero redundancy.
- **Infra stays Clancy-owned, not per-client accounts** — client-owned breaks
  multi-tenant and the template strategy. Data ownership is delivered by
  registering each client's **domain in their name**, pointed at Clancy infra.

---

## Doc map

| File | What it's for |
|---|---|
| `PROGRESS.md` | **Read first every session.** Current state, open actions, decisions, risks. Update it at session end. |
| `CLAUDE.md` | Canonical spec + full build history. Update when a decision changes. |
| `OPERATIONS.md` | How the business runs, stage by stage (lifecycle, admin how-tos, infra map). |
| `HANDOFF.md` | This file — one-time terminal orientation. |
| `DESIGN_BRIEF.md` | Paste-ready UI/UX brief when you want a design pass. |
| `supabase/*.sql` | Migration history (001–017). |
