// Isolated PostgreSQL; no live accounts or database access.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const root = process.env.PGLITE_TEST_ROOT || join(tmpdir(), 'ration-payment-sql-tests');
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite', { paths: [root] })).href);
const db = new PGlite();
const owner = randomUUID(), other = randomUUID();
async function call(action, body = {}, account = owner) {
  return (await db.query('select public.ration_staff($1,$2::jsonb) result',
    ['staff_' + action, JSON.stringify({ ...body, account_id: account })])).rows[0].result;
}
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_python_accounts.sql', import.meta.url), 'utf8'));
  const sql = await readFile(new URL('../supabase/migrations/20261114_staff_attendance_salary.sql', import.meta.url), 'utf8');
  await db.exec(sql); await db.exec(sql);
  await db.query(`insert into ration_private.accounts(id,mobile,fps_id,password_hash) values
    ($1,'919999999991','1842187','fixture'),($2,'919999999992','1842187','fixture')`, [owner,other]);
  const create = {name:'Staff one',pay_cycle:'monthly',rate_paise:1500000,start_date:'2024-01-01',request_id:randomUUID()};
  const member = await call('create',create);
  assert.equal(member.ok,true);
  assert.equal((await call('create',create)).staff_id,member.staff_id);
  assert.equal((await call('create',{...create,name:'Changed'})).error,'request_conflict');
  const report = () => call('report',{day:'2024-02-10'});
  assert.equal((await report()).staff.length,1);
  assert.equal((await call('report',{day:'2024-02-10'},other)).staff.length,0,'Same FPS does not share staff');
  const attendance = {staff_id:member.staff_id,work_date:'2024-02-05',status:'present',extra_paise:0,expected_revision:0,request_id:randomUUID()};
  assert.equal((await call('attendance',attendance,other)).error,'not_found');
  assert.equal((await call('attendance',attendance)).revision,1);
  assert.equal((await call('attendance',attendance)).replayed,true);
  assert.equal((await call('attendance',{...attendance,request_id:randomUUID()})).error,'conflict');
  assert.equal((await call('attendance',{...attendance,status:'absent'})).error,'request_conflict');
  assert.equal((await call('attendance',{...attendance,work_date:'2024-02-04',expected_revision:1,request_id:randomUUID()})).error,'invalid','Sunday cannot be marked present');
  assert.equal((await call('attendance',{...attendance,work_date:'2099-01-01',expected_revision:1,request_id:randomUUID()})).error,'invalid');
  assert.equal((await call('attendance',{...attendance,work_date:'2023-12-01',expected_revision:1,request_id:randomUUID()})).error,'invalid');
  const change = await call('attendance',{...attendance,status:'half_day',expected_revision:1,request_id:randomUUID()});
  assert.equal(change.previous.status,'present');
  assert.equal((await report()).staff[0].attendance[0].status,'half_day');
  const pay = {staff_id:member.staff_id,period_start:'2024-02-01',paid_on:'2024-02-10',kind:'advance',amount_paise:10000,note:'Test',expected_revision:2,request_id:randomUUID()};
  const payment = await call('payment',pay);
  assert.equal(payment.ok,true);
  assert.equal((await call('payment',pay)).payment_id,payment.payment_id);
  assert.equal((await call('payment',{...pay,amount_paise:11000})).error,'request_conflict');
  assert.equal((await report()).staff[0].payments.length,1);
  const voidBody = {staff_id:member.staff_id,payment_id:payment.payment_id,expected_revision:3,request_id:randomUUID()};
  assert.equal((await call('void',voidBody,other)).error,'not_found');
  assert.equal((await call('void',voidBody)).ok,true);
  assert.equal((await call('void',voidBody)).replayed,true);
  assert.equal((await report()).staff[0].payments[0].voided,true);
  assert.equal((await call('payment',{...pay,expected_revision:4,period_start:'2024-02-02',request_id:randomUUID()})).error,'invalid');
  assert.equal((await call('attendance',{...attendance,status:'unmarked',expected_revision:4,request_id:randomUUID()})).ok,true);
  assert.equal((await report()).staff[0].attendance.length,0);
  await db.exec(sql);
  assert.equal((await report()).staff[0].payments.length,1,'Rerun migration preserves history');
  for (const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    await assert.rejects(report(),/permission denied/);
    await assert.rejects(db.query('select * from ration_private.staff_payments'),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await report()).staff.length,1);
  await db.exec('reset role');
  const backdateSql = await readFile(new URL('../supabase/migrations/20261114_staff_daily_backdate.sql', import.meta.url), 'utf8');
  await db.exec(backdateSql); await db.exec(backdateSql);
  const daily = await call('create',{...create,pay_cycle:'daily',rate_paise:50000,start_date:'2024-02-10',request_id:randomUUID()});
  const earlier = {...attendance,staff_id:daily.staff_id,work_date:'2024-02-05',request_id:randomUUID(),expected_revision:0};
  assert.equal((await call('attendance',earlier)).ok,true,'Daily attendance may precede saved start date');
  assert.equal((await call('attendance',earlier)).replayed,true);
  const dailyReport=(await report()).staff.find(s=>s.id===daily.staff_id);
  assert.equal(dailyReport.start_date,'2024-02-05');
  assert.equal(dailyReport.attendance[0].work_date,'2024-02-05');
  assert.equal((await call('payment',{...pay,staff_id:daily.staff_id,period_start:'2024-02-05',paid_on:'2024-02-05',expected_revision:1,request_id:randomUUID()})).ok,true);
  assert.equal((await call('attendance',{...earlier,work_date:'2024-02-04',expected_revision:2,request_id:randomUUID()})).error,'invalid','Sunday is still protected');
  assert.equal((await call('attendance',{...earlier,work_date:'2099-01-01',expected_revision:2,request_id:randomUUID()})).error,'invalid');
  assert.equal((await call('attendance',{...earlier,work_date:'2019-12-31',expected_revision:2,request_id:randomUUID()})).error,'invalid');
  assert.equal((await call('attendance',{...earlier,expected_revision:2,request_id:randomUUID()},other)).error,'not_found');
  assert.equal((await call('attendance',{...attendance,work_date:'2023-12-01',expected_revision:5,request_id:randomUUID()})).error,'invalid','Legacy monthly start date stays intact');
  const runningSql = await readFile(new URL('../supabase/migrations/20261114_staff_running_balance.sql', import.meta.url), 'utf8');
  await db.exec(runningSql); await db.exec(runningSql);
  const running = await call('create',{...create,pay_cycle:'daily',rate_paise:50000,start_date:'2024-01-29',request_id:randomUUID()});
  let revision=0;
  for (const day of ['2024-01-29','2024-01-30','2024-01-31','2024-02-01','2024-02-02','2024-02-03','2024-02-05']) {
    assert.equal((await call('attendance',{...attendance,staff_id:running.staff_id,work_date:day,expected_revision:revision++,request_id:randomUUID()})).ok,true);
  }
  const delayed={...pay,staff_id:running.staff_id,period_start:'2024-01-29',paid_on:'2024-02-07',amount_paise:200000,expected_revision:revision++,request_id:randomUUID()};
  const saved=await call('payment',delayed);
  assert.equal(saved.ok,true);
  assert.equal((await call('payment',delayed)).replayed,true);
  for (const day of ['2024-01-30','2024-02-10','2024-03-10']) {
    const staff=(await call('report',{day})).staff.find(s=>s.id===running.staff_id);
    assert.equal(staff.daily_totals.earned_units,14);
    assert.equal(staff.daily_totals.paid_paise,200000);
    if(day==='2024-02-10')assert.equal(staff.payments[0].period_start,'2024-02-07','Payment is no longer assigned to attendance date');
    if(day==='2024-03-10')assert.equal(staff.attendance.length,0,'Empty history month does not clear running totals');
  }
  assert.equal((await call('void',{staff_id:running.staff_id,payment_id:saved.payment_id,expected_revision:revision++,request_id:randomUUID()})).ok,true);
  assert.equal((await report()).staff.find(s=>s.id===running.staff_id).daily_totals.paid_paise,0);
  assert.equal((await call('report',{day:'2024-02-10'},other)).staff.length,0);
  await db.query('update ration_private.accounts set disabled=true where id=$1',[owner]);
  assert.equal((await report()).error,'unauthorized');
  console.log('PASS: staff isolation, idempotency, revisions, Sundays, dates, payment correction, migration reruns and database permissions.');
} finally { await db.close(); }
