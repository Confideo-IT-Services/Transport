-- Transport: add child address for pickup-point suggestion
-- Run after:
-- - 2026-04-09-transport_children_rfid_tag_name.sql

ALTER TABLE transport_children
  ADD COLUMN IF NOT EXISTS address TEXT;

