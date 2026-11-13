# 03 Implementation Plan

## Tonight: 60–120 minutes
Initialize Next.js/TypeScript/Tailwind and GitHub. Build Home, Inbox, Calendar and Share screens with 8–12 fictional updates for two children at different schools. Add child filtering, local task completion, source labels, responsive layout, and DEMO labeling. No authentication, API keys, database or real student information.

## Tonight definition of done
Morgan can open the demo, filter by child, inspect a unified feed, view upcoming events, and mark a task done. Share is clearly a placeholder, not fake AI. Run lint/type/build checks and commit.

## Sprint 1: real extraction
Add Supabase authentication and family-scoped RLS before storing real data. Build paste → server-side structured AI extraction → Zod validation → parent review/edit → saved item. Preserve original source and timestamp. Test missing date, unknown child, failures and unauthorized access.

## Sprint 2: hybrid ingestion
Add school-email forwarding with sender controls; ICS calendar subscription; safe private screenshot/document upload; background retries; deduplication and source freshness. Keep unsupported apps explicitly unconnected.

## Sprint 3: controlled pilot
Separate parent accounts, family access, reminders, deletion/export, monitoring, security/privacy review and five-family onboarding. Compare extracted critical updates against manually audited accessible source messages.

## Decision gates
1: Does Morgan prefer the unified experience? 2: Which real school apps provide authorized email, ICS, share or API access? 3: Are important updates captured reliably with less work? 4: Will pilot parents pay?

## Risks
App-only data unavailable; school terms or API restrictions; false confidence from missing updates; AI mistakes; duplicate announcements; manual-sharing burden; sensitive student information.

## Budget guidance
Founder-built demo can be low cost, but production security, legal review, vendor integrations, marketing and support are separate costs. Validate before making revenue projections into commitments.
