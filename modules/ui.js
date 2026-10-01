/**
 * ui.js
 * DOM rendering helpers
 */
import { minimizePayments, oreToSek, formatAmount, formatPoints } from './settlement.js';
import { rollAll } from './countup.js';

// ===== TOAST =====

let toastTimer = null;
let detailUnitMode = 'kr'; // 'kr' | 'p'
let statsUnitMode = 'p'; // 'p' | 'kr'
let openChartCallback = null;
export function setOpenChartCallback(fn) { openChartCallback = fn; }

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

  // Persist active screen so we can restore it after wake-from-sleep
  if (screenId !== 'lobby') {
    localStorage.setItem('blackbook_active_screen', screenId);
  } else {
    localStorage.removeItem('blackbook_active_screen');
  }
}

// ===== BALANCES =====

export function renderBalances(balances, players, currentPlayerId, totals, activePointValue, showKr) {
  const container = document.getElementById('balances-list');
  if (!players || Object.keys(players).length === 0) {
    container.innerHTML = '<p class="muted">Inga spelare ännu</p>';
    return;
  }

  const items = Object.entries(players).map(([id, player]) => {
    const net = balances[id]?.net || 0;
    const totalNet = totals[id]?.net || 0;
    const totalKrNet = totals[id]?.krNet || 0;
    return { id, player, net, totalNet, totalKrNet };
  }).sort((a, b) => showKr ? b.totalKrNet - a.totalKrNet : b.totalNet - a.totalNet);

  container.innerHTML = items.map(({ id, player, net, totalNet, totalKrNet }) => {
    const displayVal = showKr ? totalKrNet : totalNet;
    const cls = displayVal > 0 ? 'positive' : displayVal < 0 ? 'negative' : '';
    const amtCls = displayVal > 0 ? 'positive' : displayVal < 0 ? 'negative' : 'zero';
    const isYou = id === currentPlayerId;
    const initial = player.name.charAt(0).toUpperCase();

    let display;
    if (showKr) {
      display = Math.round(totalKrNet / 100) + ' kr';
    } else {
      display = formatPoints(totalNet, null);
    }

    return `
      <div class="balance-item ${cls}">
        <div class="player-avatar" style="background:${player.color}20;color:${player.color}">${initial}</div>
        <div class="balance-info">
          <span class="balance-name">${escHtml(player.name)}${isYou ? '<span class="balance-you">Du</span>' : ''}</span>
        </div>
        <span class="balance-amount ${amtCls}" data-roll="bal-${id}-${showKr ? 'kr' : 'p'}">${display}</span>
      </div>
    `;
  }).join('');
  rollAll(container);
}

// ===== SETTLEMENTS =====

// totals = { [playerId]: { net, krNet } }
export function renderSettlements(totals, players, confirmations = {}) {
  const container = document.getElementById('settlements-list');
  const section = document.getElementById('section-settlements');
  const badge = document.getElementById('settlements-badge');

  if (!players || Object.keys(players).length === 0) {
    section.style.display = 'none';
    return;
  }

  // Skulder baseras på totals (stängda sessioner), räknat i hela kronor
  const krMap = {};
  Object.entries(players).forEach(([id]) => {
    krMap[id] = Math.round((totals[id]?.krNet || 0) / 100);
  });

  const krTransactions = minimizePayments(krMap);

  const confirmedKeys = new Set(Object.keys(confirmations));

  // Confirmation-nyckel baseras på kr-belopp (inga poäng-beroenden)
  const pending = krTransactions.filter(t => {
    return !confirmedKeys.has(`${t.from}_${t.to}_${t.amount}`);
  });

  if (pending.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (badge) {
    badge.textContent = pending.length;
    badge.classList.toggle('visible', pending.length > 0);
  }

  container.innerHTML = pending.map(t => {
    const fromName = players[t.from]?.name || t.from;
    const toName = players[t.to]?.name || t.to;
    const amountKr = t.amount * 100; // öre för lagring
    return `
      <div class="settlement-item">
        <span class="settlement-from">${escHtml(fromName)}</span>
        <span class="settlement-arrow">→</span>
        <span class="settlement-to">${escHtml(toName)}</span>
        <span class="settlement-amount">${t.amount} kr</span>
        <button class="btn-confirm-tx" data-from="${t.from}" data-to="${t.to}" data-amount="${t.amount}" data-amount-kr="${amountKr}" title="Bekräfta betalning">✓</button>
      </div>
    `;
  }).join('');
}

// ===== TOTALS =====

export function renderTotals(totals, players, showKr, sessions) {
  const section = document.getElementById('section-totals');
  const container = document.getElementById('totals-list');
  if (!section || !container) return;

  if (!players || Object.keys(players).length === 0) {
    section.style.display = 'none';
    return;
  }

  // Visa sektionen om det finns minst en avslutad session
  const hasClosedSession = Object.values(sessions || {}).some(s => s.status === 'closed');
  if (!hasClosedSession) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const items = Object.entries(players)
    .map(([id, player]) => ({
      id, player,
      net: totals[id]?.net || 0,
      krNet: totals[id]?.krNet || 0
    }))
    .sort((a, b) => showKr ? b.krNet - a.krNet : b.net - a.net);

  container.innerHTML = items.map(({ id, player, net, krNet }) => {
    const val = showKr ? krNet : net;
    const amtCls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'zero';
    const display = showKr
      ? (krNet >= 0 ? '+' : '') + Math.round(krNet / 100) + ' kr'
      : (net >= 0 ? '+' : '') + (net / 100) + ' p';
    const initial = player.name.charAt(0).toUpperCase();
    return `
      <div class="totals-item">
        <div class="player-avatar" style="background:${player.color}20;color:${player.color}">${initial}</div>
        <span class="totals-name">${escHtml(player.name)}</span>
        <span class="totals-amount ${amtCls}" data-roll="tot-${id}-${showKr ? 'kr' : 'p'}">${display}</span>
      </div>
    `;
  }).join('');
  rollAll(container);
}

export function renderConfirmedTransactions(players, confirmations = {}) {
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
    const amtDisplay = t.amountKr != null
      ? Math.abs(Math.round(t.amountKr / 100)) + ' kr'
      : Math.abs(t.amount / 100) + ' p';
    return `
      <div class="settlement-item settlement-confirmed">
        <span class="settlement-from">${escHtml(fromName)}</span>
        <span class="settlement-arrow">→</span>
        <span class="settlement-to">${escHtml(toName)}</span>
        <span class="settlement-amount">${amtDisplay}</span>
        <span class="confirmed-date">${date}</span>
        <button class="btn-unconfirm-tx" data-from="${t.from}" data-to="${t.to}" data-amount="${t.amount}" data-amount-kr="${t.amountKr ?? 0}" title="Ångra">✕</button>
      </div>
    `;
  }).join('');
}

