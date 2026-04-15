/**
 * app.js – Black Book main application
 */
import {
  createGroup, groupExists, addPlayer, getPlayers,
  listenPlayers, listenSessions, listenBalances, listenEntries,
  createSession, getMeta, deletePlayer, reopenSession, deleteSession,
  confirmTransaction, unconfirmTransaction, listenConfirmations,
  clearBook, deleteGroup, updateSessionPointValue, updateSessionMeta,
  listenTotals, recalcTotals
} from './modules/firebase.js';
import {
  showScreen, showToast,
  renderBalances, renderSettlements, renderConfirmedTransactions,
  renderActiveSessionPreview, renderClosedSessionsOnDashboard,
  renderQuickMode, renderHistory, renderSessionDetail,
  renderGroupPlayers, renderSessionPlayerSelect, renderStats,
  buildSessionStatsHTML, renderTotals
} from './modules/ui.js';
import { formatPoints } from './modules/settlement.js';
import { submitQuickResults, endSession, undoEntry } from './modules/session.js';
import { sekToOre, oreToSek } from './modules/settlement.js';

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== STATE =====
const state = {
  groupCode: null,
  playerId: null,
  playerName: null,
  players: {},
  sessions: {},
  balances: {},
  totals: {},
  entries: {},
  confirmations: {},
  activeSessionId: null,
  unsubscribers: [],
  newSessionSelectedPlayers: []
};

// ===== INIT =====

function init() {
  const saved = getSavedGroup();
  const joinParam = new URLSearchParams(location.search).get('join')?.toUpperCase();

  if (saved && !joinParam) {
    state.groupCode = saved.groupCode;
    state.playerId = saved.playerId;
    state.playerName = saved.playerName;
    connectToGroup();
  } else {
    showScreen('lobby');
    if (joinParam) {
      document.getElementById('input-group-code').value = joinParam;
      handleCodeBlur();
      // Rensa ?join= från URL utan att ladda om sidan
      history.replaceState(null, '', location.pathname);
    } else {
      prefillCode();
    }
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

function saveGroup(groupCode, playerId, playerName, createdAt, groupName) {
  const existing = getAllSavedGroups().find(g => g.groupCode === groupCode);
  const groups = getAllSavedGroups().filter(g => g.groupCode !== groupCode);
  groups.unshift({
    groupCode,
    playerId,
    playerName,
    createdAt: createdAt ?? existing?.createdAt ?? null,
    groupName: groupName ?? existing?.groupName ?? null
  });
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
          <span class="saved-group-left">
            <span class="saved-group-code">${g.groupCode}</span>
            ${dateStr ? `<span class="saved-group-date">${dateStr}</span>` : ''}
          </span>
          <span class="saved-group-label">${g.groupName ? escHtml(g.groupName) : ''}</span>
          <span class="saved-group-name">${escHtml(g.playerName)}</span>
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
      // Hämta gruppnamn från Firebase om det saknas lokalt
      if (!saved.groupName) {
        const meta = await getMeta(saved.groupCode);
        const fetchedName = meta?.name && meta.name !== saved.groupCode ? meta.name : null;
        saveGroup(saved.groupCode, saved.playerId, saved.playerName, saved.createdAt, fetchedName);
      } else {
        saveGroup(saved.groupCode, saved.playerId, saved.playerName, saved.createdAt);
      }
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
    }),
    listenTotals(groupCode, totals => {
      state.totals = totals || {};
      onTotalsUpdate();
    })
  );

  showScreen('dashboard');
  document.getElementById('bottom-nav').classList.remove('hidden');
  document.getElementById('display-group-code').textContent = groupCode;

  // Visa gruppnamn i dashboard-headern
  const savedGroup = getAllSavedGroups().find(g => g.groupCode === groupCode);
  const nameEl = document.getElementById('dashboard-group-name');
  if (nameEl) {
    const displayName = savedGroup?.groupName && savedGroup.groupName !== groupCode
      ? savedGroup.groupName : null;
    if (displayName) {
      nameEl.textContent = displayName;
      nameEl.classList.add('header-title-group');
    } else {
      nameEl.textContent = 'Black Book';
      nameEl.classList.remove('header-title-group');
    }
  }
}

