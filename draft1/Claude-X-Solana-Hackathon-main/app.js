const config = window.NEEDASPACE_CONFIG;
const chain = window.NeedASpaceChain;

const listingMeta = {
  Dublin: { area: 'Rathmines', size: '18 m²', access: '24/7 access', rating: '4.9', tag: 'Popular', lat: 53.3206, lng: -6.2655 },
  Cork: { area: 'Douglas', size: '10 m²', access: 'Keypad access', rating: '4.8', tag: 'Best value', lat: 51.8737, lng: -8.4358 },
  Galway: { area: 'Salthill', size: '14 m²', access: 'Daytime access', rating: '5.0', tag: 'New space', lat: 53.2601, lng: -9.0966 },
  Limerick: { area: 'Castletroy', size: '12 m²', access: '24/7 access', rating: '4.7', tag: 'Flexible', lat: 52.6734, lng: -8.5673 },
  Waterford: { area: 'City centre', size: '9 m²', access: 'Daytime access', rating: '4.9', tag: 'Central', lat: 52.2593, lng: -7.1101 },
  Kilkenny: { area: 'City centre', size: '15 m²', access: '24/7 access', rating: '4.8', tag: 'Easy access', lat: 52.6541, lng: -7.2448 },
};

let listings = [];
let activeBooking = null;
let activeListing = null;
let walletAddress = null;
let toastTimer;
let selectedCity = null;
let activeFilter = 'All spaces';
let map;
const markers = new Map();

const grid = document.querySelector('#listing-grid');
const modalBackdrop = document.querySelector('#modal-backdrop');
const modalContent = document.querySelector('#modal-content');
const toast = document.querySelector('#toast');
const searchInput = document.querySelector('#search-input');
const cityPanel = document.querySelector('#selected-city');
const resultsLabel = document.querySelector('#results-label');
const themeToggle = document.querySelector('[data-theme-toggle]');
const walletLabel = document.querySelector('[data-wallet-label]');

function apiUrl(path) {
  return `${config.API_BASE}${path}`;
}

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let body = null;
  try { body = await response.json(); } catch {}

  if (!response.ok) {
    throw new Error(body?.error || `API request failed (${response.status})`);
  }

  return body;
}

function cityFromLocation(location = '') {
  const parts = location.split(',').map(part => part.trim()).filter(Boolean);
  return parts.at(-1) || location || 'Ireland';
}

function decorateListing(raw, index) {
  const city = cityFromLocation(raw.location);
  const meta = listingMeta[city] || {
    area: raw.location,
    size: 'Flexible size',
    access: 'Contact host',
    rating: 'New',
    tag: 'New space',
    lat: 53.3498 + index * 0.01,
    lng: -6.2603 + index * 0.01,
  };

  return {
    ...raw,
    city,
    area: meta.area,
    size: meta.size,
    access: meta.access,
    rating: meta.rating,
    tag: meta.tag,
    lat: meta.lat,
    lng: meta.lng,
    price: Number(raw.price_usdc),
    deposit: Number(raw.deposit_usdc),
  };
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0a1427' : '#f7fbff';
  try { localStorage.setItem('need-a-space-theme', theme); } catch {}
}

function shortWallet(address) {
  return address ? `${address.slice(0, 4)}...${address.slice(-4)}` : 'Connect wallet';
}

