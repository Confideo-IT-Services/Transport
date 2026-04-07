# Transport module — implementation steps

This document tracks the **Transport admin console** under `ConventPulse/Transport/`. **Current status, env, migrations, and backlog** (for a new laptop / Cursor): see **`TRANSPORT_CURSOR_HANDOFF.md`** in this folder.

## Completed (UI shell)

1. **Project wiring**
   - Vite alias `@transport` → `ConventPulse/Transport/`.
   - TypeScript `include`: `src` and `Transport`.
   - React Router routes under `/transport/*` in `src/App.tsx`.

2. **Demo authentication**
   - Local session in `localStorage` (`transportSession.ts`).
   - Credentials: `transport@conventpulse.edu` / `Transport@123` (replace with backend login later).

3. **Layout & navigation**
   - `TransportLayout.tsx`: sidebar (Overview, Parents, Drivers, **Buses**, **Routes**, Attendance).
   - `TransportDashboard.tsx`: four feature cards matching the product brief.

4. **Parents & children**
   - `pages/TransportParentsPage.tsx`: register child, list with parent name and phone, assign bus, remove row.
   - Mock persistence: `mock/mockStore.ts` + `localStorage` key `cp_transport_mock_parents`.

5. **Drivers (PostgreSQL / RDS)**
   - Run `backend/sql/2026-04-06-transport_drivers.sql` on the same database as `DB_NAME` in the backend `.env`.
   - **Backend**: `POST /api/transport/drivers`, `GET /api/transport/drivers` (mounted at `/api/transport`). Auth: header `X-Transport-Admin-Secret` (`TRANSPORT_ADMIN_SECRET`) **or** Bearer JWT with role `admin` / `superadmin`.
   - **Frontend**: `TransportDriversPage` loads and creates drivers via `Transport/lib/transportApi.ts`. Set `VITE_TRANSPORT_ADMIN_SECRET` in **`Transport/.env`** (merged by Vite with root `.env`; Transport wins on duplicate keys). Do not commit real secrets.
   - **Fleet (PostgreSQL):** After `backend/sql/2026-04-08-transport_fleet.sql`, buses/routes/stops and driver assignments use **UUIDs** from the API (`TransportDriversPage` + `transportApi.ts`). Re-assign drivers if you migrated from older text IDs.

6. **Buses (PostgreSQL / RDS fleet)**
   - `pages/TransportBusesPage.tsx`: lists buses from API and can create buses (`POST /api/transport/buses`).
   - `pages/TransportBusDetailPage.tsx`: shows route checkpoints + map for the bus using DB routes/stops (derived via driver assignment).

7. **Routes (PostgreSQL / RDS)**
   - `pages/TransportRoutesPage.tsx`: lists routes from API, shows whether a route is assigned (referenced by any driver), and which bus/driver uses it.
   - `pages/TransportRouteDetailPage.tsx`: route details with checkpoint list + map preview, and **Modify route** (PATCH route + replace stops).

8. **Attendance (RFID)**
   - `pages/TransportAttendancePage.tsx`: per-bus summary (currently 0 scanned on DB buses; waits for real RFID events).
   - `pages/TransportBusAttendancePage.tsx`: seat grid (currently all unscanned for DB buses; waits for real RFID events).

9. **Route detail (bus)**
   - `components/RouteCheckpointTimeline.tsx` — metro-style covered / current / upcoming checkpoints.
   - `components/AwsLocationMap.tsx` / `MapPlaceholder.tsx` — **Amazon Location Service** (MapLibre).
     - Supports stop markers + (optionally) a **road-following path** when `routeLineString` is provided.
   - **Routes API (road-snapped)**:
     - Backend: `POST /api/transport/routes/calculate` calls Amazon Location **Routes V2** and returns a `LineString`.
     - Frontend: `calculateTransportRouteLine()` used for admin preview; `calculateTransportRouteLineWithJwt()` used for driver map (Bearer JWT).

