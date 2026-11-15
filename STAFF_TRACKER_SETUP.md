# Salesman Attendance & Salary

Branch: `feature/staff-attendance-salary`. This feature is manually entered and private to the signed-in account. It never reads ePoS, transfers money, or shares records between accounts with the same FPS number.

## Deployment

1. Run `supabase/migrations/20261114_staff_attendance_salary.sql` in the project's Supabase SQL Editor. It requires the existing Python accounts schema. It adds only staff tables and a service-role-only RPC; existing accounts, plans and stock features are unchanged.
   Then run `supabase/migrations/20261114_staff_daily_backdate.sql` to allow daily-wage attendance before the saved start date.
   Finally run `supabase/migrations/20261114_staff_running_balance.sql` for daily running balances. If the first two migrations are already applied, run only this latest migration. It replaces the RPC without changing existing records. Always apply this running-balance migration last.
2. Deploy backend and frontend together after applying the migration. No new environment variables.
3. Open **Salesman Attendance & Salary**, add a salesman, then mark attendance. Test with a non-production account before wider use.

The migrations are rerunnable. They must be applied manually in the Supabase SQL Editor; pushing code does not apply database migrations.

## Pay rules

Current UI/API: **daily wages only**. Adding staff requires name, daily wage and start date; the pay-frequency selector has been removed. No additional SQL migration is required for this restriction. The backend rejects new weekly/monthly staff. Existing weekly/monthly records, if any, retain their original rate, calculation and history for compatibility; they are not converted to daily wages automatically. The following weekly/monthly rules apply only to those legacy records.

Daily attendance can be backdated to any date from 2020 through today, including dates before the saved start date. Saving an earlier marked day moves that staff member's tracking start back atomically, so that day's earnings and payments work normally. No intermediate days are automatically marked or paid. Clearing attendance does not change the start date. Future attendance remains prohibited, and Sunday still requires explicit holiday work and extra pay. Legacy weekly/monthly staff retain their original start-date rules.

The Staff Passbook uses a staff selector and monthly attendance calendar. Navigate with month arrows, the month picker or Today. Dates show P (Present), A (Absent), ½ (Half-day), L (Paid leave), W (Holiday worked) or grey Sunday Off; unmarked dates have a dot. Future dates are disabled. Daily staff can select dates before their saved tracking start. Tap a date, then mark or change attendance below the calendar. The four attendance counts cover only the visible month, while Earned, Paid and Balance due are all-time through today. Switching staff shows only that member's calendar and closes the previous member's payment form. Calculations and a combined dated timeline stay collapsed under Attendance & payment history. Cancelled payments remain visible but do not count toward totals. No additional database migration is needed for the calendar beyond the existing running-balance update.

Unmarked dates are visible directly in the calendar. The separate missing-attendance count, link and date list have been removed. Unmarked dates still earn no wages and are not automatically marked absent; calculation rules are unchanged.

- New staff use daily pay. Legacy weekly periods are Monday–Sunday; legacy monthly periods are calendar months. Sunday is the fixed holiday in this version.
- Daily pay earns the configured rate per marked working day. Weekly/monthly pay is divided by all Monday–Saturday working days in that full period. Joining mid-period prorates eligible days without changing that divisor.
- Present and paid leave earn a full day; half-day earns half; absent earns zero and shows a one-day deduction. Sunday has no deduction. Unmarked past days remain pending, not absent; upcoming days are shown separately.
- Earned pay is based on marked attendance through today in IST. A partial or incomplete period is not presented as finalized full salary. Scheduled pay, deductions, earned pay and payments are displayed separately. Rounding happens once on each total, to paise, using half-up rounding.
- Sunday work requires an explicitly entered extra amount. It does not automatically add the ordinary daily rate.
- Daily-wage balance is all earned wages and Sunday extra pay through today minus all non-cancelled payments through today. Payments can cover 2, 3, 7, 10 or any number of working days, including partial payments. Advances count once and can produce a paid-ahead balance. Existing per-day payment records are included automatically with no data conversion. Legacy weekly/monthly records retain their period calculation.
- Selecting an older date changes attendance and the visible history month, while the daily running balance remains current through today. The database aggregates all-time totals independently of the month-filtered history so other-month attendance or payments are never dropped from the balance. Payment history is filtered by paid date. The backend refuses to show daily balances until the latest RPC migration is installed.
- Incorrect payment records can be cancelled, with history retained. Attendance can be changed or cleared, with the prior value retained in operation receipts. Corrections recalculate pay and can show a paid-ahead amount.
- Staff names, rates and frequencies are set at creation in this first version. Effective-dated rate changes, configurable holidays, staff self-login, payslip exports and automatic bank payments are not included. Maximum 50 staff per account.

## Privacy and save behavior

All staff endpoints require the existing session, trusted origin, completed password change and active plan. Owner ID is injected server-side. Browser request bodies cannot supply account ID. RLS is enabled; browser Supabase roles have no table/RPC access. Financial data is not stored in browser local storage or a service-worker cache, and activity tracking contains only a feature label.

Every mutation has an idempotency UUID and staff revision. The database serializes changes per account, rejects stale revisions and returns the saved response for an exact retry. A reused UUID with changed details is rejected. After an uncertain save, the UI keeps the original payload and disables further edits until a manual retry confirms it. No automatic write retries or destructive deletions.

## Checks

- `python -m unittest test_staff_tracker`: salary calculations, leap months, week boundaries, proration, pending days, holidays, privacy and auth checks.
- `node tools/test-staff-sql.mjs`: isolated PGlite database; ownership, idempotency, stale revisions, date rules, correction history, grants and rerunnable migration. Uses `PGLITE_TEST_ROOT` or the existing temporary test dependency folder.
- `node tools/test-staff-ui.mjs`: isolated browser fixture; creation, attendance, Sunday work, uncertain payment retry, correction and mobile layout. No real payments/accounts.
- `npm run build` in `react _frontend`.
