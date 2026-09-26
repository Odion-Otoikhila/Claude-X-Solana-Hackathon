const listings = [
  {city:'Dublin', title:'Rathmines private garage', area:'Rathmines', price:0.55, deposit:1.10, size:'18 m²', access:'24/7 access', rating:'4.9', photo:'photo-dublin', tag:'Popular', lat:53.3206, lng:-6.2655},
  {city:'Cork', title:'Douglas dry basement', area:'Douglas', price:0.40, deposit:0.80, size:'10 m²', access:'Keypad access', rating:'4.8', photo:'photo-cork', tag:'Best value', lat:51.8737, lng:-8.4358},
  {city:'Galway', title:'Salthill storage room', area:'Salthill', price:0.62, deposit:1.24, size:'14 m²', access:'Daytime access', rating:'5.0', photo:'photo-galway', tag:'New space', lat:53.2601, lng:-9.0966},
  {city:'Limerick', title:'Castletroy secure shed', area:'Castletroy', price:0.47, deposit:0.94, size:'12 m²', access:'24/7 access', rating:'4.7', photo:'photo-limerick', tag:'Flexible', lat:52.6734, lng:-8.5673},
  {city:'Waterford', title:'City centre storage shed', area:'City centre', price:0.50, deposit:1.00, size:'9 m²', access:'Daytime access', rating:'4.9', photo:'photo-waterford', tag:'Central', lat:52.2593, lng:-7.1101},
  {city:'Kilkenny', title:'Kilkenny garage bay', area:'City centre', price:0.44, deposit:0.88, size:'15 m²', access:'24/7 access', rating:'4.8', photo:'photo-kilkenny', tag:'Easy access', lat:52.6541, lng:-7.2448},
];
const solanaMark = '<span class="solana-price-mark" aria-hidden="true"></span>';
const grid = document.querySelector('#listing-grid');
const modalBackdrop = document.querySelector('#modal-backdrop');
const modalContent = document.querySelector('#modal-content');
const toast = document.querySelector('#toast');
const searchInput = document.querySelector('#search-input');
const cityPanel = document.querySelector('#selected-city');
const resultsLabel = document.querySelector('#results-label');
let toastTimer, selectedCity = null, activeFilter = 'All spaces', map;
const markers = new Map();
const themeToggle = document.querySelector('[data-theme-toggle]');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0a1427' : '#f7fbff';
  try { localStorage.setItem('need-a-space-theme', theme); } catch {}
}
applyTheme(document.documentElement.dataset.theme || 'light');
themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

