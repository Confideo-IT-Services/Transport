-- Transport: link pickup points to route stops (so bus->pickup points can be derived)
-- Run after:
-- - 2026-04-07-transport_rfid_pickup_points.sql
-- - 2026-04-08-transport_fleet.sql

ALTER TABLE transport_pickup_points
  ADD COLUMN IF NOT EXISTS route_stop_id UUID;

-- One pickup point per route stop (per school). Allows idempotent sync.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_pickup_points_route_stop
  ON transport_pickup_points (school_id, route_stop_id)
  WHERE route_stop_id IS NOT NULL;

