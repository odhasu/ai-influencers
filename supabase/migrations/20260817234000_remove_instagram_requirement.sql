alter table public.waitlist_applications
  alter column instagram drop not null;

comment on column public.waitlist_applications.instagram is
  'Optional legacy Instagram handle. The current application does not collect this field.';
