-- Ejecuta esta migracion solo si ya existen las tablas base.
-- Si aun no existen, primero corre `supabase-schema.sql`.

ALTER TABLE IF EXISTS public.locations
  ADD COLUMN IF NOT EXISTS rental_start_date DATE,
  ADD COLUMN IF NOT EXISTS rental_end_date DATE;

ALTER TABLE IF EXISTS public.assets
  ADD COLUMN IF NOT EXISTS rental_start_date DATE,
  ADD COLUMN IF NOT EXISTS rental_end_date DATE,
  ADD COLUMN IF NOT EXISTS rental_start_time TIME,
  ADD COLUMN IF NOT EXISTS rental_end_time TIME;

ALTER TABLE IF EXISTS public.transfers
  ADD COLUMN IF NOT EXISTS from_address TEXT,
  ADD COLUMN IF NOT EXISTS to_address TEXT,
  ADD COLUMN IF NOT EXISTS rental_start_date DATE,
  ADD COLUMN IF NOT EXISTS rental_end_date DATE,
  ADD COLUMN IF NOT EXISTS rental_start_time TIME,
  ADD COLUMN IF NOT EXISTS rental_end_time TIME;