function showToast(message) {
  document.querySelector('#toast-message').textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function openModal(content) {
  modalContent.innerHTML = content;
  modalBackdrop.classList.add('open');
  modalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  modalBackdrop.setAttribute('aria-hidden', 'true');
}

function imageStyle(item) {
  return item.image ? `style="background-image:linear-gradient(#0000,#0000),url('${item.image}');background-size:cover;background-position:center"` : '';
}

function visibleListings() {
  const query = searchInput.value.trim().toLowerCase();
  return listings.filter(item =>
    (!selectedCity || item.city === selectedCity) &&
    (!query || `${item.title} ${item.city} ${item.area} ${item.access}`.toLowerCase().includes(query)) &&
    (activeFilter === 'All spaces' ||
      (activeFilter === 'Indoor' && !item.title.toLowerCase().includes('shed')) ||
      (activeFilter === '24/7 access' && item.access === '24/7 access') ||
      (activeFilter === 'Under 100 USDC' && item.price < 100))
  );
}

function renderListings() {
  const items = visibleListings();
  grid.innerHTML = items.length ? items.map(item => {
    const index = listings.indexOf(item);
    return `<article class="listing-card" data-listing-index="${index}" tabindex="0" role="button" aria-label="View ${item.title}">
      <div class="listing-image" ${imageStyle(item)}><span class="image-tag">${item.tag}</span></div>
      <div class="listing-body">
        <p>${item.size} · ${item.access}</p>
        <h3>${item.title}</h3>
        <div class="listing-meta"><span>${item.area}, ${item.city}</span><span class="listing-rating">★ ${item.rating}</span></div>
        <div class="listing-bottom"><span class="listing-price">${item.price.toFixed(2)} USDC<small>/ month</small></span><span class="verified">On API</span></div>
      </div>
    </article>`;
  }).join('') : '<div class="empty-results">No spaces match these filters.</div>';

  grid.querySelectorAll('.listing-card').forEach(card => {
    const open = () => openBooking(Number(card.dataset.listingIndex));
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  resultsLabel.textContent = `Showing ${items.length} space${items.length === 1 ? '' : 's'}${selectedCity ? ` in ${selectedCity}` : ' from the Flask API'}`;
  markers.forEach((marker, city) => marker.setOpacity(!selectedCity || selectedCity === city ? 1 : .45));
}

function selectCity(city, moveMap = true) {
  selectedCity = city;
  const count = listings.filter(item => item.city === city).length;
  cityPanel.innerHTML = `<span class="selected-city-dot"></span><div><strong>${city}</strong><small>${count} space${count === 1 ? '' : 's'} available</small></div><button id="show-all-spaces" type="button">Show all →</button>`;
  renderListings();
  if (moveMap && map) {
    const item = listings.find(listing => listing.city === city);
    if (item) map.flyTo([item.lat, item.lng], 10, { duration: .7 });
  }
}

function showAllSpaces() {
  selectedCity = null;
  searchInput.value = '';
  activeFilter = 'All spaces';
  document.querySelectorAll('.filter-button').forEach(button => button.classList.toggle('active', button.textContent === 'All spaces'));
  cityPanel.innerHTML = `<span class="selected-city-dot"></span><div><strong>All Ireland</strong><small>${listings.length} API spaces shown</small></div><button id="show-all-spaces" type="button">Show all →</button>`;
  renderListings();
  if (map) map.fitBounds([[51.2, -10.8], [55.5, -5.4]], { padding: [18, 18] });
}

function enableWheelZoom(targetMap, element) {
  let lastZoom = 0;
  element.addEventListener('wheel', event => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() - lastZoom < 100) return;
    lastZoom = Date.now();
    targetMap.setZoomAround(targetMap.mouseEventToContainerPoint(event), targetMap.getZoom() + (event.deltaY < 0 ? 1 : -1));
  }, { passive: false });
}

function initMap() {
  const element = document.querySelector('#storage-map');
  if (!window.L) {
    element.innerHTML = '<p class="map-error">Map could not load. Check your internet connection.</p>';
    return;
  }

  map = L.map(element, { scrollWheelZoom: false, minZoom: 6, maxZoom: 14, zoomControl: false });
  enableWheelZoom(map, element);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.fitBounds([[51.2, -10.8], [55.5, -5.4]], { padding: [18, 18] });

  listings.forEach(item => {
    const icon = L.divIcon({ className: 'storage-marker', html: '<span>⌂</span>', iconSize: [36, 36], iconAnchor: [18, 18] });
    const marker = L.marker([item.lat, item.lng], { icon, title: `${item.city}: ${item.title}, ${item.price} USDC/month` }).addTo(map);
    marker.bindTooltip(`${item.city} · ${item.price} USDC/mo`, { direction: 'top', offset: [0, -15] });
    marker.on('click', () => selectCity(item.city, false));
    markers.set(item.city, marker);
  });
}

function initHeroMap() {
  const element = document.querySelector('#hero-map');
  if (!window.L || !listings.length) return;
  const heroMap = L.map(element, { scrollWheelZoom: false, zoomControl: false, dragging: true, minZoom: 8, maxZoom: 16 }).setView([listings[0].lat, listings[0].lng], 11);
  enableWheelZoom(heroMap, element);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(heroMap);
  L.marker([listings[0].lat, listings[0].lng], {
    icon: L.divIcon({ className: 'storage-marker', html: '<span>⌂</span>', iconSize: [36, 36], iconAnchor: [18, 18] }),
    title: listings[0].title,
  }).addTo(heroMap);
}

async function connectWallet() {
  try {
    walletAddress = await chain.connectWallet();
    walletLabel.textContent = shortWallet(walletAddress);
    showToast(`Wallet connected: ${shortWallet(walletAddress)}`);
    return walletAddress;
  } catch (error) {
    showToast(error.message);
    throw error;
  }
}

async function requireWallet() {
  if (walletAddress) return walletAddress;
  return connectWallet();
}

function openBooking(index = 0) {
  const item = listings[index];
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const moveIn = date.toISOString().slice(0, 10);
  const solEstimate = (item.price + item.deposit) / Number(config.DEMO_USDC_PER_SOL || 150);

  openModal(`<div class="modal-space-preview" ${imageStyle(item)}></div>
    <div class="eyebrow">LIVE FLASK LISTING</div>
    <h2>${item.title}</h2>
    <p>${item.location} · ${item.size} · ${item.access}</p>
    <div class="modal-form">
      <label>MOVE-IN DATE</label><input type="date" value="${moveIn}" />
      <label>PAYMENT SUMMARY</label>
      <div class="agreement-summary"><strong>${item.price.toFixed(2)} USDC rent</strong><span>+ ${item.deposit.toFixed(2)} USDC security deposit</span><span>≈ ${solEstimate.toFixed(4)} SOL at demo rate</span></div>
      <button class="modal-submit" data-start-booking>Book with Phantom <span>→</span></button>
    </div>`);

  document.querySelector('[data-start-booking]').addEventListener('click', () => startBooking(item));
}

async function startBooking(item) {
  const button = document.querySelector('[data-start-booking]');
  button.disabled = true;
  button.textContent = 'Preparing booking…';

  try {
    const renterWallet = await requireWallet();

    // 1) Create off-chain booking record.
    const booking = await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ listing_id: item.id, renter_wallet: renterWallet }),
    });

    // 2) Fund through the chain adapter. In demo mode this is explicit simulation;
    //    in native-sol-anchor mode it signs the current Anchor create_booking tx.
    const chainResult = await chain.fundBooking({ booking, listing: item });

    // 3) Persist successful funding metadata in Flask.
    activeBooking = await api(`/api/bookings/${booking.id}/funded`, {
      method: 'PATCH',
      body: JSON.stringify({
        escrow_address: chainResult.escrowAddress,
        transaction_signature: chainResult.transactionSignature,
      }),
    });
    activeListing = item;

    showFundedModal(chainResult);
    renderDashboard();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
    button.innerHTML = 'Book with Phantom <span>→</span>';
  }
}

