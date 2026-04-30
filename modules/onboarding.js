/**
 * onboarding.js – Tooltip-rundtur för nya gruppmedlemmar
 */

const STORAGE_KEY = 'blackbook_onboarded_keys';

function getOnboardedKeys() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function makeKey(groupCode, playerId) {
  return `${groupCode}:${playerId}`;
}

function markGroupOnboarded(groupCode, playerId) {
  const keys = getOnboardedKeys();
  const key = makeKey(groupCode, playerId);
  if (!keys.includes(key)) {
    keys.push(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  }
}

function isGroupOnboarded(groupCode, playerId) {
  return getOnboardedKeys().includes(makeKey(groupCode, playerId));
}

const STEPS = [
  {
    selector: null,
    position: 'center',
    icon: '♠',
    title: 'Välkommen till Black Book',
    body: 'Din pokergrupps skuldboken. Här håller vi koll på vem som är skyldig vem – alltid uppdaterat i realtid.',
  },
  {
    selector: '#balances-list',
    position: 'below',
    icon: '⚖',
    title: 'Saldo',
    body: 'Här ser du varje spelares nettosaldo. Grönt = du har pengar att få. Rött = du är skyldig.',
  },
  {
    selector: '#section-settlements',
    position: 'below',
    icon: '💸',
    title: 'Uppgörelse',
    body: 'Appen räknar ut så få betalningar som möjligt. Tryck här för att se vem som betalar vem – och bekräfta när det är gjort.',
  },
  {
    selector: '#fab-new-session',
    position: 'above',
    icon: '+',
    title: 'Starta session',
    body: 'Tryck på + för att starta en ny pokerkväll. Du väljer vilka spelare som är med och ger sessionen ett namn.',
  },
  {
    selector: '#fab-new-session',
    position: 'above',
    icon: '🎯',
    title: 'Poäng eller kronor?',
    body: 'Sätt ett poängvärde (t.ex. 10 kr) så räknar appen om alla poäng till kronor. Lämnar du det tomt visas bara poäng (p).',
  },
  {
    selector: '.nav-btn[data-screen="session"]',
    position: 'above',
    icon: '♠',
    title: 'Aktiv session',
    body: 'Under en session registrerar du ronder. Ange vad varje spelare vinner eller förlorar – summan måste alltid bli noll.',
  },
  {
    selector: '.nav-btn[data-screen="stats"]',
    position: 'above',
    icon: '📊',
    title: 'Statistik',
    body: 'Se varje spelares totaler, vinster och förluster över tid. Perfekt för att hålla koll på säsongens bästa spelare.',
  },
  {
    selector: '.nav-btn[data-screen="history"]',
    position: 'above',
    icon: '📋',
    title: 'Historik',
    body: 'Alla avslutade sessioner sparas här. Du kan alltid gå tillbaka och se detaljer från en specifik kväll.',
  },
];

let currentStep = 0;
let overlayEl = null;
let tooltipEl = null;
let spotlightEl = null;
let stepDots = null;
let activeGroupCode = null;
let activePlayerId = null;
let resizeObserver = null;

export function startOnboarding(groupCode, playerId) {
  if (isGroupOnboarded(groupCode, playerId)) return;
  activeGroupCode = groupCode;
  activePlayerId = playerId;
  currentStep = 0;
  buildOverlay();
  showStep(0);
}

function buildOverlay() {
  // Cleanup any existing
  destroyOverlay();

  overlayEl = document.createElement('div');
  overlayEl.className = 'ob-overlay';
  overlayEl.innerHTML = `
    <div class="ob-backdrop"></div>
    <div class="ob-spotlight"></div>
    <div class="ob-tooltip">
      <div class="ob-tooltip-header">
        <span class="ob-icon"></span>
        <span class="ob-step-count"></span>
      </div>
      <h3 class="ob-title"></h3>
      <p class="ob-body"></p>
      <div class="ob-footer">
        <button class="ob-btn-skip">Hoppa över</button>
        <div class="ob-dots"></div>
        <button class="ob-btn-next">Nästa →</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);
  spotlightEl = overlayEl.querySelector('.ob-spotlight');
  tooltipEl = overlayEl.querySelector('.ob-tooltip');
  stepDots = overlayEl.querySelector('.ob-dots');

  overlayEl.querySelector('.ob-btn-skip').addEventListener('click', finishOnboarding);
  overlayEl.querySelector('.ob-btn-next').addEventListener('click', nextStep);

  // Dots
  stepDots.innerHTML = STEPS.map((_, i) =>
    `<span class="ob-dot" data-i="${i}"></span>`
  ).join('');
  stepDots.querySelectorAll('.ob-dot').forEach(dot => {
    dot.addEventListener('click', () => showStep(+dot.dataset.i));
  });

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlayEl.classList.add('ob-visible'));
  });
}

function showStep(index) {
  currentStep = index;
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // Update text content
  overlayEl.querySelector('.ob-icon').textContent = step.icon;
  overlayEl.querySelector('.ob-step-count').textContent = `${index + 1} / ${STEPS.length}`;
  overlayEl.querySelector('.ob-title').textContent = step.title;
  overlayEl.querySelector('.ob-body').textContent = step.body;

  const nextBtn = overlayEl.querySelector('.ob-btn-next');
  nextBtn.textContent = isLast ? 'Kom igång ✓' : 'Nästa →';
  if (isLast) nextBtn.classList.add('ob-btn-next--last');
  else nextBtn.classList.remove('ob-btn-next--last');

  // Dots
  stepDots.querySelectorAll('.ob-dot').forEach((dot, i) => {
    dot.classList.toggle('ob-dot--active', i === index);
  });

  // Tooltip entrance animation
  tooltipEl.classList.remove('ob-tooltip-enter');
  void tooltipEl.offsetWidth;
  tooltipEl.classList.add('ob-tooltip-enter');

  // Position spotlight + tooltip
  positionStep(step);
}

function positionStep(step) {
  const target = step.selector ? document.querySelector(step.selector) : null;

  if (!target || step.position === 'center') {
    // Center mode – no spotlight
    spotlightEl.style.opacity = '0';
    tooltipEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      max-width: min(340px, 90vw);
    `;
    return;
  }

  const rect = target.getBoundingClientRect();
  const pad = 10;

  // Spotlight
  spotlightEl.style.cssText = `
    opacity: 1;
    left: ${rect.left - pad}px;
    top: ${rect.top - pad}px;
    width: ${rect.width + pad * 2}px;
    height: ${rect.height + pad * 2}px;
    border-radius: 12px;
  `;

  // Tooltip positioning
  const tooltipW = Math.min(320, window.innerWidth * 0.88);
  const tooltipH = 220; // estimate

  let left = rect.left + rect.width / 2 - tooltipW / 2;
  let top;
  let arrowPos = 'none';

  if (step.position === 'below') {
    top = rect.bottom + 18;
    arrowPos = 'top';
  } else {
    top = rect.top - tooltipH - 18;
    arrowPos = 'bottom';
    if (top < 10) {
      top = rect.bottom + 18;
      arrowPos = 'top';
    }
  }

  // Clamp horizontally
  left = Math.max(12, Math.min(left, window.innerWidth - tooltipW - 12));

  tooltipEl.dataset.arrow = arrowPos;
  tooltipEl.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: ${tooltipW}px;
    transform: none;
  `;
}

function nextStep() {
  if (currentStep < STEPS.length - 1) {
    showStep(currentStep + 1);
  } else {
    finishOnboarding();
  }
}

function finishOnboarding() {
  markGroupOnboarded(activeGroupCode, activePlayerId);
  overlayEl.classList.add('ob-hiding');
  overlayEl.addEventListener('animationend', destroyOverlay, { once: true });
}

function destroyOverlay() {
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  spotlightEl = null;
  tooltipEl = null;
}
