CREATE TABLE IF NOT EXISTS countries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  flag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'countries'
      AND policyname = 'Allow all countries'
  ) THEN
    CREATE POLICY "Allow all countries"
      ON countries FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO countries (id, name, flag)
VALUES
  ('country-ve', 'Venezuela', '🇻🇪'),
  ('country-co', 'Colombia', '🇨🇴')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    flag = EXCLUDED.flag;