function showFundedModal(chainResult) {
  const explorer = chainResult.explorerUrl
    ? `<a class="modal-link" href="${chainResult.explorerUrl}" target="_blank" rel="noreferrer">View transaction on Solana Explorer ↗</a>`
    : '<p class="demo-warning">Local demo mode: no blockchain funds were moved. Switch CHAIN_MODE after the final Anchor program is deployed.</p>';

  openModal(`<div class="escrow-modal">
    <div class="eyebrow">BOOKING FUNDED · ${chainResult.mode.toUpperCase()}</div>
    <h2>Booking #${activeBooking.id} is funded.</h2>
    <p>Flask status: <strong>${activeBooking.status}</strong></p>
    <div class="escrow-visual">
      <div class="escrow-amount">${activeListing.price.toFixed(2)} + ${activeListing.deposit.toFixed(2)} <small>USDC-denominated</small></div>
      <p><strong>Escrow:</strong> ${activeBooking.escrow_address}</p>
      <p><strong>Transaction:</strong> ${activeBooking.transaction_signature}</p>
    </div>
    ${explorer}
    <button class="modal-submit" data-go-dashboard>Open booking dashboard <span>→</span></button>
  </div>`);

  document.querySelector('[data-go-dashboard]').addEventListener('click', () => {
    closeModal();
    document.querySelector('#dashboard').scrollIntoView({ behavior: 'smooth' });
  });
}

