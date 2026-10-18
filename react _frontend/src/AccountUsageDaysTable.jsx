import React from 'react';
import { Box, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

function displayDay(value) {
  if (!value) return 'Not used yet';
  const date = new Date(`${value}T00:00:00+05:30`);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function AccountUsageDaysTable({ accounts }) {
  return <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
    <TableContainer tabIndex={0} role="region" aria-label="Account usage days; scroll horizontally on smaller screens" sx={{ overflowX: 'auto' }}>
      <Table size="small" aria-label="Days used since registration" sx={{ minWidth: 470, '& .MuiTableCell-root': { px: 2, py: 1.5 } }}>
        <caption style={{ captionSide: 'top', textAlign: 'left', padding: 16, color: '#52647f', fontSize: 13 }}>
          Most days used first · All recorded dates · IST
        </caption>
        <TableHead sx={{ bgcolor: '#eff4ff' }}><TableRow>
          {['FPS', 'Joined on', 'Days used', 'Last used'].map(label => <TableCell key={label} sx={{ fontWeight: 800, color: '#193552' }}>{label}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>
          {accounts.map(account => <TableRow key={account.id} hover>
            <TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>{account.fps_id}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>{displayDay(account.joined_on)}</TableCell>
            <TableCell><Chip size="small" label={account.days_used} sx={{ bgcolor: Number(account.days_used) > 0 ? '#e8f7f0' : '#f1f5f9', color: Number(account.days_used) > 0 ? '#147451' : '#64748b', fontWeight: 800 }} /></TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>{displayDay(account.last_used)}</TableCell>
          </TableRow>)}
          {!accounts.length && <TableRow><TableCell colSpan={4}><Typography sx={{ py: 2, color: '#64748b' }}>No matching accounts.</Typography></TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  </Box>;
}
