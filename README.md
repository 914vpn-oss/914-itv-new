# 914 IPTV — Fresh setup

This is a fresh Next.js website with customer management, Supabase email/password login, manual emails and automated email reminders **3 days before expiration**. No SMS or Twilio.

## Setup
1. Upload the **contents** of this extracted folder to a new GitHub repository (not the outer folder).
2. In Supabase, create a project and run `supabase/schema.sql` in SQL Editor **once**. This SQL is for a new database; existing policies may cause errors if run twice.
3. In Supabase Authentication, create/confirm your login account. The default public sign-up screen is provided; for private administration, disable public signups after creating your account.
4. Import GitHub repository into Vercel. Set all values from `.env.example` as Vercel environment variables. Never commit actual secrets. Get Supabase URL and publishable/anon key from Supabase project settings. Service role key is secret and must only be stored server-side.
5. Create a Resend account, verify your sending domain, and use its API key and verified sender in Vercel. Resend trial sender may not send to customers.
6. Generate a long random `CRON_SECRET`. The Vercel scheduled job calls `/api/reminders` daily at 13:00 UTC. Scheduled jobs require a Vercel plan that supports this schedule.
7. Deploy and test with a sample customer and a manual email. Check Vercel logs for cron errors.

## Important security note
The included database policy allows **any authenticated account** to access all customer records. This is appropriate only for a single trusted admin account with public sign-ups disabled. For multiple users, implement owner-scoped policies before production.

## Important reminder note
The reminder job checks expiration exactly three UTC calendar days ahead. It stores a sent record after sending; rare network/database failures can cause duplicate delivery. For critical production use, add a durable queue and idempotency controls.
