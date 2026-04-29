-- Create admin_logs table
CREATE TABLE public.admin_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing logs (Admins only)
CREATE POLICY "Admins can view all logs" 
ON public.admin_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Disable direct inserts/updates/deletes for all
-- They must be done through a controlled function if needed from SQL, 
-- or directly via service role/RPC

-- Helper function to log actions safely
CREATE OR REPLACE FUNCTION public.log_admin_action(
    _action TEXT,
    _target_type TEXT,
    _target_id UUID,
    _details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _log_id UUID;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem registrar logs.';
    END IF;

    INSERT INTO public.admin_logs (admin_user_id, action, target_type, target_id, details)
    VALUES (auth.uid(), _action, _target_type, _target_id, _details)
    RETURNING id INTO _log_id;

    RETURN _log_id;
END;
$$;