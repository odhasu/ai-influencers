alter table if exists public.booking_sms_notifications
  rename to booking_email_notifications;

alter table public.booking_email_notifications
  rename column twilio_message_sid to gmail_message_id;

comment on table public.booking_email_notifications is
  'Server-only idempotency log for Calendly booking email notifications.';
