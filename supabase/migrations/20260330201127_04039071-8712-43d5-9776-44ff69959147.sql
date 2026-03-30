
-- Add store_status enum
CREATE TYPE public.store_status AS ENUM ('analise', 'ativo', 'bloqueado');

-- Add is_approved and address fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS complement text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reference_point text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Add status to stores (default analise for new stores)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS status store_status NOT NULL DEFAULT 'analise';

-- Update existing stores to 'ativo' (they were created before the approval system)
UPDATE public.stores SET status = 'ativo' WHERE status = 'analise' AND owner_id IS NULL;

-- Admin approval function (only admin can approve/reject)
CREATE OR REPLACE FUNCTION public.admin_approve_partner(_profile_user_id uuid, _approved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o administrador pode aprovar parceiros.';
  END IF;

  UPDATE profiles SET is_approved = _approved WHERE user_id = _profile_user_id;

  -- If lojista, also update store status
  IF _approved THEN
    UPDATE stores SET status = 'ativo' WHERE owner_id = _profile_user_id;
  ELSE
    UPDATE stores SET status = 'bloqueado' WHERE owner_id = _profile_user_id;
  END IF;

  -- If motoboy, activate/deactivate driver
  UPDATE drivers SET is_active = _approved WHERE user_id = _profile_user_id;
END;
$$;

-- Admin can update all profiles (for approval)
CREATE POLICY "Platform admin can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));
