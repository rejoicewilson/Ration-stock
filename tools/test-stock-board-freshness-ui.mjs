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
      if(url!=='/stock-register')throw new Error('Live API blocked');
      if(options.cache!=='no-store'||options.credentials!=='include'||!options.headers['Cache-Control'].includes('no-store'))throw new Error('Missing private no-cache options');
      const body=JSON.parse(options.body);
      return new Promise((resolve,reject)=>window.__requests.push({body,signal:options.signal,resolve,reject}));
    };
    window.__reply=(index,qty,status=200,extra={})=>{
      const r=window.__requests[index];
      r.resolve(new Response(JSON.stringify({
        tables:[{headers:['Sl.No','Scheme','Commodity','Units','Alloted Regular','Alloted Extra','OB Qty','Received Regular','Received Extra','Received Moved','Issued Qty','CB Qty'],
          rows:[['1','NPS','RAW RICE','KG','0','0','0','0','0','0','0',String(qty)]],
          records:[{'Sl.No':'1',Scheme:'NPS',Commodity:'RAW RICE',Units:'KG','CB Qty':String(qty)}]}],
        fetched_at:new Date().toISOString(),requested_period:{fps_id:String(r.body.fps_id),month:r.body.month,year:r.body.year,dist_code:r.body.dist_code,office_code:r.body.office_code},...extra}),{status}));
    };
    createRoot(document.getElementById('root')).render(<><CssBaseline/><App initialView="stockBoard" registeredFpsId="1842187"/></>);
  ` }, bundle: true, write: false, format: 'iife', loader: { '.svg': 'dataurl', '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': JSON.stringify({ DEV: false }) },
});
await browserFixture(bundle.outputFiles[0].contents, async ({evaluate, until}) => {
  const result = 'document.querySelector("[data-testid=stock-board-result]")';
  const submit = () => evaluate('document.querySelector("input[name=fps_id]").closest("form").requestSubmit()');
  const changeFps = value => evaluate(`(()=>{const e=document.querySelector('[name=fps_id]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until('!!document.querySelector("[name=fps_id]")');
  await submit();
  await until('window.__requests.length===1');
  await evaluate('window.__reply(0,70)');
  await until('!!'+result);
  assert.equal(await evaluate('document.body.textContent.includes("Fetched from ePoS:")'), true);
  await submit();
  await until('window.__requests.length===2&&!'+result);
  await evaluate('window.__reply(1,50)');
  await until('!!'+result);
  assert.equal(await evaluate('document.body.textContent.includes("50 kg")'), true, 'New click replaces previous quantity');
  await submit();
  await until('window.__requests.length===3&&!'+result);
  await evaluate('window.__reply(2,0,503)');
  await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!'+result), false, 'Upstream failure never restores previous stock');
  await submit();
  await until('window.__requests.length===4');
  await changeFps('1842188');
  await until('window.__requests[3].signal.aborted');
  await submit();
  await until('window.__requests.length===5');
  await evaluate('window.__reply(4,45)');
  await until('!!'+result);
  await evaluate('window.__reply(3,999)');
  // A late obsolete response must never overwrite the completed newer fetch.
  await until('window.__requests[3].signal.aborted&&!!'+result);
  assert.equal(await evaluate('document.body.textContent.includes("999")'), false);
  await changeFps('1842189');
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
});
console.log('Stock Board freshness UI passed: new fetch on every click, cleared results, no-store, failure handling, cancelled stale responses and period validation.');
