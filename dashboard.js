const themeToggle = document.querySelector('[data-theme-toggle]');
const modalBackdrop = document.querySelector('#modal-backdrop');
const modalContent = document.querySelector('#modal-content');
const toast = document.querySelector('#toast');
let toastTimer;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0a1427' : '#f7fbff';
  try { localStorage.setItem('need-a-space-theme', theme); } catch {}
}

function showToast(message) {
  document.querySelector('#toast-message').textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function openEscrow() {
  modalContent.innerHTML = `<div class="escrow-modal"><div class="eyebrow">SOLANA ESCROW · DEMO</div><h2>Your deposit is protected.</h2><p>This simulated timeline shows how the example deposit moves through the agreement.</p><div class="escrow-visual"><div class="escrow-amount"><span class="solana-price-mark" aria-hidden="true"></span>1.10 SOL <small>Solana</small></div><div class="escrow-track"><span class="escrow-node">✓</span><span class="escrow-connector"></span><span class="escrow-node pending">⌑</span><span class="escrow-connector pending"></span><span class="escrow-node pending">✓</span></div><div class="escrow-labels"><span>Payment received</span><span>Access confirmed</span><span>Deposit returned</span></div></div></div>`;
  modalBackdrop.classList.add('open');
  modalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  modalBackdrop.setAttribute('aria-hidden', 'true');
}

applyTheme(document.documentElement.dataset.theme || 'light');
themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.querySelector('[data-connect-wallet]').addEventListener('click', () => showToast('Wallet connection is coming in the on-chain build'));
document.querySelector('[data-show-escrow]').addEventListener('click', openEscrow);
document.querySelector('[data-close-modal]').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

