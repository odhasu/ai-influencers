# Analytics Contract

Last reviewed: **August 17, 2026**

The application contains a consent-gated, first-party analytics pipeline backed by Supabase and can mirror the same allowed events to PostHog when configured.

## Current operational status

The event schemas, storage, attribution, PostHog integration, and conversion endpoint are implemented. However, `components/analytics-consent.tsx` is not currently mounted in `app/layout.tsx`.

Consequences for new visitors:

- Behavioral event capture remains off because no consent decision can be made through the current UI.
- PostHog initializes in opt-out mode and does not capture events.
- Lead submission still works and sends `analytics_consent: false`.
- Non-consented submissions use an ephemeral session ID and omit persistent visitor, pageview, first-touch, last-touch, and PostHog identity values.

Visitors with a previously stored `analytics_consent=granted` decision can still emit the events below. Do not call the analytics pipeline fully active until the consent component is mounted and tested.

## Consent and identity

After consent:

- A random visitor UUID is stored in local storage. It is not a browser fingerprint.
- Sessions expire after 30 minutes of inactivity and retain a session sequence number.
- A new pageview UUID is generated per page load.
- The client sends timezone, locale, and viewport dimensions.
- Supabase stores first touch and last non-direct touch side by side.
- The server can add Vercel country, region, and city headers without storing raw IP addresses.
- On submission, visitor identity is linked to the internal lead ID in `lead_visitor_links`.
- Repeat submissions from another consented browser may link multiple visitor IDs to one lead.

Declining consent removes the stored visitor, session, and attribution state and opts PostHog out.

## Attribution allowlist

Stored acquisition parameters are limited to:

- `ref`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `gclid`
- `gbraid`
- `wbraid`
- `fbclid`
- `ttclid`
- `msclkid`
- `twclid`
- `li_fat_id`
- `sccid`
- `dclid`

Referrer hostname and path may be stored, but query parameters are removed. Arbitrary URL parameters are not accepted into attribution or analytics metadata.

## Event contract

Acquisition and engagement:

- `analytics_consent_granted`
- `page_viewed`
- `landing_viewed`
- `page_engagement_recorded`
- `scroll_depth_reached`
- `time_on_page_reached`
- `button_clicked`
- `primary_cta_clicked`

Application:

- `form_viewed`
- `form_started`
- `form_step_viewed`
- `form_step_completed`
- `form_field_focused`
- `form_field_completed`
- `form_validation_failed`
- `form_back_clicked`
- `form_abandoned`
- `form_submit_started`
- `form_submit_succeeded`
- `form_submit_failed`
- `form_success_shown`

Media:

- `testimonial_video_opened`
- `vsl_started`
- `vsl_played`
- `vsl_paused`
- `vsl_watch_batch`
- `vsl_progress_reached`
- `vsl_completed`

Booking and revenue:

- `booking_started`
- `booking_completed`
- `checkout_started`
- `payment_succeeded`
- `conversion_recorded`

The `/api/funnel-events` route rejects unknown event names and properties. Invalid, cross-origin, or storage-failed behavioral events intentionally return a non-blocking response so analytics can never interrupt the funnel.

Watched seconds are batched in arrays of at most 30 values, preserving second-level retention without one request per watched second.

## PostHog behavior

PostHog runs only on public routes when both `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` are configured.

- Client requests use the same-origin `/ingest` proxy configured in `next.config.ts`.
- Autocapture is disabled.
- Automatic pageview capture is disabled.
- `page_viewed` also emits PostHog’s standard `$pageview` event.
- Dashboard and admin routes do not initialize PostHog.
- Person profiles are created only after identification.
- Session replay masks all inputs and masks text inside `[data-private]` containers.
- Server events use the same project token and host through `posthog-node`.

The following variables are reserved for PostHog project administration but are not required for basic event capture: `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST`, and `POSTHOG_PERSONAL_API_KEY`.

## Lead submission events

The browser emits `form_submit_started` before calling `/api/waitlist`. After a successful Supabase save:

- The server always stores a first-party `form_submit_succeeded` operational event.
- The server mirrors that event to PostHog only when the lead granted analytics consent.
- The browser emits `form_success_shown` when the success and Calendly state is rendered.

Lead contact details and form answer values never belong in these event properties.

## Conversion ingestion

`POST /api/conversions` accepts authenticated server events for booking, checkout, payment, and final conversion.

Required request elements:

- `Authorization: Bearer <ANALYTICS_INGEST_SECRET>`
- Internal `lead_id`
- Idempotent provider `external_id`
- Event name: `booking_completed`, `checkout_started`, `payment_succeeded`, or `conversion_recorded`

Optional fields include occurrence time, value in cents, three-letter currency, provider, and product ID.

Behavior:

- A duplicate event/external-ID pair returns success with `duplicate: true`.
- Bookings advance the lead to `booked` unless already `won`.
- Payments and final conversions advance the lead to `won`.
- PostHog receives the conversion only when the lead granted analytics consent.
- The endpoint returns `503` when `ANALYTICS_INGEST_SECRET` is absent.

## Privacy boundary

Never send any of the following to first-party behavioral analytics or PostHog:

- Names
- Email addresses
- Phone numbers
- Social handles
- Form answer values
- Free-text notes or answers
- Full URLs or arbitrary query strings
- Credentials, tokens, or webhook payload secrets
- Raw IP addresses

The application database necessarily stores lead contact and application data for operating the funnel. That operational data is separate from the analytics event contract and remains accessible only through server-side Supabase access and the authenticated dashboard.

## Verification checklist

Before declaring analytics active:

- [ ] Mount `AnalyticsConsent` on public routes and confirm it is absent from dashboard/admin routes.
- [ ] Confirm decline removes local visitor, session, and attribution state.
- [ ] Confirm allow creates pseudonymous IDs and emits `analytics_consent_granted`.
- [ ] Confirm `/api/funnel-events` stores allowlisted properties only.
- [ ] Confirm PostHog receives the same allowed events and standard `$pageview`.
- [ ] Inspect requests to ensure no contact details or answers appear.
- [ ] Confirm inputs and `[data-private]` text are masked in session replay.
- [ ] Confirm repeat conversion `external_id` values are idempotent.
- [ ] Confirm dashboard and admin routes generate no PostHog traffic.
- [ ] Confirm analytics failures do not block application submission.
