import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase, ref, set, get, push, update, onValue, runTransaction
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

export async function createGroup(groupCode, currency = 'SEK') {
  await set(ref(db, `groups/${groupCode}/meta`), { name: groupCode, createdAt: Date.now(), currency });
}

export async function groupExists(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/meta`));
  return snap.exists();
}

export async function addPlayer(groupCode, name, color) {
  const newRef = push(ref(db, `groups/${groupCode}/players`));
  await set(newRef, { name, color, joinedAt: Date.now() });
  return newRef.key;
}

export function listenPlayers(groupCode, callback) {
  return onValue(ref(db, `groups/${groupCode}/players`), snap => callback(snap.exists() ? snap.val() : {}));
}

export async function getPlayers(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/players`));
  return snap.exists() ? snap.val() : {};
}

export async function createSession(groupCode, { type, name, playerIds }) {
  const newRef = push(ref(db, `groups/${groupCode}/sessions`));
  await set(newRef, {
    type, name: name || '', status: 'active', createdAt: Date.now(), closedAt: null,
    playerIds: Object.fromEntries(playerIds.map(id => [id, true]))
  });
  return newRef.key;
}

export async function closeSession(groupCode, sessionId) {
  await update(ref(db, `groups/${groupCode}/sessions/${sessionId}`), { status: 'closed', closedAt: Date.now() });
}

export function listenSessions(groupCode, callback) {
  return onValue(ref(db, `groups/${groupCode}/sessions`), snap => callback(snap.exists() ? snap.val() : {}));
}

export async function addEntry(groupCode, { sessionId, playerId, amount, type, note = '' }) {
  const newRef = push(ref(db, `groups/${groupCode}/entries`));
  await set(newRef, { sessionId, playerId, amount, type, timestamp: Date.now(), deleted: false, deletedAt: null, note });
  await runTransaction(ref(db, `groups/${groupCode}/balances/${playerId}/net`), current => (current || 0) + amount);
  return newRef.key;
}

export async function softDeleteEntry(groupCode, entryId, playerId, amount) {
  await update(ref(db, `groups/${groupCode}/entries/${entryId}`), { deleted: true, deletedAt: Date.now() });
  await runTransaction(ref(db, `groups/${groupCode}/balances/${playerId}/net`), current => (current || 0) - amount);
}

export function listenEntries(groupCode, callback) {
  return onValue(ref(db, `groups/${groupCode}/entries`), snap => callback(snap.exists() ? snap.val() : {}));
}

export function listenBalances(groupCode, callback) {
  return onValue(ref(db, `groups/${groupCode}/balances`), snap => callback(snap.exists() ? snap.val() : {}));
}

export async function getMeta(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/meta`));
  return snap.exists() ? snap.val() : null;
}
