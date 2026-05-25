/**
 * firebase-db.js
 * Central Firebase initialization and Firestore/Auth helpers.
 * ALL async operations are wrapped in try/catch to prevent uncaught promise rejections.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── FIREBASE CONFIGURATION ────────────────────────────────────────────────────
// ✅ STEP: Paste your Firebase config here.
// Get it from: https://console.firebase.google.com
//   → Your Project → Project Settings ⚙️ → Your Apps → Web (</>)  → SDK setup & config
//
// Example of what it looks like (yours will have real values):
//
//   const firebaseConfig = {
//     apiKey:            "AIzaSyAbc123...",
//     authDomain:        "my-app-12345.firebaseapp.com",
//     projectId:         "my-app-12345",
//     storageBucket:     "my-app-12345.appspot.com",
//     messagingSenderId: "987654321000",
//     appId:             "1:987654321000:web:abcdef123456",
//   };
//
// ↓ Replace the placeholder values below ↓
const firebaseConfig = {
  apiKey:            "AIzaSyAnabuHdeQHbkxd0zU6JS3YeLP4kkJIQEg",
  authDomain:        "cricket-academy-133ed.firebaseapp.com",
  projectId:         "cricket-academy-133ed",
  storageBucket:     "cricket-academy-133ed.firebasestorage.app",
  messagingSenderId: "854589916366",
  appId:             "1:854589916366:web:84331e18ee02728f51fc9f",
  measurementId:     "G-9EDM901TPP",
};

// ─── INITIALIZATION ────────────────────────────────────────────────────────────
let app, auth, db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.error("[Firebase] Initialization failed:", err);
}

export { auth, db, Timestamp, serverTimestamp };

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────────

/**
 * Sign in admin with email/password.
 * @param {string} email
 * @param {string} password
 * @param {boolean} rememberMe - If true, persist session across tabs
 * @returns {{ user: object|null, error: string|null }}
 */
export async function loginAdmin(email, password, rememberMe = false) {
  try {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return { user: credential.user, error: null };
  } catch (err) {
    console.error("[Auth] Login failed:", err);
    return { user: null, error: getFriendlyAuthError(err.code) };
  }
}

/**
 * Sign out the current admin.
 * @returns {{ error: string|null }}
 */
export async function logoutAdmin() {
  try {
    await signOut(auth);
    return { error: null };
  } catch (err) {
    console.error("[Auth] Logout failed:", err);
    return { error: "Logout failed. Please try again." };
  }
}

/**
 * Send a password reset email.
 * @param {string} email
 * @returns {{ error: string|null }}
 */
export async function forgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (err) {
    console.error("[Auth] Password reset failed:", err);
    return { error: getFriendlyAuthError(err.code) };
  }
}

/**
 * Observe auth state changes.
 * @param {function} callback - Called with user object or null
 */
export function observeAuth(callback) {
  if (!auth) { callback(null); return; }
  onAuthStateChanged(auth, callback);
}

function getFriendlyAuthError(code) {
  const messages = {
    "auth/user-not-found": "No admin account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many failed attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/invalid-credential": "Invalid email or password. Please check and try again.",
  };
  return messages[code] || "Authentication failed. Please try again.";
}

// ─── FIRESTORE CRUD HELPERS ────────────────────────────────────────────────────

/**
 * Add a document to a collection.
 * @param {string} collectionName
 * @param {object} data
 * @returns {{ id: string|null, error: string|null }}
 */
export async function addDocument(collectionName, data) {
  try {
    const payload = { ...data, createdAt: serverTimestamp() };
    const ref = await addDoc(collection(db, collectionName), payload);
    return { id: ref.id, error: null };
  } catch (err) {
    console.error(`[Firestore] addDocument(${collectionName}) failed:`, err);
    return { id: null, error: "Failed to save. Please try again." };
  }
}

/**
 * Set a document with a specific ID.
 * @param {string} collectionName
 * @param {string} docId
 * @param {object} data
 * @param {boolean} merge - Whether to merge with existing data
 * @returns {{ error: string|null }}
 */
export async function setDocument(collectionName, docId, data, merge = false) {
  try {
    await setDoc(doc(db, collectionName, docId), data, { merge });
    return { error: null };
  } catch (err) {
    console.error(`[Firestore] setDocument(${collectionName}/${docId}) failed:`, err);
    return { error: "Failed to save. Please try again." };
  }
}

/**
 * Get a single document by ID.
 * @param {string} collectionName
 * @param {string} docId
 * @returns {{ data: object|null, error: string|null }}
 */
export async function getDocument(collectionName, docId) {
  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    if (snap.exists()) {
      return { data: { id: snap.id, ...snap.data() }, error: null };
    }
    return { data: null, error: null };
  } catch (err) {
    console.error(`[Firestore] getDocument(${collectionName}/${docId}) failed:`, err);
    return { data: null, error: "Failed to load data. Please try again." };
  }
}

/**
 * Get all documents in a collection.
 * @param {string} collectionName
 * @param {Array} [queryConstraints] - Optional Firestore query constraints
 * @returns {{ data: Array, error: string|null }}
 */
export async function getDocuments(collectionName, queryConstraints = []) {
  try {
    const ref = collection(db, collectionName);
    const q = queryConstraints.length ? query(ref, ...queryConstraints) : ref;
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { data, error: null };
  } catch (err) {
    console.error(`[Firestore] getDocuments(${collectionName}) failed:`, err);
    return { data: [], error: "Failed to load data. Please try again." };
  }
}

/**
 * Update a document by ID.
 * @param {string} collectionName
 * @param {string} docId
 * @param {object} data
 * @returns {{ error: string|null }}
 */
export async function updateDocument(collectionName, docId, data) {
  try {
    const payload = { ...data, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, collectionName, docId), payload);
    return { error: null };
  } catch (err) {
    console.error(`[Firestore] updateDocument(${collectionName}/${docId}) failed:`, err);
    return { error: "Failed to update. Please try again." };
  }
}

/**
 * Delete a document by ID.
 * @param {string} collectionName
 * @param {string} docId
 * @returns {{ error: string|null }}
 */
export async function deleteDocument(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
    return { error: null };
  } catch (err) {
    console.error(`[Firestore] deleteDocument(${collectionName}/${docId}) failed:`, err);
    return { error: "Failed to delete. Please try again." };
  }
}

/**
 * Subscribe to real-time updates on a collection.
 * @param {string} collectionName
 * @param {function} onData - Callback with array of documents
 * @param {function} [onError] - Callback with error message
 * @param {Array} [queryConstraints]
 * @returns {function} unsubscribe - Call to stop listening
 */
export function subscribeCollection(collectionName, onData, onError, queryConstraints = []) {
  try {
    const ref = collection(db, collectionName);
    const q = queryConstraints.length ? query(ref, ...queryConstraints) : ref;
    return onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        onData(data);
      },
      (err) => {
        console.error(`[Firestore] subscribeCollection(${collectionName}) error:`, err);
        if (typeof onError === "function") onError("Real-time sync failed.");
      }
    );
  } catch (err) {
    console.error(`[Firestore] subscribeCollection(${collectionName}) setup failed:`, err);
    if (typeof onError === "function") onError("Could not establish real-time connection.");
    return () => {}; // Return no-op unsubscribe
  }
}

// Export Firestore query helpers for use in other modules
export { query, where, orderBy, collection, doc };
