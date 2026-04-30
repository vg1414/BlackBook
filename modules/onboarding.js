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
  const [p0, p1, p2] = players;

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
          <button class="btn-text btn-danger" id="ob-demo-end" style="pointer-events:none">Avsluta session</button>
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
            <div class="round-row round-latest">
              <button class="btn-undo-round" id="ob-demo-undo" title="Ångra senaste">↩</button>
              <span class="round-entry">${p0.name} +20</span>
              <span class="round-entry">${p1.name} −10</span>
              <span class="round-entry">${p2.name} −10</span>
            </div>
            <div class="round-row round-old">
              <span class="round-entry">${p1.name} +15</span>
              <span class="round-entry">${p0.name} −10</span>
              <span class="round-entry">${p2.name} −5</span>
            </div>
            <div class="round-row round-old">
              <span class="round-entry">${p2.name} +30</span>
              <span class="round-entry">${p0.name} −20</span>
              <span class="round-entry">${p1.name} −10</span>
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
    selector: '#btn-toggle-settlements',
    position: 'above',
    icon: '💸',
    title: 'Uppgörelse',
    body: 'Appen räknar ut så få betalningar som möjligt. Tryck här för att se vem som betalar vem – och bekräfta när det är gjort.',
    onEnter: () => {
      const s = document.getElementById('section-settlements');
      if (s) { s.style.display = 'block'; s.dataset.obForced = '1'; }
    },
    onLeave: () => {
      const s = document.getElementById('section-settlements');
      if (s?.dataset.obForced) { s.style.display = 'none'; delete s.dataset.obForced; }
    },
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
    body: 'Se hur spelarna ligger till under sessionens gång – diagram med ackumulerade resultat.',
  },
  {
    selector: '#ob-demo-settings',
    position: 'below',
    icon: '⚙',
    title: 'Inställningar & gruppkod',
    body: 'Här hittar du sessionsinställningar och gruppkoden. Kopiera och dela länken så kan vänner gå med direkt.',
  },
  {
    selector: '#ob-demo-end',
    position: 'below',
    icon: '🏁',
    title: 'Avsluta session',
    body: 'När sessionen är slut trycker du här. Resultaten låses och saldon uppdateras – inga fler ändringar kan göras.',
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
    body: 'Alla avslutade sessioner sparas här. Du kan alltid gå tillbaka och se detaljer från en specifik session.',
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
        <div class="ob-dots"></div>
        <div class="ob-nav-row">
          <button class="ob-btn-skip">Hoppa över</button>
          <div class="ob-nav-btns">
            <button class="ob-btn-prev">← Föregående</button>
            <button class="ob-btn-next">Nästa →</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);
  spotlightEl = overlayEl.querySelector('.ob-spotlight');
  tooltipEl = overlayEl.querySelector('.ob-tooltip');
  stepDots = overlayEl.querySelector('.ob-dots');

  overlayEl.querySelector('.ob-btn-skip').addEventListener('click', finishOnboarding);
  overlayEl.querySelector('.ob-btn-prev').addEventListener('click', prevStep);
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

  const prevBtn = overlayEl.querySelector('.ob-btn-prev');
  prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';

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
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(340, vw - 32);
    const h = tooltipEl.offsetHeight || 180;
    const l = Math.round((vw - w) / 2);
    const t = Math.round((vh - h) / 2);
    tooltipEl.style.cssText = `
      position: fixed;
      left: ${l}px;
      top: ${t}px;
      width: ${w}px;
      transform: none;
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

function prevStep() {
  if (currentStep > 0) showStep(currentStep - 1);
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

// ── Lobby guide ───────────────────────────────────────────────────────────────

const LOBBY_GUIDE_KEY = 'blackbook_lobby_guided_v1';

const LOBBY_STEPS = [
  {
    selector: null,
    position: 'center',
    icon: '♠',
    title: 'Välkommen till Black Book',
    body: 'Skuldboken för din spelgrupp. Håll koll på vem som är skyldig vem – i realtid på alla enheter.',
  },
  {
    selector: '#btn-create',
    position: 'above',
    icon: '✦',
    title: 'Skapa en grupp',
    body: 'Är du den som samlar gruppen? Skapa en ny grupp så får du en unik gruppkod.',
  },
  {
    selector: '#btn-join',
    position: 'above',
    icon: '→',
    title: 'Gå med i en grupp',
    body: 'Har du fått en gruppkod? Skriv in den här och välj ditt namn för att ansluta.',
  },
  {
    selector: null,
    position: 'center',
    icon: '🔑',
    title: 'Dela gruppkoden',
    body: 'Skicka gruppkoden till alla som ska vara med. De ansluter på sina egna enheter och ser allt i realtid.',
  },
];

let lobbyOverlayEl = null;
let lobbyTooltipEl = null;
let lobbySpotlightEl = null;
let lobbyDots = null;
let lobbyStep = 0;

export function startLobbyGuide() {
  if (localStorage.getItem(LOBBY_GUIDE_KEY)) return;
  lobbyStep = 0;
  buildLobbyOverlay();
  showLobbyStep(0);
}

function buildLobbyOverlay() {
  if (lobbyOverlayEl) { lobbyOverlayEl.remove(); lobbyOverlayEl = null; }

  lobbyOverlayEl = document.createElement('div');
  lobbyOverlayEl.className = 'ob-overlay';
  lobbyOverlayEl.innerHTML = `
    <div class="ob-spotlight"></div>
    <div class="ob-tooltip">
      <div class="ob-tooltip-header">
        <span class="ob-icon"></span>
        <span class="ob-step-count"></span>
      </div>
      <h3 class="ob-title"></h3>
      <p class="ob-body"></p>
      <div class="ob-footer">
        <div class="ob-dots"></div>
        <div class="ob-nav-row">
          <button class="ob-btn-skip">Hoppa över</button>
          <div class="ob-nav-btns">
            <button class="ob-btn-prev">← Föregående</button>
            <button class="ob-btn-next">Nästa →</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(lobbyOverlayEl);
  lobbySpotlightEl = lobbyOverlayEl.querySelector('.ob-spotlight');
  lobbyTooltipEl = lobbyOverlayEl.querySelector('.ob-tooltip');
  lobbyDots = lobbyOverlayEl.querySelector('.ob-dots');

  lobbyOverlayEl.querySelector('.ob-btn-skip').addEventListener('click', finishLobbyGuide);
  lobbyOverlayEl.querySelector('.ob-btn-prev').addEventListener('click', () => { if (lobbyStep > 0) showLobbyStep(lobbyStep - 1); });
  lobbyOverlayEl.querySelector('.ob-btn-next').addEventListener('click', () => {
    if (lobbyStep < LOBBY_STEPS.length - 1) showLobbyStep(lobbyStep + 1);
    else finishLobbyGuide();
  });

  lobbyDots.innerHTML = LOBBY_STEPS.map((_, i) => `<span class="ob-dot" data-i="${i}"></span>`).join('');
  lobbyDots.querySelectorAll('.ob-dot').forEach(dot => {
    dot.addEventListener('click', () => showLobbyStep(+dot.dataset.i));
  });

  requestAnimationFrame(() => requestAnimationFrame(() => lobbyOverlayEl.classList.add('ob-visible')));
}

