-- Buses, routes, stops, and driver assignments (morning + evening routes).
-- Run after 2026-04-06-transport_drivers.sql. Replaces legacy TEXT bus_id / route_id on drivers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS transport_buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_no TEXT,
  capacity INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transport_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES transport_routes (id) ON DELETE CASCADE,
  sequence_order INT NOT NULL,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  UNIQUE (route_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_transport_route_stops_route ON transport_route_stops (route_id);

-- Replace legacy TEXT columns with UUID FKs (existing mock string IDs are dropped — re-assign in admin).
ALTER TABLE transport_drivers DROP COLUMN IF EXISTS bus_id;
ALTER TABLE transport_drivers DROP COLUMN IF EXISTS route_id;

ALTER TABLE transport_drivers
  ADD COLUMN IF NOT EXISTS bus_id UUID REFERENCES transport_buses (id) ON DELETE SET NULL;

ALTER TABLE transport_drivers
  ADD COLUMN IF NOT EXISTS morning_route_id UUID REFERENCES transport_routes (id) ON DELETE SET NULL;

ALTER TABLE transport_drivers
  ADD COLUMN IF NOT EXISTS evening_route_id UUID REFERENCES transport_routes (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transport_drivers_bus ON transport_drivers (bus_id);
