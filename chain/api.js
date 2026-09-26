// Thin client for backend/app.py. The backend never touches money:
// it stores listings, bookings, photos and the transaction signatures.

import { API_BASE } from "./config.js";

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Backend error ${res.status} on ${path}`);
  return data;
}

export async function isOnline() {
  try {
    await call("/health");
    return true;
  } catch {
    return false;
  }
}

export const getListings = () => call("/listings");
export const createListing = listing => call("/listings", { method: "POST", body: listing });

export const createBooking = (listingId, renterWallet) =>
  call("/bookings", { method: "POST", body: { listing_id: listingId, renter_wallet: renterWallet } });

export const getBooking = id => call(`/bookings/${id}`);

export const markFunded = (id, escrowAddress, signature) =>
  call(`/bookings/${id}/funded`, { method: "PATCH", body: { escrow_address: escrowAddress, transaction_signature: signature } });

export const addEvidence = (id, photos) =>
  call(`/bookings/${id}/evidence`, { method: "PATCH", body: photos });

export const confirm = (id, party) =>
  call(`/bookings/${id}/confirm`, { method: "PATCH", body: { party } });

export const markReleased = (id, signature) =>
  call(`/bookings/${id}/released`, { method: "PATCH", body: { release_signature: signature } });

// The six demo listings live in app.js. Make sure each one exists in the
// backend (matched by title) so bookings can point at a real listing id.
export async function ensureListing(item, hostWallet) {
  const existing = (await getListings()).find(l => l.title === item.title);
  if (existing) return existing;
  return createListing({
    title: item.title,
    description: `${item.size}, ${item.access}`,
    location: `${item.area}, ${item.city}`,
    price_usdc: item.usdcPrice ?? item.price,
    deposit_usdc: item.usdcDeposit ?? item.deposit,
    image: null,
    space_type: "storage",
    host_wallet: hostWallet,
  });
}
