import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import attaIcon from './assets/atta-flour.svg';
import sugarIcon from './assets/sugar-cubes.svg';

// Same-origin by default in production; override locally with VITE_API_URL if needed.
const API_URL = import.meta.env.VITE_API_URL || '/count';
const TRANSACTIONS_API_URL = import.meta.env.VITE_TRANSACTIONS_API_URL || '/transactions';

const todayForDateInput = () => new Date().toISOString().slice(0, 10);

const toEposDate = (value) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
};

export default function App() {
  const [activeView, setActiveView] = useState('stock');
  const [form, setForm] = useState({ fps_id: '', month: '', year: '' });
  const [transactionForm, setTransactionForm] = useState({
    from_date: todayForDateInput(),
    to_date: todayForDateInput(),
    dist_code: '18',
    afso: '42',
    fps_id: '',
    month: String(new Date().getMonth() + 1).padStart(2, '0'),
    year: String(new Date().getFullYear()),
  });
  const [loading, setLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionsError, setTransactionsError] = useState('');
  const [result, setResult] = useState(null);
  const [transactionsResult, setTransactionsResult] = useState(null);

  const summarySections = [
    { key: 'RAW_RICE', label: 'RAW RICE', icon: '🍚', color: '#e9d7d7ff' },
    { key: 'BOILED_RICE', label: 'BOILED RICE', icon: '🍚', color: '#d0873a' },
    { key: 'MATTA_CMR', label: 'MATTA CMR', icon: '🍚', color: '#eeb5b5ff' },
    { key: 'WHEAT', label: 'WHEAT', icon: '🌾', color: '#e8b24c' },
    { key: 'SUGAR', label: 'SUGAR', icon: sugarIcon, iconType: 'image', color: '#70a7ff' },
    { key: 'ATTA', label: 'ATTA', icon: attaIcon, iconType: 'image', color: '#d7a16c' },
    { key: 'KOIL', label: 'KOIL', icon: '🛢️', color: '#8a6bff' },
  ];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleTransactionChange = (e) => {
    setTransactionForm({ ...transactionForm, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fps_id: Number(form.fps_id),
          month: Number(form.month),
          year: Number(form.year),
        }),
      });
      const responseText = await res.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { detail: responseText || 'Server returned an empty response' };
      }
      if (!res.ok) {
        const requestId = res.headers.get('X-Request-ID');
        const detail = data?.detail || data?.message || 'Server error';
        const suffix = requestId ? ` Request ID: ${requestId}` : '';
        throw new Error(`Backend error ${res.status}: ${detail}.${suffix}`);
      }
      setResult(data);
    } catch (err) {
      console.error('Stock fetch failed:', err);
      setError(err.message || 'Failed to fetch data. Please check your input and backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionsSubmit = async (e) => {
    e.preventDefault();
    setTransactionsLoading(true);
    setTransactionsError('');
    setTransactionsResult(null);
    try {
      const res = await fetch(TRANSACTIONS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_date: toEposDate(transactionForm.from_date),
          to_date: toEposDate(transactionForm.to_date),
          dist_code: Number(transactionForm.dist_code),
          afso: Number(transactionForm.afso),
          fps_id: Number(transactionForm.fps_id),
          month: Number(transactionForm.month),
          year: Number(transactionForm.year),
        }),
      });
      const responseText = await res.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { detail: responseText || 'Server returned an empty response' };
      }
      if (!res.ok) {
        const requestId = res.headers.get('X-Request-ID');
        const detail = data?.detail || data?.message || 'Server error';
        const suffix = requestId ? ` Request ID: ${requestId}` : '';
        throw new Error(`Backend error ${res.status}: ${detail}.${suffix}`);
      }
      setTransactionsResult(data);
    } catch (err) {
      console.error('Transactions fetch failed:', err);
      setTransactionsError(err.message || 'Failed to fetch transactions.');
    } finally {
      setTransactionsLoading(false);
    }
  };

  const getStat = (sectionKey, suffix, fallback = '0 kg') => {
    if (!result) return fallback;
    const value = result[`${sectionKey}_${suffix}`];
    return value ?? fallback;
  };

  const formatStatValue = (value, defaultUnit = '') => {
    if (value === undefined || value === null) return defaultUnit ? `0 ${defaultUnit}` : '0';

    let unit = defaultUnit;
    let numeric = value;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const match = trimmed.match(/^(-?[0-9]+(?:\.[0-9]+)?)/);
      if (match) {
        numeric = parseFloat(match[1]);
        const remainder = trimmed.slice(match[1].length).trim();
        unit = remainder || unit;
      } else {
        return trimmed;
      }
    }

    if (typeof numeric === 'number' && Number.isFinite(numeric)) {
      const formatted = numeric.toFixed(2).replace(/\.?0+$/, '');
      return unit ? `${formatted} ${unit}` : formatted;
    }

    return String(value);
  };

  const renderStat = (label, value) => (
    <Box
      sx={{
        flex: 1,
        bgcolor: '#f7f8fb',
        borderRadius: 2,
        py: 1.5,
        px: 1,
        textAlign: 'center',
        border: '1px dashed #e3e7ef',
      }}
    >
      <Typography variant="caption" sx={{ color: '#7b8395', fontWeight: 700, letterSpacing: 0.3 }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );

  const commodityLabels = [
    ['wheat', 'Wheat'],
    ['atta', 'Atta'],
    ['rr', 'RR'],
    ['br', 'BR'],
    ['cmr', 'CMR'],
    ['sugar', 'Sugar'],
    ['koil', 'Koil'],
    ['frr', 'FRR'],
    ['fbr', 'FBR'],
    ['fkoil', 'FKoil'],
    ['pl_fbr', 'PL FBR'],
    ['free_kit', 'Free Kit'],
    ['free_kit_spl', 'Free Kit SPL'],
    ['sub_kit', 'Sub Kit'],
  ];

  const nonZeroCommodities = (transaction) =>
    commodityLabels
      .map(([key, label]) => ({ label, value: transaction[key] }))
      .filter((item) => {
        const numeric = Number(item.value);
        return Number.isFinite(numeric) && numeric !== 0;
      });

  const renderTransaction = (transaction) => {
    const commodities = nonZeroCommodities(transaction);

    return (
      <Paper
        key={`${transaction.receipt_no}-${transaction.sl_no}`}
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          background: '#ffffff',
          border: '1px solid #e8edf7',
          boxShadow: '0 10px 24px rgba(26, 58, 109, 0.07)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 800 }}>RC {transaction.rc_no}</Typography>
            <Typography variant="caption" sx={{ color: '#6d7584', fontWeight: 700 }}>
              {transaction.scheme} | {transaction.receipt_date} | {transaction.time}
            </Typography>
          </Box>
          <Typography sx={{ color: '#2f64f8', fontWeight: 800 }}>
            Rs. {formatStatValue(transaction.amount, '')}
          </Typography>
        </Box>
        <Divider sx={{ mb: 1.2 }} />
        <Grid container spacing={1}>
          {commodities.length ? (
            commodities.map((item) => (
              <Grid item xs={4} key={item.label}>
                <Box sx={{ bgcolor: '#f7f8fb', borderRadius: 2, px: 1, py: 0.8, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#7b8395', fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 800 }}>{formatStatValue(item.value, '')}</Typography>
                </Box>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ color: '#7b8395' }}>
                No commodity quantity recorded.
              </Typography>
            </Grid>
          )}
        </Grid>
        <Typography variant="caption" sx={{ display: 'block', mt: 1.2, color: '#7b8395' }}>
          Receipt {transaction.receipt_no} | {transaction.trans_type} | Auth {transaction.auth_trans_time}
        </Typography>
      </Paper>
    );
  };

  const monthYearLabel = () => {
    if (!form.month || !form.year) return '';
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const idx = Math.min(Math.max(Number(form.month) - 1, 0), 11);
    return `${monthNames[idx]} ${form.year}`;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f4f6fb',
        background: 'linear-gradient(180deg, #e8f0ff 0%, #f5f7fb 40%, #f6f8fc 100%)',
        pb: 12,
      }}
    >
      <Container maxWidth="sm" sx={{ pt: 3, pb: 10 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Ration Stock
            </Typography>
            <Typography variant="body2" sx={{ color: '#6d7584' }}>
              Manage your inventory
            </Typography>
          </Box>
          <Paper
            elevation={0}
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(145deg, #ffffff 0%, #eef2f9 100%)',
              border: '1px solid #e5e9f2',
            }}
          >
            <span role="img" aria-label="bell" style={{ fontSize: 20 }}>
              🔔
            </span>
          </Paper>
        </Box>

        {activeView === 'stock' ? (
          <>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            background: '#ffffff',
            boxShadow: '0 20px 40px rgba(104, 141, 255, 0.12)',
            border: '1px solid #e8edf7',
            mb: 3,
          }}
        >
          <Stack spacing={2} component="form" onSubmit={handleSubmit}>
            <Stack spacing={1.5}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                FPS ID *
              </Typography>
              <Box
                component="input"
                name="fps_id"
                value={form.fps_id}
                onChange={handleChange}
                required
                type="number"
                placeholder="Enter FPS ID"
                style={{
                  width: '100%',
                  padding: '14px 14px 14px 44px',
                  borderRadius: 12,
                  border: '1px solid #dfe5f0',
                  background: '#fbfcff',
                  outline: 'none',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              />
              <Box
                sx={{
                  position: 'relative',
                  top: '-54px',
                  left: '12px',
                  width: 24,
                  height: 24,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#6d7584',
                  pointerEvents: 'none',
                }}
              >
                🔐
              </Box>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                  MONTH *
                </Typography>
                <Box
                  component="input"
                  name="month"
                  value={form.month}
                  onChange={handleChange}
                  required
                  type="number"
                  placeholder="MM"
                  min={1}
                  max={12}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    border: '1px solid #dfe5f0',
                    background: '#fbfcff',
                    outline: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                  YEAR *
                </Typography>
                <Box
                  component="input"
                  name="year"
                  value={form.year}
                  onChange={handleChange}
                  required
                  type="number"
                  placeholder="YYYY"
                  min={2000}
                  max={2100}
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 44px',
                    borderRadius: 12,
                    border: '1px solid #dfe5f0',
                    background: '#fbfcff',
                    outline: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                />
                <Box
                  sx={{
                    position: 'relative',
                    top: '-52px',
                    left: '12px',
                    width: 24,
                    height: 24,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#6d7584',
                    pointerEvents: 'none',
                  }}
                >
                  🗓️
                </Box>
              </Grid>
            </Grid>

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={!loading ? '🔎' : null}
              sx={{
                py: 1.4,
                fontSize: 15,
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2767f7 0%, #2255e6 100%)',
                boxShadow: '0 12px 24px rgba(36, 94, 255, 0.35)',
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Get Stock Summary'}
            </Button>
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Summary
              </Typography>
              <Typography variant="body2" sx={{ color: '#3b63f4', fontWeight: 700 }}>
                {monthYearLabel()}
              </Typography>
            </Box>

            <Stack spacing={2.5}>
              {summarySections.map((section) => {
                const cbKey = 'cb_sum';
                const bagKey = 'bag_count';
                const remainingKey = section.key === 'KOIL' ? 'remaining_ltr' : 'remaining_kg';

                const cbValue = formatStatValue(
                  getStat(section.key, cbKey, section.key === 'KOIL' ? '0 ltr' : '0 kg'),
                  section.key === 'KOIL' ? 'ltr' : 'kg'
                );
                const bagsValue =
                  section.key === 'KOIL'
                    ? '–'
                    : formatStatValue(getStat(section.key, bagKey, '0'), '');
                const remainingValue = formatStatValue(
                  getStat(section.key, remainingKey, section.key === 'KOIL' ? '0 ltr' : '0 kg'),
                  section.key === 'KOIL' ? 'ltr' : 'kg'
                );

                return (
                  <Paper
                    key={section.key}
                    elevation={0}
                    sx={{
                      p: 2.2,
                      borderRadius: 3,
                      background: '#ffffff',
                      border: '1px solid #e8edf7',
                      boxShadow: '0 12px 28px rgba(26, 58, 109, 0.08)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 1.4 }}>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          background: `${section.color}1a`,
                          fontSize: 20,
                        }}
                      >
                        {section.iconType === 'image' ? (
                          <img src={section.icon} alt={section.label} style={{ width: 26, height: 26 }} />
                        ) : (
                          section.icon
                        )}
                      </Box>
                      <Typography sx={{ fontWeight: 800, letterSpacing: 0.3 }}>
                        {section.label}
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 1.5 }} />
                    <Stack direction="row" spacing={1.5}>
                      {renderStat('CB SUM', cbValue)}
                      {renderStat('BAGS', bagsValue)}
                      {renderStat('REMAINING', remainingValue)}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 2.5, color: '#6d7584', textAlign: 'center' }}
            >
              Data sourced from{' '}
              <a
                href="https://epos.kerala.gov.in/FPS_Stock.jsp"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#2f64f8', fontWeight: 700 }}
              >
                epos.kerala.gov.in
              </a>
            </Typography>
          </Box>
        )}
          </>
        ) : (
          <>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                background: '#ffffff',
                boxShadow: '0 20px 40px rgba(104, 141, 255, 0.12)',
                border: '1px solid #e8edf7',
                mb: 3,
              }}
            >
              <Stack spacing={2} component="form" onSubmit={handleTransactionsSubmit}>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      FROM DATE *
                    </Typography>
                    <Box
                      component="input"
                      name="from_date"
                      value={transactionForm.from_date}
                      onChange={handleTransactionChange}
                      required
                      type="date"
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: 12,
                        border: '1px solid #dfe5f0',
                        background: '#fbfcff',
                        outline: 'none',
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      TO DATE *
                    </Typography>
                    <Box
                      component="input"
                      name="to_date"
                      value={transactionForm.to_date}
                      onChange={handleTransactionChange}
                      required
                      type="date"
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: 12,
                        border: '1px solid #dfe5f0',
                        background: '#fbfcff',
                        outline: 'none',
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={1.5}>
                  {[
                    ['dist_code', 'DIST CODE'],
                    ['afso', 'AFSO'],
                    ['fps_id', 'FPS ID'],
                    ['month', 'MONTH'],
                    ['year', 'YEAR'],
                  ].map(([name, label]) => (
                    <Grid item xs={name === 'fps_id' ? 12 : 6} key={name}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                        {label} *
                      </Typography>
                      <Box
                        component="input"
                        name={name}
                        value={transactionForm[name]}
                        onChange={handleTransactionChange}
                        required
                        type="number"
                        placeholder={label}
                        min={name === 'month' ? 1 : undefined}
                        max={name === 'month' ? 12 : undefined}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: 12,
                          border: '1px solid #dfe5f0',
                          background: '#fbfcff',
                          outline: 'none',
                          fontSize: 16,
                          fontWeight: 600,
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={transactionsLoading}
                  startIcon={!transactionsLoading ? '🕑' : null}
                  sx={{
                    py: 1.4,
                    fontSize: 15,
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #2767f7 0%, #2255e6 100%)',
                    boxShadow: '0 12px 24px rgba(36, 94, 255, 0.35)',
                  }}
                >
                  {transactionsLoading ? <CircularProgress size={22} color="inherit" /> : 'Get Transactions'}
                </Button>
              </Stack>
            </Paper>

            {transactionsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {transactionsError}
              </Alert>
            )}

            {transactionsResult && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Transactions
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6d7584', fontWeight: 700 }}>
                      {transactionsResult.row_count || 0} records
                      {transactionsResult.cache_hit ? ' | cached' : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#3b63f4', fontWeight: 700 }}>
                    {Math.round(transactionsResult.total_duration_ms || 0)} ms
                  </Typography>
                </Box>

                {transactionsResult.title && (
                  <Typography variant="body2" sx={{ color: '#6d7584', mb: 1.5, fontWeight: 700 }}>
                    {transactionsResult.title}
                  </Typography>
                )}

                <Stack spacing={1.5}>
                  {(transactionsResult.transactions || []).map(renderTransaction)}
                </Stack>
              </Box>
            )}
          </>
        )}
      </Container>

      {/* Bottom nav */}
      <Paper
        elevation={10}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: '18px 18px 0 0',
          px: 4,
          py: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '600px',
          margin: '0 auto',
        }}
      >
        {[
          { label: 'Stock', icon: '🏠', view: 'stock' },
          { label: 'Transactions', icon: '🕑', view: 'transactions' },
          { label: 'Settings', icon: '⚙️', view: 'settings' },
        ].map((item) => (
          <Box
            key={item.label}
            onClick={() => item.view !== 'settings' && setActiveView(item.view)}
            sx={{
              textAlign: 'center',
              color: activeView === item.view ? '#2f64f8' : '#7b8395',
              cursor: item.view === 'settings' ? 'default' : 'pointer',
            }}
          >
            <div style={{ fontSize: 20 }}>{item.icon}</div>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
