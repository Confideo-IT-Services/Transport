-- Transport drivers (school bus) — login + assignment. Run against your app database (e.g. conventpulse).
-- Requires: CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS transport_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  license_no TEXT,
  bus_id TEXT,
  route_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_drivers_email ON transport_drivers (email);

-- If you created an older transport_drivers without these columns, add them:
ALTER TABLE transport_drivers ADD COLUMN IF NOT EXISTS license_no TEXT;
ALTER TABLE transport_drivers ADD COLUMN IF NOT EXISTS bus_id TEXT;
ALTER TABLE transport_drivers ADD COLUMN IF NOT EXISTS route_id TEXT;
