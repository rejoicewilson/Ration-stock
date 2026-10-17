# Live subscription setup

Fresh implementation on `feature/preproduction`. A read-only, authenticated
`GET /auth/subscription/status` endpoint supplies a compact plan button beside
Password and Sign out. Opening it shows the plan and expiry in IST. Feature
requests require an active free period or an unexpired paid plan in the server's
configured billing mode. Live mode uses live entitlements only.

The endpoint uses the read-only Supabase `public.ration_plan_status` function's
`subscription_status` action to read `ration_private.entitlements` and
`ration_private.account_free_periods` for the signed-in account. `BILLING_MODE`
chooses `test` or `live` on the server and defaults to **test**. Test payments never
count as live plans. Run
`supabase/migrations/20261016_account_free_periods.sql` in the Supabase SQL Editor
after the two previously applied subscription migrations. It adds the free-period
table and reader without changing existing records or the previous login/payment
functions. Plan status and feature requests return 503 until this reader is installed.

`SUBSCRIPTION_FREE_UNTIL` defaults to `2026-11-01T00:00:00+05:30` (November 1, 2026,
midnight IST). Set an explicit timezone if overriding it. Expiry is exclusive:
free access is reported as ended at that exact instant. Responses use UTC ISO
timestamps; `2026-10-31T18:30:00+00:00` represents the same instant.

An account's `account_free_periods.free_until` overrides this global default.
Accounts without a row keep the global date. To make October 15 the last free day
for FPS 1234567, run `supabase/operations/expire_free_plan_1234567.sql` after the
migration, replacing `REPLACE_WITH_CONFIRMED_MOBILE` locally in SQL Editor with
the account's confirmed mobile number in `91` + 10-digit format. It matches both
the confirmed shop and mobile number, changes just
that account's free cutoff, and reports the resulting IST cutoff. Active paid
plans remain valid. With this branch's feature gate, the account is blocked from
features when its free period ends unless it has an active live paid plan.

To restore that account to the global free date:

```sql
delete from ration_private.account_free_periods
where account_id in (
  select id from ration_private.accounts
  where fps_id = '1234567' and mobile = 'REPLACE_WITH_CONFIRMED_MOBILE'
);
```

## Local check

Run the app as usual, sign in, then open
`http://localhost:5173/auth/subscription/status` in the same browser. Existing Vite
`/auth` proxy configuration forwards the request to the backend. A signed-out
request returns 401. Responses are marked `Cache-Control: no-store`.

The signed-in header shows a check icon for Free plan, a verified badge for the
₹99 plan, or an expiry icon for Expired. The plan refreshes on browser focus,
once per minute while visible, and when opened. If loading fails, the button
shows Plan and offers Try again. The home page and service cards stay visible to
signed-in users regardless of their plan. When a user selects a feature, the app
checks eligibility: free and paid accounts open the feature, while expired
accounts see the renewal screen and can return home without signing out. Loading
or failed status checks show a checking/retry panel only after selecting a feature.
If a plan expires while a feature is open, the renewal screen replaces it.
Checkout uses Razorpay Standard Checkout when configured and enabled. Plan refresh
runs in the background without a status-check footer. Password changes, sign-out,
and account support remain available.

The response includes:

- `plan`: `paid` for an unexpired live plan; otherwise `free` before the cutoff;
  after the cutoff, `expired` for a past paid plan or `inactive` for no paid plan.
- `paid_active`, `paid_until`: paid-plan eligibility and its expiry.
- `free_access_active`, `free_until`: the effective free period and its end,
  using the database override when present and the global default otherwise.
- `mode`: the server's `test` or `live` mode; `price_paise: 9900`, `duration_days: 30`.
- `payments_enabled`: true only when checkout is enabled and its backend keys
  match the configured mode. Live mode also requires a webhook secret.
- `access_allowed`: true only while free or paid access is active.
- `enforcement_enabled: true`: backend feature requests enforce eligibility.

If the database or configuration is unavailable or invalid, the status endpoint
returns 503. Feature APIs use the same eligibility check and return 503 without
calling the feature handler if status cannot be determined. Expired accounts get
HTTP 402 with `detail.code = subscription_required`; the frontend opens the renewal
screen and retains the account session. Login and `/auth/me` remain available.
The plan check always uses the signed-in account,
regardless of any account ID or mode supplied as query parameters.

This branch does not modify or deploy `main`. Once merged and deployed to production,
the same rules apply there. No per-shop pilot variable is needed: eligibility comes
from the free deadline and the authenticated account's live database records.

To test, restart the backend and frontend and sign in as the expired account.
Confirm the home page appears, selecting a service opens the renewal screen, and
its Home button restores the service list. A direct feature API request with its valid
cookie must return 402. Another account with a valid free period must keep access;
an account with an active live paid plan must also keep access. Do not create a
fake paid record to simulate a real payment.

## Connect and test checkout

1. Run `supabase/migrations/20261017_subscription_payments.sql` in Supabase SQL
   Editor after the previously applied account/free-period and subscription-table
   migrations. It adds two order metadata columns and a new service-role-only
   `ration_checkout` function, and updates this branch's plan reader to support
   test/live isolation. Existing rows, account login, and the older
   `ration_subscription` function are preserved. The migration was tested against
   a temporary PostgreSQL engine; it has not been applied to your Supabase project
   by this coding session.
