import React, { useState } from 'react';
import { Box, Dialog, DialogContent, DialogTitle, FormControlLabel, IconButton, Switch, Typography } from '@mui/material';
import AccountIcon from './AccountIcon';
import useAnimationPreference from './useAnimationPreference';

export default function AnimationSettings() {
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useAnimationPreference();
  return <>
    <IconButton type="button" aria-label="Display settings" title="Display settings" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} sx={{ width: 28, height: 28, color: '#52647f' }}>
      <Box component="svg" aria-hidden="true" viewBox="0 0 24 24" sx={{ width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }}>
        <path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" />
      </Box>
    </IconButton>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs" aria-labelledby="display-settings-title" PaperProps={{ sx: { borderRadius: 3, m: 2 } }}>
      <DialogTitle id="display-settings-title" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 800, color: '#183456' }}>
        Display settings
        <IconButton aria-label="Close display settings" onClick={() => setOpen(false)} sx={{ minWidth: 44, minHeight: 44 }}><AccountIcon name="close" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <FormControlLabel control={<Switch checked={reduced} onChange={event => setReduced(event.target.checked)} inputProps={{ 'aria-label': 'Reduce animations' }} />} label="Reduce animations" />
        <Typography sx={{ mt: 1, color: '#52647f', fontSize: 13, lineHeight: 1.8 }}>Stops festive animations on this browser. Your device’s reduced-motion setting is always respected.</Typography>
      </DialogContent>
    </Dialog>
  </>;
}
