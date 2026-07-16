alter table public.waitlist_applications
  add column if not exists lead_status text not null default 'new',
  add column if not exists notes text not null default '',
  add column if not exists follow_up_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists assigned_to text,
  add column if not exists tags text[] not null default '{}';

alter table public.waitlist_applications
  drop constraint if exists waitlist_applications_lead_status_check;

alter table public.waitlist_applications
  add constraint waitlist_applications_lead_status_check check (
    lead_status in ('new', 'contacted', 'qualified', 'booked', 'won', 'lost')
  );

create index if not exists waitlist_applications_lead_status_idx
  on public.waitlist_applications (lead_status, created_at desc);

create index if not exists waitlist_applications_follow_up_idx
  on public.waitlist_applications (follow_up_at)
  where follow_up_at is not null;

create table if not exists public.funnel_settings (
  id text primary key default 'default' check (id = 'default'),
  updated_at timestamptz not null default now(),
  campaign_name text not null default 'Inner Circle Waitlist',
  hero_headline text not null default 'The Inner Circle Is Currently Closed',
  hero_body text not null default 'We''re not accepting new applications right now, but join the waitlist below to be first in line when spots open up.',
  waitlist_heading text not null default 'Join the Waitlist',
  cta_label text not null default 'Get Started Now',
  accent_color text not null default '#39FF14',
  form_enabled boolean not null default true,
  auto_advance_delay_ms integer not null default 240 check (auto_advance_delay_ms between 0 and 2000),
  success_redirect_path text not null default '/waitlist-thank-you',
  form_security_label text not null default 'Secure application',
  show_testimonials boolean not null default true,
  show_wins boolean not null default true,
  show_consent_banner boolean not null default true,
  thank_you_video_url text not null default 'https://stream.clyro.io/v/8V01yqULxPLLwB0100E2lRPpd00CFZVm00V4X02l02QjMnvxrc.m3u8',
  booking_url text not null default '',
  booking_cta_label text not null default 'Book Your Call',
  webhook_enabled boolean not null default false,
  notification_email text not null default '',
  meta_pixel_id text not null default '',
  tiktok_pixel_id text not null default '',
  google_tag_id text not null default '',
  constraint funnel_settings_accent_color_check check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint funnel_settings_redirect_check check (success_redirect_path like '/%')
);

insert into public.funnel_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.funnel_settings enable row level security;
revoke all on table public.funnel_settings from anon, authenticated;
grant select, insert, update on table public.funnel_settings to service_role;

drop trigger if exists set_funnel_settings_updated_at on public.funnel_settings;
create trigger set_funnel_settings_updated_at
before update on public.funnel_settings
for each row execute function public.set_waitlist_application_updated_at();

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_name text not null,
  session_id uuid not null,
  lead_id uuid references public.waitlist_applications(id) on delete set null,
  step_number integer,
  step_key text,
  percent integer,
  cta_location text,
  video_id text,
  elapsed_ms integer,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_path text,
  device_type text,
  metadata jsonb not null default '{}'::jsonb,
  constraint funnel_events_percent_check check (percent is null or percent between 0 and 100),
  constraint funnel_events_step_check check (step_number is null or step_number between 1 and 20)
);

alter table public.funnel_events enable row level security;
revoke all on table public.funnel_events from anon, authenticated;
grant select, insert, update, delete on table public.funnel_events to service_role;

create index if not exists funnel_events_created_at_idx
  on public.funnel_events (created_at desc);

create index if not exists funnel_events_name_created_at_idx
  on public.funnel_events (event_name, created_at desc);

create index if not exists funnel_events_session_idx
  on public.funnel_events (session_id, created_at);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.waitlist_applications(id) on delete cascade,
  activity_type text not null check (activity_type in ('status_changed', 'note_updated', 'follow_up_scheduled', 'tag_updated')),
  summary text not null,
  actor text not null default 'dashboard'
);

alter table public.lead_activities enable row level security;
revoke all on table public.lead_activities from anon, authenticated;
grant select, insert, update, delete on table public.lead_activities to service_role;

create index if not exists lead_activities_lead_created_at_idx
  on public.lead_activities (lead_id, created_at desc);

comment on table public.funnel_events is
  'Pseudonymous first-party funnel events. Event metadata must not contain lead contact details or free-text answers.';

comment on table public.funnel_settings is
  'Server-managed public funnel presentation and integration settings.';
