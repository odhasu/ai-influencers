alter table public.waitlist_applications
  add column if not exists visitor_id uuid,
  add column if not exists pageview_id uuid,
  add column if not exists session_number integer not null default 1,
  add column if not exists timezone text,
  add column if not exists first_touch jsonb not null default '{}'::jsonb,
  add column if not exists last_touch jsonb not null default '{}'::jsonb,
  add column if not exists click_ids jsonb not null default '{}'::jsonb,
  add column if not exists referrer_domain text,
  add column if not exists gclid text,
  add column if not exists fbclid text,
  add column if not exists ttclid text,
  add column if not exists msclkid text;

alter table public.waitlist_applications
  drop constraint if exists waitlist_applications_session_number_check;

alter table public.waitlist_applications
  add constraint waitlist_applications_session_number_check
  check (session_number between 1 and 10000);

alter table public.funnel_events
  add column if not exists event_client_at timestamptz,
  add column if not exists visitor_id uuid,
  add column if not exists pageview_id uuid,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer_domain text,
  add column if not exists browser text,
  add column if not exists os text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists timezone text,
  add column if not exists first_touch jsonb not null default '{}'::jsonb,
  add column if not exists last_touch jsonb not null default '{}'::jsonb,
  add column if not exists click_ids jsonb not null default '{}'::jsonb,
  add column if not exists conversion_type text,
  add column if not exists value_cents bigint,
  add column if not exists currency text,
  add column if not exists external_id text;

alter table public.funnel_events
  drop constraint if exists funnel_events_value_cents_check,
  drop constraint if exists funnel_events_currency_check,
  drop constraint if exists funnel_events_conversion_type_check;

alter table public.funnel_events
  add constraint funnel_events_value_cents_check
    check (value_cents is null or value_cents between 0 and 1000000000),
  add constraint funnel_events_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  add constraint funnel_events_conversion_type_check
    check (
      conversion_type is null or conversion_type in (
        'booking_completed',
        'checkout_started',
        'payment_succeeded',
        'conversion_recorded'
      )
    );

create table if not exists public.lead_visitor_links (
  lead_id uuid not null references public.waitlist_applications(id) on delete cascade,
  visitor_id uuid not null,
  first_linked_at timestamptz not null default now(),
  last_linked_at timestamptz not null default now(),
  last_session_id uuid not null,
  primary key (lead_id, visitor_id)
);

alter table public.lead_visitor_links enable row level security;
revoke all on table public.lead_visitor_links from anon, authenticated;
grant select, insert, update, delete on table public.lead_visitor_links to service_role;

create index if not exists waitlist_applications_visitor_id_idx
  on public.waitlist_applications (visitor_id, created_at desc)
  where visitor_id is not null;

create index if not exists waitlist_applications_gclid_idx
  on public.waitlist_applications (gclid)
  where gclid is not null;

create index if not exists waitlist_applications_fbclid_idx
  on public.waitlist_applications (fbclid)
  where fbclid is not null;

create index if not exists funnel_events_visitor_created_at_idx
  on public.funnel_events (visitor_id, created_at)
  where visitor_id is not null;

create index if not exists funnel_events_pageview_idx
  on public.funnel_events (pageview_id, created_at)
  where pageview_id is not null;

create index if not exists funnel_events_conversion_idx
  on public.funnel_events (conversion_type, created_at desc)
  where conversion_type is not null;

create unique index if not exists funnel_events_external_event_idx
  on public.funnel_events (event_name, external_id)
  where external_id is not null;

create index if not exists lead_visitor_links_visitor_idx
  on public.lead_visitor_links (visitor_id, last_linked_at desc);

comment on table public.lead_visitor_links is
  'Links consented pseudonymous browser visitors to a submitted lead. No fingerprint or raw IP is stored.';

comment on column public.funnel_events.click_ids is
  'Allowlisted advertising click identifiers only. Arbitrary URL parameters are not stored.';
