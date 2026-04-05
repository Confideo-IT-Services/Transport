-- Migration: Remove exact duplicate time_slots and add a UNIQUE index
-- Run this in two steps on PostgreSQL (index MUST be created CONCURRENTLY outside a transaction):

-- 1) Remove exact duplicate rows (safe to run in a transaction)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY school_id, start_time, end_time, type ORDER BY created_at NULLS LAST, id) as rn
  FROM time_slots
)
DELETE FROM time_slots WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2) Create unique index to enforce uniqueness at DB level
-- Run this command separately (NOT inside a transaction):
-- CREATE UNIQUE INDEX CONCURRENTLY unique_slot_school_times ON time_slots (school_id, start_time, end_time, type);

-- NOTE: To run both steps from psql you can do:
-- 1) psql -d yourdb -f 2026-04-05-add-unique-time-slots.sql
--    (this will execute the DELETE part)
-- 2) Then in psql run the CREATE INDEX CONCURRENTLY line manually.

-- Alternatively, run the helper script:
-- node backend/scripts/add-unique-time-slots.js
-- which runs both steps (the CREATE INDEX CONCURRENTLY call is executed by the script).
