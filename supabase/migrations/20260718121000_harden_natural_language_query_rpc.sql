-- Replace the legacy arbitrary dynamic-SQL RPC with a narrowly constrained tenant read.
DROP FUNCTION IF EXISTS public.secure_read_only_query(text);

CREATE FUNCTION public.secure_read_only_query(query_string text, expected_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized text := lower(trim(query_string));
  source_table text;
  result jsonb;
BEGIN
  IF normalized !~ '^select[[:space:]]' OR regexp_count(normalized, '\mselect\M') <> 1 THEN
    RAISE EXCEPTION 'Only one SELECT statement is permitted';
  END IF;
  IF normalized ~ '(;|--|/\*|\*/|\munion\M|\mintersect\M|\mexcept\M|\mjoin\M|\mwith\M|\mor\M|\minsert\M|\mupdate\M|\mdelete\M|\mdrop\M|\malter\M|\mcreate\M|\mcopy\M|\mexecute\M|\mcall\M|\mpg_|information_schema)' THEN
    RAISE EXCEPTION 'Query contains a forbidden construct';
  END IF;

  source_table := substring(normalized from '\mfrom[[:space:]]+([a-z_][a-z0-9_]*)');
  IF source_table IS NULL OR source_table NOT IN ('leads', 'contacts', 'business_clients', 'deals', 'invoices', 'tasks', 'calendar_events', 'expenses', 'quotes') THEN
    RAISE EXCEPTION 'Query source is not permitted';
  END IF;
  IF normalized !~ ('\mtenant_id\M[[:space:]]*=[[:space:]]*''' || expected_tenant_id::text || '''') THEN
    RAISE EXCEPTION 'Exact tenant boundary is required';
  END IF;

  EXECUTE 'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (' || query_string || ') AS t' INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.secure_read_only_query(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_read_only_query(text, uuid) TO service_role;
