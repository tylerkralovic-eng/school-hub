# Security & privacy review (V1 pilot)

Reviewed: November 2026, by the founding team with Claude Code. Not a substitute for an
independent security assessment or legal advice.

## Controls in place (implemented and tested)
| Area | Control | Verified by |
|---|---|---|
| Authentication | Supabase Auth, email + password (10+ chars, mixed case, digit), email confirmation in production, password reset, no account enumeration on reset | e2e `m1-family` |
| Family isolation | Postgres Row Level Security on every family table; membership check via `is_family_member()`; triggers stop cross-family references (child, school, document, assignee) | `tests/rls.test.ts` (11 tests), e2e cross-family checks |
| Second parent | Single-use invite tokens stored as SHA-256 hashes, 7-day expiry, bound to the invited email | `rls.test.ts`, e2e |
| File storage | Private bucket; path prefix = family id; storage RLS; 20 MB limit; type checked by content (magic bytes) and hash on processing; short-lived signed URLs (5 min) | `rls.test.ts`, e2e spoofed-file test |
| Secrets | Gmail refresh tokens encrypted (AES-256-GCM) in a table with RLS and **no** user policies (service role only) | `integrations.test.ts` |
| OAuth | `gmail.readonly` only (least privilege for reading bodies), CSRF `state` cookie, scope check, token revocation on disconnect | code review; live test blocked on credentials |
| Webhooks | Twilio HMAC-SHA1 signature verification; unknown numbers ignored silently; phones verified by an inbound one-time code; idempotent on MessageSid | e2e `m3-m5` |
| API keys | iOS Shortcut keys hashed, add-only, revocable, rate-limited (40/hour) | e2e |
| AI | Server-side only; key never reaches the browser; structured outputs + Zod validation; document text treated as data (prompt-injection instruction); test stub refused on production | unit tests |
| Abuse/cost | 60 documents/hour/parent in-app; 40/hour via API; Gmail sync ≤ 15 new emails/run; sync-now throttled to 2 min | code |
| Web | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | `curl -I` |
| Cron | Bearer secret with constant-time comparison | e2e |
| Data rights | Export (JSON), delete documents/items, delete family (rows + files), delete account, configurable retention for originals | e2e |
| Audit | `audit_events` for invites, membership, connections, deletions, exports, reviews | Activity log page |

## Known gaps / accepted risks for a founders-only pilot
1. **No MFA.** Supabase supports TOTP; enable before external families.
2. **Calendar subscription URL is a bearer link.** Anyone with it can read event titles. Owners can rotate it.
3. **Service-role key on the server** bypasses RLS for webhooks/cron. All such code paths filter by a verified family id; keep the key only in Vercel env vars.
4. **Rate limiting is per-user in the database**, not at the edge. Add Vercel WAF / Upstash rate limits before a public launch.
5. **No malware scanning** of uploads. Files are only displayed via signed URLs as images or downloaded PDFs; consider scanning before wider rollout.
6. **Logs**: errors are logged without document contents, but Vercel/Supabase logs should be reviewed for retention.
7. **Google testing mode** tokens expire weekly (see DEPLOYMENT.md).

## Privacy & regulatory considerations (not legal advice)
- **FERPA** governs schools and districts, not parents. A parent sharing their own child's
  records with a tool they choose is generally outside FERPA. FERPA *would* matter if
  School Hub contracted with schools or received records directly from them (then a
  "school official" agreement and data-protection terms are typical). V1 does not.
- **COPPA** applies to online services directed to children under 13 or that knowingly
  collect personal information *from* children. School Hub is for parents; children never
  use it. Their information (first names, grades, schools) is provided by parents. Keep the
  product parent-only, require adult account holders (add an 18+ attestation at signup),
  and avoid features that let children interact.
- **State student-privacy laws** (e.g. California SOPIPA, Georgia's Student Data Privacy Act)
  mainly target operators serving schools, and may become relevant if School Hub partners
  with schools/districts. Review with counsel before any school partnership.
- **Vendors**: Anthropic (commercial API terms; inputs not used for training by default;
  consider a DPA and zero-data-retention request), Supabase and Vercel (DPAs available),
  Google API Services User Data Policy (Limited Use requirements for Gmail data), Twilio.
- **Children's photos**: Kambu screenshots may contain photos of other children. Advise
  parents to share announcements, not class photos, and keep originals' retention short.

## Blockers before inviting external families
1. Written privacy policy and terms reviewed by counsel; consent checkbox at signup (incl. 18+).
2. Enable MFA (at least optional) and email confirmation; custom SMTP domain with SPF/DKIM.
3. Google OAuth verification + CASA assessment **or** pilot families use paste/forward instead of Gmail.
4. DPAs signed with Anthropic, Supabase, Vercel (and Twilio if SMS is used).
5. Incident-response contact and a documented breach-notification process.
6. Independent review of RLS policies and webhook code (a few hours of a security engineer's time).
7. Backups: enable Supabase Point-in-Time Recovery (Pro plan) or scheduled exports.
