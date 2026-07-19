# Authentic Resell Application Funnel

Production application funnel for Authentic Resell. The project includes a public multi-step application, Supabase lead storage, referral tracking, a private lead dashboard, and an embedded Calendly booking flow.

Last progress update: **July 16, 2026**

## Live project

- Production domain: [authenticresell.com](https://authenticresell.com)
- Vercel fallback: [authentic-resell-application.vercel.app](https://authentic-resell-application.vercel.app)
- Private GitHub repository: [odhasu/authentic-resell-application](https://github.com/odhasu/authentic-resell-application)
- Vercel project: `authentic-resell-application`
- Supabase: connected to the existing lead database
- Production branch: `main`

The apex custom domain is live on the new Vercel project. The `www` hostname is reserved in Vercel but still needs its DNS record configured at the domain registrar before it will resolve publicly. The old GitHub Pages website is no longer the intended production target.

## Current routes

| Route | Purpose |
| --- | --- |
| `/` | Public application funnel |
| `/waitlist` | Public application funnel |
| `/dashboard` | Private lead and referral dashboard |
| `/admin/login` | Dashboard login |
| `/waitlist-thank-you` | Legacy thank-you page kept for possible future use |
| `/api/waitlist` | Validated lead-submission endpoint |
| `/api/funnel-events` | Funnel and referral event endpoint |
| `/api/webhooks/calendly` | Signed Calendly booking webhook and owner Gmail notification |
| `/api/admin/*` | Authenticated dashboard APIs |

## Current public experience

The hero follows the visual direction from Authentic Resell:

- Clean alternating white and neon-green headline lines
- Neon-green `Building $5K-$30K/Month` emphasis
- White `High-Ticket Reselling Businesses` closing line
- Subtle green underline beneath the headline
- Separate responsive line breaks for laptop and phone layouts
- Application heading: `Apply Now`
- Brighter cinematic panel background with more visible texture, dividers, and depth

The redundant `Get Started Now` button beneath the form has been removed.

## Application flow

The application currently asks seven steps:

1. Reselling experience
2. Long-term reselling goal
3. Age range
4. Email address
5. Full name and phone number
6. Available budget
7. Confirmation that the applicant can commit to the booked call

The Instagram username question has been removed. The backend stores `not_provided` for Instagram so existing database and dashboard fields remain compatible.

After a successful submission:

- The visitor stays inside the same application card.
- The page does not redirect to the legacy thank-you page.
- Calendly opens inline using `https://calendly.com/ogvendorss/htr-call`.
- Calendly uses a white surface, dark text, and black primary text so all booking fields and time slots remain readable.

## Dashboard and backend

Supabase stores application data, funnel events, referral links, and funnel settings.

The dashboard supports:

- Separate Overview, Leads, Analytics, Referral links, and Settings navigation
- New-versus-handled lead inboxes, where handled includes every status after `new`
- Searchable and filterable lead list
- Received-date, custom-date, follow-up-time, exact-status, and sorting filters under Advanced
- CSV lead export
- Statuses: new, contacted, qualified, booked, won, and lost
- Lead notes, tags, assigned owner, and follow-up date
- Saved email and phone contact information
- Safe handling of missing Instagram usernames
- Referral links for Instagram, TikTok, YouTube, communities, and custom placements
- Editable referral codes, destinations, and UTM values
- Views, starts, leads, booked calls, wins, losses, and closed-lead metrics
- Dedicated Analytics reporting with preset, all-time, and custom date ranges
- Public funnel copy and behavior settings
- Optional server-side lead webhook

## Authentication and environment status

Configured in both Vercel Preview and Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `DASHBOARD_PASSWORD`
- `DASHBOARD_SESSION_SECRET`

Dashboard login uses a secure HTTP-only cookie. “Keep me signed in on this device” is enabled by default for a 30-day remembered session; clearing the checkbox creates a browser-session login that expires after 12 hours.

The dashboard password is stored only as an encrypted Vercel environment variable and must never be written into this repository or documentation.

Not currently configured:

- PostHog environment variables
- `LEAD_WEBHOOK_URL`
- Calendly/Gmail booking notification variables (see `.env.example`)

These are optional for the current funnel and do not block lead collection or the dashboard.

## Important implementation files

- `components/waitlist-funnel.tsx` — public form flow and Calendly state
- `components/cinematic-curtain.tsx` — page background structure
- `app/globals.css` — public funnel styling and brighter background
- `app/api/waitlist/route.ts` — validation and Supabase lead writes
- `app/dashboard/dashboard-client.tsx` — lead, referral, and settings interface
- `lib/dashboard-data.ts` — dashboard database reads
- `lib/funnel-settings.ts` — public funnel settings and defaults
- `lib/admin-auth.ts` — dashboard session authentication
- `lib/analytics/client.ts` — consented identity, attribution, and event collection
- `ANALYTICS.md` — analytics event contract and privacy boundary
- `supabase/migrations/` — versioned backend schema

## Removed from the funnel

- Instagram application question
- `Secure application` row and icon
- Visible `Interviews with the Inner Circle` video section
- Redirect to the new thank-you flow
- Redundant CTA directly beneath the form
- `The Inner Circle Is Currently Closed` messaging

## Local development

```bash
npm install
npm run dev
```

The app normally runs at:

```text
http://localhost:3000
```

Another port such as `3001` may be used automatically if port `3000` is occupied.

Local values belong in `.env.local`, which is ignored by Git. Never copy secret values into `.env.example`, Markdown files, source code, issues, or commits.

## Verification checklist

Run before pushing or deploying:

```bash
npm run lint
npm run typecheck
npm run build
```

Also verify:

- `/` and `/waitlist` load successfully
- Form validation and navigation work
- A valid application reaches Supabase
- Calendly appears after submission
- `/dashboard` requires authentication in production
- Referral links preserve their source attribution
- Desktop and mobile layouts do not overflow

## Current progress

Completed:

- Public funnel design and application flow
- Supabase backend and lead storage
- Lead management dashboard
- Referral-link system and metrics
- Calendly booking embed
- Private GitHub repository
- New Vercel project
- Preview and Production Supabase variables
- Preview and Production dashboard authentication
- Custom apex-domain assignment
- Brighter cinematic background

Optional next improvements:

- Add PostHog project variables and dashboards
- Configure the Calendly booking webhook and Gmail App Password
- Replace the current dashboard password with a stronger credential when desired
- Add automated end-to-end form tests
