# 60-day sliding login sessions

Deployment order:

1. Run `supabase/migrations/20261107_session_renewal.sql` in the project's Supabase SQL Editor. It is transactional and safe to rerun. It adds a service-role-only RPC, without changing the existing auth RPC or any account/plan data.
2. Deploy the updated backend. Do not deploy backend first: a missing RPC deliberately returns service-unavailable, not unauthorized.
3. Confirm `/auth/me` sets a private session cookie with roughly 60 days remaining. A repeat request within a day should not set another cookie. Confirm logout and password recovery still invalidate sessions.

New sign-ins and password changes receive 60-day sessions. Existing **unexpired** sessions upgrade on authenticated use. Expired/revoked sessions are never resurrected; those users must sign in again. The device-identity cookie alone cannot authenticate.

Database expiry is extended at most daily, and browser cookies are refreshed at most daily using a token-bound, HttpOnly signed renewal marker. Cookie lifetime never exceeds the returned database expiry. With daily batching, expiry occurs roughly 59–60 days after the last authenticated use, not exactly 60 days after the last click. An open visible app periodically checks authentication and therefore counts as use; hidden-tab periodic checks are already paused.

Plans, payments, free-period overrides and subscription enforcement are unchanged. Resetting passwords, changing passwords (other devices), disabling accounts and signing out still prevent access even if a browser retains a cookie. An in-flight request may still return a cookie after concurrent revocation, but that cookie cannot authenticate against the database.

Rollback: revert the backend change. The new RPC can remain installed. Already-issued 60-day sessions retain their existing expiry; rollback does not silently revoke them.
