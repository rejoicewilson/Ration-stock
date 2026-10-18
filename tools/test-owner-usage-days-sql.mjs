// Isolated PostgreSQL engine: no connection to the production database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('@electric-sql/pglite', { paths: [join(tmpdir(), 'ration-payment-sql-tests')] });
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema ration_private;
    create table ration_private.accounts(id uuid primary key, fps_id text, mobile text, created_at timestamptz);
    create table ration_private.activity_daily(account_id uuid references ration_private.accounts, activity_date date, feature text, requests bigint, primary key(account_id,activity_date,feature));
    insert into ration_private.accounts values
      ('00000000-0000-0000-0000-000000000001','1234567','919999999991','2026-09-29T20:00:00Z'),
      ('00000000-0000-0000-0000-000000000002','1234567','919999999992','2026-10-01T00:00:00Z'),
      ('00000000-0000-0000-0000-000000000003','7654321','919999999993','2026-10-01T00:00:00Z');
    insert into ration_private.activity_daily values
      ('00000000-0000-0000-0000-000000000001','2026-09-30','/count',20),
      ('00000000-0000-0000-0000-000000000001','2026-10-01','/count',3),
      ('00000000-0000-0000-0000-000000000001','2026-10-01','transactions',15),
      ('00000000-0000-0000-0000-000000000001','2026-10-02','/count',1),
      ('00000000-0000-0000-0000-000000000003','2026-10-01','/count',1),
      ('00000000-0000-0000-0000-000000000003','2026-10-02','/count',1),
      ('00000000-0000-0000-0000-000000000003','2026-10-03','/count',1);
    insert into ration_private.accounts
      select md5(n::text)::uuid, lpad(n::text,7,'0'), '9188888'||lpad(n::text,5,'0'), '2026-10-05T00:00:00Z'::timestamptz
      from generate_series(10,64) n;`);
  const sql = await readFile(new URL('../supabase/migrations/20261018_owner_usage_days.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  async function report(search = '', offset = 0) {
    return (await db.query(`select public.ration_usage_days('usage_days',$1::jsonb) as report`, [JSON.stringify({ search, offset })])).rows[0].report;
  }
  const first = await report();
  assert.equal(first.matching_accounts, 58);
  assert.equal(first.accounts.length, 50);
  assert.equal(first.accounts[0].fps_id, '7654321', 'Joined date breaks days-used tie');
  const a = (await report('919999999991')).accounts[0];
  assert.equal(a.days_used, 3, 'Distinct days across features and months, not request count');
  assert.equal(a.joined_on, '2026-09-30', 'IST registration date');
  assert.equal(a.last_used, '2026-10-02');
  const b = (await report('919999999992')).accounts[0];
  assert.equal(b.days_used, 0);
  assert.equal(b.last_used, null);
  assert.equal((await report('1234567')).accounts.length, 2, 'Same FPS accounts stay separate');
  const second = await report('', 50);
  assert.equal(second.accounts.length, 8);
  assert.equal(new Set([...first.accounts, ...second.accounts].map(a => a.id)).size, 58);
  assert.deepEqual((await report('0000000000')).accounts, []);
  assert.deepEqual((await report('', 5000)).accounts, []);
  await assert.rejects(db.query(`select public.ration_usage_days('record_activity','{}')`), /Unsupported/);
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    await assert.rejects(report(), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await report()).matching_accounts, 58);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::integer n from ration_private.activity_daily')).rows[0].n, 7, 'Report creates no activity');
  await db.exec(`alter table ration_private.activity_daily add column last_used_at timestamptz not null default now();
    update ration_private.activity_daily set last_used_at=(activity_date::text||'T10:00:00+00:00')::timestamptz;`);
  const recentSql = await readFile(new URL('../supabase/migrations/20261018_owner_recent_usage.sql', import.meta.url), 'utf8');
  await db.exec(recentSql);
  await db.exec(recentSql);
  async function recent(search = '', offset = 0) {
    return (await db.query(`select public.ration_recent_usage('recent_usage',$1::jsonb) as report`, [JSON.stringify({ search, offset })])).rows[0].report;
  }
  const latest = await recent();
  assert.equal(latest.matching_accounts, 2, 'Only accounts with recorded use');
  assert.deepEqual(latest.accounts.map(a => a.fps_id), ['7654321', '1234567'], 'Newest activity first');
  assert.equal(new Date(latest.accounts[0].last_used_at).toISOString(), '2026-10-03T10:00:00.000Z');
  assert.equal(latest.accounts[0].last_feature, '/count');
  assert.equal((await recent('919999999991')).matching_accounts, 1, 'Mobile search');
  assert.equal((await recent('919999999992')).matching_accounts, 0, 'Never-used account omitted');
  assert.deepEqual((await recent('', 50)).accounts, []);
  await assert.rejects(db.query(`select public.ration_recent_usage('record_activity','{}')`), /Unsupported/);
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    await assert.rejects(recent(), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await recent()).matching_accounts, 2);
  await db.exec('reset role');
  await db.exec(`insert into ration_private.activity_daily(account_id,activity_date,feature,requests,last_used_at)
    select id,'2026-10-04','transactions',1,'2026-10-04T10:00:00Z'
    from ration_private.accounts where mobile like '9188888%';`);
  const recentPage1 = await recent(), recentPage2 = await recent('', 50);
  assert.equal(recentPage1.matching_accounts, 57);
  assert.equal(recentPage1.accounts.length, 50);
  assert.equal(recentPage2.accounts.length, 7);
  assert.equal(new Set([...recentPage1.accounts,...recentPage2.accounts].map(a=>a.id)).size,57,'Stable pagination with tied timestamps');
  assert.equal((await db.query('select count(*)::integer n from ration_private.activity_daily')).rows[0].n, 62, 'Recent report creates no activity');
  console.log('PASS: all-time distinct days, IST join dates, zero-use accounts, same-FPS isolation, search, pagination, repeatable migration, private permissions, no report writes.');
  console.log('PASS: recent-use timestamp/feature, latest-first order, unused account exclusion, search, stable tied-timestamp pagination, private permissions and repeatable read-only migration.');
} finally { await db.close(); }
