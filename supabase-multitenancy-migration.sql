-- ============================================================
-- FleetCore - Multi-tenancy, company branding, feature flags
-- Run in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.slugify_company_name(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(
        regexp_replace(lower(trim(COALESCE(input_text, ''))), '[^a-z0-9]+', '-', 'g'),
        '(^-|-$)',
        '',
        'g'
      ),
      ''
    ),
    'empresa'
  );
$$;

CREATE OR REPLACE FUNCTION public.next_company_slug(base_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_slug TEXT := public.slugify_company_name(base_slug);
  candidate_slug TEXT := normalized_slug;
  counter INTEGER := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = candidate_slug) LOOP
    counter := counter + 1;
    candidate_slug := normalized_slug || '-' || counter::TEXT;
  END LOOP;

  RETURN candidate_slug;
END;
$$;

-- ------------------------------------------------------------
-- Company tables
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_branding (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL DEFAULT 'Gestion de Activos',
  app_subtitle TEXT,
  theme_color TEXT NOT NULL DEFAULT '#0f1f38',
  logo_original TEXT,
  logo_header TEXT,
  logo_icon_32 TEXT,
  logo_icon_192 TEXT,
  logo_icon_512 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_features (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  flags JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gps_devices (
  id TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES public.provider_settings(id) ON DELETE CASCADE,
  external_id TEXT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  platform_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS companies_slug_idx ON public.companies (slug);
CREATE INDEX IF NOT EXISTS gps_devices_company_id_idx ON public.gps_devices (company_id);
CREATE INDEX IF NOT EXISTS gps_devices_provider_id_idx ON public.gps_devices (provider_id);

-- ------------------------------------------------------------
-- Existing schema: add company_id where needed
-- ------------------------------------------------------------

ALTER TABLE IF EXISTS public.user_profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.user_permissions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.transfers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.provider_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.categories ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.countries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.audit_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

DO $$
DECLARE
  fallback_company_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE company_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.assets WHERE company_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.locations WHERE company_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.transfers WHERE company_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.provider_settings WHERE company_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.categories WHERE company_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.countries WHERE company_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.audit_logs WHERE company_id IS NULL) THEN

    INSERT INTO public.companies (slug, name)
    VALUES ('empresa-principal', 'Empresa principal')
    ON CONFLICT (slug) DO UPDATE
      SET updated_at = NOW()
    RETURNING id INTO fallback_company_id;

    UPDATE public.user_profiles
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;

    UPDATE public.user_permissions up
    SET company_id = COALESCE(up.company_id, profile.company_id)
    FROM public.user_profiles profile
    WHERE up.user_id = profile.id
      AND up.company_id IS NULL;

    UPDATE public.assets
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;

    UPDATE public.locations
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;

    UPDATE public.transfers
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;

    UPDATE public.provider_settings
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;

    UPDATE public.categories
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;

    UPDATE public.countries
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;

    UPDATE public.audit_logs
    SET company_id = fallback_company_id
    WHERE company_id IS NULL;
  END IF;
END;
$$;

INSERT INTO public.company_branding (company_id, app_name)
SELECT id, name
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.company_features (company_id)
SELECT id
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

ALTER TABLE IF EXISTS public.user_profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.user_permissions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.assets ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.locations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.transfers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.provider_settings ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.countries ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS user_profiles_company_id_idx ON public.user_profiles (company_id);
CREATE INDEX IF NOT EXISTS user_permissions_company_id_idx ON public.user_permissions (company_id);
CREATE INDEX IF NOT EXISTS assets_company_id_idx ON public.assets (company_id);
CREATE INDEX IF NOT EXISTS locations_company_id_idx ON public.locations (company_id);
CREATE INDEX IF NOT EXISTS transfers_company_id_idx ON public.transfers (company_id);
CREATE INDEX IF NOT EXISTS provider_settings_company_id_idx ON public.provider_settings (company_id);
CREATE INDEX IF NOT EXISTS categories_company_id_idx ON public.categories (company_id);
CREATE INDEX IF NOT EXISTS countries_company_id_idx ON public.countries (company_id);
CREATE INDEX IF NOT EXISTS audit_logs_company_id_idx ON public.audit_logs (company_id);

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_company_id UUID;
BEGIN
  SELECT company_id
  INTO resolved_company_id
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN resolved_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.requester_is_company_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND company_id = public.current_company_id()
      AND role = 'admin'
  )
  INTO is_admin;

  RETURN is_admin;
END;
$$;

-- ------------------------------------------------------------
-- Triggers: updated_at + automatic company_id
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_touch_updated_at ON public.companies;
CREATE TRIGGER companies_touch_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS company_branding_touch_updated_at ON public.company_branding;
CREATE TRIGGER company_branding_touch_updated_at
BEFORE UPDATE ON public.company_branding
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS company_features_touch_updated_at ON public.company_features;
CREATE TRIGGER company_features_touch_updated_at
BEFORE UPDATE ON public.company_features
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS gps_devices_touch_updated_at ON public.gps_devices;
CREATE TRIGGER gps_devices_touch_updated_at
BEFORE UPDATE ON public.gps_devices
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS provider_settings_touch_updated_at_company ON public.provider_settings;
CREATE TRIGGER provider_settings_touch_updated_at_company
BEFORE UPDATE ON public.provider_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS user_profiles_touch_updated_at_company ON public.user_profiles;
CREATE TRIGGER user_profiles_touch_updated_at_company
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS user_permissions_assign_company_id ON public.user_permissions;
CREATE TRIGGER user_permissions_assign_company_id
BEFORE INSERT ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS assets_assign_company_id ON public.assets;
CREATE TRIGGER assets_assign_company_id
BEFORE INSERT ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS locations_assign_company_id ON public.locations;
CREATE TRIGGER locations_assign_company_id
BEFORE INSERT ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS transfers_assign_company_id ON public.transfers;
CREATE TRIGGER transfers_assign_company_id
BEFORE INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS provider_settings_assign_company_id ON public.provider_settings;
CREATE TRIGGER provider_settings_assign_company_id
BEFORE INSERT ON public.provider_settings
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS categories_assign_company_id ON public.categories;
CREATE TRIGGER categories_assign_company_id
BEFORE INSERT ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS countries_assign_company_id ON public.countries;
CREATE TRIGGER countries_assign_company_id
BEFORE INSERT ON public.countries
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS audit_logs_assign_company_id ON public.audit_logs;
CREATE TRIGGER audit_logs_assign_company_id
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

DROP TRIGGER IF EXISTS gps_devices_assign_company_id ON public.gps_devices;
CREATE TRIGGER gps_devices_assign_company_id
BEFORE INSERT ON public.gps_devices
FOR EACH ROW EXECUTE FUNCTION public.assign_company_id();

-- ------------------------------------------------------------
-- Auth profile trigger: one company per self-registration
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  requested_company_id UUID;
  requested_company_name TEXT;
  normalized_company_name TEXT;
  requested_role TEXT;
  company_row public.companies%ROWTYPE;
  next_slug TEXT;
  users_in_company INTEGER := 0;
BEGIN
  requested_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;
  requested_company_name := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'company_name', '')), '');
  requested_role := LOWER(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'role', '')), ''));
  normalized_company_name := COALESCE(
    requested_company_name,
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'company', '')), ''),
    split_part(NEW.email, '@', 2),
    split_part(NEW.email, '@', 1)
  );

  IF requested_company_id IS NOT NULL THEN
    SELECT *
    INTO company_row
    FROM public.companies
    WHERE id = requested_company_id;
  END IF;

  IF company_row.id IS NULL THEN
    next_slug := public.next_company_slug(normalized_company_name);

    INSERT INTO public.companies (slug, name)
    VALUES (next_slug, normalized_company_name)
    RETURNING * INTO company_row;
  END IF;

  INSERT INTO public.company_branding (company_id, app_name)
  VALUES (company_row.id, company_row.name)
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO public.company_features (company_id)
  VALUES (company_row.id)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT COUNT(*)
  INTO users_in_company
  FROM public.user_profiles
  WHERE company_id = company_row.id;

  INSERT INTO public.user_profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''), split_part(NEW.email, '@', 1)),
    CASE
      WHEN users_in_company = 0 THEN 'admin'
      WHEN requested_role IN ('admin', 'user') THEN requested_role
      ELSE 'user'
    END,
    company_row.id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    company_id = EXCLUDED.company_id,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Companies
  DROP POLICY IF EXISTS "Company members can view company" ON public.companies;
  CREATE POLICY "Company members can view company"
    ON public.companies
    FOR SELECT
    USING (id = public.current_company_id());

  DROP POLICY IF EXISTS "Company admins can update company" ON public.companies;
  CREATE POLICY "Company admins can update company"
    ON public.companies
    FOR UPDATE
    USING (id = public.current_company_id() AND public.requester_is_company_admin())
    WITH CHECK (id = public.current_company_id());

  -- Branding
  DROP POLICY IF EXISTS "Company members can view branding" ON public.company_branding;
  CREATE POLICY "Company members can view branding"
    ON public.company_branding
    FOR SELECT
    USING (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Company admins manage branding" ON public.company_branding;
  CREATE POLICY "Company admins manage branding"
    ON public.company_branding
    FOR ALL
    USING (company_id = public.current_company_id() AND public.requester_is_company_admin())
    WITH CHECK (company_id = public.current_company_id());

  -- Features
  DROP POLICY IF EXISTS "Company members can view features" ON public.company_features;
  CREATE POLICY "Company members can view features"
    ON public.company_features
    FOR SELECT
    USING (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Company admins manage features" ON public.company_features;
  CREATE POLICY "Company admins manage features"
    ON public.company_features
    FOR ALL
    USING (company_id = public.current_company_id() AND public.requester_is_company_admin())
    WITH CHECK (company_id = public.current_company_id());

  -- Profiles
  DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
  DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
  DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
  DROP POLICY IF EXISTS "Allow insert own profile" ON public.user_profiles;
  DROP POLICY IF EXISTS "Allow all profiles" ON public.user_profiles;
  DROP POLICY IF EXISTS "Company members can read profiles" ON public.user_profiles;
  CREATE POLICY "Company members can read profiles"
    ON public.user_profiles
    FOR SELECT
    USING (
      company_id = public.current_company_id()
      AND (id = auth.uid() OR public.requester_is_company_admin())
    );

  DROP POLICY IF EXISTS "Company admins manage profiles" ON public.user_profiles;
  CREATE POLICY "Company admins manage profiles"
    ON public.user_profiles
    FOR UPDATE
    USING (company_id = public.current_company_id() AND public.requester_is_company_admin())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
  CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Self insert profile by company" ON public.user_profiles;
  CREATE POLICY "Self insert profile by company"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (
      company_id = public.current_company_id()
      AND (id = auth.uid() OR public.requester_is_company_admin())
    );

  -- Permissions
  DROP POLICY IF EXISTS "Users read own perms" ON public.user_permissions;
  DROP POLICY IF EXISTS "Admins manage all perms" ON public.user_permissions;
  DROP POLICY IF EXISTS "Allow all permissions" ON public.user_permissions;
  DROP POLICY IF EXISTS "Company permissions select" ON public.user_permissions;
  CREATE POLICY "Company permissions select"
    ON public.user_permissions
    FOR SELECT
    USING (
      company_id = public.current_company_id()
      AND (user_id = auth.uid() OR public.requester_is_company_admin())
    );

  DROP POLICY IF EXISTS "Company admins manage permissions" ON public.user_permissions;
  CREATE POLICY "Company admins manage permissions"
    ON public.user_permissions
    FOR ALL
    USING (company_id = public.current_company_id() AND public.requester_is_company_admin())
    WITH CHECK (company_id = public.current_company_id());

  -- Generic company tables
  DROP POLICY IF EXISTS "Tenant assets policy" ON public.assets;
  CREATE POLICY "Tenant assets policy"
    ON public.assets
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Allow all" ON public.assets;

  DROP POLICY IF EXISTS "Tenant locations policy" ON public.locations;
  CREATE POLICY "Tenant locations policy"
    ON public.locations
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Allow all" ON public.locations;

  DROP POLICY IF EXISTS "Tenant transfers policy" ON public.transfers;
  CREATE POLICY "Tenant transfers policy"
    ON public.transfers
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Allow all" ON public.transfers;

  DROP POLICY IF EXISTS "Tenant providers policy" ON public.provider_settings;
  CREATE POLICY "Tenant providers policy"
    ON public.provider_settings
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Allow all" ON public.provider_settings;

  DROP POLICY IF EXISTS "Tenant gps devices policy" ON public.gps_devices;
  CREATE POLICY "Tenant gps devices policy"
    ON public.gps_devices
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Tenant categories policy" ON public.categories;
  CREATE POLICY "Tenant categories policy"
    ON public.categories
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Allow all" ON public.categories;

  DROP POLICY IF EXISTS "Tenant countries policy" ON public.countries;
  CREATE POLICY "Tenant countries policy"
    ON public.countries
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

  DROP POLICY IF EXISTS "Allow all" ON public.countries;

  DROP POLICY IF EXISTS "Tenant audit logs policy" ON public.audit_logs;
  CREATE POLICY "Tenant audit logs policy"
    ON public.audit_logs
    FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());
END;
$$;

-- ------------------------------------------------------------
-- RPCs with company isolation
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_profile public.user_profiles%ROWTYPE;
  target_profile public.user_profiles%ROWTYPE;
  audit_id TEXT := 'log-' || replace(COALESCE(target_user_id::text, ''), '-', '') || '-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::BIGINT;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  SELECT *
  INTO actor_profile
  FROM public.user_profiles
  WHERE id = actor_id;

  IF actor_profile.id IS NULL OR actor_profile.role <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete users.';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.user_profiles
  WHERE id = target_user_id;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  IF target_profile.company_id <> actor_profile.company_id THEN
    RAISE EXCEPTION 'You can only delete users from your own company.';
  END IF;

  IF target_profile.id = actor_id THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (
      id,
      company_id,
      user_id,
      user_email,
      user_name,
      action,
      entity_type,
      entity_id,
      entity_label,
      details,
      created_at
    )
    VALUES (
      audit_id,
      actor_profile.company_id,
      actor_profile.id,
      actor_profile.email,
      actor_profile.full_name,
      'delete',
      'user',
      target_profile.id::TEXT,
      COALESCE(target_profile.email, target_profile.full_name, target_profile.id::TEXT),
      jsonb_build_object(
        'deletedUserEmail', target_profile.email,
        'deletedUserName', target_profile.full_name
      ),
      NOW()
    );
  END IF;

  DELETE FROM auth.users
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Usuario ' || COALESCE(target_profile.email, target_profile.full_name, target_user_id::TEXT) || ' eliminado correctamente.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.manage_user_account(
  target_user_id UUID,
  new_full_name TEXT DEFAULT NULL,
  new_email TEXT DEFAULT NULL,
  new_password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_profile public.user_profiles%ROWTYPE;
  target_profile public.user_profiles%ROWTYPE;
  normalized_full_name TEXT := NULLIF(BTRIM(COALESCE(new_full_name, '')), '');
  normalized_email TEXT := NULLIF(LOWER(BTRIM(COALESCE(new_email, ''))), '');
  normalized_password TEXT := NULLIF(BTRIM(COALESCE(new_password, '')), '');
  effective_full_name TEXT := NULL;
  effective_email TEXT := NULL;
  identity_has_email_column BOOLEAN := FALSE;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized request.';
  END IF;

  SELECT *
  INTO actor_profile
  FROM public.user_profiles
  WHERE id = actor_id;

  SELECT *
  INTO target_profile
  FROM public.user_profiles
  WHERE id = target_user_id;

  IF actor_profile.id IS NULL OR target_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF actor_profile.company_id <> target_profile.company_id THEN
    RAISE EXCEPTION 'You can only edit users from your own company.';
  END IF;

  IF actor_profile.role <> 'admin' AND actor_id <> target_user_id THEN
    RAISE EXCEPTION 'Only administrators can edit other users.';
  END IF;

  IF normalized_password IS NOT NULL AND LENGTH(normalized_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  IF normalized_email IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id <> target_user_id
        AND company_id = actor_profile.company_id
        AND LOWER(email) = normalized_email
    ) THEN
      RAISE EXCEPTION 'Email already in use.';
    END IF;
  END IF;

  effective_full_name := CASE
    WHEN normalized_full_name IS NULL OR normalized_full_name = COALESCE(target_profile.full_name, '') THEN NULL
    ELSE normalized_full_name
  END;

  effective_email := CASE
    WHEN normalized_email IS NULL OR normalized_email = LOWER(COALESCE(target_profile.email, '')) THEN NULL
    ELSE normalized_email
  END;

  UPDATE public.user_profiles
  SET
    full_name = COALESCE(effective_full_name, full_name),
    email = COALESCE(effective_email, email),
    updated_at = NOW()
  WHERE id = target_user_id;

  UPDATE auth.users
  SET
    raw_user_meta_data = CASE
      WHEN effective_full_name IS NULL THEN raw_user_meta_data
      ELSE jsonb_set(COALESCE(raw_user_meta_data, '{}'::JSONB), '{full_name}', to_jsonb(effective_full_name), true)
    END,
    encrypted_password = CASE
      WHEN normalized_password IS NULL THEN encrypted_password
      ELSE extensions.crypt(normalized_password, extensions.gen_salt('bf'::TEXT))
    END,
    updated_at = NOW()
  WHERE id = target_user_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'identities'
      AND column_name = 'email'
  ) INTO identity_has_email_column;

  IF effective_email IS NOT NULL THEN
    IF identity_has_email_column THEN
      UPDATE auth.identities
      SET
        email = effective_email,
        identity_data = jsonb_set(COALESCE(identity_data, '{}'::JSONB), '{email}', to_jsonb(effective_email), true),
        updated_at = NOW()
      WHERE user_id = target_user_id;
    ELSE
      UPDATE auth.identities
      SET
        identity_data = jsonb_set(COALESCE(identity_data, '{}'::JSONB), '{email}', to_jsonb(effective_email), true),
        updated_at = NOW()
      WHERE user_id = target_user_id;
    END IF;
  ELSIF effective_full_name IS NOT NULL THEN
    UPDATE auth.identities
    SET updated_at = NOW()
    WHERE user_id = target_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Usuario actualizado correctamente.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.manage_user_account(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_user_account(UUID, TEXT, TEXT, TEXT) TO authenticated;
