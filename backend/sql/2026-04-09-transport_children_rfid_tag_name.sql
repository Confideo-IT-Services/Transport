-- Transport: child registration table + RFID tag display name
-- Run after:
-- - 2026-04-07-transport_rfid_pickup_points.sql
-- - 2026-04-07-transport_attendance_rfid.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Minimal child registry for Transport module (separate from main "students" domain).
CREATE TABLE IF NOT EXISTS transport_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  child_name TEXT NOT NULL,
  gender TEXT,
  parent_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_children_school ON transport_children (school_id);

-- Optional RFID-friendly name/label for admin UI.
ALTER TABLE transport_rfid_tags
  ADD COLUMN IF NOT EXISTS tag_name TEXT;

