/**
 * app.js – Black Book main application
 */
import {
  createGroup, groupExists, addPlayer, getPlayers,
  listenPlayers, listenSessions, listenBalances, listenEntries,
  createSession, getMeta, deletePlayer, reopenSession, deleteSession,
  confirmTransaction, unconfirmTransaction, listenConfirmations,
  clearBook, deleteGroup, updateSessionPointValue, updateSessionMeta
} from './modules/firebase.js';
import {
  showScreen, showToast,
  renderBalances, renderSettlements, renderConfirmedTransactions,
  renderActiveSessionPreview,
  renderQuickMode, renderHistory, renderSessionDetail,
  renderGroupPlayers, renderSessionPlayerSelect
} from './modules/ui.js';
import { formatPoints } from './modules/settlement.js';
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

// ===== LOCALSTORAGE (multi-grupp) =====

function getAllSavedGroups() {
  try {
    const raw = localStorage.getItem('blackbook_groups');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getSavedGroup() {
  try {
    // Stöd för gamla formatet (migration)
    const legacy = localStorage.getItem('blackbook_session');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed?.groupCode) {
        saveGroup(parsed.groupCode, parsed.playerId, parsed.playerName);
        localStorage.removeItem('blackbook_session');
        return parsed;
      }
    }
    // Returnera senast använda grupp
    const groups = getAllSavedGroups();
    return groups.length > 0 ? groups[0] : null;
  } catch { return null; }
}

function saveGroup(groupCode, playerId, playerName, createdAt) {
  const existing = getAllSavedGroups().find(g => g.groupCode === groupCode);
  const groups = getAllSavedGroups().filter(g => g.groupCode !== groupCode);
  groups.unshift({ groupCode, playerId, playerName, createdAt: createdAt ?? existing?.createdAt ?? null });
  localStorage.setItem('blackbook_groups', JSON.stringify(groups));
}

function removeSavedGroup(groupCode) {
  const groups = getAllSavedGroups().filter(g => g.groupCode !== groupCode);
  localStorage.setItem('blackbook_groups', JSON.stringify(groups));
}

function clearSavedGroup() {
  if (state.groupCode) removeSavedGroup(state.groupCode);
}

function prefillCode() {
  renderSavedGroups();
  const saved = getSavedGroup();
  if (saved?.groupCode) {
    document.getElementById('input-group-code').value = saved.groupCode;
    handleCodeBlur();
  }
}

function renderSavedGroups() {
  const groups = getAllSavedGroups();
  const container = document.getElementById('saved-groups-list');
  if (!container) return;
  if (groups.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  container.innerHTML = `<p class="saved-groups-label">Dina grupper</p>` +
    groups.map(g => {
      const dateStr = g.createdAt
        ? new Date(g.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      return `
        <button class="saved-group-btn" data-code="${g.groupCode}">
          <span class="saved-group-info">
            <span class="saved-group-code">${g.groupCode}</span>
            ${dateStr ? `<span class="saved-group-date">${dateStr}</span>` : ''}
          </span>
          <span class="saved-group-name">${g.playerName}</span>
          <span class="saved-group-arrow">›</span>
        </button>
      `;
    }).join('');
  container.querySelectorAll('.saved-group-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code;
      const saved = getAllSavedGroups().find(g => g.groupCode === code);
      if (!saved) return;
      const exists = await groupExists(code);
      if (!exists) {
        showToast('Gruppen finns inte längre');
        removeSavedGroup(code);
        renderSavedGroups();
        return;
      }
      state.groupCode = saved.groupCode;
      state.playerId = saved.playerId;
      state.playerName = saved.playerName;
      saveGroup(saved.groupCode, saved.playerId, saved.playerName, saved.createdAt);
      await connectToGroup();
      showToast(`Välkommen tillbaka, ${saved.playerName}!`);
    });
  });
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

  // Uppdatera saldon med nytt pointValue
  onBalancesUpdate();
}

function getActivePointValue() {
  if (!state.activeSessionId) return null;
  return state.sessions[state.activeSessionId]?.pointValue || null;
}

