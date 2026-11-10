# Balance Book — setup and verification

Mobile layout: below 600px, each customer row puts the details and amount above its right-aligned payment button, reserving enough width for card numbers. Payment buttons remain 112 × 48px. UI checks cover one-line card numbers and no page overflow at 320/360/390px.

Optional customer mobile: apply `supabase/migrations/20261110_customer_balance_ledger_mobile.sql` after the status-filter migration, before deploying this update. It adds an optional private `customer_mobile` column (blank or a 10-digit Indian mobile number), updates list/detail/search and saves the number with the next balance/payment entry. Existing customers get blank contacts and all history is preserved. The input is below the optional name; saved contacts fill automatically and are read-only. Search accepts contact digits too. Numbers are shown only inside this account's ledger, never sent to analytics, put in URLs or used for OTPs/messages. No automatic contact lookup, verification or unique-phone requirement is added; card number remains the customer identifier. Do not log customer mobile numbers. Migration reruns preserve data.

Optional-name update: “പേര് (വേണമെങ്കിൽ)” is directly below the card number. After a verified card read, an existing name fills automatically and is read-only (the database only fills blank names). A new name saves with the next balance/payment entry; names are not mandatory and card number remains the unique identifier. Lists show name above the full card number, and search is labelled “കാർഡ് / പേര് തിരയുക”. Notes remain hidden. Existing database support is reused; no migration is needed for this update.

Closed-card visibility update: apply `supabase/migrations/20261108_customer_balance_ledger_status_filter.sql` after the original ledger migration and before deploying the updated app. This replaces only the RPC function; it does not delete or alter balances/history. Default list shows nonzero balances under “ബാക്കിയുള്ള കാർഡുകൾ”; “തീർന്നവ കാണുക” switches to zero-balance cards. A nonempty search spans both statuses. Filtering happens before pagination, and cards with new balances automatically reappear in the active list. Older clients remain compatible (`status` defaults to `all`); the updated UI checks the returned status so a missing migration cannot silently show an unfiltered list.

Layout update: search sits below the saved-card heading, immediately before the list, labelled “കാർഡ് / പേര് തിരയുക”. The new-balance form appears first.

Recent-card payments: each nonzero balance has a “പണം ലഭിച്ചു” or “തിരികെ നൽകി” action. Its popup fetches the current balance, prefills an editable received/returned amount, and previews the remainder in integer paise. One “രേഖപ്പെടുത്തുക” button records partial or full payment. Amounts must be ₹0.01–₹1,00,000 and cannot exceed the outstanding balance. The balance is rechecked before the first write; a changed balance resets the amount and needs confirmation again. Payments append normal entries without deleting history; ambiguous retries lock the amount and reuse the exact payload and UUID. Stale list actions are disabled. No database update is needed for this popup refinement.

Notes remain hidden in the entry form; existing saved notes remain intact in history. Optional names are now directly visible without an extra toggle.

Developed on `feature/customer-balance-ledger`; approved for local merge into `main`. Publishing/deployment requires a separate push request.

## Scope

A private notebook for small manually entered balances, identified by a 10-digit ration card number and optional customer name. No card/member lookup or ePoS purchase detection is performed. Data belongs to the authenticated **account**, not every account with the same FPS number. Card numbers, names and notes are stored in private backend tables for this feature; they are not sent to analytics or put in URLs/localStorage.

The notebook uses one signed net balance per customer:

- Positive: customer owes the shop (കിട്ടാനുണ്ട്).
- Negative: shop owes the customer (കൊടുക്കാനുണ്ട്).
- Zero: settled.

The form shows ration card number, optional name, optional mobile, amount, two direction radio choices (customer owes shop / shop owes customer), then one Save button. Search sits under the saved-card heading. Direction selection never saves by itself or silently changes based on the customer's net balance. Existing contact details/current balance load automatically; new cards are created by the first saved entry. Search changes clear the selected entry to prevent applying it to the previous customer; selecting a result fills the card field. Repayments use current balance sign, not the new-balance radio choice. Both new entries and payments require a verified same-card read. After recording, the card stays selected and the amount clears; Next card clears the entry. Notes remain hidden; history and corrections remain available, with a required correction reason. Customer rows have borders, labelled name/card/phone icons and equal-size outlined payment buttons (112 × 48 px).

Opposite balances on the same customer page offset each other. The backend report retains separate totals of positive and negative customer balances; the task-first screen omits these overview totals to focus on one customer.

Store only the unpaid difference: a ₹22 bill paid with ₹20 creates a ₹2 entry. Received/returned payments can be partial, but cannot exceed the current applicable balance. The backend validates this under a customer-row lock. All amounts use integer paise; there is no floating-point money arithmetic in storage.

Corrections add an opposite entry linked to the original, with a required reason. Original entries remain visible. Each original can be corrected only once; correction entries themselves cannot be reversed. Correcting an older entry may change the direction of the current balance. History stores each entry's actual running balance at the time it was written; it is not silently rewritten.

## Rollout — when the feature is approved

1. Run `supabase/migrations/20261108_customer_balance_ledger.sql` in the Supabase SQL Editor **before** deploying this backend. It adds two RLS-enabled private tables and a service-role-only RPC. It does not change plans, payments or existing account records. Rerunning preserves notebook data.
2. Deploy the feature only to the intended environment/branch. Vite and Vercel route `/ledger/*` to the backend. Every route requires a valid account, changed temporary password, trusted POST origin and current plan access, like the other paid app features. Financial records remain stored when access expires; subscription renewal restores feature access.
3. Check the ₹2 example, partial repayment, customer credit, correction and persistence after signing out/in with a test account. Do not use real customer details for preview testing.

All ledger requests use POST with `no-store`; the service worker excludes the ledger API. An unavailable database fails closed and is not replaced with phone-only storage. There is no offline saving or syncing.

Read-only list/detail calls retry transient network/5xx errors twice with 1s/2.5s waits; each read attempt has an 18-second client timeout. Read retries are cancelled when their view/search changes or unmounts. Authentication, subscription, validation and rate-limit errors are not retried. Writes/corrections never retry automatically. Last-loaded lists are kept only in component memory for the same search/page and explicitly marked stale during refresh/failure. Customer detail actions still require a freshly successful read; stale lists do not authorize financial mutations. Save confirmation remains separate from list-refresh status. Server diagnostics record RPC action, error class, upstream status and validated database code, plus request-stage markers—never card numbers, account IDs, names, notes, credentials or raw database messages.

Each mutation has an account-bound request UUID. Retrying the same submission in the current form reuses it, preventing duplicate financial entries after a lost response. This does not promise duplicate protection after clearing/switching customers or reloading: if a save result is uncertain, check/refresh history before starting a new entry. Customer mobiles are optional private contact details only; no WhatsApp reminders, bill collection or actual money transfers are included.

## Local checks

- `.venv/Scripts/python.exe -m unittest test_balance_ledger`
- `node tools/test-balance-ledger-sql.mjs` (isolated PGlite; set `PGLITE_TEST_ROOT` if installed elsewhere).
- `node tools/test-balance-ledger-ui.mjs` (hidden Chrome and mocked API, no production requests).
- `node tools/test-balance-ledger-api.mjs` (isolated request retry/cancellation policy, no network).
- `npm run build` in `react _frontend`.

The UI test generates a temporary `ration-balance-ledger-mobile.png` screenshot. No live database migration or production writes are performed by these tests.
