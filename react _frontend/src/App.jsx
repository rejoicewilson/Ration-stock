import React, { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import attaIcon from './assets/atta-flour.svg';
import sugarIcon from './assets/sugar-cubes.svg';

const PrivateShieldIcon = ({ size = 42 }) => (
  <Box
    component="svg"
    viewBox="0 0 512 512"
    sx={{ width: size, height: size, display: 'block' }}
    aria-hidden="true"
  >
    <path
      fill="#dbe3e7"
      d="M256 501c-6 0-12-2-17-5C105 420 38 304 38 151c0-18 13-33 31-36 32-5 52-28 59-69 3-17 17-29 34-29h188c17 0 31 12 34 29 7 41 27 64 59 69 18 3 31 18 31 36 0 153-67 269-201 345-5 3-11 5-17 5Z"
    />
    <path
      fill="#bfc7ca"
      d="M443 115c-32-5-52-28-59-69-3-17-17-29-34-29h-32c7 82 46 154 123 205 2-23 3-47 3-72 0-17-13-32-31-35Z"
      opacity="0.75"
    />
    <path
      fill="#48d597"
      d="M256 470C139 399 80 294 80 156c0-10 7-18 16-21 42-11 69-38 80-80 2-8 9-14 18-14h124c9 0 16 6 18 14 11 42 38 69 80 80 9 3 16 11 16 21 0 138-59 243-176 314Z"
    />
    <path
      fill="#20a095"
      d="M320 41c35 91 71 145 112 162-8 115-66 204-176 267 0 0 119-159 64-429Z"
      opacity="0.6"
    />
    <path
      fill="none"
      stroke="#556070"
      strokeWidth="18"
      strokeLinecap="round"
      d="M196 216v-48c0-38 27-70 60-70s60 32 60 70v48"
    />
    <rect x="154" y="198" width="204" height="142" rx="16" fill="#66717f" />
    <path
      fill="#f4f6f8"
      d="M274 262a18 18 0 1 0-31 13v33a13 13 0 0 0 26 0v-33c3-3 5-8 5-13Z"
    />
  </Box>
);

const RationShopsPeopleIcon = ({ size = 38 }) => (
  <Box
    component="svg"
    viewBox="0 0 512 512"
    sx={{ width: size, height: size, display: 'block' }}
    aria-hidden="true"
  >
    <path
      fill="#2f55a4"
      d="M12 331c28-75 88-120 154-120s126 45 154 120c11 29-10 60-41 60H53c-31 0-52-31-41-60Z"
    />
    <path fill="#1f3569" d="M132 211c70 0 128 57 128 128v52H132V211Z" opacity="0.7" />
    <circle cx="132" cy="160" r="82" fill="#ffcdb9" />
    <path fill="#ffad91" d="M132 78a82 82 0 0 1 0 164V78Z" opacity="0.85" />
    <path
      fill="#4bb4e8"
      d="M192 331c28-75 88-120 154-120s126 45 154 120c11 29-10 60-41 60H233c-31 0-52-31-41-60Z"
    />
    <path fill="#27c7e5" d="M346 211c-70 0-128 57-128 128v52h128V211Z" opacity="0.85" />
    <circle cx="380" cy="160" r="82" fill="#ffcdb9" />
    <path fill="#ffad91" d="M380 78a82 82 0 0 1 0 164V78Z" opacity="0.85" />
    <path
      fill="#ff402f"
      d="M126 382c28-80 78-124 130-124s102 44 130 124c12 34-12 70-48 70H174c-36 0-60-36-48-70Z"
    />
    <path fill="#ff6b17" d="M256 258c-52 0-102 44-130 124-12 34 12 70 48 70h82V258Z" />
    <circle cx="256" cy="224" r="80" fill="#ffb394" />
    <path fill="#ffcdb9" d="M256 144a80 80 0 0 0 0 160V144Z" opacity="0.8" />
  </Box>
);

const SecureReliableIcon = ({ size = 38 }) => (
  <Box
    component="svg"
    viewBox="0 0 512 512"
    sx={{ width: size, height: size, display: 'block' }}
    aria-hidden="true"
  >
    <path
      fill="#ffd65c"
      d="M256 0c67 55 137 84 214 92v160c0 126-84 224-214 260C126 476 42 378 42 252V92c77-8 147-37 214-92Z"
    />
    <path
      fill="#f8b94d"
      d="M256 67c51 40 105 64 161 73v109c0 94-62 169-161 206-99-37-161-112-161-206V140c56-9 110-33 161-73Z"
    />
    <path
      fill="#ffffff"
      d="M220 344 167 291l27-27 26 26 98-98 27 27-125 125Z"
    />
  </Box>
);

const OfficialDataIcon = ({ size = 38 }) => (
  <Box
    component="svg"
    viewBox="0 0 512 512"
    sx={{ width: size, height: size, display: 'block' }}
    aria-hidden="true"
  >
    <circle cx="256" cy="256" r="256" fill="#43b02a" />
    <path
      fill="#ffffff"
      d="M217 364c-12 0-24-5-33-14l-67-67c-18-18-18-47 0-65s47-18 65 0l35 35 112-112c18-18 47-18 65 0s18 47 0 65L250 350c-9 9-21 14-33 14Z"
    />
  </Box>
);

// Same-origin by default in production; override locally with VITE_API_URL if needed.
const API_URL = import.meta.env.VITE_API_URL || '/count';
const TRANSACTIONS_API_URL = import.meta.env.VITE_TRANSACTIONS_API_URL || '/transactions';
const STOCK_REGISTER_API_URL = import.meta.env.VITE_STOCK_REGISTER_API_URL || '/stock-register';
const RO_DETAILS_API_URL = import.meta.env.VITE_RO_DETAILS_API_URL || '/ro-details';
const RO_QUANTITY_DETAILS_API_URL = import.meta.env.VITE_RO_QUANTITY_DETAILS_API_URL || '/ro-quantity-details';
const RATION_CARD_DETAILS_API_URL = import.meta.env.VITE_RATION_CARD_DETAILS_API_URL || '/ration-card-details';

const todayForDateInput = () => new Date().toISOString().slice(0, 10);

const toEposDate = (value) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
};

const calculateCommission = (summary) => {
  const totals = summary?.commodity_totals || {};
  const schemeTotals = summary?.scheme_commodity_totals || {};
  const eligibleKg = ['wheat', 'atta', 'rr', 'br', 'cmr'].reduce(
    (sum, key) => sum + (Number(totals[key]) || 0),
    0
  );
  const riceSchemes = ['NPS', 'NPNS', 'NPI'];
  const attaSchemes = ['NPS', 'NPNS', 'NPI', 'PHH'];
  const riceCollectedKg = riceSchemes.reduce(
    (sum, scheme) => sum + ['rr', 'br', 'cmr'].reduce(
      (schemeSum, key) => schemeSum + (Number(schemeTotals[scheme]?.[key]) || 0),
      0
    ),
    0
  );
  const attaCollectedKg = attaSchemes.reduce(
    (sum, scheme) => sum + (Number(schemeTotals[scheme]?.atta) || 0),
    0
  );
  const wheatCollectedKg = Number(schemeTotals.NPS?.wheat) || 0;
  const alreadyCollectedKg = riceCollectedKg + attaCollectedKg + wheatCollectedKg;
  const alreadyCollectedAmount = alreadyCollectedKg * 2;

  const collectionDetails = {
    riceCollectedKg,
    attaCollectedKg,
    wheatCollectedKg,
    alreadyCollectedKg,
    alreadyCollectedAmount,
  };

  if (eligibleKg <= 0) {
    return {
      ...collectionDetails,
      eligibleKg: 0,
      commission: 0,
      tier: 'No eligible sales',
      formula: 'Commission starts when eligible sales are recorded.',
      requiresOldCommissionCap: false,
    };
  }

  if (eligibleKg <= 1500) {
    return {
      ...collectionDetails,
      eligibleKg,
      commission: 6800,
      tier: 'Tier 1 · Up to 15 quintals',
      formula: 'Fixed commission: Rs. 6,800',
      requiresOldCommissionCap: false,
    };
  }

  if (eligibleKg <= 4500) {
    const calculated = 9000 + eligibleKg * 2.7;
    return {
      ...collectionDetails,
      eligibleKg,
      commission: Math.min(calculated, 21000),
      tier: 'Tier 2 · Above 15 and up to 45 quintals',
      formula: `Rs. 9,000 + (${formatNumber(eligibleKg)} kg × Rs. 2.70)${calculated > 21000 ? ' · capped at Rs. 21,000' : ''}`,
      requiresOldCommissionCap: false,
    };
  }

  const extraKg = eligibleKg - 4500;
  return {
    ...collectionDetails,
    eligibleKg,
    commission: 21000 + extraKg * 2,
    tier: 'Tier 3 · Above 45 quintals',
    formula: `Rs. 21,000 + (${formatNumber(extraKg)} kg × Rs. 2.00)`,
    requiresOldCommissionCap: eligibleKg > 29400,
  };
};

