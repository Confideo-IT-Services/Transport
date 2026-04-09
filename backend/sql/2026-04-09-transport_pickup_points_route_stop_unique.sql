-- Transport: make route_stop_id upsertable via ON CONFLICT
-- Replaces partial unique index with a normal unique index.
-- Postgres unique indexes already allow multiple NULLs, so this is safe.

DROP INDEX IF EXISTS uq_transport_pickup_points_route_stop;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_pickup_points_route_stop
  ON transport_pickup_points (school_id, route_stop_id);

