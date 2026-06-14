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
  const currentYear = new Date().getFullYear();
  const monthOptions = [
    ['01', 'January'],
    ['02', 'February'],
    ['03', 'March'],
    ['04', 'April'],
    ['05', 'May'],
    ['06', 'June'],
    ['07', 'July'],
    ['08', 'August'],
    ['09', 'September'],
    ['10', 'October'],
    ['11', 'November'],
    ['12', 'December'],
  ];
  const yearOptions = Array.from({ length: 8 }, (_, index) => String(currentYear - 5 + index));
  const districtOptions = [
    ['14', 'Alappuzha'],
    ['17', 'Ernakulam'],
    ['16', 'Idukki'],
    ['23', 'Kannur'],
    ['24', 'Kasaragod'],
    ['12', 'Kollam'],
    ['15', 'Kottayam'],
    ['21', 'Kozhikode'],
    ['20', 'Malappuram'],
    ['19', 'Palakkad'],
    ['13', 'Pathanamthitta'],
    ['11', 'Thiruvananthapuram'],
    ['18', 'Thrissur'],
    ['22', 'Wayanad'],
  ];
  const afsoOptionsByDistrict = {
    '12': [
      ['07', 'Kollam'],
      ['08', 'Kottarakkara'],
      ['09', 'Pathanapuram'],
      ['10', 'Karunagappally'],
      ['11', 'Kunnathoor'],
      ['72', 'Punalur'],
    ],
    '14': [
      ['17', 'Cherthala'],
      ['18', 'Ambalapuzha'],
      ['19', 'Kuttanad'],
      ['20', 'Karthikappally'],
      ['21', 'Mavelikkara'],
      ['22', 'Chengannur'],
    ],
    '15': [
      ['23', 'Kottayam'],
      ['24', 'Changanachery'],
      ['25', 'Vaikom'],
      ['26', 'Kanjirappally'],
      ['27', 'Meenachil'],
    ],
    '16': [
      ['28', 'Thodupuzha'],
      ['29', 'Devikulam'],
      ['30', 'Udumbanchola'],
      ['31', 'Peerumedu'],
      ['74', 'Idukki'],
    ],
    '17': [
      ['32', 'CRO Ernakulam'],
      ['33', 'CRO Kochi'],
      ['34', 'Kanayannoor'],
      ['35', 'TSO Kochi'],
      ['36', 'Aluva'],
      ['37', 'North Paravoor'],
      ['38', 'Kunnathunadu'],
      ['39', 'Kothamangalam'],
      ['40', 'Moovattupuzha'],
    ],
    '18': [
      ['41', 'Thrissur'],
      ['42', 'Thalappilly'],
      ['43', 'Mukundapuram'],
      ['44', 'Chavakkad'],
      ['45', 'Kodungalloor'],
      ['75', 'Chalakkudy'],
      ['82', 'Kunnamkulam'],
    ],
    '23': [
      ['65', 'Thaliparambu'],
      ['66', 'Kannur'],
      ['67', 'Thalassery'],
      ['79', 'Iritty'],
      ['83', 'Payyannur'],
    ],
    '24': [
      ['68', 'Kasaragod'],
      ['69', 'Hosdurg'],
      ['80', 'Vellarikundu'],
      ['81', 'Manjeswaram'],
    ],
  };
  const [activeView, setActiveView] = useState('stock');
  const [picker, setPicker] = useState(null);
  const [pendingPickerValue, setPendingPickerValue] = useState('');
  const [form, setForm] = useState({
    fps_id: '',
    month: '',
    year: '',
    rice_bag_weight: '50',
    wheat_bag_weight: '50',
    sugar_bag_weight: '50',
    atta_bag_weight: '50',
  });
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
    if (e.target.name === 'dist_code') {
      const nextAfsoOptions = afsoOptionsByDistrict[e.target.value] || [];
      setTransactionForm({
        ...transactionForm,
        dist_code: e.target.value,
        afso: nextAfsoOptions[0]?.[0] || '',
      });
      return;
    }
    setTransactionForm({ ...transactionForm, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.month || !form.year) {
      setError('Please select month and year.');
      return;
    }
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
          rice_bag_weight: Number(form.rice_bag_weight),
          wheat_bag_weight: Number(form.wheat_bag_weight),
          sugar_bag_weight: Number(form.sugar_bag_weight),
          atta_bag_weight: Number(form.atta_bag_weight),
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
    if (!transactionForm.afso) {
      setTransactionsError('AFSO list is not added for the selected district yet. Please share this district AFSO list.');
      return;
    }
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

  const renderSelectControl = ({ selectKey, name, value, onChange, placeholder, options, pickerType, disabled = false }) => {
    const selectedOption = options.find((option) => {
      const optionValue = Array.isArray(option) ? option[0] : option;
      return optionValue === value;
    });
    const selectedLabel = selectedOption
      ? Array.isArray(selectedOption)
        ? pickerType === 'month'
          ? selectedOption[1].slice(0, 3)
          : selectedOption[1]
        : selectedOption
      : placeholder;

    return (
      <Box sx={{ position: 'relative', mt: 0.5 }}>
        <Box
          component="button"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setPendingPickerValue(value || '');
            setPicker({ selectKey, name, value, onChange, placeholder, options, pickerType });
          }}
          sx={{
            width: '100%',
            height: 52,
            px: 1.4,
            borderRadius: 3,
            border: picker?.selectKey === selectKey ? '1px solid #2f64f8' : '1px solid #dfe5f0',
            background: '#ffffff',
            boxShadow: picker?.selectKey === selectKey
              ? '0 0 0 4px rgba(47, 100, 248, 0.12), 0 12px 24px rgba(31, 63, 130, 0.10)'
              : '0 8px 18px rgba(31, 63, 130, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.8,
            color: value ? '#17233c' : '#8b93a4',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.68 : 1,
            textAlign: 'left',
          }}
        >
          <Typography
            component="span"
            sx={{
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: { xs: 13, sm: 14 },
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {selectedLabel}
          </Typography>
          <Box
            sx={{
              width: 9,
              height: 9,
              mr: 0.5,
              borderRight: '2px solid #7b8395',
              borderBottom: '2px solid #7b8395',
              transform: 'translateY(-25%) rotate(45deg)',
              transition: 'transform 0.16s ease',
              flex: '0 0 auto',
            }}
          />
        </Box>
      </Box>
    );
  };

  const renderPickerModal = () => {
    if (!picker) return null;

    const columnCount = picker.pickerType === 'month' ? 4 : picker.pickerType === 'district' ? 1 : 3;

    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          background: 'rgba(15, 23, 42, 0.42)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: 'min(100%, 390px)',
            borderRadius: 5,
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            boxShadow: '0 26px 70px rgba(15, 23, 42, 0.28)',
          }}
        >
          <Box sx={{ px: 2.4, pt: 2.4, pb: 1.2 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#17233c', mb: 0.4 }}>
              {picker.placeholder}
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#8a94a7', mb: 2 }}>
              Tap one option, then confirm
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: 1.1,
                py: 0.5,
                maxHeight: picker.pickerType === 'district' ? 330 : 'none',
                overflowY: picker.pickerType === 'district' ? 'auto' : 'visible',
              }}
            >
              {picker.options.map((option) => {
                const optionValue = Array.isArray(option) ? option[0] : option;
                const optionLabel = Array.isArray(option) ? option[1] : option;
                const displayLabel = picker.pickerType === 'month' ? optionLabel.slice(0, 3) : optionLabel;
                const selected = optionValue === pendingPickerValue;

                return (
                  <Box
                    component="button"
                    type="button"
                    key={optionValue}
                    onClick={() => setPendingPickerValue(optionValue)}
                    sx={{
                      width: '100%',
                      minHeight: picker.pickerType === 'month' ? 58 : picker.pickerType === 'district' ? 46 : 52,
                      border: 0,
                      borderRadius: 4,
                      background: selected ? '#2563eb' : '#ffffff',
                      color: selected ? '#ffffff' : '#20242c',
                      boxShadow: selected
                        ? '0 12px 24px rgba(37, 99, 235, 0.28)'
                        : 'inset 0 0 0 1px #edf1f7',
                      fontSize: picker.pickerType === 'month' ? 18 : picker.pickerType === 'district' ? 14 : 16,
                      fontWeight: selected ? 900 : 800,
                      cursor: 'pointer',
                      transition: 'background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease',
                      '&:active': {
                        transform: 'scale(0.97)',
                      },
                    }}
                  >
                    {displayLabel}
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              px: 2.4,
              pt: 1,
              pb: 2.2,
            }}
          >
            <Button
              type="button"
              onClick={() => setPicker(null)}
              sx={{
                color: '#64748b',
                fontWeight: 900,
                fontSize: 14,
                textTransform: 'none',
                borderRadius: 3,
                px: 2,
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pendingPickerValue) return;
                picker.onChange({ target: { name: picker.name, value: pendingPickerValue } });
                setPicker(null);
              }}
              sx={{
                color: '#ffffff',
                bgcolor: '#2563eb',
                fontWeight: 900,
                fontSize: 14,
                textTransform: 'none',
                borderRadius: 3,
                px: 2.4,
                boxShadow: '0 10px 22px rgba(37, 99, 235, 0.26)',
                '&:hover': { bgcolor: '#1d4ed8' },
              }}
            >
              OK
            </Button>
          </Box>
        </Paper>
      </Box>
    );
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
      {renderPickerModal()}
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
                  padding: '14px',
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
                  display: 'none',
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
                {renderSelectControl({
                  selectKey: 'stock-month',
                  name: 'month',
                  value: form.month,
                  onChange: handleChange,
                  placeholder: 'Select month',
                  options: monthOptions,
                  pickerType: 'month',
                })}
              </Grid>
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                  YEAR *
                </Typography>
                {renderSelectControl({
                  selectKey: 'stock-year',
                  name: 'year',
                  value: form.year,
                  onChange: handleChange,
                  placeholder: 'Select year',
                  options: yearOptions,
                  pickerType: 'year',
                })}
                <Box
                  sx={{
                    position: 'relative',
                    top: '-52px',
                    left: '12px',
                    width: 24,
                    height: 24,
                    display: 'none',
                    placeItems: 'center',
                    color: '#6d7584',
                    pointerEvents: 'none',
                  }}
                >
                  🗓️
                </Box>
              </Grid>
            </Grid>

            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#6d7584', mb: 1 }}>
                BAG WEIGHT (KG)
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  ['rice_bag_weight', 'RICE'],
                  ['wheat_bag_weight', 'WHEAT'],
                  ['sugar_bag_weight', 'SUGAR'],
                  ['atta_bag_weight', 'ATTA'],
                ].map(([name, label]) => (
                  <Grid item xs={6} key={name}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#7b8395', mb: 0.5 }}>
                      {label}
                    </Typography>
                    <Box
                      component="input"
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      required
                      type="number"
                      min={1}
                      step="0.1"
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: 12,
                        border: '1px solid #dfe5f0',
                        background: '#fbfcff',
                        outline: 'none',
                        fontSize: 15,
                        fontWeight: 700,
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

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
                    ['dist_code', 'DISTRICT'],
                    ['afso', 'AFSO'],
                    ['fps_id', 'FPS ID'],
                    ['month', 'MONTH'],
                    ['year', 'YEAR'],
                  ].map(([name, label]) => (
                    <Grid item xs={name === 'fps_id' ? 12 : 6} key={name}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                        {label} *
                      </Typography>
                      {name === 'dist_code' ? (
                        renderSelectControl({
                          selectKey: 'transactions-district',
                          name,
                          value: transactionForm[name],
                          onChange: handleTransactionChange,
                          placeholder: 'Select district',
                          options: districtOptions,
                          pickerType: 'district',
                        })
                      ) : name === 'afso' ? (
                        renderSelectControl({
                          selectKey: 'transactions-afso',
                          name,
                          value: transactionForm[name],
                          onChange: handleTransactionChange,
                          placeholder: afsoOptionsByDistrict[transactionForm.dist_code]?.length
                            ? 'Select AFSO'
                            : 'AFSO list pending',
                          options: afsoOptionsByDistrict[transactionForm.dist_code] || [],
                          pickerType: 'district',
                          disabled: !(afsoOptionsByDistrict[transactionForm.dist_code]?.length),
                        })
                      ) : name === 'month' || name === 'year' ? (
                        renderSelectControl({
                          selectKey: `transactions-${name}`,
                          name,
                          value: transactionForm[name],
                          onChange: handleTransactionChange,
                          placeholder: name === 'month' ? 'Select month' : 'Select year',
                          options: name === 'month' ? monthOptions : yearOptions,
                          pickerType: name === 'month' ? 'month' : 'year',
                        })
                      ) : (
                        <Box
                          component="input"
                          name={name}
                          value={transactionForm[name]}
                          onChange={handleTransactionChange}
                          required
                          type="number"
                          placeholder={label}
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
                      )}
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
                      Collection Summary
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

                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background: '#ffffff',
                    border: '1px solid #e8edf7',
                    boxShadow: '0 12px 28px rgba(26, 58, 109, 0.08)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#7b8395', fontWeight: 800, letterSpacing: 0.4 }}>
                    TOTAL AMOUNT COLLECTED
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#2f64f8', mt: 1 }}>
                    Rs. {formatStatValue(transactionsResult.summary?.total_amount || 0, '')}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={4}>
                      {renderStat('TRANSACTIONS', transactionsResult.summary?.transaction_count || 0)}
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      {renderStat('FROM', toEposDate(transactionForm.from_date))}
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      {renderStat('TO', toEposDate(transactionForm.to_date))}
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={1.5}>
                    {[
                      ['WHEAT', 'wheat'],
                      ['ATTA', 'atta'],
                      ['RR', 'rr'],
                      ['BR', 'br'],
                      ['CMR', 'cmr'],
                      ['SUGAR', 'sugar'],
                      ['KOIL', 'koil'],
                    ].map(([label, key]) => (
                      <Grid item xs={6} sm={3} key={key}>
                        {renderStat(
                          label,
                          formatStatValue(
                            transactionsResult.summary?.commodity_totals?.[key] || 0,
                            key === 'koil' ? 'ltr' : 'kg'
                          )
                        )}
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
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
