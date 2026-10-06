import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Collapse, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { accountRequest } from './accountApi';

const names = { '/count': 'Stock summary', '/fps-stock': 'Stock board', '/transactions': 'Sales tools (legacy)', '/stock-register': 'Stock board', '/ro-details': 'RO orders', '/ro-quantity-details': 'RO quantities', '/ration-card-details': 'Ration card details', transactions: 'Transactions', commission: 'Commission', monthComparison: 'Monthly comparison' };
const date = value => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Not yet active';
const panel = { p: { xs: 2, sm: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px #173e7a06' };

function AccountCard({ account }) {
  const [open, setOpen] = useState(false);
  const features = account.features || [];
  return <Paper elevation={0} sx={{ ...panel, minWidth: 0 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} useFlexGap flexWrap="wrap">
      <Box><Typography variant="caption" color="text.secondary">Ration shop</Typography><Typography sx={{ fontSize: 19, fontWeight: 800 }}>{account.fps_id}</Typography><Typography sx={{ fontSize: 14, color: '#52647f', mt: 0.5 }}>+{account.mobile}</Typography></Box>
      <Chip size="small" label={account.disabled ? 'Disabled' : features.length ? 'Used this month' : 'No use this month'} sx={{ fontSize: 12, bgcolor: !account.disabled && features.length ? '#e8f7f0' : '#f1f5f9', color: !account.disabled && features.length ? '#147451' : '#64748b' }} />
    </Stack>
    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f7f9fc', borderRadius: 2 }}><Typography sx={{ fontSize: 13, color: '#64748b' }}>Last feature use</Typography><Typography sx={{ fontSize: 14, fontWeight: 600, mt: 0.25 }}>{account.last_activity ? date(account.last_activity) : 'No feature used yet'}</Typography></Box>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
      {features.map(feature => <Chip key={feature.feature} size="small" label={names[feature.feature] || feature.feature} sx={{ bgcolor: '#eff4ff', color: '#365caa', maxWidth: '100%' }} />)}
      {!features.length && <Typography variant="body2" color="text.secondary">Registered, but no feature use recorded this month.</Typography>}
    </Stack>
    <Button fullWidth variant="outlined" onClick={() => setOpen(!open)} aria-expanded={open} sx={{ mt: 2, minHeight: 44, borderRadius: 2, borderColor: '#dbe5f3', textTransform: 'none' }}>{open ? 'Hide activity details −' : 'View activity details +'}</Button>
    <Collapse in={open}>
      <Typography sx={{ fontSize: 13, color: '#64748b', mt: 1.5 }}>Registered {date(account.created_at)}</Typography>
      {features.map(feature => <Box key={feature.feature} sx={{ py: 1, borderTop: '1px solid #edf1f7', mt: 1 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2" fontWeight={600}>{names[feature.feature] || feature.feature}</Typography><Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{feature.requests} requests</Typography></Stack>
        <Typography variant="caption" color="text.secondary">Last used {date(feature.last_used_at)}</Typography>
      </Box>)}
    </Collapse>
  </Paper>;
}

export default function AdminDashboard({ onHome }) {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    let current = true;
    setData(null); setError('');
    accountRequest(`admin/dashboard?page=${page}`).then(value => { if (current) setData(value); })
      .catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [page, reload]);
  const accounts = data?.accounts.filter(account => `${account.fps_id} ${account.mobile}`.includes(search.trim())) || [];
  const maxRequests = Math.max(1, ...(data?.features || []).map(feature => Number(feature.requests)));
  return <Box sx={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #eaf1ff 0, #f5f7fb 280px)', color: '#193552' }}>
    <Box component="main" sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 3 }}>
      <Stack spacing={2} sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}><Box component="img" src="/icon-192.png" alt="" sx={{ width: 32, height: 32, borderRadius: 1.5 }} /><Typography sx={{ fontSize: 14, fontWeight: 600, color: '#52647f' }}>Ration Stock App · Owner</Typography></Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box><Typography component="h1" sx={{ fontSize: { xs: 27, sm: 32 }, fontWeight: 800, letterSpacing: '-0.6px' }}>Member dashboard</Typography><Typography sx={{ fontSize: 14, color: '#52647f', mt: 0.5 }}>See who registered and which features they use.</Typography></Box>
          <Stack direction="row" spacing={1}><Button variant="contained" disableElevation onClick={() => setReload(v => v + 1)} sx={{ textTransform: 'none', minHeight: 44, borderRadius: 2, px: 2.5 }}>Refresh data</Button><Button variant="outlined" onClick={onHome} sx={{ minHeight: 44, borderRadius: 2, textTransform: 'none', bgcolor: '#ffffff' }}>Back to app</Button></Stack>
        </Stack>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress aria-label="Loading dashboard" /></Box>}
      {data && <>
        {data.accounts.some(account => !Array.isArray(account.features)) && <Alert severity="info" sx={{ mb: 2 }}>Run the updated dashboard SQL to load member feature usage.</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mb: 3 }}>
          {[['Registered members', data.total_accounts, `${data.new_month} joined this month`, '#245fcd'], ['Used app today', data.active_today, 'Members who used a feature', '#147451'], ['Used app this month', data.active_month, 'Each member counted once', '#7351bd'], ['Joined today', data.new_today, 'New accounts created', '#b05b22']].map(([label, value, caption, color]) => <Paper elevation={0} key={label} sx={{ ...panel, p: { xs: 1.75, sm: 2.5 }, borderTop: `3px solid ${color}` }}><Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, minHeight: { xs: 40, md: 0 } }}>{label}</Typography><Typography sx={{ fontSize: 36, fontWeight: 800, color, my: 0.75 }}>{value}</Typography><Typography sx={{ fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>{caption}</Typography></Paper>)}
        </Box>
        <Paper elevation={0} sx={{ ...panel, mb: 3 }}>
          <Typography variant="h6" fontWeight={800}>Feature usage</Typography><Typography sx={{ fontSize: 13, color: '#64748b' }}>This month · Completed requests</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mt: 2 }}>
            {[...data.features].sort((a, b) => b.requests - a.requests).map(feature => <Box key={feature.feature}>
              <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2" fontWeight={600}>{names[feature.feature] || feature.feature}</Typography><Typography variant="body2">{feature.requests}</Typography></Stack>
              <LinearProgress variant="determinate" value={Number(feature.requests) / maxRequests * 100} sx={{ my: 0.75, height: 6, borderRadius: 4, bgcolor: '#edf2fa', '& .MuiLinearProgress-bar': { borderRadius: 4 } }} />
              <Typography variant="caption" color="text.secondary">{feature.accounts} accounts</Typography>
            </Box>)}
            {!data.features.length && <Box sx={{ bgcolor: '#f7f9fc', border: '1px dashed #d3dfee', borderRadius: 2, p: 2, gridColumn: '1 / -1' }}><Typography sx={{ fontWeight: 600, fontSize: 15 }}>Waiting for first activity</Typography><Typography sx={{ fontSize: 14, color: '#64748b', mt: 0.5 }}>Feature usage will appear when a member checks stock or uses another feature. Signing in alone does not count.</Typography></Box>}
          </Box>
        </Paper>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
          <Box><Typography variant="h6" fontWeight={800}>Registered members</Typography><Typography sx={{ fontSize: 13, color: '#64748b' }}>Select a member’s details to see their activity.</Typography></Box>
          <TextField size="small" label="Search shop or mobile number" helperText={data.total_accounts > 50 ? 'Searches the current page only' : undefined} value={search} onChange={event => setSearch(event.target.value)} sx={{ width: { xs: '100%', sm: 300 }, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 2, minHeight: 48 }, '& input': { fontSize: 16 } }} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {accounts.map(account => <AccountCard key={account.id} account={account} />)}
          {!accounts.length && <Typography color="text.secondary">No matching accounts.</Typography>}
        </Box>
        {data.total_accounts > 50 && <Stack direction="row" justifyContent="center" alignItems="center" sx={{ mt: 2 }}><Button disabled={page === 1} onClick={() => { setSearch(''); setPage(p => p - 1); }}>Previous</Button><Typography variant="body2">Page {page} of {Math.max(1, Math.ceil(data.total_accounts / 50))}</Typography><Button disabled={page * 50 >= data.total_accounts} onClick={() => { setSearch(''); setPage(p => p + 1); }}>Next</Button></Stack>}
        <Box component="details" sx={{ mt: 3, fontSize: 13, color: '#64748b', '& summary': { cursor: 'pointer', py: 1.5 } }}><Box component="summary">How activity is counted</Box><Typography sx={{ fontSize: 13, lineHeight: 1.8 }}>A member counts as active after a successful feature request. Each member counts once per day or month. Feature totals count requests, not button clicks. All dates use India time. e-Treasury is not tracked; older sales-tool records remain grouped.</Typography></Box>
      </>}
    </Box>
  </Box>;
}
