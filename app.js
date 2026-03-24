/**
 * app.js – Black Book main application
 */
import {
  createGroup, groupExists, addPlayer, getPlayers,
  listenPlayers, listenSessions, listenBalances, listenEntries,
  createSession, getMeta, deletePlayer
} from './modules/firebase.js';
import {
  showScreen, showToast,
  renderBalances, renderSettlements, renderActiveSessionPreview,
  renderQuickMode, renderHistory, renderSessionDetail,
  renderGroupPlayers, renderSessionPlayerSelect
} from './modules/ui.js';
import { submitQuickResults, endSession } from './modules/session.js';
import { sekToOre, oreToSek } from './modules/settlement.js';

// ===== STATE =====
const state = {
  groupCode: null,
  playerId: null,
  playerName: null,
  players: {},
  sessions: {},
  balances: {},
  entries: {},
  activeSessionId: null,
  unsubscribers: [],
  newSessionSelectedPlayers: []
};

// ===== INIT =====

function init() {
  const saved = getSavedGroup();
  if (saved) {
    state.groupCode = saved.groupCode;
    state.playerId = saved.playerId;
    state.playerName = saved.playerName;
    connectToGroup();
  } else {
    showScreen('lobby');
    prefillCode();
  }

  bindEvents();
  registerSW();

  // Signature
  document.addEventListener('DOMContentLoaded', () => {
    const sig = document.createElement('div');
    sig.className = 'app-signature';
    sig.textContent = 'Made by: David Hefner';
    document.body.appendChild(sig);
  });
}

// ===== LOCALSTORAGE =====

