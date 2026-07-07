# Clancy — operations runbook

How the business runs, start to finish. For Jacky and Claude — read this to recall the whole system anytime. (Last updated 2026-07-07, after the first end-to-end intake → brief → file-download loop was verified live.)

## The system at a glance

- **App:** https://clancy-hq.vercel.app — sign in with Google
- **Pages:** Pipeline (the board) · Add client · Stages (edit pipeline stages) · Team (grant/revoke access) · per-client: Details / Intake / Build brief
- **The core loop:** everything about a client lives in Clancy → the Build brief exports it → Jacky pastes the brief to Claude → Claude builds/updates the client's system.

## The client lifecycle, stage by stage

**1. Lead** — heard of a prospect? *Add client* — name is enough; set vertical + source. They appear on the board.

**2. Pitched** — run the pitch meeting per `sales-proposal-template.md`: open with their pain (4 discovery questions), demo live, sketch THEIR pipeline on paper, and book the intake conversation before leaving. Move the card, jot meeting notes on Details.

**3. Intake** — the 45–60 min conversation. Open the client's *Intake* tab and fill sections 1–5 while they talk (tips box on the page). Upload logo/photos/files as they send them. Blocking items (red ★) are tracked automatically; the progress bar shows on their pipeline card.

**4. Trial live** — once intake sections 1–4 are in: *Build brief* tab → **Copy brief** → paste to Claude with "build the trial for [client]". Claude downloads the files from the brief's 7-day links and builds. Send the client their link: "It's live. Try booking yourself in."

**5. Signed** — quote per the playbook: **RM 1,200/mo Managed, free setup, 12-month lock-in** (pilot clients: RM 600/mo year one). Agreement + PDPA signed → tick section 9 in Intake, set Tier / MRR / Lock-in start / Renewal date on Details.

**6. Onboarding** — chase the remaining blockers (always photos + Google Business Profile access + domain). When the intake is complete: full brief → Claude → production build. 30-min handover call with their staff.

**7. Active** — the managed year. Client requests arrive on WhatsApp → collect them in the client's Notes → **batch weekly**: paste the batch to Claude in one go ("this week for [client]: …"). Never promise on-demand turnaround.

**8. Renewal due** — move the card at month 11. The conversation: renew Managed at RM 1,200, or switch to Self-Serve at RM 500 (same system, same data, they drive). No pressure — a Self-Serve client at zero hours is still a good client.

## Working with Claude

- **The brief is the handoff.** Copy it, paste it, say what you want. It contains everything, including downloadable file links (valid 7 days — regenerate the brief if links expire).
- New client system = "build [client]". Changes = "for [client]: …" with the relevant request batch.
- Claude works in `~/Desktop/Claude/crm-platform` — draft-first for anything nontrivial, typecheck before push, push = production deploy (gated).
- Database changes: Claude pastes SQL in chat → Jacky runs it in Supabase SQL Editor → the file also lands in `supabase/` for history.

## Admin how-tos

- **Grant/revoke access:** Team page (new signups land in "no access" until granted — including future client staff, who'll get their own workspace).
- **Change pipeline stages:** Stages page. A stage with clients can't be deleted — move them first.
- **Delete a client:** bottom of their Details tab (removes their intake too).
- **If something errors:** every save shows the real reason on screen — screenshot it and paste to Claude.

## Infrastructure map

| Piece | Where |
|---|---|
| Production app | clancy-hq.vercel.app (Vercel, auto-deploys from `main`) |
| Code | github.com/jackywong29/clancy · local `~/Desktop/Claude/crm-platform` |
| Database / auth / file storage | Supabase project `zxmklxmtsfercytmpjen` (own Clancy org, Singapore) |
| Google sign-in | Google Cloud project "Clancy" (consent screen in Testing — only test-user emails can Google-login) |
| Env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` |

Migrations applied: 001 core schema · 002 open signup · 004 team/admin (+005 repair) · 006 intakes + file storage. (003 was superseded by 006.)

Hard lessons already paid for — don't repeat: (1) never save Vercel env values with the "Sensitive" toggle + browser autofill active — a silently corrupted key once broke every login; (2) never delete rows in Supabase Table Editor — profiles/organizations/stages are load-bearing; change data through the app or SQL only.

## Open items

- Landing page CTA is a mailto placeholder → replace with business WhatsApp link
- Register `clancy.my` → add as custom domain on Vercel
- Entity registration (Jacky confirms when done — then transfer Vercel project to a Clancy team, contracts in company name)
- Full-time gate number (see `five-year-plan.md`)
- Batch 4 candidates: client-facing intake link · weekly requests queue · hours log per client
