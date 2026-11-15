# Balance Book and Salesman Management usage

Apply `supabase/migrations/20261115_activity_balance_staff.sql` in Supabase SQL Editor after the existing activity dashboard setup, then deploy the backend and frontend changes together. No environment changes are needed. The SQL is rerunnable and preserves saved activity, accounts and grants.

Successful protected requests under `/ledger/` are recorded as `balanceLedger`, and `/staff/` as `staffTracker`. The owner dashboard shows Balance Book and Salesman Management in feature charts, member activity and recent usage. Grouping comes from the server route; browser feature hints cannot change it. This counts completed requests, including reads and saves, rather than visits or unique attendance entries.

Only account ID and feature label are recorded. Names, amounts and notebook data are not added to analytics. Failed requests do not count. Activity-recording failures continue to leave successful feature requests intact.

New activity appears after the SQL and code are installed and an account successfully uses either feature. Previously rejected events were not saved and are not backfilled. Existing daily activity reports automatically include the new records.

Verification: backend unittest suite; `node tools/test-feature-usage-sql.mjs` (isolated PostgreSQL); `node tools/test-owner-usage-days-ui.mjs` (mock dashboard); frontend production build.
