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
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
      <Box><Typography fontWeight={800}>FPS {account.fps_id}</Typography><Typography variant="body2" color="text.secondary">+{account.mobile}</Typography></Box>
      <Chip size="small" label={account.disabled ? 'Disabled' : features.length ? 'Active' : 'Inactive'} sx={{ bgcolor: features.length ? '#e8f7f0' : '#f1f5f9', color: features.length ? '#147451' : '#64748b' }} />
    </Stack>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>Last used · {date(account.last_activity)}</Typography>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
      {features.map(feature => <Chip key={feature.feature} size="small" label={names[feature.feature] || feature.feature} sx={{ bgcolor: '#eff4ff', color: '#365caa', maxWidth: '100%' }} />)}
      {!features.length && <Typography variant="body2" color="text.secondary">No usage this month</Typography>}
    </Stack>
    <Button size="small" onClick={() => setOpen(!open)} aria-expanded={open} sx={{ mt: 1, px: 0, textTransform: 'none' }}>{open ? 'Hide details −' : 'Usage details +'}</Button>
    <Collapse in={open}>
      <Typography variant="caption" color="text.secondary">Joined {date(account.created_at)}</Typography>
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
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fc', color: '#193552' }}>
    <Box component="main" sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
        <Box><Typography variant="overline" sx={{ letterSpacing: 2, color: '#64748b' }}>OWNER SPACE</Typography><Typography component="h1" sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800 }}>Overview</Typography></Box>
        <Stack direction="row" spacing={0.5}><Button onClick={() => setReload(v => v + 1)} sx={{ textTransform: 'none' }}>Refresh</Button><Button variant="outlined" onClick={onHome} sx={{ borderRadius: 2, textTransform: 'none' }}>Home</Button></Stack>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress aria-label="Loading dashboard" /></Box>}
      {data && <>
        {data.accounts.some(account => !Array.isArray(account.features)) && <Alert severity="info" sx={{ mb: 2 }}>Run the updated dashboard SQL to load member feature usage.</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mb: 3 }}>
          {[['Total members', data.total_accounts, `+${data.new_month} this month`, '#245fcd'], ['Active today', data.active_today, 'Unique accounts', '#147451'], ['Active this month', data.active_month, 'Unique accounts', '#7351bd'], ['New today', data.new_today, 'Registrations', '#b05b22']].map(([label, value, caption, color]) => <Paper elevation={0} key={label} sx={{ ...panel, p: { xs: 1.75, sm: 2.5 }, borderTop: `3px solid ${color}` }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography sx={{ fontSize: 34, fontWeight: 800, color, my: 0.5 }}>{value}</Typography><Typography variant="caption" color="text.secondary">{caption}</Typography></Paper>)}
        </Box>
        <Paper elevation={0} sx={{ ...panel, mb: 3 }}>
          <Typography variant="h6" fontWeight={800}>Popular features</Typography><Typography variant="caption" color="text.secondary">This month · Successful API requests</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, mt: 2 }}>
            {[...data.features].sort((a, b) => b.requests - a.requests).map(feature => <Box key={feature.feature}>
              <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2" fontWeight={600}>{names[feature.feature] || feature.feature}</Typography><Typography variant="body2">{feature.requests}</Typography></Stack>
              <LinearProgress variant="determinate" value={Number(feature.requests) / maxRequests * 100} sx={{ my: 0.75, height: 6, borderRadius: 4, bgcolor: '#edf2fa', '& .MuiLinearProgress-bar': { borderRadius: 4 } }} />
              <Typography variant="caption" color="text.secondary">{feature.accounts} accounts</Typography>
            </Box>)}
            {!data.features.length && <Typography variant="body2" color="text.secondary">No usage yet.</Typography>}
          </Box>
        </Paper>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
          <Box><Typography variant="h6" fontWeight={800}>Members & activity</Typography><Typography variant="caption" color="text.secondary">Features used this month</Typography></Box>
          <TextField size="small" label="Find on this page" placeholder="Shop or mobile number" value={search} onChange={event => setSearch(event.target.value)} sx={{ bgcolor: 'white', width: { xs: '100%', sm: 280 } }} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {accounts.map(account => <AccountCard key={account.id} account={account} />)}
          {!accounts.length && <Typography color="text.secondary">No matching accounts.</Typography>}
        </Box>
        <Stack direction="row" justifyContent="center" alignItems="center" sx={{ mt: 2 }}><Button disabled={page === 1} onClick={() => { setSearch(''); setPage(p => p - 1); }}>Previous</Button><Typography variant="body2">{page} / {Math.max(1, Math.ceil(data.total_accounts / 50))}</Typography><Button disabled={page * 50 >= data.total_accounts} onClick={() => { setSearch(''); setPage(p => p + 1); }}>Next</Button></Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, textAlign: 'center' }}>India time · e-Treasury excluded · Legacy sales usage is grouped</Typography>
      </>}
    </Box>
  </Box>;
}
