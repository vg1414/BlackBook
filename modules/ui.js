/**
 * ui.js
 * DOM rendering helpers
 */
import { minimizePayments, oreToSek, formatAmount, formatPoints } from './settlement.js';

// ===== TOAST =====

let toastTimer = null;

export function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// ===== NAVIGATION =====

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');

  // Update bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenId);
  });

  // Show/hide bottom nav
  const nav = document.getElementById('bottom-nav');
  nav.classList.toggle('hidden', screenId === 'lobby');
}

// ===== BALANCES =====

export function renderBalances(balances, players, currentPlayerId, pointValue) {
  const container = document.getElementById('balances-list');
  if (!players || Object.keys(players).length === 0) {
    container.innerHTML = '<p class="muted">Inga spelare ännu</p>';
    return;
  }

  const items = Object.entries(players).map(([id, player]) => {
    const net = balances[id]?.net || 0;
    return { id, player, net };
  }).sort((a, b) => b.net - a.net);

  container.innerHTML = items.map(({ id, player, net }) => {
    const cls = net > 0 ? 'positive' : net < 0 ? 'negative' : '';
    const amtCls = net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero';
    const isYou = id === currentPlayerId;
    const initial = player.name.charAt(0).toUpperCase();
    const display = formatPoints(net, pointValue);
    return `
      <div class="balance-item ${cls}">
        <div class="player-avatar" style="background:${player.color}20;color:${player.color}">${initial}</div>
        <div class="balance-info">
          <span class="balance-name">${escHtml(player.name)}${isYou ? '<span class="balance-you">(Du)</span>' : ''}</span>
        </div>
        <span class="balance-amount ${amtCls}">${display}</span>
      </div>
    `;
  }).join('');
}

// ===== SETTLEMENTS =====

