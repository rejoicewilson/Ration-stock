// Browser checkout tests with fake gateway and HTTP responses; no real payments.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../react _frontend/src/accountApi.js', import.meta.url), 'utf8');
const apiUrl = `data:text/javascript;base64,${Buffer.from(api).toString('base64')}`;
const source = (await readFile(new URL('../react _frontend/src/razorpayCheckout.js', import.meta.url), 'utf8'))
  .replace("'./accountApi'", JSON.stringify(apiUrl));
const { openSubscriptionCheckout, loadRazorpay } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const order = { order_id: 'order_fixture', key_id: 'rzp_test_fixture', mode: 'test', amount: 9900, currency: 'INR', prefill_contact: '919999999998' };
const callback = { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'a'.repeat(64) };
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let behavior;
let requests;
let constructorCount;
let responseFor;
globalThis.window = {
  Razorpay: class {
    constructor(options) { this.options = options; constructorCount++; }
    open() { queueMicrotask(() => behavior(this.options)); }
  },
};
function reset() {
  requests = [];
  constructorCount = 0;
  responseFor = url => url.endsWith('/order') ? order : { activated: true, subscription: { paid_active: true } };
  behavior = options => options.handler(callback);
  globalThis.fetch = async (url, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.cache, 'no-store');
    requests.push({ url, body: JSON.parse(options.body) });
    const body = responseFor(url);
    return new Response(JSON.stringify(body), { status: body.error ? 503 : 200 });
  };
}
try {
  reset();
  assert.equal(await loadRazorpay(), window.Razorpay);
  assert.equal((await openSubscriptionCheckout()).state, 'active');
  assert.equal(constructorCount, 1);
  assert.deepEqual(requests.find(r => r.url.endsWith('/verify')).body, callback);

  reset();
  responseFor = url => url.endsWith('/order') ? order : { activated: false, subscription: { paid_active: false } };
  assert.equal((await openSubscriptionCheckout()).state, 'pending', 'Checkout callback alone must not grant access');

  reset();
  behavior = options => options.modal.ondismiss();
  responseFor = url => url.endsWith('/order') ? order : { subscription: { paid_active: false } };
  assert.equal((await openSubscriptionCheckout()).state, 'pending', 'Closing checkout must check server status');
  assert.ok(requests.some(r => r.url.endsWith('/reconcile')));

  reset();
  behavior = options => { options.handler(callback); options.modal.ondismiss(); options.handler(callback); };
  await openSubscriptionCheckout();
  assert.equal(requests.filter(r => r.url.endsWith('/verify')).length, 1);

  reset();
  responseFor = url => url.endsWith('/order') ? order : url.endsWith('/verify') ? { error: true }
    : { subscription: { paid_active: true } };
  assert.equal((await openSubscriptionCheckout()).state, 'active', 'Lost verify response should recover from the server');

  reset();
  responseFor = url => url.endsWith('/order') ? order : { error: true };
  assert.equal((await openSubscriptionCheckout()).state, 'pending', 'Uncertain payment must not be reported as success');

  for (const changes of [{ amount: 1 }, { currency: 'USD' }, { mode: 'live' }, { order_id: 'bad' }]) {
    reset();
    responseFor = () => ({ ...order, ...changes });
    await assert.rejects(openSubscriptionCheckout());
    assert.equal(constructorCount, 0);
  }
  reset();
  responseFor = () => ({ already_active: true, subscription: { access_allowed: true } });
  assert.equal((await openSubscriptionCheckout()).state, 'active');
  assert.equal(constructorCount, 0);
  console.log('PASS: server-confirmed activation, fixed order validation, dismissal recovery, callback idempotency, and no false success after network errors.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}