// ===== TRANSACTION HISTORY MODAL =====

export function renderTxHistory(txHistory, players) {
  const container = document.getElementById('tx-history-list');
  const entries = Object.values(txHistory || {});
  if (entries.length === 0) {
    container.innerHTML = '<p class="muted">Inga bekräftade transaktioner än.</p>';
    return;
  }

  // Sortera kronologiskt, nyast först
  entries.sort((a, b) => (b.confirmedAt || 0) - (a.confirmedAt || 0));

  container.innerHTML = entries.map(t => {
    const fromName = players[t.from]?.name || t.from;
    const toName = players[t.to]?.name || t.to;
    const date = t.confirmedAt
      ? new Date(t.confirmedAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';
    const time = t.confirmedAt
      ? new Date(t.confirmedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      : '';
    const amt = t.amountKr != null
      ? Math.abs(Math.round(t.amountKr / 100)) + ' kr'
      : Math.abs(t.amount) + ' p';
    return `
      <div class="tx-history-item">
        <div class="tx-history-names">
          <span class="tx-from">${escHtml(fromName)}</span>
          <span class="tx-arrow">→</span>
          <span class="tx-to">${escHtml(toName)}</span>
        </div>
        <div class="tx-history-meta">
          <span class="tx-amount">${amt}</span>
          <span class="tx-date">${date}${time ? ' · ' + time : ''}</span>
        </div>
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

  const playerRow = (id, p) => `
    <div class="quick-player-row" data-player-id="${id}">
      <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
      <span class="quick-player-name">${escHtml(p.name)}</span>
      <div class="amount-input-wrap">
        <button class="btn-sign-toggle" data-player-id="${id}" aria-label="Växla plus/minus">+</button>
        <input class="amount-input" type="number" value="" placeholder="0" data-player-id="${id}" inputmode="decimal" min="0" />
      </div>
    </div>
  `;

  if (twoPlayer) {
    const [idA, idB] = playersToShow;
    const pA = players[idA], pB = players[idB];
    container.innerHTML = playerRow(idA, pA) + playerRow(idB, pB);
    setTimeout(() => container.querySelector('.amount-input')?.select(), 50);
  } else {
    container.innerHTML = playersToShow.map(id => playerRow(id, players[id])).join('');
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
  nameEl.textContent = session.name || typeLabel(session.type);

  const deleteBtn = document.getElementById('btn-delete-session-detail');
  if (deleteBtn) deleteBtn.dataset.sessionId = session.id || '';

  const storedPointValue = session._storedPointValue || session.pointValue || null;

  // Återställ mode till 'p' varje gång en ny session öppnas
  detailUnitMode = 'p';

  const effectivePointValue = storedPointValue && detailUnitMode === 'kr' ? storedPointValue : null;
  renderSessionDetailBody(session, entries, players, effectivePointValue, storedPointValue);
}

// ===== SESSION STATS HTML BUILDER (shared between detail modal and chart modal) =====

export function buildSessionStatsHTML(rounds, playerIds, players, totals, pointValue, storedPointValue, durationStr, showUnitToggle, totalMins = null) {
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

  // Antal vunna/förlorade rundor per spelare
  const winsCount = {};
  const lossCount = {};
  const tieCount = {};
  const winAmountSum = {};
  playerIds.forEach(pid => { winsCount[pid] = 0; lossCount[pid] = 0; tieCount[pid] = 0; winAmountSum[pid] = 0; });

  // Topp- och bottennotering per spelare (löpande saldo)
  const peakBalance = {};
  const lowestBalance = {};
  const runningBal = {};
  playerIds.forEach(pid => { runningBal[pid] = 0; peakBalance[pid] = null; lowestBalance[pid] = null; });

  rounds.forEach(round => {
    const roundAmounts = {};
    round.forEach(e => { roundAmounts[e.playerId] = e.amount; });
    playerIds.forEach(pid => {
      const amt = roundAmounts[pid] ?? 0;
      if (amt < 0) {
        streaks[pid].current = 0;
        lossCount[pid]++;
      } else if (amt > 0) {
        streaks[pid].current++;
        if (streaks[pid].current > streaks[pid].max) streaks[pid].max = streaks[pid].current;
        winsCount[pid]++;
        winAmountSum[pid] += amt;
      } else {
        tieCount[pid]++;
      }
    });
    round.forEach(e => {
      if (runningBal[e.playerId] === undefined) return;
      runningBal[e.playerId] += e.amount;
      const bal = runningBal[e.playerId];
      if (peakBalance[e.playerId] === null || bal > peakBalance[e.playerId]) peakBalance[e.playerId] = bal;
      if (lowestBalance[e.playerId] === null || bal < lowestBalance[e.playerId]) lowestBalance[e.playerId] = bal;
    });
  });

  // Snitt per runda per spelare (antal rundor spelaren deltog i)
  const avgPerRound = {};
  playerIds.forEach(pid => {
    const participated = rounds.filter(round => round.some(e => e.playerId === pid)).length;
    avgPerRound[pid] = participated > 0 ? (totals[pid] || 0) / participated : 0;
  });

  // Rankad spelarlista (sorterad vinnare → förlorare)
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
  const fmtAvg = (ore) => {
    const points = ore / 100;
    if (pointValue) {
      const kr = points * pointValue;
      const sign = kr >= 0 ? '+' : '-';
      return sign + Math.abs(kr).toFixed(1) + ' kr';
    }
    const sign = points >= 0 ? '+' : '-';
    return sign + Math.abs(points).toFixed(1) + ' p';
  };
  const compact = !showUnitToggle; // chart-modal-läge = kompakt

  return `
    <div class="${compact ? 'sd-body sd-body--compact' : 'sd-body'}">

      <div class="sd-meta-row">
        ${showUnitToggle ? `<button class="btn-icon btn-icon--chart" id="btn-detail-chart" aria-label="Diagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/></svg></button>` : ''}
        <span class="sd-meta-chip">↻ ${rounds.length} rundor</span>
        <span class="sd-meta-chip">⏱ ${durationStr}</span>
        ${totalMins !== null && rounds.length > 0 ? `<span class="sd-meta-chip">⏱ ${(totalMins / rounds.length).toFixed(1)} min/runda</span>` : ''}
        ${showUnitToggle && storedPointValue ? `<button class="btn-detail-unit${detailUnitMode === 'kr' ? ' btn-detail-unit-active' : ''}" id="btn-detail-unit-toggle">${detailUnitMode === 'kr' ? 'kr' : 'p'}</button>` : ''}
      </div>

      <div class="sd-section-label">Resultat</div>
      <div class="sd-podium">
        ${ranked.map((pid, i) => {
          const p = players[pid];
          const val = totals[pid] || 0;
          const cls = val > 0 ? 'pos' : val < 0 ? 'neg' : '';
          return `
            <div class="sd-player-row ${i === 0 ? 'sd-winner' : ''}">
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

        ${!compact && rounds.length > 0 ? `
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
                ${winsCount[pid] > 0 || lossCount[pid] > 0 || tieCount[pid] > 0 ? `<span class="sd-chip"><span class="sd-wl-win">${winsCount[pid]}W</span> / <span class="sd-wl-loss">${lossCount[pid]}L</span>${tieCount[pid] > 0 ? ` / <span class="sd-wl-tie">${tieCount[pid]}T</span>` : ''}</span>` : ''}
                ${st?.max > 0 ? `<span class="sd-chip">🔥 ${st.max} streak</span>` : ''}
                ${br?.amount > -Infinity && br?.amount > 0 ? `<span class="sd-chip">⚡ Bästa runda: ${fmt(br.amount)}</span>` : ''}
                ${rounds.length > 0 ? `<span class="sd-chip ${avgPerRound[pid] > 0 ? 'sd-chip--pos' : avgPerRound[pid] < 0 ? 'sd-chip--neg' : ''}">∅ ${fmtAvg(avgPerRound[pid])}/runda</span>` : ''}
                ${winsCount[pid] > 0 ? `<span class="sd-chip sd-chip--pos">🏆 ∅ ${fmtAvg(winAmountSum[pid] / winsCount[pid])}/vinst</span>` : ''}
              </div>
              <div class="sd-pstat-chips">
                ${peakBalance[pid] !== null && peakBalance[pid] > 0 ? `<span class="sd-chip sd-chip--pos">▲ Topp: ${fmt(peakBalance[pid])}</span>` : ''}
                ${lowestBalance[pid] !== null && lowestBalance[pid] < 0 ? `<span class="sd-chip sd-chip--neg">▼ Botten: ${fmt(lowestBalance[pid])}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>` : ''}

    </div>
  `;
}

function renderSessionDetailBody(session, entries, players, pointValue, storedPointValue) {
  const listEl = document.getElementById('detail-entries-list');

  const sessionEntries = Object.entries(entries || {})
    .filter(([, e]) => e.sessionId === session.id && !e.deleted)
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  if (sessionEntries.length === 0) {
    listEl.innerHTML = '<p class="muted">Inga poster</p>';
    return;
  }
  const playerIds = session.playerIds ? Object.keys(session.playerIds) : [];

  // Gruppera i rundor: på roundId om det finns, annars på timestamp (< 500ms isär) för gamla poster
  const rounds = [];
  const roundIdMap = {};
  let prevTime = null;
  for (const [, e] of sessionEntries) {
    if (e.roundId) {
      if (!(e.roundId in roundIdMap)) {
        roundIdMap[e.roundId] = [];
        rounds.push(roundIdMap[e.roundId]);
      }
      roundIdMap[e.roundId].push(e);
    } else {
      if (prevTime === null || e.timestamp - prevTime > 500) {
        rounds.push([]);
      }
      rounds[rounds.length - 1].push(e);
    }
    prevTime = e.timestamp;
  }

  // Totaler per spelare
  const totals = {};
  playerIds.forEach(pid => { totals[pid] = 0; });
  sessionEntries.forEach(([, e]) => {
    if (totals[e.playerId] !== undefined) totals[e.playerId] += e.amount;
  });

  // Spelduration
  const firstTs = sessionEntries[0]?.[1]?.timestamp;
  const lastTs = sessionEntries[sessionEntries.length - 1]?.[1]?.timestamp;
  let durationStr = '–';
  let totalMins = null;
  if (firstTs && lastTs && lastTs > firstTs) {
    totalMins = Math.round((lastTs - firstTs) / 60000);
    durationStr = totalMins >= 60
      ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
      : `${totalMins} min`;
  }

  listEl.innerHTML = buildSessionStatsHTML(rounds, playerIds, players, totals, pointValue, storedPointValue, durationStr, true, totalMins);

  // Koppla 📈-knappen
  const chartBtn = listEl.querySelector('#btn-detail-chart');
  if (chartBtn && openChartCallback) {
    chartBtn.addEventListener('click', () => openChartCallback(session.id));
  }

  // Koppla kr/p-toggle om den renderades
  if (storedPointValue) {
    const btn = listEl.querySelector('#btn-detail-unit-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        detailUnitMode = detailUnitMode === 'kr' ? 'p' : 'kr';
        const newPointValue = detailUnitMode === 'kr' ? storedPointValue : null;
        renderSessionDetailBody(session, entries, players, newPointValue, storedPointValue);
      });
    }
  }

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

export function renderClosedSessionsOnDashboard(sessions, players, entries, showKr) {
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
        const display = showKr && pointValue
          ? Math.round((val / 100) * pointValue) + ' kr'
          : formatPoints(val, null);
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
          <button class="closed-session-delete" data-delete-session-id="${id}" title="Radera session" aria-label="Radera session">✕</button>
        </div>
        ${totalsHtml ? `<div class="history-totals">${totalsHtml}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ===== STATISTICS =====

// Summerar rundstatistiken från alla avslutade sessioner till gruppnivå.
// Samma regler som i buildSessionStatsHTML, så gruppens siffror = summan av sessionernas.
// Belopp räknas om till vald enhet (p eller kr) per session, eftersom poängvärdet kan skilja.
function computeRoundStats(sessionData, players, useKr) {
  const toUnit = (amount, pv) => (amount / 100) * (useKr ? pv : 1);
  const per = {};
  Object.keys(players).forEach(pid => {
    per[pid] = {
      rounds: 0, wins: 0, losses: 0, ties: 0,
      sum: 0, winSum: 0, bestStreak: 0,
      sessionPeak: null, sessionLow: null,
    };
  });
  // Gruppens rekord: { pid, value, sessionName }
  const records = { streak: null, peak: null, low: null };

  sessionData.forEach(({ session, rounds, playerIds, pointValue }) => {
    const ids = playerIds.filter(pid => per[pid]);
    const sessionName = session.name || 'Session';
    // Streak och löpande saldo börjar om på noll i varje session
    const streak = {};
    const bal = {};
    ids.forEach(pid => { streak[pid] = 0; bal[pid] = 0; });

    rounds.forEach(round => {
      const amounts = {};
      round.forEach(e => { amounts[e.playerId] = e.amount; });

      ids.forEach(pid => {
        const ps = per[pid];
        const amt = amounts[pid] ?? 0;
        if (pid in amounts) ps.rounds++;
        if (amt > 0) {
          ps.wins++;
          ps.winSum += toUnit(amt, pointValue);
          streak[pid]++;
          if (streak[pid] > ps.bestStreak) ps.bestStreak = streak[pid];
          if (!records.streak || streak[pid] > records.streak.value) {
            records.streak = { pid, value: streak[pid], sessionName };
          }
        } else if (amt < 0) {
          ps.losses++;
          streak[pid] = 0;
        } else {
          ps.ties++;
        }
      });

      round.forEach(e => {
        if (bal[e.playerId] === undefined) return;
        const ps = per[e.playerId];
        const v = toUnit(e.amount, pointValue);
        ps.sum += v;
        bal[e.playerId] += v;
        const b = bal[e.playerId];
        if (b > 0 && (ps.sessionPeak === null || b > ps.sessionPeak)) ps.sessionPeak = b;
        if (b < 0 && (ps.sessionLow === null || b < ps.sessionLow)) ps.sessionLow = b;
        if (b > 0 && (!records.peak || b > records.peak.value)) records.peak = { pid: e.playerId, value: b, sessionName };
        if (b < 0 && (!records.low || b < records.low.value)) records.low = { pid: e.playerId, value: b, sessionName };
      });
    });
  });

  return { per, records };
}

export function renderStats(sessions, players, entries) {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const closed = Object.entries(sessions || {}).filter(([, s]) => s.status === 'closed');

  if (closed.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Ingen data ännu – spela lite först!</p></div>';
    return;
  }

  // Bygg upp per-session data: {sessionId, rounds, playerTotals, pointValue}
  const sessionData = closed.map(([id, s]) => {
    const playerIds = s.playerIds ? Object.keys(s.playerIds) : [];
    const sessionEntries = Object.values(entries || {})
      .filter(e => e.sessionId === id && !e.deleted)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Gruppera i rundor: på roundId om det finns, annars på timestamp (< 500ms isär) för gamla poster
    const rounds = [];
    const roundIdMap = {};
    let prevTime = null;
    for (const e of sessionEntries) {
      if (e.roundId) {
        if (!(e.roundId in roundIdMap)) {
          roundIdMap[e.roundId] = [];
          rounds.push(roundIdMap[e.roundId]);
        }
        roundIdMap[e.roundId].push(e);
      } else {
        if (prevTime === null || e.timestamp - prevTime > 500) {
          rounds.push([]);
        }
        rounds[rounds.length - 1].push(e);
      }
      prevTime = e.timestamp;
    }

    const playerTotals = {};
    playerIds.forEach(pid => { playerTotals[pid] = 0; });
    sessionEntries.forEach(e => {
      if (playerTotals[e.playerId] !== undefined) playerTotals[e.playerId] += e.amount;
    });

    // pointValue: kr per poäng. Fallback 1 (1p = 1kr) om saknas
    const pointValue = s._storedPointValue || s.pointValue || 1;

    // Speltid: första → sista posten (samma som i sessionsdetaljen). null om den inte går att mäta
    const firstTs = sessionEntries[0]?.timestamp;
    const lastTs = sessionEntries[sessionEntries.length - 1]?.timestamp;
    const mins = firstTs && lastTs && lastTs > firstTs ? Math.round((lastTs - firstTs) / 60000) : null;

    return { id, session: s, rounds, playerTotals, playerIds, pointValue, mins };
  });

  // === Globala stats ===
  const totalSessions = closed.length;
  const roundCounts = sessionData.map(d => d.rounds.length);
  const totalRounds = roundCounts.reduce((a, b) => a + b, 0);
  const longestSession = Math.max(...roundCounts, 0);
  const avgSession = roundCounts.length > 0
    ? (totalRounds / roundCounts.length).toFixed(1)
    : 0;

  // Total speltid = summan av varje sessions speltid. Min/runda räknas bara på sessioner med mätbar tid
  const timed = sessionData.filter(d => d.mins !== null);
  const totalMins = timed.reduce((a, d) => a + d.mins, 0);
  const timedRounds = timed.reduce((a, d) => a + d.rounds.length, 0);
  const totalTimeStr = timed.length === 0 ? '–'
    : totalMins >= 60 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : `${totalMins} min`;
  const minPerRoundStr = timedRounds > 0 ? (totalMins / timedRounds).toFixed(1) : '–';

  // Högsta poäng i en runda (globalt, per spelare) – spara sessionens pointValue med
  let highestRound = { playerId: null, amount: 0, pointValue: 1 };
  sessionData.forEach(({ rounds, pointValue }) => {
    rounds.forEach(round => {
      round.forEach(e => {
        if (e.amount > highestRound.amount) {
          highestRound = { playerId: e.playerId, amount: e.amount, pointValue };
        }
      });
    });
  });

  // === Per-spelare stats ===
  // highestRound och balance-värden sparas med sin sessions pointValue
  const playerStats = {};
  Object.keys(players).forEach(pid => {
    playerStats[pid] = {
      wins: 0, losses: 0, maxStreak: 0,
      highestRound: 0, highestRoundPV: 1,
      peakBalance: null, peakBalancePV: 1,
      lowestBalance: null, lowestBalancePV: 1,
    };
  });

  // Vinststreak: per session räknas vinnaren (högst total)
  const runningBalance = {};
  sessionData.forEach(({ playerTotals, rounds, pointValue }) => {
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

    // Högsta runda per spelare + ackumulerat saldo (topp/botten över alla sessioner)
    rounds.forEach(round => {
      round.forEach(e => {
        if (!playerStats[e.playerId]) return;
        const ps = playerStats[e.playerId];
        // Högsta enskild runda
        if (e.amount > ps.highestRound) {
          ps.highestRound = e.amount;
          ps.highestRoundPV = pointValue;
        }
        // Löpande saldo
        runningBalance[e.playerId] = (runningBalance[e.playerId] || 0) + e.amount;
        const bal = runningBalance[e.playerId];
        if (ps.peakBalance === null || bal > ps.peakBalance) {
          ps.peakBalance = bal;
          ps.peakBalancePV = pointValue;
        }
        if (ps.lowestBalance === null || bal < ps.lowestBalance) {
          ps.lowestBalance = bal;
          ps.lowestBalancePV = pointValue;
        }
      });
    });
  });

  // Streak: gå igenom sessioner i tidsordning (äldst → nyast)
  const orderedSessions = [...sessionData].sort((a, b) => (a.session.closedAt || 0) - (b.session.closedAt || 0));
  const streakMap = {};
  Object.keys(players).forEach(pid => { streakMap[pid] = 0; });

  orderedSessions.forEach(({ playerTotals }) => {
    let maxTotal = -Infinity;
    let winner = null;
    Object.entries(playerTotals).forEach(([pid, total]) => {
      if (total > maxTotal) { maxTotal = total; winner = pid; }
    });
    // If the top result is 0 or negative, no one won — skip streak updates entirely
    if (!winner || maxTotal <= 0) return;
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

  // === Formatering beroende på läge ===
  // fmtVal: konverterar ett råvärde (i 1/100-poäng) till visningssträng med rätt enhet
  const useKr = statsUnitMode === 'kr';
  const fmtVal = (rawAmount, pointValue) => {
    const points = rawAmount / 100;
    if (useKr) {
      return `${Math.round(points * pointValue)} kr`;
    }
    return `${points.toFixed(0)} p`;
  };
  const fmtValSigned = (rawAmount, pointValue) => {
    const points = rawAmount / 100;
    if (useKr) {
      const kr = Math.round(points * pointValue);
      return (kr >= 0 ? '+' : '') + kr + ' kr';
    }
    return (points >= 0 ? '+' : '') + points.toFixed(0) + ' p';
  };

  // Rundstatistik summerad från alla sessioner (redan omräknad till vald enhet)
  const { per: roundStats, records } = computeRoundStats(sessionData, players, useKr);
  const unit = useKr ? 'kr' : 'p';
  const fmtUnitSigned = v => {
    const r = Math.round(v);
    return (r > 0 ? '+' : r < 0 ? '-' : '') + Math.abs(r) + ' ' + unit;
  };
  const fmtUnitAvg = v => {
    const r = Math.round(v * 10) / 10;
    return (r > 0 ? '+' : r < 0 ? '-' : '') + Math.abs(r).toFixed(1) + ' ' + unit;
  };

  // Rekordhållare: flest sessionsvinster och flest vunna rundor
  let mostSessionWins = null, mostRoundWins = null;
  Object.keys(players).forEach(pid => {
    if (playerStats[pid].wins > (mostSessionWins ? playerStats[mostSessionWins].wins : 0)) mostSessionWins = pid;
    if (roundStats[pid].wins > (mostRoundWins ? roundStats[mostRoundWins].wins : 0)) mostRoundWins = pid;
  });

  const hlCard = (cls, icon, title, value, pid, meta) => `
    <div class="sd-highlight-card ${cls}">
      <div class="sd-hl-icon">${icon}</div>
      <div class="sd-hl-content">
        <div class="sd-hl-title">${title}</div>
        <div class="sd-hl-value">${value}</div>
        <div class="sd-hl-who" style="color:${players[pid]?.color}">${escHtml(players[pid]?.name || '')}</div>
        ${meta ? `<div class="stats-hl-meta">${escHtml(meta)}</div>` : ''}
      </div>
    </div>`;

  const highlightCards = [
    records.streak && records.streak.value > 1
      ? hlCard('sd-highlight-streak', '🔥', 'Längsta streak', `${records.streak.value} i rad`, records.streak.pid, records.streak.sessionName) : '',
    highestRound.playerId && players[highestRound.playerId]
      ? hlCard('sd-highlight-best', '⚡', 'Bästa runda', fmtVal(highestRound.amount, highestRound.pointValue), highestRound.playerId) : '',
    mostSessionWins
      ? hlCard('sd-highlight-winner', '👑', 'Flest sessionsvinster', `${playerStats[mostSessionWins].wins} st`, mostSessionWins) : '',
    mostRoundWins
      ? hlCard('sd-highlight-rounds', '🎯', 'Flest vunna rundor', `${roundStats[mostRoundWins].wins} st`, mostRoundWins) : '',
    records.peak
      ? hlCard('sd-highlight-peak', '<span class="sd-wl-win">▲</span>', 'Högsta topp i en session', fmtUnitSigned(records.peak.value), records.peak.pid, records.peak.sessionName) : '',
    records.low
      ? hlCard('sd-highlight-low', '<span class="sd-wl-loss">▼</span>', 'Djupaste botten i en session', fmtUnitSigned(records.low.value), records.low.pid, records.low.sessionName) : '',
  ].join('');

  const highlightsHtml = highlightCards.trim() ? `
    <div class="stats-section">
      <h3 class="stats-section-title">Höjdpunkter</h3>
      <div class="sd-highlights">${highlightCards}</div>
    </div>
  ` : '';

  // Rendera
  const globalHtml = `
    <div class="stats-section">
      <div class="stats-section-header">
        <h3 class="stats-section-title">Gruppen</h3>
        <button id="stats-chart-btn" class="stats-chart-inline-btn" title="Visa diagram" aria-label="Öppna diagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/></svg></button>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalSessions}</div>
          <div class="stat-label">Sessioner spelade</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalRounds}</div>
          <div class="stat-label">Rundor spelade</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalTimeStr}</div>
          <div class="stat-label">Total speltid</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${minPerRoundStr}</div>
          <div class="stat-label">Min/runda</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${longestSession}</div>
          <div class="stat-label">Längsta session (rundor)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgSession}</div>
          <div class="stat-label">Snitt rundor/session</div>
        </div>
      </div>
    </div>
  `;

  const playersHtml = Object.entries(players)
    .filter(([pid]) => playerStats[pid] && (playerStats[pid].wins + playerStats[pid].losses) > 0)
    .map(([pid, p]) => {
      const ps = playerStats[pid];
      const highRnd = ps.highestRound !== 0 ? fmtVal(ps.highestRound, ps.highestRoundPV) : '–';
      const peak = ps.peakBalance !== null && ps.peakBalance > 0
        ? fmtValSigned(ps.peakBalance, ps.peakBalancePV) : '–';
      const lowest = ps.lowestBalance !== null && ps.lowestBalance < 0
        ? fmtValSigned(ps.lowestBalance, ps.lowestBalancePV) : '–';

      const rs = roundStats[pid];
      const sessionsPlayed = ps.wins + ps.losses;
      const counted = rs.wins + rs.losses + rs.ties;
      const decided = rs.wins + rs.losses;
      const winPct = decided > 0 ? Math.round((rs.wins / decided) * 100) : null;
      const seg = (cls, n) => n > 0 ? `<span class="${cls}" style="width:${(n / counted) * 100}%"></span>` : '';
      const avgCls = v => v > 0 ? ' stat-card--positive' : v < 0 ? ' stat-card--negative' : '';
      const avgRound = rs.rounds > 0 ? rs.sum / rs.rounds : null;
      const avgWin = rs.wins > 0 ? rs.winSum / rs.wins : null;

      return `
        <div class="stats-player-card">
          <div class="stats-player-header">
            <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
            <span class="stats-player-name">${escHtml(p.name)}</span>
            <span class="stats-player-meta">${sessionsPlayed} ${sessionsPlayed === 1 ? 'session' : 'sessioner'} · ${rs.rounds} rundor</span>
          </div>

          <div class="stats-group">
            <div class="stats-group-label">Rundor</div>
            ${counted > 0 ? `
            <div class="stats-wlt-bar" role="img" aria-label="${rs.wins} vunna, ${rs.losses} förlorade, ${rs.ties} oavgjorda rundor">
              ${seg('is-win', rs.wins)}${seg('is-loss', rs.losses)}${seg('is-tie', rs.ties)}
            </div>
            <div class="stats-wlt-legend">
              <span class="sd-wl-win">${rs.wins}W</span>
              <span class="sd-wl-loss">${rs.losses}L</span>
              ${rs.ties > 0 ? `<span class="sd-wl-tie">${rs.ties}T</span>` : ''}
              ${winPct !== null ? `<span class="stats-wlt-pct">${winPct} % vunna</span>` : ''}
            </div>` : ''}
            <div class="stats-grid stats-grid-sm">
              <div class="stat-card">
                <div class="stat-value">${rs.bestStreak}</div>
                <div class="stat-label">Bästa streak (rundor i rad)</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${highRnd}</div>
                <div class="stat-label">Högsta runda</div>
              </div>
              <div class="stat-card${avgCls(avgRound)}">
                <div class="stat-value">${avgRound !== null ? fmtUnitAvg(avgRound) : '–'}</div>
                <div class="stat-label">Snitt per runda</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${avgWin !== null ? fmtUnitAvg(avgWin) : '–'}</div>
                <div class="stat-label">Snitt per vunnen runda</div>
              </div>
            </div>
          </div>

          <div class="stats-group">
            <div class="stats-group-label">Saldo</div>
            <div class="stats-grid stats-grid-sm">
              <div class="stat-card stat-card--positive">
                <div class="stat-value">${rs.sessionPeak !== null ? fmtUnitSigned(rs.sessionPeak) : '–'}</div>
                <div class="stat-label">Bästa topp i en session</div>
              </div>
              <div class="stat-card stat-card--negative">
                <div class="stat-value">${rs.sessionLow !== null ? fmtUnitSigned(rs.sessionLow) : '–'}</div>
                <div class="stat-label">Djupaste botten i en session</div>
              </div>
              <div class="stat-card stat-card--positive">
                <div class="stat-value">${peak}</div>
                <div class="stat-label">Högsta saldo totalt</div>
              </div>
              <div class="stat-card stat-card--negative">
                <div class="stat-value">${lowest}</div>
                <div class="stat-label">Lägsta saldo totalt</div>
              </div>
            </div>
          </div>

          <div class="stats-group">
            <div class="stats-group-label">Sessioner</div>
            <div class="stats-grid stats-grid-sm stats-grid-3">
              <div class="stat-card">
                <div class="stat-value">${ps.wins}</div>
                <div class="stat-label">Vinster</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${ps.losses}</div>
                <div class="stat-label">Förluster</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${ps.maxStreak}</div>
                <div class="stat-label">Vinster i rad</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

  const duelHtml = `
    <div class="stats-section" id="duel-section">
      <h3 class="stats-section-title">Duell</h3>
      <div class="duel" id="duel"></div>
    </div>
  `;

  container.innerHTML = globalHtml + highlightsHtml + duelHtml + `<div class="stats-section"><h3 class="stats-section-title">Per spelare</h3>${playersHtml}</div>`;
  setupDuel(document.getElementById('duel'), sessionData, players, useKr);

  // Höjdpunktskorten tonas in ett i taget
  setTimeout(() => {
    container.querySelectorAll('.sd-highlight-card').forEach((el, i) => {
      el.style.transitionDelay = `${i * 60}ms`;
      el.classList.add('sd-animate-in');
    });
  }, 10);

  // FAB-rad för p/kr-switch + diagram-knapp – fast position, följer med vid scroll
  const existing = document.getElementById('stats-unit-fab');
  if (existing) existing.remove();

  const fabRow = document.createElement('div');
  fabRow.id = 'stats-unit-fab';
  fabRow.className = 'stats-unit-fab-row';

  const fab = document.createElement('button');
  fab.className = 'btn-detail-unit stats-unit-fab-toggle' + (useKr ? ' btn-detail-unit-active' : '');
  fab.textContent = useKr ? 'kr' : 'p';
  fab.addEventListener('click', () => {
    statsUnitMode = statsUnitMode === 'p' ? 'kr' : 'p';
    renderStats(sessions, players, entries);
  });

  fabRow.appendChild(fab);
  document.getElementById('screen-stats').appendChild(fabRow);
}

// ===== DUELL =====
// Jämför två spelare i de avslutade sessioner där båda var med.
// Vinnare av en session (i duellen) = den av de två som slutade med högst resultat.

let duelA = null;
let duelB = null;

function computeDuel(sessionData, a, b, useKr) {
  const toUnit = (amount, pv) => (amount / 100) * (useKr ? pv : 1);
  const shared = sessionData.filter(d => d.playerIds.includes(a) && d.playerIds.includes(b));
  const res = { sessions: shared.length, winsA: 0, winsB: 0, ties: 0, sumA: 0, sumB: 0, bestA: null, bestB: null };
  shared.forEach(({ playerTotals, rounds, pointValue }) => {
    const ta = playerTotals[a] || 0;
    const tb = playerTotals[b] || 0;
    if (ta > tb) res.winsA++;
    else if (tb > ta) res.winsB++;
    else res.ties++;
    res.sumA += toUnit(ta, pointValue);
    res.sumB += toUnit(tb, pointValue);
    rounds.forEach(round => round.forEach(e => {
      const v = toUnit(e.amount, pointValue);
      if (e.playerId === a && (res.bestA === null || v > res.bestA)) res.bestA = v;
      if (e.playerId === b && (res.bestB === null || v > res.bestB)) res.bestB = v;
    }));
  });
  return res;
}

function setupDuel(el, sessionData, players, useKr) {
  if (!el) return;
  // Bara spelare som varit med i minst en avslutad session
  const ids = Object.keys(players).filter(pid => sessionData.some(d => d.playerIds.includes(pid)));
  if (ids.length < 2) {
    document.getElementById('duel-section').style.display = 'none';
    return;
  }

  // Standardval: paret som spelat flest sessioner ihop
  if (!ids.includes(duelA) || !ids.includes(duelB) || duelA === duelB) {
    let best = -1;
    ids.forEach((a, i) => ids.slice(i + 1).forEach(b => {
      const n = sessionData.filter(d => d.playerIds.includes(a) && d.playerIds.includes(b)).length;
      if (n > best) { best = n; duelA = a; duelB = b; }
    }));
  }

  const unit = useKr ? 'kr' : 'p';
  const fmt = v => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(Math.round(v)) + ' ' + unit;
  const options = sel => ids.map(pid =>
    `<option value="${pid}"${pid === sel ? ' selected' : ''}>${escHtml(players[pid].name)}</option>`).join('');
  const avatar = p => `<div class="player-avatar duel-avatar" style="background:${p.color}20;color:${p.color}">${escHtml(p.name.charAt(0).toUpperCase())}</div>`;

  function render() {
    const pa = players[duelA];
    const pb = players[duelB];
    const d = computeDuel(sessionData, duelA, duelB, useKr);
    const decided = d.winsA + d.winsB;
    const shareA = decided > 0 ? (d.winsA / decided) * 100 : 50;
    const lead = d.winsA > d.winsB ? 'a' : d.winsB > d.winsA ? 'b' : '';

    const row = (label, va, vb, betterA, betterB) => `
      <div class="duel-row">
        <span class="duel-val ${betterA ? 'is-better' : ''}">${va}</span>
        <span class="duel-label">${label}</span>
        <span class="duel-val ${betterB ? 'is-better' : ''}">${vb}</span>
      </div>`;

    const body = d.sessions === 0
      ? `<p class="duel-empty">${escHtml(pa.name)} och ${escHtml(pb.name)} har inte spelat någon session ihop än.</p>`
      : `
        <div class="duel-score">
          <div class="duel-side ${lead === 'a' ? 'is-lead' : ''}">${avatar(pa)}</div>
          <div class="duel-tally">
            <span class="duel-num">${d.winsA}</span><span class="duel-dash">–</span><span class="duel-num">${d.winsB}</span>
            <span class="duel-sub">${d.sessions} ${d.sessions === 1 ? 'session' : 'sessioner'} ihop${d.ties ? ` · ${d.ties} lika` : ''}</span>
          </div>
          <div class="duel-side ${lead === 'b' ? 'is-lead' : ''}">${avatar(pb)}</div>
        </div>
        <div class="duel-bar" role="img" aria-label="${escHtml(pa.name)} ${d.winsA} vinster, ${escHtml(pb.name)} ${d.winsB} vinster">
          <span style="width:${shareA}%;background:${pa.color}"></span>
          <span style="width:${100 - shareA}%;background:${pb.color}"></span>
        </div>
        <div class="duel-rows">
          ${row('Resultat ihop', fmt(d.sumA), fmt(d.sumB), d.sumA > d.sumB, d.sumB > d.sumA)}
          ${row('Snitt/session', fmt(d.sumA / d.sessions), fmt(d.sumB / d.sessions), d.sumA > d.sumB, d.sumB > d.sumA)}
          ${row('Bästa runda', d.bestA > 0 ? fmt(d.bestA) : '–', d.bestB > 0 ? fmt(d.bestB) : '–', (d.bestA || 0) > (d.bestB || 0), (d.bestB || 0) > (d.bestA || 0))}
        </div>`;

    el.innerHTML = `
      <div class="duel-pickers">
        <select class="duel-select" data-side="a" aria-label="Spelare 1">${options(duelA)}</select>
        <span class="duel-vs">vs</span>
        <select class="duel-select" data-side="b" aria-label="Spelare 2">${options(duelB)}</select>
      </div>
      ${body}
    `;

    el.querySelectorAll('.duel-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const val = sel.value;
        if (sel.dataset.side === 'a') {
          if (val === duelB) duelB = duelA; // byt plats om samma spelare valts
          duelA = val;
        } else {
          if (val === duelA) duelA = duelB;
          duelB = val;
        }
        render();
      });
    });
  }

  render();
}

// ===== STATS CHART UNIT =====

export function getStatsUnitMode() {
  return statsUnitMode;
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
