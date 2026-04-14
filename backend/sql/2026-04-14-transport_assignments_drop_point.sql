-- Transport: add drop_point_id (evening) to student assignments
-- Run after backend/sql/2026-04-07-transport_rfid_pickup_points.sql

ALTER TABLE transport_student_assignments
  ADD COLUMN IF NOT EXISTS drop_point_id UUID REFERENCES transport_pickup_points (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transport_student_assignments_drop_point
  ON transport_student_assignments (drop_point_id);

