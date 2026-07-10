-- 016 — editable Clancy landing page (Batch 10)
-- The landing at / renders from the 'clancy-home' sites row (published=true
-- so the anon landing page can read it via the existing published-sites
-- policy; /s/clancy-home itself is blocked in code). Config mirrors the
-- current hardcoded copy, so nothing changes visually until edited.

insert into public.sites (organization_id, slug, published, config)
select
  o.id,
  'clancy-home',
  true,
  '{
    "hero_title": "Built in days.\nManaged for you.",
    "hero_sub": "Your website, bookings, customer pipeline, and follow-ups — one system, built around how your business already works.",
    "cta_label": "Book a walkthrough",
    "cta_href": "mailto:clancy.hq.ai@gmail.com?subject=Clancy%20walkthrough",
    "badge_line": "Limited managed slots",
    "features": [
      { "title": "Website", "text": "A clean, fast site that gets found on Google" },
      { "title": "Online booking", "text": "Customers book themselves in — even at 2am" },
      { "title": "Customer pipeline", "text": "Every inquiry tracked from first message to paid" },
      { "title": "Follow-ups", "text": "Automatic reminders so no lead is forgotten" },
      { "title": "Reviews", "text": "Review requests sent at the right moment, every time" }
    ],
    "steps": [
      { "title": "Walkthrough", "text": "We sit down and map how your business actually runs today — how customers find you, what happens next, where things slip." },
      { "title": "We build", "text": "Your system goes live in days, not months — your services, your prices, your way of working. Try it free before you commit." },
      { "title": "We manage", "text": "Updates, changes, and maintenance handled for you. You run the business; the system runs itself." }
    ],
    "closing_title": "One system. One price. Zero setup fee.",
    "closing_sub": "Every Clancy system is personally built and managed. That promise only works if we stay small — when the managed slots are full, there is a waitlist.",
    "footer_line": "clancy · Kuala Lumpur · by appointment",
    "instagram_url": "https://www.instagram.com/clancy.hq",
    "contact_email": "clancy.hq.ai@gmail.com"
  }'::jsonb
from public.organizations o
where o.slug = 'clancy'
on conflict (slug) do nothing;
