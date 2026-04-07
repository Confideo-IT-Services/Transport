-- Daily trip status per bus (started / active / ended) for admin dashboards.
-- Run after 2026-04-08-transport_fleet.sql.

CREATE TABLE IF NOT EXISTS transport_bus_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES transport_buses (id) ON DELETE CASCADE,
  driver_id UUID REFERENCES transport_drivers (id) ON DELETE SET NULL,
  trip_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::date,
  trip_type TEXT NOT NULL CHECK (trip_type IN ('morning', 'evening')),
  status TEXT NOT NULL CHECK (status IN ('idle', 'active', 'ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bus_id, trip_date, trip_type)
);

CREATE INDEX IF NOT EXISTS idx_transport_bus_trips_bus_date ON transport_bus_trips (bus_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_transport_bus_trips_status_date ON transport_bus_trips (status, trip_date);

