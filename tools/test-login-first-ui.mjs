// Local browser test; all API requests are mocked, no real accounts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { browserFixture } from './browser-fixture.mjs';
const frontend = fileURLToPath(new URL('../react _frontend/', import.meta.url));
const require = createRequire(new URL('../react _frontend/package.json', import.meta.url));
const { build } = require('esbuild');
const bundle = await build({
  stdin: { resolveDir: frontend, loader: 'jsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import AccountApp from './src/AccountApp';
    localStorage.clear();
    window.__calls=[];
    window.fetch=async(url,options)=>{
      window.__calls.push({url,body:options?.body});
      if(url==='/auth/me') return new Response(JSON.stringify({detail:'Please sign in.'}),{status:401});
      if(url==='/auth/login'||url==='/auth/register') return new Response(JSON.stringify({detail:'Fixture rejection'}),{status:400});
      throw new Error('Live request blocked: '+url);
    };
    createRoot(document.getElementById('root')).render(<AccountApp/>);
  ` },
  bundle: true, write: false, format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': JSON.stringify({ DEV: false }) },
  plugins: [{ name: 'feature-fixture', setup(b) {
    b.onLoad({ filter: /src[\\/]App\.jsx$/ }, () => ({ loader: 'jsx', contents: `
      import React from 'react';
      export default function App({onProtectedFeature}) {
        return <button id="open-feature" onClick={()=>onProtectedFeature('stock')}>Open feature</button>;
      }` }));
  } }],
});
await browserFixture(bundle.outputFiles[0].contents, async ({evaluate, until, command}) => {
  await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  const button = text => `[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)})`;
  const set = (name, value) => evaluate(`(()=>{const i=document.querySelector('input[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until(`!!document.querySelector('#open-feature')`);
  await evaluate(`document.querySelector('#open-feature').click()`);
  await until(`!!document.querySelector('input[name="mobile"]')`);
  assert.equal(await evaluate(`document.querySelector('input[name="fps_id"]')===null`), true, 'Fresh browser shows login, not registration');
  assert.equal(await evaluate(`document.querySelector('button[type="submit"]').textContent`), 'Sign in');
  assert.equal(await evaluate(`!!document.querySelector('a[href*="wa.me"]')`), true);
  await set('mobile', '9999999999');
  await set('password', 'fixture password');
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await until(`window.__calls.some(c=>c.url==='/auth/login')`);
  assert.equal(await evaluate(`window.__calls.some(c=>c.url==='/auth/register')`), false);
  await until(`!document.querySelector('button[type="submit"]').disabled`);
  await evaluate(`${button('New user only? Create an account')}.click()`);
  await until(`!!document.querySelector('input[name="fps_id"]')`);
  assert.equal(await evaluate(`document.querySelector('input[name="password"]').value`), '', 'Mode switch clears password');
  assert.equal(await evaluate(`document.querySelector('button[type="submit"]').textContent`), 'Create account');
  await set('fps_id', '1234567');
  await set('password', 'fixture long password');
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await until(`window.__calls.some(c=>c.url==='/auth/register')`);
  await until(`!document.querySelector('button[type="submit"]').disabled`);
  await evaluate(`${button('Already registered? Sign in')}.click()`);
  await until(`document.querySelector('input[name="fps_id"]')===null`);
  assert.equal(await evaluate(`document.querySelector('button[type="submit"]').textContent`), 'Sign in');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), true, 'No horizontal overflow on mobile');
});
console.log('Login-first UI passed: fresh browser login, correct endpoints, explicit registration and mobile layout.');
