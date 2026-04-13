-- Edicion de usuarios desde RPC: nombre, correo y contrasena
-- Ejecuta este script en Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

  SELECT * INTO actor_profile
  FROM public.user_profiles
  WHERE id = actor_id;

  IF actor_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'A valid userId is required.';
  END IF;

  IF actor_profile.role <> 'admin' AND actor_id <> target_user_id THEN
    RAISE EXCEPTION 'Only administrators can edit other users.';
  END IF;

  SELECT * INTO target_profile
  FROM public.user_profiles
  WHERE id = target_user_id;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  IF normalized_password IS NOT NULL AND LENGTH(normalized_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters.';
  END IF;

  IF normalized_email IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id <> target_user_id
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
      ELSE jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb(effective_full_name), true)
    END,
    encrypted_password = CASE
      WHEN normalized_password IS NULL THEN encrypted_password
      ELSE extensions.crypt(normalized_password, extensions.gen_salt('bf'::text))
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
        identity_data = jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', to_jsonb(effective_email), true),
        updated_at = NOW()
      WHERE user_id = target_user_id;
    ELSE
      UPDATE auth.identities
      SET
        identity_data = jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email}', to_jsonb(effective_email), true),
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
