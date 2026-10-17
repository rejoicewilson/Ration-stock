import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import AccountIcon from './AccountIcon';
import { openSubscriptionCheckout, reconcilePayment } from './razorpayCheckout';

export default function SubscriptionPaymentButton({ accountId, status, onRefresh, children }) {
  const dockRef = useRef(null);
  const [dockHeight, setDockHeight] = useState(156);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const measure = () => setDockHeight(Math.ceil(dock.getBoundingClientRect().height));
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(dock);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

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

  return <>
    {/* Reserve the actual mobile dock height, including recovery messages and
        safe-area padding, so scrolling never leaves content hidden behind it. */}
    <Box aria-hidden="true" sx={{ display: { xs: 'block', sm: 'none' }, height: dockHeight }} />
    <Box ref={dockRef} data-testid="subscription-payment-dock" sx={{
      position: { xs: 'fixed', sm: 'static' }, bottom: 0, left: 0, right: 0,
      zIndex: theme => theme.zIndex.appBar,
      bgcolor: '#fff', borderTop: { xs: '1px solid #dce5f3', sm: 'none' },
      boxShadow: { xs: '0 -8px 28px #183b701a', sm: 'none' },
      px: { xs: 2, sm: 0 }, pt: { xs: 1.25, sm: 0 },
      pb: { xs: 'calc(12px + env(safe-area-inset-bottom, 0px))', sm: 0 },
      maxHeight: { xs: '70dvh', sm: 'none' }, overflowY: 'auto', overscrollBehavior: 'contain',
    }}>
    <Stack spacing={1.25} sx={{ width: '100%', maxWidth: 440, mx: 'auto' }}>
    <Typography sx={{ display: { xs: 'block', sm: 'none' }, color: '#526b8f', fontSize: 12, textAlign: 'center' }}>₹99 / 30 ദിവസം · എല്ലാ സേവനങ്ങളും</Typography>
    {status?.mode === 'test' && <Alert severity="info" sx={{ fontSize: 12, lineHeight: 1.8 }}>ടെസ്റ്റ് പേയ്‌മെന്റ് — യഥാർത്ഥ പണം ഈടാക്കില്ല.</Alert>}
    <Button data-testid="subscription-checkout-button" variant="contained" fullWidth disabled={busy || pending || !status?.payments_enabled} onClick={pay}
      endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <AccountIcon name="arrow" />}
      sx={{ minHeight: 52, py: 1.25, px: 1, borderRadius: 2.25, textTransform: 'none', fontSize: 14, fontWeight: 700,
        background: 'linear-gradient(100deg, #304fbb, #6655cc)', boxShadow: '0 5px 14px #304fbb25',
        '&:hover': { background: 'linear-gradient(100deg, #2543a8, #5848b8)' },
        '&.Mui-disabled': { background: 'linear-gradient(100deg, #dee7ff, #e4ddff)', color: '#435c96', border: '1px solid #cbd6f9' } }}>
      {busy ? verifying ? 'പേയ്‌മെന്റ് പരിശോധിക്കുന്നു…' : 'പേയ്‌മെന്റ് തുറക്കുന്നു…' : status?.mode === 'test' ? 'ടെസ്റ്റ് പേയ്‌മെന്റ് · ₹99' : '₹99 നൽകി തുടരാം'}
    </Button>
    {error && <Alert severity="error" sx={{ fontSize: 12, lineHeight: 1.9 }}>പേയ്‌മെന്റ് പൂർത്തിയാക്കാനായില്ല. പണം നൽകിയിട്ടുണ്ടെങ്കിൽ വീണ്ടും അടയ്ക്കാതെ പേയ്‌മെന്റ് നില പരിശോധിക്കൂ.</Alert>}
    {pending && <Alert severity="info" sx={{ fontSize: 12, lineHeight: 1.9 }}>പേയ്‌മെന്റ് സ്ഥിരീകരണം ലഭിച്ചിട്ടില്ല. പണം നൽകിയിട്ടുണ്ടെങ്കിൽ വീണ്ടും അടയ്ക്കരുത്.</Alert>}
    {(pending || error) && <>
      <Button variant="outlined" disabled={busy} onClick={checkPayment} sx={{ minHeight: 44, textTransform: 'none', fontSize: 12 }}>പേയ്‌മെന്റ് നില പരിശോധിക്കാം</Button>
      {pending && <Button disabled={busy} onClick={() => setPending(false)} sx={{ minHeight: 44, textTransform: 'none', fontSize: 12 }}>പണം നൽകിയിട്ടില്ല — വീണ്ടും ശ്രമിക്കാം</Button>}
    </>}
    {children}
    </Stack>
    </Box>
  </>;
}
