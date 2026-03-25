/**
 * app.js – Black Book main application
 */
import {
  createGroup, groupExists, addPlayer, getPlayers,
  listenPlayers, listenSessions, listenBalances, listenEntries,
  createSession, getMeta, deletePlayer, reopenSession, deleteSession,
  confirmTransaction, unconfirmTransaction, listenConfirmations
} from './modules/firebase.js';
import {
  showScreen, showToast,
  renderBalances, renderSettlements, renderConfirmedTransactions,
  renderActiveSessionPreview,
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
  confirmations: {},
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
    }),
    listenConfirmations(groupCode, confirmations => {
      state.confirmations = confirmations || {};
      onConfirmationsUpdate();
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
  renderSettlements(state.balances, state.players, state.confirmations);
  renderConfirmedTransactions(state.balances, state.players, state.confirmations);
}

function onConfirmationsUpdate() {
  renderSettlements(state.balances, state.players, state.confirmations);
  renderConfirmedTransactions(state.balances, state.players, state.confirmations);
}

function onEntriesUpdate() {
  // Refresh chart if it's open
  if (!document.getElementById('modal-chart').classList.contains('hidden')) {
    handleOpenChart();
  }
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
  document.getElementById('input-group-code').addEventListener('blur', handleCodeBlur);
  document.getElementById('input-player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleJoin();
  });
  document.getElementById('select-player-name').addEventListener('change', handlePlayerSelectChange);

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

  // Create group – name modal
  document.getElementById('btn-confirm-create-name').addEventListener('click', handleConfirmCreateName);
  document.getElementById('input-create-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleConfirmCreateName();
  });

  // Go to lobby
  document.getElementById('btn-go-lobby').addEventListener('click', () => {
    if (!confirm('Gå till startskärmen? Du kan gå med igen när som helst.')) return;
    state.unsubscribers.forEach(fn => fn());
    state.unsubscribers = [];
    clearSavedGroup();
    document.getElementById('bottom-nav').classList.add('hidden');
    showScreen('lobby');
    showToast('Du lämnade gruppen');
  });

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

  // Session back / close / delete / chart
  document.getElementById('btn-back-dashboard').addEventListener('click', () => showScreen('dashboard'));
  document.getElementById('btn-close-session').addEventListener('click', handleCloseSession);
  document.getElementById('btn-delete-session').addEventListener('click', handleDeleteActiveSession);
  document.getElementById('btn-session-chart').addEventListener('click', handleOpenChart);
  document.getElementById('btn-close-chart').addEventListener('click', () => {
    document.getElementById('modal-chart').classList.add('hidden');
  });

  // Quick mode – amount buttons (delegated)
  document.getElementById('quick-players-list').addEventListener('click', e => {
    const btn = e.target.closest('.amount-btn');
    if (!btn) return;
    const id = btn.dataset.playerId;
    const input = document.querySelector(`#quick-players-list .amount-input[data-player-id="${id}"]`);
    if (!input) return;
    const step = 25;
    const val = parseFloat(input.value) || 0;
    input.value = btn.dataset.action === 'inc' ? val + step : val - step;
    updateQuickSum();
  });

  document.getElementById('quick-players-list').addEventListener('input', e => {
    if (e.target.classList.contains('amount-input')) updateQuickSum();
  });

  // Quick submit
  document.getElementById('btn-quick-submit').addEventListener('click', handleQuickSubmit);

  // History item buttons (delegated)
  document.getElementById('history-list').addEventListener('click', e => {
    const detailBtn = e.target.closest('.history-btn-detail');
    const reopenBtn = e.target.closest('.history-btn-reopen');
    const deleteBtn = e.target.closest('.history-btn-delete');
    if (detailBtn) {
      const sessionId = detailBtn.dataset.sessionId;
      const session = { ...state.sessions[sessionId], id: sessionId };
      renderSessionDetail(session, state.entries, state.players);
      document.getElementById('modal-session-detail').classList.remove('hidden');
    } else if (reopenBtn) {
      handleReopenSession(reopenBtn.dataset.sessionId);
    } else if (deleteBtn) {
      handleDeleteSession(deleteBtn.dataset.sessionId);
    }
  });

  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('modal-session-detail').classList.add('hidden');
  });

  // Active session preview click → go to session
  document.getElementById('active-session-preview').addEventListener('click', () => {
    if (state.activeSessionId) showScreen('session');
  });

  // Bekräfta transaktion
  document.getElementById('settlements-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-confirm-tx');
    if (!btn) return;
    handleConfirmTransaction(btn.dataset.from, btn.dataset.to, parseInt(btn.dataset.amount));
  });

  // Ångra bekräftad transaktion
  document.getElementById('confirmed-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-unconfirm-tx');
    if (!btn) return;
    handleUnconfirmTransaction(btn.dataset.from, btn.dataset.to, parseInt(btn.dataset.amount));
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

