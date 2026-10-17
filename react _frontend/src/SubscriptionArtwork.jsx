import React from 'react';
import { SvgIcon } from '@mui/material';

export function SubscriptionHero() {
  return <SvgIcon aria-hidden="true" viewBox="0 0 240 144" sx={{ width: { xs: 150, sm: 180 }, maxWidth: '100%', height: { xs: 90, sm: 108 }, display: 'block', mx: 'auto', overflow: 'visible' }}>
    <ellipse cx="120" cy="128" rx="91" ry="9" fill="#071b59" opacity=".22" />
    <circle cx="120" cy="72" r="63" fill="#fff" opacity=".07" />
    <circle cx="120" cy="72" r="49" fill="#fff" opacity=".05" />
    <rect x="69" y="46" width="107" height="79" rx="10" fill="#cfdefc" />
    <rect x="73" y="45" width="99" height="76" rx="8" fill="#fff" />
    <path d="m80 29-14 25h112l-14-25H80Z" fill="#ffd665" />
    <path d="M80 29h17l-8 25H66l14-25Zm35 0h17l4 25h-29l8-25Zm34 0h15l14 25h-23l-6-25Z" fill="#ff9b54" />
    <path d="M66 54h23v5a11.5 11.5 0 0 1-23 0v-5Zm41 0h29v5a14.5 14.5 0 0 1-29 0v-5Zm48 0h23v5a11.5 11.5 0 0 1-23 0v-5Z" fill="#f28243" />
    <path d="M89 54h18v5a9 9 0 0 1-18 0v-5Zm47 0h19v5a9.5 9.5 0 0 1-19 0v-5Z" fill="#ffe7a4" />
    <rect x="85" y="79" width="32" height="42" rx="4" fill="#d9e7ff" />
    <rect x="91" y="85" width="20" height="24" rx="2" fill="#9ebff8" />
    <circle cx="109" cy="112" r="2" fill="#4c70af" />
    <rect x="126" y="79" width="33" height="25" rx="4" fill="#b4d1ff" />
    <path d="M142.5 80v23M127 91.5h31" stroke="#fff" strokeWidth="2" />
    <rect x="29" y="57" width="49" height="43" rx="9" fill="#102a70" opacity=".16" />
    <rect x="25" y="53" width="49" height="43" rx="9" fill="#fff" />
    <path d="m37 64 12-6 12 6v15l-12 6-12-6V64Z" fill="#e1f6ec" />
    <path d="m38 65 11 5 11-5M49 70v13" fill="none" stroke="#26a77c" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="m38 65 11-5 11 5v13l-11 5-11-5V65Z" fill="none" stroke="#26a77c" strokeWidth="2.5" strokeLinejoin="round" />
    <rect x="165" y="72" width="52" height="45" rx="9" fill="#102a70" opacity=".16" />
    <rect x="161" y="68" width="52" height="45" rx="9" fill="#fff" />
    <rect x="171" y="91" width="6" height="12" rx="2" fill="#c5c5ff" />
    <rect x="182" y="83" width="6" height="20" rx="2" fill="#9699f7" />
    <rect x="193" y="77" width="6" height="26" rx="2" fill="#6566e8" />
    <circle cx="183" cy="34" r="15" fill="#83e2bb" />
    <path d="m176 34 5 5 9-10" fill="none" stroke="#116c51" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m46 25 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Zm153 20 1.5 4.5L205 51l-4.5 1.5L199 57l-1.5-4.5L193 51l4.5-1.5L199 45Z" fill="#ffd665" />
    <circle cx="29" cy="111" r="3" fill="#90beff" />
    <circle cx="216" cy="29" r="2" fill="#9cd9ff" />
  </SvgIcon>;
}

export function SubscriptionFeatureIcon({ kind }) {
  return <SvgIcon aria-hidden="true" viewBox="0 0 48 48" sx={{ width: 46, height: 46, display: 'block' }}>
    {kind === 'stock' ? <>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="#e7f8f0" />
      <path d="m24 10 13 7v15l-13 7-13-7V17l13-7Z" fill="#27b486" />
      <path d="m11 17 13 7 13-7-13-7-13 7Z" fill="#77dfb9" />
      <path d="M24 24v15l13-7V17l-13 7Z" fill="#169675" />
      <path d="m18 13 13 7v6l-5 3v-6l-13-7 5-3Z" fill="#c4f6e2" />
    </> : kind === 'chart' ? <>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="#edf0ff" />
      <rect x="10" y="26" width="7" height="12" rx="2.5" fill="#b3bdff" />
      <rect x="21" y="20" width="7" height="18" rx="2.5" fill="#7e93f6" />
      <rect x="32" y="12" width="7" height="26" rx="2.5" fill="#4e65dd" />
      <path d="m11 21 10-8 6 2 8-7m-6 0h6v6" fill="none" stroke="#4057c3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </> : <>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="#fff2e2" />
      <rect x="13" y="8" width="24" height="32" rx="5" fill="#e59a43" />
      <rect x="10" y="8" width="24" height="32" rx="5" fill="#ffbe67" />
      <rect x="14" y="12" width="16" height="8" rx="2" fill="#fff8e7" />
      <path d="M15 26h2m6 0h2m-10 7h2m6 0h2" stroke="#a96820" strokeWidth="3" strokeLinecap="round" />
      <circle cx="35" cy="35" r="9" fill="#66d6ad" />
      <path d="m31 35 3 3 5-6" fill="none" stroke="#126c52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>}
  </SvgIcon>;
}
