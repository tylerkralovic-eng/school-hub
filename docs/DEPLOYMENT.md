# Deploying School Hub (secure test environment)

Estimated time: ~45 minutes for the core (Supabase + Vercel + Anthropic), plus optional
Gmail (~30 min) and SMS (~20 min). Monthly cost for a 1–5 family pilot is typically
**$0–$30**: Supabase and Vercel free tiers, Anthropic usage (≈ $0.05–$0.25 per document),
Twilio ≈ $1.15/month per number + ~$0.01 per text.

## 1. Supabase (database, login, file storage)
1. Create a project at supabase.com (region near you). Save the database password.
2. **Easiest:** Supabase dashboard → **SQL Editor** → New query → paste the whole of
   `supabase/setup.sql` → **Run** (once, on a new project). Or, with the CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies supabase/migrations (tables, RLS, storage bucket)
   ```
3. Dashboard → **Authentication → URL Configuration**:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `https://<your-app>.vercel.app/**`
4. **Authentication → Providers → Email**: keep *Confirm email* ON. Minimum password length 10.
5. **Authentication → Emails → SMTP**: configure a real sender (e.g. Resend). Supabase's
   built-in email is limited to a few messages per hour and isn't for production.
6. **Project Settings → API**: copy the URL, `anon` key, and `service_role` key.

## 2. Anthropic (AI extraction)
console.anthropic.com → create an API key → add billing → set a monthly spend limit
(e.g. $25). Model defaults to `claude-opus-5-5`. Refusals are retried on a fallback model automatically.

## 3. Vercel (hosting)
1. vercel.com → Add New → Project → import `school-hub` from GitHub.
2. Environment Variables: everything in `.env.example` marked Required, plus
   `ANTHROPIC_API_KEY` and `SMTP_URL`/`EMAIL_FROM`. Generate secrets with:
   ```bash
   openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY (or any random password of 32+ characters)
   openssl rand -hex 24      # CRON_SECRET (or any random password of 32+ characters)
   ```
   Do **not** set `SCHOOLHUB_TEST_MODE` in Vercel.
3. Deploy, then set `APP_URL` to the final URL and redeploy.
4. The daily job (`vercel.json`) runs at 10:30 UTC (Gmail sync, morning digest, retention).
   Vercel Hobby allows one run per day; Pro allows hourly (change the schedule to `0 * * * *`).
   Parents can also tap **Sync now** in Connections.

## 4. Gmail (optional)
1. console.cloud.google.com → new project → **APIs & Services → Library → Gmail API → Enable**.
2. **OAuth consent screen**: External, app name "School Hub", support email, scopes:
   `openid`, `email`, `https://www.googleapis.com/auth/gmail.readonly`.
   Publishing status: **Testing**. Add test users (your and Morgan's Gmail addresses; max 100).
3. **Credentials → Create OAuth client ID → Web application**. Authorized redirect URI:
   `https://<your-app>.vercel.app/api/gmail/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel; redeploy.

**Limitations (important):** `gmail.readonly` is a Google *restricted* scope.
- In Testing mode, Google shows an "unverified app" warning, and **refresh tokens expire after
  7 days**: parents must reconnect weekly (the app shows "Reconnect Gmail").
- Removing these limits for external families requires Google OAuth verification **and** an
  annual third-party security assessment (CASA), typically several weeks and $500–$4,500+.

## 5. SMS forwarding (optional)
1. twilio.com → buy a local number with SMS/MMS.
2. Number → Messaging → "A message comes in" → Webhook (HTTP POST):
   `https://<your-app>.vercel.app/api/inbound/sms`
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in Vercel.
4. In the app: Connections → Text messages → **Link my phone**, then text the code from that phone.

**Limitations:** receiving is fine without registration, but the confirmation replies are
outbound messages; US carriers increasingly require **A2P 10DLC registration** (brand + campaign,
~$20 one-time + small monthly fees, 1–3 weeks) for reliable delivery of any outbound text. If
replies don't arrive, forwarding still works; check the Connections page instead.

## 6. Verify after deploying
- Sign up, create the family, invite the second parent (check the email arrives).
- Upload a photo of a real school calendar → review → approve → see it on Calendar.
- Open `/api/cron/daily` *without* a token → expect 401.
- Check response headers include `Content-Security-Policy` and `Strict-Transport-Security`.

## Local development
```bash
npm install
npm run db:start            # local Supabase in Docker
npx supabase status -o env  # copy URL/keys into .env.local (see .env.example)
npm run dev
npm test                    # unit + database (RLS) tests
npm run test:e2e            # browser tests (needs the app running on :3000)
```
