import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import AccountIcon from './AccountIcon';
import { openSubscriptionCheckout, reconcilePayment } from './razorpayCheckout';

export default function SubscriptionPaymentButton({ accountId, status, onRefresh }) {
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    mounted.current = true;
    let checking = false;
    async function recover() {
      if (!status?.payments_enabled || document.visibilityState !== 'visible' || checking || inFlight.current) return;
      checking = true;
      try {
        const result = await reconcilePayment();
        if (mounted.current && result.subscription?.paid_active) refreshRef.current();
      } catch { /* Background recovery is silent; the payment button offers explicit retry. */ }
      finally { checking = false; }
    }
    recover();
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [accountId, status?.payments_enabled]);

  async function pay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(false); setPending(false); setVerifying(false);
    try {
      const result = await openSubscriptionCheckout({
        onVerifying: () => { if (mounted.current) setVerifying(true); },
      });
      if (!mounted.current) return;
      if (result.state === 'active') refreshRef.current();
      else setPending(true);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); setVerifying(false); }
    }
  }

  async function checkPayment() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setVerifying(true); setError(false);
    try {
      const result = await reconcilePayment();
      if (mounted.current && result.subscription?.paid_active) refreshRef.current();
      else if (mounted.current) setPending(true);
    } catch { if (mounted.current) setError(true); }
    finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); setVerifying(false); }
    }
  }

  return <Stack spacing={1.5}>
    {status?.mode === 'test' && <Alert severity="info" sx={{ fontSize: 12, lineHeight: 1.8 }}>ടെസ്റ്റ് പേയ്‌മെന്റ് — യഥാർത്ഥ പണം ഈടാക്കില്ല.</Alert>}
    <Button data-testid="subscription-checkout-button" variant="contained" fullWidth disabled={busy || pending || !status?.payments_enabled} onClick={pay}
      endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <AccountIcon name="arrow" />}
      sx={{ minHeight: 56, py: 1.5, px: 1, borderRadius: 2.25, textTransform: 'none', fontSize: 15, fontWeight: 800,
        background: 'linear-gradient(105deg, #264bc4, #6545c5)', color: '#fff', border: '1px solid #ffffff25',
        boxShadow: '0 8px 20px #304fbb38, inset 0 1px 0 #ffffff30',
        transition: 'box-shadow 150ms ease, background 150ms ease',
        '&:hover': { background: 'linear-gradient(105deg, #203eaa, #5638af)', boxShadow: '0 10px 24px #304fbb48' },
        '&.Mui-focusVisible': { outline: '3px solid #96b8ff', outlineOffset: 3 },
        '&.Mui-disabled': { background: 'linear-gradient(100deg, #dee7ff, #e4ddff)', color: '#435c96', border: '1px solid #cbd6f9' } }}>
      {busy ? verifying ? 'പേയ്‌മെന്റ് പരിശോധിക്കുന്നു…' : 'പേയ്‌മെന്റ് തുറക്കുന്നു…' : status?.mode === 'test' ? 'ടെസ്റ്റ് പേയ്‌മെന്റ് · ₹99' : '₹99 നൽകി തുടരാം'}
    </Button>
    {error && <Alert severity="error" sx={{ fontSize: 12, lineHeight: 1.9 }}>പേയ്‌മെന്റ് പൂർത്തിയാക്കാനായില്ല. പണം നൽകിയിട്ടുണ്ടെങ്കിൽ വീണ്ടും അടയ്ക്കാതെ പേയ്‌മെന്റ് നില പരിശോധിക്കൂ.</Alert>}
    {pending && <Alert severity="info" sx={{ fontSize: 12, lineHeight: 1.9 }}>പേയ്‌മെന്റ് സ്ഥിരീകരണം ലഭിച്ചിട്ടില്ല. പണം നൽകിയിട്ടുണ്ടെങ്കിൽ വീണ്ടും അടയ്ക്കരുത്.</Alert>}
    {(pending || error) && <>
      <Button variant="outlined" disabled={busy} onClick={checkPayment} sx={{ minHeight: 44, textTransform: 'none', fontSize: 12 }}>പേയ്‌മെന്റ് നില പരിശോധിക്കാം</Button>
      {pending && <Button disabled={busy} onClick={() => setPending(false)} sx={{ minHeight: 44, textTransform: 'none', fontSize: 12 }}>പണം നൽകിയിട്ടില്ല — വീണ്ടും ശ്രമിക്കാം</Button>}
    </>}
  </Stack>;
}