async function patchEvidence(kind) {
  if (!activeBooking) return;
  const label = kind === 'move_in_photo' ? 'move-in' : 'move-out';
  const value = prompt(`Enter a ${label} image URL/path for the demo:`, `${label}.jpg`);
  if (!value) return;

  activeBooking = await api(`/api/bookings/${activeBooking.id}/evidence`, {
    method: 'PATCH',
    body: JSON.stringify({ [kind]: value }),
  });
  renderDashboard();
  showToast(`${label} evidence saved`);
}

async function confirmParty(party) {
  if (!activeBooking) return;
  try {
    activeBooking = await api(`/api/bookings/${activeBooking.id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify({ party }),
    });
    renderDashboard();
    showToast(`${party} confirmation saved`);
  } catch (error) {
    showToast(error.message);
  }
}

async function releaseActiveBooking() {
  if (!activeBooking) return;
  try {
    const chainResult = await chain.releaseBooking(activeBooking);
    activeBooking = await api(`/api/bookings/${activeBooking.id}/released`, {
      method: 'PATCH',
      body: JSON.stringify({ release_signature: chainResult.releaseSignature }),
    });
    renderDashboard();
    showToast('Booking marked COMPLETED');
  } catch (error) {
    showToast(error.message);
  }
}

function renderDashboard() {
  const container = document.querySelector('.dashboard-main');
  if (!activeBooking || !activeListing) {
    container.innerHTML = `<div class="panel-header"><div><p class="muted-label">LIVE BOOKING</p><h3>No active booking yet</h3></div><span class="agreement-status">API connected</span></div><p class="dashboard-empty">Connect Phantom and book a listing above. This dashboard will then read/write the real Flask booking record.</p>`;
    return;
  }

  const fundExplorer = chain.explorerUrl(activeBooking.transaction_signature);
  const releaseExplorer = chain.explorerUrl(activeBooking.release_signature);
  const ready = activeBooking.status === 'READY_TO_RELEASE';
  const completed = activeBooking.status === 'COMPLETED';

  container.innerHTML = `<div class="panel-header">
      <div><p class="muted-label">BOOKING #${activeBooking.id}</p><h3>${activeListing.title}</h3></div>
      <span class="agreement-status">● ${activeBooking.status}</span>
    </div>
    <div class="agreement-info">
      <div class="agreement-photo" ${imageStyle(activeListing)}></div>
      <div class="agreement-details">
        <p>${activeListing.location}</p>
        <strong>${activeListing.price.toFixed(2)} USDC <small>monthly rent</small></strong>
        <p>Deposit: ${activeListing.deposit.toFixed(2)} USDC</p>
        <p>Held in USDC in the final design; users can pay/receive SOL through the swap adapter.</p>
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
    ${config.CHAIN_MODE === 'demo' ? '<p class="demo-warning">Chain mode is DEMO: Flask integration is real, on-chain money movement is simulated.</p>' : ''}`;

  container.querySelector('[data-move-in]')?.addEventListener('click', () => patchEvidence('move_in_photo'));
  container.querySelector('[data-move-out]')?.addEventListener('click', () => patchEvidence('move_out_photo'));
  container.querySelector('[data-confirm-renter]')?.addEventListener('click', () => confirmParty('renter'));
  container.querySelector('[data-confirm-host]')?.addEventListener('click', () => confirmParty('host'));
  container.querySelector('[data-release]')?.addEventListener('click', releaseActiveBooking);
}

function openListingForm() {
  openModal(`<div class="eyebrow">BECOME A HOST</div><h2>List your unused space.</h2>
    <div class="modal-form">
      <label>SPACE NAME</label><input data-list-title placeholder="e.g. Dry garage near Dublin city centre" />
      <label>DESCRIPTION</label><input data-list-description placeholder="Secure, dry, 24/7 access" />
      <label>LOCATION</label><input data-list-location placeholder="Rathmines, Dublin" />
      <label>MONTHLY PRICE (USDC)</label><input data-list-price type="number" min="0.01" step="0.01" value="85" />
      <label>SECURITY DEPOSIT (USDC)</label><input data-list-deposit type="number" min="0" step="0.01" value="170" />
      <label>SPACE TYPE</label><select data-list-type><option value="storage">Storage</option><option value="accommodation">Accommodation</option></select>
      <button class="modal-submit" data-submit-listing>Create listing <span>→</span></button>
    </div>`);

  document.querySelector('[data-submit-listing]').addEventListener('click', async event => {
    const button = event.currentTarget;
    try {
      const hostWallet = await requireWallet();
      button.disabled = true;
      const listing = await api('/api/listings', {
        method: 'POST',
        body: JSON.stringify({
          title: document.querySelector('[data-list-title]').value,
          description: document.querySelector('[data-list-description]').value,
          location: document.querySelector('[data-list-location]').value,
          price_usdc: Number(document.querySelector('[data-list-price]').value),
          deposit_usdc: Number(document.querySelector('[data-list-deposit]').value),
          image: 'assets/listings/garage-bay.jpg',
          space_type: document.querySelector('[data-list-type]').value,
          host_wallet: hostWallet,
        }),
      });
      listings.push(decorateListing(listing, listings.length));
      renderListings();
      closeModal();
      showToast('Listing created in Flask');
    } catch (error) {
      button.disabled = false;
      showToast(error.message);
    }
  });
}

async function loadExistingBooking() {
  try {
    const bookings = await api('/api/bookings');
    if (!bookings.length) return;
    activeBooking = bookings[0];
    activeListing = listings.find(item => item.id === activeBooking.listing_id) || null;
  } catch (error) {
    console.warn('Could not restore booking:', error);
  }
}

async function boot() {
  applyTheme(document.documentElement.dataset.theme || 'light');
  renderDashboard();

  try {
    const health = await api('/api/health');
    console.log(health.message);
    const raw = await api('/api/listings');
    listings = raw.map(decorateListing);
    if (!listings.length) throw new Error('Flask returned zero listings. Restart backend to seed demo data.');

    renderListings();
    initMap();
    initHeroMap();
    showAllSpaces();
    await loadExistingBooking();
    renderDashboard();
  } catch (error) {
    grid.innerHTML = `<div class="empty-results"><strong>Backend not reachable.</strong><br>${error.message}<br><br>Run <code>python app.py</code> inside the backend folder.</div>`;
    resultsLabel.textContent = 'Flask API offline';
    showToast('Flask backend is not reachable');
  }
}

themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
cityPanel.addEventListener('click', event => { if (event.target.closest('#show-all-spaces')) showAllSpaces(); });
modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
document.querySelector('[data-close-modal]').addEventListener('click', closeModal);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
document.querySelectorAll('[data-open-listing]').forEach(button => button.addEventListener('click', openListingForm));
document.querySelector('[data-connect-wallet]').addEventListener('click', connectWallet);
document.querySelector('[data-open-dashboard]').addEventListener('click', event => { event.preventDefault(); document.querySelector('#dashboard').scrollIntoView({ behavior: 'smooth' }); });
document.querySelector('[data-scroll-explore]').addEventListener('click', () => document.querySelector('#explore').scrollIntoView({ behavior: 'smooth' }));
document.querySelector('[data-load-more]').addEventListener('click', showAllSpaces);
document.querySelector('[data-show-escrow]').addEventListener('click', () => {
  if (activeBooking) {
    document.querySelector('#dashboard').scrollIntoView({ behavior: 'smooth' });
  } else if (listings.length) {
    openBooking(0);
  }
});
searchInput.addEventListener('input', () => {
  selectedCity = null;
  cityPanel.innerHTML = `<span class="selected-city-dot"></span><div><strong>All Ireland</strong><small>Search API listings</small></div><button id="show-all-spaces" type="button">Show all →</button>`;
  renderListings();
});
document.querySelectorAll('.filter-button').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.textContent;
  document.querySelectorAll('.filter-button').forEach(item => item.classList.toggle('active', item === button));
  renderListings();
}));

boot();

