# ₹99 subscription rollout

Development branch: `feature/99-subscription`. Current step: private subscription
storage, status endpoint, Razorpay **test-mode backend**, and test checkout screen.
No scheduled November switch, live payment collection, or feature paywall is active yet.

## Step 1: subscription foundation

The additive migration `supabase/migrations/20261012_subscription_foundation.sql`
creates `ration_private.entitlements` with a separate `test` and `live` paid-until
timestamp per account. It does not delete or update existing accounts. The only
database function in this step reads one account's status; it cannot grant access.

Do not run either migration against production until the code and launch steps
have been reviewed. Running them later will not turn on a paywall by itself.

After applying the migration to the intended Supabase project, an authenticated
`GET /auth/subscription/status` returns whether that account has an active
entitlement. `BILLING_MODE=test` is the default during development; test and live
statuses are isolated. The response also reports `required: false` while access
is still free. This endpoint requires the existing account session.

Local checks:

```powershell
./.venv/Scripts/python.exe -m unittest test_subscription_foundation test_payments test_account_auth
$env:PGLITE_TEST_ROOT = (Resolve-Path -LiteralPath 'tools/billing-tests').Path
node tools/test-subscription-foundation.mjs
node tools/test-subscription-orders.mjs
```

## Step 2: test-payment backend

Run `supabase/migrations/20261012_subscription_orders.sql` **after** the
foundation migration in a test Supabase project. It adds a private order ledger
and extends the service-role-only subscription RPC. Do not rerun the foundation
migration after this one: its older RPC definition would replace the billing
actions until the orders migration is reapplied. Existing accounts and access
records are preserved by both migrations.

Set `BILLING_MODE=test`, `PAYMENTS_ENABLED=true`, `RAZORPAY_KEY_ID` and
`RAZORPAY_KEY_SECRET` from the Razorpay **test** dashboard, plus a separate
`RAZORPAY_WEBHOOK_SECRET` configured for `POST /auth/subscription/webhook`.
Use an HTTPS backend URL for the webhook. Never put the key secret or webhook
secret in the frontend or commit them. `PAYMENTS_ENABLED=false` prevents new
orders and user verification; the signed webhook can still finish a test
payment already in flight. A live Razorpay key is deliberately rejected.

The signed-in backend flow is `POST /auth/subscription/order` to create a
₹99 order, then `POST /auth/subscription/verify` with the Checkout order ID,
payment ID, and signature. `POST /auth/subscription/reconcile` checks recent
pending orders if Checkout closes or the callback fails. The webhook is another
recovery path. Both verification paths ask Razorpay for payment details and
grant 30 days only to a captured, unrefunded ₹99 payment for the stored order.
Repeated callbacks do not extend the date twice; a separate paid renewal adds
30 days to the current expiry. No feature access depends on this yet.

## Step 3: test checkout screen

Signed-in users can open `/subscription` on this branch to see the test plan.
Set `VITE_SUBSCRIPTION_TEST_UI=true` in the frontend environment to show a
“Test ₹99 plan” button in the account bar. Leave the flag false for production
until the plan is ready to advertise. The frontend key ID comes from the
backend's order response; no payment secret is sent to the browser.

Checkout loads Razorpay's Standard Checkout on demand. Its result goes to
`/auth/subscription/verify`; “Check payment status” calls the reconciliation
endpoint if the user closes checkout or the callback fails. The screen clearly
labels test mode and tells users that all features are still free.

To test end to end, apply the two SQL migrations to a test Supabase project,
configure test Razorpay keys and webhook, enable test payments in the backend,
and sign in with a test account. Check a successful test payment, dismissal,
refresh, and early renewal. Local automated tests do not contact Razorpay or
Supabase, so they cannot replace that end-to-end check.

The server-side test access switch is `SUBSCRIPTION_ACCESS_REQUIRED` (default
`false`). It works only with `BILLING_MODE=test` outside Vercel Production.
When enabled in Preview, signed-in members without an active test plan are
sent to the subscription screen; the backend also rejects protected feature
requests with HTTP 402. Login, password changes, the owner dashboard, and the
subscription screen remain available. The owner account is exempt from the
test gate. Turn the switch back off after testing. Changing a Vercel Preview
environment variable requires a fresh feature-branch deployment.

This switch is deliberately unable to enforce live subscriptions. A separate
live-billing implementation, live keys/webhook, and explicit launch decision
are required before production access can change.

## Preview webhook check

Deploy only `feature/99-subscription` to Vercel Preview. Confirm the deployment
details show that branch as the source; a Preview deployment of `main` does not
contain the payment endpoint. Scope the test Razorpay keys, `BILLING_MODE=test`,
`PAYMENTS_ENABLED=true`, `RAZORPAY_WEBHOOK_SECRET`, and Supabase connection
values to Preview for this branch. Do not copy test settings to Production.
After adding or changing Preview environment variables, build a fresh deployment
from this feature branch. An already-built Preview will not acquire new secrets,
and redeploying `main` will not update the subscription Preview.

Vercel may protect Preview URLs. If protection is on, use a dedicated
Protection Bypass for Automation token in the Razorpay test webhook URL; keep
that token private and revoke it after testing. The endpoint path is
`/auth/subscription/webhook`. The Razorpay webhook signing secret is separate
from both the API key secret and the Vercel bypass token. Use Test mode and
subscribe to `payment.captured` and `order.paid`. The webhook is idempotent:
receiving both events for one payment must not add two periods of access.
After creating or rotating the webhook secret, deploy this feature branch again
before testing delivery. Check the Razorpay test webhook's delivery history for
an HTTP success response; a protected Preview also needs its automation bypass
token in the webhook URL. Do not share either secret or the full bypass URL.
