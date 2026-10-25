DO $$
DECLARE
  target_function regprocedure;
  matching_functions integer;
BEGIN
  SELECT count(*)
    INTO matching_functions
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'validate_discount_code'
    AND p.pronargs = 1
    AND p.proargnames[1] = 'p_code';

  IF matching_functions <> 1 THEN
    RAISE EXCEPTION
      'Expected one public.validate_discount_code(p_code) function, found %',
      matching_functions;
  END IF;

  SELECT p.oid::regprocedure
    INTO target_function
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'validate_discount_code'
    AND p.pronargs = 1
    AND p.proargnames[1] = 'p_code';

  IF target_function IS NULL THEN
    RAISE EXCEPTION
      'Could not find public.validate_discount_code(p_code) to restrict';
  END IF;

  EXECUTE format(
    'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
    target_function
  );
  EXECUTE format(
    'GRANT EXECUTE ON FUNCTION %s TO service_role',
    target_function
  );
END
$$;
