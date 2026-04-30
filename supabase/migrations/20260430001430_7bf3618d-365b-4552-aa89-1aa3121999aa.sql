-- Aggressively fix execution permissions for all functions in public schema
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
        -- Revoke ALL permissions from everyone first
        EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', func_record.schema_name, func_record.function_name, func_record.args);
        
        -- Grant execution back to authenticated and service_role
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role', func_record.schema_name, func_record.function_name, func_record.args);
    END LOOP; 
END $$;

-- Re-grant execute to anon for functions that must be publicly accessible
GRANT EXECUTE ON FUNCTION public.record_page_view(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.count_supporter_plans() TO anon;
