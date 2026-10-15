import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, InputAdornment, Paper, Stack, SvgIcon, TextField, Typography } from '@mui/material';
import App from './App';
import AdminDashboard from './AdminDashboard';
import SubscriptionPage from './SubscriptionPage';
import { accountRequest } from './accountApi';

const supportUrl = 'https://wa.me/919447645196?text=' + encodeURIComponent('Hello, I need help recovering my Ration Stock App account.');
const buttonStyle = { borderRadius: 2, textTransform: 'none', fontWeight: 700, minHeight: 46 };

function PlanCheckIcon(props) {
  return <SvgIcon {...props}><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 15-5-5 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7Z" /></SvgIcon>;
}

function PlanClockIcon(props) {
  return <SvgIcon {...props}><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.4l3.6 2.1-1 1.7L11 13V7h2Z" /></SvgIcon>;
}

function PasswordIcon(props) {
  return <SvgIcon {...props}><path d="M12.65 10A6 6 0 1 0 12.65 14H17v4h4v-4h2v-4H12.65ZM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" /></SvgIcon>;
}

function SignOutIcon(props) {
  return <SvgIcon {...props}><path d="m10 17 5-5-5-5v3H3v4h7v3ZM19 3H9v2h10v14H9v2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" /></SvgIcon>;
}

const RETURNING_USER_KEY = 'ration-returning-user';
function initialAccountMode() {
  try {
    return localStorage.getItem(RETURNING_USER_KEY) === 'yes' ? 'login' : 'register';
  } catch {
    return 'register';
  }
}
function rememberReturningUser() {
  try { localStorage.setItem(RETURNING_USER_KEY, 'yes'); } catch { /* Storage may be disabled. */ }
}

function broadcastSessionChange() {
  // Notification only; no passwords, session IDs or account data enter localStorage.
  try { localStorage.setItem('ration-session-change', String(Date.now())); } catch { /* Storage can be disabled. */ }
}

