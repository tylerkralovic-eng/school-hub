# School Hub — Project Status

_Last updated: 2026-11-13 · Branch `main`_

## Summary
V1 family-pilot build is **functionally complete in code and verified locally** against a
real Supabase stack (Postgres + RLS + Auth + Storage + SMTP) with automated tests. Remaining
work is mostly **external setup** (credentials, accounts, Google verification) and live
verification with the real AI model and real family documents.

Legend: ✅ done & verified · 🟡 implemented, verification pending external setup · ⛔ blocked · 🔜 not started

## Definition of Done
| # | Criterion | Status | Evidence / blocker |
|---|---|---|---|
| 1 | Two parents can access the same family workspace | ✅ | Invite flow e2e (`m1-family`, `m3-m5`); RLS tests |
| 2 | Multiple children and schools | ✅ | Onboarding + settings e2e |
| 3 | Parent can upload a real school calendar photo | ✅ | Upload, on-device resize, private storage, preserved original (e2e `m2`) |
| 4 | AI extracts multiple individual events from that photo | 🟡 | Claude vision extraction implemented with strict schema + validation; tested with a stub. **Live run blocked: needs `ANTHROPIC_API_KEY`.** Run `LIVE_AI=1 npx vitest run tests/live` |
| 5 | Parent can correct and approve extracted events | ✅ | Review UI e2e (edit title, skip item, approve) |
| 6 | Approved events appear in the shared calendar | ✅ | e2e `m2` calendar check; second parent sees same data |
| 7 | Screenshots and PDFs can be uploaded | ✅ | PDF e2e; images any source; spoofed types rejected |
| 8 | Pasted/shared text enters the same workflow | ✅ | Paste, SMS, Shortcut API, Android share target → same pipeline |
| 9 | Tasks and reminders work | ✅ | Assign, complete, Mine filter e2e; morning digest delivered (local SMTP); ICS feed. Production email needs `SMTP_URL` |
| 10 | Unified feed shows source information | ✅ | Every item shows source, sender, received time, evidence quote, original link |
| 11 | Gmail can be connected and used with valid credentials | 🟡 | OAuth + encrypted tokens + sync implemented; sync tested with a fake mailbox against the real DB. **Live OAuth blocked: needs Google Cloud OAuth client.** Google verification required for non-test users |
| 12 | SMS has a documented, usable initial approach | ✅/🟡 | Forward-to-number via Twilio, signed webhook, phone verification by inbound code, MMS images — e2e with signed requests. **Live number blocked: needs Twilio account.** Paste/screenshot fallback works today |
| 13 | Duplicate information is handled | ✅ | Same file/message/email never processed twice; fuzzy same-day matching suggests "link as another source" at review |
| 14 | Family data is isolated and protected | ✅ | 11 RLS tests, cross-family e2e, encrypted secrets, private storage, security headers |
| 15 | Core workflows are tested | ✅ | 35 unit/integration tests + 33 browser e2e steps (3 suites) |
| 16 | Deployable to a secure test environment | 🟡 | Production build passes; `docs/DEPLOYMENT.md`; **needs your Supabase + Vercel projects** |

## What works today (verified locally)
- Accounts (email/password, reset), family creation, invite second parent by link/email, remove member.
- Children (aliases for matching, colors), schools, per-child filter everywhere.
- **Add**: camera photo, photos/screenshots/PDFs (up to 10, 20 MB), paste text; "who is it for" hint.
- **Pipeline**: ingest → hash/idempotency → Claude extraction (structured output) → Zod validation →
  time-zone normalization → strict child/school matching → uncertainty flags → duplicate check → review → save with provenance.
- **Review**: edit type/title/date/time/end/child/location/details, include/skip, merge duplicates, retry failed docs.
- **Home**: today, needs action (incl. payments), coming up, recent announcements, review banner, closure alerts.
- **Calendar**: month grid with child-colored dots, agenda, multi-day events, add/edit/delete events.
- **Inbox**: unified feed by received date with type, school and category filters.
- **Tasks**: open/done, overdue/this week/later, assign to parent, "Mine", quick add.
- **Reminders**: morning email digest (closures, today's events, tasks due ≤2 days, items to review); phone calendar subscription (ICS).
- **Connections**: Gmail, SMS, uploads, sharing (Android/iOS), calendar export, Outlook (planned); six school platforms with family-reported channels, coverage level, children, last received, method and limits.
- **Data**: export JSON, delete originals/items/family/account, retention for originals, activity log, privacy page.

## Blockers needing you
1. **Supabase project** (free) — database/auth/storage for the test environment.
2. **Vercel project** — hosting (import the GitHub repo, add env vars).
3. **Anthropic API key** — required for real extraction (DoD #4). ≈ $0.05–0.25 per document.
4. **SMTP sender** (e.g. Resend, free tier) — invitation + digest emails in production.
5. **Google Cloud OAuth client** (optional, for Gmail) — testing mode works for you and Morgan with weekly reconnects; external families need Google verification + CASA.
6. **Twilio number** (optional, for SMS) — ~$1.15/month; A2P registration may be needed for reply messages.
7. **Real documents**: test with actual school calendars/newsletters from Everley's and Adler's schools after deploying.

## Architectural decisions
- **Next.js 15 App Router + server components** reading via the user's Supabase session so **RLS applies to every query**. Service-role client only in webhooks/cron/secrets, always filtered by a verified family id.
- **One pipeline for every channel** (`src/lib/pipeline`); new sources are thin adapters (`src/lib/integrations`). Direct platform integrations can be added later as new adapters without changing review, storage or UI.
- **Synchronous extraction** (≤ ~1 min) instead of a job queue; document status doubles as job state; retries via UI and cron. Revisit if volume grows.
- **Direct-to-storage uploads** from the browser (bypasses 4.5 MB serverless body limit); images downscaled on device.
- **Wall-clock dates in family time zone** converted with Intl (DST-safe), no date library.
- **No vendor SDKs** for Gmail/Twilio (small REST clients); Anthropic SDK for Claude.
- **Claude Opus 5.5** with structured outputs, prompt caching on the system prompt, and server-side refusal fallback enabled.
- **Honest connection model**: no school platform has a direct integration; coverage is computed from how each platform notifies the family.

## Next steps (recommended order)
1. Deploy test environment (Supabase + Vercel + Anthropic + SMTP) — ~45 min with `docs/DEPLOYMENT.md`.
2. Live-verify AI on 5–10 real school documents; tune the prompt; record accuracy (missed/wrong items).
3. Set up Gmail in testing mode for both parents; add real school sender addresses.
4. Two-week founder pilot; log every missed or wrong item (pilot success criteria).
5. Before external families: items in `docs/SECURITY_PRIVACY.md` → "Blockers before inviting external families" (privacy policy/consent, MFA, DPAs, Google verification decision, independent review).
6. V2 candidates: push notifications (PWA web push), per-task reminders, recurring events, delegation, native iOS share extension.

## How to run tests
```bash
npm run db:start && npm test          # unit, RLS, integration (35)
npm run build && npm start            # in another terminal
npm run test:e2e                      # browser e2e (needs SCHOOLHUB_TEST_MODE=1 locally)
LIVE_AI=1 ANTHROPIC_API_KEY=… npx vitest run tests/live   # real-model extraction check
```
