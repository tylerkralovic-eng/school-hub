# 02 Technical Architecture

## Recommended stack
Claude Code development; Next.js App Router, TypeScript and Tailwind frontend; Supabase Auth/PostgreSQL with Row Level Security and private storage for production; server-side OpenAI or Anthropic structured extraction; Vercel hosting; GitHub version control.

## Stages
A: local demo with typed fictional fixtures, no accounts or secrets. B: authentication, family-scoped schema, manual sharing and AI extraction with human review. C: authorized email forwarding, ICS calendars, screenshot/document ingestion and background jobs. D: evaluate direct vendor APIs individually.

## Data flow
Authorized email/calendar or parent-shared content → source document with timestamp → extraction job → validated structured AI output → duplicate check → parent review if uncertain → family-scoped event/task/announcement → dashboard and optional alerts.

## Core entities
families; family_members; children; schools; sources (kind, status, last successful sync); source_documents (origin, received time, content hash); school_items (child, kind, title, due/event date, review status); item_sources; processing_jobs; notifications.

## Extraction contract
Each extracted item: kind (task/event/announcement), title, child match or null, due_at or null, event_at or null, source evidence, needs_review. Validate with Zod; resolve dates against school timezone and message timestamp; never invent unknown dates or children.

## Access and security
Enforce family membership server-side and via Supabase RLS; use separate parent accounts; encrypt tokens; least-privilege OAuth; never store school passwords; private uploads; server-only model keys; file-type/size limits; rate limiting and audit logging.

## Reliability
Idempotent ingestion using message IDs/content hashes; retries and visible failures; deduplication as reviewable candidates; correction workflow; source health indicators; clear distinction between no updates found and source not checked.

## Privacy gate
Before real student data or external pilot: engineering security review, consent and retention/deletion policy, vendor agreement review, and qualified assessment of applicable FERPA/COPPA/state obligations. Do not claim compliance automatically.

## Repository layout
src/app routes; src/components; src/lib/types and fixtures; src/lib/extraction and validation; supabase/migrations later; tests; docs; .env.example with placeholders only.
