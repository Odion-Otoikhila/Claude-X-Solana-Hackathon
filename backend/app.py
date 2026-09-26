from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS


# -------------------------
# APP SETUP
# -------------------------

app = Flask(__name__)
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///needaspace.db"

db = SQLAlchemy(app)


# -------------------------
# MODELS
# -------------------------

class Listing(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    location = db.Column(db.String(100), nullable=False)

    # Listings are priced in USDC.
    # Users may still pay in SOL through the frontend/Anchor conversion layer.
    price_usdc = db.Column(db.Float, nullable=False)
    deposit_usdc = db.Column(db.Float, nullable=False)

    image = db.Column(db.String(500))
    space_type = db.Column(db.String(20), nullable=False)

    # Solana public key of host
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
            "host_wallet": self.host_wallet
        }


class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    # Listing being booked
    listing_id = db.Column(
        db.Integer,
        db.ForeignKey("listing.id"),
        nullable=False
    )

    # Renter's Solana public key
    renter_wallet = db.Column(db.String(100), nullable=False)

    # Solana escrow information
    escrow_address = db.Column(db.String(100))
    transaction_signature = db.Column(db.String(200))

    # Handover evidence
    move_in_photo = db.Column(db.String(500))
    move_out_photo = db.Column(db.String(500))

    # Confirmation from both parties
    renter_confirmed = db.Column(db.Boolean, default=False)
    host_confirmed = db.Column(db.Boolean, default=False)

    # CREATED -> FUNDED -> READY_TO_RELEASE -> COMPLETED
    status = db.Column(db.String(30), default="CREATED")

    def to_dict(self):
        return {
            "id": self.id,
            "listing_id": self.listing_id,
            "renter_wallet": self.renter_wallet,
            "escrow_address": self.escrow_address,
            "transaction_signature": self.transaction_signature,
            "move_in_photo": self.move_in_photo,
            "move_out_photo": self.move_out_photo,
            "renter_confirmed": self.renter_confirmed,
            "host_confirmed": self.host_confirmed,
            "status": self.status
        }


# Create database tables
with app.app_context():
    db.create_all()


# -------------------------
# HEALTH
# -------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "message": "NeedaSpace backend running"
    })


# -------------------------
# LISTINGS
# -------------------------

@app.route("/api/listings", methods=["GET"])
def get_listings():
    listings = Listing.query.all()

    return jsonify([
        listing.to_dict()
        for listing in listings
    ])


@app.route("/api/listings", methods=["POST"])
def create_listing():
    data = request.get_json()

    listing = Listing(
        title=data["title"],
        description=data["description"],
        location=data["location"],
        price_usdc=data["price_usdc"],
        deposit_usdc=data["deposit_usdc"],
        image=data.get("image"),
        space_type=data["space_type"],
        host_wallet=data["host_wallet"]
    )

    db.session.add(listing)
    db.session.commit()

    return jsonify(listing.to_dict()), 201


# -------------------------
# BOOKINGS
# -------------------------

@app.route("/api/bookings", methods=["POST"])
def create_booking():
    data = request.get_json()

    # Make sure the listing exists
    listing = db.session.get(Listing, data["listing_id"])

    if listing is None:
        return jsonify({
            "error": "Listing not found"
        }), 404

    booking = Booking(
        listing_id=data["listing_id"],
        renter_wallet=data["renter_wallet"]
    )

    db.session.add(booking)
    db.session.commit()

    return jsonify(booking.to_dict()), 201


@app.route("/api/bookings/<int:booking_id>", methods=["GET"])
def get_booking(booking_id):
    booking = db.session.get(Booking, booking_id)

    if booking is None:
        return jsonify({
            "error": "Booking not found"
        }), 404

    return jsonify(booking.to_dict())


# -------------------------
# ESCROW FUNDED
# -------------------------

@app.route("/api/bookings/<int:booking_id>/funded", methods=["PATCH"])
def fund_booking(booking_id):
    booking = db.session.get(Booking, booking_id)

    if booking is None:
        return jsonify({
            "error": "Booking not found"
        }), 404

    data = request.get_json()

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
        return jsonify({
            "error": "Booking not found"
        }), 404

    data = request.get_json()

    if "move_in_photo" in data:
        booking.move_in_photo = data["move_in_photo"]

    if "move_out_photo" in data:
        booking.move_out_photo = data["move_out_photo"]

    db.session.commit()

    return jsonify(booking.to_dict())


# -------------------------
# CONFIRMATION
# -------------------------

@app.route("/api/bookings/<int:booking_id>/confirm", methods=["PATCH"])
def confirm_booking(booking_id):
    booking = db.session.get(Booking, booking_id)

    if booking is None:
        return jsonify({
            "error": "Booking not found"
        }), 404

    data = request.get_json()
    party = data.get("party")

    if party == "renter":
        booking.renter_confirmed = True

    elif party == "host":
        booking.host_confirmed = True

    else:
        return jsonify({
            "error": "Party must be 'renter' or 'host'"
        }), 400

    # Both parties must confirm before the frontend
    # calls the Solana release instruction.
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
        return jsonify({
            "error": "Booking not found"
        }), 404

    data = request.get_json()

    release_signature = data.get("release_signature")

    if not release_signature:
        return jsonify({
            "error": "release_signature is required"
        }), 400

    # The actual USDC release / SOL conversion happens on Solana.
    # Flask only records that the blockchain transaction succeeded.
    booking.status = "COMPLETED"

    db.session.commit()

    return jsonify({
        "booking": booking.to_dict(),
        "release_signature": release_signature
    })


# -------------------------
# START SERVER
# -------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)
