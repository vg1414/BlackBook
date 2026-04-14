/**
 * settlement.js
 * Greedy algorithm to minimize number of transactions.
 * All amounts are integers (öre).
 */

/**
 * @param {Object} balances - { playerId: netAmount }
 *   Positive = owed money (kreditor)
 *   Negative = owes money (debtor)
 * @returns {Array} transactions - [{ from, to, amount }]
 */
export function minimizePayments(balances) {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([id, amount]) => ({ id, amount: -amount }))
    .sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const payment = Math.min(creditors[i].amount, debtors[j].amount);
    if (payment > 0) {
      transactions.push({
        from: debtors[j].id,
        to: creditors[i].id,
        amount: payment
      });
    }
    creditors[i].amount -= payment;
    debtors[j].amount -= payment;
    if (creditors[i].amount === 0) i++;
    if (debtors[j].amount === 0) j++;
  }

  return transactions;
}

/**
 * Convert SEK (decimal) to öre (integer)
 */
export function sekToOre(sek) {
  return Math.round(parseFloat(sek) * 100);
}

/**
 * Convert öre (integer) to SEK string
 */
export function oreToSek(ore) {
  const abs = Math.abs(ore);
  const sek = (abs / 100).toFixed(0);
  return (ore < 0 ? '-' : '') + sek + ' kr';
}

/**
 * Format amount with sign (kr)
 */
export function formatAmount(ore) {
  if (ore === 0) return '0 kr';
  const sign = ore > 0 ? '+' : '-';
  const sek = (Math.abs(ore) / 100).toFixed(0);
  return sign + sek + ' kr';
}

/**
 * Format points (stored as öre-scale integers, 1 point = 100 units)
 * pointValue: kr per poäng (optional) – if set, shows kr instead
 */
export function formatPoints(ore, pointValue) {
  const points = ore / 100;
  if (pointValue) {
    const kr = points * pointValue;
    if (kr === 0) return '0 kr';
    const sign = kr > 0 ? '+' : '-';
    return sign + Math.abs(Math.round(kr)) + ' kr';
  }
  if (points === 0) return '0 p';
  const sign = points > 0 ? '+' : '-';
  return sign + Math.abs(points) + ' p';
}
