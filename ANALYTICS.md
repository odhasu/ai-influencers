# Analytics Contract

The funnel uses consented, first-party events stored in Supabase and mirrors the same behavioral events to PostHog when configured.

## Identity and attribution

- A random visitor ID is stored after analytics consent. It is not a browser fingerprint.
- Sessions expire after 30 minutes of inactivity and retain a session sequence number.
- First touch and last non-direct touch are stored side by side.
- Allowed acquisition parameters: `ref`, standard UTMs, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `msclkid`, `twclid`, `li_fat_id`, `sccid`, and `dclid`.
- Referrer hostname and path are stored without query parameters.
- Browser, OS, device class, country, region, city, timezone, locale, and viewport dimensions are captured without storing raw IP addresses.
- On submission, the consented visitor ID is linked to the internal lead ID. Repeat submissions from another consented browser can link multiple visitor IDs to the same lead.

## Funnel events

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

VSL and revenue:

- `vsl_started`
- `vsl_played`
- `vsl_paused`
- `vsl_watch_batch`
- `vsl_progress_reached`
- `vsl_completed`
- `booking_started`
- `booking_completed`
- `checkout_started`
- `payment_succeeded`
- `conversion_recorded`

Watched seconds are batched in groups of up to 30, preserving exact second-level retention while avoiding one network request per second.

## Conversion ingestion

`POST /api/conversions` accepts authenticated server events for booking, checkout, payment, and final conversion. Callers send `Authorization: Bearer <ANALYTICS_INGEST_SECRET>`, an internal `lead_id`, an idempotent `external_id`, and optional value/currency fields.

The endpoint updates pipeline status for bookings and wins, stores the conversion once, and mirrors it to PostHog only when the lead granted analytics consent.

## Privacy boundary

Never send names, emails, phone numbers, social handles, free-text answers, answer values, or complete URLs to analytics. PostHog autocapture is disabled, replay inputs are masked, and the event API strips unknown properties.
