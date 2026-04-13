# NFC Feature (Web NFC) — Implementation Guide

This project uses the **Web NFC API** (no extra npm package) to scan NFC/RFID cards from a phone and feed the UID into the Transport module.

> Important: Web NFC is **browser/OS-limited**. It works best on **Android Chrome** in a **secure context** (HTTPS). `http://localhost` is allowed, but `http://<LAN-IP>` may be blocked for NFC because it’s not secure.

---

## 1) What Web NFC provides

Web NFC exposes the `NDEFReader` API in supported browsers. When a user taps a tag/card:

- `NDEFReader.onreading` fires with a `serialNumber` (best-effort).
- We use that `serialNumber` string as the **tag UID** in the app.

This repo uses:

- `event.serialNumber` → stored as `tag_uid` in DB and used in scans.

---

## 2) Supported devices / browsers

- **Android**: Chrome (recommended) supports Web NFC.
- **iOS Safari**: does **not** support Web NFC (so browser-based NFC scanning will not work).

### Secure context requirement

Web NFC typically requires:

- `https://...` (recommended), or
- `http://localhost` (special exception)

Many phones will **not** allow Web NFC on `http://<your-laptop-ip>:<port>` (LAN HTTP). If NFC shows “not supported” on LAN HTTP, switch to HTTPS for dev testing.

---

## 3) Packages / dependencies

### No npm package needed

We do **not** install any NFC library.

We use the platform API:

- `NDEFReader`

---

## 4) Core implementation steps (high level)

### Step A — Create an NFC helper

Create a small helper module that:

- checks support (`window.NDEFReader`)
- starts scanning via `reader.scan()`
- resolves once on the first `onreading` event
- returns a UID string (here: `serialNumber`)
- enforces a timeout to avoid hanging scans

In this repo:

- `Transport/lib/nfc.ts`

Key functions:

- `isWebNfcSupported()`
- `scanOneNfcTagSerialNumber({ timeoutMs })`

### Step B — Add minimal TypeScript typings

TypeScript projects often lack `NDEFReader` typings by default. Add a minimal declaration.

In this repo:

- `src/vite-env.d.ts` declares `class NDEFReader` and its handlers.

### Step C — Use NFC result in the UI

#### Admin: Add RFID tags by tapping

UI flow:

1. User clicks **Add via NFC**
2. Start scan (`scanOneNfcTagSerialNumber`)
3. On success, call backend create tag API with `tagUid`

In this repo:

- `Transport/pages/TransportRfidTagsPage.tsx`
- Calls `createRfidTag({ schoolId, tagUid, tagName })`

#### Driver: Mark attendance by tapping

UI flow:

1. Driver clicks **Scan onboard** or **Scan offboard**
2. Start scan (`scanOneNfcTagSerialNumber`)
3. On success, submit scan to backend (`/api/transport/attendance/scan`)

In this repo:

- `Transport/driver/DriverAttendancePage.tsx`
- Calls `driverAttendanceScan(jwt, { tagUid, tripType, direction })`

---

## 5) Backend requirements

### A) RFID tags must exist and be assigned

The scan endpoint resolves the tag:

- `transport_rfid_tags.tag_uid` must exist
- `transport_rfid_tags.assigned_student_id` must be set

Otherwise the backend returns errors like:

- `Unknown RFID` (tag not created)
- `RFID not assigned` (tag exists but not linked to a child)

### B) Who is allowed to scan

The scan endpoint is:

- `POST /api/transport/attendance/scan`

Auth should allow:

- a scanner secret header (`X-Transport-Scanner-Secret`) for dedicated devices, and/or
- driver/admin authenticated requests if using phone-based scanning

In this repo, the driver web app uses a driver JWT to submit scans.

---

## 6) Common issues / troubleshooting

### “NFC not supported”

Usually means one of:

- iOS Safari (not supported)
- using an unsupported browser
- not running in secure context (LAN HTTP is often blocked)

### “serialNumber not available”

Some tags/cards do not expose `serialNumber` to the Web NFC API. In that case:

- Try a different tag
- Fall back to manual UID entry
- Consider a dedicated reader device (Arduino/ESP32) or native mobile app for guaranteed UID access

### Permissions

Web NFC requires a user gesture. Always start scanning from a button click (which this repo does).

---

## 7) Where it is wired in this codebase

- **NFC helper**: `Transport/lib/nfc.ts`
- **TS typings**: `src/vite-env.d.ts`
- **Admin RFID add (tap to add)**: `Transport/pages/TransportRfidTagsPage.tsx`
- **Driver attendance (tap to scan)**: `Transport/driver/DriverAttendancePage.tsx`
- **Driver scan API helper**: `Transport/lib/transportApi.ts` (`driverAttendanceScan`)
- **Backend scan endpoint**: `backend/routes/transport.js` (`POST /attendance/scan`)

