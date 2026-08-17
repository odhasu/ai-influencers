alter table public.waitlist_applications
  add column if not exists start_timeline text,
  add column if not exists biggest_struggle text;

alter table public.waitlist_applications
  alter column reselling_experience drop not null,
  alter column age_range drop not null,
  alter column email drop not null;

alter table public.waitlist_applications
  drop constraint if exists waitlist_applications_long_term_goal_check;

alter table public.waitlist_applications
  add constraint waitlist_applications_long_term_goal_check check (
    long_term_goal in (
      'Full time income',
      'Side hustle / extra income',
      'Build a brand on social media',
      'Bulk supplying to stores',
      'Side hustle money - $1K-$2K/month',
      'Part time money - $4K-$10K/month',
      'Full time money - $15K+/month'
    )
  ),
  add constraint waitlist_applications_start_timeline_check check (
    start_timeline is null or start_timeline in (
      'ASAP - ready now',
      'Within 1-4 weeks',
      'Just researching for now'
    )
  ),
  add constraint waitlist_applications_biggest_struggle_check check (
    biggest_struggle is null or biggest_struggle in (
      'Lack of Direction',
      'Procrastination',
      'Skepticism'
    )
  );

create index if not exists waitlist_applications_phone_number_idx
  on public.waitlist_applications (phone_number);

comment on column public.waitlist_applications.start_timeline is
  'Applicant answer to how soon they are looking to start.';

comment on column public.waitlist_applications.biggest_struggle is
  'Applicant answer describing the main obstacle to achieving their goals.';

comment on column public.waitlist_applications.email is
  'Optional legacy/application contact email. Current application collects email during Calendly booking.';