// ===== HANDLERS =====

async function handleCodeBlur() {
  const code = document.getElementById('input-group-code').value.trim().toUpperCase();
  const selectGroup = document.getElementById('player-select-group');
  const nameGroup = document.getElementById('player-name-group');
  const select = document.getElementById('select-player-name');

  if (code.length < 4) {
    selectGroup.style.display = 'none';
    nameGroup.style.display = 'none';
    return;
  }

  const exists = await groupExists(code);
  if (!exists) return;

  const players = await getPlayers(code);
  const playerList = Object.entries(players).filter(([, p]) => !p.deleted);

  if (playerList.length > 0) {
    select.innerHTML =
      playerList.map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('') +
      `<option value="__new__">+ Skriv in nytt namn</option>`;
    selectGroup.style.display = '';
    nameGroup.style.display = 'none';
    document.getElementById('input-player-name').value = '';
  } else {
    selectGroup.style.display = 'none';
    nameGroup.style.display = '';
  }
}

function handlePlayerSelectChange() {
  const val = document.getElementById('select-player-name').value;
  const nameGroup = document.getElementById('player-name-group');
  if (val === '__new__') {
    nameGroup.style.display = '';
    document.getElementById('input-player-name').focus();
  } else {
    nameGroup.style.display = 'none';
  }
}

async function handleJoin() {
  const code = document.getElementById('input-group-code').value.trim().toUpperCase();
  if (!code || code.length < 4) { showToast('Ange en giltig gruppkod'); return; }

  const exists = await groupExists(code);
  if (!exists) { showToast('Gruppen hittades inte'); return; }

  const selectEl = document.getElementById('select-player-name');
  const selectGroup = document.getElementById('player-select-group');
  const usingSelect = selectGroup.style.display !== 'none' && selectEl.value !== '__new__';

  let playerId, playerName;

  if (usingSelect) {
    // Existing player chosen from list
    const players = await getPlayers(code);
    playerId = selectEl.value;
    playerName = players[playerId]?.name;
    if (!playerId || !playerName) { showToast('Ogiltig spelare'); return; }
  } else {
    // New name typed manually
    const name = document.getElementById('input-player-name').value.trim();
    if (!name) { showToast('Ange ditt namn'); return; }
    const players = await getPlayers(code);
    const existing = Object.entries(players).find(([, p]) => p.name.toLowerCase() === name.toLowerCase() && !p.deleted);
    playerId = existing ? existing[0] : await addPlayer(code, name, randomColor());
    playerName = name;
  }

  state.groupCode = code;
  state.playerId = playerId;
  state.playerName = playerName;
  saveGroup(code, playerId, playerName);
  await connectToGroup();
  showToast(`Välkommen, ${playerName}!`);
}

async function handleCreate() {
  const code = generateCode();
  await createGroup(code);
  state.groupCode = code;
  state.pendingGroupCode = code;
  document.getElementById('input-group-code').value = code;
  document.getElementById('input-create-name').value = '';
  document.getElementById('modal-create-name').classList.remove('hidden');
  setTimeout(() => document.getElementById('input-create-name').focus(), 100);
}

