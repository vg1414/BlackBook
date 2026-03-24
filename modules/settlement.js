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
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const payment = Math.min(creditors[i].amount, debtors[j].amount);
    if (payment > 0) transactions.push({ from: debtors[j].id, to: creditors[i].id, amount: payment });
    creditors[i].amount -= payment;
    debtors[j].amount -= payment;
    if (creditors[i].amount === 0) i++;
    if (debtors[j].amount === 0) j++;
  }

  return transactions;
}

export function sekToOre(sek) {
  return Math.round(parseFloat(sek) * 100);
}

export function oreToSek(ore) {
  const abs = Math.abs(ore);
  return (ore < 0 ? '-' : '') + (abs / 100).toFixed(0) + ' kr';
}

export function formatAmount(ore) {
  if (ore === 0) return '0 kr';
  return (ore > 0 ? '+' : '-') + (Math.abs(ore) / 100).toFixed(0) + ' kr';
}
