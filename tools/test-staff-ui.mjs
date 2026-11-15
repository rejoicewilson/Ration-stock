// Browser fixture with in-memory records; never calls real accounts or payments.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browserFixture } from './browser-fixture.mjs';
const frontend = fileURLToPath(new URL('../react _frontend/', import.meta.url));
const require = createRequire(new URL('../react _frontend/package.json', import.meta.url));
const { build } = require('esbuild');
const bundle = await build({
  stdin: { resolveDir: frontend, loader:'jsx', contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {CssBaseline} from '@mui/material';
    import StaffTracker from './src/StaffTracker';
    window.__calls=[]; window.__staff=[]; window.__attendance=[]; window.__payments=[];
    const receipts=new Map(); window.__failPayment=true; window.__emptyReport=true;
    window.fetch=async(url,options)=>{
      if(!url.startsWith('/staff/'))throw new Error('Live API blocked');
      if(options.cache!=='no-store'||options.credentials!=='include')throw new Error('Private request required');
      const path=url.slice(7), body=JSON.parse(options.body); window.__calls.push({path,body});
      const reply=data=>new Response(JSON.stringify(data),{status:200});
      if(path==='report'&&window.__emptyReport){window.__emptyReport=false;return new Response('',{status:200});}
      if(path==='report')return reply({today:'2026-11-14',staff:window.__staff.map(p=>{
        const rows=window.__attendance.filter(a=>a.work_date.slice(0,7)===body.day.slice(0,7));
        const payments=window.__payments.filter(p=>p.paid_on.slice(0,7)===body.day.slice(0,7));
        const holiday=new Date(body.day+'T12:00:00Z').getUTCDay()===0;
        const status=rows[0]?.status;
        const extra=rows[0]?.extra_paise||0;
        const earned=window.__attendance.reduce((n,a)=>n+(a.status==='holiday_work'?a.extra_paise:a.status==='half_day'?p.rate_paise/2:['present','paid_leave'].includes(a.status)?p.rate_paise:0),0);
        const paid=window.__payments.filter(p=>!p.voided).reduce((n,p)=>n+p.amount_paise,0);
        return {...p,summary:{balance_scope:'all_time',as_of:'2026-11-14',period_start:p.start_date,period_end:'2026-11-14',scheduled_days:holiday?0:1,eligible_days:holiday?0:1,
          pending_days:1,future_days:0,present_days:Number(status==='present'),
          half_days:Number(status==='half_day'),absent_days:Number(status==='absent'),paid_leave_days:Number(status==='paid_leave'),
          planned_paise:holiday?0:p.rate_paise,earned_paise:earned,deduction_paise:0,extra_paise:extra,
          paid_paise:paid,balance_paise:earned-paid,attendance:rows,payments}};
      })});
      if(receipts.has(body.request_id))return reply(receipts.get(body.request_id));
      if(path==='create')window.__staff.push({...body,id:'staff-1',revision:0});
      if(path==='attendance'){
        window.__attendance=window.__attendance.filter(a=>a.work_date!==body.work_date);
        if(body.status!=='unmarked')window.__attendance.push(body);
        if(body.status!=='unmarked'&&body.work_date<window.__staff[0].start_date)window.__staff[0].start_date=body.work_date;
        window.__staff[0].revision++;
      }
      if(path==='payment'){
        window.__payments.push({...body,id:'pay-1',voided:false}); window.__staff[0].revision++;
      }
      if(path==='void-payment'){window.__payments[0].voided=true;window.__staff[0].revision++;}
      const result={ok:true}; receipts.set(body.request_id,result);
      if(path==='payment'&&window.__failPayment){window.__failPayment=false;throw new Error('Lost response after commit');}
      return reply(result);
    };
    createRoot(document.getElementById('root')).render(<><CssBaseline/><StaffTracker/></>);
  `}, bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'},
});
await browserFixture(bundle.outputFiles[0].contents, async ({evaluate,until,command})=>{
  await evaluate(`window.__button=text=>[...document.querySelectorAll('button')].find(e=>{
      const label=e.getAttribute('aria-label')||e.textContent.trim();
      return label===text||label===text+' ⌄'||label===text+' ⌃';
    });
    window.__field=label=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent.replaceAll('*','').trim()===label);return document.getElementById(l.htmlFor);};`);
  const click = label => evaluate(`window.__button(${JSON.stringify(label)}).click()`);
  const fillInput = (label,value) => evaluate(`(()=>{const e=window.__field(${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const fill = async (label,value) => {
    if(label!=='Attendance date')return fillInput(label,value);
    await fillInput('Month',value.slice(0,7));
    await until(`!!document.querySelector('[data-date="${value}"]')&&!window.__button('Refresh').disabled`);
    await evaluate(`document.querySelector('[data-date="${value}"]').click()`);
    await until(`document.querySelector('[data-date="${value}"]')?.getAttribute('aria-pressed')==='true'&&!window.__button('Refresh').disabled`);
  };
  await until('document.body.textContent.includes("Salesman service returned an invalid response")');
  assert.equal(await evaluate('document.body.textContent.includes("Unexpected end of JSON")'),false);
  await click('Refresh');
  await until('document.body.textContent.includes("No salesman added yet")');
  await fill('Month','2024-02');
  await until('window.__calls.filter(c=>c.path==="report").length===3');
  await click('+ Add salesman');
  assert.equal(await evaluate('document.body.textContent.includes("Pay frequency")'),false,'No weekly/monthly selector');
  await fill('Salesman name','Rajesh'); await fill('Daily wage (₹)','500'); await fill('Start date','2024-02-10');
  await click('Save salesman'); await until('!!document.querySelector("[data-testid=staff-card]")');
  await fill('Attendance date','2024-02-05');
  assert.equal(await evaluate('document.querySelectorAll("[data-testid=attendance-calendar] [data-date]").length'),29,'Leap month has 29 dates');
  assert.equal(await evaluate('window.__calls.find(c=>c.path==="create").body.pay_cycle'),'daily');
  assert.equal(await evaluate('document.body.textContent.includes("Not marked")'),true);
  assert.equal(await evaluate('window.__button("✓ Present").disabled'),false,'Previous-day attendance is enabled before original start date');
  assert.equal(await evaluate('!!window.__button("Half-day")'),false,'Extra statuses hidden initially');
  assert.equal(await evaluate('document.body.textContent.includes("Scheduled pay")'),false,'Salary breakdown collapsed initially');
  await click('✓ Present'); await until('window.__attendance.length===1&&!window.__button("Refresh").disabled');
  assert.equal(await evaluate('window.__staff[0].start_date'),'2024-02-05');
  assert.equal(await evaluate('document.querySelector("[data-testid=staff-money-summary]").textContent.includes("ആകെ കൂലി")&&document.querySelector("[data-testid=staff-money-summary]").textContent.includes("നൽകിയത്")'),true);
  assert.equal(await evaluate('document.body.textContent.includes("days need attendance")||document.body.textContent.includes("day needs attendance")'),false,'No duplicate unmarked-date list');
  await fill('Attendance date','2024-02-06');
  await until(`document.querySelector('[data-date="2024-02-06"]')?.getAttribute('aria-pressed')==='true'&&!window.__button('Refresh').disabled`);
  assert.equal(await evaluate('!!window.__button("✓ Present")'),true,'Missing date opens attendance controls');
  await fill('Attendance date','2024-02-05');
  await until('!!window.__button("Change")&&!window.__button("Refresh").disabled');
  assert.equal(await evaluate('!!window.__button("✓ Present")'),false,'Saved attendance replaces selection buttons');
  assert.equal(await evaluate('document.querySelector("[data-testid=staff-card] [role=status]").textContent'), '✓ Present');
  await click('Change'); await click('More'); await click('Half-day');
  await until('window.__attendance[0]?.status==="half_day"&&!window.__button("Refresh").disabled');
  await click('Change'); await click('More'); await click('Paid leave');
  await until('window.__attendance[0]?.status==="paid_leave"&&!window.__button("Refresh").disabled');
  await click('Change'); await click('More'); await click('Clear attendance');
  await until('window.__attendance.length===0&&!window.__button("Refresh").disabled');
  await click('✓ Present'); await until('window.__attendance.length===1&&!window.__button("Refresh").disabled');
  assert.equal(await evaluate('document.body.textContent.includes("total is provisional")'),false,'Marked daily wage is no longer pending');
  await click('Record payment'); await fill('Amount paid (₹)','200');
  await click('Save payment'); await until('document.body.textContent.includes("Save could not be confirmed")');
  assert.equal(await evaluate('window.__button("Change").disabled'),true,'Attendance blocked during uncertain payment');
  await click('Retry same save'); await until('!window.__button("Refresh").disabled&&!document.body.textContent.includes("Save could not be confirmed")');
  assert.equal(await evaluate('window.__payments.length'),1,'Lost response does not duplicate payment');
  const writes = await evaluate('window.__calls.filter(c=>c.path==="payment").map(c=>c.body)');
  assert.deepEqual(writes[0],writes[1],'Manual retry preserves exact UUID and payload');
  assert.equal(writes[0].period_start,writes[0].paid_on,'Payment date, not selected attendance day, used for running balance');
  await fill('Attendance date','2024-03-05');
  await until('!!window.__button("✓ Present")&&!window.__button("Refresh").disabled');
  assert.equal(await evaluate('document.querySelector("[data-testid=staff-card]").textContent.includes("300.00")'),true,'Balance carries across history months');
  assert.equal(await evaluate('document.querySelector("[data-testid=staff-money-summary]").textContent.includes("300.00")'),true,'Summary shows accumulated balance across months');
  assert.equal(await evaluate('!!document.querySelector("[data-testid=staff-running-balance]")'),false,'No duplicate overall-balance line');
  await click('✓ Present'); await until('window.__attendance.length===2&&!window.__button("Refresh").disabled');
  assert.equal(await evaluate('document.querySelector("[data-testid=staff-card]").textContent.includes("800.00")'),true,'Next day earnings accumulate');
  await fill('Attendance date',writes[0].paid_on);
  await until('!window.__button("Refresh").disabled&&!!window.__button("✓ Present")');
  await click('Attendance & payment history');
  await click('Correct mistake'); await click('Yes, cancel record'); await until('document.body.textContent.includes("Cancelled")');
  await fill('Attendance date','2024-02-04'); await until('document.body.textContent.includes("Sunday holiday")');
  assert.equal(await evaluate('!!window.__button("Absent")'),false,'Sunday is not an unpaid absence');
  await click('Worked today?'); await fill('Extra pay (₹)','700'); await click('Save holiday work');
  await until('window.__attendance.some(a=>a.status==="holiday_work")&&!window.__button("Refresh").disabled');
  for (const width of [320,360,390,1024]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'No horizontal overflow at '+width);
  }
  await click('Hide history');
  await fill('Attendance date','2024-02-05');
  await until('document.querySelector("[data-testid=staff-card] [role=status]")?.textContent==="✓ Present"');
  assert.equal(await evaluate(`document.querySelector('[data-date="2024-02-05"]').getAttribute('aria-label').includes('Present')`),true,'Calendar shows saved attendance');
  await evaluate(`window.__staff.push({...window.__staff[0],id:'staff-2',name:'Anil'});`);
  await click('Refresh'); await until('document.querySelectorAll("select option").length===2&&!window.__button("Refresh").disabled');
  await evaluate(`(()=>{const e=window.__field('Salesman');e.value='staff-2';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until('window.__field("Salesman").value==="staff-2"');
  assert.equal(await evaluate('document.querySelectorAll("[data-testid=staff-card]").length'),1,'Only selected staff calendar is shown');
  await evaluate(`(()=>{const e=window.__field('Salesman');e.value='staff-1';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await fill('Month','2026-11');
  await until(`!!document.querySelector('[data-date="2026-11-15"]')&&!window.__button('Refresh').disabled`);
  assert.equal(await evaluate(`document.querySelector('[data-date="2026-11-15"]').disabled`),true,'Future attendance disabled');
  assert.equal(await evaluate('window.__button("Next month").disabled'),true,'Cannot browse beyond current month');
  await fill('Attendance date','2024-02-05');
  await evaluate(`window.__payments.push({id:'alignment-payment',paid_on:'2024-02-05',period_start:'2024-02-05',amount_paise:1000000,voided:false,kind:'salary'});`);
  await click('Refresh');
  await until('!window.__button("Refresh").disabled&&document.querySelector("[data-testid=staff-money-summary]")?.textContent.includes("അധികം നൽകിയത്")');
  for (const width of [320,390,600]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
    if(width<500){
      const navigation=await evaluate(`(()=>{const nav=document.querySelector('[data-testid=calendar-navigation]').getBoundingClientRect();const month=window.__field('Month').closest('.MuiTextField-root').getBoundingClientRect();const arrow=window.__button('Previous month').getBoundingClientRect();return {width:nav.width,pickerWidth:month.width,bottom:month.bottom,arrowTop:arrow.top};})()`);
      assert.ok(Math.abs(navigation.pickerWidth-navigation.width)<1,'Month picker uses full mobile width');
      assert.ok(navigation.arrowTop>=navigation.bottom,'Navigation buttons sit below month picker');
    }
    const tops=await evaluate('[...document.querySelector("[data-testid=staff-money-summary]").children].map(cell=>cell.lastElementChild.getBoundingClientRect().top)');
    assert.ok(Math.max(...tops)-Math.min(...tops)<1,'Amounts align even with wrapped Malayalam labels at '+width);
  }
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  const file=join(tmpdir(),'ration-staff-tracker-preview.png');
  await writeFile(file,Buffer.from(shot.data,'base64'));
  console.log('Preview:',file);
});
console.log('PASS: staff creation, attendance, pending days, Sunday extra pay, payment retry/correction and responsive layout.');
