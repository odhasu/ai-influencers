# Authentic Resell Application Funnel

Production Next.js application for Authentic Resell. It combines a public multi-step application, Supabase lead storage, referral and attribution tracking, a private lead dashboard, and an inline Calendly booking handoff.

Last reviewed: **August 17, 2026**

## Live project

- Production: [authenticresell.com](https://authenticresell.com)
- Dashboard: [dashboard.authenticresell.com](https://dashboard.authenticresell.com)
- Vercel fallback: [authentic-resell-application.vercel.app](https://authentic-resell-application.vercel.app)
- GitHub: [odhasu/authentic-resell-application](https://github.com/odhasu/authentic-resell-application)
- Vercel project: `authentic-resell-application`
- Production branch: `main`

The three public URLs above returned successfully during this review. The latest local feature-branch checkpoint still requires the normal preview and production promotion process before it can be assumed live.

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- Supabase Postgres with server-only access and versioned migrations
- Zod request validation
- PostHog client/server SDKs when configured
- Lenis inertial scrolling on public routes, with reduced-motion support
- Calendly inline scheduling and signed booking webhooks
- Nodemailer with a Gmail App Password for booking notifications
- Vercel hosting and request metadata

## Current routes

| Route | Purpose |
| --- | --- |
| `/` | Public application funnel |
| `/waitlist` | Public application funnel |
| `/waitlist-thank-you` | Legacy thank-you experience retained for future use |
| `/dashboard` | Private lead, referral, analytics, and settings dashboard |
| `/admin/login` | Dashboard authentication |
| `/api/waitlist` | Validated lead upsert and operational follow-up tasks |
| `/api/funnel-events` | Consented first-party behavioral event ingestion |
| `/api/conversions` | Authenticated booking, checkout, payment, and conversion ingestion |
| `/api/webhooks/calendly` | Signed Calendly booking webhook and Gmail notification |
| `/api/admin/*` | Authenticated dashboard APIs |

The proxy rewrites the root of `dashboard.authenticresell.com` to `/dashboard`; unauthenticated requests are redirected to `/admin/login`.

## Public experience

The current design retains the original Authentic Resell structure and animations:

- White lead and closing headline lines
- Gold `Building $5K-$30K/Month` emphasis
- Gold accent color `#F2C268` instead of neon green
- Darker animated curtain background with a subtle warm tint
- Slow staggered hero text that rises in, plus a unified horizontal fade for Inner Circle Wins
- Slowed inertial wheel scrolling on public pages while touch scrolling remains native
- Responsive headline breaks for desktop and mobile
- Application heading: `Apply Now`
- Current branded headline: `See How Regular People Are Building $5K-$30K/Month AI Digital Ecom Businesses`

The renderer also recognizes the previous branded headline and previous `#39FF14` setting so an older Supabase settings row still displays the current copy and gold accent. Other custom admin-entered headline or accent values remain configurable.

## Application flow

The application asks seven steps:

1. Reselling experience
2. Long-term reselling goal
3. Age range
4. Email address
5. Full name and phone number
6. Available budget
7. Confirmation that the applicant can commit to the booked call

The former Instagram question is not shown. The server stores `not_provided` to remain compatible with the existing database and dashboard field.

Submission behavior:

- The browser validates each step before advancing.
- The final request is validated again with Zod on the server.
- A honeypot absorbs basic bot submissions.
- Email is normalized and used as the Supabase upsert key.
- Existing first-touch attribution is preserved for repeat submissions.
- Success is shown only after the server confirms storage.
- Calendly opens inline in the application card after success.
- Optional lead webhooks run independently and cannot invalidate a stored lead.

The active Calendly URL is currently set in `components/waitlist-funnel.tsx` to `https://calendly.com/ogvendorss/htr-call`.

## Dashboard and data model

Supabase stores:

- `waitlist_applications` — lead identity, application data, pipeline state, and attribution
- `lead_activities` — status, note, follow-up, and tag history
- `referral_links` — managed referral and UTM destinations
- `funnel_settings` — server-managed public funnel settings
- `funnel_events` — pseudonymous behavioral and conversion events
- `lead_visitor_links` — consented visitor-to-lead relationships
- `booking_email_notifications` — Calendly webhook idempotency and Gmail delivery state

All protected tables are server-only. Browser roles have no direct access to lead data.

The dashboard supports:

- Overview, Leads, Analytics, Referral links, and Settings navigation
- New and handled lead inboxes
- Search, status, date, follow-up, and sorting filters
- CSV export
- Statuses: new, contacted, qualified, booked, won, and lost
- Notes, tags, assigned owner, and follow-up scheduling
- Referral links with editable destinations and UTM values
- Views, starts, leads, bookings, wins, losses, and closed-lead metrics
- Public funnel copy, accent, behavior, and optional webhook settings

## Authentication

Dashboard login requires:

- `DASHBOARD_PASSWORD`
- `DASHBOARD_SESSION_SECRET`

Authentication uses a signed HTTP-only cookie. “Keep me signed in” creates a 30-day session; a non-remembered login expires after 12 hours or when the browser session ends.

Never write the dashboard password, session secret, Supabase secret key, webhook signing key, analytics ingest secret, or Gmail App Password into source control or documentation.

## Environment variables

Copy `.env.example` to `.env.local` and populate only the variables needed for local work. `.env.local` is ignored by Git.

Core application and dashboard:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Reserved public project key; browser roles still have no protected table access |
| `SUPABASE_SECRET_KEY` | Server-only database access |
| `DASHBOARD_PASSWORD` | Private dashboard credential |
| `DASHBOARD_SESSION_SECRET` | Cookie-signing secret |

Optional integrations:

| Variable | Purpose |
| --- | --- |
| `LEAD_WEBHOOK_URL` | New-lead notification target enabled from dashboard settings |
| `ANALYTICS_INGEST_SECRET` | Bearer secret for `/api/conversions` |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog project token |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingest host; also enables the `/ingest` proxy |
| `NEXT_PUBLIC_POSTHOG_UI_HOST` | PostHog project UI host |
| `POSTHOG_PROJECT_ID` | Reserved for PostHog project administration |
| `POSTHOG_API_HOST` | Reserved PostHog API host |
| `POSTHOG_PERSONAL_API_KEY` | Reserved server-side PostHog administration credential |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Calendly webhook verification |
| `BOOKING_NOTIFICATION_TIMEZONE` | Booking email timezone; defaults to `Europe/Amsterdam` |
| `GMAIL_USER` | Gmail sender account |
| `GMAIL_APP_PASSWORD` | Gmail App Password |
| `BOOKING_NOTIFICATION_EMAIL` | Optional recipient; defaults to `GMAIL_USER` |

## Analytics status

The consented first-party and PostHog event contract is documented in [ANALYTICS.md](./ANALYTICS.md).

Important current limitation: `components/analytics-consent.tsx` exists but is not mounted in `app/layout.tsx`. New visitors therefore do not emit consent-gated behavioral analytics unless a prior `analytics_consent=granted` decision already exists in local storage. Lead submission continues to work without consent and stores no persistent visitor identity or marketing attribution.

Do not describe analytics as fully active until the consent UI is mounted and verified.

## Important files

- `components/waitlist-funnel.tsx` — application flow, branded hero compatibility, analytics hooks, and Calendly state
- `components/cinematic-curtain.tsx` — animated curtain structure
- `app/globals.css` — public and thank-you styling
- `app/api/waitlist/route.ts` — lead validation and Supabase upserts
- `app/api/funnel-events/route.ts` — first-party analytics validation and storage
- `app/api/conversions/route.ts` — authenticated conversion ingestion
- `app/api/webhooks/calendly/route.ts` — signed webhook and booking email handling
- `app/dashboard/dashboard-client.tsx` — dashboard interface
- `lib/dashboard-data.ts` — dashboard queries and aggregates
- `lib/funnel-settings.ts` — public settings types, defaults, and serialization
- `lib/admin-auth.ts` — dashboard authentication
- `lib/analytics/client.ts` — consent, session, attribution, and event collection
- `instrumentation-client.ts` — PostHog initialization and masking
- `supabase/migrations/` — authoritative database history
- `IMPROVEMENT_PROMPT.md` — current maintenance brief and prioritized follow-up work

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js may choose another port if `3000` is occupied.

Without Supabase variables, the public page uses default funnel settings, but lead submission and the protected dashboard require the configured backend.

## Verification

Run before pushing or deploying:

```bash
npm run lint
npm run typecheck
npm run build
```

For public UI changes, also verify desktop and mobile behavior in a browser:

- `/` and `/waitlist` render without horizontal overflow.
- The current hero copy and gold palette are visible.
- Form validation, selection auto-advance, and back navigation work.
- A valid application is acknowledged by Supabase before Calendly appears.
- Browser console output has no unexplained errors.

For operational changes, verify:

- `/dashboard` requires authentication.
- Referral codes and allowlisted attribution survive submission.
- Repeated conversion `external_id` values are idempotent.
- Calendly rejects invalid signatures and ignores non-`invitee.created` events.
- No PII appears in analytics event payloads.

## Deployment notes

- Use a Vercel preview for end-to-end verification before production promotion.
- Set secrets separately in Preview and Production; do not copy them into Git.
- Apply new Supabase migrations before deploying code that depends on them.
- Verify the apex, dashboard subdomain, and Vercel fallback after promotion.
- The legacy static site in the parent directory is not the intended deployment source.

## Next priorities

1. Mount and test the analytics consent component on public routes.
2. Configure PostHog and create acquisition, completion, and conversion dashboards.
3. Configure and verify the Calendly/Gmail booking notification path.
4. Add automated end-to-end tests for form submission and dashboard authentication.
5. Align page metadata with the AI Digital Ecom positioning when approved.
