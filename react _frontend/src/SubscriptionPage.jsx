import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { accountRequest } from './accountApi';

let checkoutLoader;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutLoader) {
    checkoutLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => window.Razorpay ? resolve() : reject(new Error('Payment checkout did not load.'));
      script.onerror = () => reject(new Error('Payment checkout did not load. Check your connection and retry.'));
      document.head.appendChild(script);
    }).catch((error) => { checkoutLoader = null; throw error; });
  }
  return checkoutLoader;
}

function indiaDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}

export default function SubscriptionPage({ onHome }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);

  const refreshStatus = useCallback(async (reconcile = false) => {
    setError('');
    try {
      const result = await accountRequest(reconcile ? 'subscription/reconcile' : 'subscription/status',
        reconcile ? {} : undefined);
      if (mounted.current) {
        setStatus(result);
        if (reconcile) setMessage(result.active
          ? 'Your test subscription is active.'
          : 'No captured test payment found yet. Check again in a moment if you just paid.');
      }
      return result;
    } catch (err) {
      if (mounted.current) setError(err.message || 'Could not check payment status.');
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshStatus();
    return () => { mounted.current = false; };
  }, [refreshStatus]);

  async function checkPayment() {
    setBusy(true); setMessage('');
    try { await refreshStatus(true); } finally { if (mounted.current) setBusy(false); }
  }

  async function pay() {
    if (busy || checkoutOpen) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await loadCheckout();
      const order = await accountRequest('subscription/order', {});
      if (order.mode !== 'test' || order.amount !== 9900 || order.currency !== 'INR') {
        throw new Error('Unexpected payment details. Please contact support.');
      }
      let completed = false;
      const checkout = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: 'Ration Stock App',
        description: 'Test plan · 30 days',
        order_id: order.order_id,
        prefill: { contact: order.contact },
        theme: { color: '#2563eb' },
        handler: async (result) => {
          completed = true;
          if (!mounted.current) return;
          setCheckoutOpen(false); setBusy(true);
          try {
            const verified = await accountRequest('subscription/verify', result);
            if (verified.pending) {
              setMessage('Payment is still being captured. Use “Check payment status” in a moment.');
            } else {
              await refreshStatus();
              setMessage('Test payment verified. Your 30-day test plan is active.');
            }
          } catch (err) {
            setError(`${err.message || 'Could not verify payment.'} Check payment status before paying again.`);
          } finally { if (mounted.current) setBusy(false); }
        },
        modal: {
          ondismiss: () => {
            if (!mounted.current) return;
            setCheckoutOpen(false);
            if (!completed) {
              setMessage('Checkout closed. If you completed payment, check its status before trying again.');
              setBusy(false);
            }
          },
        },
      });
      setCheckoutOpen(true);
      setBusy(false);
      checkout.open();
    } catch (err) {
      if (mounted.current) {
        setCheckoutOpen(false);
        setError(err.message || 'Could not open payment checkout.');
        setBusy(false);
      }
    }
  }

  return <Box sx={{ minHeight: '100dvh', px: 2, py: { xs: 3, sm: 6 }, background: 'linear-gradient(160deg, #e7efff, #f7f9ff 60%)' }}>
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <Button onClick={onHome} sx={{ mb: 2, textTransform: 'none' }}>← Back to app</Button>
      <Paper component="main" elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, border: '1px solid #dce6f7', borderRadius: 4, boxShadow: '0 18px 48px #183d7812' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Box component="img" src="/icon-192.png" alt="" width={32} height={32} sx={{ borderRadius: 1.5 }} />
          <Typography sx={{ fontWeight: 800, color: '#183456' }}>Ration Stock App</Typography>
        </Stack>
        <Typography component="h1" sx={{ fontSize: { xs: 25, sm: 30 }, fontWeight: 800, color: '#142d4e' }}>All features. One plan.</Typography>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 44, fontWeight: 800, color: '#142d4e', lineHeight: 1.2 }}>₹99</Typography>
          <Typography sx={{ color: '#61728d', fontWeight: 700 }}>/ 30 days</Typography>
        </Stack>
        <Typography sx={{ color: '#52647f', mb: 2 }}>Check any FPS number. No automatic renewal.</Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>Test mode only — no real payment. Test access will not carry over to live mode.</Alert>
        <Alert severity="info" sx={{ mb: 2 }}>All features are still free. Paying is not required yet.</Alert>
        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress aria-label="Checking subscription" /></Box> : status?.active ?
          <Alert severity="success" sx={{ mb: 2 }}>Test plan active until {indiaDate(status.paid_until)} IST.</Alert> :
          <Typography sx={{ color: '#52647f', mb: 2 }}>No active test plan.</Typography>}
        {message && <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Button variant="contained" fullWidth disabled={busy || loading || checkoutOpen} onClick={pay}
          sx={{ minHeight: 52, borderRadius: 2.5, fontWeight: 800, textTransform: 'none', fontSize: 16 }}>
          {busy || checkoutOpen ? 'Please wait…' : status?.active ? 'Renew test plan for ₹99' : 'Test payment · ₹99'}
        </Button>
        <Button fullWidth disabled={busy || checkoutOpen} onClick={checkPayment} sx={{ mt: 1.5, minHeight: 44, textTransform: 'none' }}>Check payment status</Button>
        <Typography sx={{ color: '#718198', fontSize: 12, mt: 2, textAlign: 'center' }}>Early renewal adds 30 days to your expiry. Check payment status before retrying a payment.</Typography>
      </Paper>
    </Box>
  </Box>;
}
