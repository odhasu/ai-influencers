# Authentic Resell Maintenance Brief

Last reviewed: **August 17, 2026**

Use this brief when starting a new development session for the Authentic Resell application funnel. It replaces the obsolete July 2026 two-repository Neon-to-Supabase migration prompt.

## Active project

The maintained application is the Next.js project at:

```text
/Users/oscargraafmans/Desktop/innercircle-main/production-app
```

The static HTML, CSS, and JavaScript files in the parent `innercircle-main` directory are legacy assets. Do not treat them as the production source unless a task explicitly targets the legacy site.

Production infrastructure:

- Primary domain: `https://authenticresell.com`
- Dashboard: `https://dashboard.authenticresell.com`
- Vercel fallback: `https://authentic-resell-application.vercel.app`
- GitHub: `odhasu/authentic-resell-application`
- Database: Supabase Postgres with versioned SQL migrations
- Hosting: Vercel

All three public URLs returned successfully during the August 17 review.

## Current product baseline

The public funnel uses:

- A white-and-gold hero on the original animated curtain background
- A darker, subtly warm-tinted background treatment
- The headline `See How Regular People Are Building $5K-$30K/Month AI Digital Ecom Businesses`
- Gold as the default accent (`#F2C268`), including compatibility for the previous neon-green saved setting
- A seven-step application form
- Server-validated Supabase lead updates matched by international phone number
- Budget-based post-submission routing to `/qualified` and `/not-qualified`
- A result gallery and configurable public funnel settings

The private dashboard includes lead management, activity history, CSV export, referral links, attribution reporting, analytics summaries, and public funnel settings.

## Architecture and security rules

- Browser clients never connect directly to protected Supabase tables.
- Server routes use `SUPABASE_SECRET_KEY`; public keys do not receive table privileges.
- Dashboard authentication uses a signed HTTP-only cookie.
- Validate request bodies with Zod and keep all mutations server-side.
- Never commit `.env.local`, credentials, lead exports, or analytics payloads containing PII.
- Analytics must not contain names, email addresses, phone numbers, social handles, answers, free text, or complete URLs.
- Preserve unrelated local changes and use versioned Supabase migrations for schema changes.

## Known gap

`components/analytics-consent.tsx` exists, but it is not currently mounted by `app/layout.tsx`. Because event capture is consent-gated, new visitors do not emit first-party or PostHog behavioral events unless consent was already stored in their browser.

Do not describe behavioral analytics as fully active until the consent UI is mounted and verified. Lead submission itself still works without analytics consent and stores an ephemeral session ID with empty attribution.

## Recommended next improvements

1. Mount and verify the analytics-consent UI on public routes only.
2. Configure PostHog variables and create initial acquisition, completion, and conversion dashboards.
3. Configure and test the signed Calendly webhook plus Gmail booking notification variables.
4. Add automated end-to-end coverage for form validation, submission, both qualification outcomes, and dashboard authentication.
5. Update the page metadata from “high-ticket reselling” to the current AI Digital Ecom positioning when the marketing copy is finalized.
6. Review the legacy `show_consent_banner` database column and either reconnect it to the UI or remove it in a migration.

## Required verification

Run from `production-app` before creating a checkpoint:

```bash
npm run lint
npm run typecheck
npm run build
```

Also verify:

- `/` and `/waitlist` render without desktop or mobile overflow.
- The hero uses the current AI Digital Ecom wording.
- All former neon-green public accents render as gold.
- Form validation and back/forward navigation work.
- A successful submission is confirmed by the server before either qualification result appears.
- `/dashboard` redirects unauthenticated users to `/admin/login`.
- Referral parameters survive submission without arbitrary query parameters entering analytics.
- Browser console output has no unexplained warnings or errors.

## Documentation sources of truth

- `README.md` — product, architecture, routes, setup, and operating status
- `ANALYTICS.md` — event, consent, attribution, conversion, and privacy contract
- `AGENTS.md` — repository workflow and safety rules
- `.env.example` — environment variable names only; never secret values
- `supabase/migrations/` — database schema history
