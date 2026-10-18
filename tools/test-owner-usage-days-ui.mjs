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
    import AdminDashboard from './src/AdminDashboard';
    window.__calls=[];window.__fail=false;
    const rows=Array.from({length:52},(_,i)=>({id:'fixture-'+i,fps_id:String(1000000+i),mobile:'9199999'+String(i).padStart(5,'0'),created_at:'2026-10-17T20:00:00Z',joined_on:'2026-10-18',days_used:51-i,last_used:i===51?null:'2026-10-18',last_used_at:i===51?null:new Date(Date.UTC(2026,9,18,10,0)-i*60000).toISOString(),last_feature:'monthComparison',features:[],disabled:false}));
    window.fetch=async(url,options)=>{
      if(!String(url).startsWith('/auth/admin/'))throw new Error('Live request blocked');
      if(options.credentials!=='include')throw new Error('Missing credentials');
      window.__calls.push(url);
      if(window.__fail)return new Response(JSON.stringify({detail:'Report temporarily unavailable.'}),{status:503});
      const params=new URL(url,location.origin).searchParams;
      const search=params.get('search')||'';
      const page=Number(params.get('page')||1);
      const matching=rows.filter(r=>(r.fps_id.includes(search)||r.mobile.includes(search))&&(!url.includes('recent-usage')||r.last_used_at));
      return new Response(JSON.stringify({accounts:matching.slice((page-1)*50,page*50),matching_accounts:matching.length,total_accounts:52,new_today:2,new_month:52,active_today:40,active_month:51,features:[]}));
    };
    createRoot(document.getElementById('root')).render(<><CssBaseline/><AdminDashboard onHome={()=>{window.__home=true}}/></>);
  ` },
  bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' },
});

await browserFixture(bundle.outputFiles[0].contents, async ({ evaluate, until, command }) => {
  const table = `document.querySelector('table[aria-label="Days used since registration"]')`;
  const next = `[...document.querySelectorAll('button')].find(b=>b.textContent==='Next')`;
  const search = `document.querySelector('input')`;
  const setSearch = value => evaluate(`(()=>{const input=${search};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await until(`!!document.querySelector('#owner-usage-tab')`);
  await evaluate(`document.querySelector('#owner-usage-tab').click()`);
  await until(`!!${table}`);
  assert.equal(await evaluate(`document.querySelector('#owner-usage-tab').getAttribute('aria-selected')`), 'true');
  assert.equal(await evaluate(`${table}.querySelectorAll('tbody tr').length`), 50);
  assert.equal(await evaluate(`${table}.querySelector('tbody tr th').textContent`), '1000000');
  assert.equal(await evaluate(`${table}.textContent.includes('18 Oct 2026')`), true);
  await evaluate(`${next}.click()`);
  await until(`!!${table} && ${table}.querySelectorAll('tbody tr').length===2`);
  assert.equal(await evaluate(`${table}.textContent.includes('Not used yet')`), true, 'Zero-use account included');
  assert.equal(await evaluate(`${next}.disabled`), true, 'No page past full account list');
  await setSearch('1000051');
  await until(`!!${table} && ${table}.querySelectorAll('tbody tr').length===1 && ${table}.textContent.includes('1000051')`);
  assert.equal(await evaluate(`window.__calls.at(-1).includes('usage-days?page=1&search=1000051')`), true, 'Search resets pagination');
  await setSearch('123123123');
  await until(`!!${table} && ${table}.textContent.includes('No matching accounts.')`);
  await setSearch('');
  await until(`!!${table} && ${table}.querySelectorAll('tbody tr').length===50`);
  await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Table scroll stays inside its container');
  await evaluate(`window.__fail=true;[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh data').click()`);
  await until(`document.body.textContent.includes('Report temporarily unavailable.')`);
  assert.equal(await evaluate(`!!${table}`), false, 'Failed refresh does not show stale report');
  await evaluate(`window.__fail=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh data').click()`);
  await until(`!!${table}`);
  await evaluate(`document.querySelector('#owner-recent-tab').click()`);
  const recentTable = `document.querySelector('table[aria-label="Recently used accounts"]')`;
  await until(`!!${recentTable}`);
  assert.equal(await evaluate(`${recentTable}.querySelectorAll('tbody tr').length`),50);
  assert.equal(await evaluate(`${recentTable}.querySelector('tbody tr th').textContent`),'1000000');
  assert.equal(await evaluate(`${recentTable}.querySelector('time').textContent.includes('3:30:00')`),true,'Timestamp rendered in IST');
  assert.equal(await evaluate(`${recentTable}.querySelector('time').getAttribute('datetime')`),'2026-10-18T10:00:00.000Z');
  assert.equal(await evaluate(`${recentTable}.textContent.includes('Monthly comparison')`),true,'Readable latest feature');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'Recent report has no page overflow on mobile');
  await evaluate(`${next}.click()`);
  await until(`!!${recentTable} && ${recentTable}.querySelectorAll('tbody tr').length===1`);
  assert.equal(await evaluate(`${next}.disabled`),true);
  await setSearch('1000002');
  await until(`!!${recentTable} && ${recentTable}.textContent.includes('1000002')`);
  assert.equal(await evaluate(`window.__calls.at(-1).includes('recent-usage?page=1&search=1000002')`),true);
  await setSearch('1000051');
  await until(`!!${recentTable} && ${recentTable}.textContent.includes('No recorded feature use')`);
  await setSearch('');
  await until(`!!${recentTable} && ${recentTable}.querySelectorAll('tbody tr').length===50`);
  await evaluate(`document.querySelector('#owner-members-tab').click()`);
  await until(`document.body.textContent.includes('Reset member password')`);
  assert.equal(await evaluate(`!!${table}`), false, 'Member view unchanged');
  console.log('PASS: report tab, dates and zero-use rows, full pagination, filtered search, empty/error/retry states, mobile overflow and original member view. Mock accounts only.');
  console.log('PASS: recent-use tab, latest-first timestamp/feature, IST time, mobile layout, search reset and pagination. Mock accounts only.');
});
