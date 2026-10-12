// Runs billing migrations in memory; never connects to Supabase.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('@electric-sql/pglite', {
  paths: [process.env.PGLITE_TEST_ROOT || process.cwd()],
});
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role');
  for (const path of ['../supabase/migrations/20261005_python_accounts.sql',
    '../supabase/migrations/20261012_subscription_foundation.sql',
    '../supabase/migrations/20261012_subscription_orders.sql']) {
    await db.exec(await readFile(new URL(path, import.meta.url), 'utf8'));
  }
  const id = '11111111-1111-4111-8111-111111111111';
  const receipt1 = '22222222-2222-4222-8222-222222222222';
  const receipt2 = '33333333-3333-4333-8333-333333333333';
  await db.query("insert into ration_private.accounts(id,mobile,fps_id,password_hash) values($1,'919999999999','1842187','hash')", [id]);
  const call = async (action, data) => (await db.query(
    'select public.ration_subscription($1,$2::jsonb) as result',
    [action, JSON.stringify(data)],
  )).rows[0].result;
  const status = mode => call('subscription_status', { account_id: id, mode });
  for (const [receipt, order] of [[receipt1, 'order_ABC123'], [receipt2, 'order_DEF456']]) {
    await call('billing_intent', { receipt, account_id: id, mode: 'test' });
    await call('billing_attach', { receipt, order_id: order, mode: 'test' });
  }
  assert.equal((await call('billing_pending', { account_id: id, mode: 'test' })).length, 2);
  assert.equal((await call('billing_order', { order_id: 'order_ABC123', mode: 'test' })).account_id, id);
  assert.equal(await call('billing_order', { order_id: 'order_ABC123', mode: 'live' }), null);
  const first = await call('billing_activate', { order_id: 'order_ABC123', payment_id: 'pay_ABC123', mode: 'test' });
  assert.equal(first.duplicate, false);
  const duplicate = await call('billing_activate', { order_id: 'order_ABC123', payment_id: 'pay_ABC123', mode: 'test' });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.paid_until, first.paid_until);
  await assert.rejects(call('billing_activate', { order_id: 'order_ABC123', payment_id: 'pay_WRONG', mode: 'test' }));
  const second = await call('billing_activate', { order_id: 'order_DEF456', payment_id: 'pay_DEF456', mode: 'test' });
  assert.ok(new Date(second.paid_until) - new Date(first.paid_until) >= 30 * 86400000);
  assert.equal((await status('test')).active, true);
  assert.equal((await status('live')).active, false);
  assert.deepEqual(await call('billing_pending', { account_id: id, mode: 'test' }), []);
  const migration = await readFile(new URL('../supabase/migrations/20261012_subscription_orders.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  assert.equal((await status('test')).paid_until, second.paid_until);
  const grants = (await db.query(`select
    has_function_privilege('anon','public.ration_subscription(text,jsonb)','EXECUTE') as anon_rpc,
    has_function_privilege('authenticated','public.ration_subscription(text,jsonb)','EXECUTE') as auth_rpc,
    has_function_privilege('service_role','public.ration_subscription(text,jsonb)','EXECUTE') as service_rpc,
    has_table_privilege('anon','ration_private.subscription_orders','SELECT') as anon_table`)).rows[0];
  assert.deepEqual(grants, { anon_rpc: false, auth_rpc: false, service_rpc: true, anon_table: false });
  console.log('PASS: orders, mode isolation, activation, idempotency, renewal, rerun, grants.');
} finally {
  await db.close();
}
