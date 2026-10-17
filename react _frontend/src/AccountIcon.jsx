import React from 'react';
import { SvgIcon } from '@mui/material';

const paths = {
  home: 'm12 3 10 9h-3v9h-5v-6h-4v6H5v-9H2l10-9z',
  stock: 'M12 2 2 7v10l10 5 10-5V7L12 2zm0 2.2L18.6 7 12 10.3 5.4 7 12 4.2zM4 8.6l7 3.5v7.3l-7-3.5V8.6zm9 10.8v-7.3l7-3.5v7.3l-7 3.5z',
  chart: 'M3 3h2v16h16v2H3V3zm5 9 4-4 4 3 5-6 1.5 1.3-6.2 7.4-4.1-3.1-2.8 2.8L8 12z',
  calculator: 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v5h12V4H6zm1 8v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 5v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z',
  refresh: 'M17.6 6.4A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h8V3l-3.4 3.4z',
  arrow: 'm13 5-1.4 1.4 4.6 4.6H3v2h13.2l-4.6 4.6L13 19l7-7-7-7z',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h8V7a4 4 0 0 0-8 0v3zm4 4a2 2 0 0 0-1 3.7V20h2v-2.3a2 2 0 0 0-1-3.7z',
  check: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 15-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z',
  verified: 'm12 1 3 2 3.6.4.8 3.5L22 10l-1 3.5.4 3.6-3.2 1.7L16 22l-4-1-4 1-2.2-3.2-3.2-1.7.4-3.6L2 10l2.6-3.1.8-3.5L9 3l3-2zm-1.4 14.8 6.6-6.6-1.4-1.4-5.2 5.2-2.4-2.4-1.4 1.4 3.8 3.8z',
  password: 'M7 14a5 5 0 1 1 4.6-7H22v4h-3v3h-4v-3h-3.4A5 5 0 0 1 7 14zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  logout: 'M3 3h9v2H5v14h7v2H3V3zm13.6 4 5 5-5 5-1.4-1.4 2.6-2.6H9v-2h9.4l-2.6-2.6L16.6 7z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.3V7z',
  calendar: 'M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zM4 10v10h16V10H4zm0-4v2h16V6H4z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  close: 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5z',
};

export default function AccountIcon({ name, ...props }) {
  return <SvgIcon {...props}><path d={paths[name] || paths.info} /></SvgIcon>;
}
