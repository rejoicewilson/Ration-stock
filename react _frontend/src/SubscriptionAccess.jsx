import React from 'react';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import AccountIcon from './AccountIcon';
import { SubscriptionHero } from './SubscriptionArtwork';
import SubscriptionPaymentButton from './SubscriptionPaymentButton';

const malayalamFont = '"Noto Sans Malayalam", "Nirmala UI", Kartika, sans-serif';
export default function SubscriptionAccess({ accountId, status, loading, error, onRefresh, onHome }) {
  const waiting = loading && !status;
  return <Box component="main" lang="ml" sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 3, sm: 5 }, display: 'grid', placeItems: 'center',
    '& .MuiTypography-root, & .MuiButton-root:not([lang="en"])': { fontFamily: malayalamFont } }}>
    <Box sx={{ width: '100%', maxWidth: 440, display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
      <Button type="button" lang="en" variant="outlined" onClick={onHome} aria-label="Back to home"
        sx={{ height: 40, borderRadius: 2, px: 2, fontWeight: 800, textTransform: 'none', background: '#ffffff' }}>Home</Button>
    </Box>
    <Paper elevation={0} sx={{ width: '100%', maxWidth: 440, boxSizing: 'border-box', overflow: 'hidden', borderRadius: 4,
      border: '1px solid #dce5f3', bgcolor: '#fff', boxShadow: '0 20px 55px #183b701a' }}>
      {waiting || error ? <Stack spacing={2.5} alignItems="center" sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }} aria-busy={waiting}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: '50%', bgcolor: '#edf3ff', color: '#2c5ed4' }}>
          {waiting ? <CircularProgress size={28} color="inherit" aria-label="Checking plan" /> : <AccountIcon name="info" sx={{ fontSize: 32 }} />}
        </Box>
        <Typography component="h1" sx={{ fontSize: 21, lineHeight: 1.7, fontWeight: 700, color: '#183456' }}>
          {waiting ? 'പ്ലാൻ പരിശോധിക്കുന്നു…' : 'പ്ലാൻ പരിശോധിക്കാനായില്ല'}
        </Typography>
        {error && <>
          <Typography sx={{ color: '#64748b', fontSize: 14 }}>ദയവായി വീണ്ടും ശ്രമിക്കൂ.</Typography>
          <Button variant="contained" onClick={onRefresh} startIcon={<AccountIcon name="refresh" />} sx={{ minHeight: 48, borderRadius: 2, textTransform: 'none' }}>വീണ്ടും ശ്രമിക്കാം</Button>
        </>}
      </Stack> : <>
        <Box sx={{ position: 'relative', overflow: 'hidden', px: { xs: 2.5, sm: 3.5 }, pt: 2.5, pb: 3,
          textAlign: 'center', background: 'radial-gradient(ellipse at 85% 10%, #5368df 0%, #304fbb 45%, #203d92 100%)' }}>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75} sx={{ mb: 1, color: '#e1e9ff' }}>
            <AccountIcon name="stock" sx={{ fontSize: 16 }} />
            <Typography lang="en" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.4 }}>Ration Stock App</Typography>
          </Stack>
          <SubscriptionHero />
          <Typography component="h1" sx={{ fontSize: { xs: 24, sm: 27 }, fontWeight: 800, color: '#fff', lineHeight: 1.65, mt: 0.75, mb: 0.75 }}>
            കടയുടെ കണക്കുകൾ<br />ഇനി എളുപ്പം.
          </Typography>
          <Typography sx={{ fontSize: 13, lineHeight: 1.9, color: '#d7e3ff' }}>
            സമയം ലാഭിക്കൂ. സ്മാർട്ടായി മുന്നേറൂ.
          </Typography>
        </Box>

        <Box sx={{ px: { xs: 2.5, sm: 3.5 }, pt: 2.5, pb: 2.5 }}>
          <Box sx={{ textAlign: 'center', mb: 2.5 }}>
            <Box>
              <Typography sx={{ color: '#526b8f', fontSize: 12, mb: 0.5 }}>ഒരു പ്ലാൻ. എല്ലാ സേവനങ്ങളും.</Typography>
              <Stack direction="row" justifyContent="center" alignItems="baseline" spacing={0.75}>
                <Typography lang="en" sx={{ color: '#163563', fontSize: 48, lineHeight: 1.3, fontWeight: 800, letterSpacing: '-1.5px', fontVariantNumeric: 'tabular-nums' }}>₹99</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 13 }}>/ 30 ദിവസം</Typography>
              </Stack>
            </Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.75, px: 1.25, py: 0.4, borderRadius: 8, bgcolor: '#eef9f4' }}>
              <Typography sx={{ color: '#237453', fontSize: 12, lineHeight: 1.8 }}>ദിവസം വെറും ₹3.30</Typography>
            </Box>
          </Box>

          <SubscriptionPaymentButton key={accountId} accountId={accountId} status={status} onRefresh={onRefresh} />
          <Typography sx={{ color: '#163563', fontSize: 12, textAlign: 'center', lineHeight: 1.9, mt: 1.5 }}>
            റേഷൻ കടയുടെ ദൈനംദിന പ്രവർത്തനങ്ങൾ കൂടുതൽ എളുപ്പമാക്കാൻ
          </Typography>
        </Box>
      </>}
    </Paper>
  </Box>;
}
