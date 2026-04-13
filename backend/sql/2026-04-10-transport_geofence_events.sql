-- Transport: geofence-style events (bus reached pickup point) + notification dedupe
-- Run after transport_fleet + transport_pickup_points_route_stops + transport_trips

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS transport_geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL,
  trip_date DATE NOT NULL,
  trip_type TEXT NOT NULL,
  route_stop_id UUID NULL REFERENCES transport_route_stops (id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_geofence_events_dedupe
  ON transport_geofence_events (bus_id, trip_date, trip_type, route_stop_id, event_type);

CREATE INDEX IF NOT EXISTS idx_transport_geofence_events_bus_trip
  ON transport_geofence_events (bus_id, trip_date, trip_type, created_at DESC);

