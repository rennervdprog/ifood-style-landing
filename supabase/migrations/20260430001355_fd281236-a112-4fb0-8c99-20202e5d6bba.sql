-- Fix search_path and execution permissions for all functions in public schema
DO $$ 
DECLARE 
    func_record record;
BEGIN 
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public'
    LOOP 
        -- 1. Set search_path = public to prevent search path attacks
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', func_record.schema_name, func_record.function_name, func_record.args);
        
        -- 2. Revoke execute from PUBLIC (which includes everyone)
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', func_record.schema_name, func_record.function_name, func_record.args);
        
        -- 3. Grant execute to authenticated and service_role by default
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role', func_record.schema_name, func_record.function_name, func_record.args);
    END LOOP; 
END $$;

-- 4. Re-grant execute to anon for functions that must be publicly accessible
GRANT EXECUTE ON FUNCTION public.record_page_view(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.count_supporter_plans() TO anon;

-- Ensure any new functions also have restricted permissions by default
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
