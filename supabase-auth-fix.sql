-- ============================================================
--  FleetCore — Auth Fix Migration
--  Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create user_profiles table if not exists
CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  full_name    TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  is_active    BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create user_permissions table if not exists
CREATE TABLE IF NOT EXISTS user_permissions (
  id           TEXT        PRIMARY KEY,
  user_id      UUID        REFERENCES user_profiles(id) ON DELETE CASCADE,
  permissions  JSONB       NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Drop and recreate policies cleanly
DO $$
BEGIN
  -- user_profiles policies
  DROP POLICY IF EXISTS "Users can read own profile"     ON user_profiles;
  DROP POLICY IF EXISTS "Admins can read all profiles"   ON user_profiles;
  DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
  DROP POLICY IF EXISTS "Allow insert own profile"       ON user_profiles;
  DROP POLICY IF EXISTS "Allow all profiles"             ON user_profiles;
  -- user_permissions policies
  DROP POLICY IF EXISTS "Users read own perms"           ON user_permissions;
  DROP POLICY IF EXISTS "Admins manage all perms"        ON user_permissions;
  DROP POLICY IF EXISTS "Allow all permissions"          ON user_permissions;
END $$;

-- Simple open policies (restrict later when needed)
CREATE POLICY "Allow all profiles"    ON user_profiles    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all permissions" ON user_permissions FOR ALL USING (true) WITH CHECK (true);

-- 5. Recreate trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN (SELECT COUNT(*) FROM public.user_profiles) = 0 THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. IMPORTANT: Sync existing auth.users that have no profile yet
INSERT INTO public.user_profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'user' -- will be upgraded to admin below if first
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id = u.id
)
ORDER BY u.created_at;

-- 7. Make the OLDEST user an admin (the first one who registered)
UPDATE public.user_profiles
SET role = 'admin', updated_at = NOW()
WHERE id = (
  SELECT p.id FROM public.user_profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at ASC
  LIMIT 1
);

-- 8. Show result
SELECT
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  u.created_at as registered_at
FROM user_profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY u.created_at;
