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
export const ROLES = ['ceo', 'md', 'board', 'agent', 'team', 'back_office'];
export const DEFAULT_ROLE = 'agent';

export const ROLE_LABELS = {
  ja: {
    ceo: 'CEO',
    md: 'マネージング・ディレクター',
    board: 'ボード',
    agent: 'エージェント',
    team: 'チームメンバー',
    back_office: 'バックオフィス'
  },
  en: {
    ceo: 'CEO',
    md: 'Managing Director',
    board: 'Board',
    agent: 'Agent',
    team: 'Team',
    back_office: 'Back Office'
  }
};

// Leadership = anyone allowed to see the Monday-morning attendance briefing
// and other leadership-only views. Admins are always treated as leadership.
export const LEADERSHIP_ROLES = ['ceo', 'md', 'board'];

export const isValidRole = (role) => ROLES.includes(role);
export const roleLabel = (role, lang = 'ja') =>
  (ROLE_LABELS[lang] && ROLE_LABELS[lang][role]) || role || '—';
export const isLeadership = (role, email) =>
  isAdmin(email) || (role && LEADERSHIP_ROLES.includes(role));
