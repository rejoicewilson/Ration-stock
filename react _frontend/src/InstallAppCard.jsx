import React, { useState, useSyncExternalStore } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { getInstallState, subscribeInstall, takeInstallPrompt } from './installState';
import AccountIcon from './AccountIcon';

export default function InstallAppCard() {
  const { installed } = useSyncExternalStore(subscribeInstall, getInstallState);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /WhatsApp|FBAN|FBAV|Instagram|Line\/|Snapchat/i.test(ua);

  async function install() {
    if (busy) return;
    setNotice('');
    const prompt = takeInstallPrompt();
    if (!prompt) { setInstructions(true); return; }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') setNotice('Finish installation using your browser. Then open Ration Stock from your home screen.');
    } catch {
      setInstructions(true);
    } finally {
      setBusy(false);
    }
  }

  if (installed) return null;
  return <>
    <Box component="aside" aria-label="Install Ration Stock App" sx={{ mb: 2.5 }}>
      <Button type="button" fullWidth variant="contained" disabled={busy} onClick={install} startIcon={<AccountIcon name="download" />} sx={{ minHeight: 44, borderRadius: 2, textTransform: 'none', fontWeight: 800, boxShadow: 'none', bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8', boxShadow: 'none' } }}>
        {busy ? 'Please wait…' : 'Download App'}
      </Button>
      {notice && <Typography role="status" sx={{ mt: 1, fontSize: 12, color: '#52647f' }}>{notice}</Typography>}
    </Box>
    <Dialog open={instructions} onClose={() => setInstructions(false)} fullWidth maxWidth="xs" aria-labelledby="install-title">
      <DialogTitle id="install-title">Install Ration Stock App</DialogTitle>
      <DialogContent>
        {inApp && <Alert severity="info" sx={{ mb: 2 }}>Open this link in {iphone ? 'Safari' : 'Chrome or your phone’s browser'} first. Installation may not be available inside WhatsApp or other apps.</Alert>}
        <Typography sx={{ mb: 1.5, fontSize: 14 }}>No APK download or Play Store app is needed.</Typography>
        {iphone ? <Box component="ol" sx={{ pl: 2.5, lineHeight: 2, fontSize: 14 }}>
          <li>Open this website in Safari.</li>
          <li>Tap Share, then Add to Home Screen. You may need to scroll through the actions.</li>
          <li>If shown, keep Open as Web App enabled, then tap Add.</li>
        </Box> : android ? <Box component="ol" sx={{ pl: 2.5, lineHeight: 2, fontSize: 14 }}>
          <li>Open this website in Chrome.</li>
          <li>Tap the three-dot menu (⋮).</li>
          <li>Choose Install app or Add to Home screen, then follow the browser instructions.</li>
        </Box> : <Typography sx={{ fontSize: 14, lineHeight: 1.9 }}>In Chrome or Edge, look for Install in the address bar or browser menu. In Safari on a supported Mac, choose File → Add to Dock. Available options depend on your browser.</Typography>}
        <Typography sx={{ mt: 2, p: 1.25, bgcolor: '#f1f5f9', borderRadius: 1, fontSize: 13, userSelect: 'all', overflowWrap: 'anywhere' }}>https://ration-stock.vercel.app</Typography>
        <Typography sx={{ mt: 1.5, fontSize: 12, color: '#64748b' }}>Internet is still needed to check ration data. Your subscription is unchanged. If no install option appears, you can continue using this website.</Typography>
      </DialogContent>
      <DialogActions><Button onClick={() => setInstructions(false)} sx={{ minHeight: 44, textTransform: 'none' }}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
