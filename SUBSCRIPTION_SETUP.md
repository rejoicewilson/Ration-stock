# ₹99 subscription rollout

Development branch: `feature/99-subscription`. Test checkout and a single-account
live-payment pilot are supported. No scheduled November switch or production
paywall is active. Live payments are disabled unless the Preview pilot is
explicitly configured.

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
orders and user verification; the signed webhook can still finish a payment
already in flight. Live keys are accepted only by the explicitly enabled,
account-scoped Preview pilot described below.

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
production launch decision and rollout are required before production access
can change.

## Single-account real-payment pilot on Preview

This pilot is for **one signed-in account** on the `feature/99-subscription`
Vercel Preview. It cannot run on Vercel Production or another branch. The
server checks the account's FPS ID **and** registered mobile, both sourced
from its authenticated session. Matching only an FPS ID is not enough because
multiple accounts can use the same shop number. All other Preview accounts
retain free feature access and cannot create a live payment order. `main` is
unchanged. Test entitlements never grant live access.

After confirming Razorpay Live Mode is active, configure these as
**branch-specific Preview** environment variables for `feature/99-subscription`:

```text
BILLING_MODE=live
LIVE_PILOT_ENABLED=true
LIVE_PILOT_ACCESS_REQUIRED=false
LIVE_PILOT_FPS_ID=1234567
LIVE_PILOT_MOBILE=<registered mobile in 91XXXXXXXXXX format>
PAYMENTS_ENABLED=true
RAZORPAY_KEY_ID=<rzp_live_... key ID>
RAZORPAY_KEY_SECRET=<matching live key secret>
RAZORPAY_WEBHOOK_SECRET=<new live webhook secret>
```

Do not put secrets in Git, frontend variables, chat, or Production settings.
Create a **Live Mode** Razorpay webhook for this Preview's HTTPS
`/auth/subscription/webhook` endpoint using the same new webhook secret.
Select `payment.captured` and `order.paid`. If Preview protection is enabled,
ensure Razorpay can reach the endpoint using the configured protection bypass;
do not expose the bypass value publicly. Keep the existing test webhook/secret
separate. Redeploy the feature branch after changing Vercel variables. Vercel
must provide `VERCEL_GIT_COMMIT_REF=feature/99-subscription` at runtime;
without it, live checkout fails closed.

First leave `LIVE_PILOT_ACCESS_REQUIRED=false`. Check that the pilot account's
`/auth/subscription/status` reports `mode=live`, `eligible=true`, and
`required=false`, then open `/subscription` manually and confirm Razorpay
Checkout can create a real ₹99 order. Do not complete that order yet if you
want to see the unpaid paywall first. Set `LIVE_PILOT_ACCESS_REQUIRED=true`
for this Preview branch and redeploy to begin the paywall test. If payment
configuration is missing or `PAYMENTS_ENABLED=false`, the pilot gate stays off
to avoid trapping the account without a way to pay.

Before paying, sign in as the pilot account and check `/auth/subscription/status`:
`mode=live`, `required=true`, `eligible=true`, `active=false`. Sign in as any
other account and confirm `required=false`, `eligible=false`. Pilot checkout
charges **real ₹99**. After payment, check Razorpay shows **Captured** and
the app reports `active=true` with a 30-day `paid_until`; opening services
should work without signing in again. Test a declined/cancelled checkout and
the “Check payment status” recovery action too. Do not repeat a successful
payment merely to refresh the screen: a second captured order extends access
by another 30 days.

To stop new live charges, set `PAYMENTS_ENABLED=false` and redeploy. This also
returns the pilot account to free access instead of leaving it locked out. Keep
`BILLING_MODE=live`, live API keys, and live webhook secret in place until all
pending live payments have been reconciled; the signed webhook can still
activate an already-captured order while new orders are disabled. Never
switch Preview back to test keys while a live order may still be unsettled.
The Production environment is deliberately excluded; a separate reviewed
implementation is required to launch paid access on `main`. This pilot does
not automatically revoke access after a later refund or dispute; review those
events manually before expanding beyond the pilot.

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
