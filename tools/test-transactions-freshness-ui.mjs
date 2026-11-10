// Isolated browser checks: no live ePoS or accounts.
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
    import App from './src/App';
    window.__requests=[];
    window.fetch=(url,options)=>{
      if(url!=='/transactions')throw new Error('Live API blocked');
      if(options.cache!=='no-store'||!options.headers['Cache-Control'].includes('no-store'))throw new Error('Missing no-cache');
      return new Promise(resolve=>window.__requests.push({body:JSON.parse(options.body),signal:options.signal,resolve}));
    };
    window.__reply=(index,title,status=200,extra={})=>{
      const r=window.__requests[index];
      r.resolve(new Response(JSON.stringify({title,summary:{},transactions:[],fetched_at:new Date().toISOString(),requested_period:r.body,...extra}),{status}));
    };
    createRoot(document.getElementById('root')).render(<App initialView="transactions" registeredFpsId="1842187"/>);
  ` }, bundle:true, write:false, format:'iife', loader:{'.svg':'dataurl','.png':'dataurl'},
  define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({DEV:false})},
});
await browserFixture(bundle.outputFiles[0].contents, async ({evaluate,until})=>{
  const result='document.querySelector("[data-testid=transactions-result]")';
  const submit=()=>evaluate('document.querySelector("input[name=fps_id]").closest("form").requestSubmit()');
  const change=value=>evaluate(`(()=>{const e=document.querySelector('[name=from_date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await until('!!document.querySelector("input[name=fps_id]")');
  await submit(); await until('window.__requests.length===1');
  await evaluate('window.__reply(0,"FIRST REPORT")'); await until('!!'+result);
  await submit(); await until('window.__requests.length===2&&!'+result);
  await evaluate('window.__reply(1,"",503)'); await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!'+result),false);
  await submit(); await until('window.__requests.length===3');
  await change('2026-11-01'); await until('window.__requests[2].signal.aborted');
  await submit(); await until('window.__requests.length===4');
  await evaluate('window.__reply(3,"CURRENT REPORT")'); await until('!!'+result);
  await evaluate('window.__reply(2,"OBSOLETE REPORT")');
  assert.equal(await evaluate(result+'.textContent.includes("CURRENT REPORT")'),true);
  await change('2026-11-02'); await until('!'+result);
  await submit(); await until('window.__requests.length===5');
  await evaluate('window.__reply(4,"WRONG REPORT",200,{requested_period:{fps_id:7654321}})');
  await until('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('!!'+result),false);
});
console.log('PASS: Transactions clears old results, cancels stale requests, rejects mismatched periods and fails without fallback.');
