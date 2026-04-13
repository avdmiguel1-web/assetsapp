-- Add categories table
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  color      TEXT        DEFAULT '#1d6fef',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'categories' AND policyname = 'Allow all categories'
  ) THEN
    CREATE POLICY "Allow all categories" ON categories
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default categories
INSERT INTO categories (id, name) VALUES
  ('cat-01', 'Maquinaria Pesada'),
  ('cat-02', 'Maquinaria Ligera'),
  ('cat-03', 'Vehículos (Flota)'),
  ('cat-04', 'Equipos Industriales'),
  ('cat-05', 'Equipos de TI')
ON CONFLICT (id) DO NOTHING;