function getSavedGroup() {
  try {
    const raw = localStorage.getItem('blackbook_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGroup(groupCode, playerId, playerName) {
  localStorage.setItem('blackbook_session', JSON.stringify({ groupCode, playerId, playerName }));
}

function clearSavedGroup() {
  localStorage.removeItem('blackbook_session');
}

function prefillCode() {
  const saved = getSavedGroup();
  if (saved?.groupCode) {
    document.getElementById('input-group-code').value = saved.groupCode;
  }
}

// ===== GROUP CODE =====

function generateCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ===== CONNECT =====

async function connectToGroup() {
  const { groupCode } = state;
  if (!groupCode) return;

  // Unsubscribe previous listeners
  state.unsubscribers.forEach(fn => fn());
  state.unsubscribers = [];

  state.unsubscribers.push(
    listenPlayers(groupCode, players => {
      state.players = players || {};
      onPlayersUpdate();
    }),
    listenSessions(groupCode, sessions => {
      state.sessions = sessions || {};
      onSessionsUpdate();
    }),
    listenBalances(groupCode, balances => {
      state.balances = balances || {};
      onBalancesUpdate();
    }),
    listenEntries(groupCode, entries => {
      state.entries = entries || {};
      onEntriesUpdate();
    })
  );

  showScreen('dashboard');
  document.getElementById('bottom-nav').classList.remove('hidden');
  document.getElementById('display-group-code').textContent = groupCode;
}

// ===== REACTIVE UPDATES =====

function onPlayersUpdate() {
  renderBalances(state.balances, state.players, state.playerId);
  renderSettlements(state.balances, state.players);
  renderGroupPlayers(state.players, state.playerId);
  if (state.activeSessionId && state.sessions[state.activeSessionId]) {
    const session = state.sessions[state.activeSessionId];
    renderQuickMode(state.players, session.playerIds);
    renderBuyinMode(state.players, session.playerIds, state.entries);
  }
}

function onSessionsUpdate() {
  const active = Object.entries(state.sessions).find(([, s]) => s.status === 'active');
  state.activeSessionId = active ? active[0] : null;

  renderActiveSessionPreview(state.sessions, state.players);
  renderHistory(state.sessions, state.players);

  if (state.activeSessionId) {
    const session = state.sessions[state.activeSessionId];
    document.getElementById('session-title').textContent = session.name || 'Session';
    renderQuickMode(state.players, session.playerIds);
  }
}

function onBalancesUpdate() {
  renderBalances(state.balances, state.players, state.playerId);
  renderSettlements(state.balances, state.players);
}

function onEntriesUpdate() {
  // no-op: quick mode doesn't need live entry updates
}

// ===== QUICK MODE LOGIC =====

function getQuickAmounts() {
  const amounts = {};
  document.querySelectorAll('#quick-players-list .amount-input').forEach(input => {
    const id = input.dataset.playerId;
    amounts[id] = parseFloat(input.value) || 0;
  });
  return amounts;
}

function updateQuickSum() {
  const amounts = getQuickAmounts();
  const total = Object.values(amounts).reduce((s, v) => s + v, 0);
  const el = document.getElementById('quick-sum');
  el.textContent = total === 0 ? '0 kr' : `${total > 0 ? '+' : ''}${total.toFixed(0)} kr`;
  el.className = 'sum-value ' + (total === 0 ? 'zero' : 'nonzero');
}

// ===== EVENTS =====

function bindEvents() {
  // Lobby – join
  document.getElementById('btn-join').addEventListener('click', handleJoin);
  document.getElementById('btn-create').addEventListener('click', handleCreate);
  document.getElementById('input-group-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoin();
  });
  document.getElementById('input-player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoin();
  });

  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      if (screen === 'session' && !state.activeSessionId) {
        showToast('Ingen aktiv session – starta en ny');
        return;
      }
      showScreen(screen);
    });
  });

  // FAB – new session
  document.getElementById('fab-new-session').addEventListener('click', openNewSessionModal);
  document.getElementById('btn-cancel-session').addEventListener('click', closeNewSessionModal);
  document.getElementById('btn-start-session').addEventListener('click', handleStartSession);

  // Group settings
  document.getElementById('btn-group-settings').addEventListener('click', openGroupModal);
  document.getElementById('btn-close-group').addEventListener('click', closeGroupModal);
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard?.writeText(state.groupCode).then(() => showToast('Kod kopierad!'));
  });
  document.getElementById('btn-add-player').addEventListener('click', handleAddPlayer);
  document.getElementById('input-new-player').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddPlayer();
  });
  document.getElementById('btn-leave-group').addEventListener('click', handleLeaveGroup);

  // Remove player (delegated)
  document.getElementById('group-players-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-player');
    if (!btn) return;
    handleRemovePlayer(btn.dataset.playerId);
  });

  // Session back / close
  document.getElementById('btn-back-dashboard').addEventListener('click', () => showScreen('dashboard'));
  document.getElementById('btn-close-session').addEventListener('click', handleCloseSession);

  // Quick mode – amount buttons (delegated)
  document.getElementById('quick-players-list').addEventListener('click', e => {
    const btn = e.target.closest('.amount-btn');
    if (!btn) return;
    const id = btn.dataset.playerId;
    const input = document.querySelector(`#quick-players-list .amount-input[data-player-id="${id}"]`);
    if (!input) return;
    const step = 50;
    const val = parseFloat(input.value) || 0;
    input.value = btn.dataset.action === 'inc' ? val + step : val - step;
    updateQuickSum();
  });

  document.getElementById('quick-players-list').addEventListener('input', e => {
    if (e.target.classList.contains('amount-input')) updateQuickSum();
  });

  // Quick submit
  document.getElementById('btn-quick-submit').addEventListener('click', handleQuickSubmit);

  // History item click
  document.getElementById('history-list').addEventListener('click', e => {
    const item = e.target.closest('.history-item');
    if (!item) return;
    const sessionId = item.dataset.sessionId;
    const session = { ...state.sessions[sessionId], id: sessionId };
    renderSessionDetail(session, state.entries, state.players);
    document.getElementById('modal-session-detail').classList.remove('hidden');
  });

  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('modal-session-detail').classList.add('hidden');
  });

  // Active session preview click → go to session
  document.getElementById('active-session-preview').addEventListener('click', () => {
    if (state.activeSessionId) showScreen('session');
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

// ===== HANDLERS =====

async function handleJoin() {
  const code = document.getElementById('input-group-code').value.trim().toUpperCase();
  const name = document.getElementById('input-player-name').value.trim();

  if (!code || code.length < 4) { showToast('Ange en giltig gruppkod'); return; }
  if (!name) { showToast('Ange ditt namn'); return; }

  const exists = await groupExists(code);
  if (!exists) { showToast('Gruppen hittades inte'); return; }

  // Check if player name already exists
  const players = await getPlayers(code);
  let playerId = Object.entries(players).find(([, p]) => p.name.toLowerCase() === name.toLowerCase())?.[0];
  if (!playerId) {
    playerId = await addPlayer(code, name, randomColor());
  }

  state.groupCode = code;
  state.playerId = playerId;
  state.playerName = name;
  saveGroup(code, playerId, name);
  await connectToGroup();
  showToast(`Välkommen, ${name}!`);
}

async function handleCreate() {
  const name = document.getElementById('input-player-name').value.trim();
  if (!name) { showToast('Ange ditt namn innan du skapar grupp'); return; }

  const code = generateCode();
  await createGroup(code);
  const playerId = await addPlayer(code, name, randomColor());

  state.groupCode = code;
  state.playerId = playerId;
  state.playerName = name;
  saveGroup(code, playerId, name);
  document.getElementById('input-group-code').value = code;
  await connectToGroup();
  showToast(`Grupp skapad! Kod: ${code}`);
}

function handleLeaveGroup() {
  if (!confirm('Lämna gruppen? Din data bevaras.')) return;
  state.unsubscribers.forEach(fn => fn());
  state.unsubscribers = [];
  clearSavedGroup();
  document.getElementById('bottom-nav').classList.add('hidden');
  document.getElementById('modal-group').classList.add('hidden');
  showScreen('lobby');
  showToast('Du har lämnat gruppen');
}

async function handleAddPlayer() {
  const input = document.getElementById('input-new-player');
  const name = input.value.trim();
  if (!name) return;

  const exists = Object.values(state.players).some(p => p.name.toLowerCase() === name.toLowerCase());
  if (exists) { showToast('Det finns redan en spelare med det namnet'); return; }

  await addPlayer(state.groupCode, name, randomColor());
  input.value = '';
  showToast(`${name} tillagd!`);
}

function openNewSessionModal() {
  if (state.activeSessionId) {
    showToast('Det finns redan en aktiv session');
    return;
  }
  state.newSessionSelectedPlayers = Object.keys(state.players);
  renderSessionPlayerSelect(state.players, state.newSessionSelectedPlayers);
  document.getElementById('input-session-name').value = '';

  // Player selection toggle
  document.querySelectorAll('.player-checkbox-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      const id = btn.dataset.playerId;
      if (btn.classList.contains('selected')) {
        if (!state.newSessionSelectedPlayers.includes(id)) state.newSessionSelectedPlayers.push(id);
      } else {
        state.newSessionSelectedPlayers = state.newSessionSelectedPlayers.filter(x => x !== id);
      }
    });
  });

  document.getElementById('modal-new-session').classList.remove('hidden');
}

