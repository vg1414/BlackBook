import { addEntry, softDeleteEntry, closeSession } from './firebase.js';
import { sekToOre } from './settlement.js';

export async function submitQuickResults(groupCode, sessionId, amounts) {
  const entries = Object.entries(amounts);
  const totalOre = entries.reduce((sum, [, val]) => sum + sekToOre(val), 0);
  if (Math.abs(totalOre) > entries.length) throw new Error(`Summan måste vara 0. Nuvarande summa: ${totalOre / 100} kr`);
  await Promise.all(entries.filter(([, val]) => sekToOre(val) !== 0).map(([playerId, val]) =>
    addEntry(groupCode, { sessionId, playerId, amount: sekToOre(val), type: 'quick' })
  ));
}

export async function registerBuyin(groupCode, sessionId, playerId, kronor) {
  const ore = sekToOre(kronor);
  if (ore <= 0) throw new Error('Buy-in måste vara ett positivt belopp');
  return addEntry(groupCode, { sessionId, playerId, amount: -ore, type: 'buyin' });
}

export async function registerRebuy(groupCode, sessionId, playerId, kronor) {
  const ore = sekToOre(kronor);
  if (ore <= 0) throw new Error('Rebuy måste vara ett positivt belopp');
  return addEntry(groupCode, { sessionId, playerId, amount: -ore, type: 'rebuy' });
}

export async function registerCashout(groupCode, sessionId, playerId, kronor) {
  const ore = sekToOre(kronor);
  if (ore < 0) throw new Error('Cashout kan inte vara negativt');
  return addEntry(groupCode, { sessionId, playerId, amount: ore, type: 'cashout' });
}

export async function undoEntry(groupCode, entryId, playerId, amount) {
  return softDeleteEntry(groupCode, entryId, playerId, amount);
}

export async function endSession(groupCode, sessionId) {
  return closeSession(groupCode, sessionId);
}
