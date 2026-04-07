-- Transport: RFID scan attendance (boarded / offboarded) per bus & trip.
-- Run after:
-- - 2026-04-08-transport_fleet.sql
-- - 2026-04-07-transport_rfid_pickup_points.sql (for transport_rfid_tags)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS transport_attendance_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES transport_buses (id) ON DELETE CASCADE,
  trip_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::date,
  trip_type TEXT NOT NULL CHECK (trip_type IN ('morning', 'evening')),
  direction TEXT NOT NULL CHECK (direction IN ('on', 'off')),
  tag_uid TEXT NOT NULL,
  student_id UUID,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_attendance_scans_bus_date ON transport_attendance_scans (bus_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_transport_attendance_scans_bus_trip ON transport_attendance_scans (bus_id, trip_date, trip_type);
CREATE INDEX IF NOT EXISTS idx_transport_attendance_scans_tag ON transport_attendance_scans (tag_uid, trip_date);

-- Latest state per student per trip (green/red source)
CREATE TABLE IF NOT EXISTS transport_bus_boarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES transport_buses (id) ON DELETE CASCADE,
  trip_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::date,
  trip_type TEXT NOT NULL CHECK (trip_type IN ('morning', 'evening')),
  student_id UUID NOT NULL,
  tag_uid TEXT,
  status TEXT NOT NULL CHECK (status IN ('on', 'off')),
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bus_id, trip_date, trip_type, student_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_bus_boarding_bus_trip ON transport_bus_boarding (bus_id, trip_date, trip_type);

