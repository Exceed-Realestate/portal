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