function visibleListings() {
  const query = searchInput.value.trim().toLowerCase();
  return listings.filter(item =>
    (!selectedCity || item.city === selectedCity) &&
    (!query || `${item.title} ${item.city} ${item.area} ${item.access}`.toLowerCase().includes(query)) &&
    (activeFilter === 'All spaces' ||
      (activeFilter === 'Indoor' && !item.title.includes('shed')) ||
      (activeFilter === '24/7 access' && item.access === '24/7 access') ||
      (activeFilter === 'Under 0.5 SOL' && item.price < 0.5))
  );
}
function renderListings() {
  const items = visibleListings();
  grid.innerHTML = items.length ? items.map(item => {
    const index = listings.indexOf(item);
    return `<article class="listing-card" data-listing-index="${index}" tabindex="0" role="button" aria-label="View ${item.title}">
      <div class="listing-image ${item.photo}"><span class="image-tag">${item.tag}</span></div>
      <div class="listing-body"><p>${item.size} · ${item.access}</p><h3>${item.title}</h3><div class="listing-meta"><span>${item.area}, ${item.city}</span><span class="listing-rating">★ ${item.rating}</span></div><div class="listing-bottom"><span class="listing-price">${solanaMark}${item.price.toFixed(2)} SOL<small>/ month</small></span><span class="verified">Demo listing</span></div></div>
    </article>`;
  }).join('') : '<div class="empty-results">No demo spaces match these filters. Try another city or clear your search.</div>';
  grid.querySelectorAll('.listing-card').forEach(card => {
    const open = () => openBooking(Number(card.dataset.listingIndex));
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
  resultsLabel.textContent = `Showing ${items.length} demo space${items.length === 1 ? '' : 's'}${selectedCity ? ` in ${selectedCity}` : ' across Ireland'}`;
  markers.forEach((marker, city) => marker.setOpacity(!selectedCity || selectedCity === city ? 1 : .45));
}
function selectCity(city, moveMap = true) {
  selectedCity = city;
  cityPanel.innerHTML = `<span class="selected-city-dot"></span><div><strong>${city}</strong><small>1 demo space available</small></div><button id="show-all-spaces" type="button">Show all →</button>`;
  renderListings();
  if (moveMap && map) {
    const item = listings.find(listing => listing.city === city);
    map.flyTo([item.lat, item.lng], 10, {duration:.7});
  }
}
function showAllSpaces() {
  selectedCity = null;
  searchInput.value = '';
  activeFilter = 'All spaces';
  document.querySelectorAll('.filter-button').forEach(button => button.classList.toggle('active', button.textContent === 'All spaces'));
  cityPanel.innerHTML = '<span class="selected-city-dot"></span><div><strong>All Ireland</strong><small>6 demo spaces shown</small></div><button id="show-all-spaces" type="button">Show all →</button>';
  renderListings();
  if (map) map.fitBounds([[51.2,-10.8],[55.5,-5.4]], {padding:[18,18]});
}
function initMap() {
  const element = document.querySelector('#storage-map');
  if (!window.L) {
    element.innerHTML = '<p class="map-error">Map could not load. Check your internet connection.</p>';
    return;
  }
  map = L.map(element, {scrollWheelZoom:false, minZoom:6, maxZoom:14, zoomControl:false});
  enableWheelZoom(map, element);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.fitBounds([[51.2,-10.8],[55.5,-5.4]], {padding:[18,18]});
  listings.forEach(item => {
    const icon = L.divIcon({className:'storage-marker', html:'<span>⌂</span>', iconSize:[36,36], iconAnchor:[18,18]});
    const marker = L.marker([item.lat,item.lng], {icon, title:`${item.city}: ${item.title}, ${item.price.toFixed(2)} SOL per month`}).addTo(map);
    marker.bindTooltip(`${item.city} · ${item.price.toFixed(2)} SOL/mo`, {direction:'top', offset:[0,-15]});
    marker.on('click', () => selectCity(item.city, false));
    marker.getElement().addEventListener('click', () => selectCity(item.city, false));
    marker.getElement().addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCity(item.city, false); } });
    markers.set(item.city, marker);
  });
}
function enableWheelZoom(targetMap, element) {
  let lastZoom = 0;
  element.addEventListener('wheel', event => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() - lastZoom < 100) return;
    lastZoom = Date.now();
    const direction = event.deltaY < 0 ? 1 : -1;
    const point = targetMap.mouseEventToContainerPoint(event);
    targetMap.setZoomAround(point, targetMap.getZoom() + direction);
  }, {passive:false});
}
function initHeroMap() {
  const element = document.querySelector('#hero-map');
  if (!window.L) return;
  const heroMap = L.map(element, {scrollWheelZoom:false, zoomControl:false, dragging:true, minZoom:8, maxZoom:16}).setView([53.329, -6.26], 11);
  enableWheelZoom(heroMap, element);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(heroMap);
  L.marker([listings[0].lat,listings[0].lng], {
    icon:L.divIcon({className:'storage-marker',html:'<span>⌂</span>',iconSize:[36,36],iconAnchor:[18,18]}),
    title:'Rathmines private garage'
  }).addTo(heroMap);
}
function showToast(message) {
  document.querySelector('#toast-message').textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
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
function openBooking(index = 0) {
  const item = listings[index];
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const moveIn = date.toISOString().slice(0,10);
  openModal(`<div class="modal-space-preview ${item.photo}"></div><div class="eyebrow">DEMO STORAGE SPACE</div><h2>${item.title}</h2><p>${item.area}, ${item.city} · ${item.size} · ${item.access}</p><div class="modal-form"><label>MOVE-IN DATE</label><input type="date" value="${moveIn}" /><label>PAYMENT SUMMARY</label><div class="agreement-summary"><strong>${solanaMark}${item.price.toFixed(2)} SOL / month</strong><span>+ ${item.deposit.toFixed(2)} SOL example security deposit</span></div><button class="modal-submit" data-start-booking>Continue with SOL <span>→</span></button></div>`);
  document.querySelector('[data-start-booking]').addEventListener('click', () => openEscrow(item));
}
function openEscrow(item) {
  openModal(`<div class="escrow-modal"><div class="eyebrow">SOLANA ESCROW · DEMO</div><h2>See how your deposit is protected.</h2><p>This is a simulated escrow flow for ${item.title}. No payment or on-chain transaction will be made.</p><div class="escrow-visual"><div class="escrow-amount">${solanaMark}${item.deposit.toFixed(2)} SOL <small>Solana</small></div><div class="escrow-track"><span class="escrow-node">✓</span><span class="escrow-connector"></span><span class="escrow-node pending">⌑</span><span class="escrow-connector pending"></span><span class="escrow-node pending">✓</span></div><div class="escrow-labels"><span>Payment received</span><span>Access confirmed</span><span>Deposit returned</span></div></div><button class="modal-submit" data-lock-funds>Show simulated deposit <span>→</span></button></div>`);
  document.querySelector('[data-lock-funds]').addEventListener('click', () => {
    closeModal();
    showToast('Demo escrow state updated');
    document.querySelector('#dashboard').scrollIntoView({behavior:'smooth'});
  });
}
function openListingForm() {
  openModal(`<div class="eyebrow">BECOME A HOST · DEMO</div><h2>List your unused space.</h2><p>Preview how a host could turn an empty garage, room, or locker into monthly income.</p><div class="modal-form"><label>SPACE NAME</label><input placeholder="e.g. Dry garage near Dublin city centre" /><label>MONTHLY PRICE (SOL)</label><input placeholder="0.55" /><label>SPACE TYPE</label><select><option>Private garage</option><option>Basement</option><option>Spare room</option><option>Warehouse</option></select><button class="modal-submit" data-submit-listing>Preview listing <span>→</span></button></div>`);
  document.querySelector('[data-submit-listing]').addEventListener('click', () => { closeModal(); showToast('Demo listing preview complete'); });
}

let demoSignedIn = false;

function shortWalletAddress(address) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function showPhantomPrompt() {
  openModal(`<div class="wallet-flow">
    <div class="wallet-flow-icon" aria-hidden="true">👻</div>
    <div class="eyebrow">PHANTOM WALLET</div>
    <h2 id="modal-title">Add Phantom to continue.</h2>
    <p>We could not find Phantom in this browser. Install it, create or import a wallet, then return here and try again.</p>
    <div class="wallet-safety-note"><strong>Demo safety</strong><span>Never enter a recovery phrase or private key into this site.</span></div>
    <a class="modal-submit wallet-install-link" href="https://phantom.app/download" target="_blank" rel="noopener noreferrer">Get Phantom <span>↗</span></a>
    <button class="wallet-retry-button" type="button" data-retry-wallet>I've installed Phantom — try again</button>
  </div>`);
  document.querySelector('[data-retry-wallet]').addEventListener('click', connectPhantom);
}

async function connectPhantom() {
  const provider = window.phantom?.solana;
  if (!provider?.isPhantom) {
    showPhantomPrompt();
    return;
  }

  try {
    const response = await provider.connect();
    const address = response.publicKey.toString();
    closeModal();
    document.querySelector('[data-wallet-label]').textContent = shortWalletAddress(address);
    document.querySelector('[data-connect-wallet]').classList.add('connected');
    showToast(`Phantom connected: ${shortWalletAddress(address)}`);
  } catch (error) {
    if (error?.code === 4001) {
      showToast('Wallet connection cancelled');
      return;
    }
    showToast('Could not connect to Phantom. Please try again.');
  }
}

function openDemoLogin() {
  openModal(`<div class="login-flow">
    <div class="eyebrow">DEMO ACCOUNT</div>
    <h2 id="modal-title">Sign in to connect your wallet.</h2>
    <p>This presentation uses a prefilled demo account. No credentials are sent or stored.</p>
    <form class="modal-form" data-demo-login autocomplete="off">
      <label for="demo-email">EMAIL</label>
      <input id="demo-email" name="email" type="email" value="demo@need-a-space.ie" required />
      <label for="demo-password">PASSWORD</label>
      <input id="demo-password" class="demo-password" name="demo-passcode" type="text" value="demo1234" aria-label="Demo password" autocomplete="off" data-lpignore="true" data-1p-ignore required />
      <div class="demo-credentials-note"><span>✓</span> Demo credentials are filled in for you</div>
      <button class="modal-submit" type="submit">Log in &amp; continue <span>→</span></button>
    </form>
  </div>`);
  document.querySelector('[data-demo-login]').addEventListener('submit', event => {
    event.preventDefault();
    demoSignedIn = true;
    connectPhantom();
  });
}

function startWalletFlow() {
  if (demoSignedIn) {
    connectPhantom();
    return;
  }
  openDemoLogin();
}
renderListings();
initMap();
initHeroMap();
cityPanel.addEventListener('click', event => { if (event.target.closest('#show-all-spaces')) showAllSpaces(); });
modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
document.querySelector('[data-close-modal]').addEventListener('click', closeModal);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
document.querySelectorAll('[data-open-listing]').forEach(button => button.addEventListener('click', openListingForm));
document.querySelector('[data-connect-wallet]').addEventListener('click', startWalletFlow);
document.querySelector('[data-open-dashboard]').addEventListener('click', event => { event.preventDefault(); document.querySelector('#dashboard').scrollIntoView({behavior:'smooth'}); });
document.querySelector('[data-scroll-explore]').addEventListener('click', () => document.querySelector('#explore').scrollIntoView({behavior:'smooth'}));
document.querySelector('[data-load-more]').addEventListener('click', showAllSpaces);
document.querySelector('[data-show-escrow]').addEventListener('click', () => openEscrow(listings[0]));
searchInput.addEventListener('input', () => {
  selectedCity = null;
  cityPanel.innerHTML = '<span class="selected-city-dot"></span><div><strong>All Ireland</strong><small>Search across 6 demo spaces</small></div><button id="show-all-spaces" type="button">Show all →</button>';
  renderListings();
});
document.querySelectorAll('.filter-button').forEach(button => button.addEventListener('click', () => {
  activeFilter = button.textContent;
  document.querySelectorAll('.filter-button').forEach(item => item.classList.toggle('active', item === button));
  renderListings();
}));

