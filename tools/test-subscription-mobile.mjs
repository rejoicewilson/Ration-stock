// Real Chromium layout test with mocked checkout: no live accounts or payments.
// Uses an installed Chrome/Edge and the frontend's existing esbuild dependency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../react _frontend/', import.meta.url));
const require = createRequire(join(frontend, 'package.json'));
const { build } = require('esbuild');
const bundle = await build({
  stdin: { resolveDir: frontend, loader: 'jsx', contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { CssBaseline } from '@mui/material';
    import AccountApp from './src/AccountApp';
    window.__checkoutCalls = 0;
    window.__outcome = 'pending';
    window.fetch = async url => {
      if(url === '/auth/me') return new Response(JSON.stringify({account:{id:'layout-fixture',fps_id:'1234567'}}));
      if(url === '/auth/subscription/status') return new Response(JSON.stringify({plan:'expired',mode:'live',payments_enabled:true,access_allowed:false}));
      throw new Error('Unexpected live request blocked by test: '+url);
    };
    createRoot(document.getElementById('root')).render(<><CssBaseline /><AccountApp /></>);` },
  bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'mock-payments', setup(b) {
    // Keep the real account header/navigation; replace only the unrelated feature pages.
    b.onLoad({ filter: /src[\\/]App\.jsx$/ }, () => ({ loader: 'jsx', contents: `
      import React from 'react';
      export default function FeatureFixture({onProtectedFeature}) {
        return <button data-testid="open-protected-feature" onClick={()=>onProtectedFeature('stock')}>Open feature</button>;
      }` }));
    b.onLoad({ filter: /razorpayCheckout\.js$/ }, () => ({ loader: 'js', contents: `
      export async function reconcilePayment(){ return {subscription:{paid_active:false}}; }
      export async function openSubscriptionCheckout(){
        window.__checkoutCalls++;
        await new Promise(r=>setTimeout(r,250));
        if(window.__outcome==='error') throw new Error('mock failure');
        return {state:window.__outcome};
      }` }));
  } }],
});
const server = createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].contents); }
  else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/app.js"></script>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'ration-mobile-layout-'));
const browser = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chromium startup timed out')), 20000);
    browser.on('error', reject);
    browser.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); message.error ? waiter.reject(message.error) : waiter.resolve(message.result); }
  };
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const command = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  async function until(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out: ${expression}`);
  }
  async function viewport(width, height) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate('window.scrollTo(0,0)');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const cta = `document.querySelector('[data-testid="subscription-checkout-button"]')`;
  const visible = `(()=>{const b=${cta};if(!b)return false;const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&!b.disabled})()`;
  await command('Page.enable');
  await viewport(360, 640);
  await command('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` });
  await until(`!!document.querySelector('[data-testid="open-protected-feature"]') && !!document.querySelector('[data-testid="account-heading"]')`);
  await evaluate(`document.querySelector('[data-testid="open-protected-feature"]').click()`);
  await until(`${cta} && !${cta}.disabled`);
  assert.equal(await evaluate(`document.body.textContent.includes('സ്വയമേവ പുതുക്കില്ല')`), false, 'Requested text removed');
  assert.equal(await evaluate(`!!document.querySelector('[data-testid="subscription-daily-work-artwork"] svg')`), true, 'Daily-work illustration present');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Change password"]') === null`), true, 'Password hidden only on subscription screen');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Sign out'))`), false, 'Sign out stays on Home');
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [568, 320]]) {
    await viewport(w, h);
    assert.equal(await evaluate(`document.querySelector('[data-testid="subscription-payment-dock"]') === null`), true, 'No fixed payment dock');
    assert.equal(await evaluate(`getComputedStyle(${cta}).position`), 'relative', 'CTA stays in card flow');
    assert.equal(await evaluate(`document.body.textContent.includes('കമ്മീഷൻ')`), false, 'Feature tiles removed');
    assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Back to home"]').length`), 1, 'Only one Home button');
    assert.equal(await evaluate(`(()=>{const h=document.querySelector('[data-testid="account-heading"]');return !!h.querySelector('[aria-label="Back to home"]')&&h.textContent.includes('FPS 1234567')})()`), true, 'Home beside FPS');
    assert.equal(await evaluate(`(()=>{const h=document.querySelector('[data-testid="account-heading"]');const a=h.querySelector('p').getBoundingClientRect(), b=h.querySelector('button').getBoundingClientRect();return Math.abs((a.top+a.height/2)-(b.top+b.height/2))<2})()`), true, 'Home and FPS share a row');
    console.log(w+'x'+h+' visible without scrolling:', await evaluate(visible));
    console.log(w+'x'+h+' vertical overflow:', await evaluate(`Math.max(0,document.documentElement.scrollHeight-innerHeight)`));
    if (h >= 568) {
      assert.equal(await evaluate(visible), true, `${w}x${h}: payment CTA visible on first screen`);
      assert.equal(await evaluate(`document.documentElement.scrollHeight <= innerHeight + 1`), true, `${w}x${h}: full normal subscription screen fits without scrolling`);
    }
    await evaluate(`${cta}.scrollIntoView({block:'center'})`);
    assert.equal(await evaluate(visible), true, 'Inline CTA reachable without obstruction');
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'No horizontal overflow');
  }
  await viewport(390, 844);
  const tallScreenshot = await command('Page.captureScreenshot', { format: 'png' });
  const tallScreenshotPath = join(profile, 'subscription-tall-mobile.png');
  await writeFile(tallScreenshotPath, Buffer.from(tallScreenshot.data, 'base64'));
  console.log('Tall mobile screenshot:', tallScreenshotPath);
  await viewport(360, 640);
  await evaluate(`${cta}.scrollIntoView({block:'center'})`);
  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = join(profile, 'subscription-mobile.png');
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log('Screenshot:', screenshotPath);
  await evaluate(`${cta}.click()`);
  await until(`${cta}.disabled`);
  await until(`document.body.textContent.includes('പേയ്‌മെന്റ് സ്ഥിരീകരണം ലഭിച്ചിട്ടില്ല')`);
  assert.equal(await evaluate('window.__checkoutCalls'), 1, 'Only one checkout instance/call');
  assert.equal(await evaluate(`document.querySelectorAll('[data-testid="subscription-checkout-button"]').length`), 1);
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('പണം നൽകിയിട്ടില്ല')).click()`);
  await until(`!${cta}.disabled`);
  await evaluate(`window.__outcome='error';${cta}.click()`);
  await until(`document.body.textContent.includes('പേയ്‌മെന്റ് പൂർത്തിയാക്കാനായില്ല')`);
  await evaluate(`${cta}.scrollIntoView({block:'center'})`);
  assert.equal(await evaluate(visible), true, 'Inline CTA reachable after payment error');
  await viewport(1024, 768);
  assert.equal(await evaluate(`document.querySelector('[data-testid="subscription-payment-dock"]') === null`), true, 'Desktop has no fixed payment dock');
  await evaluate(`document.querySelector('[aria-label="Back to home"]').click()`);
  await until(`!!document.querySelector('[data-testid="open-protected-feature"]')`);
  assert.equal(await evaluate(`document.querySelector('[data-testid="subscription-checkout-button"]') === null`), true, 'Home exits subscription screen');
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Change password"]')`), true, 'Password remains available on Home');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Sign out'))`), true, 'Sign out remains available on Home');
  console.log('PASS: compact single-row header, portrait CTA visible without scrolling, Home/password/sign-out navigation, inline layout, one checkout and busy/pending/error states. Mock payments only.');
} finally {
  ws?.close();
  browser.kill();
  server.close();
}
