import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import App from './App';
import AdminDashboard from './AdminDashboard';
import { accountRequest } from './accountApi';

const supportUrl = 'https://wa.me/919447645196?text=' + encodeURIComponent('Hello, I need help recovering my Ration Stock App account.');
const buttonStyle = { borderRadius: 2, textTransform: 'none', fontWeight: 700, minHeight: 46 };

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
  const [checking, setChecking] = useState(true);
  const [pendingView, setPendingView] = useState(window.location.pathname.replace(/\/$/, '') === '/admin' ? 'admin' : null);
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
    const changed = (event) => { if (event.key === 'ration-session-change') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', changed);
    window.addEventListener('ration-session-ended', ended);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', changed);
      window.removeEventListener('ration-session-ended', ended);
    };
  }, []);

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
          <Button disabled={busy} onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setPasswordVisible(false); setError(''); setForm({ ...form, password: '' }); }} sx={{ textTransform: 'none', lineHeight: 1.6, flexWrap: 'wrap', gap: 0.5, fontSize: 14, minHeight: 44, color: '#52647f' }}>
            {mode === 'register' ? 'Already have an account?' : 'New to the app?'} <Box component="span" sx={{ color: '#2563eb', fontWeight: 700 }}>{mode === 'register' ? 'Sign in' : 'Create account'}</Box>
          </Button>
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

  return <>
    {account && <Box sx={{ px: 2, py: 1.5, bgcolor: '#e8efff', borderBottom: '1px solid #d8e3f7' }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.25 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#183456', textAlign: { xs: 'center', sm: 'left' }, whiteSpace: 'nowrap' }}>FPS {account.fps_id}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75, ml: { sm: 'auto' }, width: { xs: '100%', sm: 'auto' }, '& .MuiButton-root': { minWidth: 0, minHeight: 44, px: 1, py: 0.75, borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: { xs: 12, sm: 13 }, lineHeight: 1.3, bgcolor: '#fff' } }}>
          <Button variant="outlined" onClick={() => setShowPasswordForm(true)}>Change password</Button>
          <Button variant="outlined" color="error" disabled={busy} onClick={signOut}>Sign out</Button>
        </Box>
      </Box>
    </Box>}
    {error && <Alert severity="warning" sx={{ m: 2 }}>{error}</Alert>}
    {account?.is_owner && <Box sx={{ textAlign: 'center', py: 1 }}><Button variant="outlined" onClick={() => { window.history.replaceState(null, '', '/admin'); setPendingView('admin'); }}>Owner dashboard</Button></Box>}
    <App key={account?.id || 'guest'} initialView={account ? pendingView || 'home' : 'home'}
      onHome={() => setPendingView(null)}
      onProtectedFeature={(view) => { setPendingView(view); setError(''); return !account; }} />
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
