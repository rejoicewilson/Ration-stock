# Stock report consistency guard

Applies only to Stock Summary (`/count`) and Ration Stock Board (`/stock-register`). No database migration is required.

- Each submission performs two independent, uncached ePoS report reads. Board reads use request-local sessions and never share report cookies.
- Compare complete stock-row snapshots, ignoring serial numbers and row order. Do not compare only totals, vote, choose the lower quantity, or fall back to a previously loaded report.
- If the snapshots differ, return HTTP 503 with the safe code `STOCK_INCONSISTENT`. Neither snapshot is included in the response. The UI clears the old result and shows a Malayalam verification warning with manual Retry.
- Invalid reports or failed reads fail closed. A genuine zero report is accepted only when both valid reads match.
- Matching reports include `consistency_checked: true`; the frontend requires it. The timestamp describes fetch completion, not the government's data-update time.
- Dealer-name lookup runs only after board reports match. No repeated verification loop or automatic voting/retry is added. Expect one extra upstream report request per submission and some additional latency.

Important limitation: two matching responses establish consistency, not freshness. ePoS can return the same outdated report twice. Without an authoritative source update/version indicator, the app cannot guarantee the latest stock or safely infer freshness from increasing/decreasing quantities. New deliveries and corrections can change balances in either direction.

Checks:

- Backend unittest suite, including both conflict orders, same-total/different-row reports, zero stock, invalid responses, request-local sessions and private no-store responses.
- `node tools/test-stock-freshness-ui.mjs`
- `node tools/test-stock-board-freshness-ui.mjs`
- `node tools/test-subscription-access.mjs`
- `npm run build` in `react _frontend`.

Browser tests use a mocked API. They never query live accounts or change stock records.
