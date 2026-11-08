# Balance Book — setup and verification

Closed-card visibility update: apply `supabase/migrations/20261108_customer_balance_ledger_status_filter.sql` after the original ledger migration and before deploying the updated app. This replaces only the RPC function; it does not delete or alter balances/history. Default list shows nonzero balances under “ബാക്കിയുള്ള കാർഡുകൾ”; “തീർന്നവ കാണുക” switches to zero-balance cards. A nonempty search spans both statuses. Filtering happens before pagination, and cards with new balances automatically reappear in the active list. Older clients remain compatible (`status` defaults to `all`); the updated UI checks the returned status so a missing migration cannot silently show an unfiltered list.

Layout update: the search field now sits below “മുൻ കാർഡുകൾ”, immediately before the saved-card list, labelled “കാർഡ് തിരയുക”. The new-balance form appears first.

Recent-card settlement: each nonzero balance has a “തീർക്കുക” action. It fetches the current card balance, asks for received/returned confirmation, and rechecks before the first write. A changed amount needs confirmation again. Settlement appends a normal payment entry without deleting history; ambiguous retries reuse the exact payload and UUID. Stale list actions are disabled. Amounts above the per-entry limit must use partial payments through the existing form.

UI update: optional name/note entry fields and their toggle are removed for now. Existing saved names/notes remain intact; search and history still display existing records. New entries send empty optional fields. No database migration is needed for this change.

Developed on `feature/customer-balance-ledger`; approved for local merge into `main`. Publishing/deployment requires a separate push request.

## Scope

A private notebook for small manually entered balances, identified by a 10-digit ration card number and optional customer name. No card/member lookup or ePoS purchase detection is performed. Data belongs to the authenticated **account**, not every account with the same FPS number. Card numbers, names and notes are stored in private backend tables for this feature; they are not sent to analytics or put in URLs/localStorage.

The notebook uses one signed net balance per customer:

- Positive: customer owes the shop (കിട്ടാനുണ്ട്).
- Negative: shop owes the customer (കൊടുക്കാനുണ്ട്).
- Zero: settled.

The form shows ration card number, amount, two direction radio choices (customer owes shop / shop owes customer), then one Save button. Search sits under the recent-card heading. Direction selection never saves by itself or silently changes based on the customer's net balance. Existing customer name/current balance load automatically; new cards are created by the first saved entry. Search changes clear the selected entry to prevent applying it to the previous customer; selecting a result fills the card field. A secondary repayment action prefills the full balance for partial/full settlement using the same Save button. Repayments use current balance sign, not the new-balance radio choice. Both new entries and payments require a verified same-card read. After recording, the card stays selected and the amount clears; Next card clears the entry. Optional name/note inputs are removed; history and corrections remain available, with a required correction reason. No database changes are required for these UI refinements.

Opposite balances on the same customer page offset each other. The backend report retains separate totals of positive and negative customer balances; the task-first screen omits these overview totals to focus on one customer.

Store only the unpaid difference: a ₹22 bill paid with ₹20 creates a ₹2 entry. Received/returned payments can be partial, but cannot exceed the current applicable balance. The backend validates this under a customer-row lock. All amounts use integer paise; there is no floating-point money arithmetic in storage.

Corrections add an opposite entry linked to the original, with a required reason. Original entries remain visible. Each original can be corrected only once; correction entries themselves cannot be reversed. Correcting an older entry may change the direction of the current balance. History stores each entry's actual running balance at the time it was written; it is not silently rewritten.

## Rollout — when the feature is approved

1. Run `supabase/migrations/20261108_customer_balance_ledger.sql` in the Supabase SQL Editor **before** deploying this backend. It adds two RLS-enabled private tables and a service-role-only RPC. It does not change plans, payments or existing account records. Rerunning preserves notebook data.
2. Deploy the feature only to the intended environment/branch. Vite and Vercel route `/ledger/*` to the backend. Every route requires a valid account, changed temporary password, trusted POST origin and current plan access, like the other paid app features. Financial records remain stored when access expires; subscription renewal restores feature access.
3. Check the ₹2 example, partial repayment, customer credit, correction and persistence after signing out/in with a test account. Do not use real customer details for preview testing.

All ledger requests use POST with `no-store`; the service worker excludes the ledger API. An unavailable database fails closed and is not replaced with phone-only storage. There is no offline saving or syncing.

Read-only list/detail calls retry transient network/5xx errors twice with 1s/2.5s waits; each read attempt has an 18-second client timeout. Read retries are cancelled when their view/search changes or unmounts. Authentication, subscription, validation and rate-limit errors are not retried. Writes/corrections never retry automatically. Last-loaded lists are kept only in component memory for the same search/page and explicitly marked stale during refresh/failure. Customer detail actions still require a freshly successful read; stale lists do not authorize financial mutations. Save confirmation remains separate from list-refresh status. Server diagnostics record RPC action, error class, upstream status and validated database code, plus request-stage markers—never card numbers, account IDs, names, notes, credentials or raw database messages.

Each mutation has an account-bound request UUID. Retrying the same submission in the current form reuses it, preventing duplicates after a lost response. Different payloads cannot reuse the same key. This does not promise duplicate protection after clearing/switching customers or reloading: if a save result is uncertain, check/refresh history before starting a new entry. No customer mobile numbers, WhatsApp reminders, bill collection, payments or money transfers are included.

## Local checks

- `.venv/Scripts/python.exe -m unittest test_balance_ledger`
- `node tools/test-balance-ledger-sql.mjs` (isolated PGlite; set `PGLITE_TEST_ROOT` if installed elsewhere).
- `node tools/test-balance-ledger-ui.mjs` (hidden Chrome and mocked API, no production requests).
- `node tools/test-balance-ledger-api.mjs` (isolated request retry/cancellation policy, no network).
- `npm run build` in `react _frontend`.

The UI test generates a temporary `ration-balance-ledger-mobile.png` screenshot. No live database migration or production writes are performed by these tests.
