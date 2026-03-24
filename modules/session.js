/**
 * session.js
 * Session logic: quick mode, buy-in mode, rebuys, cashouts
 */
import { addEntry, softDeleteEntry, closeSession } from './firebase.js';
import { sekToOre } from './settlement.js';

/**
 * Register quick-mode results for all players.
 * amounts = { playerId: kronorValue (can be negative) }
 * Validates zero-sum before writing.
 */
export async function submitQuickResults(groupCode, sessionId, amounts) {
  const entries = Object.entries(amounts);

  // Validate zero-sum (within 1 öre rounding tolerance)
  const totalOre = entries.reduce((sum, [, val]) => sum + sekToOre(val), 0);
  if (Math.abs(totalOre) > entries.length) {
    throw new Error(`Summan måste vara 0. Nuvarande summa: ${totalOre / 100} kr`);
  }

  const promises = entries
    .filter(([, val]) => sekToOre(val) !== 0)
    .map(([playerId, val]) =>
      addEntry(groupCode, {
        sessionId,
        playerId,
        amount: sekToOre(val),
        type: 'quick'
      })
    );

  await Promise.all(promises);
}

/**
 * Register a buy-in for a player
 */
export async function registerBuyin(groupCode, sessionId, playerId, kronor) {
  const ore = sekToOre(kronor);
  if (ore <= 0) throw new Error('Buy-in måste vara ett positivt belopp');
  // Buy-in is a cost → negative amount
  return addEntry(groupCode, {
    sessionId,
    playerId,
    amount: -ore,
    type: 'buyin'
  });
}

/**
 * Register a rebuy for a player
 */
export async function registerRebuy(groupCode, sessionId, playerId, kronor) {
  const ore = sekToOre(kronor);
  if (ore <= 0) throw new Error('Rebuy måste vara ett positivt belopp');
  return addEntry(groupCode, {
    sessionId,
    playerId,
    amount: -ore,
    type: 'rebuy'
  });
}

/**
 * Register cashout for a player
 * cashoutOre = final stack in öre (positive)
 */
export async function registerCashout(groupCode, sessionId, playerId, kronor) {
  const ore = sekToOre(kronor);
  if (ore < 0) throw new Error('Cashout kan inte vara negativt');
  return addEntry(groupCode, {
    sessionId,
    playerId,
    amount: ore,
    type: 'cashout'
  });
}

/**
 * Undo (soft-delete) an entry
 */
export async function undoEntry(groupCode, entryId, playerId, amount) {
  return softDeleteEntry(groupCode, entryId, playerId, amount);
}

/**
 * Close a session
 */
export async function endSession(groupCode, sessionId) {
  return closeSession(groupCode, sessionId);
}

/**
 * Calculate net result for a player in buy-in mode
 * entries = all non-deleted entries for this session + player
 * Returns öre
 */
export function calcPlayerNet(entries) {
  return entries
    .filter(e => !e.deleted)
    .reduce((sum, e) => sum + e.amount, 0);
}
