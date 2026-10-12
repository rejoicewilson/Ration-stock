// Runs the real additive SQL locally; does not connect to Supabase.
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
  const accountsSql = await readFile(new URL('../supabase/migrations/20261005_python_accounts.sql', import.meta.url), 'utf8');
  const subscriptionSql = await readFile(new URL('../supabase/migrations/20261012_subscription_foundation.sql', import.meta.url), 'utf8');
  await db.exec(accountsSql);
  await db.exec(subscriptionSql);

  const id = '11111111-1111-4111-8111-111111111111';
  await db.query("insert into ration_private.accounts(id,mobile,fps_id,password_hash) values($1,'919999999999','1842187','test-hash')", [id]);
  const status = async mode => (await db.query(
    "select public.ration_subscription('subscription_status',$1::jsonb) as result",
    [JSON.stringify({ account_id: id, mode })],
  )).rows[0].result;

  assert.deepEqual(await status('test'), { active: false, paid_until: null });
  assert.deepEqual(await status('live'), { active: false, paid_until: null });
  await db.query("insert into ration_private.entitlements(account_id,mode,paid_until) values($1,'test',now() + interval '30 days')", [id]);
  assert.equal((await status('test')).active, true);
  assert.equal((await status('live')).active, false);
  await db.query("insert into ration_private.entitlements(account_id,mode,paid_until) values($1,'live',now() - interval '1 day')", [id]);
  assert.equal((await status('live')).active, false);
  await db.exec(subscriptionSql); // Re-running must preserve paid access.
  assert.equal((await status('test')).active, true);

  const grants = (await db.query(`select
    has_function_privilege('anon','public.ration_subscription(text,jsonb)','EXECUTE') as anon_rpc,
    has_function_privilege('authenticated','public.ration_subscription(text,jsonb)','EXECUTE') as auth_rpc,
    has_function_privilege('service_role','public.ration_subscription(text,jsonb)','EXECUTE') as service_rpc,
    has_table_privilege('anon','ration_private.entitlements','SELECT') as anon_table`)).rows[0];
  assert.deepEqual(grants, { anon_rpc: false, auth_rpc: false, service_rpc: true, anon_table: false });
  console.log('PASS: missing, test, live and expired status; rerun preserves access; private grants.');
} finally {
  await db.close();
}
