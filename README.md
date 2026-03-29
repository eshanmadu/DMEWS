# DMEWS – Disaster Management and Early Warning System

A web-based **Disaster Management and Early Warning System** with a separate **Backend** API and **Frontend** app.

## Project structure

```
DMEWS/
├── Backend/     # Express API (alerts, incidents)
├── Frontend/    # Next.js app (Dashboard, Alerts, Incidents, Map)
└── README.md
```

## Backend

- **Stack:** Node.js, Express, TypeScript
- **Endpoints:** `GET /api/alerts`, `GET /api/incidents`, `GET /api/health`
- **Port:** 4000 (configurable via `PORT`)

### Run Backend

```bash
cd Backend
npm install
node server.js
```

API base URL: **http://localhost:4000**

## Frontend

- **Stack:** Next.js 14, React, TypeScript, Tailwind CSS
- **Port:** 3000

### Run Frontend

```bash
cd Frontend
npm install
cp .env.example .env.local   # optional: set NEXT_PUBLIC_API_URL if backend is not on localhost:4000
npm run dev
```

Open **http://localhost:3000**. The app fetches data from the Backend API (`NEXT_PUBLIC_API_URL`, default `http://localhost:4000`).

## Running both

1. Start the **Backend** (terminal 1): `cd Backend && node server.js`
2. Start the **Frontend** (terminal 2): `cd Frontend && npm run dev`
3. Use the app at http://localhost:3000

## Features

- **Dashboard** – Active alerts, open incidents, quick links
- **Alerts** – Early warnings with severity and area
- **Incidents** – Reported disasters and response status
- **Map** – Placeholder for map integration (use Backend API for lat/lng)

## Next steps

- Add a database in **Backend** and replace mock data
- Add auth (e.g. JWT) in **Backend**, protect routes
- Integrate a map (Leaflet/Mapbox) in **Frontend** using Backend API coordinates
- Add real-time updates (WebSockets or SSE)
