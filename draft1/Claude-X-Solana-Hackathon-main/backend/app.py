from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS


# -------------------------
# APP SETUP
# -------------------------

app = Flask(__name__)
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///needaspace.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# -------------------------
# MODELS
# -------------------------

class Listing(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    location = db.Column(db.String(100), nullable=False)

    # The marketplace is denominated in USDC. The frontend/on-chain layer
    # decides whether the user pays/receives SOL or USDC.
    price_usdc = db.Column(db.Float, nullable=False)
    deposit_usdc = db.Column(db.Float, nullable=False)

    image = db.Column(db.String(500))
    space_type = db.Column(db.String(20), nullable=False)

    # Solana public key of the host.
    host_wallet = db.Column(db.String(100), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "location": self.location,
            "price_usdc": self.price_usdc,
            "deposit_usdc": self.deposit_usdc,
            "image": self.image,
            "space_type": self.space_type,
            "host_wallet": self.host_wallet,
        }


class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    listing_id = db.Column(
        db.Integer,
        db.ForeignKey("listing.id"),
        nullable=False,
    )

    renter_wallet = db.Column(db.String(100), nullable=False)

    # Solana information. Flask never signs or moves money; it only stores
    # identifiers returned after successful frontend/on-chain transactions.
    escrow_address = db.Column(db.String(100))
    transaction_signature = db.Column(db.String(200))
    release_signature = db.Column(db.String(200))

    # Evidence is intentionally stored as a URL/path for the hackathon MVP.
    move_in_photo = db.Column(db.String(500))
    move_out_photo = db.Column(db.String(500))

    renter_confirmed = db.Column(db.Boolean, default=False, nullable=False)
    host_confirmed = db.Column(db.Boolean, default=False, nullable=False)

    # CREATED -> FUNDED -> READY_TO_RELEASE -> COMPLETED
    status = db.Column(db.String(30), default="CREATED", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "listing_id": self.listing_id,
            "renter_wallet": self.renter_wallet,
            "escrow_address": self.escrow_address,
            "transaction_signature": self.transaction_signature,
            "release_signature": self.release_signature,
            "move_in_photo": self.move_in_photo,
            "move_out_photo": self.move_out_photo,
            "renter_confirmed": self.renter_confirmed,
            "host_confirmed": self.host_confirmed,
            "status": self.status,
        }


DEMO_LISTINGS = [
    {
        "title": "Rathmines private garage",
        "description": "Secure indoor garage with 24/7 access in Rathmines.",
        "location": "Rathmines, Dublin",
        "price_usdc": 85,
        "deposit_usdc": 170,
        "image": "assets/listings/garage-bay.jpg",
        "space_type": "storage",
        "host_wallet": "DEMO_HOST_WALLET",
    },
    {
        "title": "Douglas dry basement",
        "description": "Dry private basement suitable for boxes, bikes and small furniture.",
        "location": "Douglas, Cork",
        "price_usdc": 62,
        "deposit_usdc": 124,
        "image": "assets/listings/storage-room.jpg",
        "space_type": "storage",
        "host_wallet": "DEMO_HOST_WALLET",
    },
    {
        "title": "Salthill storage room",
        "description": "Clean storage room close to Salthill with daytime access.",
        "location": "Salthill, Galway",
        "price_usdc": 95,
        "deposit_usdc": 190,
        "image": "assets/listings/garage-interior.webp",
        "space_type": "storage",
        "host_wallet": "DEMO_HOST_WALLET",
    },
    {
        "title": "Castletroy secure shed",
        "description": "Lockable shed with easy vehicle access.",
        "location": "Castletroy, Limerick",
        "price_usdc": 72,
        "deposit_usdc": 144,
        "image": "assets/listings/shed-exterior.jpg",
        "space_type": "storage",
        "host_wallet": "DEMO_HOST_WALLET",
    },
    {
        "title": "City centre storage shed",
        "description": "Compact city-centre storage for personal items and equipment.",
        "location": "City centre, Waterford",
        "price_usdc": 78,
        "deposit_usdc": 156,
        "image": "assets/listings/shed-interior.jpg",
        "space_type": "storage",
        "host_wallet": "DEMO_HOST_WALLET",
    },
    {
        "title": "Kilkenny garage bay",
        "description": "Private garage bay with straightforward 24/7 access.",
        "location": "City centre, Kilkenny",
        "price_usdc": 68,
        "deposit_usdc": 136,
        "image": "assets/listings/garage-bay.jpg",
        "space_type": "storage",
        "host_wallet": "DEMO_HOST_WALLET",
    },
]


def seed_demo_listings():
    """Seed demo listings only when the local database is empty."""
    if Listing.query.count() != 0:
        return

    for item in DEMO_LISTINGS:
        db.session.add(Listing(**item))
    db.session.commit()


with app.app_context():
    db.create_all()
    seed_demo_listings()


# -------------------------
# HELPERS
# -------------------------


def json_body():
    return request.get_json(silent=True) or {}


def missing_fields(data, required):
    return [field for field in required if data.get(field) in (None, "")]


# -------------------------
# HEALTH
# -------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "message": "NeedaSpace backend running",
    })


# -------------------------
# LISTINGS
# -------------------------

