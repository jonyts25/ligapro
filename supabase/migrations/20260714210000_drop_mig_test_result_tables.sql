-- Migration 019: drop residual SQL suite result tables exposed on public schema.
-- Suites recreate these tables at runtime; they must not persist as anon-readable surfaces.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.oid, format('%I.%I', n.nspname, c.relname) AS fqname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE '\_\_mig%\_test\_results' ESCAPE '\'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %s CASCADE', r.fqname);
  END LOOP;
END;
$$;
