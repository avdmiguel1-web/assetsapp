-- ============================================================
--  FleetCore — Auth & Roles Migration
--  Run in Supabase SQL Editor
-- ============================================================

-- ── 1. USER PROFILES (linked to Supabase Auth) ──────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL,
  full_name    TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  is_active    BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"    ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles"  ON user_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update all profiles" ON user_profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── 2. USER PERMISSIONS ─────────────────────────────────────
-- Stores per-user permission overrides set by admin
CREATE TABLE IF NOT EXISTS user_permissions (
  id           TEXT        PRIMARY KEY,
  user_id      UUID        REFERENCES user_profiles(id) ON DELETE CASCADE,
  permissions  JSONB       NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own perms"   ON user_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all perms" ON user_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ── 3. Auto-create profile on signup ────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    -- First user ever becomes admin
    CASE WHEN (SELECT COUNT(*) FROM public.user_profiles) = 0 THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