10. **Driver console (RDS + demo fallback)**
   - **Backend**: `POST /api/transport/driver/login` — returns JWT and driver profile (`busId`, `routeId` from DB). Mounted at `/api/transport/driver/login`.
   - `driverSession.ts` — session stores `driverId` (UUID from RDS or `drv-*` for demo), optional `token`, `email`, `fullName`, `busId`, `mockDriverId`, plus bus info (`busName`, `busRegistrationNo`, `busCapacity`).
   - `driver/DriverLogin.tsx` — tries RDS login first; on network/server errors falls back to demo accounts: `ramesh.driver@conventpulse.edu` / `Driver@123` (drv-1, Bus A), `sunil.driver@conventpulse.edu` / `Driver@123` (drv-2, Bus B). **401 from API** does not fall back to demo (wrong password).
   - Driver UI resolves the bus via `session.busId` (or demo mapping) so UUID drivers work without mock `getDriverById`.
   - `driver/DriverLayout.tsx` — sidebar: Today, Route & map, Attendance.
   - `driver/DriverHomePage.tsx` — **Start trip** (demo: notify parents to get ready), **End tour** (evening; saves day row + demo notification log).
     - Updated to support **two trips** per driver: **morning** and **evening** with separate Start/End actions.
   - `mock/driverTripStore.ts` — per-day trip state, parent notify log, completed run history (`localStorage`).
   - `components/SeatBoardingGrid.tsx` — shared seat grid (admin attendance page uses it too).

## Next steps (backend & AWS)

| Step | Task |
|------|------|
| A | Optional: tighten `transport_driver` JWT claims / refresh; remove or further restrict demo accounts in production. |
| B | **Live GPS**: AWS Location **Trackers** + device position updates (`BatchUpdateDevicePosition`) and map read path — **not implemented yet**; see `TRANSPORT_CURSOR_HANDOFF.md`. |
| C | **Amazon Location**: geofences for stops as needed; route calculator is now present via `/api/transport/routes/calculate`. |
| D | **Notifications**: on RFID onboard event, enqueue SMS/WhatsApp to parent (reuse existing WhatsApp module if applicable). |
| E | Parent app: bus ETA and onboarding alerts (integrate with parent dashboard). |
| F | **RFID events** / production tables (`transport_rfid_events`, etc.) if not already aligned with attendance UI. |
| G | Remove or gate `localStorage` mock seed keys (`cp_transport_mock_*`) when APIs are fully live for each screen. |
| H | (Optional) Persist trip start/end to DB once production tracking/attendance is implemented (currently demo localStorage). |

**Done vs fleet schema:** buses, routes, ordered stops, driver morning/evening assignments, Places autocomplete for building routes — see handoff file.

## Local URLs

| URL | Purpose |
|-----|---------|
| `/transport/login` | Transport admin sign-in |
| `/transport` | Overview cards |
| `/transport/parents` | Parents & children |
| `/transport/drivers` | Drivers |
| `/transport/buses` | Buses list; link to detail |
| `/transport/routes` | Routes list (assigned vs unassigned) |
| `/transport/routes/:routeId` | Route details + modify |
| `/transport/buses/:busId` | Route + mock live stop |
| `/transport/attendance` | RFID summary per bus |
| `/transport/attendance/:busId` | Seat grid |
| `/transport/driver/login` | Driver sign-in |
| `/transport/driver` | Driver: today (start / end tour) |
| `/transport/driver/my-route` | Driver: checkpoints + map; can toggle **morning/evening** |
| `/transport/driver/attendance` | Driver: same seat attendance UI |

## Mock data reset

Clear browser `localStorage` keys prefixed with `cp_transport_mock_`, `cp_transport_admin_session`, `cp_transport_driver_session`, `cp_transport_driver_jwt`, `cp_transport_driver_trip_`, `cp_transport_driver_notify_log`, `cp_transport_driver_trip_history`, or use DevTools → Application → Local storage → clear.
