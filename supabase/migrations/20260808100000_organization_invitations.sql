-- Organization member invitations (email link, same pattern as captain_invitations)

CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  invited_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  accepted_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_invitations_role_check CHECK (
    role IN ('organization_admin', 'organization_member')
  ),
  CONSTRAINT organization_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
  ),
  CONSTRAINT organization_invitations_token_unique UNIQUE (token)
);

CREATE INDEX organization_invitations_organization_id_idx
  ON public.organization_invitations (organization_id);
CREATE INDEX organization_invitations_email_idx
  ON public.organization_invitations (lower(email));

CREATE UNIQUE INDEX organization_invitations_one_pending_per_email_org
  ON public.organization_invitations (organization_id, lower(email))
  WHERE status = 'pending';

CREATE TRIGGER organization_invitations_set_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_invitations_select_owner_admin
  ON public.organization_invitations FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY organization_invitations_select_invitee
  ON public.organization_invitations FOR SELECT TO authenticated
  USING (
    lower(email) = lower((
      SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()
    ))
  );

REVOKE ALL ON TABLE public.organization_invitations FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.organization_invitations TO authenticated;

CREATE TRIGGER audit_organization_invitations
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change();

CREATE OR REPLACE FUNCTION public.invite_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_role text := btrim(COALESCE(p_role, ''));
  v_token uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organization id is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Valid email is required'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_role NOT IN ('organization_admin', 'organization_member') THEN
    RAISE EXCEPTION 'Invalid role'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    p_organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.profiles p ON p.id = om.profile_id
    WHERE om.organization_id = p_organization_id
      AND lower(p.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Profile is already a member of this organization'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.organization_invitations
  SET status = 'cancelled'
  WHERE organization_id = p_organization_id
    AND lower(email) = v_email
    AND status = 'pending';

  INSERT INTO public.organization_invitations (
    organization_id,
    email,
    role,
    invited_by_profile_id,
    expires_at
  ) VALUES (
    p_organization_id,
    v_email,
    v_role,
    v_uid,
    now() + interval '7 days'
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv public.organization_invitations;
  v_profile_email text;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Invitation token is required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv
  FROM public.organization_invitations oi
  WHERE oi.token = p_token;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.organization_invitations
    SET status = 'expired'
    WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(btrim(p.email)) INTO v_profile_email
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_profile_email IS DISTINCT FROM lower(btrim(v_inv.email)) THEN
    RAISE EXCEPTION 'Invitation email does not match your account'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = v_inv.organization_id
      AND om.profile_id = v_uid
  ) THEN
    UPDATE public.organization_invitations
    SET
      status = 'accepted',
      accepted_by_profile_id = v_uid,
      accepted_at = now()
    WHERE id = v_inv.id;
    SELECT om.id INTO v_member_id
    FROM public.organization_members om
    WHERE om.organization_id = v_inv.organization_id
      AND om.profile_id = v_uid;
    RETURN v_member_id;
  END IF;

  INSERT INTO public.organization_members (
    organization_id,
    profile_id,
    role
  ) VALUES (
    v_inv.organization_id,
    v_uid,
    v_inv.role
  )
  RETURNING id INTO v_member_id;

  UPDATE public.organization_invitations
  SET
    status = 'accepted',
    accepted_by_profile_id = v_uid,
    accepted_at = now()
  WHERE id = v_inv.id;

  RETURN v_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_organization_member(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_organization_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_organization_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(uuid) TO authenticated;
