-- ============================================================
--  FleetCore — RLS Fix for authenticated users
--  Run this in Supabase SQL Editor
-- ============================================================

-- Drop old open policies and replace with auth-aware ones
-- These allow any authenticated user to perform operations

-- ── ASSETS ──
DROP POLICY IF EXISTS "Allow all" ON assets;
CREATE POLICY "Authenticated users can manage assets"
  ON assets FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── LOCATIONS ──
DROP POLICY IF EXISTS "Allow all" ON locations;
CREATE POLICY "Authenticated users can manage locations"
  ON locations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── TRANSFERS ──
DROP POLICY IF EXISTS "Allow all" ON transfers;
CREATE POLICY "Authenticated users can manage transfers"
  ON transfers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── CATEGORIES ──
DROP POLICY IF EXISTS "Allow all categories" ON categories;
CREATE POLICY "Authenticated users can manage categories"
  ON categories FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── PROVIDER SETTINGS ──
DROP POLICY IF EXISTS "Allow all provider_settings" ON provider_settings;
CREATE POLICY "Authenticated users can manage providers"
  ON provider_settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── STORAGE ──
-- Re-do storage policies to allow authenticated users
DROP POLICY IF EXISTS "Public read"   ON storage.objects;
DROP POLICY IF EXISTS "Public upload" ON storage.objects;
DROP POLICY IF EXISTS "Public update" ON storage.objects;
DROP POLICY IF EXISTS "Public delete" ON storage.objects;

CREATE POLICY "Auth read storage"   ON storage.objects FOR SELECT USING (bucket_id = 'fleetcore-files' AND auth.role() = 'authenticated');
CREATE POLICY "Auth upload storage" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fleetcore-files' AND auth.role() = 'authenticated');
CREATE POLICY "Auth update storage" ON storage.objects FOR UPDATE USING (bucket_id = 'fleetcore-files' AND auth.role() = 'authenticated');
CREATE POLICY "Auth delete storage" ON storage.objects FOR DELETE USING (bucket_id = 'fleetcore-files' AND auth.role() = 'authenticated');

-- Verify all policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('assets','locations','transfers','categories','provider_settings')
ORDER BY tablename;
