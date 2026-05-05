import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCncNEuHfi_lTJ86OzOEub8b1ogJkVe9o",
  authDomain: "exceed-portal.firebaseapp.com",
  projectId: "exceed-portal",
  storageBucket: "exceed-portal.firebasestorage.app",
  messagingSenderId: "464886450601",
  appId: "1:464886450601:web:b71234f5b488e01c005cb8",
  measurementId: "G-7MPRDT0GE6"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Edit this list to grant admin access (can view all registered agents,
// approve/suspend agents, and view/edit customers).
export const ADMIN_EMAILS = [
  'balraj@exceed-re.ae',
  'admin@exceed-re.ae'
];

export const isAdmin = (email) => !!email && ADMIN_EMAILS.includes(email.toLowerCase());

// ----- Roles -----
// Order matters for some UI (highest authority first).
// 'admin' is reserved for system administrators (currently just balraj@) — sits
// above CEO since it includes platform/infra rights as well as full business access.
export const ROLES = ['admin', 'ceo', 'md', 'board', 'manager', 'agent', 'back_office'];
export const DEFAULT_ROLE = 'agent';

export const ROLE_LABELS = {
  ja: {
    admin: 'システム管理者',
    ceo: 'CEO',
    md: 'MD（マネージング・ディレクター）',
    board: '役員クラス',
    manager: 'マネージャー',
    agent: 'エージェント',
    back_office: 'バックオフィス'
  },
  en: {
    admin: 'System Admin',
    ceo: 'CEO',
    md: 'Managing Director',
    board: 'Board / Executive',
    manager: 'Manager',
    agent: 'Agent',
    back_office: 'Back Office'
  }
};

// Leadership = anyone allowed to see the Monday-morning attendance briefing
// and other leadership-only views. Admins are always treated as leadership.
export const LEADERSHIP_ROLES = ['admin', 'ceo', 'md', 'board'];

export const isValidRole = (role) => ROLES.includes(role);
export const roleLabel = (role, lang = 'ja') =>
  (ROLE_LABELS[lang] && ROLE_LABELS[lang][role]) || role || '—';
export const isLeadership = (role, email) =>
  isAdmin(email) || (role && LEADERSHIP_ROLES.includes(role));

// ----- Capabilities per role -----
// Single source of truth for what each access level unlocks. Keep this in sync
// with ACCESS_LEVELS.md (the human-readable doc) so we have one place to read
// and one place to enforce.
export const ROLE_CAPABILITIES = {
  admin: {
    summary_ja: 'プラットフォーム管理者。全ての機能・データ・設定にアクセス可能。',
    summary_en: 'Platform owner. Full access to every feature, dataset and setting.',
    capabilities: [
      'Everything CEO can do',
      'Plus: change anyone\'s access role (including own)',
      'Plus: edit team tree, partners, and Firestore-backed config',
      'Plus: receive system alerts and Firestore rule overrides',
      'Reserved for the platform owner — currently balraj@exceed-re.ae'
    ]
  },
  ceo: {
    summary_ja: '全権限。全画面・全データ。',
    summary_en: 'Full access to every screen and every dataset.',
    capabilities: [
      'View and edit every page in the portal',
      'Approve, suspend or change role of any agent',
      'See all customers across all agents',
      'See leadership-only attendance briefing',
      'Edit team tree structure, partners and access roles',
      'Receive deal alerts and high-priority notifications'
    ]
  },
  md: {
    summary_ja: '日々のオペレーション全般を管理。役割編集を除き、ほぼ全機能。',
    summary_en: 'Day-to-day operations lead. Almost everything except changing roles.',
    capabilities: [
      'View leadership attendance briefing',
      'View all agents and customers',
      'Approve / suspend agents (no role changes)',
      'Edit team tree, partners and listings',
      'Receive deal alerts'
    ]
  },
  board: {
    summary_ja: '役員クラス。閲覧中心の全社ダッシュボードと経営判断用ビュー。',
    summary_en: 'Board / executive class. Read-mostly company-wide dashboard for governance.',
    capabilities: [
      'View leadership attendance briefing',
      'View all agents and customers (read only)',
      'View IRR Simulator and Listings',
      'Cannot approve agents or edit team structure'
    ]
  },
  manager: {
    summary_ja: 'チームを統括するマネージャー。エージェントの全機能 + 配下の顧客閲覧。',
    summary_en: 'Sales manager. Everything an agent does plus visibility into their team.',
    capabilities: [
      'Everything an Agent can do',
      'Plus: view customers of agents they manage',
      'Plus: view their team\'s attendance',
      'Plus: receive deal alerts',
      'Cannot approve agents or change roles'
    ]
  },
  agent: {
    summary_ja: '営業エージェント。顧客登録と案件ツールを使用。',
    summary_en: 'Sales agent. Registers customers and uses deal tools.',
    capabilities: [
      'Register and manage own customers',
      'Use IRR Simulator, Listings, Deal Alert, Travel and Car Booking',
      'Mark daily attendance',
      'Cannot view other agents\' customers'
    ]
  },
  back_office: {
    summary_ja: 'バックオフィス。事務処理と社内ツール中心。',
    summary_en: 'Back office. Admin support and internal tools only.',
    capabilities: [
      'Mark daily attendance',
      'View team tree and listings',
      'Use Car Booking and Database lookups',
      'No customer or deal-flow access'
    ]
  }
};

export const roleCapabilities = (role) =>
  (ROLE_CAPABILITIES[role] && ROLE_CAPABILITIES[role].capabilities) || [];

export const roleSummary = (role, lang = 'ja') => {
  const entry = ROLE_CAPABILITIES[role];
  if (!entry) return '';
  return lang === 'en' ? entry.summary_en : entry.summary_ja;
};

// ----- Capability flags (the part the runtime checks) -----
// Each capability maps to the set of roles that hold it. Keep this list short
// and named after what the user is trying to *do*, not what page they're on.
// Pages use can(role, capability, email) to decide whether to render or gate.
export const CAPABILITIES = {
  // Customers
  registerCustomer:   ['admin', 'ceo', 'md', 'manager', 'agent'],
  viewAllCustomers:   ['admin', 'ceo', 'md', 'board'],
  editAllCustomers:   ['admin', 'ceo', 'md'],

  // Agents directory (the admin.html screen)
  viewAllAgents:      ['admin', 'ceo', 'md', 'board'],
  approveAgents:      ['admin', 'ceo', 'md'],
  changeRoles:        ['admin'],

  // Team tree (the org chart)
  editTeamTree:       ['admin', 'ceo', 'md'],

  // Deal flow
  createDealAlert:    ['admin', 'ceo', 'md', 'manager', 'agent'],
  receiveDealAlerts:  ['admin', 'ceo', 'md', 'board', 'manager'],

  // Operations
  viewLeadership:     ['admin', 'ceo', 'md', 'board'],
  viewDatabase:       ['admin', 'ceo', 'md', 'board', 'manager', 'agent', 'back_office'],
  bookCar:            ['admin', 'ceo', 'md', 'board', 'manager', 'agent', 'back_office'],
  useTravel:          ['admin', 'ceo', 'md', 'board', 'manager', 'agent'],
  useIRR:             ['admin', 'ceo', 'md', 'board', 'manager', 'agent'],
  useListings:        ['admin', 'ceo', 'md', 'board', 'manager', 'agent', 'back_office']
};

// can(role, capability, email?) — central capability check.
// `email` is optional and gives the legacy hard-coded ADMIN_EMAILS list a way in
// even if the user's role hasn't been written to Firestore yet (cold-start case
// for the platform owner). Past first dashboard load, role === 'admin' is what
// drives the decision and email is unnecessary.
export const can = (role, capability, email) => {
  if (email && isAdmin(email)) return true;
  if (!role || !capability) return false;
  const allowed = CAPABILITIES[capability];
  return Array.isArray(allowed) && allowed.includes(role);
};
