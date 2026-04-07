-- Transport: RFID tags + pickup points + student transport assignment
-- Run on the same PostgreSQL DB as students + transport_* tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS transport_rfid_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  tag_uid TEXT NOT NULL,
  assigned_student_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, tag_uid),
  UNIQUE (assigned_student_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_rfid_tags_school ON transport_rfid_tags (school_id);

CREATE TABLE IF NOT EXISTS transport_pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_pickup_points_school ON transport_pickup_points (school_id);

CREATE TABLE IF NOT EXISTS transport_student_assignments (
  student_id UUID PRIMARY KEY,
  school_id UUID NOT NULL,
  pickup_point_id UUID REFERENCES transport_pickup_points (id) ON DELETE SET NULL,
  rfid_tag_id UUID REFERENCES transport_rfid_tags (id) ON DELETE SET NULL,
  bus_id UUID REFERENCES transport_buses (id) ON DELETE SET NULL,
  route_id UUID REFERENCES transport_routes (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_student_assignments_school ON transport_student_assignments (school_id);

