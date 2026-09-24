/**
 * countup.js – Rullande siffror
 *
 * Element med attributet data-roll="<nyckel>" minns sitt senaste värde (per nyckel).
 * När listan ritas om med ett nytt värde rullar siffran från det gamla till det nya.
 * Första gången en nyckel syns visas värdet direkt, utan animation.
 */

const lastValues = new Map();
const DURATION = 750;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Delar upp t.ex. "+1250 kr" → { prefix:'', signed:true, value:1250, decimals:0, suffix:' kr' }
function parse(text) {
  const m = String(text).match(/^([^\d+\-−]*)([+\-−]?)(\d+(?:[.,]\d+)?)(.*)$/s);
  if (!m) return null;
  const [, prefix, sign, num, suffix] = m;
  const decimals = (num.split(/[.,]/)[1] || '').length;
  let value = parseFloat(num.replace(',', '.'));
  if (sign === '-' || sign === '−') value = -value;
  // Saldon rullar ofta ner till "0 kr" (utan tecken) – visa ändå +/- under rullningen
  const signed = sign !== '' || (value === 0 && /^\s*(kr|p)\s*$/.test(suffix));
  return { prefix, signed, value, decimals, suffix };
}

function format(p, v) {
  const rounded = Number(v.toFixed(p.decimals));
  let sign = '';
  if (rounded < 0) sign = '-';
  else if (p.signed && rounded > 0) sign = '+';
  return p.prefix + sign + Math.abs(rounded).toFixed(p.decimals) + p.suffix;
}

const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

function animate(el, parsed, from, finalText) {
  const to = parsed.value;
  el.classList.remove('num-rise', 'num-fall');
  void el.offsetWidth; // starta om CSS-glöden
  el.classList.add(to > from ? 'num-rise' : 'num-fall');
  const start = performance.now();
  function step(now) {
    if (!el.isConnected) return;
    const t = Math.min((now - start) / DURATION, 1);
    el.textContent = t < 1 ? format(parsed, from + (to - from) * easeOutExpo(t)) : finalText;
    if (t < 1) requestAnimationFrame(step);
  }
  el.textContent = format(parsed, from);
  requestAnimationFrame(step);
}

/** Rulla ett element från sitt förra värde (via nyckel) eller från ett givet startvärde. */
export function rollTo(el, key, from) {
  const finalText = el.textContent;
  const parsed = parse(finalText);
  if (!parsed) { if (key) lastValues.delete(key); return; }
  const start = from ?? (key ? lastValues.get(key) : undefined);
  if (key) lastValues.set(key, parsed.value);
  if (start === undefined || start === parsed.value || reduceMotion()) return;
  animate(el, parsed, start, finalText);
}

/** Rulla alla [data-roll]-element i en container. */
export function rollAll(container) {
  if (!container) return;
  container.querySelectorAll('[data-roll]').forEach(el => rollTo(el, el.dataset.roll));
}

/** Räkna upp alla element från 0 (används när Statistik öppnas). */
export function rollFromZero(elements) {
  elements.forEach(el => rollTo(el, null, 0));
}