function onBalancesUpdate() {
  const pointValue = getActivePointValue();
  renderBalances(state.balances, state.players, state.playerId, pointValue);
  renderSettlements(state.balances, state.players, state.confirmations, pointValue);
  renderConfirmedTransactions(state.balances, state.players, state.confirmations, pointValue);
}

function onConfirmationsUpdate() {
  renderSettlements(state.balances, state.players, state.confirmations);
  renderConfirmedTransactions(state.balances, state.players, state.confirmations);
  checkAllSettled();
}

function checkAllSettled() {
  if (!state.players || Object.keys(state.players).length === 0) return;

  const netMap = {};
  Object.keys(state.players).forEach(id => {
    netMap[id] = state.balances[id]?.net || 0;
  });

  const allNetsZero = Object.values(netMap).every(v => v === 0);
  if (allNetsZero) return;

  const confirmedKeys = new Set(Object.keys(state.confirmations));

  // Inline minimizePayments to avoid dynamic import
  const transactions = minimizePaymentsLocal(netMap);
  const pending = transactions.filter(t => !confirmedKeys.has(`${t.from}_${t.to}_${t.amount}`));

  if (pending.length === 0 && transactions.length > 0) {
    setTimeout(() => {
      if (confirm('Alla uppgörelser är bekräftade! Vill du stänga boken och nollställa saldona?')) {
        handleClearBook();
      }
    }, 400);
  }
}

function minimizePaymentsLocal(netMap) {
  const creditors = [], debtors = [];
  Object.entries(netMap).forEach(([id, net]) => {
    if (net > 0) creditors.push({ id, amount: net });
    else if (net < 0) debtors.push({ id, amount: -net });
  });
  const transactions = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const pay = Math.min(creditors[i].amount, debtors[j].amount);
    transactions.push({ from: debtors[j].id, to: creditors[i].id, amount: pay });
    creditors[i].amount -= pay;
    debtors[j].amount -= pay;
    if (creditors[i].amount === 0) i++;
    if (debtors[j].amount === 0) j++;
  }
  return transactions;
}

async function handleClearBook() {
  await clearBook(state.groupCode);
  showToast('Boken stängd!');
}

function onEntriesUpdate() {
  renderSessionRounds();
  // Refresh chart if it's open
  const chartModal = document.getElementById('modal-chart');
  if (!chartModal.classList.contains('hidden') && !chartModal.classList.contains('closing')) {
    handleOpenChart();
  }
}

function renderSessionRounds() {
  const container = document.getElementById('session-rounds-list');
  if (!container || !state.activeSessionId) { if (container) container.innerHTML = ''; return; }

  const session = state.sessions[state.activeSessionId];
  const sessionEntries = Object.values(state.entries)
    .filter(e => e.sessionId === state.activeSessionId && !e.deleted)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sessionEntries.length === 0) { container.innerHTML = ''; return; }

  // Gruppera entries per omgång (< 5s isär)
  const rounds = [];
  let prevTime = null;
  for (const e of sessionEntries) {
    if (prevTime === null || e.timestamp - prevTime > 5000) {
      rounds.push([]);
      prevTime = e.timestamp;
    }
    rounds[rounds.length - 1].push(e);
  }

  const pointValue = getActivePointValue();
  const playerIds = session?.playerIds ? Object.keys(session.playerIds).filter(id => state.players[id]) : [];
  const twoPlayer = playerIds.length === 2;

  // Beräkna totaler per spelare
  const totals = {};
  playerIds.forEach(id => { totals[id] = 0; });
  sessionEntries.forEach(e => {
    if (totals[e.playerId] !== undefined) totals[e.playerId] += e.amount;
  });

  // Nyaste omgången överst (rounds är sorterade äldst→nyast, vi vänder)
  const roundsHtml = rounds.slice().reverse().map((round, i) => {
    const isLatest = i === 0;

    let parts;
    if (twoPlayer) {
      // Visa bara vinnaren (positiv)
      const winner = round.find(e => e.amount > 0);
      if (winner) {
        const player = state.players[winner.playerId];
        const display = formatPoints(winner.amount, pointValue);
        parts = `<span class="round-entry" style="color:${player.color}">${player.name} ${display}</span>`;
      } else {
        // Alla noll – visa ingenting meningsfullt
        parts = '<span class="round-entry" style="color:var(--text-muted)">0</span>';
      }
    } else {
      parts = round.map(e => {
        const player = state.players[e.playerId];
        if (!player) return '';
        const display = formatPoints(e.amount, pointValue);
        return `<span class="round-entry" style="color:${player.color}">${player.name} ${display}</span>`;
      }).join('');
    }

    return `<div class="round-row ${isLatest ? 'round-latest' : 'round-old'}">${parts}</div>`;
  }).join('');

  // Totalsumma-rad
  let totalHtml = '';
  if (playerIds.length > 0) {
    const totalParts = playerIds.map(id => {
      const p = state.players[id];
      const display = formatPoints(totals[id], pointValue);
      const cls = totals[id] > 0 ? 'positive' : totals[id] < 0 ? 'negative' : '';
      return `<div class="total-entry ${cls}">
        <span class="total-dot" style="background:${p.color}"></span>
        <span class="total-name">${p.name}</span>
        <span class="total-value">${display}</span>
      </div>`;
    }).join('');
    totalHtml = `<div class="rounds-total-row">${totalParts}</div>`;
  }

  container.innerHTML = roundsHtml;

  // Uppdatera sticky total
  let stickyEl = document.getElementById('session-sticky-total');
  if (!stickyEl) {
    stickyEl = document.createElement('div');
    stickyEl.id = 'session-sticky-total';
    stickyEl.className = 'session-sticky-total';
    document.getElementById('screen-session').appendChild(stickyEl);
  }
  stickyEl.innerHTML = totalHtml || '';
}

