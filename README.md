# need-a-space

NeedaSpace is a presentation-first Solana escrow marketplace for local storage. People can list unused garages, basements, lockers, and warehouse space; renters see and pay in SOL; and deposits stay protected in programmable escrow until checkout. Internal USDC accounting and conversion remain backend concerns.

## Frontend demo

This repository currently contains a dependency-light static prototype. Open `index.html` in a browser to try the demo, or serve the folder with any static web server.

The interactive prototype includes:

- A polished storage marketplace landing page
- Search and listing filters
- Interactive Leaflet maps in the hero and Ireland browse section, with mouse-wheel zoom, six demo storage pins, and OpenStreetMap tiles
- Host listing flow
- SOL escrow checkout simulation
- Solana escrow status timeline
- Renter agreement dashboard
- Trust score and reputation presentation

The next implementation step is replacing the simulated escrow actions with an Anchor program and Solana Wallet Adapter integration.

The map needs an internet connection to load Leaflet and OpenStreetMap tiles. Listings, prices, locations, and reputation shown here are sample data for the presentation. OpenStreetMap attribution remains visible on the map.
