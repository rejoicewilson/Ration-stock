// Local SQL regression test; install @electric-sql/pglite in a test-only directory.
// Set PGLITE_TEST_ROOT to that directory, then node tools/test-free-login.mjs.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const modulePath = require.resolve('@electric-sql/pglite', { paths: [process.env.PGLITE_TEST_ROOT || process.cwd()] });
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role');
const sql = await readFile(new URL('../supabase/migrations/20261005_python_accounts.sql', import.meta.url), 'utf8');
await db.exec(sql);
const id = '00000000-0000-0000-0000-000000000001';
await db.query("insert into ration_private.accounts(id,mobile,fps_id,password_hash,last_device_replaced_at) values($1,'919999999999','2053085','test-hash',now())", [id]);
async function call(action, data) {
  return (await db.query('select public.ration_auth($1,$2::jsonb) as result', [action, JSON.stringify(data)])).rows[0].result;
}
for (let i = 1; i <= 4; i++) {
  assert.equal((await call('open_session', {account_id: id, expected_hash: 'test-hash',
    device_hash: String(i).repeat(64), session_hash: String(i + 4).repeat(64),
    label: 'Test browser', session_days: 30, max_devices: 2, cooldown_days: 7})).ok, true);
}
await db.exec(sql); // Rerunning migration must preserve all accounts and sessions.
for (let i = 1; i <= 4; i++) {
  assert.equal((await call('session', {session_hash: String(i + 4).repeat(64)})).id, id);
}
assert.equal((await call('open_session', {account_id: id, expected_hash: 'wrong'})).error, 'invalid_credentials');
for (let i = 0; i < 10; i++) assert.equal((await call('limit', {key: 'test', max: 10})).allowed, true);
assert.equal((await call('limit', {key: 'test', max: 10})).allowed, false);
await call('logout', {session_hash: '5'.repeat(64)});
assert.equal(await call('session', {session_hash: '5'.repeat(64)}), null);
assert.equal((await call('session', {session_hash: '6'.repeat(64)})).id, id);
await db.close();
console.log('PASS: four browsers despite old limits/cooldown; sessions preserved after migration; wrong passwords blocked; throttling and logout intact.');
