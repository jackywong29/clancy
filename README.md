# Clancy

**A CRM and automation platform for local businesses — built as one multi-tenant product, not a folder of client projects.**

Clancy gives a small business two things from a single account: their **public website** and their **internal CRM**. Both are configuration, not custom code — which is what makes one codebase serve every client.

Live: [clancy-hq.vercel.app](https://clancy-hq.vercel.app)

---

## The problem

A local business — a car workshop, a restaurant, a handmade brand — usually runs on a stack of disconnected things: a Wix site nobody updates, a WhatsApp inbox, a notebook of jobs, a Google Sheet of customers, and no follow-up at all. Leads arrive and quietly die. The tools that fix this (HubSpot, GoHighLevel, Zoho) are priced and shaped for teams that have someone to configure them.

Clancy's answer is a **productized service**: the platform is shared, but each business gets its workspace configured *for their actual workflow* by someone who does it for a living, then keeps running it.

## What it does

Seven features, no in-product AI:

| | |
|---|---|
| **Website** | A templated public site per client at `/s/<slug>`, rendered from JSON config — sections, theme, typography, gallery, FAQ, socials, favicon |
| **Lead pipeline** | A configurable 6–9 stage kanban board; stages are data, renameable and reorderable per workspace |
| **CRM & contacts** | Per-workspace record types with custom fields — adding a field never requires a migration |
| **Tasks & calendar** | Assignable tasks with department scoping; month-grid calendar with recurrence and categories |
| **Broadcasts** | HTML email announcements to records or team, with attachments and a per-workspace sign-off block |
| **Unified inbox** | Website form submissions land as CRM records plus a notification; more channels are demand-gated |
| **Follow-ups & reviews** | Deterministic templated automations — trigger + template + merge fields, hard-capped outbound |

**Automation here is deterministic on purpose.** No model writes a customer-facing message. A trigger fires, a template fills, a rate limit applies. That removes both per-tenant AI cost and the liability of a machine improvising in a client's name.

## Architecture

- **True multi-tenant from day one.** One codebase, one database. Every table carries `organization_id` and is protected by Postgres **RLS**. One org = one client.
- **Configuration as data, never enums in DDL.** Pipeline stages, record fields, departments, roles, calendar categories, and site sections all live in JSONB (`organizations.crm_config`, `sites.config`) or their own rows. A `CHECK` constraint enforcing a hardcoded enum is the exact production gotcha this project was built to avoid.
- **Own the layer that differentiates; compose the rest.** The CRM, pipeline, and orchestration are original code. Deliverability, SMS, and reviews integrate best-in-class APIs (an email API, Twilio, Google Business Profile) rather than being rebuilt.
- **Two surfaces, one intake.** A single client intake produces two build briefs — one for the website, one for the CRM — so both sides of a client's setup come from the same answers.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind · Supabase (Postgres + Auth + Storage, RLS everywhere) · nodemailer over SMTP · Vercel.

## Repo layout

```
app/            routes — pipeline, clients, records, crm, tasks, calendar,
                broadcasts, people, team, sites, notifications, stages,
                s/[slug] (public client sites), i/[token] (client intake links)
components/     UI — boards, editors, uploads, nav, calendar, intake, team
lib/            actions.ts (server actions) · permissions · intake · sections
                fonts · dates (Malaysia time) · email · broadcast-email
                audience · recurrence · crm
supabase/       schema.sql + numbered migrations (002 … 017)
types/          generated database types
docs/agents/    agent conventions — issue tracker, triage labels, domain docs
```

## Running it

```bash
npm install
cp .env.example .env.local   # Supabase URL + anon key
npm run dev
npm run typecheck            # required before every push
```

Migrations are applied by hand in the Supabase SQL editor, in numeric order, with `schema.sql` kept current as they accrue.

## Product shape

Every client starts on **Managed** — Clancy configures the workspace to their workflow and runs it for them through the first year. At renewal they either continue Managed or drop to **Self-Serve** on the same platform, same account, same data. That is a plan flip, not a migration: nobody gets handed a standalone instance, because there aren't any.

The rule that keeps this true: **product, not projects.** Anything a client asks for lands as reusable configuration or a platform feature. Never a fork.

## Project docs

`CLAUDE.md` is the canonical spec — strategy, scope, architecture rules, and every shipped batch. `PROGRESS.md` is the session handoff. `OPERATIONS.md` is the runbook for how the business actually runs. `DESIGN_BRIEF.md` covers the UI, `branding-marketing.md` the identity.

---

Clancy is in active development, currently serving pilot workspaces. Not accepting external contributions.
