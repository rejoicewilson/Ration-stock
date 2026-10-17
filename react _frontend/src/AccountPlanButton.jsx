import React, { useState } from 'react';
import { Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import AccountIcon from './AccountIcon';

const plans = {
  free: { label: 'Free plan', icon: 'check', color: '#14734d', background: '#effbf5', border: '#b5e7cf' },
  paid: { label: '₹99 plan', icon: 'verified', color: '#2458d3', background: '#eef4ff', border: '#b6ccff' },
  expired: { label: 'Expired', icon: 'clock', color: '#985209', background: '#fff8ed', border: '#f0d6a7' },
  inactive: { label: 'Expired', icon: 'clock', color: '#985209', background: '#fff8ed', border: '#f0d6a7' },
};
const unknownPlan = { label: 'Plan', icon: 'info', color: '#52647f', background: '#f8faff', border: '#ccd8ec' };
const dateOptions = { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' };

function displayDate(value, { inclusive = false, withTime = false } = {}) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return null;
  if (inclusive) date.setTime(date.getTime() - 1);
  const options = withTime ? { ...dateOptions, hour: 'numeric', minute: '2-digit', hour12: true } : dateOptions;
  return new Intl.DateTimeFormat('en-IN', options).format(date) + (withTime ? ' IST' : '');
}

export default function AccountPlanButton({ status, loading, error: unavailable, onRefresh }) {
  const [open, setOpen] = useState(false);

  const appearance = status?.plan === 'paid' && status.mode === 'test'
    ? { ...plans.paid, label: 'Test plan' } : plans[status?.plan] || unknownPlan;
  const isFree = status?.plan === 'free';
  const freeExpired = status?.plan === 'inactive';
  const date = isFree || freeExpired ? displayDate(status.free_until, { inclusive: true })
    : displayDate(status?.paid_until, { withTime: true });
  const dateLabel = isFree || freeExpired ? 'Free through' : status?.plan === 'expired' ? 'Expired on' : 'Valid until';

  return <>
    <Button variant="outlined" aria-label={`${appearance.label}: view plan details`} aria-haspopup="dialog"
      aria-expanded={open} aria-controls={open ? 'account-plan-dialog' : undefined}
      onClick={() => { setOpen(true); onRefresh(); }}
      sx={{ color: appearance.color, borderColor: appearance.border, bgcolor: appearance.background,
        '&:hover': { borderColor: appearance.color, filter: 'brightness(0.98)' } }}>
      {loading ? <CircularProgress size={19} color="inherit" aria-label="Checking plan" /> : <AccountIcon name={appearance.icon} sx={{ fontSize: 21 }} />}
      <span>{appearance.label}</span>
    </Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" aria-labelledby="account-plan-title"
      PaperProps={{ id: 'account-plan-dialog', sx: { borderRadius: 3, m: 2 } }}>
      <DialogTitle id="account-plan-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, fontSize: 18, fontWeight: 800, color: '#183456' }}>
        Your plan
        <IconButton aria-label="Close plan details" onClick={() => setOpen(false)} sx={{ minWidth: 44, minHeight: 44 }}><AccountIcon name="close" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ bgcolor: appearance.background, border: `1px solid ${appearance.border}`, borderRadius: 2.5, p: 3, textAlign: 'center' }}>
          <Box sx={{ color: appearance.color, display: 'flex' }}>
            {loading ? <CircularProgress size={36} color="inherit" aria-label="Checking plan" /> : <AccountIcon name={appearance.icon} sx={{ fontSize: 42 }} />}
          </Box>
          <Typography component="p" sx={{ fontWeight: 800, fontSize: 22, color: appearance.color }}>
            {loading && !status ? 'Checking plan' : unavailable ? 'Plan unavailable' : freeExpired ? 'Free plan expired' : appearance.label}
          </Typography>
          {!loading && unavailable && <Button variant="outlined" onClick={onRefresh} sx={{ textTransform: 'none' }}>Try again</Button>}
          {status && date && <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#52647f' }}>
            <AccountIcon name="calendar" sx={{ fontSize: 20, flexShrink: 0 }} />
            <Box><Typography sx={{ fontSize: 12 }}>{dateLabel}</Typography><Typography sx={{ fontSize: 14, fontWeight: 600 }}>{date}</Typography></Box>
          </Stack>}
          {status?.access_allowed && <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#52647f' }}>
            <AccountIcon name="check" sx={{ fontSize: 16 }} /><Typography sx={{ fontSize: 13 }}>All services available</Typography>
          </Stack>}
        </Stack>
      </DialogContent>
    </Dialog>
  </>;
}
