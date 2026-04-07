# Transport module — Cursor / new-machine handoff

**Read this first** when opening `ConventPulse` on a new laptop. It replaces lost chat history: what was built, where it lives, env/migrations, and what is still TODO.

## Quick pointer for the AI

- **Transport UI + driver app:** `ConventPulse/Transport/` (Vite alias `@transport` in root `vite.config.ts`).
- **Transport API:** `backend/routes/transport.js` — mounted at **`/api/transport`** in `backend/server.js`.
- **Database:** **PostgreSQL** (RDS). Same pool as `backend/config/database.js` (`pg` + `?` → `$n` translation). Not MySQL for this module.
- **Main app** (students, fees, etc.) may still be documented elsewhere as MySQL; **transport** uses the Postgres env vars in `backend/.env.example`.

## What is already done

### Maps (Amazon Location + MapLibre)

- **`Transport/components/AwsLocationMap.tsx`**: Uses **Maps v2** style descriptor URLs (`/v2/styles/Standard/descriptor`), not legacy `/maps/v0/...`. Avoids double-wrapping URLs that already go through `/transport/maps-proxy`. `mapConfig` stabilized with **`useMemo`** so `useEffect` does not re-init the map in a loop. Error overlay / 403 handling so the container is not thrashed.
- **Backend** `GET /api/transport/maps-proxy`: server-side tile/style fetch when **`VITE_AWS_LOCATION_USE_MAP_PROXY=true`** in `Transport/.env`; requires **`AWS_LOCATION_API_KEY`** in **`backend/.env`**.
- **`backend/server.js`**: `dotenv` loads **`path.join(__dirname, '.env')`** so the API key resolves regardless of cwd.
- Direct browser tiles: set **`VITE_AWS_LOCATION_USE_MAP_PROXY=false`** and **`VITE_AWS_LOCATION_API_KEY`** in `Transport/.env` if CORS/key setup allows.

### Fleet schema & APIs (PostgreSQL)

- **Migrations (run in order on the same DB as `DB_*`):**
  1. `backend/sql/2026-04-06-transport_drivers.sql`
  2. `backend/sql/2026-04-08-transport_fleet.sql` — `transport_buses`, `transport_routes`, `transport_route_stops`; replaces legacy **text** `bus_id` / `route_id` on drivers with **UUID FKs** (`bus_id`, `morning_route_id`, `evening_route_id`).
- **After `2026-04-08`:** re-assign drivers to buses/routes in the admin UI (old text IDs are gone).

### Transport admin UI

- **`Transport/pages/TransportDriversPage.tsx`**: Loads **buses** and **routes** from API; **Add bus**, **Add route** (with stops), **Add driver**, **Edit** driver (PATCH assignments).
- **`Transport/components/RouteStopsBuilder.tsx`**: Debounced **Places autocomplete** → **GetPlace** for lat/lng; ordered stops; optional JSON/advanced path.
- **`Transport/lib/transportApi.ts`**: HTTP helpers for buses, routes, drivers, Places, `patchTransportDriverAssignment`, driver profile types.

### Places (server-side, key on backend)

- **`GET /api/transport/places/autocomplete`** — Amazon Location Places v2 Autocomplete (POST body: `QueryText`, `BiasPosition`, optional `Filter.IncludeCountries`).
- **`GET /api/transport/places/details`** — resolves `placeId` (GetPlace) for coordinates.
- **Env:** `AWS_LOCATION_API_KEY`, optional `AWS_PLACES_BIAS_LNG` / `AWS_PLACES_BIAS_LAT`, `AWS_PLACES_REGION`, **`AWS_PLACES_INCLUDE_COUNTRIES`** (default `IND`; set **empty string** to disable country filter). See `backend/.env.example`.

### Driver app

- **`POST /api/transport/driver/login`**, **`GET /api/transport/driver/me`** (JWT), profile includes morning/evening stops (ordered asc/desc) via `buildDriverResponse` in `transport.js`.
- **`Transport/driver/DriverRoutePage.tsx`**: Uses **`fetchDriverProfile`** with JWT for RDS; demo path may still use mock where wired.
- Session fields extended in **`Transport/driverSession.ts`** / **`DriverLogin.tsx`** (`busName`, `morningRouteId`, `eveningRouteId`, etc.).

### Auth for transport admin

- Header **`X-Transport-Admin-Secret`** must match **`TRANSPORT_ADMIN_SECRET`** (and **`VITE_TRANSPORT_ADMIN_SECRET`** in Transport), **or** Bearer JWT as **school admin / superadmin**.

## What is NOT done yet (intentional / backlog)

| Item | Notes |
|------|--------|
| **Live bus GPS / map tracking** | No **AWS Location Trackers** integration yet — no `BatchUpdateDevicePosition`, no live position read on the map. Add when Trackers exist in AWS. |
| **RFID / attendance → parents** | Attendance UIs exist; full backend events + WhatsApp/SMS pipeline not fully wired as end-to-end production flow. |
| **Parent app ETA / alerts** | Not integrated with parent dashboard. |
| **Production hardening** | Tighten driver JWT lifecycle; restrict or remove demo driver accounts in prod; gate/remove `localStorage` mock keys when APIs are fully live. |

## Key files (bookmark)

| Area | Path |
|------|------|
| Transport routes + Places + maps-proxy | `backend/routes/transport.js` |
| SQL migrations | `backend/sql/2026-04-06-transport_drivers.sql`, `backend/sql/2026-04-08-transport_fleet.sql` |
| Map component | `Transport/components/AwsLocationMap.tsx` |
| Drivers / fleet UI | `Transport/pages/TransportDriversPage.tsx` |
| Stop builder | `Transport/components/RouteStopsBuilder.tsx` |
| API client | `Transport/lib/transportApi.ts` |
| Env template | `backend/.env.example`, `Transport/.env` (Vite; do not commit secrets) |

## New machine checklist

1. Clone/copy the repo; open **`ConventPulse`** in Cursor.
2. **`backend/`**: `npm install`, copy **`backend/.env.example`** → **`.env`**, set `DB_*`, `TRANSPORT_ADMIN_SECRET`, `AWS_LOCATION_API_KEY` (and Places options if needed).
3. Run SQL migrations on RDS if DB is fresh.
4. **`Transport/`** or repo root: install deps per project README; set **`Transport/.env`** (`VITE_API_URL`, `VITE_TRANSPORT_ADMIN_SECRET`, Amazon Location vars).
5. Read **`Transport/TRANSPORT_MODULE_STEPS.md`** for routes/URLs; this file for **status vs backlog**.

---

*Last updated for laptop migration handoff — keep in sync when you ship major Transport changes.*