// ===== REACTIVE UPDATES =====

function onPlayersUpdate() {
  const pointValue = getActivePointValue();
  renderBalances(state.balances, state.players, state.playerId, pointValue);
  renderSettlements(state.balances, state.players, state.confirmations, getActivePointValueForSettlement());
  renderGroupPlayers(state.players, state.playerId);
  if (state.activeSessionId && state.sessions[state.activeSessionId]) {
    const session = state.sessions[state.activeSessionId];
    renderQuickMode(state.players, session.playerIds);
  }
}

function onSessionsUpdate() {
  const active = Object.entries(state.sessions).find(([, s]) => s.status === 'active');
  state.activeSessionId = active ? active[0] : null;

  renderActiveSessionPreview(state.sessions, state.players);
  renderClosedSessionsOnDashboard(state.sessions, state.players, state.entries);
  renderHistory(state.sessions, state.players, state.entries);
  renderStats(state.sessions, state.players, state.entries);

  if (state.activeSessionId) {
    const session = state.sessions[state.activeSessionId];
    document.getElementById('session-title').textContent = session.name || 'Session';
    renderQuickMode(state.players, session.playerIds);
  }

  // Uppdatera saldon med nytt pointValue
  onBalancesUpdate();
  renderSessionRounds();
  updateUnitToggleBtn(true);
  updateQuickSum();
}

function getActivePointValue() {
  if (!state.activeSessionId) return null;
  const s = state.sessions[state.activeSessionId];
  return s?.pointValue || null;
}

// Alltid kr om kr/poäng är satt – oavsett toggle-läge
function getActivePointValueForSettlement() {
  if (!state.activeSessionId) return null;
  const s = state.sessions[state.activeSessionId];
  return s?.pointValue || s?._storedPointValue || null;
}

function onBalancesUpdate() {
  const pointValue = getActivePointValue();
  const settlementPV = getActivePointValueForSettlement();
  renderBalances(state.balances, state.players, state.playerId, pointValue);
  renderSettlements(state.balances, state.players, state.confirmations, settlementPV);
  renderConfirmedTransactions(state.balances, state.players, state.confirmations, settlementPV);
}

function onConfirmationsUpdate() {
  const settlementPV = getActivePointValueForSettlement();
  renderSettlements(state.balances, state.players, state.confirmations, settlementPV);
  renderConfirmedTransactions(state.balances, state.players, state.confirmations, settlementPV);
  checkAllSettled();
}

function onTotalsUpdate() {
  const settlementPV = getActivePointValueForSettlement();
  renderTotals(state.totals, state.players, settlementPV);
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
  renderHistory(state.sessions, state.players, state.entries);
  renderClosedSessionsOnDashboard(state.sessions, state.players, state.entries);
  renderStats(state.sessions, state.players, state.entries);
  // Refresh chart if it's open
  const chartModal = document.getElementById('modal-chart');
  if (!chartModal.classList.contains('hidden') && !chartModal.classList.contains('closing')) {
    handleOpenChart();
  }
}

