-- ============================================================
-- FleetCore - Fix RLS recursion for tenant helper functions
-- Run this in Supabase SQL Editor if locations/assets/etc.
-- start failing with "stack depth limit exceeded"
-- ============================================================

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
