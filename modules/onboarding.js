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

// ── Demo session overlay ──────────────────────────────────────────────────────

const DEMO_NAMES = ['Anna','Björn','Cecilia','David','Erik','Fanny','Gustav','Hanna'];
const DEMO_COLORS = ['#4a9eff','#a855f7','#f97316','#22c55e','#ec4899','#14b8a6','#f59e0b','#6366f1'];

let demoEl = null;

function randomDemoPlayers(count = 3) {
  const shuffled = [...DEMO_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((name, i) => ({ name, color: DEMO_COLORS[i % DEMO_COLORS.length] }));
}

function showDemoSession() {
  if (demoEl) return;
  const players = randomDemoPlayers(3);

  const playerRows = players.map((p, i) => `
    <div class="quick-player-row" data-demo-i="${i}">
      <div class="player-avatar" style="background:${p.color}20;color:${p.color}">${p.name.charAt(0)}</div>
      <span class="quick-player-name">${p.name}</span>
      <div class="amount-input-wrap">
        <button class="btn-sign-toggle demo-sign">+</button>
        <input class="amount-input" type="number" placeholder="0" inputmode="decimal" min="0" readonly />
      </div>
    </div>
  `).join('');

  demoEl = document.createElement('div');
  demoEl.id = 'ob-demo-session';
  demoEl.innerHTML = `
    <div class="ob-demo-inner">
      <header class="app-header">
        <button class="btn-icon" style="opacity:.4;pointer-events:none">←</button>
        <h1 class="header-title">Demo-session</h1>
        <div class="header-actions">
          <button class="btn-icon btn-icon--chart" id="ob-demo-chart">📈</button>
          <button class="btn-icon" id="ob-demo-settings">⚙</button>
          <button class="btn-text btn-danger" style="opacity:.4;pointer-events:none">Avsluta</button>
        </div>
      </header>
      <div class="screen-content session-screen-content">
        <div class="session-sticky-top">
          <div id="ob-demo-players" class="quick-players-list">${playerRows}</div>
          <div class="sum-row">
            <span class="sum-label">Summa:</span>
            <span id="ob-demo-sum" class="sum-value">0 p</span>
          </div>
          <div class="register-row">
            <button id="ob-demo-register" class="btn btn-primary btn-register">Registrera</button>
          </div>
        </div>
        <div class="session-scroll-area">
          <div class="session-rounds-list">
            <div class="round-entry">
              <span class="round-label">Rond 1</span>
              <span class="round-chips">
                <span class="chip chip--pos">Anna +20</span>
                <span class="chip chip--neg">Björn −10</span>
                <span class="chip chip--neg">Cecilia −10</span>
              </span>
              <button class="btn-undo" id="ob-demo-undo">↩ Ångra</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(demoEl);

  // Prevent inputs from doing anything real
  demoEl.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => e.preventDefault());
  });
  demoEl.querySelectorAll('.demo-sign').forEach(btn => {
    btn.addEventListener('click', e => e.stopPropagation());
  });

  requestAnimationFrame(() => demoEl.classList.add('ob-demo-visible'));
}

function hideDemoSession() {
  if (!demoEl) return;
  demoEl.classList.remove('ob-demo-visible');
  demoEl.addEventListener('transitionend', () => { demoEl?.remove(); demoEl = null; }, { once: true });
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    selector: null,
    position: 'center',
    icon: '♠',
    title: 'Välkommen till Black Book',
    body: 'Gruppens skuldbok. Här håller vi koll på vem som är skyldig vem – alltid uppdaterat i realtid.',
  },
  {
    selector: '#balances-list',
    position: 'below',
    icon: '⚖',
    title: 'Saldo',
    body: 'Här ser du varje spelares nettosaldo. Grönt = du har pengar att få. Rött = du är skyldig.',
  },
  {
    selector: null,
    position: 'center',
    icon: '💸',
    title: 'Uppgörelse',
    body: 'Appen räknar ut så få betalningar som möjligt. Tryck på uppgörelseknappen för att se vem som betalar vem – och bekräfta när det är gjort.',
  },
  {
    selector: '#fab-new-session',
    position: 'above',
    icon: '+',
    title: 'Starta session',
    body: 'Tryck på + för att starta en ny session. Du väljer vilka spelare som är med och ger sessionen ett namn.',
  },
  {
    selector: '#fab-new-session',
    position: 'above',
    icon: '🎯',
    title: 'Poäng eller kronor?',
    body: 'Sätt ett poängvärde (t.ex. 10 kr) så räknar appen om alla poäng till kronor. Lämnar du det tomt visas bara poäng (p).',
  },
  // ── Demo session steg ──
  {
    selector: '#ob-demo-players',
    position: 'below',
    icon: '✍️',
    title: 'Registrera en rond',
    body: 'Ange vad varje spelare vinner (+) eller förlorar (−) i ronden. Tryck på +/− för att växla tecken.',
    onEnter: showDemoSession,
  },
  {
    selector: '#ob-demo-sum',
    position: 'above',
    icon: '⚖',
    title: 'Summan måste bli 0',
    body: 'Vinster och förluster ska alltid ta ut varandra. Appen varnar om summan inte stämmer.',
  },
  {
    selector: '#ob-demo-undo',
    position: 'above',
    icon: '↩',
    title: 'Ångra',
    body: 'Tryckte du fel? Ångra-knappen tar bort den senaste ronden direkt.',
  },
  {
    selector: '#ob-demo-chart',
    position: 'below',
    icon: '📈',
    title: 'Sessionsgraf',
    body: 'Se hur spelarna ligger till under sessionens gång – stapeldiagram med ackumulerade resultat.',
  },
  {
    selector: '#ob-demo-settings',
    position: 'below',
    icon: '⚙',
    title: 'Inställningar & gruppkod',
    body: 'Här hittar du sessionsinställningar och gruppkoden. Kopiera och dela länken så kan vänner gå med direkt.',
    onLeave: hideDemoSession,
  },
  // ── Navigering ──
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
  destroyOverlay();

  overlayEl = document.createElement('div');
  overlayEl.className = 'ob-overlay';
  overlayEl.innerHTML = `
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

  stepDots.innerHTML = STEPS.map((_, i) =>
    `<span class="ob-dot" data-i="${i}"></span>`
  ).join('');
  stepDots.querySelectorAll('.ob-dot').forEach(dot => {
    dot.addEventListener('click', () => showStep(+dot.dataset.i));
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlayEl.classList.add('ob-visible'));
  });
}