// ===== QUICK MODE LOGIC =====

function getQuickAmounts() {
  const amounts = {};
  // Notepad 2-spelarläge: läs vinnare och belopp
  const notepadInput = document.querySelector('.notepad-amount-input');
  if (notepadInput) {
    const winnerId = document.getElementById('quick-players-list').dataset.winnerId;
    const val = parseFloat(notepadInput.value) || 0;
    if (winnerId && val !== 0) {
      // Hitta förlorarens id
      const allBtns = document.querySelectorAll('.notepad-player-btn');
      let loserId = null;
      allBtns.forEach(btn => { if (btn.dataset.playerId !== winnerId) loserId = btn.dataset.playerId; });
      amounts[winnerId] = val;
      if (loserId) amounts[loserId] = -val;
    }
    return amounts;
  }
  // Fler spelare: vanliga inputs
  document.querySelectorAll('#quick-players-list .amount-input').forEach(input => {
    const id = input.dataset.playerId;
    amounts[id] = parseFloat(input.value) || 0;
  });
  return amounts;
}

function updateQuickSum() {
  // Notepad 2-spelarläge hanterar sin egen visning via CSS/klicklyssnare
  if (document.querySelector('.notepad-amount-input')) return;

  const amounts = getQuickAmounts();
  const total = Object.values(amounts).reduce((s, v) => s + v, 0);
  const el = document.getElementById('quick-sum');
  el.textContent = total === 0 ? '0 kr' : `${total > 0 ? '+' : ''}${total.toFixed(0)} kr`;
  el.className = 'sum-value ' + (total === 0 ? 'zero' : 'nonzero');
}

// ===== MODAL HELPERS =====

function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('hidden', 'closing');
  setupModalSwipe(overlay);
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay || overlay.classList.contains('hidden')) return;
  overlay.classList.add('closing');
  overlay.addEventListener('animationend', () => {
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
  }, { once: true });
}

