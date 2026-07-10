create extension if not exists pgcrypto;

create table if not exists public.waitlist_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reselling_experience text not null check (
    reselling_experience in (
      'I''m just starting',
      'Less than 6 months',
      '6 months - 1 year',
      '1 - 2 years',
      '2+ years'
    )
  ),
  long_term_goal text not null check (
    long_term_goal in (
      'Full time income',
      'Side hustle / extra income',
      'Build a brand on social media',
      'Bulk supplying to stores'
    )
  ),
  age_range text not null check (age_range in ('13 - 17', '18 - 23', '24 - 35', '35+')),
  instagram text not null check (char_length(instagram) between 2 and 100),
  email text not null unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone_number text not null check (char_length(phone_number) between 7 and 40),
  budget_range text not null check (
    budget_range in (
      'Under $200 USD',
      '$200 - $500 USD',
      '$500 - $1K USD',
      '$1K - $3K USD',
      '$3K+ USD'
    )
  ),
  source text not null default 'website_waitlist',
  session_id uuid not null,
  posthog_distinct_id text,
  form_duration_ms integer not null default 0 check (form_duration_ms >= 0),
  analytics_consent boolean not null default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  user_agent text,
  country text,
  region text,
  city text,
  constraint waitlist_email_length check (char_length(email) between 3 and 254),
  constraint waitlist_phone_length check (char_length(phone_number) between 7 and 40)
);

alter table public.waitlist_applications enable row level security;

revoke all on table public.waitlist_applications from anon, authenticated;
grant select, insert, update on table public.waitlist_applications to service_role;

create index if not exists waitlist_applications_created_at_idx
  on public.waitlist_applications (created_at desc);

create index if not exists waitlist_applications_email_lower_idx
  on public.waitlist_applications (lower(email));

create index if not exists waitlist_applications_utm_source_idx
  on public.waitlist_applications (utm_source)
  where utm_source is not null;

create or replace function public.set_waitlist_application_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_waitlist_application_updated_at on public.waitlist_applications;
create trigger set_waitlist_application_updated_at
before update on public.waitlist_applications
for each row execute function public.set_waitlist_application_updated_at();

comment on table public.waitlist_applications is
  'Server-submitted Inner Circle waitlist applications. No browser role has direct access.';
