// Isolated request-policy test. No network, server, browser or real records.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const frontend = fileURLToPath(new URL('../react _frontend/', import.meta.url));
const require = createRequire(new URL('../react _frontend/package.json', import.meta.url));
const { build } = require('esbuild');
const bundle = await build({ stdin: { resolveDir: frontend, contents: `export {ledgerRequest} from './src/ledgerApi';` }, bundle: true, write: false, format: 'esm' });
const { ledgerRequest } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
let calls = 0;
const events = [];
globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms === 18000 ? 50 : 1), clearTimeout,
  dispatchEvent: event => events.push(event.type) };
const reply = (status = 200) => new Response(JSON.stringify(status === 200 ? { ok: true } : { detail: 'Fixture unavailable' }), { status });
const reset = fn => { calls = 0; globalThis.fetch = async (...args) => { calls++; return fn(...args); }; };
reset(() => reply(calls === 1 ? 503 : 200));
const retries = [];
assert.deepEqual(await ledgerRequest('customers', {}, { onRetry: n => retries.push(n) }), { ok: true });
assert.equal(calls, 2); assert.deepEqual(retries, [1]);
reset(() => reply(503));
await assert.rejects(ledgerRequest('customer', {}));
assert.equal(calls, 3);
reset(() => { throw new TypeError('Fixture network failure'); });
await assert.rejects(ledgerRequest('customers', {}));
assert.equal(calls, 3);
for (const status of [400, 401, 402, 403, 409, 429]) {
  reset(() => reply(status));
  await assert.rejects(ledgerRequest('customers', {}));
  assert.equal(calls, 1, 'No retry of authorization, validation, conflict or rate-limit failures');
}
assert.ok(events.includes('ration-session-ended'));
assert.ok(events.includes('ration-subscription-required'));
for (const path of ['entries', 'reverse']) {
  reset(() => reply(503));
  await assert.rejects(ledgerRequest(path, {}));
  assert.equal(calls, 1, 'No automatic write replay');
  reset(() => { throw new TypeError('Fixture write connection lost'); });
  await assert.rejects(ledgerRequest(path, {}));
  assert.equal(calls, 1);
}
const before = new AbortController(); before.abort();
reset(() => reply());
await assert.rejects(ledgerRequest('customers', {}, { signal: before.signal }), { name: 'AbortError' });
assert.equal(calls, 0);
const duringWait = new AbortController();
reset(() => reply(503));
await assert.rejects(ledgerRequest('customers', {}, { signal: duringWait.signal, onRetry: () => duringWait.abort() }), { name: 'AbortError' });
assert.equal(calls, 1, 'Changing/unmounting view cancels pending retry');
const duringFetch = new AbortController();
reset((url, options) => new Promise((resolve, reject) => {
  options.signal.addEventListener('abort', () => reject(new DOMException('Fixture abort', 'AbortError')), { once: true });
  setTimeout(() => duringFetch.abort(), 1);
}));
await assert.rejects(ledgerRequest('customer', {}, { signal: duringFetch.signal }), { name: 'AbortError' });
assert.equal(calls, 1);
reset((url, options) => new Promise((resolve, reject) => {
  options.signal.addEventListener('abort', () => reject(new DOMException('Fixture read timeout', 'AbortError')), { once: true });
}));
await assert.rejects(ledgerRequest('customer', {}));
assert.equal(calls, 3, 'Timeouts bounded and retried only for reads');
console.log('Ledger request policy passed: transient reads retry, writes never replay, auth/rate limits stop, cancellations and timeouts bounded.');
