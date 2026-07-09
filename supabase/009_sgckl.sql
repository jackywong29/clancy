-- 009 — SGCKL church site (2026-07-09)
-- New tenant: SGCKL, a KL church. Org + visitor-retention pipeline +
-- published trial site at /s/sgckl. Same multi-tenant pattern as the
-- By You rehearsal (007). Brand pulled from the logo: black/red script
-- with orange accents, tagline "Creative. Believe. Live."
--
-- Placeholder fields (phone, some copy) carry the brief's test values as-is;
-- logo image must be uploaded via the site editor (no DB/storage write here).

insert into public.organizations (name, slug)
values ('SGCKL', 'sgckl')
on conflict (slug) do nothing;

-- Visitor-retention pipeline: mirrors how the church works today (they call
-- new visitors and want them returning every Sunday until they settle in).
insert into public.pipeline_stages (organization_id, name, position)
select o.id, s.name, s.position
from public.organizations o,
  (values
    ('New Visitor', 1),
    ('Contacted', 2),
    ('Attending', 3),
    ('In a CG', 4),
    ('Serving', 5),
    ('Member', 6)
  ) as s(name, position)
where o.slug = 'sgckl'
  and not exists (
    select 1 from public.pipeline_stages ps where ps.organization_id = o.id
  );

insert into public.sites (organization_id, slug, published, config)
select
  o.id,
  'sgckl',
  true,
  '{
    "name": "SGCKL",
    "tagline": "Creative. Believe. Live.",
    "description": "A church in the heart of Kuala Lumpur. Whether you are visiting for the first time or looking for a place to belong, there is a seat for you here every Sunday.",
    "phone": "01234567",
    "whatsapp": "01234567",
    "address": "VIVA Shopping Mall, L1 East Wing (1-93A), 85 Jalan Loke Yew, 55200 Kuala Lumpur",
    "hours": "Sundays — service times below",
    "accent": "#D1362F",
    "logo_url": null,
    "services": [
      { "name": "Join a CG!", "price": "Free", "duration": "Connect Group", "bookable": true },
      { "name": "Serve with us!", "price": "Free", "duration": "Volunteer", "bookable": true }
    ],
    "faq": [
      { "q": "Im new — what should I expect?", "a": "Come as you are. Arrive a few minutes early, and our team will welcome you and help you find a seat. Reach out on WhatsApp beforehand and we will look out for you." },
      { "q": "What is a CG?", "a": "A Connect Group (CG) is a small group that meets during the week to grow together, pray, and do life beyond Sunday. Tap Join a CG! and we will connect you to one near you." },
      { "q": "How can I serve?", "a": "We would love to have you on the team — from welcome and worship to media and kids. Tap Serve with us! and tell us what you are drawn to." },
      { "q": "How do I give?", "a": "Tithes and offerings can be given by bank transfer or DuitNow QR. Message us on WhatsApp for details." }
    ],
    "socials": [
      { "platform": "Facebook", "url": "https://www.facebook.com/sgc.kualalumpur/" },
      { "platform": "Instagram", "url": "https://www.instagram.com/sgc.kl/?hl=en" },
      { "platform": "YouTube", "url": "https://www.youtube.com/c/SGCKL" }
    ]
  }'::jsonb
from public.organizations o
where o.slug = 'sgckl'
on conflict (slug) do nothing;
