// Request behavior checks without a live backend, credentials, or real payments.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../react _frontend/src/accountApi.js', import.meta.url), 'utf8');
const { featureFetch } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
globalThis.window = new EventTarget();
let sessionEnded = 0;
let subscriptionRequired = 0;
window.addEventListener('ration-session-ended', () => sessionEnded++);
window.addEventListener('ration-subscription-required', () => subscriptionRequired++);

try {
  globalThis.fetch = async (url, options) => {
    assert.equal(options.credentials, 'include');
    assert.equal(options.cache, 'no-store');
    return new Response('{}', { status: 402 });
  };
  await assert.rejects(featureFetch('/transactions', { method: 'POST' }), /plan has expired/);
  assert.equal(subscriptionRequired, 1);
  assert.equal(sessionEnded, 0, 'Expiry must keep the account signed in');

  globalThis.fetch = async () => new Response('{}', { status: 401 });
  await assert.rejects(featureFetch('/count'), /sign in again/);
  assert.equal(sessionEnded, 1);
  assert.equal(subscriptionRequired, 1);

  for (const status of [200, 503]) {
    const response = new Response('{}', { status });
    globalThis.fetch = async () => response;
    assert.equal(await featureFetch('/count'), response);
  }
  assert.equal(subscriptionRequired, 1);
  assert.equal(sessionEnded, 1);
  console.log('PASS: expiry requests renewal without signing out; expired sessions request sign-in; credentials and uncached requests preserved.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}