@app.route("/api/listings", methods=["GET"])
def get_listings():
    return jsonify([listing.to_dict() for listing in Listing.query.order_by(Listing.id).all()])


@app.route("/api/listings", methods=["POST"])
def create_listing():
    data = json_body()
    required = [
        "title",
        "description",
        "location",
        "price_usdc",
        "deposit_usdc",
        "space_type",
        "host_wallet",
    ]
    missing = missing_fields(data, required)
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        price_usdc = float(data["price_usdc"])
        deposit_usdc = float(data["deposit_usdc"])
    except (TypeError, ValueError):
        return jsonify({"error": "price_usdc and deposit_usdc must be numbers"}), 400

    if price_usdc <= 0 or deposit_usdc < 0:
        return jsonify({"error": "price_usdc must be > 0 and deposit_usdc must be >= 0"}), 400

    listing = Listing(
        title=data["title"].strip(),
        description=data["description"].strip(),
        location=data["location"].strip(),
        price_usdc=price_usdc,
        deposit_usdc=deposit_usdc,
        image=data.get("image"),
        space_type=data["space_type"].strip(),
        host_wallet=data["host_wallet"].strip(),
    )

    db.session.add(listing)
    db.session.commit()
    return jsonify(listing.to_dict()), 201


# -------------------------
# BOOKINGS
# -------------------------

@app.route("/api/bookings", methods=["GET"])
def get_bookings():
    return jsonify([booking.to_dict() for booking in Booking.query.order_by(Booking.id.desc()).all()])


@app.route("/api/bookings", methods=["POST"])
def create_booking():
    data = json_body()
    missing = missing_fields(data, ["listing_id", "renter_wallet"])
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    listing = db.session.get(Listing, data["listing_id"])
    if listing is None:
        return jsonify({"error": "Listing not found"}), 404

    booking = Booking(
        listing_id=listing.id,
        renter_wallet=data["renter_wallet"].strip(),
    )

    db.session.add(booking)
    db.session.commit()
    return jsonify(booking.to_dict()), 201


@app.route("/api/bookings/<int:booking_id>", methods=["GET"])
def get_booking(booking_id):
    booking = db.session.get(Booking, booking_id)
    if booking is None:
        return jsonify({"error": "Booking not found"}), 404
    return jsonify(booking.to_dict())


# -------------------------
# ESCROW FUNDED
# -------------------------

@app.route("/api/bookings/<int:booking_id>/funded", methods=["PATCH"])
def fund_booking(booking_id):
    booking = db.session.get(Booking, booking_id)
    if booking is None:
        return jsonify({"error": "Booking not found"}), 404

    data = json_body()
    missing = missing_fields(data, ["escrow_address", "transaction_signature"])
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    booking.escrow_address = data["escrow_address"]
    booking.transaction_signature = data["transaction_signature"]
    booking.status = "FUNDED"
    db.session.commit()
    return jsonify(booking.to_dict())


# -------------------------
# HANDOVER EVIDENCE
# -------------------------

@app.route("/api/bookings/<int:booking_id>/evidence", methods=["PATCH"])
def add_evidence(booking_id):
    booking = db.session.get(Booking, booking_id)
    if booking is None:
        return jsonify({"error": "Booking not found"}), 404

    data = json_body()
    changed = False

    if "move_in_photo" in data:
        booking.move_in_photo = data["move_in_photo"]
        changed = True

    if "move_out_photo" in data:
        booking.move_out_photo = data["move_out_photo"]
        changed = True

    if not changed:
        return jsonify({"error": "Provide move_in_photo and/or move_out_photo"}), 400

    db.session.commit()
    return jsonify(booking.to_dict())


# -------------------------
# CONFIRMATION
# -------------------------

@app.route("/api/bookings/<int:booking_id>/confirm", methods=["PATCH"])
def confirm_booking(booking_id):
    booking = db.session.get(Booking, booking_id)
    if booking is None:
        return jsonify({"error": "Booking not found"}), 404

    if booking.status not in ("FUNDED", "READY_TO_RELEASE"):
        return jsonify({"error": "Booking must be funded before confirmation"}), 409

    party = json_body().get("party")

    if party == "renter":
        booking.renter_confirmed = True
    elif party == "host":
        booking.host_confirmed = True
    else:
        return jsonify({"error": "Party must be 'renter' or 'host'"}), 400

    if booking.renter_confirmed and booking.host_confirmed:
        booking.status = "READY_TO_RELEASE"

    db.session.commit()
    return jsonify(booking.to_dict())


# -------------------------
# ESCROW RELEASED
# -------------------------

@app.route("/api/bookings/<int:booking_id>/released", methods=["PATCH"])
def release_booking(booking_id):
    booking = db.session.get(Booking, booking_id)
    if booking is None:
        return jsonify({"error": "Booking not found"}), 404

    if booking.status != "READY_TO_RELEASE":
        return jsonify({"error": "Both parties must confirm before release"}), 409

    release_signature = json_body().get("release_signature")
    if not release_signature:
        return jsonify({"error": "release_signature is required"}), 400

    booking.release_signature = release_signature
    booking.status = "COMPLETED"
    db.session.commit()
    return jsonify(booking.to_dict())


# -------------------------
# START SERVER
# -------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)
