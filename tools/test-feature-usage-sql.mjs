// Runs in isolated PostgreSQL, never production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const root = process.env.PGLITE_TEST_ROOT || join(tmpdir(), 'ration-payment-sql-tests');
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite', { paths: [root] })).href);
const db = new PGlite();
const owner='00000000-0000-0000-0000-000000000001';
async function call(action,data={}) {
  return (await db.query('select public.ration_activity($1,$2::jsonb) result',[action,JSON.stringify(data)])).rows[0].result;
}
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_python_accounts.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_activity_dashboard.sql',import.meta.url),'utf8'));
  await db.query("insert into ration_private.accounts(id,mobile,fps_id,password_hash) values ($1,'919999999991','1842187','fixture')",[owner]);
  const record=feature=>call('record_activity',{account_id:owner,feature});
  await record('/count');
  await assert.rejects(record('balanceLedger'),/Unsupported feature/);
  const sql=await readFile(new URL('../supabase/migrations/20261115_activity_balance_staff.sql',import.meta.url),'utf8');
  await db.exec(sql); await db.exec(sql);
  for(const feature of ['balanceLedger','staffTracker']) {
    await record(feature); await record(feature);
  }
  await record('commission');
  const report=await call('dashboard',{offset:0,search:''});
  assert.equal(report.features.find(f=>f.feature==='/count').requests,1,'Existing usage is preserved');
  for(const feature of ['balanceLedger','staffTracker']) {
    assert.equal(report.features.find(f=>f.feature===feature).requests,2);
    assert.equal(report.features.find(f=>f.feature===feature).accounts,1);
    assert.equal(report.accounts[0].features.find(f=>f.feature===feature).requests,2);
  }
  assert.equal(report.active_today,1,'Activity days count unique accounts, not feature requests');
  await assert.rejects(record('unknown-feature'),/Unsupported feature/);
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    await assert.rejects(record('staffTracker'),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await record('staffTracker')).ok,true);
  console.log('PASS: new feature usage saved, grouped and reported; existing counts and permissions preserved.');
} finally { await db.close(); }
