# Owner dashboard: days used

Run `supabase/migrations/20261018_owner_usage_days.sql` in Supabase SQL Editor
after the existing account/activity migrations, then deploy the app update.

The migration adds a service-role-only, read-only report function. It does not
modify accounts, activity records, payment records, subscriptions, or the existing
dashboard function. No new environment variable is required.

Open the owner dashboard and select **Days used**. The report shows FPS, joined
date, distinct days used, and last-used date. Results are sorted by days used
descending, joined date descending, and account ID for stable pagination.
Search by shop/mobile number; Previous/Next reaches the full matching account
list, 50 rows at a time. Accounts with no recorded activity have 0 days used.

The report matches the requested SQL: it uses all recorded activity dates, not
just this month. Several features on the same date count as one day. Dates use
Asia/Kolkata. Login alone does not count; usage from before tracking began cannot
be recovered. Accounts sharing an FPS number remain separate accounts.

`GET /auth/admin/usage-days` requires an existing owner session and rejects
temporary-password sessions. Database access stays server-side; browser users
cannot call the private tables or report function directly.

Local checks:

```text
.venv\Scripts\python.exe -m unittest discover
node tools/test-owner-usage-days-sql.mjs
node tools/test-owner-usage-days-ui.mjs
```

SQL tests use the existing temporary PGlite test installation, not live Supabase.
Browser tests use installed Chrome (or `CHROME_PATH`) and mocked accounts only.

## Recently used accounts

Run `supabase/migrations/20261018_owner_recent_usage.sql` once, then deploy the
app update. This adds a separate read-only function; existing reports and data
are preserved. No new environment variable is needed.

Select **Recently used** for one row per account that has recorded feature use,
ordered by its latest successful request timestamp. Columns show FPS, exact last
use date/time in IST, and the latest feature. Search and pagination work across
the full matching list. Accounts with no recorded use are omitted from this tab
but remain in Member details and Days used.

This is not online-presence tracking or a login history. Refresh data loads the
latest recorded feature use. `GET /auth/admin/recent-usage` is owner-only and
rejects temporary-password sessions, just like the other report.
