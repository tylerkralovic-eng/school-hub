# School Hub: V1 demo (Stage A)

A mobile-first family dashboard that brings school updates for several children at different schools into one place.

> **DEMO:** all people, schools and messages are fictional. No accounts, database, API keys or real integrations are used.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build: `npm run build && npm start`. Checks: `npx tsc --noEmit`, `npm run lint`.

For the best preview, open it at iPhone size (browser dev tools → device toolbar), or on a phone on the same Wi-Fi at `http://<your-computer-ip>:3000`.

## What's included (Tonight milestone, docs/03)

- **Home:** briefing, items to review, to-do list with completion, upcoming events, latest notices, source health
- **Inbox:** unified feed grouped by date received, type filter (`?kind=task|event|announcement`), expandable source evidence
- **Calendar:** two-week strip and 30-day agenda of events and deadlines, with stale-source warnings
- **Share:** honest placeholder; extraction is **not** connected
- Child filter (Everyone / Maya / Leo) across all screens. Filter and completed tasks are saved in `localStorage`.

## Architecture

```
src/lib/types.ts               Domain types (mirror docs/02 entities + extraction contract)
src/lib/fixtures/              Fictional data, dates relative to "now" (school days)
src/lib/data/index.ts          Data-access boundary: swap fixtures → Supabase here
src/lib/selectors.ts           Pure filtering/agenda/source-health logic (reusable by agents/jobs)
src/lib/format.ts              Date formatting (viewer's local time)
src/components/                FamilyProvider (client state), ItemCard, nav, filter, source health
src/app/                       Routes: /, /inbox, /calendar, /share
```

Key rules already encoded:
- Every item has `sources[]` with `receivedAt` and a verbatim `excerpt`.
- `childId: null` means school-wide. Unknown children or dates are never invented.
- Source status is `connected | stale | not_connected`. Unconnected sources are never shown as "nothing new".
- `reviewStatus: needs_review` items are flagged as unconfirmed.

## Next (Sprint 1)
Supabase auth + family-scoped RLS → paste → server-side structured extraction (Zod) → parent review → saved item.
