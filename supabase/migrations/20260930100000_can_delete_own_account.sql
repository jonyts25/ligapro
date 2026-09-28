-- Migration 041 (step 3.1): guard account deletion when user is sole organization_owner

CREATE OR REPLACE FUNCTION public.can_delete_own_account()
RETURNS TABLE (
  can_delete boolean,
  blocking_organization_names text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_blocking_names text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, ARRAY[]::text[];
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(o.name ORDER BY o.name), ARRAY[]::text[])
  INTO v_blocking_names
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.profile_id = v_uid
    AND om.role = 'organization_owner'
    AND (
      SELECT count(*)
      FROM public.organization_members m
      WHERE m.organization_id = om.organization_id
        AND m.role = 'organization_owner'
    ) = 1;

  RETURN QUERY SELECT
    COALESCE(array_length(v_blocking_names, 1), 0) = 0,
    COALESCE(v_blocking_names, ARRAY[]::text[]);
END;
$$;

REVOKE ALL ON FUNCTION public.can_delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_delete_own_account() TO authenticated;
