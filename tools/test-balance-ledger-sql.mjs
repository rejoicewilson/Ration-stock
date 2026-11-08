// Runs entirely in an isolated PostgreSQL-compatible engine, never production.
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
const owner = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const card = '1234567890';
async function call(action, data = {}, account = owner) {
  return (await db.query('select public.ration_balance_ledger($1,$2::jsonb) result',
    ['ledger_' + action, JSON.stringify({ account_id: account, ...data })])).rows[0].result;
}
const detail = (number = card, account = owner, page = 1) => call('detail', { card_number: number, page }, account);
async function add(amount, kind = 'owed_to_shop', overrides = {}, account = owner) {
  return call('add', { card_number: card, kind, amount_paise: amount, request_id: randomUUID(), ...overrides }, account);
}
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261005_python_accounts.sql', import.meta.url), 'utf8'));
  const sql = await readFile(new URL('../supabase/migrations/20261108_customer_balance_ledger.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  await db.query(`insert into ration_private.accounts(id,mobile,fps_id,password_hash) values
    ($1,'919999999991','1234567','fixture'),($2,'919999999992','1234567','fixture')`, [owner, other]);
  assert.equal((await detail()).customer, null, 'Opening a page does not write a customer');
  assert.equal((await call('list')).total, 0);
  const request = randomUUID();
  const first = await add(200, 'owed_to_shop', { request_id: request, customer_name: 'Test customer', note: '₹22 bill, paid ₹20' });
  assert.equal(first.balance_paise, 200);
  const repeated = await add(200, 'owed_to_shop', { request_id: request, customer_name: 'Test customer', note: '₹22 bill, paid ₹20' });
  assert.equal(repeated.entry_id, first.entry_id);
  assert.equal(repeated.replayed, true);
  assert.equal((await detail()).total, 1, 'Retry never duplicates entry');
  assert.equal((await add(300, 'owed_to_shop', { request_id: request })).error, 'request_conflict');
  assert.equal((await add(200, 'owed_to_shop', { request_id: request, card_number: '1234567891' })).error, 'request_conflict');
  assert.equal((await call('list')).total, 1, 'Conflicting retry never creates another customer');
  assert.equal((await add(201, 'received')).error, 'settlement_exceeds_balance');
  assert.equal((await add(100, 'returned')).error, 'settlement_exceeds_balance');
  assert.equal((await add(150, 'received')).balance_paise, 50);
  assert.equal((await add(50, 'received')).balance_paise, 0);
  assert.equal((await add(1, 'received')).error, 'settlement_exceeds_balance');
  const credit = await add(300, 'owed_to_customer');
  assert.equal(credit.balance_paise, -300);
  assert.equal((await add(400, 'returned')).error, 'settlement_exceeds_balance');
  assert.equal((await add(100, 'returned')).balance_paise, -200);
  const correctionId = randomUUID();
  const reverseBody = { card_number: card, entry_id: credit.entry_id, request_id: correctionId, reason: 'Entered by mistake' };
  const corrected = await call('reverse', reverseBody);
  assert.equal(corrected.balance_paise, 100);
  assert.equal((await call('reverse', reverseBody)).entry_id, corrected.entry_id, 'Correction retry idempotent');
  assert.equal((await call('reverse', { ...reverseBody, request_id: randomUUID() })).error, 'already_reversed');
  assert.equal((await call('reverse', { ...reverseBody, entry_id: corrected.entry_id, request_id: randomUUID() })).error, 'already_reversed');
  const history = await detail();
  assert.equal(history.entries.find(e => e.id === credit.entry_id).reversed, true);
  assert.equal(history.entries[0].reverses_id, credit.entry_id);
  assert.equal(history.entries[0].balance_after_paise, 100);
  assert.equal(history.customer.customer_name, 'Test customer');
  assert.equal((await detail(card, other)).customer, null, 'Same FPS does not share account ledger');
  assert.equal((await call('reverse', { ...reverseBody, request_id: randomUUID() }, other)).error, 'not_found');
  assert.equal((await add(900, 'owed_to_shop', {}, other)).balance_paise, 900);
  assert.equal((await detail()).customer.balance_paise, 100, 'Other account cannot alter balance');
  assert.equal((await call('list', {}, other)).totals.to_receive_paise, 900);
  for (const amount of [0, -1, 10000001]) assert.equal((await add(amount)).error, 'invalid');
  assert.equal((await add(100, 'wrong')).error, 'invalid');
  assert.equal((await add(100, 'owed_to_shop', { card_number: 'bad' })).error, 'invalid');
  assert.equal((await call('list', { page: 0 })).error, 'invalid');
  assert.equal((await call('list', { search: '%' })).total, 0, 'Search is literal, not wildcard');
  assert.equal((await call('list', { search: 'test' })).total, 1);
  const before = await detail();
  for (let i = 0; i < 32; i++) await add(1);
  const pageOne = await detail();
  const pageTwo = await detail(card, owner, 2);
  assert.equal(pageOne.entries.length, 30);
  assert.equal(pageTwo.entries.length, pageOne.total - 30);
  assert.equal(new Set([...pageOne.entries, ...pageTwo.entries].map(e => e.id)).size, pageOne.total);
  const delta = (await db.query('select sum(delta_paise) delta from ration_private.ledger_entries where account_id=$1', [owner])).rows[0].delta;
  assert.equal(Number(delta), pageOne.customer.balance_paise, 'Materialized balance matches immutable history');
  await db.exec(sql);
  assert.equal((await detail()).total, before.total + 32, 'Migration rerun preserves records');
  await db.query('update ration_private.accounts set disabled=true where id=$1', [owner]);
  assert.equal((await call('list')).error, 'unauthorized');
  await db.query('update ration_private.accounts set disabled=false,must_change_password=true where id=$1', [owner]);
  assert.equal((await add(1)).error, 'unauthorized');
  await db.query('update ration_private.accounts set must_change_password=false where id=$1', [owner]);
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    await assert.rejects(call('list'), /permission denied/);
    await assert.rejects(db.query('select * from ration_private.ledger_entries'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await call('list')).total, 1);
  await db.exec('reset role');
  console.log('Ledger SQL passed: balances, partial payments, corrections, retries, account isolation, history, permissions and safe rerun.');
} finally { await db.close(); }
