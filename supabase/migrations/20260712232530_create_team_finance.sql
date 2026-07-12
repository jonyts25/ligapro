-- Migration 009: team_charges, team_payments, and season_team_financial_summary
-- Manual finance records only. No digital payment processing.
-- audit_log deferred to Migration 010.

-- ---------------------------------------------------------------------------
-- team_charges
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_id uuid NOT NULL REFERENCES public.season_teams (id) ON DELETE RESTRICT,
  charge_type text NOT NULL,
  description text,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  due_date date,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  voided_at timestamptz,
  voided_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_charges_charge_type_check CHECK (
    charge_type IN ('registration', 'referee_fee', 'fine', 'other')
  ),
  CONSTRAINT team_charges_amount_positive_check CHECK (amount > 0),
  CONSTRAINT team_charges_currency_check CHECK (
    currency = 'MXN'
  ),
  CONSTRAINT team_charges_void_all_or_none_check CHECK (
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

CREATE INDEX team_charges_organization_id_idx ON public.team_charges (organization_id);
CREATE INDEX team_charges_season_team_id_idx ON public.team_charges (season_team_id);
CREATE INDEX team_charges_due_date_idx ON public.team_charges (due_date);
CREATE INDEX team_charges_active_idx
  ON public.team_charges (season_team_id)
  WHERE voided_at IS NULL;

CREATE TRIGGER team_charges_set_updated_at
  BEFORE UPDATE ON public.team_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- team_payments
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  season_team_id uuid NOT NULL REFERENCES public.season_teams (id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  payment_method text NOT NULL,
  reference text,
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  voided_at timestamptz,
  voided_by_profile_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_payments_payment_method_check CHECK (
    payment_method IN ('cash', 'transfer', 'card', 'other')
  ),
  CONSTRAINT team_payments_amount_positive_check CHECK (amount > 0),
  CONSTRAINT team_payments_currency_check CHECK (
    currency = 'MXN'
  ),
  CONSTRAINT team_payments_void_all_or_none_check CHECK (
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

CREATE INDEX team_payments_organization_id_idx ON public.team_payments (organization_id);
CREATE INDEX team_payments_season_team_id_idx ON public.team_payments (season_team_id);
CREATE INDEX team_payments_paid_at_idx ON public.team_payments (paid_at);
CREATE INDEX team_payments_active_idx
  ON public.team_payments (season_team_id)
  WHERE voided_at IS NULL;

CREATE TRIGGER team_payments_set_updated_at
  BEFORE UPDATE ON public.team_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant consistency + insert actor validation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_charges_enforce_org_matches_season_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st_org uuid;
BEGIN
  SELECT st.organization_id INTO v_st_org
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_st_org IS NULL THEN
    RAISE EXCEPTION 'season_team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_st_org THEN
    RAISE EXCEPTION
      'team_charges.organization_id (%) must match season_teams.organization_id (%) for season_team %',
      NEW.organization_id,
      v_st_org,
      NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER team_charges_enforce_org_matches_season_team
  BEFORE INSERT OR UPDATE OF organization_id, season_team_id
  ON public.team_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.team_charges_enforce_org_matches_season_team();

CREATE OR REPLACE FUNCTION public.team_payments_enforce_org_matches_season_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_st_org uuid;
BEGIN
  SELECT st.organization_id INTO v_st_org
  FROM public.season_teams st
  WHERE st.id = NEW.season_team_id;

  IF v_st_org IS NULL THEN
    RAISE EXCEPTION 'season_team % does not exist', NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_st_org THEN
    RAISE EXCEPTION
      'team_payments.organization_id (%) must match season_teams.organization_id (%) for season_team %',
      NEW.organization_id,
      v_st_org,
      NEW.season_team_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER team_payments_enforce_org_matches_season_team
  BEFORE INSERT OR UPDATE OF organization_id, season_team_id
  ON public.team_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.team_payments_enforce_org_matches_season_team();

CREATE OR REPLACE FUNCTION public.team_charges_enforce_insert_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by_profile_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'team_charges.created_by_profile_id (%) must match auth.uid() (%)',
      NEW.created_by_profile_id,
      auth.uid()
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = NEW.organization_id
      AND m.profile_id = NEW.created_by_profile_id
  ) THEN
    RAISE EXCEPTION
      'created_by_profile_id % must be a member of organization %',
      NEW.created_by_profile_id,
      NEW.organization_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER team_charges_enforce_insert_actor
  BEFORE INSERT ON public.team_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.team_charges_enforce_insert_actor();

CREATE OR REPLACE FUNCTION public.team_payments_enforce_insert_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recorded_by_profile_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'team_payments.recorded_by_profile_id (%) must match auth.uid() (%)',
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

CREATE TRIGGER team_payments_enforce_insert_actor
  BEFORE INSERT ON public.team_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.team_payments_enforce_insert_actor();

-- ---------------------------------------------------------------------------
-- Immutability (void via RPC sets app.financial_void = true)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_financial_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% records cannot be deleted; void instead', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF current_setting('app.financial_void', true) = 'true' THEN
      IF OLD.voided_at IS NOT NULL THEN
        RAISE EXCEPTION '% is already voided', TG_TABLE_NAME
          USING ERRCODE = 'P0001';
      END IF;

      IF TG_TABLE_NAME = 'team_charges' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
           OR NEW.season_team_id IS DISTINCT FROM OLD.season_team_id
           OR NEW.charge_type IS DISTINCT FROM OLD.charge_type
           OR NEW.amount IS DISTINCT FROM OLD.amount
           OR NEW.currency IS DISTINCT FROM OLD.currency
           OR NEW.created_by_profile_id IS DISTINCT FROM OLD.created_by_profile_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'void_team_charge may not alter original financial fields'
            USING ERRCODE = 'P0001';
        END IF;
      ELSE
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
           OR NEW.season_team_id IS DISTINCT FROM OLD.season_team_id
           OR NEW.amount IS DISTINCT FROM OLD.amount
           OR NEW.currency IS DISTINCT FROM OLD.currency
           OR NEW.recorded_by_profile_id IS DISTINCT FROM OLD.recorded_by_profile_id
           OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
          RAISE EXCEPTION 'void_team_payment may not alter original financial fields'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    RAISE EXCEPTION '% records are immutable; use void RPC', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER team_charges_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.team_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.team_financial_prevent_mutation();

CREATE TRIGGER team_payments_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.team_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.team_financial_prevent_mutation();

-- ---------------------------------------------------------------------------
-- Void RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_team_charge(
  p_charge_id uuid,
  p_reason text
)
RETURNS public.team_charges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.team_charges;
  v_reason text := btrim(p_reason);
BEGIN
  SELECT * INTO v_row FROM public.team_charges WHERE id = p_charge_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'team_charge % does not exist', p_charge_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to void team_charge %', p_charge_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'team_charge % is already voided', p_charge_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.financial_void', 'true', true);

  UPDATE public.team_charges
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason,
    updated_at = now()
  WHERE id = p_charge_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_team_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS public.team_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.team_payments;
  v_reason text := btrim(p_reason);
BEGIN
  SELECT * INTO v_row FROM public.team_payments WHERE id = p_payment_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'team_payment % does not exist', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_role_in_org(
    v_row.organization_id,
    ARRAY['organization_owner', 'organization_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Not authorized to void team_payment %', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'team_payment % is already voided', p_payment_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_reason IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.financial_void', 'true', true);

  UPDATE public.team_payments
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason,
    updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Private balance view (owner/admin filter in view definition)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.season_team_financial_summary
WITH (security_invoker = true) AS
WITH charge_totals AS (
  SELECT
    tc.organization_id,
    tc.season_team_id,
    tc.currency,
    SUM(tc.amount)::numeric(12, 2) AS total_active_charges,
    MIN(tc.due_date) FILTER (WHERE tc.due_date IS NOT NULL) AS next_due_date
  FROM public.team_charges tc
  WHERE tc.voided_at IS NULL
  GROUP BY tc.organization_id, tc.season_team_id, tc.currency
),
payment_totals AS (
  SELECT
    tp.organization_id,
    tp.season_team_id,
    tp.currency,
    SUM(tp.amount)::numeric(12, 2) AS total_active_payments
  FROM public.team_payments tp
  WHERE tp.voided_at IS NULL
  GROUP BY tp.organization_id, tp.season_team_id, tp.currency
),
currency_keys AS (
  SELECT organization_id, season_team_id, currency FROM charge_totals
  UNION
  SELECT organization_id, season_team_id, currency FROM payment_totals
),
season_teams_without_activity AS (
  SELECT
    st.organization_id,
    st.id AS season_team_id,
    'MXN'::text AS currency
  FROM public.season_teams st
  WHERE NOT EXISTS (
    SELECT 1
    FROM currency_keys ck
    WHERE ck.season_team_id = st.id
  )
),
all_keys AS (
  SELECT organization_id, season_team_id, currency FROM currency_keys
  UNION ALL
  SELECT organization_id, season_team_id, currency FROM season_teams_without_activity
)
SELECT
  k.organization_id,
  k.season_team_id,
  COALESCE(c.total_active_charges, 0)::numeric(12, 2) AS total_active_charges,
  COALESCE(p.total_active_payments, 0)::numeric(12, 2) AS total_active_payments,
  (COALESCE(c.total_active_charges, 0) - COALESCE(p.total_active_payments, 0))::numeric(12, 2)
    AS balance_due,
  k.currency,
  c.next_due_date
FROM all_keys k
LEFT JOIN charge_totals c
  ON c.season_team_id = k.season_team_id
 AND c.currency = k.currency
LEFT JOIN payment_totals p
  ON p.season_team_id = k.season_team_id
 AND p.currency = k.currency
WHERE public.has_role_in_org(
  k.organization_id,
  ARRAY['organization_owner', 'organization_admin']::text[]
);

COMMENT ON VIEW public.season_team_financial_summary IS
  'Private financial summary per season_team and currency. MVP allows MXN only; column retained for a future multi-currency migration.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_charges_select_owner_or_admin
  ON public.team_charges FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY team_charges_insert_owner_or_admin
  ON public.team_charges FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
    AND voided_at IS NULL
    AND voided_by_profile_id IS NULL
    AND void_reason IS NULL
    AND created_by_profile_id = auth.uid()
  );

CREATE POLICY team_payments_select_owner_or_admin
  ON public.team_payments FOR SELECT TO authenticated
  USING (
    public.has_role_in_org(
      organization_id,
      ARRAY['organization_owner', 'organization_admin']::text[]
    )
  );

CREATE POLICY team_payments_insert_owner_or_admin
  ON public.team_payments FOR INSERT TO authenticated
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

REVOKE ALL ON TABLE public.team_charges FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.team_payments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.season_team_financial_summary FROM PUBLIC, anon;

GRANT SELECT, INSERT ON TABLE public.team_charges TO authenticated;
GRANT SELECT, INSERT ON TABLE public.team_payments TO authenticated;
GRANT SELECT ON TABLE public.season_team_financial_summary TO authenticated;

REVOKE ALL ON FUNCTION public.void_team_charge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_team_payment(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.void_team_charge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_team_payment(uuid, text) TO authenticated;
