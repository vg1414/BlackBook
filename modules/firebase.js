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

export async function createGroup(groupCode, createdBy, currency = 'SEK', groupName) {
  const groupRef = ref(db, `groups/${groupCode}/meta`);
  await set(groupRef, {
    name: groupName || groupCode,
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

  // Uppdatera history (Gruppens totaler – nollställs aldrig)
  // Dra bort sessionens tidigare bidrag (om den återöppnats), lägg till det nya
  const [entriesSnap, sessSnap, histSnap, playersSnap] = await Promise.all([
    get(ref(db, `groups/${groupCode}/entries`)),
    get(ref(db, `groups/${groupCode}/sessions/${sessionId}`)),
    get(ref(db, `groups/${groupCode}/history`)),
    get(ref(db, `groups/${groupCode}/players`))
  ]);
  const entries = entriesSnap.exists() ? entriesSnap.val() : {};
  const sess = sessSnap.exists() ? sessSnap.val() : {};
  const history = histSnap.exists() ? histSnap.val() : {};
  const players = playersSnap.exists() ? playersSnap.val() : {};
  const pv = sess?.pointValue || sess?._storedPointValue || 0;

  // Säkerställ att alla aktiva spelare finns i history
  Object.keys(players).forEach(pid => {
    if (!players[pid].deleted && !history[pid]) history[pid] = { net: 0, krNet: 0 };
  });

  // Dra bort sessionens tidigare sparade bidrag (undviker dubbelräkning vid återöppning)
  const prevContrib = sess?._historyContrib || {};
  Object.entries(prevContrib).forEach(([pid, c]) => {
    if (history[pid]) {
      history[pid].net -= c.net || 0;
      history[pid].krNet -= c.krNet || 0;
    }
  });

  // Räkna ut sessionens aktuella bidrag
  const contrib = {};
  Object.values(entries).forEach(e => {
    if (!e.deleted && e.sessionId === sessionId) {
      if (!contrib[e.playerId]) contrib[e.playerId] = { net: 0, krNet: 0 };
      contrib[e.playerId].net += e.amount;
      contrib[e.playerId].krNet += Math.round((e.amount / 100) * pv * 100);
    }
  });

  // Lägg till det nya bidraget
  Object.entries(contrib).forEach(([pid, c]) => {
    if (history[pid]) {
      history[pid].net += c.net;
      history[pid].krNet += c.krNet;
    }
  });

  // Spara history och sessionens bidrag (för att kunna dra av vid eventuell återöppning)
  await Promise.all([
    set(ref(db, `groups/${groupCode}/history`), history),
    update(ref(db, `groups/${groupCode}/sessions/${sessionId}`), { _historyContrib: contrib })
  ]);
}

export async function reopenSession(groupCode, sessionId) {
  await update(ref(db, `groups/${groupCode}/sessions/${sessionId}`), {
    status: 'active',
    closedAt: null
  });
}

export async function deleteSession(groupCode, sessionId) {
  // Dra bort sessionens bidrag från history innan den raderas
  const [sessSnap, histSnap] = await Promise.all([
    get(ref(db, `groups/${groupCode}/sessions/${sessionId}`)),
    get(ref(db, `groups/${groupCode}/history`))
  ]);
  const sess = sessSnap.exists() ? sessSnap.val() : {};
  const history = histSnap.exists() ? histSnap.val() : {};
  const prevContrib = sess?._historyContrib || {};
  Object.entries(prevContrib).forEach(([pid, c]) => {
    if (history[pid]) {
      history[pid].net -= c.net || 0;
      history[pid].krNet -= c.krNet || 0;
    }
  });
  await Promise.all([
    set(ref(db, `groups/${groupCode}/sessions/${sessionId}`), null),
    set(ref(db, `groups/${groupCode}/history`), history)
  ]);
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

export async function confirmTransaction(groupCode, from, to, amount, amountKr) {
  // amount = kr (heltal), amountKr = öre
  const key = `${from}_${to}_${amount}`;
  await set(ref(db, `groups/${groupCode}/confirmations/${key}`), {
    from, to, amount, amountKr,
    confirmedAt: Date.now()
  });
  // Justera totals.krNet (öre) så att kvarstående skulder minskar
  await runTransaction(ref(db, `groups/${groupCode}/totals/${from}/krNet`), cur => (cur || 0) + amountKr);
  await runTransaction(ref(db, `groups/${groupCode}/totals/${to}/krNet`), cur => (cur || 0) - amountKr);
}

export async function unconfirmTransaction(groupCode, from, to, amount, amountKr) {
  const key = `${from}_${to}_${amount}`;
  await set(ref(db, `groups/${groupCode}/confirmations/${key}`), null);
  await runTransaction(ref(db, `groups/${groupCode}/totals/${from}/krNet`), cur => (cur || 0) - amountKr);
  await runTransaction(ref(db, `groups/${groupCode}/totals/${to}/krNet`), cur => (cur || 0) + amountKr);
}

export function listenConfirmations(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/confirmations`);
  return onValue(r, snap => {
    callback(snap.exists() ? snap.val() : {});
  });
}

export async function clearBook(groupCode) {
  // Nollställ totals (uppgörelser) och rensa bekräftelser
  // history (Gruppens totaler) rör vi INTE – det är permanent historik
  const playersSnap = await get(ref(db, `groups/${groupCode}/players`));
  const players = playersSnap.exists() ? playersSnap.val() : {};
  const zeroed = {};
  Object.keys(players).forEach(pid => {
    if (!players[pid].deleted) zeroed[pid] = { net: 0, krNet: 0 };
  });
  const zeroedBalances = {};
  Object.keys(players).forEach(pid => {
    if (!players[pid].deleted) zeroedBalances[pid] = { net: 0 };
  });

  // Flytta bekräftade transaktioner till permanent historik innan de rensas
  const confSnap = await get(ref(db, `groups/${groupCode}/confirmations`));
  if (confSnap.exists()) {
    const confirmations = confSnap.val();
    const histRef = ref(db, `groups/${groupCode}/transactionHistory`);
    const updates = {};
    Object.values(confirmations).forEach(tx => {
      const newKey = push(histRef).key;
      updates[newKey] = { ...tx, archivedAt: Date.now() };
    });
    await update(histRef, updates);
  }

  await set(ref(db, `groups/${groupCode}/totals`), zeroed);
  // history (Gruppens totaler) nollställs aldrig – det är permanent ackumulerad historik
  await set(ref(db, `groups/${groupCode}/balances`), zeroedBalances);
  await set(ref(db, `groups/${groupCode}/confirmations`), null);
}

export async function getTransactionHistory(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/transactionHistory`));
  return snap.exists() ? snap.val() : {};
}

// ===== TOTALS =====

export function listenTotals(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/totals`);
  let bootstrapped = false;
  return onValue(r, async snap => {
    if (!snap.exists() && !bootstrapped) {
      bootstrapped = true;
      await recalcTotals(groupCode);
      // recalcTotals skriver till Firebase → triggar onValue igen med data
      return;
    }
    callback(snap.exists() ? snap.val() : {});
  });
}

export async function recalcTotals(groupCode) {
  // Räkna om totals från scratch – bara entries från stängda sessioner
  const [entriesSnap, playersSnap, sessionsSnap] = await Promise.all([
    get(ref(db, `groups/${groupCode}/entries`)),
    get(ref(db, `groups/${groupCode}/players`)),
    get(ref(db, `groups/${groupCode}/sessions`))
  ]);
  const entries = entriesSnap.exists() ? entriesSnap.val() : {};
  const players = playersSnap.exists() ? playersSnap.val() : {};
  const sessions = sessionsSnap.exists() ? sessionsSnap.val() : {};

  const closedSessions = Object.fromEntries(
    Object.entries(sessions).filter(([, s]) => s.status === 'closed')
  );
  const closedSessionIds = new Set(Object.keys(closedSessions));

  const totals = {};
  Object.keys(players).forEach(pid => {
    if (!players[pid].deleted) totals[pid] = { net: 0, krNet: 0 };
  });

  Object.values(entries).forEach(e => {
    if (!e.deleted && closedSessionIds.has(e.sessionId) && totals[e.playerId] !== undefined) {
      totals[e.playerId].net += e.amount;
      // krNet: poäng × kr/poäng för den sessionen. Sessioner utan pointValue bidrar 0 kr.
      const sess = closedSessions[e.sessionId];
      const pv = sess?.pointValue || sess?._storedPointValue || 0;
      totals[e.playerId].krNet += Math.round((e.amount / 100) * pv * 100); // lagras i öre
    }
  });

  await set(ref(db, `groups/${groupCode}/totals`), totals);
  // history (Gruppens totaler) skrivs INTE om av recalcTotals – den är permanent ackumulerad
}

export function listenHistory(groupCode, callback) {
  const r = ref(db, `groups/${groupCode}/history`);
  return onValue(r, snap => {
    callback(snap.exists() ? snap.val() : {});
  });
}

// ===== META =====

export async function getMeta(groupCode) {
  const snap = await get(ref(db, `groups/${groupCode}/meta`));
  return snap.exists() ? snap.val() : null;
}
