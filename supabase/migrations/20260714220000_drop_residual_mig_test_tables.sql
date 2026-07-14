-- Migration 020: drop leftover __mig*_test_results recreated by SQL suites after 019.
-- Suites may recreate tables at runtime; they must not persist with grants to anon.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS fqname
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