export default function AccountApp() {
  const refreshSequence = useRef(0);
  const [account, setAccount] = useState(null);
  const [planStatus, setPlanStatus] = useState(null);
  const [planError, setPlanError] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pendingView, setPendingView] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '');
    return path === '/admin' ? 'admin' : path === '/subscription' ? 'subscription' : null;
  });
  const [mode, setMode] = useState(initialAccountMode);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({ fps_id: '', mobile: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  function goHome() {
    window.history.replaceState(null, '', '/');
    setPendingView(null);
  }

  async function refreshAccount() {
    const sequence = ++refreshSequence.current;
    try {
      const data = await accountRequest('me');
      if (sequence !== refreshSequence.current) return null;
      setAccount(data.account);
      if (data.account) {
        rememberReturningUser();
        setMode('login');
      }
      setError('');
      return data.account;
    } catch (err) {
      if (sequence !== refreshSequence.current) return null;
      if (err.status === 401) setAccount(null);
      else setError(err.message || 'Could not check your account. Please try again.');
      return null;
    } finally { if (sequence === refreshSequence.current) setChecking(false); }
  }

  useEffect(() => {
    refreshAccount();
    const refresh = () => { if (document.visibilityState === 'visible') refreshAccount(); };
    const ended = () => { ++refreshSequence.current; setAccount(null); };
    const planNeeded = () => {
      window.history.replaceState(null, '', '/subscription');
      setPendingView('subscription');
      setError('');
    };
    const changed = (event) => { if (event.key === 'ration-session-change') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', changed);
    window.addEventListener('ration-session-ended', ended);
    window.addEventListener('ration-subscription-required', planNeeded);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', changed);
      window.removeEventListener('ration-session-ended', ended);
      window.removeEventListener('ration-subscription-required', planNeeded);
    };
  }, []);

  useEffect(() => {
    if (!account?.id) {
      setPlanStatus(null);
      setPlanError(false);
      return;
    }
    let cancelled = false;
    setPlanError(false);
    accountRequest('subscription/status').then((status) => {
      if (!cancelled) setPlanStatus({ accountId: account.id, ...status });
    }).catch(() => {
      if (!cancelled) {
        setPlanStatus(null);
        setPlanError(true);
      }
    });
    return () => { cancelled = true; };
  }, [account, pendingView]);

  const changeField = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  async function submit(event) {
    event?.preventDefault();
    setBusy(true); setError('');
    try {
      const body = { mobile: form.mobile, password: form.password };
      if (mode === 'register') body.fps_id = form.fps_id;
      await accountRequest(mode, body);
      rememberReturningUser();
      setMode('login');
      setPasswordVisible(false);
      setForm((previous) => ({ ...previous, password: '' }));
      await refreshAccount();
      broadcastSessionChange();
    } catch (err) {
      setError(err.message || 'Could not sign in. Please try again.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    try {
      await accountRequest('logout', {});
      ++refreshSequence.current;
      setAccount(null); setPendingView(null); setError('');
      setMode('login'); setPasswordVisible(false);
      setShowPasswordForm(false); setPasswords({ current_password: '', new_password: '' });
      broadcastSessionChange();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await accountRequest('change-password', passwords);
      setPasswords({ current_password: '', new_password: '' });
      setShowPasswordForm(false);
      await refreshAccount();
      broadcastSessionChange();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (checking) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Checking sign-in" /></Box>;

  if (account?.must_change_password || (account && showPasswordForm)) {
    return <AccountCard title="Choose a new password">
      <Typography sx={{ mb: 2 }}>Use at least 12 characters. A few memorable words work well.</Typography>
      {account.must_change_password && <Alert severity="info" sx={{ mb: 2 }}>Replace the temporary password from support before continuing.</Alert>}
      <Box component="form" onSubmit={changePassword}>
        <Stack spacing={2}>
          <TextField label="Current or temporary password" type="password" autoComplete="current-password" required value={passwords.current_password} onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} inputProps={{ maxLength: 128 }} />
          <TextField label="New password" type="password" autoComplete="new-password" required value={passwords.new_password} onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })} inputProps={{ minLength: 12, maxLength: 128 }} />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={busy} sx={buttonStyle}>Save password</Button>
          {!account.must_change_password && <Button onClick={() => setShowPasswordForm(false)}>Back</Button>}
          <Button onClick={signOut} disabled={busy}>Sign out</Button>
        </Stack>
      </Box>
    </AccountCard>;
  }

  if (!account && pendingView) {
    return <AccountCard branded title={mode === 'register' ? 'Create your account' : 'Welcome back'}>
      <Typography lang="ml" sx={{ color: '#435778', mb: 3, p: 2, bgcolor: '#f1f6ff', borderLeft: '3px solid #739bea', borderRadius: '0 12px 12px 0', fontSize: 14, lineHeight: 1.85 }}>
        {mode === 'register' ? 'ആപ്പിൽ പുതുതായി അക്കൗണ്ട് സംവിധാനം ചേർത്തിരിക്കുന്നു. സേവനങ്ങൾ തുടർന്നും ഉപയോഗിക്കാൻ ആദ്യം ഒരു അക്കൗണ്ട് സൃഷ്ടിക്കുക. നിങ്ങളുടെ റേഷൻ കട നമ്പറും മൊബൈൽ നമ്പറും നൽകി ഒരു പാസ്‌വേഡ് സജ്ജമാക്കുക.' : 'അക്കൗണ്ട് സൃഷ്ടിച്ചപ്പോൾ നൽകിയ മൊബൈൽ നമ്പറും പാസ്‌വേഡും ഉപയോഗിക്കുക.'}
      </Typography>
      <Box component="form" lang="en" onSubmit={submit}>
        <Stack spacing={2.5} sx={{ '& .MuiFormHelperText-root': { lineHeight: 1.5, fontSize: 12, mx: 0.5, mt: 0.75 }, '& .MuiInputLabel-root': { fontSize: 15 }, '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fbfcff', fontSize: 16, '& fieldset': { borderColor: '#d3ddea' }, '&:hover fieldset': { borderColor: '#8ba7d3' }, '&.Mui-focused': { bgcolor: '#fff', boxShadow: '0 0 0 3px #2563eb12' } }, '& .MuiInputBase-input': { py: 1.8 } }}>
          {mode === 'register' && <TextField label="Ration shop number" name="fps_id" value={form.fps_id} onChange={changeField} required inputProps={{ inputMode: 'numeric', pattern: '[0-9]{7}', maxLength: 7 }} helperText="7-digit FPS number" />}
          <TextField label="Mobile number" name="mobile" type="tel" autoComplete="username" value={form.mobile} onChange={changeField} required inputProps={{ maxLength: 20 }} />
          <TextField label={mode === 'register' ? 'Create password' : 'Password'} name="password" type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={changeField} required inputProps={{ minLength: mode === 'register' ? 12 : 1, maxLength: 128 }}
            InputProps={{ endAdornment: <InputAdornment position="end"><Button type="button" size="small" aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible(value => !value)} sx={{ minWidth: 0, minHeight: 44, px: 0.5, fontSize: 12, textTransform: 'none' }}>{passwordVisible ? 'Hide' : 'Show'}</Button></InputAdornment> }}
            helperText={mode === 'register' ? 'At least 12 characters' : undefined} />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={busy} sx={{ ...buttonStyle, minHeight: 52, fontSize: 16, bgcolor: '#2563eb', boxShadow: '0 5px 14px #2563eb25', '&:hover': { bgcolor: '#1d4ed8', boxShadow: '0 6px 18px #2563eb30' } }}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</Button>
          <Stack spacing={1}>
            <Typography sx={{ textAlign: 'center', color: '#52647f', fontSize: 14 }}>
              {mode === 'register' ? 'Already have an account?' : 'New to the app?'}
            </Typography>
            <Button type="button" variant="outlined" fullWidth disabled={busy} onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setPasswordVisible(false); setError(''); setForm({ ...form, password: '' }); }} sx={{ minHeight: 52, borderRadius: 2.5, textTransform: 'none', fontSize: 16, fontWeight: 700, color: '#2563eb', borderColor: '#2563eb', bgcolor: '#f1f6ff', '&:hover': { bgcolor: '#e5eeff', borderColor: '#1d4ed8' } }}>
              {mode === 'register' ? 'Sign in' : 'Create account'}
            </Button>
          </Stack>
          {mode === 'login' && <Button component="a" href={supportUrl} target="_blank" rel="noopener noreferrer" sx={{ textTransform: 'none' }}>Forgot password? Contact support</Button>}
          <Box sx={{ borderTop: '1px solid #edf1f7', pt: 1.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
            <Button disabled={busy} onClick={() => { goHome(); setPasswordVisible(false); setError(''); setForm({ ...form, password: '' }); }} sx={{ textTransform: 'none', color: '#64748b', px: 0.5, minHeight: 44, fontSize: 12 }}>← Back to home</Button>
            <Typography component="a" href="tel:9447645196" sx={{ color: '#64748b', textDecoration: 'none', fontSize: 12, py: 1.5, '&:hover': { textDecoration: 'underline' } }}>Support: 9447645196</Typography>
          </Box>
        </Stack>
      </Box>
    </AccountCard>;
  }

  if (account && pendingView === 'admin') {
    return account.is_owner ? <AdminDashboard onHome={goHome} /> : <AccountCard title="Owner access only"><Alert severity="warning">This account cannot access the dashboard.</Alert><Button onClick={goHome}>Home</Button></AccountCard>;
  }

  if (account && pendingView === 'subscription') {
    return <SubscriptionPage onHome={goHome} />;
  }

  const currentPlan = planStatus?.accountId === account?.id ? planStatus : null;
  const planLabel = planError ? 'Plan unavailable' : !currentPlan ? 'Checking plan' : currentPlan.active
    ? currentPlan.mode === 'test' ? 'Test plan' : '₹99 plan'
    : currentPlan.required ? 'No active plan' : 'Free plan';
  const planActive = !planError && currentPlan && (currentPlan.active || !currentPlan.required);

  return <>
    {account && <Box sx={{ px: 2, py: 1.5, bgcolor: '#e8efff', borderBottom: '1px solid #d8e3f7' }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.25 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#183456', textAlign: { xs: 'center', sm: 'left' }, whiteSpace: 'nowrap' }}>FPS {account.fps_id}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75, ml: { sm: 'auto' }, width: { xs: '100%', sm: 'auto' }, '& .MuiButton-root': { minWidth: 0, minHeight: 54, px: 0.5, py: 0.6, borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: { xs: 10, sm: 12 }, lineHeight: 1.1, bgcolor: '#fff', display: 'flex', flexDirection: 'column', gap: 0.25 } }}>
          {(account.subscription_required || (import.meta.env.VITE_SUBSCRIPTION_TEST_UI === 'true' && currentPlan?.mode === 'test' && currentPlan.eligible)) && <Button variant="outlined" sx={{ gridColumn: '1 / -1' }} onClick={() => { window.history.replaceState(null, '', '/subscription'); setPendingView('subscription'); }}>{currentPlan?.mode === 'test' ? 'Test ₹99 plan' : '₹99 plan'}</Button>}
          <Box role="status" aria-label={`Current plan: ${planLabel}`} title={currentPlan?.active && currentPlan.paid_until ? `Active until ${new Date(currentPlan.paid_until).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST` : undefined} sx={{ minHeight: 54, borderRadius: 2, border: `1px solid ${planActive ? '#b9e8d0' : '#d3ddea'}`, bgcolor: planActive ? '#effbf4' : '#f7f9fc', color: planActive ? '#176b45' : '#52647f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
            {planActive ? <PlanCheckIcon sx={{ fontSize: 19 }} /> : <PlanClockIcon sx={{ fontSize: 19 }} />}
            <Typography sx={{ fontSize: { xs: 10, sm: 12 }, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{planLabel}</Typography>
          </Box>
          <Button variant="outlined" aria-label="Change password" onClick={() => setShowPasswordForm(true)}><PasswordIcon sx={{ fontSize: 19 }} />Password</Button>
          <Button variant="outlined" color="error" aria-label="Sign out" disabled={busy} onClick={signOut}><SignOutIcon sx={{ fontSize: 19 }} />Sign out</Button>
        </Box>
      </Box>
    </Box>}
    {error && <Alert severity="warning" sx={{ m: 2 }}>{error}</Alert>}
    {account?.is_owner && <Box sx={{ textAlign: 'center', py: 1 }}><Button variant="outlined" onClick={() => { window.history.replaceState(null, '', '/admin'); setPendingView('admin'); }}>Owner dashboard</Button></Box>}
    <App key={account?.id || 'guest'} initialView={account ? pendingView || 'home' : 'home'}
      registeredFpsId={account?.fps_id || ''}
      onHome={() => setPendingView(null)}
      onProtectedFeature={async (view) => {
        setError('');
        if (!account) { setPendingView(view); return true; }
        if (!account.subscription_required) return false;
        try {
          const status = await accountRequest('subscription/status');
          if (status.required && !status.active) {
            window.history.replaceState(null, '', '/subscription');
            setPendingView('subscription');
            return true;
          }
          return false;
        } catch (err) {
          setError(err.message || 'Could not check your plan. Please try again.');
          return true;
        }
      }} />
  </>;
}

function AccountCard({ title, children, branded = false }) {
  return <Box sx={{ minHeight: '100dvh', boxSizing: 'border-box', display: 'grid', placeItems: 'center', px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 5 }, background: 'radial-gradient(ellipse at top, #e2ecff 0%, #f4f7fc 65%)' }}>
    <Paper component="main" elevation={0} sx={{ boxSizing: 'border-box', width: '100%', maxWidth: 480, p: { xs: 2.5, sm: 4 }, borderRadius: 4, border: '1px solid #e0e8f4', boxShadow: '0 16px 48px #173e7a0d' }}>
      {branded && <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
        <Box component="img" src="/icon-192.png" alt="" width={36} height={36} sx={{ borderRadius: 2, objectFit: 'contain', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#52647f' }}>Ration Stock App</Typography>
      </Stack>}
      <Typography component="h1" sx={{ fontSize: { xs: 25, sm: 28 }, lineHeight: 1.25, letterSpacing: '-0.6px', color: '#142d4e', fontWeight: 800, mb: 2 }}>{title}</Typography>
      {children}
    </Paper>
  </Box>;
}