function showLobbyStep(index) {
  lobbyStep = index;
  const step = LOBBY_STEPS[index];
  const isLast = index === LOBBY_STEPS.length - 1;

  lobbyOverlayEl.querySelector('.ob-icon').textContent = step.icon;
  lobbyOverlayEl.querySelector('.ob-step-count').textContent = `${index + 1} / ${LOBBY_STEPS.length}`;
  lobbyOverlayEl.querySelector('.ob-title').textContent = step.title;
  lobbyOverlayEl.querySelector('.ob-body').textContent = step.body;

  const nextBtn = lobbyOverlayEl.querySelector('.ob-btn-next');
  nextBtn.textContent = isLast ? 'Kom igång ✓' : 'Nästa →';
  if (isLast) nextBtn.classList.add('ob-btn-next--last');
  else nextBtn.classList.remove('ob-btn-next--last');

  lobbyOverlayEl.querySelector('.ob-btn-prev').style.visibility = index === 0 ? 'hidden' : 'visible';

  lobbyDots.querySelectorAll('.ob-dot').forEach((dot, i) => {
    dot.classList.toggle('ob-dot--active', i === index);
  });

  const preW = Math.min(320, window.innerWidth * 0.92);
  lobbyTooltipEl.style.cssText = `position:fixed; top:0; left:0; width:${preW}px; visibility:hidden;`;

  requestAnimationFrame(() => {
    positionLobbyStep(step);
    lobbyTooltipEl.classList.remove('ob-tooltip-enter');
    void lobbyTooltipEl.offsetWidth;
    lobbyTooltipEl.classList.add('ob-tooltip-enter');
  });
}

function positionLobbyStep(step) {
  const target = step.selector ? document.querySelector(step.selector) : null;

  if (!target || step.position === 'center') {
    lobbySpotlightEl.style.opacity = '0';
    lobbyTooltipEl.dataset.arrow = 'none';
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(340, vw - 32);
    const h = lobbyTooltipEl.offsetHeight || 180;
    lobbyTooltipEl.style.cssText = `
      position:fixed; left:${Math.round((vw-w)/2)}px; top:${Math.round((vh-h)/2)}px;
      width:${w}px; transform:none; visibility:visible;
    `;
    return;
  }

  const rect = target.getBoundingClientRect();
  const pad = 10;
  lobbySpotlightEl.style.cssText = `
    opacity:1; left:${rect.left-pad}px; top:${rect.top-pad}px;
    width:${rect.width+pad*2}px; height:${rect.height+pad*2}px; border-radius:12px;
  `;

  const vw = window.innerWidth, vh = window.innerHeight;
  const margin = 12, gap = 14;
  const tooltipW = Math.min(320, vw * 0.92);
  const tooltipH = lobbyTooltipEl.offsetHeight || 180;
  let left = rect.left + rect.width / 2 - tooltipW / 2;
  let top, arrowPos;

  if (step.position === 'below' || rect.top - margin < tooltipH + gap) {
    top = rect.bottom + gap;
    arrowPos = 'top';
    if (top + tooltipH > vh - margin) { top = Math.max(margin, (vh-tooltipH)/2); arrowPos = 'none'; }
  } else {
    top = rect.top - tooltipH - gap;
    arrowPos = 'bottom';
    if (top < margin) { top = rect.bottom + gap; arrowPos = 'top'; }
  }

  left = Math.max(margin, Math.min(left, vw - tooltipW - margin));
  top  = Math.max(margin, Math.min(top,  vh - tooltipH - margin));

  lobbyTooltipEl.dataset.arrow = arrowPos;
  lobbyTooltipEl.style.cssText = `
    position:fixed; left:${left}px; top:${top}px; width:${tooltipW}px; transform:none;
  `;
}

function finishLobbyGuide() {
  localStorage.setItem(LOBBY_GUIDE_KEY, '1');
  lobbyOverlayEl.classList.add('ob-hiding');
  lobbyOverlayEl.addEventListener('animationend', () => {
    lobbyOverlayEl?.remove(); lobbyOverlayEl = null;
    lobbyTooltipEl = null; lobbySpotlightEl = null;
  }, { once: true });
}
