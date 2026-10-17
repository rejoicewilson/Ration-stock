import React from 'react';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import AccountIcon from './AccountIcon';
import { SubscriptionHero, SubscriptionDailyWorkArtwork } from './SubscriptionArtwork';
import SubscriptionPaymentButton from './SubscriptionPaymentButton';

const malayalamFont = '"Noto Sans Malayalam", "Nirmala UI", Kartika, sans-serif';
export default function SubscriptionAccess({ accountId, status, loading, error, onRefresh }) {
  const waiting = loading && !status;
  return <Box component="main" lang="ml" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 }, display: 'grid', placeItems: 'center',
    background: 'radial-gradient(ellipse at 50% 20%, #e5ecff 0%, transparent 70%)',
    '@media (min-height: 740px) and (max-width: 599px)': { py: 3 },
    '@media (max-height: 620px) and (max-width: 599px)': { py: 1 },
    '& .MuiTypography-root, & .MuiButton-root:not([lang="en"])': { fontFamily: malayalamFont } }}>
    <Paper elevation={0} sx={{ width: '100%', maxWidth: 440, boxSizing: 'border-box', overflow: 'hidden', borderRadius: 4,
      border: '1px solid #dce5f3', bgcolor: '#fff', boxShadow: '0 24px 64px #223e7d20' }}>
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
        <Box sx={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', px: { xs: 2.5, sm: 3.5 }, pt: 2, pb: 2,
          textAlign: 'center', background: 'radial-gradient(ellipse at 85% 10%, #6275ed 0%, #344fc3 45%, #203d92 100%)',
          '&::before': { content: '""', position: 'absolute', zIndex: -1, width: 250, height: 250, border: '1px solid #ffffff18', borderRadius: '50%', top: -90, right: -100, boxShadow: '0 0 0 28px #ffffff05, 0 0 0 60px #ffffff04' },
          '@media (min-height: 740px) and (max-width: 599px)': { pt: 3, pb: 3 },
          '@media (max-height: 620px) and (max-width: 599px)': { pt: 1.5, pb: 1.5 },
        }}>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75} sx={{ mb: 0.5, color: '#e1e9ff' }}>
            <Typography lang="en" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.4 }}>Ration Stock App</Typography>
          </Stack>
          <SubscriptionHero />
          <Typography component="h1" sx={{ fontSize: { xs: 20, sm: 23 }, fontWeight: 800, color: '#fff', lineHeight: 1.6, mt: 0.75,
            '@media (max-height: 620px) and (max-width: 599px)': { fontSize: 18, lineHeight: 1.5 },
          }}>
            എല്ലാ സേവനങ്ങളും<br />ഇനി ഒരൊറ്റ പ്ലാനിൽ
          </Typography>
          <Typography sx={{ mt: 0.75, color: '#e0e8ff', fontSize: 12, lineHeight: 1.8,
            '@media (max-height: 620px) and (max-width: 599px)': { display: 'none' },
          }}>കണക്കുകൾ എളുപ്പം. സമയം ലാഭം.</Typography>
        </Box>

        <Box sx={{ px: { xs: 2.5, sm: 3.5 }, pt: 2, pb: 2,
          '@media (min-height: 740px) and (max-width: 599px)': { pt: 3, pb: 3 },
          '@media (max-height: 620px) and (max-width: 599px)': { pt: 1.5, pb: 1.5 },
        }}>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Box>
              <Stack direction="row" justifyContent="center" alignItems="baseline" spacing={0.75}>
                <Typography lang="en" sx={{ color: '#163563', fontSize: 52, lineHeight: 1.15, fontWeight: 900, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>₹99</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 13 }}>/ 30 ദിവസം</Typography>
              </Stack>
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ width: 'fit-content', mx: 'auto', mt: 0.75, px: 1.25, py: 0.3, borderRadius: 8, bgcolor: '#edf9f2', color: '#16734d' }}>
              <AccountIcon name="check" sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: 11, lineHeight: 1.8 }}>ദിവസം വെറും ₹3.30</Typography>
            </Stack>
          </Box>

          <SubscriptionPaymentButton key={accountId} accountId={accountId} status={status} onRefresh={onRefresh} />
          <Box data-testid="subscription-daily-work-artwork" sx={{ mt: 1 }}>
            <SubscriptionDailyWorkArtwork />
          </Box>
          <Typography sx={{ color: '#163563', fontSize: 11, textAlign: 'center', lineHeight: 1.8, mt: 0.75 }}>
            റേഷൻ കടയുടെ ദൈനംദിന പ്രവർത്തനങ്ങൾ കൂടുതൽ എളുപ്പമാക്കാൻ
          </Typography>
        </Box>
      </>}
    </Paper>
  </Box>;
}
