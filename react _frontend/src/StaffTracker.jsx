import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { featureFetch } from './accountApi';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0) / 100);
const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const statuses = [['present', 'Present'], ['half_day', 'Half-day'], ['absent', 'Absent'], ['paid_leave', 'Paid leave']];
const cycleLabel = { daily: 'day', weekly: 'week', monthly: 'month' };
const dateLabel = value => new Date(value + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const monthShift = (day, offset) => { const d = new Date(day.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + offset); return d.toISOString().slice(0, 10); };
const calendarStatus = {
  present: { code: 'P', label: 'Present', bg: '#e2f5e9', color: '#216b43' },
  absent: { code: 'A', label: 'Absent', bg: '#ffe7e5', color: '#a52d2d' },
  half_day: { code: '½', label: 'Half-day', bg: '#fff0cc', color: '#805600' },
  paid_leave: { code: 'L', label: 'Paid leave', bg: '#e4eeff', color: '#245ba2' },
  holiday_work: { code: 'W', label: 'Holiday worked', bg: '#dbf2f0', color: '#206b66' },
};
function amountPaise(text) {
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const value = Math.round(Number(text) * 100);
  return Number.isSafeInteger(value) && value > 0 && value <= 100000000 ? value : null;
}

async function request(path, body, signal) {
  const response = await featureFetch('/staff/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal,
  });
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Salesman service returned an invalid response. Please refresh and try again.');
  }
  if (!response.ok) {
    const error = new Error(typeof data.detail === 'string' ? data.detail : 'Please check the details.');
    error.status = response.status;
    throw error;
  }
  if ((path === 'report' && (!Array.isArray(data.staff) || typeof data.today !== 'string'))
    || (path !== 'report' && data.ok !== true)) {
    throw new Error('Salesman service returned an invalid response. Please refresh and try again.');
  }
  return data;
}

