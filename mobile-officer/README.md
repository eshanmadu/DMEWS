Mobile Officer — Expo app

This minimal Expo-managed app lets local officers create new shelter records by calling the existing backend /shelters endpoint.

Quick start

1. Install dependencies
   cd mobile-officer
   npm install

2. Configure backend URL
   - By default app.json.extra.API_URL is set to http://localhost:4000. Update that value if your backend runs elsewhere.
   - To run against a remote backend, edit app.json -> expo.extra.API_URL.

3. Start the app
   npm run start
   - Use Expo Go on a phone, or run on simulator/emulator.

Notes

- The form validates the same fields enforced by the backend: name, location, district and capacity are required; capacity must be a positive integer; contact must be 10 digits if provided. If city is set, cityLatitude and cityLongitude must be provided.
- The app posts JSON to POST {API_URL}/shelters and expects the backend responses already present in this repository.

Extending

- Add authentication if required by your deployment (the backend currently accepts unauthenticated shelter creation).
- Replace fetch with axios and add better error handling and offline support.
- Add a list screen that fetches GET {API_URL}/shelters to show existing shelters.
