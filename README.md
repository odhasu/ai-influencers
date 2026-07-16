# Photo Resell Funnel

Production Next.js waitlist funnel cloned from the Lucas Resells mentorship waitlist style, with Supabase lead storage, an internal dashboard, referral-link tracking, Calendly booking, PostHog-compatible event hooks, and Vercel deployment support.

## Current project state

- Public funnel route: `/waitlist`
- Dashboard route: `/dashboard`
- Legacy thank-you route: `/waitlist-thank-you`
- Local development URL currently used in testing: `http://localhost:3001/waitlist`
- Main funnel component: `components/waitlist-funnel.tsx`
- Lead submission API: `app/api/waitlist/route.ts`
- Dashboard client: `app/dashboard/dashboard-client.tsx`
- Dashboard data loader: `lib/dashboard-data.ts`
- Funnel settings defaults/types: `lib/funnel-settings.ts`

The current public funnel keeps the user on the same page after application submission and opens the Calendly booking embed inside the same black/green application card. It does not redirect to the thank-you page, but the old thank-you page is still kept in the app in case it is needed later.

## Current application flow

The live waitlist form now asks:

1. How long have you been reselling?
2. What is your long-term goal with reselling?
3. How old are you?
4. Best email address
5. Full name and phone number
6. Budget range
7. Call commitment question:
   - `Yes` allows the user to continue.
   - `No` blocks submission with a validation message.

After a successful application, the same card shows the Calendly embed for:

```text
https://calendly.com/ogvendorss/htr-call
```

The inline Calendly URL hides the event details and GDPR banner, uses a white Calendly background, black text, and a black primary color so the time-slot text is readable.

## Recent funnel changes from this build session

- Replaced the closed-waitlist hero with the authenticresell.com-style headline: white lead text, neon-green `$5K-$30K/Month`, and muted-gray `High-Ticket Reselling Businesses` lines.
- Changed the supporting hero copy to `The Exact System 200+ Members Use to Flip Authentic Products for Profit` and the form heading to `Apply Now`.
- Removed the redundant `Get Started Now` CTA directly beneath the application form.
- Removed the Instagram username question from the public application flow.
- Kept backend compatibility for missing Instagram by storing `not_provided` when no handle is sent.
- Removed the previous “Skip Instagram” UI after deciding the Instagram question should not appear at all.
- Removed the “Allow privacy-safe analytics and masked session replay…” consent text from the public funnel.
- Removed the visible “Interviews with the Inner Circle” section and its video grid from the public funnel/thank-you experience.
- Removed the “Secure application” row and icon.
- Added the final call-commitment question before Calendly.
- Kept the old thank-you page available, but stopped redirecting users there after form submission.
- Updated the Calendly embed styling so the booking experience fits inside the funnel card and the time-slot text is black/readable.
- Fixed the prior Calendly form readability issue by using a white embedded Calendly surface with dark text.

## Backend and dashboard

Supabase stores waitlist applications, funnel events, settings, and referral links. The dashboard supports:

- Lead list, search, filtering, and CSV export.
- Lead drawer with email, phone, and Instagram contact actions.
- Safe handling of skipped/missing Instagram handles by showing `Instagram skipped` instead of a broken link.
- Pipeline status tracking: new, contacted, qualified, booked, won, and lost.
- Follow-up dates, owner assignment, tags, internal notes, and saved lead context.
- Referral links for different social placements such as Instagram profile, YouTube description, TikTok bio, communities, or custom sources.
- Editable referral URL/code fields so links can be customized directly in the dashboard.
- Referral metrics for views, starts, leads, booked calls, won leads, lost leads, and closed leads.
- Funnel settings for copy, accent color, application availability, auto-advance timing, proof sections, VSL URL, booking CTA, and public tracking IDs.
- Optional forwarding of new leads to a server-only `LEAD_WEBHOOK_URL`.

## Local setup

1. Add the values from `.env.example` to `.env.local`.
2. Link the Supabase project and apply `supabase/migrations`:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

3. Install dependencies and run the app:

   ```bash
   npm install
   npm run dev
   ```

The operations dashboard is available at `/dashboard`. Local development allows a clearly labelled admin bypass. Preview and production require both `DASHBOARD_PASSWORD` and a long random `DASHBOARD_SESSION_SECRET`.

## Environment notes

- Never commit `.env.local`.
- Apply the SQL migrations before accepting live submissions.
- `SUPABASE_SECRET_KEY` is server-only.
- `POSTHOG_PERSONAL_API_KEY` is server-only.
- `LEAD_WEBHOOK_URL` is optional and server-only.
- Browser-facing variables must use `NEXT_PUBLIC_` and should never contain secrets.

## Data boundaries

- Supabase stores application answers and contact details.
- PostHog receives behavioral events only; form answers, email addresses, phone numbers, and names are excluded.
- Session replay, if enabled, must mask all form inputs.
- Lead webhooks should only be enabled with a trusted server-side endpoint.

## Checks

Run these before handing off changes:

```bash
npm run lint
npm run typecheck
npm run build
```

The latest checks after removing the Instagram question passed:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
