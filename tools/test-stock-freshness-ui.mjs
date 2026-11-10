// Hidden Chromium with an in-memory API; never calls ePoS or live accounts.
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
    import {CssBaseline} from '@mui/material';
    import App from './src/App';
    window.__requests=[];
    window.fetch=(url,options)=>{
      if(url!=='/count')throw new Error('Live API blocked');
      if(options.cache!=='no-store'||options.credentials!=='include'||!options.headers['Cache-Control'].includes('no-store'))throw new Error('Missing private no-cache options');
      const body=JSON.parse(options.body);
      return new Promise((resolve,reject)=>window.__requests.push({body,signal:options.signal,resolve,reject}));
    };
    window.__reply=(index,qty,status=200,extra={})=>{
      const r=window.__requests[index];
      r.resolve(new Response(JSON.stringify({RAW_RICE_cb_sum:qty+' kg',RAW_RICE_bag_count:1,RAW_RICE_remaining_kg:'0 kg',
        consistency_checked:true,fetched_at:new Date().toISOString(),requested_period:{fps_id:String(r.body.fps_id),month:r.body.month,year:r.body.year},...extra}),{status}));
    };
    createRoot(document.getElementById('root')).render(<><CssBaseline/><App initialView="stock" registeredFpsId="1234567"/></>);
  ` }, bundle: true, write: false, format: 'iife', loader: { '.svg': 'dataurl', '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': JSON.stringify({ DEV: false }) },
});
await browserFixture(bundle.outputFiles[0].contents, async ({evaluate, until}) => {
  const result = 'document.querySelector("[data-testid=stock-summary-result]")';
  const submit = () => evaluate('document.querySelector("input[name=fps_id]").closest("form").requestSubmit()');
  const changeWeight = value => evaluate(`(()=>{const e=document.querySelector('[name=raw_rice_bag_weight]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until('!!document.querySelector("[name=raw_rice_bag_weight]")');
  await submit();
  await until('window.__requests.length===1');
  await evaluate('window.__reply(0,70)');
  await until('!!'+result);
  assert.equal(await evaluate(result+'.textContent.includes("Fetched from ePoS:")'), true);
  await submit();
  await until('window.__requests.length===2&&!'+result);
  await evaluate('window.__reply(1,50)');
  await until('!!'+result);
  assert.equal(await evaluate(result+'.textContent.includes("50 kg")'), true, 'New click replaces previous quantity');
  await submit();
  await until('window.__requests.length===3&&!'+result);
  await evaluate('window.__reply(2,0,503)');
  await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!'+result), false, 'Upstream failure never restores previous stock');
  await submit();
  await until('window.__requests.length===4');
  await changeWeight('25');
  await until('window.__requests[3].signal.aborted');
  await submit();
  await until('window.__requests.length===5');
  await evaluate('window.__reply(4,45)');
  await until('!!'+result);
  await evaluate('window.__reply(3,999)');
  // A late obsolete response must never overwrite the completed newer fetch.
  await until('window.__requests[3].signal.aborted&&!!'+result);
  assert.equal(await evaluate(result+'.textContent.includes("999")'), false);
  await changeWeight('30');
  await until('!'+result);
  await submit();
  await until('window.__requests.length===6');
  await evaluate('window.__reply(5,88,200,{requested_period:{fps_id:"7654321",month:1,year:2000}})');
  await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!'+result), false, 'Wrong FPS or period is rejected');
  await submit();
  await until('window.__requests.length===7');
  await evaluate('window.__reply(6,88,200,{fetched_at:null})');
  await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!'+result), false, 'Unverified legacy response is not shown');
  await submit();
  await until('window.__requests.length===8');
  await evaluate('window.__reply(7,0,503,{detail:{code:"STOCK_INCONSISTENT"}})');
  await until('document.querySelector("[role=alert]")?.textContent.includes("നിലവിലെ സ്റ്റോക്ക് സ്ഥിരീകരിക്കാനായില്ല")');
  assert.equal(await evaluate('!!'+result), false, 'Conflicting source data shows a verification error, not any old stock');
});
console.log('Stock freshness UI passed: new fetch on every click, cleared results, no-store, failure handling, cancelled stale responses and period validation.');
