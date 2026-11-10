import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Stack, SvgIcon, TextField, Typography } from '@mui/material';
import { ledgerRequest as api } from './ledgerApi';

const ink = '#17233c';
const primary = '#1976d2';
const muted = '#64748b';
const divider = '#e8edf7';
function parseAmount(value) {
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value || '')) return null;
  const [rupees, paise = ''] = value.split('.');
  const parsed = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  return parsed >= 1 && parsed <= 10000000 ? parsed : null;
}
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Math.abs(value) / 100);
const balanceText = value => value > 0 ? `കിട്ടാനുണ്ട് ${money(value)}` : value < 0 ? `കൊടുക്കാനുണ്ട് ${money(value)}` : 'ബാക്കി ഇല്ല · ₹0';
const date = value => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value));
const labels = { owed_to_shop: 'കിട്ടാനുള്ള ബാക്കി ചേർത്തു', owed_to_customer: 'കൊടുക്കാനുള്ള ബാക്കി ചേർത്തു', received: 'ബാക്കി പണം ലഭിച്ചു', returned: 'ബാക്കി പണം തിരികെ നൽകി', reversal: 'തിരുത്തൽ രേഖ' };
const buttonSx = { minHeight: 44, textTransform: 'none', borderRadius: 2, fontWeight: 700 };
const pageSx = {
  color: ink, bgcolor: '#fff', border: `1px solid ${divider}`, borderRadius: 3,
  boxShadow: '0 12px 28px rgba(26, 58, 109, 0.08)',
  p: { xs: 2, sm: 3 },
  '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d5deeb' },
  '& .MuiInputLabel-root': { color: muted },
  '& .MuiAlert-root': { borderRadius: 2 },
};
function publicError(error) {
  return error?.publicFeatureError ? 'Notebook unavailable. Check your connection and try again.' : error.message || 'Unable to load balances.';
}
const contactIcons = {
  name: { title: 'Customer name', path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
  card: { title: 'Ration card number', path: 'M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-8h16v8zm0-12v2H4V6h16zM6 12h6v2H6z' },
  mobile: { title: 'Mobile number', path: 'M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z' },
};
function CustomerDetail({ type, value, prominent = false }) {
  const icon = contactIcons[type];
  return <Box component="span" data-testid={'customer-detail-' + type} sx={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr)', alignItems: 'center', columnGap: 0.75, mt: 0.25 }}>
    <SvgIcon titleAccess={icon.title} sx={{ fontSize: 14, color: muted }}><path d={icon.path} /></SvgIcon>
    <Typography component="span" sx={{ minWidth: 0, fontSize: prominent ? 13 : 11, fontWeight: prominent ? 800 : 400, color: prominent ? ink : muted, overflowWrap: 'anywhere' }}>{value}</Typography>
  </Box>;
}
function Pager({ page, total, size, busy, change }) {
  if (total <= size) return null;
  return <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
    <Button disabled={busy || page === 1} onClick={() => change(page - 1)} sx={buttonSx}>Previous</Button>
    <Typography sx={{ fontSize: 12 }}>{page} / {Math.ceil(total / size)}</Typography>
    <Button disabled={busy || page * size >= total} onClick={() => change(page + 1)} sx={buttonSx}>Next</Button>
  </Stack>;
}

export default function CustomerBalanceLedger({ fpsId = '' }) {
  const [input, setInput] = useState('');
  const card = /^[0-9]{10}$/.test(input) ? input : '';
  const [search, setSearch] = useState('');
  const query = search.trim();
  const [showClosed, setShowClosed] = useState(false);
  const listStatus = query ? 'all' : showClosed ? 'closed' : 'open';
  const [listPage, setListPage] = useState(1);
  const [listResult, setListResult] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [listRetry, setListRetry] = useState(0);
  const [selection, setSelection] = useState(0);
  const [detailResult, setDetailResult] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [revision, setRevision] = useState(0);
  const [direction, setDirection] = useState('owed_to_shop');
  const [entryMode, setEntryMode] = useState('balance');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [correction, setCorrection] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [success, setSuccess] = useState('');
  const [settlement, setSettlement] = useState(null);
  const settlementRequest = useRef(null);
  const settlementRead = useRef(null);
  const settlementVersion = useRef(0);
  const pending = useRef(null);
  const savingRef = useRef(false);
  const needsRead = useRef(true);
  const amountInput = useRef(null);
  const listKey = JSON.stringify([query, listPage, listStatus]);
  const detailKey = JSON.stringify([card, selection, historyPage, revision]);
  const list = listResult?.key === listKey ? listResult.data : null;
  const detail = card && detailResult?.key === detailKey ? detailResult.data : null;
  const ready = !!detail && !detailError;
  const balance = detail?.customer?.balance_paise || 0;
  const addKind = direction;
  useEffect(() => () => settlementRead.current?.abort(), []);
  const value = parseAmount(amount);
  const settlementAmount = parseAmount(settlement?.amount);
  const validSettlement = settlementAmount !== null && !!settlement?.balance && settlementAmount <= Math.abs(settlement.balance);


  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setListLoading(true); setListError(''); setListRetry(0);
    const timer = window.setTimeout(async () => {
      try {
        const data = await api('customers', { search: query, page: listPage, status: listStatus }, {
          signal: controller.signal, onRetry: n => { if (!cancelled) setListRetry(n); },
        });
        if (data?.status !== listStatus) throw new Error('Balance list update is not ready. Please contact support.');
        if (!cancelled) setListResult({ key: JSON.stringify([query, listPage, listStatus]), data });
      } catch (err) { if (!cancelled) setListError(publicError(err)); }
      finally { if (!cancelled) setListLoading(false); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [query, listPage, listStatus, revision]);

  useEffect(() => {
    setDetailError(''); needsRead.current = true;
    if (!card) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    api('customer', { card_number: card, page: historyPage }, { signal: controller.signal }).then(data => {
      if (cancelled) return;
      if (!data || !Object.prototype.hasOwnProperty.call(data, 'customer') || !Array.isArray(data.entries)
        || (data.customer !== null && (data.customer.card_number !== card || !Number.isSafeInteger(data.customer.balance_paise)))) {
        throw new Error('Could not verify this balance. Please refresh and try again.');
      }
      setDetailResult({ key: JSON.stringify([card, selection, historyPage, revision]), data });
      setName(data.customer?.customer_name || '');
      setMobile(data.customer?.customer_mobile || '');
      needsRead.current = false;
    }).catch(err => { if (!cancelled) setDetailError(publicError(err)); });
    return () => { cancelled = true; controller.abort(); };
  }, [card, selection, historyPage, revision]);

  function selectCard(number, focusAmount = false) {
    if (savingRef.current) return;
    const next = number.replace(/[^0-9]/g, '').slice(0, 10);
    setInput(next); setSelection(v => v + 1); setHistoryPage(1); setShowHistory(false);
    setDetailResult(null); setDetailError(''); needsRead.current = true;
    setAmount(''); setName(''); setMobile(''); setDirection('owed_to_shop'); setEntryMode('balance');
    setCorrection(null); setReason(''); setSaveError(null); setSuccess('');
    pending.current = null;
    if (focusAmount) window.requestAnimationFrame(() => amountInput.current?.focus());
  }
  async function commit(path, payload, scope) {
    if (savingRef.current || needsRead.current) return;
    const fingerprint = JSON.stringify({ path, payload });
    if (!pending.current || pending.current.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() };
    savingRef.current = true; setSaving(true); setSaveError(null);
    try {
      const result = await api(path, { ...payload, request_id: pending.current.id });
      if (!result?.ok || !Number.isSafeInteger(result.balance_paise)) throw new Error('Could not confirm this save. Retry the same action without changing the details.');
      needsRead.current = true;
      pending.current = null; setCorrection(null); setReason(''); setAmount('');
      setDirection('owed_to_shop'); setEntryMode('balance');
      setSuccess('രേഖപ്പെടുത്തി · …' + payload.card_number.slice(-4));
      setHistoryPage(1); setListPage(1); setRevision(v => v + 1);
    } catch (err) {
      setSaveError({ scope, message: publicError(err) + ' If the connection failed, retry here with the same details. Before starting another entry, refresh and check history.' });
    } finally { savingRef.current = false; setSaving(false); }
  }
  function record(payment) {
    if (savingRef.current || needsRead.current) return;
    const fail = message => setSaveError({ scope: 'entry', message });
    if (!card || !ready) { fail('Wait until the card balance is verified.'); return; }
    if (mobile && !/^[6-9][0-9]{9}$/.test(mobile)) { fail('Enter a valid 10-digit mobile number, or leave it blank.'); return; }
    if (value === null) { fail('Enter an amount between ₹0.01 and ₹1,00,000, with up to two decimal places.'); return; }
    if (payment && (balance === 0 || value > Math.abs(balance))) {
      fail('The payment cannot exceed the remaining balance.'); return;
    }
    commit('entries', { card_number: card, customer_name: name.trim(), customer_mobile: mobile,
      kind: payment ? (balance < 0 ? 'returned' : 'received') : addKind,
      amount_paise: value, note: '' }, 'entry');
  }
  function reverse(event, entry) {
    event.preventDefault();
    if (!ready || savingRef.current || needsRead.current) return;
    if (reason.trim().length < 3) { setSaveError({ scope: 'correction', message: 'Please write a short reason for correction.' }); return; }
    commit('reverse', { card_number: card, entry_id: entry.id, reason: reason.trim() }, 'correction');
  }
  function startPayment() {
    if (savingRef.current || needsRead.current || !ready || balance === 0) return;
    setEntryMode('payment'); setAmount((Math.abs(balance) / 100).toFixed(2)); setSaveError(null);
    window.requestAnimationFrame(() => amountInput.current?.focus());
  }
  function startBalance() {
    if (savingRef.current) return;
    setEntryMode('balance'); setAmount(''); setSaveError(null);
  }

  function closeSettlement() {
    if (savingRef.current) return;
    settlementVersion.current += 1;
    settlementRead.current?.abort();
    settlementRequest.current = null;
    setSettlement(null);
  }
  async function readSettlement(number) {
    settlementRead.current?.abort();
    const controller = new AbortController();
    settlementRead.current = controller;
    const data = await api('customer', { card_number: number, page: 1 }, { signal: controller.signal });
    if (controller.signal.aborted) throw new Error('Cancelled');
    if (data?.customer?.card_number !== number || !Number.isSafeInteger(data.customer.balance_paise)) {
      throw new Error('Could not verify this balance. Please try again.');
    }
    return data.customer.balance_paise;
  }
  async function openSettlement(number) {
    if (savingRef.current) return;
    const version = ++settlementVersion.current;
    settlementRequest.current = null;
    setSettlement({ card: number, balance: null, amount: '', loading: true, error: '' });
    try {
      const current = await readSettlement(number);
      if (version === settlementVersion.current) setSettlement({ card: number, balance: current, amount: (Math.abs(current) / 100).toFixed(2), loading: false, error: '' });
    } catch (err) {
      if (version === settlementVersion.current && !settlementRead.current?.signal.aborted) setSettlement({ card: number, balance: null, loading: false, error: publicError(err) });
    }
  }
  async function confirmSettlement() {
    if (savingRef.current || !settlement || settlement.loading || !validSettlement) return;
    savingRef.current = true; setSaving(true);
    setSettlement(s => ({ ...s, error: '' }));
    try {
      // Recheck before the first write. Ambiguous write retries must reuse the exact payload and UUID.
      if (!settlementRequest.current) {
        const current = await readSettlement(settlement.card);
        if (current !== settlement.balance) {
          setSettlement(s => ({ ...s, balance: current, amount: (Math.abs(current) / 100).toFixed(2), error: 'ബാക്കി മാറിയിട്ടുണ്ട്. പുതിയ തുക പരിശോധിച്ച് വീണ്ടും ഉറപ്പാക്കുക.' }));
          return;
        }
        settlementRequest.current = { card_number: settlement.card, customer_name: '', note: '',
          kind: current < 0 ? 'returned' : 'received', amount_paise: settlementAmount, request_id: crypto.randomUUID() };
      }
      const result = await api('entries', settlementRequest.current);
      if (!result?.ok || !Number.isSafeInteger(result.balance_paise)) throw new Error('Could not confirm this save. Retry here with the same details.');
      settlementRequest.current = null;
      setSettlement(null);
      needsRead.current = true;
      setSuccess('രേഖപ്പെടുത്തി · …' + settlement.card.slice(-4));
      setListPage(1);
      setRevision(v => v + 1);
    } catch (err) {
      setSettlement(s => ({ ...s, error: publicError(err) + ' Retry here. If unsure, cancel and refresh the balance before trying again.' }));
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <Box data-testid="balance-notebook" sx={{ mb: 3 }}>
    <Box sx={pageSx}>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 800, mb: 1.5 }}>{entryMode === 'payment' ? 'ബാക്കി തീർക്കുക' : 'ബാക്കി ചേർക്കുക'}</Typography>
      <Stack component="form" onSubmit={event => { event.preventDefault(); record(entryMode === 'payment'); }} spacing={1.5} data-testid="ledger-task-form">
        <TextField name="ledger-card" label="റേഷൻ കാർഡ് നമ്പർ" value={input} onChange={e => selectCard(e.target.value)}
          required disabled={saving} inputProps={{ inputMode: 'numeric', pattern: '[0-9]{10}', maxLength: 10 }} size="small" sx={{ bgcolor: '#fff' }} />
        <TextField name="ledger-name" label="പേര് (വേണമെങ്കിൽ)" value={name}
          onChange={e => setName(e.target.value)} disabled={saving || !ready} size="small"
          inputProps={{ maxLength: 80, readOnly: !!detail?.customer?.customer_name }} />
        <TextField name="ledger-mobile" label="മൊബൈൽ നമ്പർ (വേണമെങ്കിൽ)" value={mobile}
          onChange={e => setMobile(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} disabled={saving || !ready}
          size="small" type="tel" inputProps={{ maxLength: 10, inputMode: 'tel', pattern: '[6-9][0-9]{9}', readOnly: !!detail?.customer?.customer_mobile }} />
        {card && <Box>
          {!ready && !detailError && <Typography role="status" sx={{ fontSize: 12 }}>ബാക്കി പരിശോധിക്കുന്നു…</Typography>}
          {detailError && <Alert severity="warning" action={<Button type="button" disabled={saving} onClick={() => setRevision(v => v + 1)}>Retry</Button>}>{detailError}</Alert>}
          {ready && <>
            <Typography data-testid="customer-balance" sx={{ fontSize: 20, fontWeight: 800 }}>{balanceText(balance)}</Typography>
            {!detail.customer && <Typography sx={{ fontSize: 11, color: muted }}>പുതിയ കണക്ക്</Typography>}
          </>}
        </Box>}
        <TextField inputRef={amountInput} name="ledger-amount" required label="തുക ₹" value={amount} onChange={e => { setAmount(e.target.value); setSaveError(null); }}
          disabled={saving} inputProps={{ inputMode: 'decimal', maxLength: 9 }} sx={{ bgcolor: '#fff' }} />
        {entryMode === 'balance' ? <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.75 }}>ബാക്കി തരം</Typography>
          <RadioGroup row name="ledger-direction" aria-label="ബാക്കി തരം" value={direction} onChange={e => { setDirection(e.target.value); setSaveError(null); }} sx={{ gap: 1, flexWrap: 'nowrap' }}>
            <FormControlLabel value="owed_to_shop" disabled={saving} label="കിട്ടാൻ"
              control={<Radio size="small" inputProps={{ 'data-testid': 'choose-receivable', 'aria-label': 'കിട്ടാനുള്ളത്' }} sx={{ p: 0.5, color: primary, '&.Mui-checked': { color: primary } }} />}
              sx={{ flex: 1, m: 0, minWidth: 0, minHeight: 64, px: 0.5, py: 0.5, flexDirection: 'column', justifyContent: 'center', border: direction === 'owed_to_shop' ? `1px solid ${primary}` : '1px solid #d5deeb', borderRadius: 1.5, bgcolor: direction === 'owed_to_shop' ? '#edf5ff' : '#fff', '& .MuiFormControlLabel-label': { fontSize: 13, fontWeight: 700, textAlign: 'center', maxWidth: '100%', overflowWrap: 'anywhere', lineHeight: 1.5 } }} />
            <FormControlLabel value="owed_to_customer" disabled={saving} label="കൊടുക്കാൻ"
              control={<Radio size="small" inputProps={{ 'data-testid': 'choose-payable', 'aria-label': 'കൊടുക്കാനുള്ളത്' }} sx={{ p: 0.5, color: primary, '&.Mui-checked': { color: primary } }} />}
              sx={{ flex: 1, m: 0, minWidth: 0, minHeight: 64, px: 0.5, py: 0.5, flexDirection: 'column', justifyContent: 'center', border: direction === 'owed_to_customer' ? `1px solid ${primary}` : '1px solid #d5deeb', borderRadius: 1.5, bgcolor: direction === 'owed_to_customer' ? '#edf5ff' : '#fff', '& .MuiFormControlLabel-label': { fontSize: 13, fontWeight: 700, textAlign: 'center', maxWidth: '100%', overflowWrap: 'anywhere', lineHeight: 1.5 } }} />
          </RadioGroup>
          <Typography sx={{ fontSize: 11, color: muted, mt: 0.75 }}>{direction === 'owed_to_shop' ? 'ഉപഭോക്താവ് കടയ്ക്ക് നൽകാനുള്ള തുക' : 'കടയിൽ നിന്ന് ഉപഭോക്താവിന് നൽകാനുള്ള തുക'}</Typography>
        </Box> : <Alert severity="info">{balance < 0 ? 'തിരികെ നൽകിയ തുക മാത്രം രേഖപ്പെടുത്തുക.' : 'ലഭിച്ച തുക മാത്രം രേഖപ്പെടുത്തുക.'} Partial payments are allowed.</Alert>}
        {saveError?.scope === 'entry' && <Alert severity="error">{saveError.message}</Alert>}
        <Button type="submit" data-testid="record-save" disabled={saving || !ready} variant="contained"
          sx={{ ...buttonSx, bgcolor: primary, minHeight: 48 }}>{saving ? 'രേഖപ്പെടുത്തുന്നു…' : entryMode === 'payment' ? (balance < 0 ? 'തിരികെ നൽകി · സേവ്' : 'പണം ലഭിച്ചു · സേവ്') : 'സേവ് ചെയ്യുക'}</Button>
        {success && <Alert severity="success" role="status">{success}</Alert>}
        {card && ready && balance !== 0 && <Button type="button" data-testid="open-payment" disabled={saving}
          onClick={entryMode === 'payment' ? startBalance : startPayment}
          sx={{ ...buttonSx, color: ink, border: `1px solid ${divider}`, fontSize: 12 }}>
          {entryMode === 'payment' ? 'പുതിയ ബാക്കി ചേർക്കുക' : balance < 0 ? 'പണം തിരികെ നൽകിയോ? രേഖപ്പെടുത്തുക' : 'പണം ലഭിച്ചോ? രേഖപ്പെടുത്തുക'}
        </Button>}
        {card && <Stack direction="row" justifyContent="space-between" sx={{ flexWrap: 'wrap' }}>
          <Button type="button" disabled={saving || !ready || !detail.customer} aria-expanded={showHistory}
            onClick={() => { setShowHistory(v => !v); setCorrection(null); }} sx={{ ...buttonSx, color: ink, fontSize: 12 }}>പഴയ കണക്ക്</Button>
          <Button type="button" disabled={saving} onClick={() => selectCard('')} sx={{ ...buttonSx, color: ink, fontSize: 12 }}>അടുത്ത കാർഡ്</Button>
        </Stack>}
      </Stack>

      {showHistory && ready && <Box data-testid="inline-history" sx={{ mt: 1.5, pt: 1, borderTop: `1px solid ${divider}` }}>
        <Typography sx={{ fontSize: 10, color: muted }}>Newest first · IST</Typography>
        {detail.entries.map(entry => <Box key={entry.id} data-testid={'ledger-entry-' + entry.id} sx={{ py: 1.25, borderBottom: `1px solid ${divider}` }}>
          <Typography sx={{ fontSize: 10, color: muted }}>{date(entry.created_at)}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{labels[entry.kind]} · {money(entry.amount_paise)}</Typography>
          {entry.note && <Typography sx={{ fontSize: 11, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{entry.note}</Typography>}
          <Typography sx={{ fontSize: 11 }}>ശേഷം: {balanceText(entry.balance_after_paise)}</Typography>
          {entry.reversed ? <Typography sx={{ fontSize: 10 }}>തിരുത്തിയ രേഖ · Original retained</Typography> : entry.kind !== 'reversal' && <>
            {correction !== entry.id ? <Button type="button" disabled={saving} onClick={() => { setCorrection(entry.id); setReason(''); setSaveError(null); pending.current = null; }}
              sx={{ ...buttonSx, minHeight: 36, p: 0, fontSize: 11, color: primary }}>തിരുത്തുക</Button> :
              <Stack component="form" onSubmit={event => reverse(event, entry)} spacing={1} sx={{ my: 1 }}>
                <Typography sx={{ fontSize: 11 }}>Adds an opposite entry; keeps the original.</Typography>
                <TextField name="ledger-correction-reason" size="small" label="തിരുത്താനുള്ള കാരണം" required value={reason} onChange={e => setReason(e.target.value)} disabled={saving} inputProps={{ maxLength: 200 }} />
                {saveError?.scope === 'correction' && <Alert severity="error">{saveError.message}</Alert>}
                <Stack direction="row" spacing={1}><Button type="submit" disabled={saving} variant="contained" sx={{ ...buttonSx, bgcolor: primary, fontSize: 11 }}>തിരുത്തൽ സേവ്</Button>
                  <Button type="button" disabled={saving} onClick={() => setCorrection(null)} sx={buttonSx}>Cancel</Button></Stack>
              </Stack>}
          </>}
        </Box>)}
        <Pager page={historyPage} total={detail.total} size={30} busy={saving} change={page => { needsRead.current = true; setHistoryPage(page); setCorrection(null); }} />
      </Box>}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', columnGap: 1,
        mt: 2, pt: 1.25, borderTop: `1px solid ${divider}` }}>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 800 }}>{query ? 'തിരച്ചിൽ ഫലങ്ങൾ' : showClosed ? 'തീർന്ന കാർഡുകൾ' : 'ബാക്കിയുള്ള കാർഡുകൾ'}</Typography>
        <Button type="button" disabled={saving || listLoading} onClick={() => { needsRead.current = true; setRevision(v => v + 1); }} sx={{ ...buttonSx, minWidth: 0, px: 0.5, color: ink, fontSize: 11 }}>Refresh</Button>
        {!query && <Button type="button" data-testid="toggle-closed" disabled={saving}
          onClick={() => { setShowClosed(v => !v); setListPage(1); }}
          sx={{ ...buttonSx, gridColumn: '1 / -1', justifySelf: 'start', justifyContent: 'flex-start', textAlign: 'left', minWidth: 0, px: 0, fontSize: 12 }}>
          {showClosed ? 'ബാക്കിയുള്ളവ കാണുക' : 'തീർന്നവ കാണുക'}
        </Button>}
      </Box>
      <TextField fullWidth name="ledger-search" label="കാർഡ് / പേര് / മൊബൈൽ തിരയുക" value={search}
        onChange={e => { setSearch(e.target.value); setListPage(1); selectCard(''); }} disabled={saving}
        size="small" inputProps={{ maxLength: 80 }} sx={{ bgcolor: '#fff', mt: 1, mb: 1.5 }} />
      {listLoading && <Typography role="status" sx={{ fontSize: 11, color: muted }}>{listRetry ? 'വീണ്ടും ശ്രമിക്കുന്നു… (' + listRetry + '/2)' : 'കാർഡുകൾ പുതുക്കുന്നു…'}</Typography>}
      {listError && <Alert severity="warning" action={<Button type="button" disabled={saving} onClick={() => { needsRead.current = true; setRevision(v => v + 1); }}>Retry</Button>}>
        {list ? 'Saved balances could not be refreshed. Showing the last loaded list; it may be out of date.' : listError}{success ? ' Your entry was saved. Do not enter it again.' : ''}
      </Alert>}
      {listLoading && !list && <CircularProgress size={22} aria-label="Loading notebook" />}
      {list && <Box component="ul" aria-label="Recent customers" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {list.customers?.map(customer => <Box component="li" key={customer.id} data-testid={'customer-row-' + customer.card_number}
          sx={{ border: '1px solid', borderColor: card === customer.card_number ? '#90bdf0' : '#dce5f3', borderRadius: 2,
            bgcolor: card === customer.card_number ? '#edf5ff' : '#fff', mb: 1, p: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="button" type="button" disabled={saving} onClick={() => selectCard(customer.card_number, true)}
            aria-label={'Select card ' + customer.card_number} aria-pressed={card === customer.card_number}
            sx={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 58,
              '@media (max-width: 360px)': { flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 },
              textAlign: 'left', border: 0, background: card === customer.card_number ? '#edf5ff' : 'none', borderRadius: 2, '&:hover': { bgcolor: '#f4f8ff' }, color: ink, px: 1, py: 1.25, cursor: 'pointer', '&:focus-visible': { outline: `2px solid ${primary}` } }}>
            <Box component="span" sx={{ minWidth: 0 }}>
              {customer.customer_name && <CustomerDetail type="name" value={customer.customer_name} prominent />}
              <CustomerDetail type="card" value={customer.card_number} prominent={!customer.customer_name} />
              {customer.customer_mobile && <CustomerDetail type="mobile" value={customer.customer_mobile} />}
            </Box>
            <Box component="span" sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography component="span" sx={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{money(customer.balance_paise)}</Typography>
              <Typography component="span" sx={{ display: 'block', fontSize: 10 }}>{customer.balance_paise > 0 ? 'കിട്ടാനുണ്ട്' : customer.balance_paise < 0 ? 'കൊടുക്കാനുണ്ട്' : 'തീർന്നു'}</Typography>
              {(listLoading || listError) && <Typography component="span" sx={{ display: 'block', fontSize: 9 }}>Last loaded</Typography>}
            </Box>
          </Box>
          {customer.balance_paise !== 0 && <Button type="button" variant="outlined" data-testid={'settle-' + customer.card_number}
            disabled={saving || listLoading || !!listError} onClick={() => openSettlement(customer.card_number)}
            sx={{ ...buttonSx, flex: '0 0 112px', width: 112, minWidth: 112, height: 48, minHeight: 48, px: 0.75,
              fontSize: 11, lineHeight: 1.4, whiteSpace: 'normal', textAlign: 'center', overflowWrap: 'anywhere',
              borderColor: '#90bdf0', bgcolor: '#fff', '&:hover': { borderColor: primary, bgcolor: '#f0f6ff' } }}>{customer.balance_paise < 0 ? 'തിരികെ നൽകി' : 'പണം ലഭിച്ചു'}</Button>}
        </Box>)}
        {!list.customers?.length && !listLoading && !listError && <Typography component="li" sx={{ py: 2, fontSize: 12, color: muted }}>{query ? 'ഇവിടെ കാർഡുകൾ കണ്ടെത്തിയില്ല.' : showClosed ? 'തീർന്ന കാർഡുകൾ ഇല്ല.' : 'ബാക്കിയുള്ള കാർഡുകൾ ഇല്ല.'}</Typography>}
      </Box>}
      {list && <Pager page={listPage} total={list.total || 0} size={20} busy={listLoading || saving} change={setListPage} />}
    </Box>
    <Dialog open={!!settlement} onClose={closeSettlement} fullWidth maxWidth="xs" aria-labelledby="settlement-title">
      <DialogTitle id="settlement-title" sx={{ fontSize: 18, fontWeight: 700 }}>{settlement?.balance < 0 ? 'പണം തിരികെ നൽകിയത്' : 'പണം ലഭിച്ചത്'}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1, fontSize: 13 }}>കാർഡ്: {settlement?.card}</Typography>
        {settlement?.loading ? <Typography role="status">ബാക്കി പരിശോധിക്കുന്നു…</Typography> : settlement?.balance === 0 ?
          <Typography>ബാക്കി ഇല്ല · തീർന്നു</Typography> : settlement?.balance != null && <>
            <Typography data-testid="settlement-question" sx={{ fontWeight: 700 }}>{balanceText(settlement.balance)}</Typography>
            <TextField fullWidth name="settlement-amount" label={settlement.balance < 0 ? 'തിരികെ നൽകിയ തുക ₹' : 'ലഭിച്ച തുക ₹'}
              value={settlement.amount || ''} disabled={saving || !!settlementRequest.current}
              onChange={event => setSettlement(s => ({ ...s, amount: event.target.value, error: '' }))}
              inputProps={{ inputMode: 'decimal', maxLength: 9 }} sx={{ mt: 2, mb: 1.5 }}
              error={!!settlement.amount && !validSettlement}
              helperText={!!settlement.amount && !validSettlement ? 'ബാക്കിയേക്കാൾ കൂടാത്ത തുക നൽകുക (₹0.01–₹1,00,000).' : ''} />
            <Typography data-testid="settlement-remaining" sx={{ fontWeight: 700 }}>
              ശേഷിക്കുന്ന ബാക്കി: {validSettlement ? money(Math.abs(settlement.balance) - settlementAmount) : '—'}
            </Typography>
          </>}
        {settlement?.error && <Alert severity="warning" sx={{ mt: 1 }}>{settlement.error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2, flexWrap: 'wrap' }}>
        <Button disabled={saving} onClick={closeSettlement} sx={buttonSx}>വേണ്ട</Button>
        {settlement?.balance == null && !settlement?.loading ? <Button onClick={() => openSettlement(settlement.card)} sx={buttonSx}>Retry</Button> :
          <Button data-testid="confirm-settlement" variant="contained" onClick={confirmSettlement}
            disabled={saving || settlement?.loading || !validSettlement} sx={buttonSx}>
            {saving ? 'രേഖപ്പെടുത്തുന്നു…' : 'രേഖപ്പെടുത്തുക'}
          </Button>}
      </DialogActions>
    </Dialog>
    <Typography sx={{ mt: 2, px: 1, color: muted, fontSize: 10, lineHeight: 1.8 }}>{fpsId && 'FPS ' + fpsId + ' · '}നിങ്ങളുടെ അക്കൗണ്ടിന്റെ സ്വകാര്യ കണക്ക് · ഇന്റർനെറ്റ് ആവശ്യമാണ്.</Typography>
  </Box>;
}
