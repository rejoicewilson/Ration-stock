import React, { useId } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';

function ServiceArtwork({ epos }) {
  const gradientId = useId();
  return <Box component="svg" viewBox="0 0 220 108" aria-hidden="true" sx={{ width: 190, height: 94, display: 'block', mx: 'auto' }}>
    <defs><linearGradient id={gradientId} x2="0" y2="1"><stop stopColor="#dce8fa" /><stop offset="1" stopColor="#b9cce6" /></linearGradient></defs>
    <path d="M81 51a16 16 0 0 1-2-32 25 25 0 0 1 47-3 18 18 0 1 1 7 35Z" fill={`url(#${gradientId})`} />
    <path d="M97 30h1m18 0h1" stroke="#526886" strokeWidth="3" strokeLinecap="round" />
    <path d="M103 41q5-6 10 0" fill="none" stroke="#526886" strokeWidth="2" strokeLinecap="round" />
    <path d="M60 73h100" stroke="#b7c7dc" strokeWidth="2" strokeDasharray="4 5" />
    <rect x="30" y="59" width="34" height="16" rx="4" fill="#687e9d" /><rect x="30" y="78" width="34" height="16" rx="4" fill="#526886" />
    <path d="M36 65h2m-2 19h2" stroke="#d9e8ff" strokeWidth="3" strokeLinecap="round" />
    <path d="m163 62 18-10 18 10Zm4 4h28m-26 3v17m8-17v17m8-17v17m8-17v17m-29 4h34" fill="#c2d3e9" stroke="#97b0d2" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="110" cy="73" r="10" fill="#ef5350" /><path d="m107 70 6 6m0-6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <circle cx="139" cy="20" r="10" fill="#ef5350" /><path d="M139 15v6m0 4v.2" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <text x="181" y="105" textAnchor="middle" fontSize="10" fill="#687e9d">{epos ? 'ePoS' : 'Service'}</text>
  </Box>;
}

export default function FeatureError({ error, onRetry, loading = false, sx }) {
  if (!error) return null;
  if (typeof error === 'string') return <Alert severity="error" sx={sx}>{error}</Alert>;
  const epos = error.kind === 'epos';
  const network = error.kind === 'network';
  return <Box role="alert" lang="ml" sx={{ border: '1px solid #f9dfe3', borderRadius: 3, background: 'linear-gradient(145deg, #fff5f5, #fff9fb)', p: { xs: 2, sm: 3 }, textAlign: 'center', ...sx }}>
    <ServiceArtwork epos={epos} />
    <Typography component="h3" sx={{ color: '#b42318', fontWeight: 800, fontSize: { xs: 18, sm: 20 }, mt: 0.5, mb: 1 }}>വിവരങ്ങൾ ലഭ്യമായില്ല</Typography>
    <Typography sx={{ color: '#34445c', fontSize: 13, lineHeight: 1.9, maxWidth: 420, mx: 'auto' }}>
      {epos ? 'സർക്കാർ ePoS സേവനത്തിൽ നിന്ന് വിവരങ്ങൾ ലഭിക്കുന്നതിൽ താൽക്കാലിക തടസ്സം നേരിടുന്നു.'
        : network ? 'ഇന്റർനെറ്റ് കണക്ഷൻ പരിശോധിച്ച ശേഷം വീണ്ടും ശ്രമിക്കുക.'
          : 'വിവരങ്ങൾ ലഭിക്കുന്നതിൽ താൽക്കാലിക തടസ്സം നേരിടുന്നു.'}
      {!network && ' ദയവായി കുറച്ച് സമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.'}
    </Typography>
    {onRetry && <Button type="button" variant="outlined" disabled={loading} onClick={onRetry}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <span aria-hidden="true">↻</span>}
      sx={{ mt: 2, minHeight: 42, borderRadius: 2, bgcolor: '#fff', textTransform: 'none', fontSize: 13, fontWeight: 700 }}>
      വീണ്ടും ശ്രമിക്കുക
    </Button>}
  </Box>;
}
