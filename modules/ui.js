/**
 * ui.js
 * DOM rendering helpers
 */
import { minimizePayments, oreToSek, formatAmount } from './settlement.js';

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

export function renderBalances(balances, players, currentPlayerId) {
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
    return `
      <div class="balance-item ${cls}">
        <div class="player-avatar" style="background:${player.color}20;color:${player.color}">${initial}</div>
        <div class="balance-info">
          <span class="balance-name">${escHtml(player.name)}${isYou ? '<span class="balance-you">(du)</span>' : ''}</span>
        </div>
        <span class="balance-amount ${amtCls}">${formatAmount(net)}</span>
      </div>
    `;
  }).join('');
}

// ===== SETTLEMENTS =====

export function renderSettlements(balances, players) {
  const container = document.getElementById('settlements-list');
  const section = document.getElementById('section-settlements');

  if (!players || Object.keys(players).length === 0) {
    section.style.display = 'none';
    return;
  }

  const netMap = {};
  Object.entries(players).forEach(([id]) => {
    netMap[id] = balances[id]?.net || 0;
  });

  const transactions = minimizePayments(netMap);

  if (transactions.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = transactions.map(t => {
    const fromName = players[t.from]?.name || t.from;
    const toName = players[t.to]?.name || t.to;
    return `
      <div class="settlement-item">
        <span class="settlement-from">${escHtml(fromName)}</span>
        <span class="settlement-arrow">→</span>
        <span class="settlement-to">${escHtml(toName)}</span>
        <span class="settlement-amount">${oreToSek(t.amount)}</span>
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
        <div style="font-size:13px;color:var(--text-muted)">${playerCount} spelare · ${typeLabel(session.type)}</div>
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
  // Fallback: show all players if session has none
  const playersToShow = filtered.length > 0 ? filtered : Object.keys(players);

  container.innerHTML = playersToShow.map(id => {
    const p = players[id];
    return `
      <div class="quick-player-row" data-player-id="${id}">
        <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
        <span class="quick-player-name">${escHtml(p.name)}</span>
        <div class="amount-control">
          <button class="amount-btn" data-action="dec" data-player-id="${id}">−</button>
          <input class="amount-input" type="number" value="0" data-player-id="${id}" inputmode="numeric" />
          <button class="amount-btn" data-action="inc" data-player-id="${id}">+</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== BUY-IN MODE =====

export function renderBuyinMode(players, sessionPlayerIds, entries) {
  const container = document.getElementById('buyin-players-list');
  const ids = sessionPlayerIds ? Object.keys(sessionPlayerIds) : [];
  const filtered = ids.filter(id => players[id]);

  container.innerHTML = filtered.map(id => {
    const p = players[id];
    const playerEntries = Object.values(entries || {}).filter(e =>
      e.playerId === id && !e.deleted && (e.type === 'buyin' || e.type === 'rebuy' || e.type === 'cashout')
    );
    const totalIn = playerEntries
      .filter(e => e.type === 'buyin' || e.type === 'rebuy')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const cashout = playerEntries.find(e => e.type === 'cashout');
    const hasCashout = !!cashout;
    const net = hasCashout ? (cashout.amount + playerEntries.filter(e => e.type === 'buyin' || e.type === 'rebuy').reduce((s, e) => s + e.amount, 0)) : null;
    const netCls = net === null ? '' : net > 0 ? 'positive' : net < 0 ? 'negative' : 'zero';
    const hasBuyin = playerEntries.some(e => e.type === 'buyin');

    return `
      <div class="buyin-player-card ${hasBuyin ? 'has-buyin' : ''}" data-player-id="${id}">
        <div class="buyin-player-header">
          <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
          <span class="buyin-player-name">${escHtml(p.name)}</span>
          ${net !== null ? `<span class="buyin-net ${netCls}">${formatAmount(net)}</span>` : ''}
        </div>
        <div class="buyin-stat">
          Inne: ${oreToSek(totalIn)}${hasCashout ? ' · Cashout: ' + oreToSek(cashout.amount) : ''}
        </div>
        <div class="buyin-actions" style="margin-top:8px">
          ${!hasBuyin ? `<button class="btn btn-secondary btn-sm" data-action="buyin" data-player-id="${id}">Buy-in</button>` : ''}
          ${hasBuyin ? `<button class="btn btn-secondary btn-sm" data-action="rebuy" data-player-id="${id}">Rebuy</button>` : ''}
          ${hasBuyin && !hasCashout ? `<button class="btn btn-primary btn-sm" data-action="cashout" data-player-id="${id}">Cashout</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
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
    const label = s.name || typeLabel(s.type);
    return `
      <div class="history-item" data-session-id="${id}">
        <div class="history-item-header">
          <span class="history-item-name">${escHtml(label)}</span>
          <span class="history-item-date">${date}</span>
        </div>
        <div class="history-item-type">${typeLabel(s.type)}</div>
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

  listEl.innerHTML = sessionEntries.map(([id, e]) => {
    const playerName = players[e.playerId]?.name || e.playerId;
    const amtCls = e.amount > 0 ? 'positive' : e.amount < 0 ? 'negative' : '';
    return `
      <div class="detail-entry-item">
        <div class="detail-entry-left">
          <span class="detail-entry-player">${escHtml(playerName)}</span>
          <span class="detail-entry-type">${e.type}${e.note ? ' · ' + escHtml(e.note) : ''}</span>
        </div>
        <span class="detail-entry-amount ${amtCls}">${formatAmount(e.amount)}</span>
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
  const labels = { poker: 'Poker', quick: 'Snabb', sport: 'Sport', other: 'Övrigt' };
  return labels[type] || type || 'Session';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