function setupModalSwipe(overlay) {
  const modal = overlay.querySelector('.modal');
  if (!modal || modal._swipeSetup) return;
  modal._swipeSetup = true;

  let startY = 0;
  let currentY = 0;
  let dragging = false;

  modal.addEventListener('touchstart', e => {
    // Bara starta swipe från toppen av modalen (drag handle-zonen)
    if (e.touches[0].clientY - modal.getBoundingClientRect().top > 60) return;
    startY = e.touches[0].clientY;
    dragging = true;
    modal.style.transition = 'none';
  }, { passive: true });

  modal.addEventListener('touchmove', e => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = Math.max(0, currentY - startY);
    modal.style.transform = `translateY(${delta}px)`;
  }, { passive: true });

  modal.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    modal.style.transition = '';
    modal.style.transform = '';
    const delta = currentY - startY;
    if (delta > 80) {
      // Swipat tillräckligt – stäng
      closeModal(overlay.id);
    }
  });
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
  document.getElementById('btn-cancel-session-x').addEventListener('click', closeNewSessionModal);
  document.getElementById('btn-start-session').addEventListener('click', handleStartSession);

  // Create group – name modal
  document.getElementById('btn-confirm-create-name').addEventListener('click', handleConfirmCreateName);
  document.getElementById('input-create-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleConfirmCreateName();
  });

  // Go to lobby
  document.getElementById('btn-go-lobby').addEventListener('click', () => {
    state.unsubscribers.forEach(fn => fn());
    state.unsubscribers = [];
    document.getElementById('bottom-nav').classList.add('hidden');
    showScreen('lobby');
    prefillCode();
  });

  // Group settings
  document.getElementById('btn-group-settings').addEventListener('click', openGroupModal);
  document.getElementById('btn-close-group-x').addEventListener('click', closeGroupModal);
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard?.writeText(state.groupCode).then(() => showToast('Kod kopierad!'));
  });
  document.getElementById('btn-add-player').addEventListener('click', handleAddPlayer);
  document.getElementById('input-new-player').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddPlayer();
  });
  document.getElementById('btn-leave-group').addEventListener('click', handleLeaveGroup);
  document.getElementById('btn-delete-group').addEventListener('click', handleDeleteGroup);

  // Remove player (delegated)
  document.getElementById('group-players-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-player');
    if (!btn) return;
    handleRemovePlayer(btn.dataset.playerId);
  });

  // Session back / close / delete / chart / settings
  document.getElementById('btn-back-dashboard').addEventListener('click', () => showScreen('dashboard'));
  document.getElementById('btn-close-session').addEventListener('click', handleCloseSession);
  document.getElementById('btn-delete-session').addEventListener('click', handleDeleteActiveSession);
  document.getElementById('btn-session-chart').addEventListener('click', handleOpenChart);
  document.getElementById('btn-close-chart-x').addEventListener('click', () => closeModal('modal-chart'));
  document.getElementById('btn-session-settings').addEventListener('click', openSessionSettingsModal);
  document.getElementById('btn-close-session-settings-x').addEventListener('click', () => closeModal('modal-session-settings'));
  document.getElementById('btn-save-session-settings').addEventListener('click', handleSaveSessionSettings);

  document.getElementById('quick-players-list').addEventListener('input', e => {
    if (e.target.classList.contains('amount-input')) updateQuickSum();
  });

  // Notepad: klick på spelarknapp markerar vinnaren
  document.getElementById('quick-players-list').addEventListener('click', e => {
    const btn = e.target.closest('.notepad-player-btn');
    if (!btn) return;
    const container = document.getElementById('quick-players-list');
    const winnerId = btn.dataset.playerId;
    container.dataset.winnerId = winnerId;
    // Uppdatera visuell markering
    document.querySelectorAll('.notepad-player-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.playerId === winnerId);
    });
    // Uppdatera input så att den får rätt player-id
    const input = document.querySelector('.notepad-amount-input');
    if (input) { input.dataset.playerId = winnerId; input.focus(); }
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
      openModal('modal-session-detail');
    } else if (reopenBtn) {
      handleReopenSession(reopenBtn.dataset.sessionId);
    } else if (deleteBtn) {
      handleDeleteSession(deleteBtn.dataset.sessionId);
    }
  });

  document.getElementById('btn-close-detail-x').addEventListener('click', () => closeModal('modal-session-detail'));

  // Active session preview click → go to session
  document.getElementById('active-session-preview').addEventListener('click', () => {
    if (state.activeSessionId) showScreen('session');
  });

  // Settlement toggle
  document.getElementById('btn-toggle-settlements').addEventListener('click', () => {
    const btn = document.getElementById('btn-toggle-settlements');
    const panel = document.getElementById('settlements-panel');
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    panel.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    panel.classList.toggle('open', !isOpen);
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
      `<option value="" disabled selected>— Välj ditt namn —</option>` +
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
  const nameGroup = document.getElementById('player-name-group');

  // Om varken namnfält eller dropdown visas ännu, kör blur-logiken först
  const nameVisible = nameGroup.style.display !== 'none';
  const selectVisible = selectGroup.style.display !== 'none';
  if (!nameVisible && !selectVisible) {
    await handleCodeBlur();
    return;
  }

  const usingSelect = selectVisible && selectEl.value !== '__new__' && selectEl.value !== '';

  if (selectVisible && selectEl.value === '') {
    showToast('Välj ditt namn i listan');
    return;
  }

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
  const joinMeta = await getMeta(code);
  saveGroup(code, playerId, playerName, joinMeta?.createdAt ?? null);
  await connectToGroup();
  showToast(`Välkommen, ${playerName}!`);
}

async function handleCreate() {
  const code = generateCode();
  // createdBy sätts efter att spelaren namngivits, sparas temporärt i state
  state.pendingGroupCode = code;
  document.getElementById('input-group-code').value = code;
  document.getElementById('input-create-name').value = '';
  openModal('modal-create-name');
  setTimeout(() => document.getElementById('input-create-name').focus(), 100);
}

async function handleConfirmCreateName() {
  const name = document.getElementById('input-create-name').value.trim();
  if (!name) { showToast('Ange ditt namn'); return; }

  const code = state.pendingGroupCode;
  // Lägg till spelaren först för att få ett riktigt ID, sedan skapa gruppen med createdBy
  const playerId = await addPlayer(code, name, randomColor());
  await createGroup(code, playerId);

  state.groupCode = code;
  state.playerId = playerId;
  state.playerName = name;
  const createMeta = await getMeta(code);
  saveGroup(code, playerId, name, createMeta?.createdAt ?? Date.now());
  closeModal('modal-create-name');
  await connectToGroup();
  showToast(`Grupp skapad! Kod: ${code}`);
}

function handleLeaveGroup() {
  if (!confirm('Lämna gruppen? Din data bevaras.')) return;
  state.unsubscribers.forEach(fn => fn());
  state.unsubscribers = [];
  clearSavedGroup();
  document.getElementById('bottom-nav').classList.add('hidden');
  closeModal('modal-group');
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

  openModal('modal-new-session');
}

function closeNewSessionModal() {
  closeModal('modal-new-session');
}

async function handleStartSession() {
  const name = document.getElementById('input-session-name').value.trim();
  const pvRaw = parseFloat(document.getElementById('input-point-value').value);
  const pointValue = isNaN(pvRaw) || pvRaw <= 0 ? null : pvRaw;

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
    pointValue,
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

  openModal('modal-chart');

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const ctx = document.getElementById('session-chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          backgroundColor: '#1a1a1a',
          titleColor: '#f0f0f0',
          bodyColor: '#f0f0f0',
          borderColor: '#444',
          borderWidth: 1,
          usePointStyle: true,
          callbacks: {
            labelColor(context) {
              const color = context.dataset.borderColor;
              return { borderColor: color, backgroundColor: color };
            }
          }
        },
        legend: {
          labels: {
            color: '#f0f0f0',
            font: { size: 12 },
            usePointStyle: true,
            pointStyle: 'rect',
            padding: 12,
            generateLabels(chart) {
              return chart.data.datasets.map((ds, i) => ({
                text: ds.label,
                fillStyle: ds.borderColor,
                strokeStyle: ds.borderColor,
                pointStyle: 'rect',
                fontColor: '#f0f0f0',
                lineWidth: 0,
                hidden: !chart.isDatasetVisible(i),
                datasetIndex: i
              }));
            }
          }
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

  // Notepad 2-spelarläge
  const notepadInput = document.querySelector('.notepad-amount-input');
  if (notepadInput) {
    const container = document.getElementById('quick-players-list');
    const winnerId = container.dataset.winnerId;
    const val = parseFloat(notepadInput.value) || 0;
    if (!winnerId) { showToast('Välj en vinnare'); return; }
    if (val <= 0) { showToast('Ange ett belopp'); return; }
    const session = state.sessions[state.activeSessionId];
    const allIds = session?.playerIds ? Object.keys(session.playerIds).filter(id => state.players[id]) : [];
    const loserId = allIds.find(id => id !== winnerId);
    if (!loserId) { showToast('Kunde inte hitta motspelaren'); return; }
    const amounts = { [winnerId]: val, [loserId]: -val };
    try {
      await submitQuickResults(state.groupCode, state.activeSessionId, amounts);
      notepadInput.value = '';
      container.dataset.winnerId = '';
      document.querySelectorAll('.notepad-player-btn').forEach(b => b.classList.remove('selected'));
      showToast('Resultat registrerat!');
    } catch (err) { showToast(err.message); }
    return;
  }

  // Flerspeclarläge
  const amounts = getQuickAmounts();
  const total = Object.values(amounts).reduce((s, v) => s + v, 0);
  if (Math.abs(total) > 1) {
    showToast(`Summan måste vara 0 (nu: ${total > 0 ? '+' : ''}${total.toFixed(0)} kr)`);
    return;
  }
  try {
    await submitQuickResults(state.groupCode, state.activeSessionId, amounts);
    document.querySelectorAll('#quick-players-list .amount-input').forEach(i => i.value = 0);
    updateQuickSum();
    showToast('Resultat registrerat!');
  } catch (err) { showToast(err.message); }
}

function openGroupModal() {
  openModal('modal-group');
  renderGroupPlayers(state.players, state.playerId);
  document.getElementById('btn-delete-group').style.display = '';
}

async function handleRemovePlayer(playerId) {
  const player = state.players[playerId];
  if (!player) return;
  if (!confirm(`Ta bort ${player.name} från gruppen?`)) return;
  await deletePlayer(state.groupCode, playerId);
  showToast(`${player.name} borttagen`);
}

async function handleDeleteGroup() {
  const code = state.groupCode;
  const playerCount = Object.keys(state.players).length;
  const confirmed = confirm(
    `⚠️ RADERA GRUPP: ${code}\n\n` +
    `Detta raderar ALLT permanent:\n` +
    `• ${playerCount} spelare\n` +
    `• Alla sessioner och resultat\n` +
    `• Alla saldon och skulder\n\n` +
    `Detta går INTE att ångra!\n\n` +
    `Är du helt säker?`
  );
  if (!confirmed) return;

  // Dubbel bekräftelse
  const confirmed2 = confirm(`Sista chansen – radera grupp "${code}" för alltid?`);
  if (!confirmed2) return;

  state.unsubscribers.forEach(fn => fn());
  state.unsubscribers = [];
  await deleteGroup(code);
  removeSavedGroup(code);
  state.groupCode = null;
  state.playerId = null;
  state.playerName = null;
  closeModal('modal-group');
  document.getElementById('bottom-nav').classList.add('hidden');
  showScreen('lobby');
  renderSavedGroups();
  showToast('Gruppen har raderats');
}

function closeGroupModal() {
  closeModal('modal-group');
}

// ===== SESSION SETTINGS MODAL =====

function openSessionSettingsModal() {
  if (!state.activeSessionId) return;
  const session = state.sessions[state.activeSessionId];
  document.getElementById('input-session-name-edit').value = session?.name || '';
  document.getElementById('input-session-point-value-modal').value = session?.pointValue || '';
  openModal('modal-session-settings');
}

async function handleSaveSessionSettings() {
  if (!state.activeSessionId) return;
  const nameVal = document.getElementById('input-session-name-edit').value.trim();
  const pvRaw = parseFloat(document.getElementById('input-session-point-value-modal').value);
  const pointValue = isNaN(pvRaw) || pvRaw <= 0 ? null : pvRaw;

  await updateSessionMeta(state.groupCode, state.activeSessionId, {
    name: nameVal || null,
    pointValue: pointValue ?? null
  });

  closeModal('modal-session-settings');
  showToast('Sparat!');
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
