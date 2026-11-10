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
  const filterSql = await readFile(new URL('../supabase/migrations/20261108_customer_balance_ledger_status_filter.sql', import.meta.url), 'utf8');
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
  await db.exec(filterSql);
  const historyBeforeFilter = (await detail()).total;
  assert.equal((await call('list', { status: 'open' })).total, 1);
  assert.equal((await call('list', { status: 'closed' })).total, 0);
  assert.equal((await call('list', { status: 'invalid' })).error, 'invalid');
  // Enough closed rows to prove filtering occurs before LIMIT/OFFSET.
  for (let i = 0; i < 23; i++) {
    const number = String(7000000000 + i);
    await add(100, 'owed_to_shop', { card_number: number });
    await add(100, 'received', { card_number: number });
  }
  const open = await call('list', { status: 'open' });
  assert.equal(open.total, 1);
  assert.equal(open.customers[0].card_number, card);
  assert.equal(open.status, 'open');
  const closed = await call('list', { status: 'closed' });
  const closedTwo = await call('list', { status: 'closed', page: 2 });
  assert.equal(closed.total, 23);
  assert.equal(closed.customers.length, 20);
  assert.equal(closedTwo.customers.length, 3);
  assert.equal(new Set([...closed.customers, ...closedTwo.customers].map(c => c.id)).size, 23);
  assert.equal((await call('list', { status: 'all', search: '7000000000' })).total, 1);
  assert.equal((await call('list', { status: 'open' }, other)).total, 1);
  assert.equal((await call('list', { status: 'closed' }, other)).total, 0);
  await add(1, 'owed_to_shop', { card_number: '7000000000' });
  assert.equal((await call('list', { status: 'open' })).total, 2, 'Reopened card is active again');
  await db.exec(filterSql);
  assert.equal((await detail()).total, historyBeforeFilter, 'Filter migration rerun preserves history');
  const mobileSql = await readFile(new URL('../supabase/migrations/20261110_customer_balance_ledger_mobile.sql', import.meta.url), 'utf8');
  await db.exec(mobileSql);
  assert.equal((await detail()).customer.customer_mobile, '', 'Old customers remain valid without contact');
  assert.equal((await detail()).total, historyBeforeFilter);
  const mobileRequest = { customer_mobile: '9000000001', request_id: randomUUID() };
  await add(1, 'owed_to_shop', mobileRequest);
  const afterMobile = await detail();
  assert.equal(afterMobile.customer.customer_mobile, '9000000001');
  assert.equal((await call('list', { search: '9000000001' })).customers[0].customer_mobile, '9000000001');
  assert.equal((await call('list', { search: '9000000001' }, other)).total, 0, 'Contact search is account-private');
  assert.equal((await add(1, 'owed_to_shop', mobileRequest)).replayed, true);
  assert.equal((await detail()).total, afterMobile.total, 'Contact save retries do not duplicate money entries');
  for (const phone of ['123', '1000000000', '+919000000001']) assert.equal((await add(1, 'owed_to_shop', {customer_mobile: phone})).error, 'invalid');
  await db.exec(mobileSql);
  assert.equal((await detail()).customer.customer_mobile, '9000000001');
  assert.equal((await detail()).total, afterMobile.total, 'Mobile migration rerun retains history');
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    await assert.rejects(call('list'), /permission denied/);
    await assert.rejects(db.query('select customer_mobile from ration_private.ledger_customers'), /permission denied/);
    await db.exec('reset role');
  }
  console.log('Ledger SQL passed: balances, partial payments, corrections, retries, account isolation, history, permissions and safe rerun.');
} finally { await db.close(); }
