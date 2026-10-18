import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import useAnimationPreference from './useAnimationPreference';

const motionSelector = '& [data-festival-star], & [data-festival-snow], & [data-festival-tree], & [data-festival-flame], & [data-festival-flower], & [data-festival-petal]';

// Manually selected festival artwork; no automatic scheduling.
export default function FestivalRibbon({ festival }) {
  const [reduced] = useAnimationPreference();
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const changed = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  }, []);
  if (!['christmas', 'navratri'].includes(festival)) return null;
  const pooja = festival === 'navratri';
  return <Box component="section" lang="ml" aria-label={pooja ? 'Navratri greeting' : 'Christmas greeting'} data-testid="festival-ribbon" sx={{
    height: 40, boxSizing: 'border-box', width: '100%', position: 'relative', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, px: 0.75,
    borderRadius: 1.5, border: `1px solid ${pooja ? '#efdfb5' : '#d8e9de'}`,
    background: pooja ? 'linear-gradient(100deg, #fff4d7 0%, #fffdf2 50%, #fff0de 100%)' : 'linear-gradient(100deg, #edf7ef 0%, #fffdf4 50%, #edf7ef 100%)',
    '@keyframes festival-star-glow': { '0%,100%': { opacity: 0.55, transform: 'rotate(-9deg) scale(0.9)' }, '50%': { opacity: 1, transform: 'rotate(9deg) scale(1.12)' } },
    '@keyframes festival-snow-drift': { '0%': { transform: 'translate(0,-14px)', opacity: 0 }, '20%': { opacity: 0.7 }, '100%': { transform: 'translate(6px,42px)', opacity: 0 } },
    '@keyframes festival-tree-sway': { '0%,100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } },
    '@keyframes festival-flame-glow': { '0%,100%': { transform: 'scale(0.92,1) rotate(-3deg)', opacity: 0.8 }, '50%': { transform: 'scale(1.08,1.12) rotate(3deg)', opacity: 1 } },
    '& [data-festival-star]': { animation: 'festival-star-glow 2.8s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' },
    '& [data-festival-snow]': { animation: 'festival-snow-drift 3.8s linear infinite' },
    '& [data-festival-tree]': { animation: 'festival-tree-sway 4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: '50% 100%' },
    '& [data-festival-flame]': { animation: 'festival-flame-glow 2.8s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: '50% 100%' },
    '& [data-festival-flower]': { animation: 'festival-tree-sway 4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: '50% 0%' },
    '& [data-festival-petal]': { animation: 'festival-snow-drift 5s linear infinite' },
    [motionSelector]: {
      animationPlayState: visible ? 'running' : 'paused', ...(reduced ? { animation: 'none' } : {}),
    },
    '@media (prefers-reduced-motion: reduce)': {
      [motionSelector]: { animation: 'none' },
    },
  }}>
    <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {[8, 24, 48, 72, 92].map((left, i) => <Box key={left} component="span" {...(pooja ? { 'data-festival-petal': true } : { 'data-festival-snow': true })} sx={{ position: 'absolute', left: `${left}%`, top: -4, width: pooja ? 4 : i % 2 ? 3 : 2, height: pooja ? 6 : i % 2 ? 3 : 2, borderRadius: pooja ? '70% 0 70% 0' : '50%', bgcolor: pooja ? '#e7b772' : '#97bba9', animationDelay: `${i * -0.7}s` }} />)}
    </Box>
    <Box component="svg" aria-hidden="true" viewBox="0 0 42 38" sx={{ width: 32, height: 36, flexShrink: 0, pointerEvents: 'none' }}>
      {pooja ? <>
        <g data-festival-flame="true"><ellipse cx="21" cy="10" rx="9" ry="10" fill="#ffd36a" opacity=".25" /><path d="M21 1c-1 5-6 6-5 11a5 5 0 0 0 10 0c0-4-4-6-5-11Z" fill="#ef9e2f" /><path d="M21 7c-1 3-3 3-3 6a3 3 0 0 0 6 0c0-2-2-4-3-6Z" fill="#fff0ad" /></g>
        <path d="M10 16q11 9 22 0l-2 5H12Z" fill="#d8a342" /><path d="M21 21v9" stroke="#b67d29" strokeWidth="3" />
        <ellipse cx="21" cy="25" rx="4" ry="1.5" fill="#ecc576" /><path d="m17 30-5 4h18l-5-4Z" fill="#d8a342" /><rect x="10" y="34" width="22" height="2.5" rx="1.2" fill="#b67d29" />
      </> : <>
      <path d="M21 0v7" stroke="#c3ab6d" strokeWidth="1.2" />
      <g data-festival-star="true"><path d="m21 6 4 8 9 1-6.5 6 1.5 9-8-4-8 4 1.5-9L8 15l9-1Z" fill="#eccb70" /><path d="m21 9 2.8 7L21 25l-2.8-9Z" fill="#ffeab0" /></g>
      <g data-festival-snow="true" stroke="#b7cfc0" strokeWidth="1.2" strokeLinecap="round"><path d="M5 22v6m-3-3h6m28-19v6m-3-3h6" /></g>
      </>}
    </Box>
    <Typography sx={{ m: 0, position: 'relative', color: pooja ? '#88521e' : '#236346', fontFamily: '"Noto Sans Malayalam", "Nirmala UI", Kartika, sans-serif', fontSize: { xs: 12, sm: 13 }, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' }}>{pooja ? 'നവരാത്രി ആശംസകൾ' : 'ക്രിസ്മസ് ആശംസകൾ'}</Typography>
    <Box component="svg" aria-hidden="true" viewBox="0 0 42 38" sx={{ width: 32, height: 36, flexShrink: 0, pointerEvents: 'none' }}>
      {pooja ? <g data-festival-flower="true">
        <path d="M12 0v12m16-12v22" stroke="#b88a47" strokeWidth="1.2" />
        {[{ x: 12, y: 17 }, { x: 28, y: 27 }].map(({ x, y }) => <g key={x} transform={`translate(${x} ${y})`}>
          {[0, 60, 120, 180, 240, 300].map(angle => <ellipse key={angle} cy="-4" rx="3" ry="4.5" transform={`rotate(${angle})`} fill={x === 12 ? '#e8a13f' : '#e9bc55'} />)}
          <circle r="3" fill="#a96c2d" />
        </g>)}
        <path d="M16 9q8-7 12 0-8 4-12 0Z" fill="#92ab68" />
      </g> : <>
      <g data-festival-tree="true">
      <rect x="19" y="28" width="5" height="7" rx="1" fill="#b78c65" />
      <path d="m21.5 6-8 11h4l-8 10h5l-7 6h29l-7-6h5l-8-10h4Z" fill="#338366" />
      <path d="m21.5 6 8 11h-4l8 10h-5l7 6h-14Z" fill="#24694f" />
      <path d="m21.5 1 1.5 3 3.5.5-2.5 2.4.5 3.4-3-1.6-3 1.6.5-3.4L17 4.5l3-.5Z" fill="#e5bb58" data-festival-star="true" />
      <circle cx="18" cy="20" r="1.7" fill="#e9c977" /><circle cx="25" cy="27" r="1.7" fill="#dc8e88" /><circle cx="16" cy="30" r="1.3" fill="#fff0b7" />
      </g>
      </>}
    </Box>
  </Box>;
}