function renderSessionRounds() {
  const container = document.getElementById('session-rounds-list');
  const clearStickyTotal = () => {
    const el = document.getElementById('session-sticky-total');
    if (el) el.innerHTML = '';
  };

  if (!container || !state.activeSessionId) { if (container) container.innerHTML = ''; clearStickyTotal(); return; }

  const session = state.sessions[state.activeSessionId];
  const sessionEntries = Object.entries(state.entries)
    .filter(([, e]) => e.sessionId === state.activeSessionId && !e.deleted)
    .map(([id, e]) => ({ ...e, _id: id }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (sessionEntries.length === 0) { container.innerHTML = '<div class="notepad-empty"></div>'; clearStickyTotal(); return; }

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
      const winner = round.find(e => e.amount > 0);
      if (winner) {
        const player = state.players[winner.playerId];
        const display = formatPoints(winner.amount, pointValue);
        parts = `<span class="round-entry">${player.name} ${display}</span>`;
      } else {
        parts = '<span class="round-entry">0</span>';
      }
    } else {
      parts = round.map(e => {
        const player = state.players[e.playerId];
        if (!player) return '';
        const display = formatPoints(e.amount, pointValue);
        return `<span class="round-entry">${player.name} ${display}</span>`;
      }).join('');
    }

    const undoBtn = isLatest
      ? `<button class="btn-undo-round" data-entry-ids="${round.map(e => e._id).join(',')}" title="Ångra senaste">↩</button>`
      : '';
    return `<div class="round-row ${isLatest ? 'round-latest' : 'round-old'}">${undoBtn}${parts}</div>`;
  }).join('');

  // Stor total-cirkel (2-spelarläge: visa spelaren i fokus totalt)
  let totalCircleHtml = '';
  if (twoPlayer) {
    const focusId = playerIds[0];
    const focusTotal = totals[focusId] || 0;
    const absPoints = Math.abs(focusTotal / 100);
    const circleDisplay = pointValue
      ? Math.abs(Math.round(absPoints * pointValue)) + ' kr'
      : absPoints + ' p';
    totalCircleHtml = `<div class="notepad-total-circle">${circleDisplay}</div>`;
  }

  // Totalsumma-rad
  let totalHtml = '';
  if (playerIds.length > 0) {
    const n = playerIds.length;
    const cols = n <= 2 ? 2 : n === 3 ? 3 : n === 4 ? 2 : 3;
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
    totalHtml = `<div class="rounds-total-row" style="--total-cols:${cols}">${totalParts}</div>`;
  }

  container.innerHTML = (twoPlayer ? totalCircleHtml : '') + roundsHtml;

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
  const pv = getActivePointValue();
  const unit = pv ? 'kr' : 'p';
  el.textContent = total === 0 ? `0 ${unit}` : `${total > 0 ? '+' : ''}${total.toFixed(0)} ${unit}`;
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
  let lastY = 0;
  let startTime = 0;
  let dragging = false;
  let scrollLocked = false; // true = vi scrollar inuti modalen, ej swipe

  modal.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    startY = touch.clientY;
    lastY = touch.clientY;
    startTime = Date.now();
    dragging = false;
    scrollLocked = false;
    modal._touchStartScrollTop = modal.scrollTop;
  }, { passive: true });

  modal.addEventListener('touchmove', e => {
    const touch = e.touches[0];
    const deltaY = touch.clientY - startY;
    const absDelta = Math.abs(deltaY);

    // Bestäm om vi ska scrolla eller swipea (bara en gång per gest)
    if (!dragging && !scrollLocked) {
      if (absDelta < 8) return; // för liten rörelse – vänta
      const atTop = modal._touchStartScrollTop <= 0;
      const movingDown = deltaY > 0;
      if (atTop && movingDown) {
        // Modalen är längst upp och fingret drar nedåt → swipe för att stänga
        dragging = true;
        modal.style.transition = 'none';
      } else {
        // Annars → scrolla inuti modalen normalt
        scrollLocked = true;
        return;
      }
    }

    if (!dragging) return;
    lastY = touch.clientY;
    const drag = Math.max(0, touch.clientY - startY);
    // Modalen följer fingret exakt nedåt
    modal.style.transform = `translateY(${drag}px)`;
    // Bakgrunden tonas ut lite i takt med draget
    overlay.style.background = `rgba(0,0,0,${Math.max(0.1, 0.75 - drag / 400)})`;
  }, { passive: true });

  modal.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;

    const totalDelta = lastY - startY;
    const elapsed = Date.now() - startTime;
    const velocity = totalDelta / elapsed; // px/ms

    // Stäng om: tillräckligt drag (>100px) ELLER snabb swipe (>0.4 px/ms)
    if (totalDelta > 100 || velocity > 0.4) {
      // Fortsätt glida ner ut ur skärmen från nuvarande position
      const screenH = window.innerHeight;
      modal.style.transition = `transform 0.26s cubic-bezier(.32,.72,0,1)`;
      modal.style.transform = `translateY(${screenH}px)`;
      overlay.style.transition = 'background 0.26s ease, opacity 0.26s ease';
      overlay.style.background = 'rgba(0,0,0,0)';
      setTimeout(() => {
        modal.style.transition = '';
        modal.style.transform = '';
        overlay.style.transition = '';
        overlay.style.background = '';
        overlay.classList.add('hidden');
      }, 270);
    } else {
      // Fjäder tillbaka – sätt transition precis innan vi nollställer transform
      modal.style.transition = 'transform 0.32s cubic-bezier(.32,.72,0,1)';
      overlay.style.transition = 'background 0.32s ease';
      modal.style.transform = '';
      overlay.style.background = '';
      // Rensa transition när animationen är klar
      setTimeout(() => {
        modal.style.transition = '';
        overlay.style.transition = '';
      }, 340);
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
      updateUnitToggleBtn();
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
  document.getElementById('btn-copy-join-link-group').addEventListener('click', () => {
    if (state.groupCode) {
      const url = `${location.origin}${location.pathname}?join=${state.groupCode}`;
      navigator.clipboard.writeText(url).then(() => showToast('Länk kopierad!')).catch(() => showToast(url));
    }
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
  document.getElementById('btn-back-dashboard').addEventListener('click', () => { showScreen('dashboard'); updateUnitToggleBtn(); });
  document.getElementById('btn-close-session').addEventListener('click', handleCloseSession);
  document.getElementById('btn-session-chart').addEventListener('click', handleOpenChart);
  document.getElementById('btn-close-chart-x').addEventListener('click', () => closeModal('modal-chart'));

  // Flik-switching i diagram-modalen
  document.getElementById('modal-chart').addEventListener('click', e => {
    const tab = e.target.closest('.chart-tab');
    if (!tab) return;
    const name = tab.dataset.tab;
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.getElementById('chart-tab-chart').classList.toggle('hidden', name !== 'chart');
    document.getElementById('chart-tab-stats').classList.toggle('hidden', name !== 'stats');
    // Initiera Chart.js med reveal-animation när diagram-fliken visas
    if (name === 'chart') {
      requestAnimationFrame(initChartFromPending);
    }
  });
  document.getElementById('btn-session-settings').addEventListener('click', openSessionSettingsModal);
  document.getElementById('btn-toggle-unit').addEventListener('click', handleToggleUnit);
  document.getElementById('btn-close-session-settings-x').addEventListener('click', () => closeModal('modal-session-settings'));
  document.getElementById('btn-save-session-settings').addEventListener('click', handleSaveSessionSettings);
  document.getElementById('btn-copy-code-session').addEventListener('click', () => {
    if (state.groupCode) {
      navigator.clipboard.writeText(state.groupCode).then(() => showToast('Kopierat!')).catch(() => showToast(state.groupCode));
    }
  });
  document.getElementById('btn-copy-join-link').addEventListener('click', () => {
    if (state.groupCode) {
      const url = `${location.origin}${location.pathname}?join=${state.groupCode}`;
      navigator.clipboard.writeText(url).then(() => showToast('Länk kopierad!')).catch(() => showToast(url));
    }
  });

  const quickList = document.getElementById('quick-players-list');

  quickList.addEventListener('input', e => {
    if (!e.target.classList.contains('amount-input')) return;
    updateQuickSum();
    const id = e.target.dataset.playerId;
    const btn = quickList.querySelector(`.btn-sign-toggle[data-player-id="${id}"]`);
    const raw = parseFloat(e.target.value);
    const absVal = Math.abs(raw) || 0;

    // Om pendingSign är satt (användaren tryckte − när fältet var tomt) och nu börjar skriva
    if (!isNaN(raw) && absVal > 0 && e.target.dataset.pendingSign === 'negative') {
      // Tvinga värdet negativt
      if (raw > 0) e.target.value = String(-raw);
      delete e.target.dataset.pendingSign;
    }

    // Synka knappens tecken och inputfärg baserat på faktiskt värde
    const finalVal = parseFloat(e.target.value) || 0;
    if (btn) btn.textContent = finalVal < 0 ? '−' : '+';
    e.target.style.color = finalVal < 0 ? '#e74c3c' : '';
  });

  quickList.addEventListener('click', e => {
    const btn = e.target.closest('.btn-sign-toggle');
    if (!btn) return;
    const id = btn.dataset.playerId;
    const input = quickList.querySelector(`.amount-input[data-player-id="${id}"]`);
    if (!input) return;
    const val = parseFloat(input.value) || 0;
    if (val === 0) {
      // Tomt fält – sätt pendingSign så att nästa inmatning får rätt tecken
      const newSign = btn.textContent === '+' ? 'negative' : 'positive';
      btn.textContent = newSign === 'negative' ? '−' : '+';
      if (newSign === 'negative') {
        input.dataset.pendingSign = 'negative';
      } else {
        delete input.dataset.pendingSign;
      }
    } else {
      const newVal = -val;
      input.value = String(newVal);
      btn.textContent = newVal > 0 ? '+' : '−';
      input.style.color = newVal < 0 ? '#e74c3c' : '';
      delete input.dataset.pendingSign;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });


  // Quick submit
  document.getElementById('btn-quick-submit').addEventListener('click', handleQuickSubmit);

  // Ångra senaste omgång (delegerat på rounds-listan)
  document.getElementById('session-rounds-list').addEventListener('click', async e => {
    const btn = e.target.closest('.btn-undo-round');
    if (!btn) return;
    const ids = btn.dataset.entryIds ? btn.dataset.entryIds.split(',').filter(Boolean) : [];
    if (ids.length === 0) return;
    btn.disabled = true;
    try {
      await Promise.all(ids.map(id => {
        const entry = state.entries[id];
        if (!entry) return Promise.resolve();
        return undoEntry(state.groupCode, id, entry.playerId, entry.amount);
      }));
      showToast('Senaste registrering ångrad');
    } catch (err) {
      showToast('Fel: ' + err.message);
      btn.disabled = false;
    }
  });

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

  // Closed sessions on dashboard → open detail modal
  document.getElementById('closed-sessions-list').addEventListener('click', e => {
    const item = e.target.closest('.closed-session-item');
    if (!item) return;
    const sessionId = item.dataset.sessionId;
    const session = { ...state.sessions[sessionId], id: sessionId };
    renderSessionDetail(session, state.entries, state.players);
    openModal('modal-session-detail');
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

  // Totals toggle
  document.getElementById('btn-toggle-totals').addEventListener('click', () => {
    const btn = document.getElementById('btn-toggle-totals');
    const panel = document.getElementById('totals-panel');
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
  const joinGroupName = joinMeta?.name && joinMeta.name !== code ? joinMeta.name : null;
  saveGroup(code, playerId, playerName, joinMeta?.createdAt ?? null, joinGroupName);
  await connectToGroup();
  showToast(`Välkommen, ${playerName}!`);
}

async function handleCreate() {
  const code = generateCode();
  state.pendingGroupCode = code;
  document.getElementById('input-group-code').value = code;
  document.getElementById('input-group-name').value = '';
  document.getElementById('input-create-name').value = '';
  openModal('modal-create-name');
  setTimeout(() => document.getElementById('input-group-name').focus(), 100);
}

async function handleConfirmCreateName() {
  const groupName = document.getElementById('input-group-name').value.trim();
  if (!groupName) { showToast('Ange ett gruppnamn'); document.getElementById('input-group-name').focus(); return; }
  const name = document.getElementById('input-create-name').value.trim();
  if (!name) { showToast('Ange ditt namn'); document.getElementById('input-create-name').focus(); return; }

  const code = state.pendingGroupCode;
  const playerId = await addPlayer(code, name, randomColor());
  await createGroup(code, playerId, 'SEK', groupName);

  state.groupCode = code;
  state.playerId = playerId;
  state.playerName = name;
  const createMeta = await getMeta(code);
  saveGroup(code, playerId, name, createMeta?.createdAt ?? Date.now(), groupName);
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
  await recalcTotals(state.groupCode);
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
let pendingChartData = null; // sparas tills fliken öppnas

function initChartFromPending() {
  if (!pendingChartData) return;
  const { labels, datasets, unitLabel } = pendingChartData;
  // Behåller pendingChartData så att animationen kan spelas om varje gång fliken öppnas

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const drawPlugin = {
    id: 'drawReveal',
    beforeDraw(chart) {
      const { ctx: c, chartArea } = chart;
      if (!chartArea) return;
      const progress = chart._revealProgress ?? 0;
      const clipX = chartArea.left + (chartArea.right - chartArea.left) * progress;
      c.save();
      c.beginPath();
      c.rect(0, 0, clipX, chart.height);
      c.clip();
    },
    afterDraw(chart) {
      chart.ctx.restore();
    }
  };

  const ctx = document.getElementById('session-chart').getContext('2d');
  chartInstance = new Chart(ctx, {
    plugins: [drawPlugin],
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
            label(context) {
              const v = context.parsed.y;
              const sign = v > 0 ? '+' : '';
              return ` ${context.dataset.label}: ${sign}${v} ${unitLabel}`;
            },
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
      animation: false,
      scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#2e2e2e' } },
        y: {
          ticks: {
            color: '#888',
            callback: v => v + ' ' + unitLabel
          },
          grid: { color: '#2e2e2e' }
        }
      }
    }
  });

  // Animera reveal vänster→höger
  const duration = 900;
  const start = performance.now();
  function easeInOutQuart(t) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }
  function animate(now) {
    const t = Math.min((now - start) / duration, 1);
    chartInstance._revealProgress = easeInOutQuart(t);
    chartInstance.render();
    if (t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

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

  const pointValue = getActivePointValue(); // kr per poäng, eller null
  const useKr = !!pointValue;
  const unitLabel = useKr ? 'kr' : 'p';

  const colors = ['#e05252','#4fc3f7','#66bb6a','#ffd54f','#ba68c8','#ff8a65','#4db6ac','#f06292'];
  const datasets = playerIds
    .filter(id => state.players[id])
    .map((id, i) => {
      let cumulative = 0;
      const data = [0]; // starts at 0
      rounds.forEach(round => {
        const entry = round.find(e => e.playerId === id);
        const points = entry ? entry.amount / 100 : 0;
        cumulative += useKr ? points * pointValue : points;
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

  // Beräkna löpande saldo per spelare (för totaler i stats-panelen)
  const runBal = {};
  rounds.forEach(round => {
    round.forEach(e => {
      runBal[e.playerId] = (runBal[e.playerId] || 0) + e.amount;
    });
  });

  // Rendera stats-panelen – samma layout som stängd session-modal
  const statsContainer = document.getElementById('chart-session-stats');
  if (statsContainer) {
    // Totaler per spelare (från runBal som redan är beräknad)
    const totals = {};
    playerIds.forEach(id => { totals[id] = runBal[id] || 0; });

    // Spelduration från sessionEntries
    const firstTs = sessionEntries[0]?.timestamp;
    const lastTs = sessionEntries[sessionEntries.length - 1]?.timestamp;
    let durationStr = '–';
    if (firstTs && lastTs && lastTs > firstTs) {
      const mins = Math.round((lastTs - firstTs) / 60000);
      durationStr = mins >= 60
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : `${mins} min`;
    }

    statsContainer.innerHTML = buildSessionStatsHTML(
      rounds, playerIds, state.players, totals,
      useKr ? pointValue : null,
      pointValue || null,
      durationStr,
      false
    );

  }

  // Spara chart-data för lazy-initiering när diagram-fliken öppnas
  pendingChartData = { labels, datasets, unitLabel };
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  openModal('modal-chart');

  // Öppna alltid på stats-fliken
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'stats'));
  document.getElementById('chart-tab-chart').classList.add('hidden');
  document.getElementById('chart-tab-stats').classList.remove('hidden');

  // Staggerad animation för stats-element (körs efter modalen är synlig)
  if (statsContainer) {
    setTimeout(() => {
      statsContainer.querySelectorAll('.sd-highlight-card, .sd-player-row, .sd-pstat-row').forEach((el, i) => {
        el.style.animationDelay = `${i * 60}ms`;
        el.classList.add('sd-animate-in');
      });
    }, 80);
  }
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
  await recalcTotals(state.groupCode);
  showToast('Session raderad');
}

async function handleQuickSubmit() {
  if (!state.activeSessionId) { showToast('Ingen aktiv session'); return; }
  const amounts = getQuickAmounts();

  // 2-spelarläge: om bara ett fält är ifyllt, sätt det som plus och den andre som minus
  const inputs = document.querySelectorAll('#quick-players-list .amount-input');
  if (inputs.length === 2) {
    const filledInputs = Array.from(inputs).filter(i => i.value.trim() !== '');
    if (filledInputs.length === 1) {
      const filledId = filledInputs[0].dataset.playerId;
      const emptyId = Array.from(inputs).find(i => i.dataset.playerId !== filledId).dataset.playerId;
      amounts[emptyId] = -amounts[filledId];
    }
  }

  const total = Object.values(amounts).reduce((s, v) => s + v, 0);
  if (Math.abs(total) > 1) {
    showToast(`Summan måste vara 0 (nu: ${total > 0 ? '+' : ''}${total.toFixed(0)} kr)`);
    return;
  }

  try {
    await submitQuickResults(state.groupCode, state.activeSessionId, amounts);
    document.querySelectorAll('#quick-players-list .amount-input').forEach(i => {
      i.value = '';
      i.style.color = '';
      delete i.dataset.pendingSign;
    });
    document.querySelectorAll('#quick-players-list .btn-sign-toggle').forEach(b => b.textContent = '+');
    updateQuickSum();
    showToast('Resultat registrerat!');
  } catch (err) {
    showToast(err.message);
  }
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
  document.getElementById('input-session-point-value-modal').value = session?.pointValue ?? '';

  // Visa gruppkod
  const codeRow = document.getElementById('session-settings-group-code-row');
  const codeEl = document.getElementById('session-settings-group-code');
  if (state.groupCode) {
    codeEl.textContent = state.groupCode;
    codeRow.style.display = '';
  } else {
    codeRow.style.display = 'none';
  }

  openModal('modal-session-settings');
}

async function handleToggleUnit() {
  if (!state.activeSessionId) return;
  const session = state.sessions[state.activeSessionId];
  const currentPV = session?.pointValue || null;

  if (currentPV) {
    // Har kr-värde → toggle: spara undan och sätt null, eller återställ
    const stored = session._storedPointValue || currentPV;
    await updateSessionMeta(state.groupCode, state.activeSessionId, {
      pointValue: null,
      _storedPointValue: stored
    });
  } else {
    // Inget kr-värde → försök återställa sparat, annars be om värde
    const stored = session?._storedPointValue;
    if (stored) {
      await updateSessionMeta(state.groupCode, state.activeSessionId, {
        pointValue: stored,
        _storedPointValue: stored
      });
    } else {
      const input = prompt('Hur många kr är ett poäng värt?');
      const pv = parseFloat(input);
      if (!isNaN(pv) && pv > 0) {
        await updateSessionMeta(state.groupCode, state.activeSessionId, {
          pointValue: pv,
          _storedPointValue: pv
        });
      }
    }
  }
}

function updateUnitToggleBtn(animate = false) {
  const btn = document.getElementById('btn-toggle-unit');
  const label = document.getElementById('unit-coin-label');
  if (!btn || !label) return;
  const pv = getActivePointValue();
  btn.classList.toggle('active', !!pv);
  if (animate) {
    btn.classList.add('flipping');
    setTimeout(() => btn.classList.remove('flipping'), 260);
  }
  label.textContent = pv ? 'kr' : 'p';
  // Knappen sitter nu i session-sticky-top, alltid flex
  btn.style.display = 'flex';
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
  const palette = [
    '#e05252', // röd
    '#4fc3f7', // ljusblå
    '#66bb6a', // grön
    '#ffd54f', // gul
    '#ba68c8', // lila
    '#ff8a65', // orange
    '#4db6ac', // turkos
    '#f06292', // rosa
  ];
  const usedColors = Object.values(state.players || {})
    .filter(p => !p.deleted)
    .map(p => p.color);
  const available = palette.filter(c => !usedColors.includes(c));
  const pool = available.length > 0 ? available : palette;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ===== SERVICE WORKER =====

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ===== START =====
init();