export function renderSettlements(balances, players, confirmations = {}, pointValue) {
  const container = document.getElementById('settlements-list');
  const section = document.getElementById('section-settlements');
  const badge = document.getElementById('settlements-badge');

  if (!players || Object.keys(players).length === 0) {
    section.style.display = 'none';
    return;
  }

  const netMap = {};
  Object.entries(players).forEach(([id]) => {
    netMap[id] = balances[id]?.net || 0;
  });

  const transactions = minimizePayments(netMap);
  const confirmedKeys = new Set(Object.keys(confirmations));
  const pending = transactions.filter(t => !confirmedKeys.has(`${t.from}_${t.to}_${t.amount}`));

  if (pending.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  // Update badge count
  if (badge) {
    badge.textContent = pending.length;
    badge.classList.toggle('visible', pending.length > 0);
  }

  container.innerHTML = pending.map(t => {
    const fromName = players[t.from]?.name || t.from;
    const toName = players[t.to]?.name || t.to;
    const amtDisplay = pointValue
      ? Math.abs(Math.round((t.amount / 100) * pointValue)) + ' kr'
      : Math.abs(t.amount / 100) + ' p';
    return `
      <div class="settlement-item">
        <span class="settlement-from">${escHtml(fromName)}</span>
        <span class="settlement-arrow">→</span>
        <span class="settlement-to">${escHtml(toName)}</span>
        <span class="settlement-amount">${amtDisplay}</span>
        <button class="btn-confirm-tx" data-from="${t.from}" data-to="${t.to}" data-amount="${t.amount}" title="Bekräfta betalning">✓</button>
      </div>
    `;
  }).join('');
}

export function renderConfirmedTransactions(balances, players, confirmations = {}, pointValue) {
  const section = document.getElementById('section-confirmed');
  const container = document.getElementById('confirmed-list');

  const entries = Object.values(confirmations);
  if (entries.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = entries.map(t => {
    const fromName = players[t.from]?.name || t.from;
    const toName = players[t.to]?.name || t.to;
    const date = t.confirmedAt ? new Date(t.confirmedAt).toLocaleDateString('sv-SE') : '';
    const amtDisplay = pointValue
      ? Math.abs(Math.round((t.amount / 100) * pointValue)) + ' kr'
      : Math.abs(t.amount / 100) + ' p';
    return `
      <div class="settlement-item settlement-confirmed">
        <span class="settlement-from">${escHtml(fromName)}</span>
        <span class="settlement-arrow">→</span>
        <span class="settlement-to">${escHtml(toName)}</span>
        <span class="settlement-amount">${amtDisplay}</span>
        <span class="confirmed-date">${date}</span>
        <button class="btn-unconfirm-tx" data-from="${t.from}" data-to="${t.to}" data-amount="${t.amount}" title="Ångra">✕</button>
      </div>
    `;
  }).join('');
}

// ===== ACTIVE SESSION PREVIEW =====

export function renderActiveSessionPreview(sessions, players) {
  const container = document.getElementById('active-session-preview');
  if (!sessions) {
    container.innerHTML = '<p class="muted">Ingen aktiv session</p>';
    return;
  }

  const active = Object.entries(sessions).find(([, s]) => s.status === 'active');
  if (!active) {
    container.innerHTML = '<p class="muted">Ingen aktiv session</p>';
    return;
  }

  const [id, session] = active;
  const playerCount = session.playerIds ? Object.keys(session.playerIds).length : 0;
  const label = session.name || typeLabel(session.type);
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:600;color:var(--gold)">${escHtml(label)}</div>
        <div style="font-size:13px;color:var(--text-muted)">${playerCount} spelare</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">Pågår ▶</div>
    </div>
  `;
  container.dataset.sessionId = id;
}

// ===== QUICK MODE =====

export function renderQuickMode(players, sessionPlayerIds) {
  const container = document.getElementById('quick-players-list');
  const ids = sessionPlayerIds ? Object.keys(sessionPlayerIds) : [];
  const filtered = ids.filter(id => players[id]);
  const playersToShow = filtered.length > 0 ? filtered : Object.keys(players);
  const twoPlayer = playersToShow.length === 2;

  // Dölj/visa summa-raden beroende på antal spelare
  const sumRow = document.querySelector('.sum-row');
  if (sumRow) sumRow.style.display = twoPlayer ? 'none' : '';

  if (twoPlayer) {
    const [idA, idB] = playersToShow;
    const pA = players[idA], pB = players[idB];
    // plusPlayerId bestämmer vem som har inputfältet (plus-sidan)
    const plusId = container.dataset.plusPlayerId || idA;
    const minusId = plusId === idA ? idB : idA;
    const pPlus = players[plusId], pMinus = players[minusId];
    container.dataset.plusPlayerId = plusId;
    container.innerHTML = `
      <div class="quick-player-row two-player-active" data-player-id="${plusId}">
        <div class="player-avatar" style="background:${pPlus.color}20;color:${pPlus.color}">${pPlus.name.charAt(0)}</div>
        <span class="quick-player-name">${escHtml(pPlus.name)}</span>
        <input class="amount-input" type="number" value="0" data-player-id="${plusId}" inputmode="numeric" />
      </div>
      <div class="quick-player-row two-player-mirror" data-player-id="${minusId}">
        <div class="player-avatar" style="background:${pMinus.color}20;color:${pMinus.color}">${pMinus.name.charAt(0)}</div>
        <span class="quick-player-name">${escHtml(pMinus.name)}</span>
        <span class="mirror-amount" id="mirror-amount-${minusId}" style="color:${pMinus.color}">0 p</span>
        <span class="swap-hint">Tryck för att byta</span>
      </div>
    `;
    setTimeout(() => container.querySelector('.amount-input')?.select(), 50);
  } else {
    container.innerHTML = playersToShow.map((id, i) => {
      const p = players[id];
      return `
        <div class="quick-player-row" data-player-id="${id}">
          <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
          <span class="quick-player-name">${escHtml(p.name)}</span>
          <input class="amount-input" type="number" value="0" data-player-id="${id}" inputmode="numeric" />
        </div>
      `;
    }).join('');
    setTimeout(() => container.querySelector('.amount-input')?.select(), 50);
  }
}

// Byt vilken spelare som är plus i tvåspelarläget
export function swapTwoPlayerPlus(players, sessionPlayerIds) {
  const container = document.getElementById('quick-players-list');
  const ids = Object.keys(sessionPlayerIds || {}).filter(id => players[id]);
  if (ids.length !== 2) return;
  const currentPlus = container.dataset.plusPlayerId || ids[0];
  // Sätt den andra spelaren som ny plus
  container.dataset.plusPlayerId = currentPlus === ids[0] ? ids[1] : ids[0];
  renderQuickMode(players, sessionPlayerIds);
}

// ===== HISTORY =====

export function renderHistory(sessions, players) {
  const container = document.getElementById('history-list');
  if (!sessions) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Ingen historik ännu</p></div>';
    return;
  }

  const closed = Object.entries(sessions)
    .filter(([, s]) => s.status === 'closed')
    .sort((a, b) => (b[1].closedAt || 0) - (a[1].closedAt || 0));

  if (closed.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Ingen historik ännu</p></div>';
    return;
  }

  container.innerHTML = closed.map(([id, s]) => {
    const date = s.closedAt ? new Date(s.closedAt).toLocaleDateString('sv-SE') : '–';
    const label = s.name || 'Session';
    return `
      <div class="history-item" data-session-id="${id}">
        <div class="history-item-header">
          <span class="history-item-name">${escHtml(label)}</span>
          <span class="history-item-date">${date}</span>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-secondary btn-sm history-btn-detail" data-session-id="${id}">Visa</button>
          <button class="btn btn-secondary btn-sm history-btn-reopen" data-session-id="${id}">Fortsätt</button>
          <button class="btn btn-sm history-btn-delete" data-session-id="${id}" style="background:transparent;color:var(--danger);border:1px solid var(--danger)">Radera</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== SESSION DETAIL MODAL =====

export function renderSessionDetail(session, entries, players) {
  const nameEl = document.getElementById('detail-session-name');
  const listEl = document.getElementById('detail-entries-list');

  nameEl.textContent = session.name || typeLabel(session.type);

  const sessionEntries = Object.entries(entries || {})
    .filter(([, e]) => e.sessionId === session.id && !e.deleted)
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  if (sessionEntries.length === 0) {
    listEl.innerHTML = '<p class="muted">Inga poster</p>';
    return;
  }

  const pointValue = session.pointValue || null;
  listEl.innerHTML = sessionEntries.map(([id, e]) => {
    const playerName = players[e.playerId]?.name || e.playerId;
    const amtCls = e.amount > 0 ? 'positive' : e.amount < 0 ? 'negative' : '';
    return `
      <div class="detail-entry-item">
        <div class="detail-entry-left">
          <span class="detail-entry-player">${escHtml(playerName)}</span>
          <span class="detail-entry-type">${e.note ? escHtml(e.note) : ''}</span>
        </div>
        <span class="detail-entry-amount ${amtCls}">${formatPoints(e.amount, pointValue)}</span>
      </div>
    `;
  }).join('');
}

// ===== GROUP PLAYERS =====

export function renderGroupPlayers(players, currentPlayerId) {
  const container = document.getElementById('group-players-list');
  if (!players || Object.keys(players).length === 0) {
    container.innerHTML = '<p class="muted">Inga spelare</p>';
    return;
  }

  container.innerHTML = Object.entries(players).map(([id, p]) => `
    <div class="group-player-item">
      <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
      <span class="group-player-name">${escHtml(p.name)}${id === currentPlayerId ? ' (du)' : ''}</span>
      <button class="btn-remove-player" data-player-id="${id}" title="Ta bort spelare">✕</button>
    </div>
  `).join('');
}

// ===== SESSION PLAYER SELECT =====

export function renderSessionPlayerSelect(players, selectedIds) {
  const container = document.getElementById('session-player-select');
  container.innerHTML = Object.entries(players).map(([id, p]) => {
    const sel = selectedIds.includes(id) ? 'selected' : '';
    return `<button class="player-checkbox-btn ${sel}" data-player-id="${id}">${escHtml(p.name)}</button>`;
  }).join('');
}

// ===== HELPERS =====

export function typeLabel(type) {
  return 'Session';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
