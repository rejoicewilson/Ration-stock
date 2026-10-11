import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../react _frontend/src/App.jsx', import.meta.url), 'utf8');
const dateHelpers = source.slice(source.indexOf('const toEposDate ='), source.indexOf('const calculateCommission ='));
const submitHandler = source.slice(source.indexOf('  const submitTransactionRequest ='), source.indexOf('  const handleTransactionsSubmit ='));
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [2026, 9, 11, 12]));
  }
}
const requests = [];
const submit = new Function('Date', 'featureFetch', 'TRANSACTIONS_API_URL', 'console',
  `${dateHelpers}\n${submitHandler}\nreturn submitTransactionRequest;`
)(FixedDate, async (_url, options) => {
  requests.push(JSON.parse(options.body));
  return { ok: true, text: async () => JSON.stringify({ summary: {} }) };
}, '/transactions', { error() {} });

async function check({ year, month, commission = true, from, to, expectedError }) {
  let error = '';
  let result;
  let loading = false;
  const count = requests.length;
  await submit({ preventDefault() {} }, {
    year, month, fps_id: '1842187', dist_code: '18', afso: '42',
    ...(commission ? {} : { from_date: '2026-07-05', to_date: '2026-07-19' }),
  }, {
    isCommission: commission,
    setLoading: value => { loading = value; },
    setError: value => { error = value; },
    setResult: value => { result = value; },
  });
  assert.equal(loading, false);
  if (expectedError) {
    assert.match(error, expectedError);
    assert.equal(requests.length, count, 'Invalid periods must not fetch');
  } else {
    assert.equal(error, '');
    assert.equal(requests.length, count + 1);
    assert.equal(requests.at(-1).from_date, from);
    assert.equal(requests.at(-1).to_date, to);
    assert.equal(requests.at(-1).month, Number(month));
    assert.deepEqual(result.requested_period, { from_date: from, to_date: to });
  }
}

await check({ year: '2026', month: '08', from: '01-08-2026', to: '07-09-2026' });
await check({ year: '2026', month: '10', from: '01-10-2026', to: '11-10-2026' });
await check({ year: '2026', month: '01', from: '01-01-2026', to: '07-02-2026' });
await check({ year: '2026', month: '11', expectedError: /current month or a previous month/ });
await check({ year: '2025', month: '12', expectedError: /January 2026/ });
await check({ year: '2026', month: '07', commission: false, from: '05-07-2026', to: '19-07-2026' });
assert.ok(source.includes('{!isCommissionView && <Grid container spacing={1.5}>'));
console.log('PASS: automatic commission periods, future/pre-2026 rejection, result date fallback, and manual transaction dates.');