2. Set these backend variables locally in `.env`. Never put secrets in Vite
   variables or frontend code:

   ```dotenv
   PAYMENTS_ENABLED=true
   BILLING_MODE=test
   RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
   RAZORPAY_KEY_SECRET=YOUR_TEST_KEY_SECRET
   RAZORPAY_WEBHOOK_SECRET=YOUR_TEST_WEBHOOK_SECRET
   ```

3. Restart the backend. Sign in as FPS 1234567 and select a feature. The card must
   explicitly say this is a test payment with no real money. Existing test
   entitlements may already grant test access; they are intentionally preserved.
   The status endpoint must report `mode: "test"` and `payments_enabled: true`.
4. Click the test-payment button and use Razorpay's Test Mode success/failure
   simulator. Successful captured payment grants 30 days in **test** mode and
   returns to the selected feature without requiring login again. A failed or
   abandoned attempt must not create paid access.
5. Also test closing checkout, refreshing after payment, repeated clicks, and
   a delayed capture. If payment is uncertain, the UI offers a payment-status
   check and advises against paying twice. Pending orders are reused. A gateway
   order whose attachment timed out is recovered by its exact receipt. A
   definitively rejected create may be retried; an ambiguous create is not blindly
   repeated.

The server creates the amount (9900 paise), verifies the checkout HMAC using its
stored order ID, fetches both the gateway order and payment, verifies INR/amount/
ownership, and grants access only for captured, non-refunded payments. Activation
locks the account and order inside one database transaction. A repeated callback
or webhook for the same payment does not extend the plan again. Separate verified
renewals add 30 days to `max(now, current paid_until)`; automatic recurring charges
are not used. Checkout is offered only when access is required, avoiding charging
free-period users before launch.

### Webhook recovery

For a deployed preview, add a Razorpay **Test Mode** webhook for:

```text
https://YOUR_PREVIEW_HOST/auth/subscription/webhook
```

Select `payment.captured` and `order.paid`. Use exactly the same secret as the
backend's `RAZORPAY_WEBHOOK_SECRET`. Only this exact webhook route is exempt from
the browser-Origin requirement; it validates the raw body HMAC before any lookup.
An unknown order is ignored. Invalid signatures return 400, and temporary upstream
or database failures return a retryable failure instead of acknowledging a grant
that did not finish. Callback, webhook, and status recovery share one activation
identity. A browser cookie is not required for webhook delivery.

Localhost cannot receive Razorpay webhooks directly. The browser verification and
authenticated recovery endpoints can be tested locally; webhook delivery needs a
reachable HTTPS preview or a tunnel. The backend trusts the exact `VERCEL_URL`
and `VERCEL_BRANCH_URL` supplied by its own Vercel deployment. If those system
variables are disabled, include the exact preview origin in `APP_ALLOWED_ORIGINS`.
If Vercel deployment protection is enabled, configure its
automation bypass for the webhook URL so Razorpay can reach it. Do not paste
webhook or bypass secrets in chat or screenshots.

### Moving to live later

The requested local setup now selects `BILLING_MODE=live`. Locally stored test
API keys must be replaced with real live credentials, and a Live Mode webhook
secret must be configured, before live checkout becomes available. Secrets were
not replaced or copied by this coding session.

```dotenv
PAYMENTS_ENABLED=true
BILLING_MODE=live
RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_LIVE_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_LIVE_WEBHOOK_SECRET
```

Live checkout charges real money. Switching modes does not turn existing test
payments into live access. Keep only one effective value for each key in `.env`
(if duplicate lines exist, the last value is the one loaded). Restart the backend
after changing it. The payment migration must be installed before using checkout.

This implementation and tests do not enable payments in production or modify
Vercel settings. Configure production explicitly with `BILLING_MODE=live`,
matching `rzp_live_...` API credentials, a **Live Mode** webhook and its secret,
`PAYMENTS_ENABLED=true`, and automatic payment capture in Razorpay Dashboard.
Deploy only after the migration is installed. No shop/mobile pilot environment
variable is used. Payment mode cannot be selected through browser inputs.

API key identity is stored on each new order, preventing orders created with a
different gateway key from being silently reused. Do not rotate keys or change
mode with unsettled payments without first reconciling them under the old
configuration. Setting `PAYMENTS_ENABLED=false` disables new checkout creation;
verification, webhook delivery, and recovery can still settle already-paid orders
as long as the original mode and keys remain configured.

Refunded payments are rejected for initial activation. Refund requests, automatic
revocation after a later refund, tax invoices, and dispute workflows are not part
of this first checkout flow and need separate handling before a broad live launch.

Razorpay references: [integration and captured-payment verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/),
[raw webhook signatures and duplicate delivery](https://razorpay.com/docs/webhooks/validate-test/),
[order receipt recovery](https://razorpay.com/docs/api/orders/fetch-all/).

Run the automated checks with:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -q
node tools/test-subscription-access.mjs
node tools/test-razorpay-checkout.mjs
# SQL tests use @electric-sql/pglite installed in a temporary test-only directory:
node tools/test-checkout-sql.mjs
```
