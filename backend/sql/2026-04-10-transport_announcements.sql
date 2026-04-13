-- Transport: announcements (title + message) for in-app parent notifications
-- Run on the same PostgreSQL DB as transport_* tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS transport_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  bus_id UUID NULL REFERENCES transport_buses (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by_user_id UUID NULL,
  created_by_role TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_announcements_school_created
  ON transport_announcements (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transport_announcements_bus_created
  ON transport_announcements (bus_id, created_at DESC);

