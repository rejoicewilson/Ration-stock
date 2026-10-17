// No live requests: verify safe API failures and render the actual error card.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const source = await readFile(new URL('../react _frontend/src/accountApi.js', import.meta.url), 'utf8');
const { featureFetch, featureErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
globalThis.window = new EventTarget();
const technical = "HTTPSConnectionPool(host='epos.kerala.gov.in'): Max retries exceeded; ConnectTimeoutError at 0x12345";
try {
  for (const [body, status, kind] of [
    [{ detail: { code: 'EPOS_UNAVAILABLE', message: technical } }, 500, 'epos'],
    [{ detail: { code: 'EPOS_UNAVAILABLE' } }, 504, 'epos'],
    [{ detail: `Upstream ePoS transaction request failed: ${technical}` }, 500, 'epos'],
    [{ detail: technical }, 500, 'service'],
    [{ detail: { code: 'SCM_UNAVAILABLE' } }, 500, 'service'],
    [{ detail: 'Account service is temporarily unavailable.' }, 503, 'service'],
    ['<html>FUNCTION_INVOCATION_FAILED stack trace</html>', 502, 'service'],
  ]) {
    globalThis.fetch = async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    await assert.rejects(featureFetch('/transactions'), error => {
      const message = featureErrorMessage(error);
      assert.equal(message.kind, kind);
      assert.doesNotMatch(JSON.stringify(message), /HTTPSConnectionPool|epos\.kerala|stack trace|0x12345/);
      return true;
    });
  }
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(featureFetch('/transactions'), error => featureErrorMessage(error).kind === 'network');
  const invalid = new Response('{"detail":"Invalid FPS ID"}', { status: 400 });
  globalThis.fetch = async () => invalid;
  assert.equal(await featureFetch('/transactions'), invalid, 'Input errors remain separate');
  for (const [status, text] of [[401, /sign in again/], [402, /plan has expired/]]) {
    globalThis.fetch = async () => new Response('{}', { status });
    await assert.rejects(featureFetch('/transactions'), error => {
      assert.match(featureErrorMessage(error), text);
      return true;
    });
  }
  assert.equal(featureErrorMessage(new Error(technical)), 'Unable to load these details. Please try again.');
  assert.equal(featureErrorMessage(new Error('Please select the current month or a previous month.')),
    'Please select the current month or a previous month.');

  const filename = fileURLToPath(new URL('../react _frontend/src/FeatureError.jsx', import.meta.url));
  const require = createRequire(filename);
  const { transformSync } = require('esbuild');
  const { code } = transformSync(await readFile(filename, 'utf8'), { loader: 'jsx', format: 'cjs' });
  // Let MUI detect a server renderer rather than the API-test EventTarget stub.
  delete globalThis.window;
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(dirname(filename));
  module._compile(code, filename);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Card = module.exports.default;
  const render = props => renderToStaticMarkup(React.createElement(Card, props));
  const html = render({ error: { kind: 'epos' }, onRetry() {} });
  assert.match(html, /വിവരങ്ങൾ ലഭ്യമായില്ല/);
  assert.match(html, /സർക്കാർ ePoS/);
  assert.match(html, /വീണ്ടും ശ്രമിക്കുക/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /HTTPSConnectionPool|ConnectTimeoutError/);
  assert.match(render({ error: { kind: 'epos' }, onRetry() {}, loading: true }), /disabled=""/);
  assert.doesNotMatch(render({ error: { kind: 'network' } }), /സർക്കാർ ePoS/);
  assert.doesNotMatch(render({ error: { kind: 'service' } }), /സർക്കാർ ePoS/);
  assert.match(render({ error: 'Please select a district.' }), /Please select a district/);
  console.log('PASS: sanitized ePoS, server and network errors; separate account/input errors; Malayalam card rendering and disabled retry.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}
