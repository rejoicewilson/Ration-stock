import React from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

function displayTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(date);
}

export default function RecentAccountUsageTable({ accounts, featureNames }) {
  return <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
    <TableContainer tabIndex={0} role="region" aria-label="Recent account usage; scroll horizontally on smaller screens" sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Recently used accounts" sx={{ minWidth: 560, '& .MuiTableCell-root': { px: 2, py: 1.5 } }}>
        <caption style={{ captionSide: 'top', textAlign: 'left', padding: 16, color: '#52647f', fontSize: 13 }}>Most recent first · One row per account · India time (IST)</caption>
        <TableHead sx={{ bgcolor: '#eff4ff' }}><TableRow>
          {['FPS', 'Last used (IST)', 'Latest feature'].map(label => <TableCell key={label} sx={{ fontWeight: 800, color: '#193552' }}>{label}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>
          {accounts.map(account => <TableRow key={account.id} hover>
            <TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>{account.fps_id}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}><time dateTime={account.last_used_at}>{displayTime(account.last_used_at)}</time></TableCell>
            <TableCell>{featureNames[account.last_feature] || 'Other feature'}</TableCell>
          </TableRow>)}
          {!accounts.length && <TableRow><TableCell colSpan={3}><Typography sx={{ py: 2, color: '#64748b' }}>No recorded feature use for matching accounts.</Typography></TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  </Box>;
}