export default function StaffTracker() {
  const [today, setToday] = useState(localToday);
  const [day, setDay] = useState(localToday);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', rate: '', start_date: localToday() });
  const [expanded, setExpanded] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [moreAttendance, setMoreAttendance] = useState(null);
  const [payment, setPayment] = useState(null);
  const [holiday, setHoliday] = useState(null);
  const [voidId, setVoidId] = useState(null);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const operation = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setStaff([]); setError(''); setPayment(null); setHoliday(null); setVoidId(null);
    setEditingAttendance(null); setMoreAttendance(null);
    request('report', { day }, controller.signal).then(data => {
      if (!controller.signal.aborted) { setStaff(data.staff); setToday(data.today); }
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.publicFeatureError ? 'Unable to load salesman records. Please retry.' : err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [day, refresh]);

  // On an uncertain response, retain the exact UUID and payload for manual retry.
  async function save(op) {
    if (operation.current && operation.current !== op) return;
    operation.current = op; setPending(op); setSaving(true); setError(''); setNotice('');
    try {
      const result = await request(op.path, op.body);
      if (!mounted.current) return;
      operation.current = null; setPending(null);
      setPayment(null); setHoliday(null); setVoidId(null);
      if (op.path === 'create') { setAdding(false); setSelectedStaff(result.staff_id || null); setDraft({ name: '', rate: '', start_date: today }); }
      setNotice(op.path === 'attendance' ? '' : 'Saved successfully.'); setRefresh(v => v + 1);
    } catch (err) {
      if (!mounted.current) return;
      if (err.status >= 400 && err.status < 500) {
        operation.current = null; setPending(null);
        setError(err.message);
      } else {
        setError('Save could not be confirmed. Retry this same save before making another change.');
      }
    } finally { if (mounted.current) setSaving(false); }
  }
  function mutate(path, person, values) {
    if (operation.current || loading) return;
    save({ path, body: { ...values, staff_id: person.id, expected_revision: person.revision, request_id: crypto.randomUUID() } });
  }
  const blocked = loading || !!pending;
  const sunday = new Date(day + 'T12:00:00Z').getUTCDay() === 0;
  const field = { size: 'small', fullWidth: true };
  const activeStaff = staff.find(person => person.id === selectedStaff) || staff[0];
  return <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 3 }, border: '1px solid #e4eaf4', borderRadius: 3,
    '& .MuiButton-root': { textTransform: 'none' } }}>
    <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={1}>
      <Button aria-label="Refresh" title="Refresh" sx={{ minWidth: 36, minHeight: 40 }} disabled={blocked} onClick={() => setRefresh(v => v + 1)}>↻</Button>
      <Button variant="outlined" size="small" aria-label="+ Add salesman" sx={{ flexShrink: 0, borderRadius: 2, minHeight: 44 }} disabled={blocked} onClick={() => setAdding(v => !v)}>+ Add salesman</Button>
    </Stack>
    <Typography lang="ml" sx={{ mt: 0.75, color: '#536780', fontSize: 13 }}>ഹാജർ ചേർക്കാനോ തിരുത്താനോ കലണ്ടറിലെ തീയതി അമർത്തുക.</Typography>
    {!!staff.length && <TextField {...field} select label="Salesman" value={activeStaff?.id || ''} disabled={blocked} sx={{ mt: 2 }}
      SelectProps={{ native: true }} onChange={e => { setSelectedStaff(e.target.value); setPayment(null); setExpanded(null); setEditingAttendance(null); setMoreAttendance(null); setHoliday(null); }}>
      {staff.map(person => <option key={person.id} value={person.id}>{person.name} · {money(person.rate_paise)} / {cycleLabel[person.pay_cycle]}</option>)}
    </TextField>}
    {notice && <Alert severity="success" sx={{ mt: 2 }}>{notice}</Alert>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}
      {pending && <Button disabled={saving} onClick={() => save(pending)}>Retry same save</Button>}
    </Alert>}
    {saving && <Typography role="status" sx={{ mt: 1 }}>Saving…</Typography>}
    {adding && <Box component="form" sx={{ mt: 2, p: 2, bgcolor: '#f7faff', borderRadius: 2 }} onSubmit={e => {
      e.preventDefault(); const amount = amountPaise(draft.rate);
      if (!amount) { setError('Enter a valid pay amount, up to ₹10,00,000.'); return; }
      if (!operation.current) save({ path: 'create', body: { name: draft.name.trim(), pay_cycle: 'daily',
        rate_paise: amount, start_date: draft.start_date, request_id: crypto.randomUUID() } });
    }}>
      <Stack gap={1.5}>
        <Typography fontWeight={700}>Add salesman</Typography>
        <TextField {...field} required label="Salesman name" value={draft.name} disabled={blocked} inputProps={{ maxLength: 80 }} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <TextField {...field} required label="Daily wage (₹)" value={draft.rate} disabled={blocked} inputProps={{ inputMode: 'decimal' }} onChange={e => setDraft({ ...draft, rate: e.target.value })} />
        <TextField {...field} required type="date" label="Start date" value={draft.start_date} disabled={blocked} InputLabelProps={{ shrink: true }} inputProps={{ min: '2020-01-01', max: today }} onChange={e => setDraft({ ...draft, start_date: e.target.value })} />
        <Stack direction="row" gap={1}>
          <Button fullWidth variant="contained" disableElevation type="submit" sx={{ minHeight: 42 }} disabled={blocked}>Save salesman</Button>
          <Button variant="outlined" sx={{ minHeight: 42, minWidth: 90 }} disabled={blocked} onClick={() => setAdding(false)}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>}
    {loading ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={28} aria-label="Loading salesman" /></Box>
      : !error && !staff.length && <Box sx={{ py: 4, textAlign: 'center' }}><Typography fontWeight={800}>No salesman added yet.</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Start with + Add salesman. Enter their name and daily wage, then mark the days they worked.</Typography><Typography lang="ml" variant="body2" sx={{ mt: 1, color: '#536780' }}>ആദ്യം സെയിൽസ്മാന്റെ പേരും ദിവസക്കൂലിയും ചേർക്കുക.</Typography></Box>}
    <Stack gap={2} sx={{ mt: 2 }}>
      {staff.filter(person => person.id === activeStaff?.id).map(person => {
        const s = person.summary;
        const record = s.attendance.find(a => a.work_date === day);
        const beforeStart = day < person.start_date;
        const editable = !blocked && day >= '2020-01-01' && (person.pay_cycle === 'daily' || !beforeStart) && day <= today;
        const open = expanded === person.id;
        const running = s.balance_scope === 'all_time';
        const historyMonth = new Date(day + 'T12:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
        const changing = !record || editingAttendance === person.id;
        const first = new Date(day.slice(0, 7) + '-01T12:00:00Z');
        const monthDays = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
        const monthCounts = statuses.map(([status, label]) => ({ status, label, count: s.attendance.filter(a => a.work_date.slice(0, 7) === day.slice(0, 7) && a.status === status).length }));
        const events = [...s.attendance.map(a => ({ type: 'attendance', date: a.work_date, entry: a })),
          ...s.payments.map(p => ({ type: 'payment', date: p.paid_on, entry: p }))]
          .sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
        return <Box key={person.id} data-testid="staff-card" sx={{ border: '1px solid #dce6f5', borderRadius: 3, p: { xs: 0.75, sm: 2 }, minWidth: 0, boxShadow: '0 4px 18px rgba(23,44,71,.04)' }}>
          <Box aria-label="Attendance calendar" data-testid="attendance-calendar" sx={{ border: '1px solid #e5ebf4', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff' }}>
            <Box data-testid="calendar-navigation" sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.75, background: 'linear-gradient(110deg,#f0f5ff,#fafcff)', borderBottom: '1px solid #e5ebf4' }}>
              <Button aria-label="Previous month" disabled={blocked || day.slice(0,7) <= '2020-01'} onClick={() => setDay(monthShift(day, -1))} sx={{ minWidth: 32, height: 40, p: 0, lineHeight: 1, fontSize: 24 }}>‹</Button>
              <Box sx={{ position: 'relative', flex: 1, minWidth: 0, borderRadius: 1, '&:focus-within': { outline: '2px solid #2479d8', outlineOffset: 1 } }}>
                <Typography sx={{ py: 1, fontSize: { xs: 14, sm: 18 }, textAlign: 'center', fontWeight: 800, color: '#233e60', whiteSpace: 'nowrap' }}>{historyMonth} <Typography component="span" fontSize={10}>▾</Typography></Typography>
                <Box component="label" htmlFor="salesman-calendar-month" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>Month</Box>
                <Box component="input" id="salesman-calendar-month" type="month" aria-label="Month" title="Choose month" value={day.slice(0,7)}
                  min="2020-01" max={today.slice(0,7)} disabled={blocked}
                  onClick={e => { try { e.currentTarget.showPicker?.(); } catch { /* Native input remains available. */ } }}
                  onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value) && e.target.value >= '2020-01' && e.target.value <= today.slice(0,7)) setDay(e.target.value + '-01'); }}
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: blocked ? 'default' : 'pointer', fontSize: 16, boxSizing: 'border-box' }} />
              </Box>
              <Button aria-label="Next month" disabled={blocked || day.slice(0,7) >= today.slice(0,7)} onClick={() => setDay(monthShift(day, 1))} sx={{ minWidth: 32, height: 40, p: 0, lineHeight: 1, fontSize: 24 }}>›</Button>
              <Button size="small" sx={{ minWidth: 42, minHeight: 40, fontSize: 11 }} disabled={blocked} onClick={() => setDay(today)}>Today</Button>
            </Box>
            <Box sx={{ p: { xs: 0.5, sm: 1.5 }, display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: { xs: 0.25, sm: 0.75 } }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(label => <Typography key={label} sx={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: label === 'Sun' ? '#a88477' : '#8190a5', py: { xs: 0.25, sm: 0.75 } }}>{label}</Typography>)}
              {Array.from({ length: (first.getUTCDay() + 6) % 7 }, (_, index) => <Box key={'blank-' + index} />)}
              {Array.from({ length: monthDays }, (_, index) => {
                const value = day.slice(0,7) + '-' + String(index+1).padStart(2,'0');
                const attendance = s.attendance.find(a => a.work_date === value);
                const off = new Date(value + 'T12:00:00Z').getUTCDay() === 0;
                const future = value > today;
                const notStarted = person.pay_cycle !== 'daily' && value < person.start_date;
                const status = calendarStatus[attendance?.status];
                const label = future ? 'Future date' : notStarted ? 'Not started' : status?.label || (off ? 'Sunday holiday' : 'Not marked');
                return <Button key={value} data-date={value} aria-label={dateLabel(value) + ': ' + label} aria-pressed={value === day} aria-current={value === today ? 'date' : undefined}
                  disabled={blocked || future || notStarted} onClick={() => { setDay(value); setEditingAttendance(null); setMoreAttendance(null); setHoliday(null); }}
                  sx={{ minWidth: 0, minHeight: { xs: 40, sm: 54 }, p: { xs: 0, sm: 0.25 }, borderRadius: { xs: 1.25, sm: 2 },
                    border: value === day ? '2px solid #3b82d6' : '2px solid transparent',
                    boxShadow: value === day ? '0 2px 7px rgba(36,100,175,.15)' : undefined,
                    bgcolor: status?.bg || (off ? '#f4f1ef' : '#f8fafd'), color: status?.color || '#334155',
                    transition: 'background-color .15s, box-shadow .15s',
                    '&:focus-visible': { outline: '2px solid #194c89', outlineOffset: 1 },
                    '&:hover': { bgcolor: status?.bg || '#edf4ff', boxShadow: '0 2px 7px rgba(36,100,175,.12)' }, '&.Mui-disabled': { color: '#b9c2ce', bgcolor: '#fafbfc' } }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                    <Typography component="span" sx={{ display: 'grid', placeItems: 'center', width: { xs: 20, sm: 24 }, height: { xs: 20, sm: 24 }, borderRadius: '50%', fontSize: 13, fontWeight: 700, bgcolor: value === today ? '#285fa5' : undefined, color: value === today ? '#fff' : undefined }}>{index+1}</Typography>
                    <Typography component="span" sx={{ display: 'block', fontSize: { xs: 9, sm: 10 }, lineHeight: 1.2, minHeight: 11, fontWeight: 800, color: status?.color || (off ? '#a18e83' : '#b2bdcb') }}>{status?.code || (off ? 'Off' : '·')}</Typography>
                  </Box>
                </Button>;
              })}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1, pb: 0.5, fontSize: { xs: 10, sm: 12 } }}>Off: Sunday · W: Holiday worked</Typography>
            <Box data-testid="month-attendance-counts" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 0.5, p: { xs: 0.5, sm: 1 }, borderTop: '1px solid #edf0f5' }}>
              {monthCounts.map(item => <Box key={item.status} sx={{ textAlign: 'center', borderRadius: 1.5, py: { xs: 0.25, sm: 0.75 }, bgcolor: calendarStatus[item.status].bg }}><Typography fontWeight={800} sx={{ fontSize: { xs: 16, sm: 18 }, color: calendarStatus[item.status].color }}>{item.count}</Typography><Typography fontSize={10} sx={{ color: calendarStatus[item.status].color }}>{calendarStatus[item.status].code} · {item.label}</Typography></Box>)}
            </Box>
          </Box>
          <Box sx={{ mt: 2, mb: 0.5 }}>
            <Typography fontSize={14} fontWeight={800}>Attendance · {day === today ? 'Today' : dateLabel(day)}{!record && !sunday ? ' · Not marked' : ''}</Typography>
          </Box>
          {record && <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: 1.5, pl: 1.5, pr: 0.5, py: 0.5, borderRadius: 1.5,
            bgcolor: record.status === 'absent' ? '#fff2ed' : '#edf8f1', color: record.status === 'absent' ? '#a13d20' : '#216b43' }}>
            <Typography role="status" fontSize={14} fontWeight={700}>{record.status === 'absent' ? '—' : '✓'} {statuses.find(([v]) => v === record.status)?.[1] || 'Holiday worked'}</Typography>
            <Button size="small" color="inherit" disabled={!editable} onClick={() => { setEditingAttendance(changing ? null : person.id); setMoreAttendance(null); setHoliday(null); }}>{changing ? 'Done' : 'Change'}</Button>
          </Stack>}
          {changing && (sunday ? <Box sx={{ mt: 1.5 }}>
            <Box sx={{ bgcolor: '#f4f7fc', borderRadius: 2, p: 1.5 }}><Typography variant="body2" fontWeight={700}>Sunday holiday</Typography>
            <Button size="small" variant="outlined" sx={{ mt: 1, minHeight: 40 }} disabled={!editable} onClick={() => setHoliday({ staff_id: person.id, amount: record ? String(record.extra_paise / 100) : '' })}>Worked today?</Button></Box>
            {holiday?.staff_id === person.id && <Box component="form" sx={{ mt: 1 }} onSubmit={e => {
              e.preventDefault(); const amount = amountPaise(holiday.amount);
              if (!amount) { setError('Enter the agreed extra pay.'); return; }
              mutate('attendance', person, { work_date: day, status: 'holiday_work', extra_paise: amount });
            }}><TextField {...field} required label="Extra pay (₹)" value={holiday.amount} disabled={blocked} inputProps={{ inputMode: 'decimal' }} onChange={e => setHoliday({ ...holiday, amount: e.target.value })} />
              <Button type="submit" disabled={blocked}>Save holiday work</Button><Button disabled={blocked} onClick={() => setHoliday(null)}>Cancel</Button></Box>}
          </Box> : <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[['present', '✓ Present'], ['absent', 'Absent']].map(([value, label]) => <Button key={value} size="small" sx={{ minHeight: 42,
              ...(value === 'present' ? { bgcolor: '#edf8f1', color: '#216b43', borderColor: '#b8d8c4', '&:hover': { bgcolor: '#dcefe3', borderColor: '#216b43' } } : {}) }}
              variant="outlined" aria-pressed={record?.status === value}
              aria-label={label} disabled={!editable || record?.status === value} onClick={() => mutate('attendance', person, { work_date: day, status: value, extra_paise: 0 })}>{label}</Button>)}
          </Box>)}
          {changing && (!sunday || record) && <Box>
            <Button size="small" aria-label="More" disabled={!editable} aria-expanded={moreAttendance === person.id} onClick={() => setMoreAttendance(moreAttendance === person.id ? null : person.id)}>More options {moreAttendance === person.id ? '⌃' : '⌄'}</Button>
            {moreAttendance === person.id && <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {!sunday && statuses.filter(([v]) => ['half_day', 'paid_leave'].includes(v)).map(([value, label]) => <Button key={value} size="small" variant="outlined" disabled={!editable || record?.status === value}
                onClick={() => mutate('attendance', person, { work_date: day, status: value, extra_paise: 0 })}>{label}</Button>)}
              {record && <Button size="small" disabled={!editable} onClick={() => mutate('attendance', person, { work_date: day, status: 'unmarked', extra_paise: 0 })}>Clear attendance</Button>}
            </Stack>}
          </Box>}
          <Divider sx={{ my: 1.5 }} />
          <Typography lang="ml" fontSize={14} fontWeight={800} sx={{ mb: 0.5 }}>കൂലിയും നൽകിയ തുകയും</Typography>
          <Typography lang="ml" variant="caption" color="text.secondary">{running ? `${dateLabel(s.as_of)} വരെ രേഖപ്പെടുത്തിയ കണക്ക്` : `${dateLabel(s.period_start)} – ${dateLabel(s.period_end)}`}</Typography>
          <Box data-testid="staff-money-summary" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gridTemplateRows: 'auto auto', bgcolor: '#f5f8fd', borderRadius: 2, mt: 1, overflow: 'hidden' }}>
            {[['ആകെ കൂലി', s.earned_paise], ['നൽകിയത്', s.paid_paise], [s.balance_paise < 0 ? 'അധികം നൽകിയത്' : 'നൽകാനുള്ളത്', Math.abs(s.balance_paise)]].map(([label, value], i) =>
              <Box key={label} sx={{ display: 'grid', gridTemplateRows: 'subgrid', gridRow: 'span 2', px: { xs: 1, sm: 1.5 }, py: 1.5, rowGap: 0.5, minWidth: 0, bgcolor: i === 2 ? '#e9f2ff' : undefined, borderRight: i < 2 ? '1px solid #e3eaf5' : undefined }}>
                <Typography lang="ml" sx={{ fontSize: 12, color: i === 2 ? '#1c539a' : '#64748b', lineHeight: 1.8 }}>{label}</Typography>
                <Typography sx={{ fontSize: { xs: 15, sm: 19 }, fontWeight: 800, color: i === 2 ? '#174a8b' : '#172c47', overflowWrap: 'anywhere', alignSelf: 'start', fontVariantNumeric: 'tabular-nums' }}>{money(value)}</Typography>
              </Box>)}
          </Box>
            {payment?.staff_id !== person.id && <Button fullWidth variant="contained" aria-label="Record payment" disableElevation sx={{ minHeight: 48, mt: 1.5, borderRadius: 2 }} disabled={blocked || s.period_start > today || s.period_end < person.start_date} onClick={() => {
              setExpanded(null); setPayment({ staff_id: person.id, kind: s.balance_paise > 0 ? 'salary' : 'advance', amount: s.balance_paise > 0 ? String(s.balance_paise / 100) : '', paid_on: today, note: '' });
            }}>Record payment</Button>}
            {payment?.staff_id === person.id && <Box component="form" sx={{ mt: 2, p: 1.5, bgcolor: '#f7faff', borderRadius: 2 }} onSubmit={e => {
              e.preventDefault(); const amount = amountPaise(payment.amount);
              if (!amount) { setError('Enter a valid payment amount.'); return; }
              mutate('payment', person, { period_start: running ? payment.paid_on : s.period_start, paid_on: payment.paid_on, kind: payment.kind, amount_paise: amount, note: payment.note.trim() });
            }}><Stack gap={1.5}>
              <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                <Typography lang="ml" fontWeight={800} fontSize={14}>നൽകിയ തുക ചേർക്കുക</Typography>
                <Typography lang="ml" variant="caption" color="text.secondary">നൽകാനുള്ളത്: {money(Math.max(0, s.balance_paise))}</Typography>
              </Stack>
              <TextField {...field} required label="Amount paid (₹)" value={payment.amount} disabled={blocked} inputProps={{ inputMode: 'decimal' }} onChange={e => setPayment({ ...payment, amount: e.target.value })} />
              <TextField {...field} required type="date" label="Paid on" value={payment.paid_on} disabled={blocked} InputLabelProps={{ shrink: true }} inputProps={{ min: person.start_date, max: today }} onChange={e => setPayment({ ...payment, paid_on: e.target.value })} />
              {(amountPaise(payment.amount) || 0) > Math.max(0, s.balance_paise) && <Alert severity="info">This includes pay in advance. Paid-ahead amount: {money((amountPaise(payment.amount) || 0) - s.balance_paise)}.</Alert>}
              <Stack direction="row" gap={1}>
                <Button fullWidth variant="contained" disableElevation type="submit" sx={{ minHeight: 42 }} disabled={blocked}>Save payment</Button>
                <Button variant="outlined" sx={{ minHeight: 42, minWidth: 90 }} disabled={blocked} onClick={() => setPayment(null)}>Cancel</Button>
              </Stack>
            </Stack></Box>}
          <Button fullWidth size="small" sx={{ mt: 0.5, color: '#64748b', minHeight: 40 }} aria-expanded={open} disabled={!!pending} onClick={() => { setExpanded(open ? null : person.id); setPayment(null); setVoidId(null); }}>{open ? 'Hide history' : 'Attendance & payment history'} {open ? '⌃' : '⌄'}</Button>
          {open && <Stack gap={1} sx={{ mt: 1.5, p: 1.5, bgcolor: '#f7f9fc', borderRadius: 2 }}>
            <Typography lang="ml" fontSize={14} fontWeight={800} sx={{ color: '#233d5d', mb: 0.5 }}>രേഖകൾ · {historyMonth}</Typography>
            {!events.length && <Typography variant="body2" color="text.secondary">No entries in this {running ? 'month' : 'period'}.</Typography>}
            {events.map(({ type, date, entry }) => {
              const isPayment = type === 'payment';
              const amount = isPayment ? entry.amount_paise : entry.status === 'holiday_work' ? entry.extra_paise
                : person.rate_paise * (entry.status === 'half_day' ? 0.5 : ['present', 'paid_leave'].includes(entry.status) ? 1 : 0);
              const label = isPayment ? entry.kind === 'advance' ? 'Advance paid' : 'Payment'
                : statuses.find(([v]) => v === entry.status)?.[1] || 'Holiday worked';
              return <Box key={isPayment ? entry.id : entry.work_date} sx={{ bgcolor: '#fff', border: '1px solid #e5eaf3', borderLeft: `3px solid ${entry.voided ? '#c5ccd6' : isPayment ? '#6799d6' : '#78b595'}`, borderRadius: 1.5, p: 1.25 }}>
                <Stack direction="row" gap={1} justifyContent="space-between" alignItems="flex-start">
                  <Box><Typography variant="caption" color="text.secondary">{dateLabel(date)}</Typography>
                    <Typography fontWeight={700} fontSize={14} sx={{ textDecoration: entry.voided ? 'line-through' : 'none' }}>{label}</Typography></Box>
                  {running && <Typography fontWeight={800} fontSize={14} sx={{ color: entry.voided ? '#64748b' : isPayment ? '#305ea6' : '#216b43', textDecoration: entry.voided ? 'line-through' : 'none', textAlign: 'right', overflowWrap: 'anywhere' }}>{isPayment ? '−' : '+'}{money(amount)}</Typography>}
                </Stack>
                {entry.note && <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{entry.note}</Typography>}
                {!isPayment ? <Button size="small" disabled={blocked} onClick={() => setDay(date)}>Edit attendance</Button>
                  : entry.voided ? <Typography variant="caption">Cancelled</Typography>
                  : voidId === entry.id ? <Box><Typography variant="caption">Cancel this mistaken payment record?</Typography><Button size="small" disabled={blocked} onClick={() => mutate('void-payment', person, { payment_id: entry.id })}>Yes, cancel record</Button><Button size="small" disabled={blocked} onClick={() => setVoidId(null)}>Keep</Button></Box>
                  : <Button size="small" disabled={blocked} onClick={() => setVoidId(entry.id)}>Correct mistake</Button>}
              </Box>;
            })}
          </Stack>}
        </Box>;
      })}
    </Stack>
  </Paper>;
}
