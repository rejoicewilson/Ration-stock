// Local Chromium fixtures only: no real installation or API access.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { browserFixture } from './browser-fixture.mjs';
const frontend = fileURLToPath(new URL('../react _frontend/', import.meta.url));
const require = createRequire(new URL('../react _frontend/package.json', import.meta.url));
const { build } = require('esbuild');
async function bundle(standalone = false) {
  return (await build({
    stdin: { resolveDir: frontend, loader: 'jsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import App from './src/App';
      import {getInstallState} from './src/installState';
      window.fetch=async()=>{throw new Error('Live API blocked by fixture');};
      window.__promptCalls=0;
      window.__installEvent=(outcome='dismissed',fail=false)=>{
        const event=new Event('beforeinstallprompt',{cancelable:true});
        event.prompt=async()=>{window.__promptCalls++;if(fail)throw new Error('Fixture prompt unavailable');};
        event.userChoice=Promise.resolve({outcome});
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };
      // This event deliberately arrives BEFORE the component mounts.
      window.__earlyCaptured=window.__installEvent();
      window.__state=getInstallState;
      createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, format: 'iife',
    loader: { '.svg': 'dataurl', '.png': 'dataurl' },
    banner: standalone ? { js: "Object.defineProperty(navigator,'standalone',{value:true,configurable:true});" } : {},
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': JSON.stringify({ DEV: false }) },
  })).outputFiles[0].contents;
}
await browserFixture(await bundle(), async ({evaluate, until, command}) => {
  await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  const card = `document.querySelector('aside[aria-label="Install Ration Stock App"]')`;
  const click = () => evaluate(`${card}.querySelector('button').click()`);
  const close = async () => {
    await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Close').click()`);
    await until(`!document.querySelector('[role="dialog"]')`);
  };
  await until(`!!${card}`);
  assert.equal(await evaluate(`${card}.querySelector('button').textContent`), 'Download App');
  assert.equal(await evaluate(`${card}.querySelector('img')===null`), true, 'No promotional icon card');
  assert.equal(await evaluate('window.__earlyCaptured'), true);
  assert.equal(await evaluate(`!!(${card}.compareDocumentPosition(document.querySelector('#services-title'))&Node.DOCUMENT_POSITION_FOLLOWING)`), true);
  assert.equal(await evaluate(`!!(document.querySelector('[aria-label="റേഷൻ കട"]').compareDocumentPosition(${card})&Node.DOCUMENT_POSITION_FOLLOWING)`), true);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
  await click();
  await until('window.__promptCalls===1');
  await until(`!${card}.querySelector('button').disabled`);
  assert.equal(await evaluate('window.__state().prompt===null'), true, 'Prompt consumed after dismissal');
  assert.equal(await evaluate(`!!${card}`), true, 'Cancellation does not claim installed');
  await evaluate(`Object.defineProperty(navigator,'userAgent',{configurable:true,value:'Android Chrome WhatsApp'});`);
  await click();
  await until(`!!document.querySelector('[role="dialog"]')`);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('three-dot menu')`), true);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('inside WhatsApp')`), true);
  await close();
  await evaluate(`Object.defineProperty(navigator,'userAgent',{configurable:true,value:'iPhone Safari'});`);
  await click();
  await until(`!!document.querySelector('[role="dialog"]')`);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('Add to Home Screen')`), true);
  await close();
  await evaluate(`window.__installEvent('accepted',true)`);
  await click();
  await until(`!!document.querySelector('[role="dialog"]')`);
  await close();
  await evaluate(`window.__installEvent('accepted')`);
  await click();
  await until(`!!document.querySelector('[role="status"]')`);
  assert.equal(await evaluate(`!!${card}`), true, 'Wait for installation event before hiding');
  await evaluate(`window.dispatchEvent(new Event('appinstalled'))`);
  await until(`!${card}`);
});
await browserFixture(await bundle(true), async ({evaluate, until}) => {
  await until(`!!document.querySelector('#services-title')`);
  assert.equal(await evaluate(`!!document.querySelector('aside[aria-label="Install Ration Stock App"]')`), false, 'Installed session hides promotion on mount');
});
console.log('Install UI passed: placement, mobile layout, early capture, cancellation, fallbacks, errors and installed hiding.');
