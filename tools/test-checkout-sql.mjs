// Uses a temporary PostgreSQL engine; never connects to the user's Supabase project.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = process.env.PGLITE_TEST_ROOT || join(tmpdir(), 'ration-payment-sql-tests');
const modulePath = require.resolve('@electric-sql/pglite', { paths: [root] });
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const account = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const key = 'rzp_test_fixture';
const sql = await readFile(new URL('../supabase/migrations/20261017_subscription_payments.sql', import.meta.url), 'utf8');
const freeSql = await readFile(new URL('../supabase/migrations/20261016_account_free_periods.sql', import.meta.url), 'utf8');
let receiptNumber = 10;
const receipt = () => `00000000-0000-0000-0000-${String(receiptNumber++).padStart(12, '0')}`;
async function call(action, data = {}, mode = 'test', keyId = key) {
  return (await db.query('select public.ration_checkout($1,$2::jsonb) as result',
    ['checkout_' + action, JSON.stringify({ ...data, mode, key_id: keyId })])).rows[0].result;
}
async function plan(mode = 'test') {
  return (await db.query("select public.ration_plan_status('subscription_status',$1::jsonb) as result",
    [JSON.stringify({ account_id: account, mode })])).rows[0].result;
}
async function prepare(mode = 'test', keyId = key) {
  return call('prepare', { account_id: account, receipt: receipt() }, mode, keyId);
}
function activation(row, paymentId, changes = {}) {
  return { account_id: account, receipt: row.receipt, order_id: row.order_id,
    payment_id: paymentId, amount_paise: 9900, currency: 'INR', ...changes };
}

try {
  await db.exec('create role anon; create role authenticated; create role service_role');
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_python_accounts.sql', import.meta.url), 'utf8'));
  // Match the pre-existing table contract without importing old application code.
  await db.exec(`
    create table ration_private.entitlements (
      account_id uuid references ration_private.accounts(id) on delete cascade,
      mode text not null check (mode in ('test','live')), paid_until timestamptz not null,
      primary key(account_id,mode));
    create table ration_private.subscription_orders (
      receipt uuid primary key, order_id text unique,
      account_id uuid not null references ration_private.accounts(id) on delete cascade,
      mode text not null check (mode in ('test','live')),
      amount_paise integer not null default 9900 check (amount_paise=9900),
      payment_id text unique, created_at timestamptz not null default now(),
      activated_at timestamptz, granted_until timestamptz);
    create function public.ration_subscription(text,jsonb) returns text language sql as $$select 'preserved'::text$$;
  `);
  for (const [id, mobile] of [[account, '919999999998'], [other, '919999999999']]) {
    await db.query('insert into ration_private.accounts(id,mobile,fps_id,password_hash) values($1,$2,$3,$4)',
      [id, mobile, id === account ? '1234567' : '1842187', 'fixture-only']);
  }
  await db.exec(freeSql);
  await db.exec(sql);
  const expiryOperation = await readFile(new URL('../supabase/operations/expire_free_plan_1234567.sql', import.meta.url), 'utf8');
  await db.exec(expiryOperation.replace('REPLACE_WITH_CONFIRMED_MOBILE', '919999999998'));
  assert.equal(new Date((await plan()).free_until).toISOString(), '2026-10-15T18:30:00.000Z');

  const [first, second] = await Promise.all([prepare(), prepare()]);
  assert.equal(first.new_intent, true);
  assert.equal(second.new_intent, false);
  assert.equal(first.receipt, second.receipt, 'Repeated clicks must share one intent');
  let row = await call('attach', { account_id: account, receipt: first.receipt, order_id: 'order_one' });
  assert.equal((await call('attach', { account_id: account, receipt: first.receipt, order_id: 'order_one' })).order_id, 'order_one');
  await assert.rejects(call('attach', { account_id: other, receipt: row.receipt, order_id: 'order_one' }));
  assert.equal(await call('get', { account_id: other, order_id: 'order_one' }), null);
  assert.equal(await call('get', { account_id: account, order_id: 'order_one' }, 'live', 'rzp_live_fixture'), null);
  for (const changes of [{ amount_paise: 1 }, { currency: 'USD' }, { payment_id: '' }, { order_id: 'order_wrong' }]) {
    await assert.rejects(call('activate', activation(row, 'pay_one', changes)));
    assert.equal((await plan()).paid_until, null);
  }
  const [grant, duplicate] = await Promise.all([
    call('activate', activation(row, 'pay_one')), call('activate', activation(row, 'pay_one')),
  ]);
  assert.equal(grant.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(grant.paid_until, duplicate.paid_until);
  assert.ok(Math.abs(new Date(grant.paid_until).getTime() - Date.now() - 30 * 86400000) < 10000);
  await assert.rejects(call('activate', activation(row, 'pay_wrong')));
  assert.equal((await plan('live')).paid_until, null, 'Test payment must not grant live access');

  const next = await prepare();
  assert.equal(next.new_intent, true);
  row = await call('attach', { account_id: account, receipt: next.receipt, order_id: 'order_two' });
  const previousExpiry = (await plan()).paid_until;
  await assert.rejects(call('activate', activation(row, 'pay_one')), 'One payment cannot activate different orders');
  assert.equal((await plan()).paid_until, previousExpiry, 'Failed activation must roll back the entitlement update');
  const renewal = await call('activate', activation(row, 'pay_two'));
  assert.equal(new Date(renewal.paid_until) - new Date(previousExpiry), 30 * 86400000);

  const failed = await prepare();
  await call('creation_failed', { account_id: account, receipt: failed.receipt });
  assert.equal((await prepare()).new_intent, true, 'Definitively rejected creation should be retryable');
  const live = await prepare('live', 'rzp_live_fixture');
  const liveRow = await call('attach', { account_id: account, receipt: live.receipt, order_id: 'order_live' }, 'live', 'rzp_live_fixture');
  const liveGrant = await call('activate', activation(liveRow, 'pay_live'), 'live', 'rzp_live_fixture');
  assert.ok(liveGrant.paid_until);
  assert.equal((await db.query('select paid_until from ration_private.entitlements where account_id=$1', [other])).rows.length, 0);

  await db.exec(sql); // Repeat migration must preserve access and payment history.
  assert.equal((await plan()).paid_until, renewal.paid_until);
  assert.equal((await plan('live')).paid_until, liveGrant.paid_until);
  assert.equal((await db.query("select public.ration_subscription('', '{}'::jsonb) as value")).rows[0].value, 'preserved');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select public.ration_checkout('checkout_pending', '{}'::jsonb)"));
    await assert.rejects(db.query("select public.ration_plan_status('subscription_status', '{}'::jsonb)"));
    await assert.rejects(db.query('select * from ration_private.subscription_orders'));
    await db.exec('reset role');
  }
  console.log('PASS: migration repeatability, exact account expiry, intent reuse, account isolation, test/live separation, payment replay protection, 30-day grants, renewals, rollback, and private permissions.');
} finally {
  await db.close();
}
