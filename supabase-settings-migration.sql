-- ── Run this in Supabase SQL Editor to add provider settings table ──
CREATE TABLE IF NOT EXISTS provider_settings (
  id           TEXT        PRIMARY KEY,
  provider     TEXT        NOT NULL,
  label        TEXT        NOT NULL,
  token        TEXT        NOT NULL,
  base_url     TEXT,
  extra        JSONB       DEFAULT '{}',
  is_active    BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON provider_settings FOR ALL USING (true) WITH CHECK (true);
