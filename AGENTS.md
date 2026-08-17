# Repository Workflow

## Scope

- This directory is the maintained Next.js production application.
- The static HTML, CSS, and JavaScript files in the parent directory are legacy unless a task explicitly targets them.
- Preserve the public application flow, dashboard authentication, Supabase boundaries, referral attribution, and analytics privacy contract when changing adjacent code.

## Branches and checkpoints

- Work on a named feature branch for changes larger than a one-line fix.
- Create a checkpoint commit after each complete, tested milestone and before risky deployment or schema work.
- Keep commits scoped and descriptive so any milestone can be reviewed or reverted independently.
- Do not rewrite, discard, or include unrelated working-tree changes in a checkpoint.

## Required verification

Run the checks relevant to the change. Public funnel or shared application changes normally require all three:

```bash
npm run lint
npm run typecheck
npm run build
```

Use browser QA for visible changes. Check desktop and mobile overflow, primary interactions, form validation, the success/Calendly state, and browser console errors.

## Data and security

- Never commit credentials, `.env.local`, exported lead data, or analytics payloads containing PII.
- Keep protected Supabase access in server-only code and represent schema changes with migrations in `supabase/migrations/`.
- Validate public and admin API input with Zod and preserve deterministic error responses.
- Keep dashboard authentication in signed HTTP-only cookies; do not introduce browser-stored admin secrets.
- Analytics must not receive names, emails, phone numbers, social handles, form answers, free text, or complete URLs.

## Product baseline

- The current public visual baseline is the original curtain layout with a darker warm tint and gold accent `#F2C268`.
- The default hero ends with `AI Digital Ecom Businesses`.
- Funnel copy may be stored in Supabase; retain compatibility with previous default values when changing branded presentation logic.
- Keep `README.md` and `ANALYTICS.md` synchronized with behavioral, configuration, route, or privacy changes.
