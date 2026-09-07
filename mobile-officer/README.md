Mobile Officer — Expo app

This minimal Expo-managed app lets local officers create new shelter records by calling the existing backend /shelters endpoint.

Quick start

1. Install dependencies
   cd mobile-officer
   npm install

2. Configure backend URL
   - Default is http://localhost:4000 in app.json extra.API_URL.
   - On a physical phone, localhost is the phone itself. The app rewrites that to the same LAN IP Expo Go uses to load the bundle (your PC). Keep the phone and PC on the same Wi‑Fi.
   - For a remote backend, set expo.extra.API_URL to that host.

3. Start the app
   npm run start
   - Scan the QR code with Expo Go (SDK 57).
   - This project uses Expo SDK 57 so it matches current Expo Go. Older SDKs fail with "incompatible" or "legacy manifests".

Notes

- The form validates the same fields enforced by the backend: name, location, district and capacity are required; capacity must be a positive integer; contact must be 10 digits if provided. If city is set, cityLatitude and cityLongitude must be provided.
- The app posts JSON to POST {API_URL}/shelters and expects the backend responses already present in this repository.

Extending

- Add authentication if required by your deployment (the backend currently accepts unauthenticated shelter creation).
- Replace fetch with axios and add better error handling and offline support.
- Add a list screen that fetches GET {API_URL}/shelters to show existing shelters.
