-- Tabela de visualizações de página
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  visitor_hash text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_page_created ON public.page_views(page, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views(created_at DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Ninguém lê direto (só via RPC). Admin pode ler tudo.
CREATE POLICY "Admins can read page views"
ON public.page_views
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- Inserts só via RPC (sem policy de INSERT direta)

-- Lista de e-mails internos bloqueados (não contam)
CREATE OR REPLACE FUNCTION public.is_internal_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) IN ('luan123@gmail.com', 'natalino123@gmail.com')
  )
  OR public.has_role(_user_id, 'admin'::app_role)
  OR public.has_role(_user_id, 'moderator'::app_role);
$$;

-- RPC para registrar visita (ignora admin/moderador/contas internas)
CREATE OR REPLACE FUNCTION public.record_page_view(_page text, _visitor_hash text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  -- Bloqueia se for admin / moderador / conta interna
  IF _uid IS NOT NULL AND public.is_internal_account(_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.page_views (page, visitor_hash, user_id)
  VALUES (_page, _visitor_hash, _uid);
END;
$$;

-- RPC para painel: estatísticas resumidas (somente admin)
CREATE OR REPLACE FUNCTION public.get_page_view_stats(_page text DEFAULT 'store_directory')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today bigint;
  _week bigint;
  _month bigint;
  _total bigint;
  _unique_today bigint;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem ver estatísticas.';
  END IF;

  SELECT COUNT(*) INTO _today FROM public.page_views
    WHERE page = _page AND created_at >= date_trunc('day', now());
  SELECT COUNT(*) INTO _week FROM public.page_views
    WHERE page = _page AND created_at >= now() - interval '7 days';
  SELECT COUNT(*) INTO _month FROM public.page_views
    WHERE page = _page AND created_at >= now() - interval '30 days';
  SELECT COUNT(*) INTO _total FROM public.page_views WHERE page = _page;
  SELECT COUNT(DISTINCT COALESCE(visitor_hash, user_id::text)) INTO _unique_today
    FROM public.page_views
    WHERE page = _page AND created_at >= date_trunc('day', now());

  RETURN jsonb_build_object(
    'today', _today,
    'unique_today', _unique_today,
    'week', _week,
    'month', _month,
    'total', _total
  );
END;
$$;