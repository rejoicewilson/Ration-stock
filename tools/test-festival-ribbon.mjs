// Manual Navratri ribbon: real home layout, mocked account, no live APIs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserFixture } from './browser-fixture.mjs';

const helperSource = await readFile(new URL('../react _frontend/src/festivalPreview.js', import.meta.url), 'utf8');
const { festivalForHome } = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);
assert.equal(festivalForHome('?festival-preview=christmas', true, 'navratri'), 'christmas');
assert.equal(festivalForHome('?festival-preview=navratri', true), 'navratri');
assert.equal(festivalForHome('?festival-preview=none', true, 'navratri'), null);
assert.equal(festivalForHome('', false, 'navratri'), 'navratri', 'Manual selection works in production');
assert.equal(festivalForHome('?festival-preview=christmas', false, 'navratri'), 'navratri', 'Production ignores URL overrides');
assert.equal(festivalForHome('?festival-preview=christmas', false), null, 'Manual off stays off in production');
assert.equal(festivalForHome('', false, 'unknown'), null);

const frontend = fileURLToPath(new URL('../react _frontend/', import.meta.url));
const require = createRequire(new URL('../react _frontend/package.json', import.meta.url));
const { build } = require('esbuild');
const bundle = await build({
  stdin: { resolveDir: frontend, loader: 'jsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {CssBaseline} from '@mui/material';
    import AccountApp from './src/AccountApp';
    window.fetch=async url=>{
      if(url==='/auth/me')return new Response(JSON.stringify({account:{id:'fixture',fps_id:'1234567'}}));
      if(url==='/auth/subscription/status')return new Response(JSON.stringify({plan:'paid',mode:'live',access_allowed:true,paid_active:true}));
      throw new Error('Live request blocked: '+url);
    };
    const root=createRoot(document.getElementById('root'));
    window.__render=search=>{history.replaceState(null,'','/'+search);root.render(<React.Fragment key={search}><CssBaseline/><AccountApp/></React.Fragment>)};
    window.__render('?festival-preview=navratri');
  ` },
  bundle: true, write: false, format: 'iife', loader: { '.svg': 'dataurl', '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': JSON.stringify({ DEV: true }) },
  plugins: [{ name: 'no-live-metrics', setup(b) {
    b.onResolve({ filter: /^@vercel\/(analytics|speed-insights)\/react$/ }, () => ({ path: 'metrics', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const Analytics=()=>null;export const SpeedInsights=()=>null;' }));
  } }],
});

await browserFixture(bundle.outputFiles[0].contents, async ({ command, evaluate, until }) => {
  const ribbon = `document.querySelector('[data-testid="festival-ribbon"]')`;
  await until(`!!${ribbon} && !!document.querySelector('[data-testid="account-heading"]')`);
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [1024, 768]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate('window.scrollTo(0,0)');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(await evaluate(`${ribbon}.getBoundingClientRect().height`), 40);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'No horizontal overflow');
    assert.equal(await evaluate(`(()=>{const r=${ribbon}.getBoundingClientRect(),banner=document.querySelector('[aria-label="റേഷൻ കട"]').getBoundingClientRect();return r.bottom<=banner.top && banner.top-r.bottom<=5})()`), true, 'Ribbon occupies gap directly above banner');
  }
  assert.equal(await evaluate(`${ribbon}.textContent`), 'നവരാത്രി ആശംസകൾ');
  assert.equal(await evaluate(`${ribbon}.getAttribute('aria-label')`), 'Navratri greeting');
  assert.equal(await evaluate(`${ribbon}.querySelectorAll('button,a,input').length`), 0, 'No visible or interactive control in ribbon');
  assert.equal(await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).animationIterationCount`), 'infinite', 'Animation stays visible');
  const starTransform = await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).transform`);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.notEqual(await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).transform`), starTransform, 'Rendered lamp animation progresses');
  await evaluate(`Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))`);
  await until(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).animationPlayState==='paused'`);
  const pausedTransform = await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).transform`);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).transform`), pausedTransform, 'Hidden tab freezes motion');
  await evaluate(`delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))`);
  await until(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).animationPlayState==='running'`);
  await evaluate(`document.querySelector('[aria-label="Display settings"]').click()`);
  await until(`!!document.querySelector('[aria-label="Reduce animations"]')`);
  await evaluate(`document.querySelector('[aria-label="Reduce animations"]').click()`);
  await until(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).animationName==='none'`);
  assert.equal(await evaluate(`localStorage.getItem('ration-reduce-animations')`), 'true');
  await evaluate(`document.querySelector('[aria-label="Close display settings"]').click();window.__render('?festival-preview=navratri&reload=1')`);
  await until(`!!${ribbon} && getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).animationName==='none'`);
  await evaluate(`document.querySelector('[aria-label="Display settings"]').click()`);
  await until(`!!document.querySelector('[aria-label="Reduce animations"]')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Reduce animations"]').checked`),true,'Preference survives remount');
  await evaluate(`document.querySelector('[aria-label="Reduce animations"]').click();document.querySelector('[aria-label="Close display settings"]').click()`);
  await until(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).animationName!=='none'`);
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-flame]')).animationName`), 'none');
  assert.equal(await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-petal]')).animationName`), 'none');
  assert.equal(await evaluate(`getComputedStyle(${ribbon}.querySelector('[data-festival-flower]')).animationName`), 'none');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate('window.scrollTo(0,0)');
  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  const folder = await mkdtemp(join(tmpdir(), 'ration-festival-preview-'));
  const path = join(folder, 'navratri-ribbon.png');
  await writeFile(path, Buffer.from(screenshot.data, 'base64'));
  console.log('Screenshot:', path);
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Stock Summary')).click()`);
  await until(`document.body.textContent.includes('Get Stock Summary')`);
  assert.equal(await evaluate(`!!${ribbon}`), false, 'Ribbon only on Home, never feature forms');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Home').click()`);
  await until(`!!${ribbon}`);
  await evaluate(`window.__render('?festival-preview=none')`);
  await until(`!!document.querySelector('[aria-label="റേഷൻ കട"]')`);
  assert.equal(await evaluate(`!!${ribbon}`), false, 'Manual-off preview hides ribbon');
  await evaluate(`window.__render('')`);
  await until(`!!${ribbon}`);
  assert.equal(await evaluate(`${ribbon}.textContent`), 'നവരാത്രി ആശംസകൾ', 'Normal Home follows manual festival');
  await evaluate(`window.__render('?festival-preview=christmas')`);
  await until(`!!${ribbon} && ${ribbon}.textContent.includes('ക്രിസ്മസ്')`);
  assert.equal(await evaluate(`!!${ribbon}.querySelector('[data-festival-star]')`), true, 'Christmas sample preserved');
  console.log('PASS: manual selection, production URL isolation, 40px Navratri lamp/flowers, four sizes, continuous motion without ribbon controls, hidden-tab pause, persistent/device reduced motion, navigation and Christmas preview. Mock account only.');
});
