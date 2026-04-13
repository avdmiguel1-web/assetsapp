-- ============================================================
--  FleetCore — Supabase Schema
--  Ejecuta esto en: Supabase > SQL Editor > New query
-- ============================================================

-- ── 1. LOCATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  country     TEXT        NOT NULL,
  address     TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON locations FOR ALL USING (true) WITH CHECK (true);

-- ── 2. ASSETS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id                  TEXT        PRIMARY KEY,
  asset_id            TEXT,
  plate               TEXT,
  brand               TEXT        NOT NULL,
  model               TEXT        NOT NULL,
  category            TEXT,
  status              TEXT        DEFAULT 'Operativo',
  country             TEXT,
  location            TEXT,
  location_id         TEXT        REFERENCES locations(id) ON DELETE SET NULL,
  description         TEXT,
  has_telemetry       BOOLEAN     DEFAULT FALSE,
  flespi_device_id    TEXT,
  profile_photo       TEXT,        -- URL (Supabase Storage) or base64 fallback
  profile_photo_path  TEXT,        -- Storage path for deletion
  docs                JSONB       DEFAULT '[]',
  invoices            JSONB       DEFAULT '[]',
  repairs             JSONB       DEFAULT '[]',
  accessories         JSONB       DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON assets FOR ALL USING (true) WITH CHECK (true);

-- ── 3. TRANSFERS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfers (
  id            TEXT        PRIMARY KEY,
  asset_id      TEXT        REFERENCES assets(id) ON DELETE CASCADE,
  from_location TEXT,
  from_country  TEXT,
  to_location   TEXT,
  to_country    TEXT,
  ts            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON transfers FOR ALL USING (true) WITH CHECK (true);

-- ── 4. STORAGE BUCKET ───────────────────────────────────────
-- Ejecuta esto también en SQL Editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('fleetcore-files', 'fleetcore-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'fleetcore-files');

CREATE POLICY "Public upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'fleetcore-files');

CREATE POLICY "Public update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'fleetcore-files');

CREATE POLICY "Public delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'fleetcore-files');

-- ── 5. PROVIDER SETTINGS ─────────────────────────────────────
-- Stores GPS provider credentials (tokens encrypted client-side)
CREATE TABLE IF NOT EXISTS provider_settings (
  id           TEXT        PRIMARY KEY,
  provider     TEXT        NOT NULL,  -- 'flespi' | 'wialon' | 'traccar' | etc.
  label        TEXT        NOT NULL,  -- user-defined name e.g. "Flota Principal"
  token        TEXT        NOT NULL,  -- API token (AES-encrypted before storage)
  base_url     TEXT,                  -- optional override
  extra        JSONB       DEFAULT '{}', -- provider-specific config
  is_active    BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON provider_settings FOR ALL USING (true) WITH CHECK (true);
