// Isolated PostgreSQL-compatible engine. Never connects to production.
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
const hash = 'a'.repeat(64);
async function session(value = hash) {
  return (await db.query("select public.ration_session('session', $1::jsonb) result",
    [JSON.stringify({ session_hash: value })])).rows[0].result;
}
async function expiry() {
  return (await db.query('select extract(epoch from expires_at) expiry from ration_private.devices')).rows[0].expiry;
}
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_python_accounts.sql', import.meta.url), 'utf8'));
  const sql = await readFile(new URL('../supabase/migrations/20261107_session_renewal.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  await db.exec(`insert into ration_private.accounts(id, mobile, fps_id, password_hash)
    values ('00000000-0000-0000-0000-000000000001','919999999999','1234567','fixture');
    insert into ration_private.devices(account_id, device_hash, session_hash, label, expires_at)
    values ('00000000-0000-0000-0000-000000000001','${'b'.repeat(64)}','${hash}','fixture',now()+interval '1 hour');`);
  const upgraded = await session();
  assert.equal(upgraded.fps_id, '1234567');
  assert.ok(Math.abs(upgraded.session_expires_at - Date.now() / 1000 - 60 * 86400) < 10);
  const once = await expiry();
  await session();
  assert.equal(await expiry(), once, 'No repeated expiry write within a day');
  await db.exec("update ration_private.devices set expires_at=now()+interval '58 days'");
  assert.ok((await session()).session_expires_at > once - 10, 'Renew after daily threshold');
  await db.exec('update ration_private.accounts set disabled=true');
  assert.equal(await session(), null, 'Disabled accounts cannot renew');
  await db.exec("update ration_private.accounts set disabled=false; update ration_private.devices set expires_at=now()-interval '1 second'");
  const expired = await expiry();
  assert.equal(await session(), null);
  assert.equal(await expiry(), expired, 'Expired session never resurrected');
  assert.equal(await session('c'.repeat(64)), null, 'Unknown token rejected');
  await db.exec("update ration_private.devices set expires_at=now()+interval '60 days'");
  await db.query("select public.ration_auth('logout', $1::jsonb)", [JSON.stringify({ session_hash: hash })]);
  assert.equal(await session(), null, 'Logout revocation retained');
  await db.exec(`update ration_private.devices set session_hash='${hash}',expires_at=now()+interval '60 days'`);
  await db.query("select public.ration_auth('reset_password',$1::jsonb)",
    [JSON.stringify({ mobile: '919999999999', password_hash: 'replacement', reason: 'Verified test recovery' })]);
  assert.equal(await session(), null, 'Recovery revokes sessions');
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    await assert.rejects(session(), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal(await session(), null);
  await db.exec('reset role');
  await assert.rejects(db.query("select public.ration_session('open_session','{}')"), /Unsupported/);
  console.log('Session SQL checks passed: upgrade, daily renewal, expiry, revocation and permissions.');
} finally {
  await db.close();
}