async function handleConfirmCreateName() {
  const name = document.getElementById('input-create-name').value.trim();
  if (!name) { showToast('Ange ditt namn'); return; }

  const code = state.groupCode;
  const playerId = await addPlayer(code, name, randomColor());

  state.playerId = playerId;
  state.playerName = name;
  saveGroup(code, playerId, name);
  document.getElementById('modal-create-name').classList.add('hidden');
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
  // Fallback: if none selected, use all players
  if (state.newSessionSelectedPlayers.length === 0) {
    state.newSessionSelectedPlayers = Object.keys(state.players);
  }
  if (state.newSessionSelectedPlayers.length === 0) {
    showToast('Inga spelare i gruppen');
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

async function handleConfirmTransaction(from, to, amount) {
  const fromName = state.players[from]?.name || from;
  const toName = state.players[to]?.name || to;
  const amountKr = Math.round(amount / 100);
  if (!confirm(`Har ${fromName} betalat ${toName} ${amountKr} kr?`)) return;
  await confirmTransaction(state.groupCode, from, to, amount);
  showToast('Transaktion bekräftad');
}

async function handleUnconfirmTransaction(from, to, amount) {
  const fromName = state.players[from]?.name || from;
  const toName = state.players[to]?.name || to;
  const amountKr = Math.round(amount / 100);
  if (!confirm(`Ångra bekräftelsen att ${fromName} betalat ${toName} ${amountKr} kr?`)) return;
  await unconfirmTransaction(state.groupCode, from, to, amount);
  showToast('Bekräftelse ångrad');
}

async function handleDeleteActiveSession() {
  if (!state.activeSessionId) return;
  const session = state.sessions[state.activeSessionId];
  const label = session?.name || 'Session';
  if (!confirm(`Radera "${label}"? Detta går inte att ångra.`)) return;
  await deleteSession(state.groupCode, state.activeSessionId);
  showScreen('dashboard');
  showToast('Session raderad');
}

let chartInstance = null;

function handleOpenChart() {
  const sessionId = state.activeSessionId;
  if (!sessionId) { showToast('Ingen aktiv session'); return; }

  const sessionEntries = Object.values(state.entries)
    .filter(e => e.sessionId === sessionId && !e.deleted)
    .sort((a, b) => a.timestamp - b.timestamp);

  const session = state.sessions[sessionId];
  const playerIds = session?.playerIds ? Object.keys(session.playerIds) : [];

  // Build cumulative data per player, one point per "round" (grouped by timestamp proximity)
  // Each submit call creates entries at roughly the same timestamp – group by < 5s apart
  const rounds = [];
  let prevTime = null;
  for (const e of sessionEntries) {
    if (prevTime === null || e.timestamp - prevTime > 5000) {
      rounds.push([]);
      prevTime = e.timestamp;
    }
    rounds[rounds.length - 1].push(e);
  }

  const colors = ['#e05252','#e08c52','#d4af37','#4caf82','#5291e0','#9b52e0','#e052b8','#52d4c8'];
  const datasets = playerIds
    .filter(id => state.players[id])
    .map((id, i) => {
      let cumulative = 0;
      const data = [0]; // starts at 0
      rounds.forEach(round => {
        const entry = round.find(e => e.playerId === id);
        cumulative += entry ? entry.amount / 100 : 0;
        data.push(Math.round(cumulative));
      });
      const color = state.players[id].color || colors[i % colors.length];
      return {
        label: state.players[id].name,
        data,
        borderColor: color,
        backgroundColor: color + '22',
        tension: 0.3,
        pointRadius: 4,
        fill: false
      };
    });

  const labels = ['Start', ...rounds.map((_, i) => `R${i + 1}`)];

  document.getElementById('modal-chart').classList.remove('hidden');

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const ctx = document.getElementById('session-chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#f0f0f0', font: { size: 12 } }
        }
      },
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#2e2e2e' } },
        y: {
          ticks: {
            color: '#888',
            callback: v => v + ' kr'
          },
          grid: { color: '#2e2e2e' }
        }
      }
    }
  });
}

async function handleReopenSession(sessionId) {
  if (state.activeSessionId) {
    showToast('Stäng den aktiva sessionen först');
    return;
  }
  if (!confirm('Fortsätta denna session?')) return;
  await reopenSession(state.groupCode, sessionId);
  showScreen('session');
  showToast('Session återöppnad');
}

async function handleDeleteSession(sessionId) {
  const session = state.sessions[sessionId];
  const label = session?.name || 'Session';
  if (!confirm(`Radera "${label}"? Detta går inte att ångra.`)) return;
  await deleteSession(state.groupCode, sessionId);
  showToast('Session raderad');
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
