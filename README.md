# Photo Resell Funnel

Production Next.js waitlist funnel with Supabase lead storage, PostHog analytics hooks, and Vercel deployment support.

## Local setup

1. Add the values from `.env.example` to `.env.local`.
2. Link the Supabase project and apply `supabase/migrations`.
3. Run `npm install` and `npm run dev`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Data boundaries

- Supabase stores application answers and contact details.
- PostHog receives behavioral events only; form answers and contact details are excluded.
- Session replay is consent-gated and masks all form inputs.
- `SUPABASE_SECRET_KEY` and `POSTHOG_PERSONAL_API_KEY` are server-only.

Never commit `.env.local`. Apply the SQL migration before accepting live submissions.
