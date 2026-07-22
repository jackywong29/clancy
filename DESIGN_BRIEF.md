# Design brief — Clancy (UI/UX improvement)

> Paste-ready brief for a design-focused conversation. Kept in the repo so it
> stays with the project. Update the design tokens here if the theme changes.

## What Clancy is
Clancy is a productized SaaS platform sold to local businesses in Malaysia (KL) —
a church, a car workshop, an F&B shop, etc. For each client, Clancy builds TWO
things from one system:
1. **A public website** (the frontend) — their marketing site.
2. **A CRM / internal management app** (the backend) — where their staff track
   members/customers/jobs, tasks, calendar, etc.

Multi-tenant: one shared Next.js codebase, every client is an
"organization/workspace", and everything is **config-driven** (JSON in the
database), NOT bespoke per client. Any design must be a reusable template
rendered from config — never one-off hand-coding per client.

Tech: Next.js 16 (App Router, React Server Components), Tailwind CSS v4,
Supabase, deployed on Vercel. Jacky isn't a coder — an AI builds it — so design
suggestions must be concrete and implementable in Tailwind within this stack.

Brand positioning: premium, minimal, trustworthy (RM 1,200/month). Tagline:
"Built in days. Managed for you." Wordmark: lowercase "clancy" with a violet
full stop. Users are non-technical SME owners and their staff, many on phones —
must be dead simple to operate while looking expensive.

---

## SURFACE 1 — The CRM / admin app (backend) — "Clancy HQ"
Dark, premium admin UI at clancy-hq.vercel.app.

**Current design tokens (keep the identity, improve the execution):**
- Background (graphite): `#1E1D21`
- Card surface (carbon): `#26252B`
- Borders (ash): `#3A3940`
- Text (ivory): `#F4EFE6` (muted = 60%, faint = 40%)
- Accent (violet): `#6D5EF0` · deep violet for buttons: `#5646E5`
- Font: geometric sans (currently Avenir Next/Futura fallback — open to a web
  Google Font like Jost/Poppins/Geist)
- Cards: rounded-xl (12px), 0.5px borders, generous whitespace, flat (no heavy
  shadows)

**Page inventory (functional but utilitarian — want cleaner, more polished,
more intuitive, stronger hierarchy):**
- **Board/Pipeline** — kanban of horizontal stage columns with record cards that
  move between stages. Metric cards on top (totals, MRR).
- **Tasks** — list grouped by status (To do / In progress / Done); assignee,
  due date, department, overdue highlighting.
- **Calendar** — month grid; colour-coded category events (with legend),
  recurring events, all-day, task due dates as checkboxes. Want Apple-Calendar
  polish, eventually day/week views.
- **People** — directory of everyone (records website vs manual, plus team),
  filter chips + search.
- **Broadcasts** — compose email announcements/newsletters (To/Subject/Message,
  Apple-Mail style). Hardest to make understandable — needs the clearest UX.
- **Team** — members with roles (renameable viewer/editor/admin), email invites,
  departments, calendar categories.
- **Sites, Customize, Stages, Inbox (notifications), Client intake forms,
  Build briefs.**
- **Top nav**: horizontal header with lucide icons + active-state underline,
  workspace switcher, inbox badge. Needs to feel cleaner and scale on mobile.

**Goals:** modern, calm, premium dark UI; strong hierarchy; obvious primary
actions; friendly empty states; excellent mobile layout (staff use phones);
consistent component system (cards, buttons, inputs, chips, tables). Make
complex pages (Broadcasts, Calendar, Team) feel simple.

---

## SURFACE 2 — The client websites (frontend)
Public marketing sites at clancy-hq.vercel.app/s/&lt;client-slug&gt;. LIGHT theme
by default. Each rendered from a per-client JSON config — the design is a
flexible TEMPLATE.

**Current config controls:**
- Theme (light/dark), custom background colour or image, accent colour, text
  colour
- Font (curated Google Fonts + custom), per-text-type typography
  (headings/body/buttons: font, bold, italic, alignment)
- Logo (+ position), favicon, hero image
- Sections, reorderable + toggleable: Hero, About (with image), Services
  (name/price/duration/bookable), Photo gallery, Find us (address/hours/phone +
  map link), FAQ, Signup form (feeds their CRM), plus user-defined custom
  sections (heading + body)
- Booking/contact CTAs via WhatsApp deep-link or email
- Footer: "Powered by clancy."

**Current light palette:** bg `#FAF8F3`, surface `#FFFFFF`, text `#221F1A`.
(Dark variant: bg `#0C0C0F`, surface `#18181C`, text `#F5F1EA`.)

**Goals:** currently clean but a bit "template-y" and flat. Want premium, modern,
custom-designed-looking small-business sites — better type scale + rhythm,
richer hero sections, more refined section layouts, tasteful accent-colour use,
great spacing, strong mobile design — WHILE staying a config-driven template
(improvements expressible as reusable rendering logic + config options, not
per-client custom code). Bonus: 2–3 distinct template "looks" a client could
choose between.

---

## What to preserve
- The violet accent identity (links agency, CRM, and client sites)
- Config-driven architecture (no per-client bespoke design)
- Simplicity for non-technical users
- Flat, premium-minimal aesthetic (no gaudy gradients/effects)

## What to deliver
1. A refined, cohesive **design system** for both surfaces (type scale, spacing,
   colour usage, buttons, inputs, cards, chips, tables, empty states) in
   Tailwind terms.
2. Concrete redesigns of the key screens (layout + component-level), described so
   an AI dev can implement them in Next.js + Tailwind.
3. Specific fixes for the hard-to-understand pages (Broadcasts, Calendar, Team,
   the nav).
4. For the client websites: a more premium template design + optional style
   variants, all config-driven.

Prioritise clarity, hierarchy, mobile, and a premium feel.
