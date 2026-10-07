# Signup, login and owner dashboard

All existing features require login; no paid-access checks are included.

## Setup

1. Run `supabase/migrations/20261005_python_accounts.sql`, then
   `supabase/migrations/20261005_activity_dashboard.sql` in Supabase SQL Editor.
   They preserve existing records when rerun. No cleanup script runs on deployment.
2. Configure backend variables in `.env.example`. Use the new owner's account UUID
   as `OWNER_ACCOUNT_ID`; the deleted test owner's UUID will not work.
3. `pip install -r requirements.txt`, then `uvicorn main:app --reload --port 8000`.
4. In `react _frontend`, run `npm install` and `npm run dev`. Keep frontend API
   URLs relative so auth cookies and feature calls use the same-origin proxy.
5. Configure the backend variables in Vercel separately before deploying main.
   Set `APP_ALLOWED_ORIGINS` to the production origin (plus any custom domain).
   Secrets must never be in frontend VITE_ variables or committed .env files.

## Behaviour

- New browsers see Create account with a short Malayalam introduction. Successful
  registration signs users in and opens the selected feature. Returning browsers
  remember only a yes/no flag and show Sign in. Passwords are never stored there.
- Mobile number is unique; shop numbers may repeat. Phone ownership is unverified.
- Argon2id password hashes and HttpOnly cookies; backend authentication for every
  feature endpoint. No browser-count or replacement-cooldown limits for free login.
  Password checks and the 15-minute sign-in attempt limits remain in force.
  Existing sessions remain valid; no account or session cleanup is needed.
  Rerun the updated accounts SQL to remove database-side browser checks as well.
  Old MAX_ACTIVE_DEVICE_SESSIONS/DEVICE_REPLACEMENT_COOLDOWN_DAYS variables are
  ignored by this version and can be removed from Vercel and local configuration.
- Owner dashboard: `/admin`. Every dashboard API call checks the owner UUID.
  Tracks daily/monthly unique accounts and successful feature-request counts in
  India time. Login itself and e-Treasury visits do not count. The account cards
  show this month's features and last use. No queried ration card data is stored.
  Member search covers all accounts by shop/mobile number, including partial
  matches. Matching results are paginated in groups of 50; summary totals remain
  global. Rerun the updated activity-dashboard SQL to enable server-side search.
- Recovery: `python recover_account.py`, only after independent ownership checks.
  Resets require a recorded reason and revoke sessions; new password required.
  Alternatively, the owner dashboard provides Reset member password. This requires
  the owner's current password, an ownership-verification note, and confirmation.
  The owner chooses and confirms a temporary password of at least 12 characters.
  It is hashed server-side, never saved in browser storage, and must differ from
  the owner's password. The member must still replace it at the next sign-in.
  Audit notes record the acting owner UUID. Share the password only with the
  verified account owner. Self-reset is blocked; use Change password instead.
  The existing reset RPC is reused; no database migration is needed for this UI.

## Before deployment

- Check signup/login/logout/reload and mobile UI on an HTTPS preview deployment.
- Test owner access and confirm other accounts get HTTP 403 on the dashboard API.
- Publish a privacy notice for account and activity data; establish retention,
  backups and support recovery procedures. Do not clear real accounts after launch.
- Run `python -m unittest test_account_auth -q` and frontend `npm run build`.

The local .env is ignored and shared across branch switches; only the variables
documented above are used by this branch's account implementation.
