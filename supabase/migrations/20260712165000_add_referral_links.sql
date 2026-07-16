alter table public.waitlist_applications
  add column if not exists referral_code text,
  add column if not exists referral_link_id uuid;

alter table public.funnel_events
  add column if not exists referral_code text,
  add column if not exists referral_link_id uuid;

create table if not exists public.referral_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  label text not null check (char_length(label) between 2 and 120),
  platform text not null check (char_length(platform) between 2 and 80),
  placement text not null check (char_length(placement) between 2 and 120),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  destination_path text not null default '/waitlist' check (destination_path like '/%'),
  notes text not null default '',
  is_active boolean not null default true,
  utm_source text not null default '',
  utm_medium text not null default 'social',
  utm_campaign text not null default 'waitlist',
  utm_content text not null default '',
  utm_term text not null default ''
);

alter table public.waitlist_applications
  drop constraint if exists waitlist_applications_referral_link_id_fkey;

alter table public.waitlist_applications
  add constraint waitlist_applications_referral_link_id_fkey
  foreign key (referral_link_id) references public.referral_links(id) on delete set null;

alter table public.funnel_events
  drop constraint if exists funnel_events_referral_link_id_fkey;

alter table public.funnel_events
  add constraint funnel_events_referral_link_id_fkey
  foreign key (referral_link_id) references public.referral_links(id) on delete set null;

alter table public.referral_links enable row level security;
revoke all on table public.referral_links from anon, authenticated;
grant select, insert, update, delete on table public.referral_links to service_role;

drop trigger if exists set_referral_links_updated_at on public.referral_links;
create trigger set_referral_links_updated_at
before update on public.referral_links
for each row execute function public.set_waitlist_application_updated_at();

create index if not exists waitlist_applications_referral_code_idx
  on public.waitlist_applications (referral_code, created_at desc)
  where referral_code is not null;

create index if not exists waitlist_applications_referral_link_id_idx
  on public.waitlist_applications (referral_link_id, created_at desc)
  where referral_link_id is not null;

create index if not exists funnel_events_referral_code_idx
  on public.funnel_events (referral_code, created_at desc)
  where referral_code is not null;

create index if not exists referral_links_platform_idx
  on public.referral_links (platform, placement);

insert into public.referral_links
  (label, platform, placement, code, utm_source, utm_medium, utm_campaign, utm_content)
values
  ('Instagram profile', 'Instagram', 'Profile bio', 'instagram-profile', 'instagram', 'social', 'waitlist', 'profile-bio'),
  ('Instagram story', 'Instagram', 'Story sticker', 'instagram-story', 'instagram', 'social', 'waitlist', 'story'),
  ('YouTube description', 'YouTube', 'Video description', 'youtube-description', 'youtube', 'social', 'waitlist', 'description'),
  ('TikTok bio', 'TikTok', 'Profile bio', 'tiktok-bio', 'tiktok', 'social', 'waitlist', 'bio')
on conflict (code) do nothing;

comment on table public.referral_links is
  'Admin-managed referral links for per-placement social attribution and lead performance.';
