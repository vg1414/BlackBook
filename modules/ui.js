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
    container.innerHTML = `
      <div class="quick-player-row" data-player-id="${idA}">
        <div class="player-avatar" style="background:${pA.color}20;color:${pA.color}">${pA.name.charAt(0)}</div>
        <span class="quick-player-name">${escHtml(pA.name)}</span>
        <input class="amount-input" type="number" value="" placeholder="0" data-player-id="${idA}" inputmode="numeric" />
      </div>
      <div class="quick-player-row" data-player-id="${idB}">
        <div class="player-avatar" style="background:${pB.color}20;color:${pB.color}">${pB.name.charAt(0)}</div>
        <span class="quick-player-name">${escHtml(pB.name)}</span>
        <input class="amount-input" type="number" value="" placeholder="0" data-player-id="${idB}" inputmode="numeric" />
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
          <input class="amount-input" type="number" value="" placeholder="0" data-player-id="${id}" inputmode="numeric" />
        </div>
      `;
    }).join('');
    setTimeout(() => container.querySelector('.amount-input')?.select(), 50);
  }
}


// ===== HISTORY =====

export function renderHistory(sessions, players, entries) {
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
    const pointValue = s._storedPointValue || s.pointValue || null;

    // Beräkna totaler per spelare för denna session
    const playerIds = s.playerIds ? Object.keys(s.playerIds) : [];
    const totals = {};
    playerIds.forEach(pid => { totals[pid] = 0; });
    if (entries) {
      Object.values(entries).forEach(e => {
        if (e.sessionId === id && !e.deleted && totals[e.playerId] !== undefined) {
          totals[e.playerId] += e.amount;
        }
      });
    }

    const totalsHtml = playerIds
      .filter(pid => players[pid])
      .map(pid => {
        const p = players[pid];
        const val = totals[pid] || 0;
        const display = formatPoints(val, pointValue);
        const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : '';
        return `<span class="history-total-chip ${cls}">
          <span class="history-total-dot" style="background:${p.color}"></span>
          <span class="history-total-name">${escHtml(p.name)}</span>
          <span class="history-total-val">${display}</span>
        </span>`;
      }).join('');

    return `
      <div class="history-item" data-session-id="${id}">
        <div class="history-item-header">
          <span class="history-item-name">${escHtml(label)}</span>
          <span class="history-item-date">${date}</span>
        </div>
        ${totalsHtml ? `<div class="history-totals">${totalsHtml}</div>` : ''}
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
  const toggleBtn = document.getElementById('btn-detail-unit-toggle');

  nameEl.textContent = session.name || typeLabel(session.type);

  const storedPointValue = session._storedPointValue || session.pointValue || null;

  // Visa/dölj toggle-knapp
  if (storedPointValue && toggleBtn) {
    toggleBtn.classList.remove('hidden');
    // Håll track på om vi visar kr eller poäng; använd data-attribut
    if (!toggleBtn.dataset.mode) toggleBtn.dataset.mode = 'kr';
    const isKr = toggleBtn.dataset.mode === 'kr';
    toggleBtn.textContent = isKr ? 'kr' : 'p';
    toggleBtn.classList.toggle('btn-detail-unit-active', isKr);

    // Ny listener varje gång — klona för att rensa gamla
    const newBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
    newBtn.addEventListener('click', () => {
      newBtn.dataset.mode = newBtn.dataset.mode === 'kr' ? 'p' : 'kr';
      renderSessionDetailBody(session, entries, players,
        newBtn.dataset.mode === 'kr' ? storedPointValue : null, newBtn);
    });
  } else if (toggleBtn) {
    toggleBtn.classList.add('hidden');
    toggleBtn.dataset.mode = '';
  }

  const currentToggle = document.getElementById('btn-detail-unit-toggle');
  const currentMode = currentToggle?.dataset.mode;
  const effectivePointValue = (currentMode === 'kr' || !currentMode) ? storedPointValue : null;

  renderSessionDetailBody(session, entries, players, effectivePointValue, currentToggle);
}

function renderSessionDetailBody(session, entries, players, pointValue, toggleBtn) {
  const listEl = document.getElementById('detail-entries-list');

  // Uppdatera knappens text och stil
  if (toggleBtn && !toggleBtn.classList.contains('hidden')) {
    const isKr = pointValue !== null;
    toggleBtn.textContent = isKr ? 'kr' : 'p';
    toggleBtn.classList.toggle('btn-detail-unit-active', isKr);
  }

  const sessionEntries = Object.entries(entries || {})
    .filter(([, e]) => e.sessionId === session.id && !e.deleted)
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  if (sessionEntries.length === 0) {
    listEl.innerHTML = '<p class="muted">Inga poster</p>';
    return;
  }
  const playerIds = session.playerIds ? Object.keys(session.playerIds) : [];

  // Gruppera i rundor (< 5s isär)
  const rounds = [];
  let prevTime = null;
  for (const [, e] of sessionEntries) {
    if (prevTime === null || e.timestamp - prevTime > 5000) {
      rounds.push([]);
      prevTime = e.timestamp;
    }
    rounds[rounds.length - 1].push(e);
  }

  // Totaler per spelare
  const totals = {};
  playerIds.forEach(pid => { totals[pid] = 0; });
  sessionEntries.forEach(([, e]) => {
    if (totals[e.playerId] !== undefined) totals[e.playerId] += e.amount;
  });

  // Vinnare (högst total)
  let winner = null, winnerTotal = -Infinity;
  Object.entries(totals).forEach(([pid, val]) => {
    if (val > winnerTotal) { winnerTotal = val; winner = pid; }
  });

  // Bästa enskilda runda per spelare (högst i en runda)
  const bestRound = {};
  playerIds.forEach(pid => { bestRound[pid] = { amount: -Infinity, roundIdx: -1 }; });
  rounds.forEach((round, idx) => {
    round.forEach(e => {
      if (bestRound[e.playerId] !== undefined && e.amount > bestRound[e.playerId].amount) {
        bestRound[e.playerId] = { amount: e.amount, roundIdx: idx + 1 };
      }
    });
  });

  // Längsta vinststreak per runda (vem vann varje runda)
  const streaks = {};
  playerIds.forEach(pid => { streaks[pid] = { current: 0, max: 0 }; });
  rounds.forEach(round => {
    // Vinnare i denna runda = högst poäng
    let roundWinner = null, roundMax = -Infinity;
    round.forEach(e => {
      if (e.amount > roundMax) { roundMax = e.amount; roundWinner = e.playerId; }
    });
    playerIds.forEach(pid => {
      if (pid === roundWinner) {
        streaks[pid].current++;
        if (streaks[pid].current > streaks[pid].max) streaks[pid].max = streaks[pid].current;
      } else {
        streaks[pid].current = 0;
      }
    });
  });

  // Spelduration
  const firstTs = sessionEntries[0]?.[1]?.timestamp;
  const lastTs = sessionEntries[sessionEntries.length - 1]?.[1]?.timestamp;
  let durationStr = '–';
  if (firstTs && lastTs && lastTs > firstTs) {
    const mins = Math.round((lastTs - firstTs) / 60000);
    durationStr = mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60}m`
      : `${mins} min`;
  }

  // Bygg rankad spelarlista (sorterad vinnare → förlorare)
  const ranked = playerIds
    .filter(pid => players[pid])
    .sort((a, b) => (totals[b] || 0) - (totals[a] || 0));

  // Bäst streak totalt
  let streakKing = null, streakMax = 0;
  playerIds.forEach(pid => {
    if (streaks[pid]?.max > streakMax) { streakMax = streaks[pid].max; streakKing = pid; }
  });

  // Bästa enskilda runda totalt
  let bestRoundKing = null, bestRoundVal = -Infinity;
  playerIds.forEach(pid => {
    if (bestRound[pid]?.amount > bestRoundVal) { bestRoundVal = bestRound[pid].amount; bestRoundKing = pid; }
  });

  const fmt = (v) => formatPoints(v, pointValue);

  listEl.innerHTML = `
    <div class="sd-body">

      <div class="sd-meta-row">
        <span class="sd-meta-chip">🃏 ${rounds.length} rundor</span>
        <span class="sd-meta-chip">⏱ ${durationStr}</span>
      </div>

      <div class="sd-section-label">Resultat</div>
      <div class="sd-podium">
        ${ranked.map((pid, i) => {
          const p = players[pid];
          const val = totals[pid] || 0;
          const cls = val > 0 ? 'pos' : val < 0 ? 'neg' : '';
          const medals = ['🥇', '🥈', '🥉'];
          const medal = medals[i] || '';
          return `
            <div class="sd-player-row ${i === 0 ? 'sd-winner' : ''}">
              <span class="sd-medal">${medal}</span>
              <div class="sd-player-avatar" style="background:${p.color}22;color:${p.color}">${p.name.charAt(0)}</div>
              <span class="sd-player-name">${escHtml(p.name)}</span>
              <span class="sd-player-total ${cls}">${fmt(val)}</span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="sd-section-label">Höjdpunkter</div>
      <div class="sd-highlights">

        ${streakKing && streaks[streakKing]?.max > 1 ? `
        <div class="sd-highlight-card sd-highlight-streak">
          <div class="sd-hl-icon">🔥</div>
          <div class="sd-hl-content">
            <div class="sd-hl-title">Längsta streak</div>
            <div class="sd-hl-value">${streaks[streakKing].max} i rad</div>
            <div class="sd-hl-who" style="color:${players[streakKing]?.color}">${escHtml(players[streakKing]?.name || '')}</div>
          </div>
        </div>` : ''}

        ${bestRoundKing && bestRoundVal > 0 ? `
        <div class="sd-highlight-card sd-highlight-best">
          <div class="sd-hl-icon">⚡</div>
          <div class="sd-hl-content">
            <div class="sd-hl-title">Bästa runda</div>
            <div class="sd-hl-value">${fmt(bestRoundVal)}</div>
            <div class="sd-hl-who" style="color:${players[bestRoundKing]?.color}">${escHtml(players[bestRoundKing]?.name || '')} (R${bestRound[bestRoundKing].roundIdx})</div>
          </div>
        </div>` : ''}

        ${winner && winnerTotal > 0 ? `
        <div class="sd-highlight-card sd-highlight-winner">
          <div class="sd-hl-icon">👑</div>
          <div class="sd-hl-content">
            <div class="sd-hl-title">Sessionsvinnare</div>
            <div class="sd-hl-value">${fmt(winnerTotal)}</div>
            <div class="sd-hl-who" style="color:${players[winner]?.color}">${escHtml(players[winner]?.name || '')}</div>
          </div>
        </div>` : ''}

        ${rounds.length > 0 ? `
        <div class="sd-highlight-card sd-highlight-rounds">
          <div class="sd-hl-icon">🎯</div>
          <div class="sd-hl-content">
            <div class="sd-hl-title">Totalt spelade</div>
            <div class="sd-hl-value">${rounds.length} rundor</div>
            <div class="sd-hl-who">${durationStr !== '–' ? durationStr : ''}</div>
          </div>
        </div>` : ''}

      </div>

      ${ranked.length > 1 ? `
      <div class="sd-section-label">Per spelare</div>
      <div class="sd-player-stats">
        ${ranked.map(pid => {
          const p = players[pid];
          const br = bestRound[pid];
          const st = streaks[pid];
          return `
            <div class="sd-pstat-row">
              <div class="sd-pstat-header">
                <div class="sd-player-avatar sd-avatar-sm" style="background:${p.color}22;color:${p.color}">${p.name.charAt(0)}</div>
                <span class="sd-pstat-name">${escHtml(p.name)}</span>
              </div>
              <div class="sd-pstat-chips">
                ${st?.max > 0 ? `<span class="sd-chip">🔥 ${st.max} streak</span>` : ''}
                ${br?.amount > -Infinity && br?.amount > 0 ? `<span class="sd-chip">⚡ Bästa: ${fmt(br.amount)}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>` : ''}

    </div>
  `;

  // Staggered entrance animation
  setTimeout(() => {
    listEl.querySelectorAll('.sd-highlight-card, .sd-player-row, .sd-pstat-row').forEach((el, i) => {
      el.style.animationDelay = `${i * 60}ms`;
      el.classList.add('sd-animate-in');
    });
  }, 10);
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

// ===== CLOSED SESSIONS ON DASHBOARD =====

export function renderClosedSessionsOnDashboard(sessions, players, entries) {
  const container = document.getElementById('closed-sessions-list');
  const section = document.getElementById('section-closed-sessions');
  if (!container) return;

  const closed = Object.entries(sessions || {})
    .filter(([, s]) => s.status === 'closed')
    .sort((a, b) => (b[1].closedAt || 0) - (a[1].closedAt || 0));

  if (closed.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  container.innerHTML = closed.map(([id, s]) => {
    const date = s.closedAt ? new Date(s.closedAt).toLocaleDateString('sv-SE') : '–';
    const label = s.name || 'Session';
    const pointValue = s._storedPointValue || s.pointValue || null;

    const playerIds = s.playerIds ? Object.keys(s.playerIds) : [];
    const totals = {};
    playerIds.forEach(pid => { totals[pid] = 0; });
    if (entries) {
      Object.values(entries).forEach(e => {
        if (e.sessionId === id && !e.deleted && totals[e.playerId] !== undefined) {
          totals[e.playerId] += e.amount;
        }
      });
    }

    const totalsHtml = playerIds
      .filter(pid => players[pid])
      .map(pid => {
        const p = players[pid];
        const val = totals[pid] || 0;
        const display = formatPoints(val, pointValue);
        const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : '';
        return `<span class="history-total-chip ${cls}">
          <span class="history-total-dot" style="background:${p.color}"></span>
          <span class="history-total-name">${escHtml(p.name)}</span>
          <span class="history-total-val">${display}</span>
        </span>`;
      }).join('');

    return `
      <div class="closed-session-item" data-session-id="${id}">
        <div class="history-item-header">
          <span class="history-item-name">${escHtml(label)}</span>
          <span class="history-item-date">${date}</span>
        </div>
        ${totalsHtml ? `<div class="history-totals">${totalsHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ===== STATISTICS =====

export function renderStats(sessions, players, entries) {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const closed = Object.entries(sessions || {}).filter(([, s]) => s.status === 'closed');

  if (closed.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Ingen data ännu – spela lite först!</p></div>';
    return;
  }

  // Bygg upp per-session data: {sessionId, rounds, playerTotals}
  const sessionData = closed.map(([id, s]) => {
    const playerIds = s.playerIds ? Object.keys(s.playerIds) : [];
    const sessionEntries = Object.values(entries || {})
      .filter(e => e.sessionId === id && !e.deleted)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Gruppera i rundor (< 5s isär)
    const rounds = [];
    let prevTime = null;
    for (const e of sessionEntries) {
      if (prevTime === null || e.timestamp - prevTime > 5000) {
        rounds.push([]);
        prevTime = e.timestamp;
      }
      rounds[rounds.length - 1].push(e);
    }

    const playerTotals = {};
    playerIds.forEach(pid => { playerTotals[pid] = 0; });
    sessionEntries.forEach(e => {
      if (playerTotals[e.playerId] !== undefined) playerTotals[e.playerId] += e.amount;
    });

    return { id, session: s, rounds, playerTotals, playerIds };
  });

  // === Globala stats ===
  const totalSessions = closed.length;
  const roundCounts = sessionData.map(d => d.rounds.length);
  const longestSession = Math.max(...roundCounts, 0);
  const avgSession = roundCounts.length > 0
    ? (roundCounts.reduce((a, b) => a + b, 0) / roundCounts.length).toFixed(1)
    : 0;

  // Högsta poäng i en runda (globalt, per spelare)
  let highestRound = { playerId: null, amount: 0 };
  sessionData.forEach(({ rounds }) => {
    rounds.forEach(round => {
      round.forEach(e => {
        if (e.amount > highestRound.amount) {
          highestRound = { playerId: e.playerId, amount: e.amount };
        }
      });
    });
  });

  // === Per-spelare stats ===
  const playerStats = {};
  Object.keys(players).forEach(pid => {
    playerStats[pid] = { wins: 0, losses: 0, streak: 0, maxStreak: 0, currentStreak: 0, highestRound: 0 };
  });

  // Vinststreak: per session räknas vinnaren (högst total)
  sessionData.forEach(({ playerTotals, rounds }) => {
    // Vem vann sessionen
    let maxTotal = -Infinity;
    let winner = null;
    Object.entries(playerTotals).forEach(([pid, total]) => {
      if (total > maxTotal) { maxTotal = total; winner = pid; }
    });
    Object.keys(playerTotals).forEach(pid => {
      if (playerStats[pid]) {
        if (pid === winner) playerStats[pid].wins++;
        else playerStats[pid].losses++;
      }
    });

    // Högsta runda per spelare
    rounds.forEach(round => {
      round.forEach(e => {
        if (playerStats[e.playerId] && e.amount > playerStats[e.playerId].highestRound) {
          playerStats[e.playerId].highestRound = e.amount;
        }
      });
    });
  });

  // Streak: gå igenom sessioner i tidsordning (äldst → nyast)
  const orderedSessions = [...sessionData].sort((a, b) => (a.session.closedAt || 0) - (b.session.closedAt || 0));
  const streakMap = {}; // pid → currentStreak
  Object.keys(players).forEach(pid => { streakMap[pid] = 0; });

  orderedSessions.forEach(({ playerTotals }) => {
    let maxTotal = -Infinity;
    let winner = null;
    Object.entries(playerTotals).forEach(([pid, total]) => {
      if (total > maxTotal) { maxTotal = total; winner = pid; }
    });
    Object.keys(playerTotals).forEach(pid => {
      if (!playerStats[pid]) return;
      if (pid === winner) {
        streakMap[pid] = (streakMap[pid] || 0) + 1;
        if (streakMap[pid] > playerStats[pid].maxStreak) playerStats[pid].maxStreak = streakMap[pid];
      } else {
        streakMap[pid] = 0;
      }
    });
  });

  // Rendera
  const highestRoundPlayer = highestRound.playerId && players[highestRound.playerId]
    ? players[highestRound.playerId].name : '–';
  const highestRoundVal = highestRound.amount !== 0 ? `${(highestRound.amount / 100).toFixed(0)} p` : '–';

  const globalHtml = `
    <div class="stats-section">
      <h3 class="stats-section-title">Gruppen</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalSessions}</div>
          <div class="stat-label">Sessioner spelade</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${longestSession}</div>
          <div class="stat-label">Längsta session (rundor)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgSession}</div>
          <div class="stat-label">Snitt rundor/session</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${highestRoundVal}</div>
          <div class="stat-label">Högsta runda (${escHtml(highestRoundPlayer)})</div>
        </div>
      </div>
    </div>
  `;

  const playersHtml = Object.entries(players)
    .filter(([pid]) => playerStats[pid] && (playerStats[pid].wins + playerStats[pid].losses) > 0)
    .map(([pid, p]) => {
      const ps = playerStats[pid];
      const highRnd = ps.highestRound !== 0 ? `${(ps.highestRound / 100).toFixed(0)} p` : '–';
      return `
        <div class="stats-player-card">
          <div class="stats-player-header">
            <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
            <span class="stats-player-name">${escHtml(p.name)}</span>
          </div>
          <div class="stats-grid stats-grid-sm">
            <div class="stat-card">
              <div class="stat-value">${ps.maxStreak}</div>
              <div class="stat-label">Längsta vinststreak</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${highRnd}</div>
              <div class="stat-label">Högsta runda</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${ps.wins}</div>
              <div class="stat-label">Sessionsvinster</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${ps.losses}</div>
              <div class="stat-label">Sessionsförluster</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

  container.innerHTML = globalHtml + `<div class="stats-section"><h3 class="stats-section-title">Per spelare</h3>${playersHtml}</div>`;
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
