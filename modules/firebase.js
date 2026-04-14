import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  onValue,
  runTransaction,
  serverTimestamp,
  query,
  orderByChild,
  equalTo
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyBsMy2yM7ywVHqV8v4jGHsiuwiUEj5hxUI",
  authDomain: "blackbook-dd35e.firebaseapp.com",
  databaseURL: "https://blackbook-dd35e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "blackbook-dd35e",
  storageBucket: "blackbook-dd35e.firebasestorage.app",
  messagingSenderId: "135964327938",
  appId: "1:135964327938:web:6bf37522a409cde935a71b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== GROUP =====

export async function createGroup(groupCode, createdBy, currency = 'SEK') {
  const groupRef = ref(db, `groups/${groupCode}/meta`);
  await set(groupRef, {
    name: groupCode,
    createdAt: Date.now(),
    currency,
    createdBy
  });
}

export async function deleteGroup(groupCode) {
  await set(ref(db, `groups/${groupCode}`), null);
}

export async function groupExists(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/meta`));
  return snap.exists();
}

// ===== PLAYERS =====

export async function addPlayer(groupCode, name, color) {
  const playersRef = ref(db, `groups/${groupCode}/players`);
  const newRef = push(playersRef);
  await set(newRef, {
    name,
    color,
    joinedAt: Date.now()
  });
  return newRef.key;
}

export function listenPlayers(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/players`);
  return onValue(r, snap => {
    if (!snap.exists()) { callback({}); return; }
    const all = snap.val();
    const active = Object.fromEntries(Object.entries(all).filter(([, p]) => !p.deleted));
    callback(active);
  });
}

export async function getPlayers(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/players`));
  return snap.exists() ? snap.val() : {};
}

export async function deletePlayer(groupCode, playerId) {
  await update(ref(db, `groups/${groupCode}/players/${playerId}`), { deleted: true });
}

// ===== SESSIONS =====

export async function updateSessionPointValue(groupCode, sessionId, pointValue) {
  await update(ref(db, `groups/${groupCode}/sessions/${sessionId}`), { pointValue });
}

export async function updateSessionMeta(groupCode, sessionId, fields) {
  await update(ref(db, `groups/${groupCode}/sessions/${sessionId}`), fields);
}

export async function createSession(groupCode, { type, name, playerIds, pointValue }) {
  const sessionsRef = ref(db, `groups/${groupCode}/sessions`);
  const newRef = push(sessionsRef);
  await set(newRef, {
    type,
    name: name || '',
    status: 'active',
    createdAt: Date.now(),
    closedAt: null,
    pointValue: pointValue || null,
    playerIds: Object.fromEntries(playerIds.map(id => [id, true]))
  });
  return newRef.key;
}

export async function closeSession(groupCode, sessionId) {
  await update(ref(db, `groups/${groupCode}/sessions/${sessionId}`), {
    status: 'closed',
    closedAt: Date.now()
  });
}

export async function reopenSession(groupCode, sessionId) {
  await update(ref(db, `groups/${groupCode}/sessions/${sessionId}`), {
    status: 'active',
    closedAt: null
  });
}

export async function deleteSession(groupCode, sessionId) {
  await set(ref(db, `groups/${groupCode}/sessions/${sessionId}`), null);
}

export function listenSessions(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/sessions`);
  return onValue(r, snap => {
    callback(snap.exists() ? snap.val() : {});
  });
}

export async function getSessions(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/sessions`));
  return snap.exists() ? snap.val() : {};
}

// ===== ENTRIES =====

export async function addEntry(groupCode, { sessionId, playerId, amount, type, note = '' }) {
  // amount is always stored as integer (öre/cent)
  const entriesRef = ref(db, `groups/${groupCode}/entries`);
  const newRef = push(entriesRef);
  await set(newRef, {
    sessionId,
    playerId,
    amount,
    type,
    timestamp: Date.now(),
    deleted: false,
    deletedAt: null,
    note
  });

  // Update denormalized balance atomically
  const balRef = ref(db, `groups/${groupCode}/balances/${playerId}/net`);
  await runTransaction(balRef, current => {
    return (current || 0) + amount;
  });

  return newRef.key;
}

export async function softDeleteEntry(groupCode, entryId, playerId, amount) {
  await update(ref(db, `groups/${groupCode}/entries/${entryId}`), {
    deleted: true,
    deletedAt: Date.now()
  });

  // Reverse the balance
  const balRef = ref(db, `groups/${groupCode}/balances/${playerId}/net`);
  await runTransaction(balRef, current => {
    return (current || 0) - amount;
  });
}

export function listenEntries(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/entries`);
  return onValue(r, snap => {
    callback(snap.exists() ? snap.val() : {});
  });
}

export async function getEntries(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/entries`));
  return snap.exists() ? snap.val() : {};
}

// ===== BALANCES =====

export function listenBalances(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/balances`);
  return onValue(r, snap => {
    callback(snap.exists() ? snap.val() : {});
  });
}

// ===== CONFIRMATIONS =====

export async function confirmTransaction(groupCode, from, to, amount) {
  const key = `${from}_${to}_${amount}`;
  await set(ref(db, `groups/${groupCode}/confirmations/${key}`), {
    from, to, amount,
    confirmedAt: Date.now()
  });
}

export async function unconfirmTransaction(groupCode, from, to, amount) {
  const key = `${from}_${to}_${amount}`;
  await set(ref(db, `groups/${groupCode}/confirmations/${key}`), null);
}

export function listenConfirmations(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/confirmations`);
  return onValue(r, snap => {
    callback(snap.exists() ? snap.val() : {});
  });
}

export async function clearBook(groupCode) {
  // Remove all confirmations only – balances are kept for history
  await set(ref(db, `groups/${groupCode}/confirmations`), null);
}

// ===== META =====

export async function getMeta(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/meta`));
  return snap.exists() ? snap.val() : null;
}
