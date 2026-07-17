create table if not exists public.booking_sms_notifications (
  id uuid primary key default gen_random_uuid(),
  calendly_event_uri text not null unique,
  invitee_email text not null,
  lead_id uuid references public.waitlist_applications(id) on delete set null,
  twilio_message_sid text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.booking_sms_notifications enable row level security;

comment on table public.booking_sms_notifications is
  'Server-only idempotency log for Calendly booking SMS notifications.';