function closeNewSessionModal() {
  document.getElementById('modal-new-session').classList.add('hidden');
}

async function handleStartSession() {
  const name = document.getElementById('input-session-name').value.trim();
  if (state.newSessionSelectedPlayers.length === 0) {
    showToast('Välj minst en spelare');
    return;
  }

  const sessionId = await createSession(state.groupCode, {
    type: 'quick',
    name,
    playerIds: state.newSessionSelectedPlayers
  });

  closeNewSessionModal();
  showScreen('session');
  showToast('Session startad!');
}

async function handleCloseSession() {
  if (!state.activeSessionId) return;
  if (!confirm('Stäng sessionen? Resultaten sparas.')) return;
  await endSession(state.groupCode, state.activeSessionId);
  showScreen('dashboard');
  showToast('Session stängd');
}

async function handleQuickSubmit() {
  if (!state.activeSessionId) { showToast('Ingen aktiv session'); return; }
  const amounts = getQuickAmounts();
  const total = Object.values(amounts).reduce((s, v) => s + v, 0);

  if (Math.abs(total) > 1) {
    showToast(`Summan måste vara 0 (nu: ${total > 0 ? '+' : ''}${total.toFixed(0)} kr)`);
    return;
  }

  try {
    await submitQuickResults(state.groupCode, state.activeSessionId, amounts);
    // Reset inputs
    document.querySelectorAll('#quick-players-list .amount-input').forEach(i => i.value = 0);
    updateQuickSum();
    showToast('Resultat registrerat!');
  } catch (err) {
    showToast(err.message);
  }
}

function openGroupModal() {
  document.getElementById('modal-group').classList.remove('hidden');
  renderGroupPlayers(state.players, state.playerId);
}

async function handleRemovePlayer(playerId) {
  const player = state.players[playerId];
  if (!player) return;
  if (!confirm(`Ta bort ${player.name} från gruppen?`)) return;
  await deletePlayer(state.groupCode, playerId);
  showToast(`${player.name} borttagen`);
}

function closeGroupModal() {
  document.getElementById('modal-group').classList.add('hidden');
}

// ===== HELPERS =====

function randomColor() {
  const colors = ['#e05252', '#e08c52', '#d4af37', '#4caf82', '#5291e0', '#9b52e0', '#e052b8', '#52d4c8'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ===== SERVICE WORKER =====

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ===== START =====
init();
