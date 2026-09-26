"""Run this while backend/app.py is running to verify the Flask API lifecycle."""

import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:5000"


def request(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as response:
        return response.status, json.loads(response.read().decode())


print("1. health")
print(request("GET", "/api/health"))

print("2. listings")
_, listings = request("GET", "/api/listings")
assert listings, "Expected seeded demo listings"
print(f"   {len(listings)} listings")

print("3. create booking")
_, booking = request("POST", "/api/bookings", {
    "listing_id": listings[0]["id"],
    "renter_wallet": "LOCAL_SMOKE_TEST_RENTER",
})
booking_id = booking["id"]
print("   booking", booking_id)

print("4. mark funded")
_, booking = request("PATCH", f"/api/bookings/{booking_id}/funded", {
    "escrow_address": f"DEMO_ESCROW_{booking_id}",
    "transaction_signature": f"DEMO_FUND_{booking_id}",
})
assert booking["status"] == "FUNDED"

print("5. evidence")
request("PATCH", f"/api/bookings/{booking_id}/evidence", {"move_in_photo": "move-in.jpg"})
request("PATCH", f"/api/bookings/{booking_id}/evidence", {"move_out_photo": "move-out.jpg"})

print("6. confirmations")
request("PATCH", f"/api/bookings/{booking_id}/confirm", {"party": "renter"})
_, booking = request("PATCH", f"/api/bookings/{booking_id}/confirm", {"party": "host"})
assert booking["status"] == "READY_TO_RELEASE"

print("7. release")
_, booking = request("PATCH", f"/api/bookings/{booking_id}/released", {
    "release_signature": f"DEMO_RELEASE_{booking_id}",
})
assert booking["status"] == "COMPLETED"
print("PASS: Flask lifecycle works end-to-end")