function showStep(index) {
  const prevStep = STEPS[currentStep];
  currentStep = index;
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // onLeave for previous step
  if (prevStep?.onLeave) prevStep.onLeave();
  // onEnter for new step
  if (step.onEnter) step.onEnter();

  overlayEl.querySelector('.ob-icon').textContent = step.icon;
  overlayEl.querySelector('.ob-step-count').textContent = `${index + 1} / ${STEPS.length}`;
  overlayEl.querySelector('.ob-title').textContent = step.title;
  overlayEl.querySelector('.ob-body').textContent = step.body;

  const nextBtn = overlayEl.querySelector('.ob-btn-next');
  nextBtn.textContent = isLast ? 'Kom igång ✓' : 'Nästa →';
  if (isLast) nextBtn.classList.add('ob-btn-next--last');
  else nextBtn.classList.remove('ob-btn-next--last');

  stepDots.querySelectorAll('.ob-dot').forEach((dot, i) => {
    dot.classList.toggle('ob-dot--active', i === index);
  });

  const preW = Math.min(320, window.innerWidth * 0.92);
  tooltipEl.style.cssText = `position:fixed; top:0; left:0; width:${preW}px; visibility:hidden;`;

  // If onEnter just created the demo, wait an extra frame for it to appear in DOM
  const delay = step.onEnter ? 60 : 0;
  setTimeout(() => {
    requestAnimationFrame(() => {
      positionStep(step);
      tooltipEl.classList.remove('ob-tooltip-enter');
      void tooltipEl.offsetWidth;
      tooltipEl.classList.add('ob-tooltip-enter');
    });
  }, delay);
}

function positionStep(step) {
  const target = step.selector ? document.querySelector(step.selector) : null;

  if (!target || step.position === 'center') {
    spotlightEl.style.opacity = '0';
    tooltipEl.dataset.arrow = 'none';
    tooltipEl.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      margin: auto;
      width: calc(100vw - 32px);
      max-width: 340px;
      height: fit-content;
      visibility: visible;
    `;
    return;
  }

  const rect = target.getBoundingClientRect();
  const pad = 10;

  spotlightEl.style.cssText = `
    opacity: 1;
    left: ${rect.left - pad}px;
    top: ${rect.top - pad}px;
    width: ${rect.width + pad * 2}px;
    height: ${rect.height + pad * 2}px;
    border-radius: 12px;
  `;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;
  const gap = 14;

  const tooltipW = Math.min(320, vw * 0.92);
  const tooltipH = tooltipEl.offsetHeight || 180;

  let left = rect.left + rect.width / 2 - tooltipW / 2;
  let top;
  let arrowPos = 'none';

  const spaceAbove = rect.top - margin;

  if (step.position === 'below' || spaceAbove < tooltipH + gap) {
    top = rect.bottom + gap;
    arrowPos = 'top';
    if (top + tooltipH > vh - margin) {
      top = Math.max(margin, (vh - tooltipH) / 2);
      arrowPos = 'none';
    }
  } else {
    top = rect.top - tooltipH - gap;
    arrowPos = 'bottom';
    if (top < margin) {
      top = rect.bottom + gap;
      arrowPos = 'top';
    }
  }

  left = Math.max(margin, Math.min(left, vw - tooltipW - margin));
  top = Math.max(margin, Math.min(top, vh - tooltipH - margin));

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
  // Ensure demo is cleaned up if user skips mid-demo
  hideDemoSession();
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
