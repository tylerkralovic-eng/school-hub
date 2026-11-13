# School Hub

A family-first, mobile-first hub for school information across multiple children, schools and apps.
Parents add calendars, flyers, newsletters, screenshots, emails and texts; AI pulls out events,
deadlines and to-dos; parents review; everything lands in one shared calendar, inbox and task list —
always linked to its original source.

- **Status, blockers & decisions:** [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **Deploy:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Security & privacy:** [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md)
- **iPhone sharing:** [docs/IOS_SHORTCUT.md](docs/IOS_SHORTCUT.md)
- Product docs: `docs/01–04_*.md`

## Stack
Next.js 15 (App Router, TypeScript, Tailwind) · Supabase (Auth, Postgres + RLS, Storage) ·
Claude (vision + structured outputs) · Gmail API · Twilio · Vercel.

## Quick start (local)
```bash
npm install
npm run db:start                 # local Supabase (Docker)
cp .env.example .env.local       # fill from `npx supabase status -o env`
npm run dev                      # http://localhost:3000
npm test
```

## Layout
```
src/app/(auth)        login, signup, password reset
src/app/(app)         home, calendar, add, review, inbox, tasks, connections, settings
src/app/api           gmail oauth, inbound sms, ingest (iOS Shortcut), calendar feed, cron, export
src/lib/pipeline      extraction schema, Claude client, normalization, dedupe, processing
src/lib/integrations  gmail, twilio, sender rules, token encryption
src/lib/reminders     digest email, ICS feed
supabase/migrations   schema + RLS + storage policies
tests/                unit, RLS, integration, e2e (Playwright), live AI
```
