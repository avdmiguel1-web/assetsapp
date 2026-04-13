-- Borrado real de usuarios desde RPC, sin depender de Edge Functions
-- Ejecuta este script en Supabase SQL Editor

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

  SELECT * INTO actor_profile
  FROM public.user_profiles
  WHERE id = actor_id;

  IF actor_profile.id IS NULL OR actor_profile.role <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete users.';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'A valid userId is required.';
  END IF;

  IF target_user_id = actor_id THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  SELECT * INTO target_profile
  FROM public.user_profiles
  WHERE id = target_user_id;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (
      id,
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
      actor_profile.id,
      actor_profile.email,
      actor_profile.full_name,
      'delete',
      'user',
      target_profile.id::text,
      COALESCE(target_profile.email, target_profile.full_name, target_profile.id::text),
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
    'message', 'Usuario ' || COALESCE(target_profile.email, target_profile.full_name, target_user_id::text) || ' eliminado correctamente.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
