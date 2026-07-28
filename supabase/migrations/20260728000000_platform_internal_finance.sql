-- Migration 029: platform internal finance (income/expense ledger for staff)
-- Informal internal tracking — not fiscal compliance tooling.

-- ---------------------------------------------------------------------------
-- 1. Tables (no direct client access)
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES public.seasons (id),
  organization_id uuid REFERENCES public.organizations (id),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  notes text,
  voided_at timestamptz,
  voided_by_profile_id uuid REFERENCES public.profiles (id),
  void_reason text,
  CONSTRAINT platform_income_entries_void_all_or_none CHECK (
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

CREATE TABLE public.platform_expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (
    category IN ('hosting', 'herramientas', 'marketing', 'otro')
  ),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_profile_id uuid NOT NULL REFERENCES public.profiles (id),
  notes text,
  voided_at timestamptz,
  voided_by_profile_id uuid REFERENCES public.profiles (id),
  void_reason text,
  CONSTRAINT platform_expense_entries_void_all_or_none CHECK (
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

COMMENT ON TABLE public.platform_income_entries IS
  'Manual platform income ledger for internal staff — not fiscal accounting.';
COMMENT ON TABLE public.platform_expense_entries IS
  'Manual platform expense ledger for internal staff — not fiscal accounting.';

ALTER TABLE public.platform_income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_expense_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_income_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_expense_entries FROM PUBLIC, anon, authenticated;

CREATE INDEX platform_income_entries_recorded_at_idx
  ON public.platform_income_entries (recorded_at);
CREATE INDEX platform_expense_entries_recorded_at_idx
  ON public.platform_expense_entries (recorded_at);

-- ---------------------------------------------------------------------------
-- 2. Immutability (void via RPC only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_financial_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% records cannot be deleted; void instead', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF current_setting('app.platform_financial_void', true) = 'true' THEN
      IF OLD.voided_at IS NOT NULL THEN
        RAISE EXCEPTION '% is already voided', TG_TABLE_NAME
          USING ERRCODE = 'P0001';
      END IF;

      IF TG_TABLE_NAME = 'platform_income_entries' THEN
        IF NEW.season_id IS DISTINCT FROM OLD.season_id
           OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
           OR NEW.amount IS DISTINCT FROM OLD.amount
           OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
           OR NEW.recorded_by_profile_id IS DISTINCT FROM OLD.recorded_by_profile_id
           OR NEW.notes IS DISTINCT FROM OLD.notes THEN
          RAISE EXCEPTION 'void_platform_income_entry may not alter original fields'
            USING ERRCODE = 'P0001';
        END IF;
      ELSE
        IF NEW.category IS DISTINCT FROM OLD.category
           OR NEW.amount IS DISTINCT FROM OLD.amount
           OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
           OR NEW.recorded_by_profile_id IS DISTINCT FROM OLD.recorded_by_profile_id
           OR NEW.notes IS DISTINCT FROM OLD.notes THEN
          RAISE EXCEPTION 'void_platform_expense_entry may not alter original fields'
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

CREATE TRIGGER platform_income_entries_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.platform_income_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.platform_financial_prevent_mutation();

CREATE TRIGGER platform_expense_entries_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.platform_expense_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.platform_financial_prevent_mutation();

-- ---------------------------------------------------------------------------
-- 3. record_platform_income
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_platform_income(
  p_season_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_entry_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero' USING ERRCODE = 'P0001';
  END IF;

  IF p_season_id IS NOT NULL THEN
    SELECT s.organization_id INTO v_org_id
    FROM public.seasons s
    WHERE s.id = p_season_id;

    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'season % does not exist', p_season_id USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.platform_income_entries (
    season_id,
    organization_id,
    amount,
    recorded_by_profile_id,
    notes
  ) VALUES (
    p_season_id,
    v_org_id,
    p_amount,
    auth.uid(),
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_platform_income(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_platform_income(uuid, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. void_platform_income_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_platform_income_entry(
  p_entry_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.platform_financial_void', 'true', true);

  UPDATE public.platform_income_entries
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason
  WHERE id = p_entry_id
    AND voided_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'platform_income_entry % not found or already voided', p_entry_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.void_platform_income_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_platform_income_entry(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. record_platform_expense
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_platform_expense(
  p_category text,
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category text := btrim(COALESCE(p_category, ''));
  v_entry_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  IF v_category NOT IN ('hosting', 'herramientas', 'marketing', 'otro') THEN
    RAISE EXCEPTION 'invalid expense category: %', v_category USING ERRCODE = 'P0001';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.platform_expense_entries (
    category,
    amount,
    recorded_by_profile_id,
    notes
  ) VALUES (
    v_category,
    p_amount,
    auth.uid(),
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_platform_expense(text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_platform_expense(text, numeric, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. void_platform_expense_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_platform_expense_entry(
  p_entry_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'void reason is required' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.platform_financial_void', 'true', true);

  UPDATE public.platform_expense_entries
  SET
    voided_at = now(),
    voided_by_profile_id = auth.uid(),
    void_reason = v_reason
  WHERE id = p_entry_id
    AND voided_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'platform_expense_entry % not found or already voided', p_entry_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.void_platform_expense_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_platform_expense_entry(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. get_platform_finance_summary (monthly totals + entry lists for UI)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_platform_finance_summary(
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_total_income numeric(12, 2);
  v_total_expenses numeric(12, 2);
  v_income jsonb;
  v_expenses jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.is_platform_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized: platform staff only' USING ERRCODE = 'P0001';
  END IF;

  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'invalid year' USING ERRCODE = 'P0001';
  END IF;

  IF p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'invalid month' USING ERRCODE = 'P0001';
  END IF;

  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_end := v_start + interval '1 month';

  SELECT COALESCE(SUM(i.amount), 0)
  INTO v_total_income
  FROM public.platform_income_entries i
  WHERE i.recorded_at >= v_start
    AND i.recorded_at < v_end
    AND i.voided_at IS NULL;

  SELECT COALESCE(SUM(e.amount), 0)
  INTO v_total_expenses
  FROM public.platform_expense_entries e
  WHERE e.recorded_at >= v_start
    AND e.recorded_at < v_end
    AND e.voided_at IS NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.recorded_at DESC), '[]'::jsonb)
  INTO v_income
  FROM (
    SELECT
      i.id,
      i.season_id,
      i.organization_id,
      o.name AS organization_name,
      s.name AS season_name,
      i.amount,
      i.recorded_at,
      i.notes,
      i.voided_at,
      i.void_reason
    FROM public.platform_income_entries i
    LEFT JOIN public.organizations o ON o.id = i.organization_id
    LEFT JOIN public.seasons s ON s.id = i.season_id
    WHERE i.recorded_at >= v_start
      AND i.recorded_at < v_end
    ORDER BY i.recorded_at DESC
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.recorded_at DESC), '[]'::jsonb)
  INTO v_expenses
  FROM (
    SELECT
      e.id,
      e.category,
      e.amount,
      e.recorded_at,
      e.notes,
      e.voided_at,
      e.void_reason
    FROM public.platform_expense_entries e
    WHERE e.recorded_at >= v_start
      AND e.recorded_at < v_end
    ORDER BY e.recorded_at DESC
  ) x;

  RETURN jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'total_income', v_total_income,
    'total_expenses', v_total_expenses,
    'net', v_total_income - v_total_expenses,
    'income_entries', v_income,
    'expense_entries', v_expenses
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_finance_summary(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_finance_summary(integer, integer) TO authenticated;

COMMENT ON FUNCTION public.get_platform_finance_summary(integer, integer) IS
  'Monthly platform finance summary for staff. Totals exclude voided entries; lists include voided rows for audit.';
