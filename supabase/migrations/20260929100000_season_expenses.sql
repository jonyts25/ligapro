-- Season expenses (organizer costs per season) + void/immutability

-- ---------------------------------------------------------------------------
-- 1. season_expenses
-- ---------------------------------------------------------------------------
CREATE TABLE public.season_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN ('cancha', 'arbitraje', 'premios', 'otro')
  ),
  description text,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  incurred_at date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  voided_at timestamptz,
  voided_by_profile_id uuid REFERENCES public.profiles (id),
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT season_expenses_void_all_or_none CHECK (
    (
      voided_at IS NULL
      AND voided_by_profile_id IS NULL
      AND void_reason IS NULL
    )
    OR (
      voided_at IS NOT NULL
      AND voided_by_profile_id IS NOT NULL
      AND void_reason IS NOT NULL
      AND btrim(void_reason) <> ''
    )
  )
);

CREATE INDEX season_expenses_season_id_idx
  ON public.season_expenses (season_id);
CREATE INDEX season_expenses_organization_id_idx
  ON public.season_expenses (organization_id);
CREATE INDEX season_expenses_active_idx
  ON public.season_expenses (season_id)
  WHERE voided_at IS NULL;

CREATE TRIGGER season_expenses_set_updated_at
  BEFORE UPDATE ON public.season_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.season_expenses IS
  'Organizer-paid season costs (field rent, referees, prizes, etc.).';

-- ---------------------------------------------------------------------------
-- 2. Consistency + archived guard + insert actor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.season_expenses_enforce_org_matches_season()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_org uuid;
BEGIN
  SELECT s.organization_id INTO v_season_org
  FROM public.seasons s
  WHERE s.id = NEW.season_id;

  IF v_season_org IS NULL THEN
    RAISE EXCEPTION 'season % does not exist', NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_season_org THEN
    RAISE EXCEPTION
      'season_expenses.organization_id (%) must match seasons.organization_id (%) for season %',
      NEW.organization_id,
      v_season_org,
      NEW.season_id
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.__assert_season_not_archived(NEW.season_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_expenses_enforce_org_matches_season
  BEFORE INSERT OR UPDATE OF organization_id, season_id
  ON public.season_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.season_expenses_enforce_org_matches_season();

CREATE OR REPLACE FUNCTION public.season_expenses_enforce_insert_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recorded_by_profile_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'season_expenses.recorded_by_profile_id (%) must match auth.uid() (%)',
      NEW.recorded_by_profile_id,
      auth.uid()
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = NEW.organization_id
      AND m.profile_id = NEW.recorded_by_profile_id
  ) THEN
    RAISE EXCEPTION
      'recorded_by_profile_id % must be a member of organization %',
      NEW.recorded_by_profile_id,
      NEW.organization_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_expenses_enforce_insert_actor
  BEFORE INSERT ON public.season_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.season_expenses_enforce_insert_actor();

-- ---------------------------------------------------------------------------
-- 3. Immutability (void via RPC sets app.financial_void = true)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.season_expenses_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'season_expenses records cannot be deleted; void instead'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF current_setting('app.financial_void', true) = 'true' THEN
      IF OLD.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'season_expenses is already voided'
          USING ERRCODE = 'P0001';
      END IF;

      IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
         OR NEW.season_id IS DISTINCT FROM OLD.season_id
         OR NEW.category IS DISTINCT FROM OLD.category
         OR NEW.description IS DISTINCT FROM OLD.description
         OR NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.incurred_at IS DISTINCT FROM OLD.incurred_at
         OR NEW.recorded_by_profile_id IS DISTINCT FROM OLD.recorded_by_profile_id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION
          'void_season_expense may not alter original financial fields'
          USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'season_expenses records are immutable; use void RPC'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER season_expenses_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.season_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.season_expenses_prevent_mutation();

-- ---------------------------------------------------------------------------
-- 4. Void RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_season_expense(
  p_expense_id uuid,
  p_reason text
)
RETURNS public.season_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.season_expenses;
  v_reason text := btrim(p_reason);
BEGIN
  SELECT * INTO v_row FROM public.season_expenses WHERE id = p_expense_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'season_expense % does not exist', p_expense_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to void season_expense %', p_expense_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'season_expense % is already voided', p_expense_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.financial_void', 'true', true);

  UPDATE public.season_expenses
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason,
    updated_at = now()
  WHERE id = p_expense_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.void_season_expense(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_season_expense(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Audit
-- ---------------------------------------------------------------------------
CREATE TRIGGER audit_season_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.season_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_row_change('description');

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.season_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY season_expenses_select_member
  ON public.season_expenses FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY season_expenses_insert_owner_or_admin
  ON public.season_expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    AND voided_at IS NULL
    AND voided_by_profile_id IS NULL
    AND void_reason IS NULL
    AND recorded_by_profile_id = auth.uid()
  );

GRANT SELECT, INSERT ON public.season_expenses TO authenticated;