const formatNumber = (value, maximumFractionDigits = 2) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits });

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
    '11': [
      ['01', 'CRO South Thiruvananthapuram'],
      ['02', 'CRO North Thiruvananthapuram'],
      ['03', 'TSO Thiruvananthapuram'],
      ['04', 'Chirayinkeezhu'],
      ['05', 'Nedumangad'],
      ['06', 'Neyyattinkara'],
      ['70', 'Kattakada'],
      ['71', 'Varkala'],
    ],
    '12': [
      ['07', 'Kollam'],
      ['08', 'Kottarakkara'],
      ['09', 'Pathanapuram'],
      ['10', 'Karunagappally'],
      ['11', 'Kunnathoor'],
      ['72', 'Punalur'],
    ],
    '13': [
      ['12', 'Kozhenchery'],
      ['13', 'Thiruvalla'],
      ['14', 'Adoor'],
      ['15', 'Ranni'],
      ['16', 'Mallappally'],
      ['73', 'Konni'],
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
    '19': [
      ['46', 'Palakkad'],
      ['47', 'Chittur'],
      ['48', 'Ottappalam'],
      ['49', 'Mannarkad'],
      ['50', 'Alathur'],
      ['76', 'Pattambi'],
      ['84', 'Attappadi'],
    ],
    '20': [
      ['51', 'Ernad'],
      ['52', 'Nilambur'],
      ['53', 'Perinthalmanna'],
      ['54', 'Thirur'],
      ['55', 'Thirurangadi'],
      ['56', 'Ponnani'],
      ['77', 'Kondotty'],
    ],
    '21': [
      ['57', 'CRO North Kozhikode'],
      ['58', 'CRO South Kozhikode'],
      ['59', 'TSO Kozhikode'],
      ['60', 'Koyilandi'],
      ['61', 'Vadakara'],
      ['78', 'Thamarassery'],
    ],
    '22': [
      ['62', 'Vythiri'],
      ['63', 'Sulthan Bathery'],
      ['64', 'Mananthavady'],
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
  const depotOptionsByDistrict = {
    '11': [
      ['0101903', 'CHALA AWD'],
      ['0101902', 'CHALA AWD(Annex)'],
      ['0104801', 'CHIRAYINKEEZHU PDS(NFSA)SUB DEPOT'],
      ['0102801', 'NEDUMANGAD NFSA GODOWN'],
      ['0104804', 'NFSA DEPOT KALLAMBALAM'],
      ['0102804', 'NFSA DEPOT MUNDELA'],
      ['0103802', 'PDS DEPOT KATTAKADA'],
      ['0104803', 'PDS DEPOT MAMAM'],
      ['0101801', 'PDS DEPOT MENAMKULAM'],
      ['0103801', 'PDS DEPOT NEYYATTINKRA'],
      ['0103803', 'PDS DEPOT PALLICHAL'],
      ['0102803', 'PDS DEPOT PARAKKARA'],
      ['0104802', 'VARKALA PDS(NFSA) SUB DEPOT'],
      ['0102802', 'VENJARAMOOD NFSA SUB DEPOT'],
    ],
    '12': [
      ['0201903', 'CONTONMENT - AWD (KOLLAM MAIN)'],
      ['0202801', 'KARUNAGAPPALLY SUB DEPOT'],
      ['0201905', 'KILIKOLLOOR - AWD, KOLLAM'],
      ['0203801', 'KOTTARAKKARA PDS DEPOT'],
      ['0202802', 'KUNNATHUR SUB DEPOT'],
      ['0201904', 'PARAVOOR AWD, KOLLAM'],
      ['0204802', 'PATHANAPURAM RATION SUB DEPOT'],
      ['0203802', 'PDS DEPOT KADAKKAL'],
      ['0203803', 'PDS DEPOT POOYAPPALLY KOTTARAKKARA'],
      ['0204801', 'PUNALUR RATION SUB DEPOT'],
    ],
    '13': [
      ['0302801', 'AWD ADOOR (PARAKOD)'],
      ['0301802', 'KONNI PDS DEPOT'],
      ['0301801', 'KOZHENCHERRY PDS DEPOT'],
      ['0303801', 'PDS DEPOT KUNNAMTHANAM'],
      ['0304801', 'PDS DEPOT MALLAPPALLY'],
      ['0304802', 'THIRUVALLA PDS SUB DEPOT'],
    ],
    '14': [
      ['0401903', 'ALAPPUZHA AWD (AMBALAPUZHA)'],
      ['0404802', 'CHENGANNUR RATION SUB DEPOT'],
      ['0405801', 'CHERTHALA PDS DEPOT'],
      ['0402801', 'KARTHIKAPPALLY PDS DEPOT'],
      ['0405803', 'NFSA DEPOT VAYALAR'],
      ['0405802', 'PDS DEPOT KALAVAMKODAM'],
      ['0403801', 'PDS DEPOT MAVELIKKARA'],
      ['0401801', 'PDS DEPOT THAKAZY'],
    ],
    '15': [
      ['0504801', 'KANJIRAPPALLY AWD'],
      ['0501802', 'NFSA DEPOT MAVILANG'],
      ['0505802', 'NFSA DEPOT THENGANA'],
      ['0502803', 'NFSA DEPOT VALLICHIRA'],
      ['0502802', 'PDS DEPOT ANDOOR'],
      ['0501801', 'PDS DEPOT KOTTAYAM'],
      ['0502801', 'PDS DEPOT PALA'],
      ['0505801', 'PDS SUB DEPOT CHANGANASERRY'],
      ['0503801', 'PDS SUB DEPOT VAIKOM TALUK'],
    ],
    '16': [
      ['0604801', 'PDS DEPOT KATTAPPANA'],
      ['0603801', 'PDS DEPOT MUNNAR'],
      ['0604802', 'PDS DEPOT NEDUMKANDAM'],
      ['0601801', 'PDS DEPOT THODUPUZHA'],
      ['0602901', 'PEERAMADE DEPOT'],
    ],
    '17': [
      ['0703803', 'ALUVA NFSA SUB DEPOT'],
      ['0705803', 'KOTHAMANGALAM TALUK NFSA DEPOT'],
      ['0703802', 'KUNNATHUNADU NFSA SUB DEPOT'],
      ['0705802', 'MUVATTUPUZHA TALUK NFSA DEPOT'],
      ['0704801', 'NORTH PARAVOOR SUB DEPOT'],
      ['0701802', 'PDS DEPOT CRO ERNAKULAM'],
      ['0702802', 'PDS DEPOT KOCHI (CRO)'],
      ['0702803', 'PDS DEPOT VANIYAKKAD'],
      ['0702801', 'SUB DEPOT KOCHI'],
      ['0701801', 'TRIPPUNITHARA SUB DEPOT'],
    ],
    '18': [
      ['0803807', 'NFSA DEPOT KOTHAPARMB NFSA GODOWN'],
      ['0803804', 'NFSA DEPOT POOVATHUR NFSA GODOWN'],
      ['0803808', 'NFSA GODOWN KOTTAPPURAM NFSA GODOWN'],
      ['0802802', 'PDS DEPOT 2 VELOOR CHUNGAM Thallappaly'],
      ['0803806', 'PDS DEPOT CHAKKARAPPADAM NFSA GODOWN'],
      ['0804801', 'PDS DEPOT CHALAKUDY'],
      ['0803802', 'PDS DEPOT CHAVAKKAD KUNNAMKULAM'],
      ['0803805', 'PDS DEPOT KANDASSANKADAV NFSA GODOWN'],
      ['0803803', 'PDS DEPOT KODUNGALLUR NATTIKA'],
      ['0801904', 'PDS DEPOT KULANGATTUKARA GODOWN'],
      ['0804802', 'PDS DEPOT MUKUNDAPURAM'],
      ['0802801', 'PDS DEPOT THALAPPILLY TALUK'],
      ['0802803', 'PDS Depot Veloor Chungam Kunnamkulam'],
      ['0801903', 'TRISSUR AWD'],
    ],
    '19': [
      ['0905805', 'NFSA DEPOT KODATHIPADI'],
      ['0905807', 'NFSA DEPOT KOTTATHARA'],
      ['0905806', 'NFSA GODOWN PERUMPADARI'],
      ['0905803', 'NFSA PDS GODOWN ATTAPPADI'],
      ['0902802', 'PDS DEPOT ALATHUR'],
      ['0904804', 'PDS DEPOT CHERPULASSERY'],
      ['0902803', 'PDS DEPOT KANNAMBRA'],
      ['0904805', 'PDS DEPOT KOOTTANAD'],
      ['0904802', 'PDS DEPOT KOPPAM'],
      ['0902801', 'PDS DEPOT KOTTAYI'],
      ['0901805', 'PDS DEPOT KOZHINJAMPARA'],
      ['0904801', 'PDS DEPOT MARUTHUR'],
      ['0905804', 'PDS DEPOT MUKKANNAM'],
      ['0901801', 'PDS DEPOT MUTHALAMADA'],
      ['0904807', 'PDS DEPOT OTTAPPALAM'],
      ['0904806', 'PDS DEPOT SREEKRISHNAPURAM'],
      ['0901806', 'PDS GODOWN KANCHIKODE'],
      ['0905802', 'SUPPLYCO SUB DEPOT KUNTHIPPUZHA, MANNARKKAD'],
    ],
    '20': [
      ['1004802', 'PDS DEPOT ANGADIPPURAM'],
      ['1006802', 'PDS DEPOT KONDOTTY'],
      ['1001801', 'PDS DEPOT MANJERI'],
      ['1001802', 'PDS DEPOT MANJERI RAMANKULAM'],
      ['1005804', 'PDS DEPOT NILAMBUR THONDI'],
      ['1004801', 'PDS DEPOT PERINTHALMANNA'],
      ['1004803', 'PDS DEPOT PERINTHALMANNA TOWN'],
      ['1003801', 'PDS DEPOT PONNANI EDAPPAL'],
      ['1002805', 'PDS DEPOT THIRUR KADUGATHUKUNDU'],
      ['1002801', 'PDS Depot Thirur Mangattiri'],
      ['1006801', 'PDS DEPOT TIRURANGADI'],
    ],
    '21': [
      ['1103802', 'NFSA DEPOT PUTHIYAPPU'],
      ['1101801', 'PDS DEPOT KOZHIKODE CRO NORTH'],
      ['1101802', 'PDS DEPOT KOZHIKODE CRO SOUTH'],
      ['1101902', 'PDS DEPOT KOZHIKODE TSO'],
      ['1102801', 'QUILANDY PDS DEPOT'],
      ['1104801', 'SUPPLYCO SUB DEPOT EXTENTION COUNTER KODUVALLY'],
      ['1103801', 'VADAKARA PDS DEPOT'],
    ],
    '22': [
      ['1302801', 'PDS DEPOT MANANTHAVADI'],
      ['1202801', 'PDS DEPOT SULTHAN BATHERY'],
      ['1201801', 'PDS DEPOT VYTHIRI'],
    ],
    '23': [
      ['1302804', 'NFSA GODOWN VELIYAMPARAMBU IRITTY'],
      ['1302802', 'PDS DEPOT IRITTY'],
      ['1301801', 'PDS DEPOT KANNUR'],
      ['1303802', 'PDS DEPOT PAYYANNUR'],
      ['1302803', 'PDS DEPOT THALASSEY'],
      ['1303801', 'PDS DEPOT THALIPARAMBA'],
    ],
    '24': [
      ['1401802', 'KASARAGOD PDS DEPOT'],
      ['1401801', 'MANJESHWARAM PDS DEPOT'],
      ['1402801', 'PDS DEPOT KANJANGAD'],
      ['1402803', 'PDS DEPOT NEELESHWARAM'],
      ['1402802', 'PDS DEPOT VELLARIKKUND'],
      ['1401803', 'VELIYAMPARAMBA'],
    ],
  };
  const [activeView, setActiveView] = useState('home');
  const [picker, setPicker] = useState(null);
  const [pendingPickerValue, setPendingPickerValue] = useState('');
  const [form, setForm] = useState({
    fps_id: '',
    month: '',
    year: '',
    raw_rice_bag_weight: '50',
    boiled_rice_bag_weight: '50',
    matta_cmr_bag_weight: '50',
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
  const [commissionForm, setCommissionForm] = useState({
    from_date: todayForDateInput(),
    to_date: todayForDateInput(),
    dist_code: '18',
    afso: '42',
    fps_id: '',
    month: String(new Date().getMonth() + 1).padStart(2, '0'),
    year: String(new Date().getFullYear()),
  });
  const [stockBoardForm, setStockBoardForm] = useState({
    dist_code: '22',
    office_code: '62',
    fps_id: '',
    month: String(new Date().getMonth() + 1).padStart(2, '0'),
    year: String(new Date().getFullYear()),
  });
  const [settingsForm, setSettingsForm] = useState({
    month: String(new Date().getMonth() + 1).padStart(2, '0'),
    year: String(new Date().getFullYear()),
    shop_no: '',
    dist_code: '18',
    depot_id: '0802801',
  });
  const [rationCardForm, setRationCardForm] = useState({
    src_no: '',
    month: String(new Date().getMonth() + 1).padStart(2, '0'),
    year: String(new Date().getFullYear()),
  });
  const [loading, setLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [stockBoardLoading, setStockBoardLoading] = useState(false);
  const [stockTableOpen, setStockTableOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [rationCardLoading, setRationCardLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionsError, setTransactionsError] = useState('');
  const [commissionError, setCommissionError] = useState('');
  const [stockBoardError, setStockBoardError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [rationCardError, setRationCardError] = useState('');
  const [roQuantityLoading, setRoQuantityLoading] = useState(false);
  const [roQuantityError, setRoQuantityError] = useState('');
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [transactionsResult, setTransactionsResult] = useState(null);
  const [commissionResult, setCommissionResult] = useState(null);
  const [stockBoardResult, setStockBoardResult] = useState(null);
  const [settingsResult, setSettingsResult] = useState(null);
  const [roQuantityResult, setRoQuantityResult] = useState(null);
  const [rationCardResult, setRationCardResult] = useState(null);

  const summarySections = [
    { key: 'RAW_RICE', label: 'RAW RICE', icon: '🍚', color: '#e9d7d7ff' },
    { key: 'BOILED_RICE', label: 'BOILED RICE', icon: '🍚', color: '#d0873a' },
    { key: 'MATTA_CMR', label: 'MATTA CMR', icon: '🍚', color: '#eeb5b5ff' },
    { key: 'WHEAT', label: 'WHEAT', icon: '🌾', color: '#e8b24c' },
    { key: 'SUGAR', label: 'SUGAR', icon: sugarIcon, iconType: 'image', color: '#70a7ff' },
    { key: 'ATTA', label: 'ATTA', icon: attaIcon, iconType: 'image', color: '#d7a16c' },
    { key: 'KOIL', label: 'KOIL', icon: '🛢️', color: '#8a6bff' },
  ];
  const featurePages = [
    { title: 'Stock Summary', category: 'കടയിലെ സ്റ്റോക്ക് നോക്കാൻ', view: 'stock', mark: 'ST', color: '#2563eb', background: '#eff6ff' },
    { title: 'Ration Stock Board', category: 'സ്റ്റോക്ക് ബോർഡ് എഴുതാൻ', view: 'stockBoard', mark: 'RB', color: '#b42318', background: '#fff4e5' },
    { title: 'Transactions', category: 'ദിവസ ചിലവ് / വരവ് അറിയാൻ', view: 'transactions', mark: 'TX', color: '#087f5b', background: '#ecfdf3' },
    { title: 'RO Orders', category: 'സ്വീകരിച്ച സാധനകളുടെ റിപ്പോർട്ട്', view: 'settings', mark: 'RO', color: '#9f1239', background: '#fff1f2' },
    { title: 'Commission Calculator', category: 'റേഷൻ കമ്മിഷൻ നോക്കാൻ', view: 'commission', mark: 'CC', color: '#7c3aed', background: '#f5f3ff' },
    { title: 'Ration Card Details', category: 'റേഷൻ വിഹിതം നോക്കാൻ', view: 'rationCard', mark: 'RC', color: '#0f766e', background: '#ecfeff' },
  ];
  const activeViewTitle = featurePages.find((page) => page.view === activeView)?.title || 'Ration Stock';
  const gaPagePaths = {
    home: '/home',
    stock: '/stock-summary',
    stockBoard: '/stock-board',
    transactions: '/transactions',
    settings: '/ro-orders',
    commission: '/commission',
    rationCard: '/ration-card-details',
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    const pagePath = gaPagePaths[activeView] || '/';
    window.gtag('event', 'page_view', {
      page_title: `Ration Stock - ${activeViewTitle}`,
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
    });
  }, [activeView, activeViewTitle]);

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

  const handleCommissionChange = (e) => {
    if (e.target.name === 'dist_code') {
      const nextAfsoOptions = afsoOptionsByDistrict[e.target.value] || [];
      setCommissionForm({
        ...commissionForm,
        dist_code: e.target.value,
        afso: nextAfsoOptions[0]?.[0] || '',
      });
      return;
    }
    setCommissionForm({ ...commissionForm, [e.target.name]: e.target.value });
  };

  const handleStockBoardChange = (e) => {
    if (e.target.name === 'dist_code') {
      const nextOfficeOptions = afsoOptionsByDistrict[e.target.value] || [];
      setStockBoardForm({
        ...stockBoardForm,
        dist_code: e.target.value,
        office_code: nextOfficeOptions[0]?.[0] || '',
      });
      return;
    }
    setStockBoardForm({ ...stockBoardForm, [e.target.name]: e.target.value });
  };

  const handleSettingsChange = (e) => {
    if (e.target.name === 'dist_code') {
      const nextDepotOptions = depotOptionsByDistrict[e.target.value] || [];
      setSettingsForm({
        ...settingsForm,
        dist_code: e.target.value,
        depot_id: nextDepotOptions[0]?.[0] || '',
      });
      return;
    }
    setSettingsForm({ ...settingsForm, [e.target.name]: e.target.value });
  };

  const handleRationCardChange = (e) => {
    const { name, value } = e.target;
    setRationCardForm({
      ...rationCardForm,
      [name]: name === 'src_no' ? value.replace(/\D/g, '') : value,
    });
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
          raw_rice_bag_weight: Number(form.raw_rice_bag_weight),
          boiled_rice_bag_weight: Number(form.boiled_rice_bag_weight),
          matta_cmr_bag_weight: Number(form.matta_cmr_bag_weight),
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

  const submitTransactionRequest = async (
    e,
    requestForm,
    { isCommission = false, setLoading, setError, setResult }
  ) => {
    e.preventDefault();
    if (
      isCommission
      && (requestForm.from_date < '2026-01-01' || Number(requestForm.year) < 2026)
    ) {
      setError('The new commission rates apply only from January 2026.');
      return;
    }
    if (!requestForm.afso) {
      setError('AFSO list is not added for the selected district yet. Please share this district AFSO list.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(TRANSACTIONS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_date: toEposDate(requestForm.from_date),
          to_date: toEposDate(requestForm.to_date),
          dist_code: Number(requestForm.dist_code),
          afso: requestForm.afso,
          fps_id: Number(requestForm.fps_id),
          month: Number(requestForm.month),
          year: Number(requestForm.year),
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
      console.error(`${isCommission ? 'Commission' : 'Transactions'} fetch failed:`, err);
      setError(err.message || `Failed to fetch ${isCommission ? 'commission data' : 'transactions'}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionsSubmit = (e) => submitTransactionRequest(e, transactionForm, {
    setLoading: setTransactionsLoading,
    setError: setTransactionsError,
    setResult: setTransactionsResult,
  });

  const handleCommissionSubmit = (e) => submitTransactionRequest(e, commissionForm, {
    isCommission: true,
    setLoading: setCommissionLoading,
    setError: setCommissionError,
    setResult: setCommissionResult,
  });

  const handleStockBoardSubmit = async (e) => {
    e.preventDefault();
    if (!stockBoardForm.office_code) {
      setStockBoardError('Office list is not added for the selected district yet. Please select the correct district.');
      return;
    }
    const fpsId = String(stockBoardForm.fps_id || '').trim();
    if (!/^\d{7}$/.test(fpsId)) {
      setStockBoardError('FPS ID must contain exactly 7 digits.');
      setStockBoardResult(null);
      return;
    }
    const fpsDistrictCode = fpsId.slice(0, 2);
    const fpsOfficeCode = fpsId.slice(2, 4);
    if (stockBoardForm.dist_code !== fpsDistrictCode || stockBoardForm.office_code !== fpsOfficeCode) {
      setStockBoardError(
        `FPS ID ${fpsId} belongs to district code ${fpsDistrictCode} and office code ${fpsOfficeCode}. Please select the matching district and office.`
      );
      setStockBoardResult(null);
      return;
    }
    setStockBoardLoading(true);
    setStockBoardError('');
    setStockBoardResult(null);
    try {
      const res = await fetch(STOCK_REGISTER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dist_code: Number(stockBoardForm.dist_code),
          fps_id: Number(stockBoardForm.fps_id),
          month: Number(stockBoardForm.month),
          year: Number(stockBoardForm.year),
          office_code: Number(stockBoardForm.office_code),
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
      setStockBoardResult(data);
    } catch (err) {
      console.error('Stock board register fetch failed:', err);
      setStockBoardError(err.message || 'Failed to fetch stock board register.');
    } finally {
      setStockBoardLoading(false);
    }
  };

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsError('');
    setSettingsResult(null);
    setRoQuantityResult(null);
    setRoQuantityError('');
    try {
      const res = await fetch(RO_DETAILS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: Number(settingsForm.month),
          year: Number(settingsForm.year),
          shop_no: Number(settingsForm.shop_no),
          dist_code: Number(settingsForm.dist_code),
          depot_id: settingsForm.depot_id.trim(),
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
      setSettingsResult(data);
    } catch (err) {
      console.error('RO details fetch failed:', err);
      setSettingsError(err.message || 'Failed to fetch RO details.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRationCardSubmit = async (e) => {
    e.preventDefault();
    if (!rationCardForm.src_no.trim()) {
      setRationCardError('Ration card number is required.');
      return;
    }
    const formatRationCardError = (status, detail) => {
      const message = String(detail || '').toLowerCase();
      if (status === 404 || message.includes('no ration card summary')) {
        return 'Please enter a correct ration card number.';
      }
      if (message.includes('taking too long') || status === 504) {
        return 'Ration card details server is taking too long. Please try again.';
      }
      return 'Unable to get ration card details. Please try again.';
    };
    setRationCardLoading(true);
    setRationCardError('');
    setRationCardResult(null);
    try {
      const res = await fetch(RATION_CARD_DETAILS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          src_no: rationCardForm.src_no.trim(),
          month: Number(rationCardForm.month),
          year: Number(rationCardForm.year),
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
        const detail = data?.detail || data?.message || 'Server error';
        throw new Error(formatRationCardError(res.status, detail));
      }
      setRationCardResult(data);
    } catch (err) {
      console.error('Ration card details fetch failed:', err);
      setRationCardError(err.message || 'Failed to fetch ration card details.');
    } finally {
      setRationCardLoading(false);
    }
  };

  const handleRoQuantityClick = async (actionParams) => {
    if (!actionParams || Object.keys(actionParams).length === 0) return;

    const roParts = String(actionParams.ro_no || '').split('/').filter(Boolean);
    const toNumberOrFallback = (value, fallback) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && value !== undefined && value !== '' ? parsed : fallback;
    };
    const payload = {
      release_order_id_aso: actionParams.release_order_id_aso || '',
      ro_no: actionParams.ro_no || '',
      month_int: toNumberOrFallback(actionParams.month_int, toNumberOrFallback(roParts[4], Number(settingsForm.month))),
      year_int: toNumberOrFallback(actionParams.year_int, toNumberOrFallback(roParts[5], Number(settingsForm.year))),
      ro_date: actionParams.ro_date || '',
      shop_number: toNumberOrFallback(actionParams.shop_number, toNumberOrFallback(roParts[3], Number(settingsForm.shop_no))),
      district_code: toNumberOrFallback(actionParams.district_code, toNumberOrFallback(roParts[2], Number(settingsForm.dist_code))),
      truckchit_number: actionParams.truckchit_number || (roParts.length >= 8 ? `TC-${roParts.slice(1).join('-')}` : ''),
    };

    setRoQuantityLoading(true);
    setRoQuantityError('');
    setRoQuantityResult(null);
    try {
      const res = await fetch(RO_QUANTITY_DETAILS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        const detail = Array.isArray(data?.detail)
          ? data.detail.map((item) => item.msg || JSON.stringify(item)).join('; ')
          : data?.detail || data?.message || 'Server error';
        const suffix = requestId ? ` Request ID: ${requestId}` : '';
        throw new Error(`Backend error ${res.status}: ${detail}.${suffix}`);
      }
      setRoQuantityResult({ ...data, request: payload });
    } catch (err) {
      console.error('RO quantity details fetch failed:', err);
      setRoQuantityError(err.message || 'Failed to fetch RO quantity details.');
    } finally {
      setRoQuantityLoading(false);
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
      <Typography
        variant="caption"
        sx={{
          minHeight: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7b8395',
          fontWeight: 700,
          lineHeight: 1.2,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );

  const getRoFieldValue = (table, label) => {
    const headerIndex = (table?.headers || []).findIndex((header) => header === label);
    return headerIndex >= 0 ? table?.rows?.[0]?.[headerIndex] || '' : '';
  };

  const parseQuantity = (value) => {
    const parsed = Number(String(value || '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatQty = (value) => parseQuantity(value).toFixed(3);

  const formatCurrency = (value) => {
    const amount = parseQuantity(value);
    return `Rs. ${amount.toFixed(2)}`;
  };

  const renderIconBadge = (icon, bg = '#eef5ff', color = '#245ef5') => (
    <Box
      sx={{
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        fontWeight: 900,
        flex: '0 0 auto',
      }}
    >
      {icon}
    </Box>
  );

  const renderInfoCard = ({ title, icon, iconBg, iconColor, children }) => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        background: '#ffffff',
        border: '1px solid #e6edf7',
        boxShadow: '0 12px 28px rgba(26, 58, 109, 0.08)',
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.5 }}>
        {renderIconBadge(icon, iconBg, iconColor)}
        <Typography sx={{ color: '#17233c', fontSize: 16, fontWeight: 900 }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );

  const renderInfoValue = (label, value, options = {}) => (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 2.5,
        background: options.bg || '#f8fafc',
        border: options.border || '1px solid #e6ebf3',
        minHeight: options.compact ? 58 : 76,
        boxShadow: options.shadow === false ? 'none' : '0 8px 18px rgba(26, 58, 109, 0.06)',
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
      }}
    >
      {options.icon && renderIconBadge(options.icon, options.iconBg || '#eef5ff', options.iconColor || '#245ef5')}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ color: '#748094', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography
          sx={{
            mt: 0.45,
            color: options.color || '#17233c',
            fontSize: options.large ? 17 : 14,
            fontWeight: 900,
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}
        >
          {value || '-'}
        </Typography>
      </Box>
    </Box>
  );

  const renderCommodityCards = (table) => {
    const headers = table?.headers || [];
    const headerIndex = (label) => headers.findIndex((header) => header === label);
    const value = (row, label) => {
      const index = headerIndex(label);
      return index >= 0 ? row[index] || '-' : '-';
    };

    return (
      <Stack spacing={1.5}>
        {(table?.rows || []).map((row, index) => (
          <Paper
            elevation={0}
            key={index}
            sx={{
              p: 1.5,
              borderRadius: 3,
              background: '#ffffff',
              border: '1px solid #e2e9f4',
              boxShadow: '0 10px 24px rgba(26, 58, 109, 0.08)',
            }}
          >
            {(() => {
              const allotment = parseQuantity(value(row, 'Allotment Qty'));
              const earlier = parseQuantity(value(row, 'Earlier Dispatched Qty'));
              const current = parseQuantity(value(row, 'Dispatched Qty'));
              const totalDispatched = earlier + current;
              const balance = parseQuantity(value(row, 'Balance Qty'));
              const progress = allotment > 0 ? Math.min((totalDispatched / allotment) * 100, 100) : 0;

              return (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.2, mb: 1.3 }}>
                    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
                      {renderIconBadge('🌾', '#eefbf3', '#15803d')}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#17233c', fontSize: 18, fontWeight: 900 }}>
                          {value(row, 'Commodity')}
                        </Typography>
                        <Typography sx={{ color: '#17233c', fontSize: 12, fontWeight: 900 }}>
                          Scheme {value(row, 'Scheme')} | Unit {value(row, 'Unit')}
                        </Typography>
                      </Box>
                    </Stack>
                    <Box
                      sx={{
                        px: 1.1,
                        py: 0.55,
                        borderRadius: 999,
                        background: '#f2f6ff',
                        color: '#245ef5',
                        fontSize: 11,
                        fontWeight: 900,
                        height: 'fit-content',
                      }}
                    >
                      {formatCurrency(value(row, 'Cost'))}
                    </Box>
                  </Box>

                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      {renderInfoValue('Current Dispatched', formatQty(current), {
                        bg: '#eafff2',
                        color: '#0f7a45',
                        large: true,
                      })}
                    </Grid>
                    <Grid item xs={6}>
                      {renderInfoValue('Balance Qty', formatQty(balance), {
                        bg: '#fff4e5',
                        color: '#b45309',
                        large: true,
                      })}
                    </Grid>
                    <Grid item xs={6}>
                      {renderInfoValue('Allotment Qty', formatQty(allotment))}
                    </Grid>
                    <Grid item xs={6}>
                      {renderInfoValue('Earlier Dispatched', formatQty(earlier))}
                    </Grid>
                    <Grid item xs={12}>
                      {renderInfoValue('Total Dispatched Qty', formatQty(totalDispatched), {
                        bg: '#eef5ff',
                        color: '#245ef5',
                        large: true,
                      })}
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.7 }}>
                      <Typography sx={{ color: '#748094', fontSize: 11, fontWeight: 900 }}>
                        Dispatch Progress
                      </Typography>
                      <Typography sx={{ color: '#17233c', fontSize: 12, fontWeight: 900 }}>
                        {progress.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 10, borderRadius: 999, background: '#edf2f7', overflow: 'hidden' }}>
                      <Box
                        sx={{
                          width: `${progress}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)',
                        }}
                      />
                    </Box>
                  </Box>
                </>
              );
            })()}
          </Paper>
        ))}
      </Stack>
    );
  };

  const renderRoCommodityTable = (table) => {
    const headers = table?.headers || [];
    const headerIndex = (label) => headers.findIndex((header) => header === label);
    const value = (row, label) => {
      const index = headerIndex(label);
      return index >= 0 ? row[index] || '-' : '-';
    };

    const columns = [
      ['Scheme', (row) => value(row, 'Scheme')],
      ['Commodity', (row) => value(row, 'Commodity')],
      ['Unit', (row) => value(row, 'Unit')],
      ['Allotment', (row) => formatQty(value(row, 'Allotment Qty'))],
      ['Earlier', (row) => formatQty(value(row, 'Earlier Dispatched Qty'))],
      ['Current', (row) => formatQty(value(row, 'Dispatched Qty'))],
      [
        'Total',
        (row) => formatQty(
          parseQuantity(value(row, 'Earlier Dispatched Qty'))
          + parseQuantity(value(row, 'Dispatched Qty'))
        ),
      ],
      ['Balance', (row) => formatQty(value(row, 'Balance Qty'))],
      ['Cost', (row) => formatCurrency(value(row, 'Cost'))],
    ];

    return (
      <Box sx={{ overflowX: 'hidden' }}>
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            background: '#ffffff',
            border: '1px solid #1f2937',
            '& th, & td': {
              border: '1px solid #1f2937',
              px: 0.45,
              py: 0.65,
              textAlign: 'center',
              fontSize: { xs: 8.5, sm: 10 },
              lineHeight: 1.15,
              fontWeight: 800,
              wordBreak: 'break-word',
            },
            '& th': {
              background: '#1f2937',
              color: '#ffffff',
              fontSize: { xs: 8, sm: 9.5 },
              textTransform: 'uppercase',
            },
            '& th:nth-of-type(6), & td:nth-of-type(6)': {
              background: '#dcfce7',
              color: '#14532d',
              fontWeight: 950,
            },
            '& th:nth-of-type(6)': {
              background: '#16a34a',
              color: '#ffffff',
            },
            '& td:nth-of-type(2)': {
              textAlign: 'left',
            },
          }}
        >
          <Box component="thead">
            <Box component="tr">
              {columns.map(([label]) => (
                <Box component="th" key={label}>
                  {label}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {(table?.rows || []).map((row, rowIndex) => {
              const hasCost = parseQuantity(value(row, 'Cost')) > 0;
              return (
                <Box
                  component="tr"
                  key={rowIndex}
                  sx={hasCost ? {
                    '& td': {
                      background: '#fff7ed',
                    },
                    '& td:nth-of-type(6)': {
                      background: '#bbf7d0',
                    },
                    '& td:last-of-type': {
                      background: '#fed7aa',
                      color: '#9a3412',
                      fontWeight: 950,
                    },
                  } : undefined}
                >
                  {columns.map(([label, getter]) => (
                    <Box component="td" key={label}>
                      {getter(row)}
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderRoQuantityReport = () => {
    const tables = roQuantityResult?.tables || [];
    const dispatchTable = tables[0];
    const shopTable = tables[1];
    const commodityTable = tables[2];
    const title = dispatchTable?.title_rows?.flat()?.join(' ') || roQuantityResult.request?.ro_no || '';
    const truckNo = getRoFieldValue(dispatchTable, 'Truck NO');
    const dispatchedDate = getRoFieldValue(dispatchTable, 'Dispatched Date');
    const dispatchTime = getRoFieldValue(dispatchTable, 'Dispatch Time');
    const bags = getRoFieldValue(shopTable, 'No Of Bags');
    const amountPaid = getRoFieldValue(shopTable, 'Amount Paid');
    const district = getRoFieldValue(dispatchTable, 'District');
    const taluk = getRoFieldValue(dispatchTable, 'Taluk Name');
    const truckChitNo = getRoFieldValue(dispatchTable, 'TruckChit NO');
    const shopNo = getRoFieldValue(shopTable, 'FP Shop Number');
    const shopOwner = getRoFieldValue(shopTable, 'Shop Owner Name');
    const monthMatch = title.match(/Month of\s+(.+)$/i);
    const orderMonth = monthMatch ? monthMatch[1].replace(',', '').trim() : '';
    const summaryRows = [
      ['RO Number', roQuantityResult.request?.ro_no || '-'],
      ['Month', orderMonth || '-'],
      ['District', district || '-'],
      ['Taluk', taluk || '-'],
      ['Dispatch Date', dispatchedDate || '-'],
      ['Dispatch Time', dispatchTime || '-'],
      ['Truck No', truckNo || '-'],
      ['Truck Chit No', truckChitNo || '-'],
      ['FPS Shop No', shopNo || '-'],
      ['Shop Owner', shopOwner || '-'],
      ['No. of Bags', bags || '-'],
      ['Amount Paid', formatCurrency(amountPaid)],
    ];

    return (
      <Paper
        elevation={0}
        sx={{
          p: 0,
          borderRadius: 3,
          background: '#f6f8fc',
          border: '1px solid #e8edf7',
          boxShadow: '0 14px 34px rgba(26, 58, 109, 0.12)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: 2.2,
            background: 'linear-gradient(135deg, #eef6ff 0%, #e9fbf6 100%)',
            color: '#17233c',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, mb: 1.6 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, color: '#10213f', fontSize: 20, lineHeight: 1.15 }}>
                Order Quantity Details
              </Typography>
              <Typography sx={{ color: '#4a5f82', fontWeight: 800, fontSize: 12, mt: 0.65 }}>
                {roQuantityResult.request?.ro_no || ''}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flex: '0 0 auto' }}>
              <Box
                sx={{
                  px: 1.15,
                  py: 0.55,
                  borderRadius: 999,
                  background: '#dffbea',
                  color: '#166534',
                  fontSize: 12,
                  fontWeight: 900,
                  mb: 0.6,
                  border: '1px solid #b7efcd',
                }}
              >
                Dispatched
              </Box>
              <Typography sx={{ color: '#48617d', fontWeight: 800, fontSize: 11 }}>
                {Math.round(roQuantityResult.duration_ms || 0)} ms
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={1}>
            <Grid item xs={12} sm={8}>
              <Box sx={{ p: 1.2, borderRadius: 2.5, background: '#ffffff', border: '1px solid #dce9fb' }}>
                <Typography sx={{ color: '#6b7a90', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
                  RO Number
                </Typography>
                <Typography sx={{ color: '#18365f', fontSize: 13, fontWeight: 900, mt: 0.35, wordBreak: 'break-word' }}>
                  {roQuantityResult.request?.ro_no || '-'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ p: 1.2, borderRadius: 2.5, background: '#ffffff', border: '1px solid #dce9fb' }}>
                <Typography sx={{ color: '#6b7a90', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
                  Month
                </Typography>
                <Typography sx={{ color: '#18365f', fontSize: 13, fontWeight: 900, mt: 0.35 }}>
                  {orderMonth || '-'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Stack spacing={1.7} sx={{ p: 2, background: '#f6f8fc' }}>
          <Box
            component="table"
            sx={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              background: '#ffffff',
              border: '1px solid #d7e0ef',
              '& th, & td': {
                border: '1px solid #d7e0ef',
                px: 0.8,
                py: 0.7,
                fontSize: 11,
                lineHeight: 1.2,
                wordBreak: 'break-word',
              },
              '& th': {
                width: '34%',
                textAlign: 'left',
                color: '#667085',
                background: '#f8fafc',
                fontWeight: 900,
                textTransform: 'uppercase',
              },
              '& td': {
                color: '#10213f',
                fontWeight: 800,
              },
            }}
          >
            <Box component="tbody">
              {summaryRows.map(([label, value]) => (
                <Box component="tr" key={label}>
                  <Box component="th">{label}</Box>
                  <Box component="td">{value}</Box>
                </Box>
              ))}
            </Box>
          </Box>

          {commodityTable?.rows?.length > 0 && (
            <Box>
              <Typography sx={{ color: '#10213f', fontSize: 13, fontWeight: 900, mb: 0.8 }}>
                Commodity Details
              </Typography>
              {renderRoCommodityTable(commodityTable)}
            </Box>
          )}

          {false && (
            <>
          {dispatchTable?.rows?.length > 0 && (
            renderInfoCard({
              title: 'Dispatch Details',
              icon: '🚚',
              iconBg: '#e0f2fe',
              iconColor: '#0369a1',
              children: (
                <Grid container spacing={1}>
                  <Grid item xs={6}>{renderInfoValue('District', district, { icon: '📍', compact: true })}</Grid>
                  <Grid item xs={6}>{renderInfoValue('Taluk', taluk, { icon: '🗺️', compact: true })}</Grid>
                  <Grid item xs={6}>{renderInfoValue('Dispatch Date', dispatchedDate, { icon: '📅', compact: true })}</Grid>
                  <Grid item xs={6}>{renderInfoValue('Dispatch Time', dispatchTime, { icon: '🕒', compact: true })}</Grid>
                  <Grid item xs={12}>
                    {renderInfoValue('Truck No', truckNo, {
                      icon: '🚚',
                      bg: '#eef5ff',
                      border: '1px solid #c7d8ff',
                      color: '#245ef5',
                      large: true,
                    })}
                  </Grid>
                  <Grid item xs={12}>
                    {renderInfoValue('Truck Chit No', truckChitNo, {
                      icon: '📄',
                      bg: '#f8fafc',
                      large: true,
                    })}
                  </Grid>
                </Grid>
              ),
            })
          )}

          {shopTable?.rows?.length > 0 && (
            renderInfoCard({
              title: 'Shop Details',
              icon: '🏪',
              iconBg: '#fef3c7',
              iconColor: '#92400e',
              children: (
                <Grid container spacing={1}>
                  <Grid item xs={12}>{renderInfoValue('FPS Shop Number', shopNo, { icon: '🏪', compact: true })}</Grid>
                  <Grid item xs={12}>{renderInfoValue('Shop Owner Name', shopOwner, { icon: '👤', large: true })}</Grid>
                  <Grid item xs={6}>
                    {renderInfoValue('No. of Bags', bags, {
                      icon: '🛍️',
                      bg: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#c2410c',
                      large: true,
                    })}
                  </Grid>
                  <Grid item xs={6}>
                    {renderInfoValue('Amount Paid', formatCurrency(amountPaid), {
                      icon: '💳',
                      bg: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#15803d',
                      large: true,
                    })}
                  </Grid>
                </Grid>
              ),
            })
          )}

          {commodityTable?.rows?.length > 0 && (
            renderInfoCard({
              title: 'Commodity Details',
              icon: '📦',
              iconBg: '#eefbf3',
              iconColor: '#15803d',
              children: (
                <>
              {renderCommodityCards(commodityTable)}
                </>
              ),
            })
          )}
            </>
          )}
        </Stack>

        {roQuantityResult.table_count === 0 && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            No quantity table found. {roQuantityResult.response_preview || ''}
          </Alert>
        )}
      </Paper>
    );
  };

  const monthYearLabel = (month = form.month, year = form.year) => {
    if (!month || !year) return '';
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
    const idx = Math.min(Math.max(Number(month) - 1, 0), 11);
    return `${monthNames[idx]} ${year}`;
  };

  const renderRationCardTables = () => {
    const summary = rationCardResult?.summary || {};

    if (!summary.fps && !summary.scheme && !summary.total_members) {
      return (
        <Alert severity="warning" sx={{ alignItems: 'flex-start' }}>
          No ration card summary found for this selection.
        </Alert>
      );
    }

    const entitlementRows = rationCardResult?.commodity_rows || [];
    const transactionTable = rationCardResult?.transaction_table || {};
    const transactionHeaders = transactionTable.headers || [];
    const transactionRows = transactionTable.rows || [];
    const transactionMetaColumns = [
      { label: 'SL', index: 0 },
      { label: 'Member', index: 1 },
      { label: 'ARD', index: 2 },
      { label: 'Type', index: 3 },
      { label: 'Date', index: 6 },
    ];
    const parseEntitlementQuantity = (value) => {
      const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : 0;
    };
    const entitlementUnit = (commodity) => {
      const normalized = String(commodity || '').toLowerCase();
      if (/\batta\b/.test(normalized)) return 'pkt';
      if (normalized.includes('koil') || normalized.includes('k-oil')) return 'ltr';
      return 'kg';
    };
    const formatEntitlementQuantity = (value, commodity) => {
      const quantity = parseEntitlementQuantity(value);
      const formatted = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3).replace(/\.?0+$/, '');
      return `${formatted} ${entitlementUnit(commodity)}`;
    };
    const normalizedEntitlementRows = Object.values(
      entitlementRows.reduce((acc, row) => {
        const commodity = row.commodity || '-';
        const quantity = parseEntitlementQuantity(row.entitlement);
        const key = commodity.toLowerCase();
        if (!acc[key]) {
          acc[key] = { commodity, entitlement: row.entitlement, quantity };
        } else {
          acc[key].quantity += quantity;
          acc[key].entitlement = String(acc[key].quantity);
        }
        return acc;
      }, {})
    );
    const riceEntitlementRows = normalizedEntitlementRows.filter((row) =>
      String(row.commodity || '').toLowerCase().includes('rice')
    );
    const otherEntitlementRows = normalizedEntitlementRows.filter(
      (row) => !String(row.commodity || '').toLowerCase().includes('rice')
    );
    const visibleEntitlementRows = [...riceEntitlementRows, ...otherEntitlementRows].filter(
      (row) => row.quantity > 0
    );
    const schemeColorMap = {
      AAY: '#ffea00',
      PHH: '#f26aaa',
      NPS: '#22a7c8',
      NPNS: '#f8fafc',
      NPI: '#dcfce7',
    };
    const schemeTextColorMap = {
      AAY: '#92400e',
      PHH: '#9d174d',
      NPS: '#155e75',
      NPNS: '#334155',
      NPI: '#166534',
    };
    const summaryScheme = String(summary.scheme || '').toUpperCase();
    const summarySchemeBackground = schemeColorMap[summaryScheme] || '#ffffff';
    const summarySchemeColor = schemeTextColorMap[summaryScheme] || '#0f172a';
    const selectedRationCardMonthName =
      monthOptions.find(([value]) => value === rationCardForm.month)?.[1] || rationCardForm.month;
    const transactionCommodityColumns = transactionHeaders
      .map((header, index) => ({ label: header, index }))
      .filter((column) => column.index >= 7);
    const nonZeroTransactionItems = (row) =>
      transactionCommodityColumns
        .map((column) => ({
          commodity: column.label,
          quantity: row[column.index],
          numericQuantity: parseEntitlementQuantity(row[column.index]),
        }))
        .filter((item) => item.numericQuantity > 0);
    const remainingCommodityName = (commodity) => {
      const normalized = String(commodity || '').toLowerCase();
      if (normalized.includes('rice')) return 'Rice';
      if (/\batta\b/.test(normalized)) return 'Atta';
      if (normalized.includes('wheat')) return 'Wheat';
      if (normalized.includes('sugar')) return 'Sugar';
      if (normalized.includes('koil') || normalized.includes('k-oil') || normalized.includes('kerosene')) return 'Koil';
      return commodity || '-';
    };
    const addToCommodityTotal = (totals, commodity, quantity) => {
      const name = remainingCommodityName(commodity);
      totals[name] = (totals[name] || 0) + quantity;
      return totals;
    };
    const entitlementTotals = visibleEntitlementRows.reduce(
      (totals, row) => addToCommodityTotal(totals, row.commodity, row.quantity),
      {}
    );
    const transactionTotals = transactionRows.reduce((totals, row) => {
      transactionCommodityColumns.forEach((column) => {
        addToCommodityTotal(totals, column.label, parseEntitlementQuantity(row[column.index]));
      });
      return totals;
    }, {});
    const remainingRows = ['Rice', 'Atta', 'Wheat', 'Sugar', 'Koil']
      .filter((commodity) => entitlementTotals[commodity] > 0 || transactionTotals[commodity] > 0)
      .map((commodity) => {
        const entitlementQuantity = entitlementTotals[commodity] || 0;
        const purchasedQuantity = transactionTotals[commodity] || 0;
        const remainingQuantity = Math.max(entitlementQuantity - purchasedQuantity, 0);
        return {
          commodity,
          entitlement: String(entitlementQuantity),
          purchased: String(purchasedQuantity),
          remaining: String(remainingQuantity),
        };
      });

    return (
      <Stack spacing={2.25}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 900, lineHeight: 1.2 }}>
              Ration Card Details
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.4, color: '#64748b', fontWeight: 700 }}>
              Card {rationCardForm.src_no} in {selectedRationCardMonthName}&apos;{rationCardForm.year}
            </Typography>
          </Box>
          <Box
            sx={{
              px: 1.2,
              py: 0.55,
              borderRadius: 999,
              bgcolor: '#eef4ff',
              color: '#2f64f8',
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            {Math.round(rationCardResult.duration_ms || 0)} ms
          </Box>
        </Box>

        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #dbe4f0',
            borderRadius: 2,
            overflow: 'hidden',
            display: 'table',
            '& th': {
              bgcolor: '#f1f5f9',
              color: '#364b73',
              fontSize: 11,
              fontWeight: 900,
              textTransform: 'uppercase',
              borderBottom: '1px solid #dbe4f0',
              borderRight: '1px solid #dbe4f0',
              px: 1,
              py: 0.9,
              textAlign: 'left',
              '&:last-of-type': {
                borderRight: 0,
              },
            },
            '& td': {
              color: '#0f172a',
              fontSize: { xs: 13, sm: 16 },
              fontWeight: 900,
              borderRight: '1px solid #e5edf7',
              px: 1,
              py: 1.1,
              '&:last-of-type': {
                borderRight: 0,
              },
            },
          }}
        >
          <Box component="thead">
            <Box component="tr">
              <Box component="th">FPS</Box>
              <Box component="th">Scheme</Box>
              <Box component="th">Total Members</Box>
            </Box>
          </Box>
          <Box component="tbody">
            <Box component="tr">
              <Box component="td">{summary.fps || '-'}</Box>
              <Box
                component="td"
                sx={{
                  bgcolor: summarySchemeBackground,
                  color: summarySchemeColor,
                  textAlign: 'center',
                  fontSize: { xs: 13, sm: 16 },
                  fontWeight: 1000,
                }}
              >
                {summary.scheme || '-'}
              </Box>
              <Box component="td">{summary.total_members || '-'}</Box>
            </Box>
          </Box>
        </Box>

        {entitlementRows.length > 0 && (
          <Box
            sx={{
              border: '1px solid #dbe4f0',
              borderRadius: 2,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            <Box sx={{ px: 1.5, py: 1.1, bgcolor: '#f8fafc', borderBottom: '1px solid #dbe4f0' }}>
              <Typography sx={{ color: '#17335f', fontSize: 13, fontWeight: 900 }}>
                Entitlement for RC
              </Typography>
            </Box>
            <Box sx={{ p: 1.25 }}>
              {visibleEntitlementRows.length > 0 ? (
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    display: 'table',
                    '& th': {
                      color: '#000000',
                      fontSize: { xs: 9, sm: 12 },
                      fontWeight: 1000,
                      textTransform: 'uppercase',
                      border: '2px solid #111111',
                      px: { xs: 0.45, sm: 0.9 },
                      py: { xs: 0.55, sm: 0.85 },
                      textAlign: 'center',
                      lineHeight: 1.15,
                      overflowWrap: 'anywhere',
                    },
                    '& td': {
                      color: '#0f172a',
                      fontSize: { xs: 11, sm: 13 },
                      fontWeight: 900,
                      border: '2px solid #111111',
                      px: { xs: 0.45, sm: 0.9 },
                      py: { xs: 0.65, sm: 0.9 },
                      lineHeight: 1.15,
                      overflowWrap: 'anywhere',
                    },
                    '& td:last-of-type': {
                      textAlign: 'right',
                    },
                  }}
                >
                  <Box component="thead">
                    <Box component="tr">
                      <Box component="th" sx={{ width: '62%', background: '#ffffff' }}>ITEM</Box>
                      <Box component="th" sx={{ width: '38%', background: '#e5e7eb' }}>ENTITLEMENT</Box>
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {visibleEntitlementRows.map((row) => (
                      <Box component="tr" key={row.commodity}>
                        <Box component="td" sx={{ color: '#2f3192', textAlign: 'left', fontWeight: 1000 }}>
                          {row.commodity}
                        </Box>
                        <Box component="td" sx={{ background: '#f9fafb', fontWeight: 1000 }}>
                          {formatEntitlementQuantity(row.entitlement, row.commodity)}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Typography sx={{ color: '#64748b', fontSize: 13, fontWeight: 700 }}>
                  No entitlement quantity found.
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {transactionRows.length > 0 && remainingRows.length > 0 && (
          <Box
            sx={{
              border: '1px solid #dbe4f0',
              borderRadius: 2,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            <Box sx={{ px: 1.5, py: 1.1, bgcolor: '#f8fafc', borderBottom: '1px solid #dbe4f0' }}>
              <Typography sx={{ color: '#17335f', fontSize: 13, fontWeight: 900 }}>
                Remaining Ration
              </Typography>
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  tableLayout: 'fixed',
                  borderCollapse: 'collapse',
                  display: 'table',
                  '& th': {
                    color: '#000000',
                    fontSize: { xs: 9, sm: 12 },
                    fontWeight: 1000,
                    textTransform: 'uppercase',
                    border: '2px solid #111111',
                    px: { xs: 0.35, sm: 0.75 },
                    py: { xs: 0.55, sm: 0.85 },
                    textAlign: 'center',
                    lineHeight: 1.15,
                    overflowWrap: 'anywhere',
                  },
                  '& td': {
                    color: '#0f172a',
                    fontSize: { xs: 10.5, sm: 13 },
                    fontWeight: 900,
                    border: '2px solid #111111',
                    px: { xs: 0.35, sm: 0.75 },
                    py: { xs: 0.65, sm: 0.9 },
                    lineHeight: 1.15,
                    textAlign: 'center',
                    overflowWrap: 'anywhere',
                  },
                }}
              >
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th" sx={{ width: '28%', background: '#ffffff' }}>ITEM</Box>
                    <Box component="th" sx={{ width: '24%', background: '#e0f2fe' }}>TOTAL</Box>
                    <Box component="th" sx={{ width: '24%', background: '#dcfce7' }}>BOUGHT</Box>
                    <Box component="th" sx={{ width: '24%', background: '#fef3c7' }}>REMAINING</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {remainingRows.map((row) => (
                    <Box component="tr" key={`remaining-${row.commodity}`}>
                      <Box component="td" sx={{ color: '#2f3192', textAlign: 'left', fontWeight: 1000 }}>
                        {row.commodity}
                      </Box>
                      <Box component="td">{formatEntitlementQuantity(row.entitlement, row.commodity)}</Box>
                      <Box component="td">{formatEntitlementQuantity(row.purchased, row.commodity)}</Box>
                      <Box component="td" sx={{ background: '#fffbeb', fontWeight: 1000 }}>
                        {formatEntitlementQuantity(row.remaining, row.commodity)}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {transactionRows.length > 0 ? (
          <Box
            sx={{
              border: '1px solid #dbe4f0',
              borderRadius: 2,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            <Box sx={{ px: 1.5, py: 1.1, bgcolor: '#f8fafc', borderBottom: '1px solid #dbe4f0' }}>
              <Typography sx={{ color: '#17335f', fontSize: 13, fontWeight: 900 }}>
                Transaction Details for RC
              </Typography>
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Stack spacing={1.5}>
                {transactionRows.map((row, rowIndex) => {
                  const items = nonZeroTransactionItems(row);
                  return (
                    <Box
                      key={`ration-card-transaction-${rowIndex}`}
                      sx={{
                        border: '1px solid #dbe4f0',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        bgcolor: '#ffffff',
                      }}
                    >
                      <Box
                        component="table"
                        sx={{
                          width: '100%',
                          tableLayout: 'fixed',
                          borderCollapse: 'collapse',
                          '& th': {
                            bgcolor: '#f1f5f9',
                            color: '#364b73',
                            fontSize: { xs: 8.5, sm: 11 },
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            border: '1px solid #dbe4f0',
                            px: { xs: 0.35, sm: 0.8 },
                            py: 0.75,
                            textAlign: 'left',
                            lineHeight: 1.15,
                            overflowWrap: 'anywhere',
                          },
                          '& td': {
                            color: '#0f172a',
                            fontSize: { xs: 10.5, sm: 13 },
                            fontWeight: 900,
                            border: '1px solid #e5edf7',
                            px: { xs: 0.35, sm: 0.8 },
                            py: 0.85,
                            lineHeight: 1.2,
                            overflowWrap: 'anywhere',
                          },
                        }}
                      >
                        <Box component="thead">
                          <Box component="tr">
                            {transactionMetaColumns.map((column) => (
                              <Box component="th" key={`transaction-meta-header-${rowIndex}-${column.label}`}>
                                {column.label}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                        <Box component="tbody">
                          <Box component="tr">
                            {transactionMetaColumns.map((column) => (
                              <Box component="td" key={`transaction-meta-cell-${rowIndex}-${column.label}`}>
                                {row[column.index] || '-'}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>

                      <Box
                        component="table"
                        sx={{
                          width: '100%',
                          tableLayout: 'fixed',
                          borderCollapse: 'collapse',
                          mt: '-1px',
                          '& th': {
                            color: '#000000',
                            fontSize: { xs: 9, sm: 12 },
                            fontWeight: 1000,
                            textTransform: 'uppercase',
                            border: '2px solid #111111',
                            px: { xs: 0.45, sm: 0.9 },
                            py: { xs: 0.55, sm: 0.85 },
                            textAlign: 'center',
                            lineHeight: 1.15,
                            overflowWrap: 'anywhere',
                          },
                          '& td': {
                            color: '#0f172a',
                            fontSize: { xs: 11, sm: 13 },
                            fontWeight: 900,
                            border: '2px solid #111111',
                            px: { xs: 0.45, sm: 0.9 },
                            py: { xs: 0.65, sm: 0.9 },
                            lineHeight: 1.15,
                            overflowWrap: 'anywhere',
                          },
                          '& td:last-of-type': {
                            textAlign: 'right',
                          },
                        }}
                      >
                        <Box component="thead">
                          <Box component="tr">
                            <Box component="th" sx={{ width: '62%', background: '#ffffff' }}>ITEM</Box>
                            <Box component="th" sx={{ width: '38%', background: '#e5e7eb' }}>QUANTITY</Box>
                          </Box>
                        </Box>
                        <Box component="tbody">
                          {items.length > 0 ? (
                            items.map((item) => (
                              <Box component="tr" key={`transaction-item-${rowIndex}-${item.commodity}`}>
                                <Box component="td" sx={{ color: '#2f3192', textAlign: 'left', fontWeight: 1000 }}>
                                  {item.commodity}
                                </Box>
                                <Box component="td" sx={{ background: '#f9fafb', fontWeight: 1000 }}>
                                  {formatEntitlementQuantity(item.quantity, item.commodity)}
                                </Box>
                              </Box>
                            ))
                          ) : (
                            <Box component="tr">
                              <Box component="td" colSpan={2} sx={{ textAlign: 'center', color: '#64748b' }}>
                                No commodity quantity found.
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              border: '1px solid #dbe4f0',
              borderRadius: 2,
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            <Box sx={{ px: 1.5, py: 1.1, bgcolor: '#f8fafc', borderBottom: '1px solid #dbe4f0' }}>
              <Typography sx={{ color: '#17335f', fontSize: 13, fontWeight: 900 }}>
                Transaction Details for RC
              </Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: '#fff7ed' }}>
              <Typography sx={{ color: '#9a3412', fontSize: { xs: 14, sm: 15 }, fontWeight: 900, lineHeight: 1.5 }}>
                {selectedRationCardMonthName} മാസത്തെ റേഷൻ വിഹിതം ഇതുവരെ വാങ്ങിയിട്ടില്ല
              </Typography>
            </Box>
          </Box>
        )}

      </Stack>
    );
  };

  const renderStockBoard = () => {
    const stockRegisterTable = stockBoardResult?.tables?.[0];
    const selectedOfficeLabel =
      (afsoOptionsByDistrict[stockBoardForm.dist_code] || []).find(
        ([officeCode]) => officeCode === stockBoardForm.office_code
      )?.[1] || '-';
    const stockBoardInfoCellSx = {
      px: { xs: 1.1, sm: 1.4 },
      py: 1.1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      color: '#111827',
      fontSize: { xs: 13, sm: 15 },
      fontWeight: 900,
      lineHeight: 1.35,
    };
    const stockInfoHeaders = ['ഇനം', 'എ.എ.വൈ', 'മുൻഗണന', 'എൻ.പി.എസ്', 'എൻ.പി.എൻ.എസ്', 'എൻ.പി.ഐ'];
    const stockInfoRows = [
      'അരി (പുഴുക്കലരി)',
      'പച്ചരി',
      'മട്ട അരി',
      'ഗോതമ്പ്',
      'ആട്ട',
      'മണ്ണെണ്ണ',
      'പഞ്ചസാര',
      'സ്പെഷ്യൽ വിതരണം',
    ];
    const normalizeStockText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const boiledRiceAayCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isAay = scheme.includes('aay');
      const isBoiledRice = commodity.includes('br') || commodity.includes('boiled');

      return isAay && isBoiledRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const boiledRicePhhCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isPhh = scheme.includes('phh');
      const isBoiledRice = commodity.includes('br') || commodity.includes('boiled');

      return isPhh && isBoiledRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const boiledRiceNpsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNps = scheme.includes('nps');
      const isBoiledRice = commodity.includes('br') || commodity.includes('boiled');

      return isNps && isBoiledRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const boiledRiceNpnsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpns = scheme.includes('npns');
      const isBoiledRice = commodity.includes('br') || commodity.includes('boiled');

      return isNpns && isBoiledRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const boiledRiceNpiCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpi = scheme.includes('npi');
      const isBoiledRice = commodity.includes('br') || commodity.includes('boiled');

      return isNpi && isBoiledRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const rawRiceAayCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isAay = scheme.includes('aay');
      const isRawRice = commodity.includes('raw') || commodity.includes('rr');

      return isAay && isRawRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const rawRicePhhCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isPhh = scheme.includes('phh');
      const isRawRice = commodity.includes('raw') || commodity.includes('rr');

      return isPhh && isRawRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const rawRiceNpsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNps = scheme.includes('nps');
      const isRawRice = commodity.includes('raw') || commodity.includes('rr');

      return isNps && isRawRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const rawRiceNpnsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpns = scheme.includes('npns');
      const isRawRice = commodity.includes('raw') || commodity.includes('rr');

      return isNpns && isRawRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const rawRiceNpiCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpi = scheme.includes('npi');
      const isRawRice = commodity.includes('raw') || commodity.includes('rr');

      return isNpi && isRawRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const mattaRiceAayCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isAay = scheme.includes('aay');
      const isMattaRice = commodity.includes('matta') || commodity.includes('cmr');

      return isAay && isMattaRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const mattaRicePhhCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isPhh = scheme.includes('phh');
      const isMattaRice = commodity.includes('matta') || commodity.includes('cmr');

      return isPhh && isMattaRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const mattaRiceNpsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNps = scheme.includes('nps');
      const isMattaRice = commodity.includes('matta') || commodity.includes('cmr');

      return isNps && isMattaRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const mattaRiceNpnsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpns = scheme.includes('npns');
      const isMattaRice = commodity.includes('matta') || commodity.includes('cmr');

      return isNpns && isMattaRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const mattaRiceNpiCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpi = scheme.includes('npi');
      const isMattaRice = commodity.includes('matta') || commodity.includes('cmr');

      return isNpi && isMattaRice ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const wheatAayCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isAay = scheme.includes('aay');
      const isWheat = commodity.includes('wheat');

      return isAay && isWheat ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const wheatPhhCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isPhh = scheme.includes('phh');
      const isWheat = commodity.includes('wheat');

      return isPhh && isWheat ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const wheatNpsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNps = scheme.includes('nps');
      const isWheat = commodity.includes('wheat');

      return isNps && isWheat ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const wheatNpnsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpns = scheme.includes('npns');
      const isWheat = commodity.includes('wheat');

      return isNpns && isWheat ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const wheatNpiCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpi = scheme.includes('npi');
      const isWheat = commodity.includes('wheat');

      return isNpi && isWheat ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const isAttaCommodity = (value) => /(^|[^a-z])atta([^a-z]|$)/i.test(String(value || ''));
    const attaAayCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const isAay = scheme.includes('aay');

      return isAay && isAttaCommodity(record.Commodity) ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const attaPhhCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const isPhh = scheme.includes('phh');

      return isPhh && isAttaCommodity(record.Commodity) ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const attaAllCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const isAll = scheme === 'all';

      return isAll && isAttaCommodity(record.Commodity) ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const keroseneAllCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isAll = scheme === 'all';
      const isKerosene = commodity.includes('koil');

      return isAll && isKerosene ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const sugarAayCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isAay = scheme.includes('aay');
      const isSugar = commodity.includes('sugar');

      return isAay && isSugar ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const sugarPhhCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isPhh = scheme.includes('phh');
      const isSugar = commodity.includes('sugar');

      return isPhh && isSugar ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const sugarNpsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNps = scheme.includes('nps');
      const isSugar = commodity.includes('sugar');

      return isNps && isSugar ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const sugarNpnsCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpns = scheme.includes('npns');
      const isSugar = commodity.includes('sugar');

      return isNpns && isSugar ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const sugarNpiCbQty = (stockRegisterTable?.records || []).reduce((total, record) => {
      const scheme = normalizeStockText(record.Scheme);
      const commodity = normalizeStockText(record.Commodity);
      const isNpi = scheme.includes('npi');
      const isSugar = commodity.includes('sugar');

      return isNpi && isSugar ? total + parseQuantity(record['CB Qty']) : total;
    }, 0);
    const stockInfoValue = (rowIndex, columnIndex) => {
      if (rowIndex === 0 && columnIndex === 0) {
        return formatStatValue(boiledRiceAayCbQty, 'kg');
      }
      if (rowIndex === 0 && columnIndex === 1) {
        return formatStatValue(boiledRicePhhCbQty, 'kg');
      }
      if (rowIndex === 0 && columnIndex === 2) {
        return formatStatValue(boiledRiceNpsCbQty, 'kg');
      }
      if (rowIndex === 0 && columnIndex === 3) {
        return formatStatValue(boiledRiceNpnsCbQty, 'kg');
      }
      if (rowIndex === 0 && columnIndex === 4) {
        return formatStatValue(boiledRiceNpiCbQty, 'kg');
      }
      if (rowIndex === 1 && columnIndex === 0) {
        return formatStatValue(rawRiceAayCbQty, 'kg');
      }
      if (rowIndex === 1 && columnIndex === 1) {
        return formatStatValue(rawRicePhhCbQty, 'kg');
      }
      if (rowIndex === 1 && columnIndex === 2) {
        return formatStatValue(rawRiceNpsCbQty, 'kg');
      }
      if (rowIndex === 1 && columnIndex === 3) {
        return formatStatValue(rawRiceNpnsCbQty, 'kg');
      }
      if (rowIndex === 1 && columnIndex === 4) {
        return formatStatValue(rawRiceNpiCbQty, 'kg');
      }
      if (rowIndex === 2 && columnIndex === 0) {
        return formatStatValue(mattaRiceAayCbQty, 'kg');
      }
      if (rowIndex === 2 && columnIndex === 1) {
        return formatStatValue(mattaRicePhhCbQty, 'kg');
      }
      if (rowIndex === 2 && columnIndex === 2) {
        return formatStatValue(mattaRiceNpsCbQty, 'kg');
      }
      if (rowIndex === 2 && columnIndex === 3) {
        return formatStatValue(mattaRiceNpnsCbQty, 'kg');
      }
      if (rowIndex === 2 && columnIndex === 4) {
        return formatStatValue(mattaRiceNpiCbQty, 'kg');
      }
      if (rowIndex === 3 && columnIndex === 0) {
        return formatStatValue(wheatAayCbQty, 'kg');
      }
      if (rowIndex === 3 && columnIndex === 1) {
        return formatStatValue(wheatPhhCbQty, 'kg');
      }
      if (rowIndex === 3 && columnIndex === 2) {
        return formatStatValue(wheatNpsCbQty, 'kg');
      }
      if (rowIndex === 3 && columnIndex === 3) {
        return formatStatValue(wheatNpnsCbQty, 'kg');
      }
      if (rowIndex === 3 && columnIndex === 4) {
        return formatStatValue(wheatNpiCbQty, 'kg');
      }
      if (rowIndex === 4 && columnIndex === 0) {
        return formatStatValue(attaAayCbQty, 'kg');
      }
      if (rowIndex === 4 && columnIndex === 1) {
        return formatStatValue(attaPhhCbQty, 'kg');
      }
      if (rowIndex === 6 && columnIndex === 0) {
        return formatStatValue(sugarAayCbQty, 'kg');
      }
      if (rowIndex === 6 && columnIndex === 1) {
        return formatStatValue(sugarPhhCbQty, 'kg');
      }
      if (rowIndex === 6 && columnIndex === 2) {
        return formatStatValue(sugarNpsCbQty, 'kg');
      }
      if (rowIndex === 6 && columnIndex === 3) {
        return formatStatValue(sugarNpnsCbQty, 'kg');
      }
      if (rowIndex === 6 && columnIndex === 4) {
        return formatStatValue(sugarNpiCbQty, 'kg');
      }
      return '';
    };
    const renderStockInfoTable = (expanded = false) => {
      const border = expanded ? '2px solid #111111' : '3px solid #111111';
      const cellFontSize = expanded ? { xs: 9, sm: 12 } : { xs: 12, sm: 15 };
      const cellPadding = expanded ? 0.45 : 0.75;

      return (
        <Box
          component="table"
          sx={{
            width: '100%',
            minWidth: expanded ? 0 : 620,
            tableLayout: expanded ? 'fixed' : 'auto',
            borderCollapse: 'collapse',
          }}
        >
          <Box component="thead">
            <Box component="tr">
              {stockInfoHeaders.map((header, index) => (
                <Box
                  component="th"
                  key={header}
                  sx={{
                    width: expanded ? (index === 0 ? '30%' : '14%') : 'auto',
                    p: expanded ? 0.45 : 0.8,
                    border,
                    background: index === 0 ? '#ffffff' : index === 1 ? '#ffea00' : index === 2 ? '#f26aaa' : index === 3 ? '#22a7c8' : '#ffffff',
                    color: '#000000',
                    fontSize: cellFontSize,
                    fontWeight: 1000,
                    lineHeight: 1.15,
                    textAlign: 'center',
                    whiteSpace: expanded ? 'normal' : 'nowrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {header}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {stockInfoRows.map((item, rowIndex) => (
              <Box component="tr" key={item}>
                <Box
                  component="td"
                  sx={{
                    p: cellPadding,
                    border,
                    color: '#2f3192',
                    fontSize: cellFontSize,
                    fontWeight: 1000,
                    lineHeight: 1.15,
                    whiteSpace: expanded ? 'normal' : 'nowrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {item}
                </Box>
                {rowIndex === 5 ? (
                  <Box
                    component="td"
                    colSpan={5}
                    sx={{ p: cellPadding, border, height: expanded ? 30 : 28, color: '#111827', fontSize: cellFontSize, fontWeight: 900, textAlign: 'center' }}
                  >
                    {formatStatValue(keroseneAllCbQty, 'ltr')}
                  </Box>
                ) : rowIndex === 4 ? (
                  <>
                    {stockInfoHeaders.slice(1, 3).map((header, columnIndex) => (
                      <Box
                        component="td"
                        key={`${item}-${header}`}
                        sx={{ p: cellPadding, border, height: expanded ? 30 : 28, color: '#111827', fontSize: cellFontSize, fontWeight: 900, textAlign: 'center', overflowWrap: 'anywhere' }}
                      >
                        {stockInfoValue(rowIndex, columnIndex)}
                      </Box>
                    ))}
                    <Box
                      component="td"
                      colSpan={3}
                      sx={{ p: cellPadding, border, height: expanded ? 30 : 28, color: '#111827', fontSize: cellFontSize, fontWeight: 900, textAlign: 'center', overflowWrap: 'anywhere' }}
                    >
                      {formatStatValue(attaAllCbQty, 'kg')}
                    </Box>
                  </>
                ) : stockInfoHeaders.slice(1).map((header, columnIndex) => (
                  <Box
                    component="td"
                    key={`${item}-${header}`}
                    sx={{ p: cellPadding, border, height: expanded ? 30 : 28, color: '#111827', fontSize: cellFontSize, fontWeight: 900, textAlign: 'center', overflowWrap: 'anywhere' }}
                  >
                    {stockInfoValue(rowIndex, columnIndex)}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      );
    };
    return (
      <Paper elevation={0} sx={{ borderRadius: 3, background: '#ffffff', border: '1px solid #e8edf7', boxShadow: '0 16px 34px rgba(26, 58, 109, 0.10)', overflow: 'hidden' }}>
        <Box component="form" onSubmit={handleStockBoardSubmit} sx={{ p: 2, background: '#ffffff' }}>
          <Grid container spacing={1.5}>
            {[
              ['fps_id', 'FPS ID'],
              ['dist_code', 'DISTRICT'],
              ['office_code', 'OFFICE CODE'],
              ['month', 'MONTH'],
              ['year', 'YEAR'],
            ].map(([name, label]) => (
              <Grid item xs={name === 'fps_id' ? 12 : 6} key={name}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                  {label} *
                </Typography>
                {name === 'dist_code' ? (
                  renderSelectControl({
                    selectKey: 'stock-board-district',
                    name,
                    value: stockBoardForm[name],
                    onChange: handleStockBoardChange,
                    placeholder: 'Select district',
                    options: districtOptions,
                    pickerType: 'district',
                  })
                ) : name === 'office_code' ? (
                  renderSelectControl({
                    selectKey: 'stock-board-office',
                    name,
                    value: stockBoardForm[name],
                    onChange: handleStockBoardChange,
                    placeholder: afsoOptionsByDistrict[stockBoardForm.dist_code]?.length
                      ? 'Select office'
                      : 'Office list pending',
                    options: afsoOptionsByDistrict[stockBoardForm.dist_code] || [],
                    pickerType: 'district',
                    disabled: !(afsoOptionsByDistrict[stockBoardForm.dist_code]?.length),
                  })
                ) : name === 'month' || name === 'year' ? (
                  renderSelectControl({
                    selectKey: `stock-board-${name}`,
                    name,
                    value: stockBoardForm[name],
                    onChange: handleStockBoardChange,
                    placeholder: name === 'month' ? 'Select month' : 'Select year',
                    options: name === 'month' ? monthOptions : yearOptions,
                    pickerType: name === 'month' ? 'month' : 'year',
                  })
                ) : (
                  <Box
                    component="input"
                    name={name}
                    value={stockBoardForm[name]}
                    onChange={handleStockBoardChange}
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
                )}
              </Grid>
            ))}
          </Grid>
          <Button
            type="submit"
            variant="contained"
            disabled={stockBoardLoading}
            sx={{
              width: '100%',
              mt: 2,
              py: 1.35,
              fontSize: 15,
              fontWeight: 800,
              textTransform: 'none',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #2767f7 0%, #2255e6 100%)',
              boxShadow: '0 12px 24px rgba(36, 94, 255, 0.30)',
            }}
          >
            {stockBoardLoading ? <CircularProgress size={22} color="inherit" /> : 'Get Stock Register'}
          </Button>
          {stockBoardError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {stockBoardError}
            </Alert>
          )}
        </Box>

        {stockBoardResult && (
          <>
        <Box sx={{ background: '#2f3192', color: '#ffffff', textAlign: 'center', py: 1.2, px: 1 }}>
          <Typography sx={{ fontSize: { xs: 24, sm: 34 }, fontWeight: 1000, lineHeight: 1.1 }}>
            പൊതുവിതരണ കേന്ദ്രം
          </Typography>
          <Typography sx={{ fontSize: { xs: 13, sm: 18 }, fontWeight: 900, mt: 0.4 }}>
            സിവിൽ സപ്ലൈസ് വകുപ്പ്, കേരള സർക്കാർ അംഗീകാരമുള്ളത്
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(145px, 0.9fr) minmax(0, 1.1fr)',
            borderBottom: '2px solid #111827',
            '& > *': { borderTop: '1px solid #d1d5db' },
            '& > :nth-of-type(odd)': {
              background: '#f8fafc',
              borderRight: '1px solid #d1d5db',
            },
          }}
        >
          <Box sx={stockBoardInfoCellSx}>റേഷൻ നമ്പർ/ARD No. :</Box>
          <Box sx={{ ...stockBoardInfoCellSx, whiteSpace: 'nowrap' }}>
            {stockBoardForm.fps_id || '-'}
          </Box>
          <Box sx={stockBoardInfoCellSx}>TSO :</Box>
          <Box sx={{ ...stockBoardInfoCellSx, overflowWrap: 'anywhere' }}>
            {selectedOfficeLabel}
          </Box>
          <Box sx={stockBoardInfoCellSx}>ലൈസൻസിയുടെ പേര് :</Box>
          <Box sx={{ ...stockBoardInfoCellSx, overflowWrap: 'anywhere' }}>
            {stockBoardResult?.licensee_name || '-'}
          </Box>
          <Box sx={stockBoardInfoCellSx}>പ്രവർത്തന സമയം :</Box>
          <Box sx={{ ...stockBoardInfoCellSx, display: 'block', whiteSpace: 'nowrap' }}>
            9 AM - 12 PM
            <br />
            4 PM - 7 PM
          </Box>
        </Box>

        <Box sx={{ p: 1.5, borderTop: '2px solid #111827', overflowX: 'auto' }}>
          <Typography
            sx={{
              textAlign: 'center',
              color: '#e11d24',
              fontSize: { xs: 24, sm: 34 },
              fontWeight: 1000,
              lineHeight: 1.05,
              mb: 1,
            }}
          >
            സ്റ്റോക്ക് വിവരം{' '}
            <Box component="span" sx={{ color: '#2f3192', fontSize: { xs: 15, sm: 20 }, fontWeight: 1000 }}>
              (കി.ഗ്രാമിൽ)
            </Box>
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={() => setStockTableOpen(true)}
              sx={{ fontWeight: 800, textTransform: 'none' }}
            >
              View full table
            </Button>
          </Box>
          {renderStockInfoTable()}
        </Box>

        <Dialog
          fullScreen
          open={stockTableOpen}
          onClose={() => setStockTableOpen(false)}
          aria-labelledby="stock-table-dialog-title"
        >
          <DialogTitle
            id="stock-table-dialog-title"
            sx={{
              minHeight: 52,
              px: 1.5,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#e11d24',
              fontWeight: 1000,
            }}
          >
            സ്റ്റോക്ക് വിവരം (കി.ഗ്രാമിൽ)
            <IconButton
              type="button"
              aria-label="Close full table"
              title="Close"
              onClick={() => setStockTableOpen(false)}
              sx={{ width: 40, height: 40, color: '#111827', fontSize: 28 }}
            >
              ×
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 1, overflow: 'hidden' }}>
            {renderStockInfoTable(true)}
          </DialogContent>
        </Dialog>

          </>
        )}
      </Paper>
    );
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

  const isCommissionView = activeView === 'commission';
  const serviceForm = isCommissionView ? commissionForm : transactionForm;
  const serviceLoading = isCommissionView ? commissionLoading : transactionsLoading;
  const serviceError = isCommissionView ? commissionError : transactionsError;
  const serviceResult = isCommissionView ? commissionResult : transactionsResult;
  const serviceChangeHandler = isCommissionView ? handleCommissionChange : handleTransactionChange;
  const serviceSubmitHandler = isCommissionView ? handleCommissionSubmit : handleTransactionsSubmit;
  const commissionCalculation = calculateCommission(commissionResult?.summary);
  const handleDownloadCommissionPayslip = () => {
    if (!commissionResult?.summary) return;

    const summary = commissionResult.summary;
    const commodityTotals = summary.commodity_totals || {};
    const tdsAmount = commissionCalculation.commission * 0.02;
    const generatedAt = new Date().toLocaleString('en-IN');
    const periodLabel = `${monthOptions.find(([value]) => value === commissionForm.month)?.[1] || commissionForm.month} ${commissionForm.year}`;
    const rows = [
      ['FPS ID', commissionForm.fps_id || '-'],
      ['Period', periodLabel],
      ['Date Range', `${summary.from_date || toEposDate(commissionForm.from_date)} to ${summary.to_date || toEposDate(commissionForm.to_date)}`],
      ['Gross Commission', `Rs. ${formatNumber(commissionCalculation.commission)}`],
      ['TDS @ 2%', `Rs. ${formatNumber(tdsAmount)}`],
      ['Collected from RC Holders', `Rs. ${formatNumber(commissionCalculation.alreadyCollectedAmount)}`],
      ['Eligible Sales', `${formatNumber(commissionCalculation.eligibleKg)} kg`],
      ['Quintals', formatNumber(commissionCalculation.eligibleKg / 100)],
      ['Transactions', summary.transaction_count || 0],
      ['Wheat', formatStatValue(commodityTotals.wheat || 0, 'kg')],
      ['Atta', formatStatValue(commodityTotals.atta || 0, 'kg')],
      ['RR', formatStatValue(commodityTotals.rr || 0, 'kg')],
      ['BR', formatStatValue(commodityTotals.br || 0, 'kg')],
      ['CMR', formatStatValue(commodityTotals.cmr || 0, 'kg')],
    ];

    const payslipWindow = window.open('', '_blank');
    if (!payslipWindow) {
      window.alert('Please allow popups for this site to download the payslip PDF.');
      return;
    }

    payslipWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Commission Payslip - FPS ${commissionForm.fps_id || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
            .payslip { max-width: 760px; margin: 0 auto; border: 1px solid #d1d5db; padding: 24px; }
            h1 { margin: 0; font-size: 24px; text-align: center; }
            .subtitle { margin: 8px 0 20px; text-align: center; color: #4b5563; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border: 1px solid #d1d5db; padding: 10px 12px; font-size: 14px; }
            th { width: 45%; text-align: left; background: #f3f4f6; text-transform: uppercase; font-size: 12px; }
            td { font-weight: 700; }
            .gross { color: #6d28d9; font-size: 18px; }
            .note { margin-top: 18px; color: #6b7280; font-size: 12px; line-height: 1.5; }
            @media print { body { margin: 0; } .payslip { border: 0; } }
          </style>
        </head>
        <body>
          <div class="payslip">
            <h1>Commission Payslip</h1>
            <div class="subtitle">Generated on ${generatedAt}</div>
            <table>
              <tbody>
                ${rows.map(([label, value]) => `
                  <tr>
                    <th>${label}</th>
                    <td class="${label === 'Gross Commission' ? 'gross' : ''}">${value}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="note">
              Sugar and kerosene are excluded from eligible sales. Data is calculated from live transaction and RO order responses.
              This is not an official government payslip.
            </div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    payslipWindow.document.close();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f4f6fb',
        background: 'linear-gradient(180deg, #e8f0ff 0%, #f5f7fb 40%, #f6f8fc 100%)',
        pb: 4,
      }}
    >
      <Analytics />
      <SpeedInsights />
      {renderPickerModal()}
      <Container maxWidth="sm" sx={{ pt: 3, pb: 4 }}>
        {activeView !== 'home' && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {activeViewTitle}
            </Typography>
          </Box>
          <Button
              type="button"
              variant="outlined"
              onClick={() => setActiveView('home')}
              sx={{
                height: 40,
                borderRadius: 2,
                px: 2,
                fontWeight: 800,
                textTransform: 'none',
                background: '#ffffff',
              }}
            >
              Home
          </Button>
        </Box>
        )}

        {activeView === 'home' ? (
          <Box component="section" aria-labelledby="services-title">
            <Box
              aria-label="റേഷൻ കട"
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '3 / 1',
                mb: 2.5,
                display: 'grid',
                placeItems: 'center',
                containerType: 'inline-size',
                overflow: 'hidden',
                borderRadius: 2,
                background: '#df0505',
                boxShadow: '0 10px 24px rgba(108, 24, 24, 0.18)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: '#ffd21a',
                  clipPath: 'polygon(86% 0, 100% 0, 100% 100%, 35% 100%)',
                },
              }}
            >
              <Typography
                component="div"
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  maxWidth: 'calc(100% - 24px)',
                  color: '#07156f',
                  fontSize: 40,
                  fontWeight: 1000,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  WebkitTextStroke: '2px #ffffff',
                  paintOrder: 'stroke fill',
                  textShadow: '0 6px 3px rgba(0, 0, 0, 0.28)',
                  '@container (min-width: 480px)': {
                    fontSize: 68,
                    WebkitTextStroke: '3px #ffffff',
                  },
                }}
              >
                റേഷൻ കട
              </Typography>
            </Box>
            <Typography id="services-title" sx={{ mb: 1.5, color: '#31415f', fontSize: 14, fontWeight: 800 }}>
              Services
            </Typography>
            <Grid container spacing={1.5}>
              {featurePages.map((page) => (
                <Grid item xs={12} sm={6} key={page.view}>
                  <Paper
                    component="button"
                    type="button"
                    elevation={0}
                    onClick={() => setActiveView(page.view)}
                    sx={{
                      width: '100%',
                      minHeight: 96,
                      p: 2,
                      display: 'grid',
                      gridTemplateColumns: '48px minmax(0, 1fr) 24px',
                      alignItems: 'center',
                      gap: 1.5,
                      textAlign: 'left',
                      borderRadius: 2,
                      border: '1px solid #dfe5f0',
                      background: '#ffffff',
                      cursor: 'pointer',
                      transition: 'border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease',
                      '&:hover': {
                        borderColor: page.color,
                        boxShadow: '0 8px 18px rgba(26, 58, 109, 0.10)',
                        transform: 'translateY(-1px)',
                      },
                      '&:active': { transform: 'translateY(0)' },
                    }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 48,
                        height: 48,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 2,
                        color: page.color,
                        background: page.background,
                        fontSize: 14,
                        fontWeight: 1000,
                      }}
                    >
                      {page.mark}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: '#17233c', fontSize: 15, fontWeight: 900, lineHeight: 1.25 }}>
                        {page.title}
                      </Typography>
                      <Typography sx={{ mt: 0.35, color: '#7b8395', fontSize: 12, fontWeight: 700 }}>
                        {page.category}
                      </Typography>
                    </Box>
                    <Typography aria-hidden="true" sx={{ color: '#64748b', fontSize: 28, lineHeight: 1, textAlign: 'center' }}>
                      ›
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : activeView === 'stock' ? (
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
                  ['raw_rice_bag_weight', 'RAW RICE'],
                  ['boiled_rice_bag_weight', 'BOILED RICE'],
                  ['matta_cmr_bag_weight', 'MATTA / CMR'],
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
        ) : activeView === 'stockBoard' ? (
          renderStockBoard()
        ) : activeView === 'rationCard' ? (
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
              <Stack spacing={2} component="form" onSubmit={handleRationCardSubmit}>
                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      RATION CARD NUMBER *
                    </Typography>
                    <Box
                      component="input"
                      name="src_no"
                      value={rationCardForm.src_no}
                      onChange={handleRationCardChange}
                      inputMode="numeric"
                      placeholder="Enter ration card number"
                      sx={{
                        width: '100%',
                        height: 54,
                        borderRadius: 2,
                        border: '1px solid #d7dfef',
                        px: 1.5,
                        mt: 0.75,
                        fontSize: 16,
                        fontWeight: 800,
                        color: '#0f172a',
                        outline: 'none',
                        background: '#fbfdff',
                        '&:focus': {
                          borderColor: '#2f64f8',
                          boxShadow: '0 0 0 3px rgba(47, 100, 248, 0.12)',
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      MONTH *
                    </Typography>
                    {renderSelectControl({
                      selectKey: 'ration-card-month',
                      name: 'month',
                      value: rationCardForm.month,
                      onChange: handleRationCardChange,
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
                      selectKey: 'ration-card-year',
                      name: 'year',
                      value: rationCardForm.year,
                      onChange: handleRationCardChange,
                      placeholder: 'Select year',
                      options: yearOptions,
                      pickerType: 'year',
                    })}
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={rationCardLoading}
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
                  {rationCardLoading ? <CircularProgress size={22} color="inherit" /> : 'Get Ration Card Details'}
                </Button>
              </Stack>
            </Paper>

            <Stack spacing={2}>
              {rationCardError && (
                <Alert severity="error">
                  {rationCardError}
                </Alert>
              )}

              {rationCardResult && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: '#ffffff',
                    border: '1px solid #dbe4f0',
                    boxShadow: '0 10px 26px rgba(15, 23, 42, 0.06)',
                  }}
                >
                  {renderRationCardTables()}
                </Paper>
              )}
            </Stack>
          </>
        ) : activeView === 'transactions' || activeView === 'commission' ? (
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
              <Stack spacing={2} component="form" onSubmit={serviceSubmitHandler}>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      FROM DATE *
                    </Typography>
                    <Box
                      component="input"
                      name="from_date"
                      value={serviceForm.from_date}
                      onChange={serviceChangeHandler}
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
                      value={serviceForm.to_date}
                      onChange={serviceChangeHandler}
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
                          value: serviceForm[name],
                          onChange: serviceChangeHandler,
                          placeholder: 'Select district',
                          options: districtOptions,
                          pickerType: 'district',
                        })
                      ) : name === 'afso' ? (
                        renderSelectControl({
                          selectKey: 'transactions-afso',
                          name,
                          value: serviceForm[name],
                          onChange: serviceChangeHandler,
                          placeholder: afsoOptionsByDistrict[serviceForm.dist_code]?.length
                            ? 'Select AFSO'
                            : 'AFSO list pending',
                          options: afsoOptionsByDistrict[serviceForm.dist_code] || [],
                          pickerType: 'district',
                          disabled: !(afsoOptionsByDistrict[serviceForm.dist_code]?.length),
                        })
                      ) : name === 'month' || name === 'year' ? (
                        renderSelectControl({
                          selectKey: `transactions-${name}`,
                          name,
                          value: serviceForm[name],
                          onChange: serviceChangeHandler,
                          placeholder: name === 'month' ? 'Select month' : 'Select year',
                          options: name === 'month' ? monthOptions : yearOptions,
                          pickerType: name === 'month' ? 'month' : 'year',
                        })
                      ) : (
                        <Box
                          component="input"
                          name={name}
                          value={serviceForm[name]}
                          onChange={serviceChangeHandler}
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
                  disabled={serviceLoading}
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
                  {serviceLoading ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : activeView === 'commission' ? (
                    'Calculate Commission'
                  ) : (
                    'Get Transactions'
                  )}
                </Button>
              </Stack>
            </Paper>

            {serviceError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {serviceError}
              </Alert>
            )}

            {serviceResult && (
              <Box>
                {activeView === 'commission' && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Commission Summary
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#6d7584', fontWeight: 700 }}>
                        {serviceResult.row_count || 0} records
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#3b63f4', fontWeight: 700 }}>
                      {Math.round(serviceResult.total_duration_ms || 0)} ms
                    </Typography>
                  </Box>
                )}

                {(serviceResult.title || activeView === 'transactions') && (
                  <Box sx={{ mb: 1.5 }}>
                    {serviceResult.title && (
                      <Typography variant="body2" sx={{ color: '#6d7584', fontWeight: 700 }}>
                        {serviceResult.title}
                      </Typography>
                    )}
                    {activeView === 'transactions' && (
                      <Typography variant="body2" sx={{ color: '#6d7584', mt: 0.4, fontWeight: 700 }}>
                        From: {serviceResult.summary?.from_date || toEposDate(serviceForm.from_date)} · To: {serviceResult.summary?.to_date || toEposDate(serviceForm.to_date)}
                      </Typography>
                    )}
                  </Box>
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
                  {activeView === 'commission' ? (
                    <>
                      <Typography variant="caption" sx={{ color: '#7b8395', fontWeight: 800, letterSpacing: 0.4 }}>
                        GROSS COMMISSION
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, color: '#7c3aed', mt: 1 }}>
                        Rs. {formatNumber(Math.round(commissionCalculation.commission), 0)}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.75, color: '#6d7584', fontWeight: 700 }}>
                        Exact amount: Rs. {formatNumber(commissionCalculation.commission)}
                      </Typography>
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={handleDownloadCommissionPayslip}
                        sx={{
                          mt: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 800,
                        }}
                      >
                        Download Payslip PDF
                      </Button>
                      <Box sx={{ mt: 1.5, p: 2, borderRadius: 2, bgcolor: '#f7f5ff', textAlign: 'left' }}>
                        <Typography sx={{ color: '#5b21b6', fontWeight: 900 }}>
                          {commissionCalculation.tier}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.6, color: '#5f6675', fontWeight: 700 }}>
                          {commissionCalculation.formula}
                        </Typography>
                      </Box>
                      <Box
                        component="table"
                        sx={{
                          width: '100%',
                          mt: 1.5,
                          borderCollapse: 'collapse',
                          tableLayout: 'fixed',
                          border: '1px solid #dfe5f0',
                          '& th, & td': {
                            border: '1px solid #dfe5f0',
                            textAlign: 'center',
                            px: { xs: 0.4, sm: 1 },
                            py: 1,
                          },
                          '& th': {
                            bgcolor: '#f7f8fb',
                            color: '#7b8395',
                            fontSize: { xs: 9, sm: 11 },
                            fontWeight: 900,
                            lineHeight: 1.2,
                            textTransform: 'uppercase',
                          },
                          '& td': {
                            bgcolor: '#ffffff',
                            color: '#111827',
                            fontSize: { xs: 15, sm: 18 },
                            fontWeight: 900,
                            lineHeight: 1.25,
                          },
                        }}
                      >
                        <Box component="thead">
                          <Box component="tr">
                            <Box component="th">TDS @ 2%</Box>
                            <Box component="th">Collected from RC Holders</Box>
                          </Box>
                        </Box>
                        <Box component="tbody">
                          <Box component="tr">
                            <Box component="td">
                              Rs. {formatNumber(commissionCalculation.commission * 0.02)}
                            </Box>
                            <Box component="td">
                              Rs. {formatNumber(commissionCalculation.alreadyCollectedAmount)}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Box
                        component="table"
                        sx={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          tableLayout: 'fixed',
                          border: '1px solid #dfe5f0',
                          '& th, & td': {
                            border: '1px solid #dfe5f0',
                            textAlign: 'center',
                            px: { xs: 0.4, sm: 1 },
                            py: 1,
                          },
                          '& th': {
                            bgcolor: '#f7f8fb',
                            color: '#7b8395',
                            fontSize: { xs: 9, sm: 11 },
                            fontWeight: 900,
                            lineHeight: 1.2,
                            textTransform: 'uppercase',
                          },
                          '& td': {
                            bgcolor: '#ffffff',
                            color: '#111827',
                            fontSize: { xs: 15, sm: 18 },
                            fontWeight: 900,
                            lineHeight: 1.25,
                          },
                        }}
                      >
                        <Box component="thead">
                          <Box component="tr">
                            <Box component="th">Eligible Sales</Box>
                            <Box component="th">Quintals</Box>
                            <Box component="th">Transactions</Box>
                          </Box>
                        </Box>
                        <Box component="tbody">
                          <Box component="tr">
                            <Box component="td">{formatNumber(commissionCalculation.eligibleKg)} kg</Box>
                            <Box component="td">{formatNumber(commissionCalculation.eligibleKg / 100)}</Box>
                            <Box component="td">{serviceResult.summary?.transaction_count || 0}</Box>
                          </Box>
                        </Box>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Box
                        component="table"
                        sx={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          tableLayout: 'fixed',
                          border: '1px solid #dfe5f0',
                          '& th, & td': {
                            border: '1px solid #dfe5f0',
                            textAlign: 'center',
                            px: { xs: 0.3, sm: 1 },
                            py: 1,
                          },
                          '& th': {
                            bgcolor: '#f7f8fb',
                            color: '#7b8395',
                            fontSize: { xs: 9, sm: 11 },
                            fontWeight: 900,
                            lineHeight: 1.2,
                            textTransform: 'uppercase',
                          },
                          '& td': {
                            bgcolor: '#ffffff',
                            color: '#111827',
                            fontSize: { xs: 13, sm: 16 },
                            fontWeight: 900,
                            lineHeight: 1.25,
                          },
                        }}
                      >
                        <Box component="thead">
                          <Box component="tr">
                            {['Wheat', 'Atta', 'RR', 'BR', 'CMR'].map((label) => (
                              <Box component="th" key={label}>
                                {label}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                        <Box component="tbody">
                          <Box component="tr">
                            {['wheat', 'atta', 'rr', 'br', 'cmr'].map((key) => (
                              <Box component="td" key={key}>
                                {formatStatValue(serviceResult.summary?.commodity_totals?.[key] || 0, 'kg')}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#7b8395', fontWeight: 700 }}>
                        Sugar and kerosene are excluded from eligible sales.
                      </Typography>
                      {commissionCalculation.requiresOldCommissionCap && (
                        <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                          Sales exceed 294 quintals. The final commission cannot be more than Rs. 8,000 above the old-method commission. Entering or calculating the old commission is still required to apply this limit.
                        </Alert>
                      )}
                    </>
                  ) : (
                    <>
                      <Typography variant="caption" sx={{ color: '#7b8395', fontWeight: 800, letterSpacing: 0.4 }}>
                        TOTAL AMOUNT COLLECTED
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, color: '#2f64f8', mt: 1 }}>
                        Rs. {formatStatValue(serviceResult.summary?.total_amount || 0, '')}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Grid container spacing={1.5}>
                        <Grid item xs={12}>
                          {renderStat('TRANSACTIONS', serviceResult.summary?.transaction_count || 0)}
                        </Grid>
                      </Grid>
                      <Divider sx={{ my: 2 }} />
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mb: 1, color: '#7b8395', fontWeight: 800, letterSpacing: 0.4 }}
                      >
                        SCHEME-WISE TRANSACTIONS
                      </Typography>
                      <Box sx={{ overflowX: 'hidden' }}>
                        <Box
                          component="table"
                          sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}
                        >
                          <Box component="thead">
                            <Box component="tr">
                              {[
                                ['ITEM', '#ffffff'],
                                ['AAY', '#ffea00'],
                                ['PHH', '#f26aaa'],
                                ['NPS', '#22a7c8'],
                                ['NPNS', '#ffffff'],
                                ['NPI', '#bbf7d0'],
                                ['TOTAL', '#e5e7eb'],
                              ].map(([scheme, background]) => (
                                <Box
                                  component="th"
                                  key={scheme}
                                  sx={{ width: scheme === 'ITEM' ? '22%' : '13%', p: { xs: 0.35, sm: 0.8 }, border: '2px solid #111111', background, color: '#000000', fontSize: { xs: 9, sm: 12 }, fontWeight: 1000, overflowWrap: 'anywhere' }}
                                >
                                  {scheme}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          <Box component="tbody">
                            {[
                              ['TRANSACTIONS', null],
                              ['WHEAT', 'wheat'],
                              ['ATTA', 'atta'],
                              ['RR', 'rr'],
                              ['BR', 'br'],
                              ['CMR', 'cmr'],
                              ['SUGAR', 'sugar'],
                              ['KOIL', 'koil'],
                            ].map(([label, commodityKey]) => (
                              <Box component="tr" key={label}>
                                <Box
                                  component="td"
                                  sx={{ p: { xs: 0.35, sm: 0.9 }, border: '2px solid #111111', color: '#2f3192', fontSize: { xs: 9, sm: 12 }, fontWeight: 1000, lineHeight: 1.15, textAlign: 'left', overflowWrap: 'anywhere' }}
                                >
                                  {label}
                                </Box>
                                {['AAY', 'PHH', 'NPS', 'NPNS', 'NPI'].map((scheme) => (
                                  <Box
                                    component="td"
                                    key={`${label}-${scheme}`}
                                    sx={{ p: { xs: 0.3, sm: 0.9 }, border: '2px solid #111111', color: '#111827', fontSize: { xs: 9, sm: 13 }, fontWeight: 900, lineHeight: 1.15, textAlign: 'center', whiteSpace: 'normal' }}
                                  >
                                    {commodityKey
                                      ? formatStatValue(
                                        serviceResult.summary?.scheme_commodity_totals?.[scheme]?.[commodityKey] || 0,
                                        commodityKey === 'koil' ? 'ltr' : 'kg'
                                      )
                                      : serviceResult.summary?.scheme_transaction_counts?.[scheme] || 0}
                                    </Box>
                                ))}
                                <Box
                                  component="td"
                                  sx={{ p: { xs: 0.3, sm: 0.9 }, border: '2px solid #111111', background: '#f3f4f6', color: '#111827', fontSize: { xs: 9, sm: 13 }, fontWeight: 1000, lineHeight: 1.15, textAlign: 'center', whiteSpace: 'normal' }}
                                >
                                  {commodityKey
                                    ? formatStatValue(
                                      serviceResult.summary?.commodity_totals?.[commodityKey] || 0,
                                      commodityKey === 'koil' ? 'ltr' : 'kg'
                                    )
                                    : serviceResult.summary?.transaction_count || 0}
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>
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
                                serviceResult.summary?.commodity_totals?.[key] || 0,
                                key === 'koil' ? 'ltr' : 'kg'
                              )
                            )}
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}
                </Paper>
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
              <Stack spacing={2} component="form" onSubmit={handleSettingsSubmit}>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      MONTH *
                    </Typography>
                    {renderSelectControl({
                      selectKey: 'settings-month',
                      name: 'month',
                      value: settingsForm.month,
                      onChange: handleSettingsChange,
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
                      selectKey: 'settings-year',
                      name: 'year',
                      value: settingsForm.year,
                      onChange: handleSettingsChange,
                      placeholder: 'Select year',
                      options: yearOptions,
                      pickerType: 'year',
                    })}
                  </Grid>
                </Grid>

                <Grid container spacing={1.5}>
                  <Grid item xs={12}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      SHOP NO *
                    </Typography>
                    <Box
                      component="input"
                      name="shop_no"
                      value={settingsForm.shop_no}
                      onChange={handleSettingsChange}
                      required
                      type="number"
                      placeholder="Enter shop number"
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
                  <Grid item xs={12} sx={{ flexBasis: '100%', maxWidth: '100%', width: '100%' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      DISTRICT *
                    </Typography>
                    {renderSelectControl({
                      selectKey: 'settings-district',
                      name: 'dist_code',
                      value: settingsForm.dist_code,
                      onChange: handleSettingsChange,
                      placeholder: 'Select district',
                      options: districtOptions,
                      pickerType: 'district',
                    })}
                  </Grid>
                  <Grid item xs={12} sx={{ flexBasis: '100%', maxWidth: '100%', width: '100%' }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#6d7584' }}>
                      DEPOT *
                    </Typography>
                    {renderSelectControl({
                      selectKey: 'settings-depot',
                      name: 'depot_id',
                      value: settingsForm.depot_id,
                      onChange: handleSettingsChange,
                      placeholder:
                        depotOptionsByDistrict[settingsForm.dist_code]?.length
                          ? 'Select depot'
                          : 'Depot list pending',
                      options: depotOptionsByDistrict[settingsForm.dist_code] || [],
                      pickerType: 'district',
                      disabled: !depotOptionsByDistrict[settingsForm.dist_code]?.length,
                    })}
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={settingsLoading}
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
                  {settingsLoading ? <CircularProgress size={22} color="inherit" /> : 'Get RO Details'}
                </Button>
              </Stack>
            </Paper>

            {settingsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {settingsError}
              </Alert>
            )}

            {settingsResult && (
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    RO Details
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#3b63f4', fontWeight: 700 }}>
                    {Math.round(settingsResult.duration_ms || 0)} ms
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#6d7584', fontWeight: 700, mt: -1 }}>
                  Select an RO order below to view quantity details.
                </Typography>

                {(settingsResult.tables || []).map((table, tableIndex) => (
                  <Paper
                    key={tableIndex}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      background: '#ffffff',
                      border: '1px solid #e8edf7',
                      boxShadow: '0 12px 28px rgba(26, 58, 109, 0.08)',
                      overflowX: 'auto',
                      '@keyframes roRowHint': {
                        '0%, 100%': { backgroundColor: '#fbfdff' },
                        '50%': { backgroundColor: '#eef5ff' },
                      },
                    }}
                  >
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px', minWidth: 520 }}>
                      <Box component="thead">
                        <Box component="tr">
                          {(table.headers || []).map((header, index) => (
                            <Box
                              component="th"
                              key={`${header}-${index}`}
                              sx={{
                                textAlign: 'left',
                                px: 1,
                                py: 0.6,
                                fontSize: 12,
                                color: '#6d7584',
                              }}
                            >
                              {header}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {(table.rows || []).slice(0, 30).map((row, rowIndex) => {
                          const actionParams = table.row_actions?.[rowIndex];
                          const isClickable = Boolean(actionParams?.release_order_id_aso);

                          return (
                          <Box
                            component="tr"
                            key={rowIndex}
                            onClick={() => isClickable && handleRoQuantityClick(actionParams)}
                            sx={{
                              cursor: isClickable ? 'pointer' : 'default',
                              animation: isClickable ? 'roRowHint 2.4s ease-in-out infinite' : 'none',
                              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                              '&:hover': isClickable
                                ? {
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 10px 22px rgba(47, 100, 248, 0.14)',
                                  animationPlayState: 'paused',
                                  '& td': {
                                    background: '#eef5ff',
                                    borderColor: '#bcd0ff',
                                  },
                                }
                                : undefined,
                              '&:active': isClickable ? { transform: 'translateY(0)' } : undefined,
                            }}
                          >
                            {row.map((cell, cellIndex) => (
                              <Box
                                component="td"
                                key={cellIndex}
                                sx={{
                                  px: 1,
                                  py: 1.2,
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: '#17233c',
                                  background: isClickable ? '#fbfdff' : '#ffffff',
                                  animation: isClickable ? 'roRowHint 2.4s ease-in-out infinite' : 'none',
                                  borderTop: isClickable ? '1px solid #dbe7ff' : '1px solid #f0f3f8',
                                  borderBottom: isClickable ? '1px solid #dbe7ff' : '1px solid #f0f3f8',
                                  borderLeft: cellIndex === 0 ? '1px solid #dbe7ff' : 0,
                                  borderRight: cellIndex === row.length - 1 ? '1px solid #dbe7ff' : 0,
                                  borderTopLeftRadius: cellIndex === 0 ? 12 : 0,
                                  borderBottomLeftRadius: cellIndex === 0 ? 12 : 0,
                                  borderTopRightRadius: cellIndex === row.length - 1 ? 12 : 0,
                                  borderBottomRightRadius: cellIndex === row.length - 1 ? 12 : 0,
                                }}
                              >
                                {cell}
                              </Box>
                            ))}
                          </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Paper>
                ))}

                {settingsResult.table_count === 0 && (
                  <Alert severity="warning" sx={{ alignItems: 'flex-start' }}>
                    No RO details found for this selection. Please check that the shop number, district, and depot are correct, then try again.
                  </Alert>
                )}

                {roQuantityLoading && (
                  <Paper
                    elevation={0}
                    sx={{ p: 2, borderRadius: 3, background: '#ffffff', border: '1px solid #e8edf7' }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <CircularProgress size={20} />
                      <Typography sx={{ fontWeight: 800, color: '#31415f' }}>
                        Loading order quantity details...
                      </Typography>
                    </Stack>
                  </Paper>
                )}

                {roQuantityError && (
                  <Alert severity="error">
                    {roQuantityError}
                  </Alert>
                )}

                {roQuantityResult && renderRoQuantityReport()}

                <Typography
                  variant="caption"
                  sx={{ display: 'block', color: '#6d7584', textAlign: 'center' }}
                >
                  Data sourced from{' '}
                  <a
                    href="https://scm.kerala.gov.in/"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2f64f8', fontWeight: 700 }}
                  >
                    scm.kerala.gov.in
                  </a>
                </Typography>
              </Stack>
            )}
          </>
        )}

        <Paper
          elevation={0}
          sx={{
            mt: 4,
            borderRadius: 3,
            background: '#ffffff',
            border: '1px solid #f1d79a',
            boxShadow: '0 12px 28px rgba(119, 80, 0, 0.08)',
            overflow: 'hidden',
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => setDisclaimerOpen((open) => !open)}
            sx={{
              width: '100%',
              p: 1.5,
              border: 0,
              background: '#fffaf0',
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: '#fff3cd',
                color: '#d08700',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: 18,
                flex: '0 0 auto',
              }}
            >
              i
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#2f2412', fontSize: 13, fontWeight: 900 }}>
                Disclaimer &amp; Information
              </Typography>
              <Typography sx={{ mt: 0.25, color: '#7a6641', fontSize: 11, fontWeight: 700 }}>
                App disclaimer and source information
              </Typography>
            </Box>
            <Typography sx={{ color: '#1f2937', fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
              {disclaimerOpen ? '⌃' : '›'}
            </Typography>
          </Box>

          {disclaimerOpen && (
            <Stack spacing={1.5} sx={{ p: 2, borderTop: '1px solid #f0dfb7' }}>
              <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: '#fff3cd',
                  color: '#b45309',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 900,
                  flex: '0 0 auto',
                }}
              >
                !
              </Box>
              <Box>
                <Typography sx={{ color: '#3f2a04', fontSize: 14, fontWeight: 900 }}>
                  Disclaimer
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: '#5f470c', fontWeight: 700, lineHeight: 1.5 }}>
                  This is a private initiative and is not an official government app.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: '#5f470c', fontWeight: 700, lineHeight: 1.5 }}>
                  ഇത് ഒരു സ്വകാര്യ സംരംഭമാണ്. ഇത് ഔദ്യോഗിക സർക്കാർ ആപ്പ് അല്ല.
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: '#f0dfb7' }} />

            <Box>
              <Typography sx={{ color: '#3f2a04', fontSize: 14, fontWeight: 900 }}>
                Source Acknowledgement
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.45, color: '#6b5b34', lineHeight: 1.55 }}>
                Data is sourced from the Kerala Civil Supplies Department&apos;s{' '}
                <a
                  href="https://epos.kerala.gov.in/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#245ef5', fontWeight: 800, textDecoration: 'none' }}
                >
                  ePoS portal
                </a>{' '}
                and{' '}
                <a
                  href="https://scm.kerala.gov.in/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#245ef5', fontWeight: 800, textDecoration: 'none' }}
                >
                  SCM portal
                </a>
                . Source websites and contents belong to their respective authorities. This app is not affiliated with
                or endorsed by the Government of Kerala or NIC.
              </Typography>
            </Box>
          </Stack>
          )}
        </Paper>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 2 }}>
          <Divider sx={{ flex: 1, borderColor: '#e5eaf3' }} />
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '1px solid #d7e3ff',
              color: '#2563eb',
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            ✓
          </Box>
          <Divider sx={{ flex: 1, borderColor: '#e5eaf3' }} />
        </Box>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            background: '#ffffff',
            border: '1px solid #e4e7ec',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
            overflow: 'hidden',
          }}
        >
          <Grid container spacing={0}>
            {[
              {
                icon: <PrivateShieldIcon size={34} />,
                line1: 'Private',
                line2: 'Initiative',
              },
              {
                icon: <OfficialDataIcon size={34} />,
                line1: 'Data from Official',
                line2: 'Government Portals',
              },
              {
                icon: <SecureReliableIcon size={34} />,
                line1: 'Secure &',
                line2: 'Reliable',
              },
              {
                icon: <RationShopsPeopleIcon size={34} />,
                line1: 'Made for',
                line2: 'Ration Shops',
              },
            ].map((item, index) => (
              <Grid
                item
                xs={3}
                key={item.line1}
                sx={{
                  minHeight: 82,
                  py: 1.25,
                  px: { xs: 0.5, sm: 1 },
                  textAlign: 'center',
                  borderLeft: index === 0 ? 0 : '1px solid #e5e7eb',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {React.isValidElement(item.icon) ? (
                  item.icon
                ) : (
                  <Typography sx={{ color: item.color, fontSize: 25, fontWeight: 900, lineHeight: 1 }}>
                    {item.icon}
                  </Typography>
                )}
                <Typography sx={{ mt: 0.55, color: '#111827', fontSize: { xs: 9.5, sm: 11 }, fontWeight: 900, lineHeight: 1.15 }}>
                  {item.line1}
                </Typography>
                <Typography sx={{ color: '#111827', fontSize: { xs: 9.5, sm: 11 }, fontWeight: 900, lineHeight: 1.15 }}>
                  {item.line2}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {false && (
        <Alert
          severity="warning"
          sx={{
            mt: 4,
            borderRadius: 2,
            border: '1px solid #f5c86b',
            background: '#fff8e6',
            color: '#6b4700',
            alignItems: 'flex-start',
          }}
        >
          <Typography sx={{ fontWeight: 900 }}>Disclaimer</Typography>
          <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 700 }}>
            This is a private initiative and is not an official government app.
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 700 }}>
            ഇത് ഒരു സ്വകാര്യ സംരംഭമാണ്. ഇത് ഔദ്യോഗിക സർക്കാർ ആപ്പ് അല്ല.
          </Typography>
          <Divider sx={{ my: 1.25, borderColor: '#e8c16a' }} />
          <Typography sx={{ fontWeight: 900 }}>Source Acknowledgement</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            Data displayed in this app is sourced from the Kerala Civil Supplies Department&apos;s{' '}
            <a
              href="https://epos.kerala.gov.in/"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2f64f8', fontWeight: 700 }}
            >
              ePoS portal
            </a>{' '}
            and{' '}
            <a
              href="https://scm.kerala.gov.in/"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2f64f8', fontWeight: 700 }}
            >
              Supply Chain Management portal
            </a>
            . The source websites and their contents belong to their respective government authorities.
            This private app is not affiliated with or endorsed by the Government of Kerala or NIC.
          </Typography>
        </Alert>
        )}
      </Container>
    </Box>
  );
}
