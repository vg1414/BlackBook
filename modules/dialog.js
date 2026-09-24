/**
 * dialog.js – Egen bekräftelseruta i guld/läder som ersätter window.confirm()
 *
 * goldConfirm({ title, message, okText, cancelText, danger }) → Promise<boolean>
 * Löser med true om användaren trycker på OK-knappen, annars false
 * (Avbryt, klick utanför rutan eller Escape).
 */

let overlay = null;
let resolveCurrent = null;

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function build() {
  overlay = document.createElement('div');
  overlay.className = 'gold-confirm-overlay hidden';
  overlay.innerHTML = `
    <div class="gold-confirm" role="alertdialog" aria-modal="true" aria-labelledby="gold-confirm-title" aria-describedby="gold-confirm-msg">
      <div class="gold-confirm-seal" aria-hidden="true"></div>
      <h3 class="gold-confirm-title" id="gold-confirm-title"></h3>
      <p class="gold-confirm-msg" id="gold-confirm-msg"></p>
      <div class="gold-confirm-actions">
        <button type="button" class="btn btn-secondary" data-answer="no"></button>
        <button type="button" class="btn btn-primary" data-answer="yes"></button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    const btn = e.target.closest('[data-answer]');
    if (btn) close(btn.dataset.answer === 'yes');
    else if (e.target === overlay) close(false);
  });

  document.addEventListener('keydown', e => {
    if (!resolveCurrent) return;
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
  });
}

function close(answer) {
  if (!resolveCurrent) return;
  const resolve = resolveCurrent;
  resolveCurrent = null;
  overlay.classList.add('closing');
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('closing');
  }, 180);
  resolve(answer);
}

export function goldConfirm({ title, message = '', okText = 'OK', cancelText = 'Avbryt', danger = false }) {
  if (!overlay) build();
  // Om en ruta redan är öppen: avbryt den först
  if (resolveCurrent) close(false);

  overlay.querySelector('.gold-confirm-title').innerHTML = escHtml(title);
  const msgEl = overlay.querySelector('.gold-confirm-msg');
  msgEl.textContent = message;
  msgEl.style.display = message ? '' : 'none';

  const okBtn = overlay.querySelector('[data-answer="yes"]');
  const cancelBtn = overlay.querySelector('[data-answer="no"]');
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;
  overlay.querySelector('.gold-confirm').classList.toggle('is-danger', danger);

  overlay.classList.remove('hidden', 'closing');
  // Fokus på Avbryt för farliga val, annars på OK
  setTimeout(() => (danger ? cancelBtn : okBtn).focus({ preventScroll: true }), 50);

  return new Promise(resolve => { resolveCurrent = resolve; });
}
