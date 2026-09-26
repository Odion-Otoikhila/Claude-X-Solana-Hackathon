const config = window.NEEDASPACE_CONFIG;
const chain = window.NeedASpaceChain;
const themeToggle = document.querySelector('[data-theme-toggle]');
const walletLabel = document.querySelector('[data-wallet-label]');
const modalBackdrop = document.querySelector('#modal-backdrop');
const modalContent = document.querySelector('#modal-content');
const dashboardMain = document.querySelector('.dashboard-main');
const toast = document.querySelector('#toast');
let activeBooking = null;
let activeListing = null;
let toastTimer;

const perSol = () => Number(config.DEMO_USDC_PER_SOL || 150);
const solLabel = (usdc, digits = 2) => `${(Number(usdc) / perSol()).toFixed(digits)} SOL`;
const apiUrl = path => `${config.API_BASE}${path}`;

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

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
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function imageStyle(listing) {
  return listing?.image ? `style="background-image:url('${listing.image}');background-size:cover;background-position:center"` : '';
}

function renderDashboard() {
  if (!activeBooking || !activeListing) {
    dashboardMain.innerHTML = `<div class="panel-header"><div><p class="muted-label">LIVE BOOKING</p><h3>No active booking yet</h3></div><span class="agreement-status">Ready</span></div><p class="dashboard-empty">Browse a space and complete a booking to start tracking it here.</p><a class="dashboard-back" href="index.html#explore">Browse spaces →</a>`;
    return;
  }

  const fundExplorer = chain.explorerUrl(activeBooking.transaction_signature);
  const releaseExplorer = chain.explorerUrl(activeBooking.release_signature);
  const ready = activeBooking.status === 'READY_TO_RELEASE';
  const completed = activeBooking.status === 'COMPLETED';

  dashboardMain.innerHTML = `<div class="panel-header">
      <div><p class="muted-label">BOOKING #${activeBooking.id}</p><h3>${activeListing.title}</h3></div>
      <span class="agreement-status">● ${activeBooking.status}</span>
    </div>
    <div class="agreement-info">
      <div class="agreement-photo" ${imageStyle(activeListing)}></div>
      <div class="agreement-details">
        <p>${activeListing.location}</p>
        <strong>${solLabel(activeListing.price_usdc)} <small>monthly rent</small></strong>
        <p>Deposit: ${solLabel(activeListing.deposit_usdc)}</p>
        <p>Rent and deposit remain protected until both parties confirm.</p>
      </div>
    </div>
    <div class="escrow-status"><div class="escrow-status-icon">⌑</div><div><p>Escrow address</p><strong>${activeBooking.escrow_address || 'Waiting…'}</strong></div>${fundExplorer ? `<a class="tiny-button" target="_blank" rel="noreferrer" href="${fundExplorer}">Explorer ↗</a>` : ''}</div>
    <div class="booking-actions">
      <button class="outline-button" data-move-in ${completed ? 'disabled' : ''}>Add move-in evidence</button>
      <button class="outline-button" data-move-out ${completed ? 'disabled' : ''}>Add move-out evidence</button>
      <button class="outline-button" data-confirm-renter ${activeBooking.renter_confirmed || completed ? 'disabled' : ''}>${activeBooking.renter_confirmed ? 'Renter ✓' : 'Confirm renter'}</button>
      <button class="outline-button" data-confirm-host ${activeBooking.host_confirmed || completed ? 'disabled' : ''}>${activeBooking.host_confirmed ? 'Host ✓' : 'Confirm host'}</button>
      <button class="primary-button" data-release ${!ready ? 'disabled' : ''}>${completed ? 'Completed ✓' : 'Release booking'}</button>
    </div>
    ${releaseExplorer ? `<p class="explorer-row"><a href="${releaseExplorer}" target="_blank" rel="noreferrer">View payout on Solana Explorer ↗</a></p>` : ''}
    ${config.CHAIN_MODE === 'demo' ? '<p class="demo-warning">Demo mode is active, so on-chain money movement is simulated.</p>' : ''}`;

  dashboardMain.querySelector('[data-move-in]')?.addEventListener('click', () => patchEvidence('move_in_photo'));
  dashboardMain.querySelector('[data-move-out]')?.addEventListener('click', () => patchEvidence('move_out_photo'));
  dashboardMain.querySelector('[data-confirm-renter]')?.addEventListener('click', () => confirmParty('renter'));
  dashboardMain.querySelector('[data-confirm-host]')?.addEventListener('click', () => confirmParty('host'));
  dashboardMain.querySelector('[data-release]')?.addEventListener('click', releaseBooking);
}

async function patchEvidence(kind) {
  const label = kind === 'move_in_photo' ? 'move-in' : 'move-out';
  const value = prompt(`Enter a ${label} image URL/path for the demo:`, `${label}.jpg`);
  if (!value) return;
  try {
    activeBooking = await api(`/api/bookings/${activeBooking.id}/evidence`, {
      method: 'PATCH',
      body: JSON.stringify({ [kind]: value }),
    });
    renderDashboard();
    showToast(`${label} evidence saved`);
  } catch (error) { showToast(error.message); }
}

async function confirmParty(party) {
  try {
    activeBooking = await api(`/api/bookings/${activeBooking.id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({ party }),
    });
    renderDashboard();
    showToast(`${party} confirmation saved`);
  } catch (error) { showToast(error.message); }
}

async function releaseBooking() {
  try {
    const chainResult = await chain.releaseBooking(activeBooking);
    activeBooking = await api(`/api/bookings/${activeBooking.id}/released`, {
      method: 'PATCH',
      body: JSON.stringify({ release_signature: chainResult.releaseSignature }),
    });
    renderDashboard();
    showToast('Booking completed');
  } catch (error) { showToast(error.message); }
}

async function connectWallet() {
  try {
    const address = await chain.connectWallet();
    walletLabel.textContent = `${address.slice(0, 4)}...${address.slice(-4)}`;
    showToast('Phantom connected');
  } catch (error) { showToast(error.message); }
}

async function loadDashboard() {
  applyTheme(document.documentElement.dataset.theme || 'light');
  try {
    const [bookings, listings] = await Promise.all([api('/api/bookings'), api('/api/listings')]);
    activeBooking = bookings[0] || null;
    activeListing = activeBooking ? listings.find(item => item.id === activeBooking.listing_id) || null : null;
  } catch (error) {
    showToast('Booking details are temporarily unavailable');
  }
  renderDashboard();
}

function openEscrow() {
  modalContent.innerHTML = `<div class="escrow-modal"><div class="eyebrow">SOLANA ESCROW</div><h2>Your deposit is protected.</h2><p>The agreement keeps the deposit protected until both parties confirm completion.</p><div class="escrow-visual"><div class="escrow-amount">1.10 SOL <small>Solana</small></div><div class="escrow-track"><span class="escrow-node">✓</span><span class="escrow-connector"></span><span class="escrow-node pending">⌑</span><span class="escrow-connector pending"></span><span class="escrow-node pending">✓</span></div><div class="escrow-labels"><span>Payment received</span><span>Access confirmed</span><span>Deposit returned</span></div></div></div>`;
  modalBackdrop.classList.add('open');
  modalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  modalBackdrop.setAttribute('aria-hidden', 'true');
}

themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.querySelector('[data-connect-wallet]').addEventListener('click', connectWallet);
document.querySelector('[data-show-escrow]').addEventListener('click', openEscrow);
document.querySelector('[data-close-modal]').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

loadDashboard();
