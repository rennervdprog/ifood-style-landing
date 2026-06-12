-- =====================================================================
-- Antifraude - Cadastro de Lojista (aplicar no Supabase EXTERNO)
-- Projeto: qkjhguziuchqsbxzruea
--
-- Como aplicar:
--   psql "$EXTERNAL_DB_URL" -f scripts/antifraud-external.sql
-- (ou colar no SQL Editor do projeto externo)
--
-- O que faz:
--   1) Cria tabela signup_attempts (rate-limit por IP/device)
--   2) Garante unicidade de CPF/CNPJ entre lojas ATIVAS
--   3) Adiciona stores.probation_until (quarentena 72h: sem destaque, sem saque)
--   4) Atualiza register_as_lojista com checks antifraude
-- =====================================================================

-- 1) Tabela de tentativas de cadastro (rate-limit) -----------------------
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip text,
  device_id text,
  document text,
  email text,
  phone text,
  kind text NOT NULL DEFAULT 'lojista',
  blocked boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_created
  ON public.signup_attempts (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_device_created
  ON public.signup_attempts (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_doc_created
  ON public.signup_attempts (document, created_at DESC);

GRANT SELECT, INSERT ON public.signup_attempts TO authenticated;
GRANT ALL ON public.signup_attempts TO service_role;

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user can insert own signup attempt" ON public.signup_attempts;
CREATE POLICY "user can insert own signup attempt"
  ON public.signup_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "admin reads signup attempts" ON public.signup_attempts;
CREATE POLICY "admin reads signup attempts"
  ON public.signup_attempts FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- 2) Quarentena na loja ------------------------------------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS probation_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_stores_probation_until
  ON public.stores (probation_until)
  WHERE probation_until IS NOT NULL;

-- 3) Documento único entre lojas ATIVAS/PENDENTES (não bloqueia históricas)
--    Usa o profiles.document do owner; bloquear duplicidade de owner já é feito
--    pela checagem abaixo, mas reforçamos com índice parcial em stores.cnpj_cpf
--    quando essa coluna existe. (Se não existir, este bloco é no-op.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stores' AND column_name='cnpj_cpf'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_stores_doc_active
             ON public.stores ((regexp_replace(cnpj_cpf, ''\D'', '''', ''g'')))
             WHERE status IN (''ativo'',''pendente'',''bloqueado'')';
  END IF;
END $$;

-- 4) register_as_lojista com antifraude ---------------------------------
CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text,
  _document text,
  _store_name text,
  _store_category public.store_category,
  _avatar_url text DEFAULT NULL,
  _whatsapp text DEFAULT NULL,
  _selected_plan text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
  _plan_type public.store_plan_type;
  _monthly_fee numeric;
  _commission_rate numeric;
  _doc_clean text;
  _phone_clean text;
  _recent_count int;
  _email text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada. Faça login antes de cadastrar a loja.'
      USING ERRCODE = '28000';
  END IF;

  _doc_clean := regexp_replace(COALESCE(_document, ''), '\D', '', 'g');
  _phone_clean := regexp_replace(COALESCE(_whatsapp, ''), '\D', '', 'g');

  IF length(_doc_clean) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'CPF/CNPJ inválido. Use 11 dígitos para CPF ou 14 para CNPJ.';
  END IF;

  -- Antifraude 1: rate-limit (máx. 3 tentativas por usuário em 24h)
  SELECT count(*) INTO _recent_count
  FROM public.signup_attempts
  WHERE user_id = _user_id
    AND created_at > now() - interval '24 hours';
  IF _recent_count >= 3 THEN
    INSERT INTO public.signup_attempts (user_id, document, phone, blocked, reason)
    VALUES (_user_id, _doc_clean, _phone_clean, true, 'rate_limit_user_24h');
    RAISE EXCEPTION 'Muitas tentativas de cadastro. Tente novamente em 24h.';
  END IF;

  -- Antifraude 2: CPF/CNPJ já usado por OUTRO usuário em loja não-arquivada
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.stores s ON s.owner_id = p.user_id
    WHERE p.user_id <> _user_id
      AND regexp_replace(COALESCE(p.document,''), '\D', '', 'g') = _doc_clean
      AND COALESCE(s.status::text,'ativo') <> 'arquivada'
  ) THEN
    INSERT INTO public.signup_attempts (user_id, document, phone, blocked, reason)
    VALUES (_user_id, _doc_clean, _phone_clean, true, 'duplicate_document');
    RAISE EXCEPTION 'Este CPF/CNPJ já está cadastrado em outra loja.';
  END IF;

  -- Antifraude 3: telefone já usado por outro lojista
  IF _phone_clean <> '' AND length(_phone_clean) >= 10 AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id <> _user_id
      AND p.role = 'lojista'
      AND regexp_replace(COALESCE(p.whatsapp_number,''), '\D', '', 'g') = _phone_clean
  ) THEN
    INSERT INTO public.signup_attempts (user_id, document, phone, blocked, reason)
    VALUES (_user_id, _doc_clean, _phone_clean, true, 'duplicate_phone');
    RAISE EXCEPTION 'Este WhatsApp já está cadastrado em outra loja.';
  END IF;

  -- Antifraude 4: e-mail descartável (lista mínima, ampliar conforme necessário)
  SELECT email INTO _email FROM auth.users WHERE id = _user_id;
  IF _email IS NOT NULL AND _email ~* '@(mailinator|tempmail|10minutemail|guerrillamail|yopmail|trashmail|dispostable|getnada|throwaway)\.' THEN
    INSERT INTO public.signup_attempts (user_id, email, document, blocked, reason)
    VALUES (_user_id, _email, _doc_clean, true, 'disposable_email');
    RAISE EXCEPTION 'Use um e-mail permanente. E-mails temporários não são aceitos.';
  END IF;

  -- Registra tentativa permitida
  INSERT INTO public.signup_attempts (user_id, document, phone, email, blocked, reason)
  VALUES (_user_id, _doc_clean, _phone_clean, _email, false, 'allowed');

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role <> 'cliente') THEN
    IF EXISTS (SELECT 1 FROM public.stores WHERE owner_id = _user_id) THEN
      RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
  VALUES (_user_id, _full_name, 'lojista', _doc_clean, _avatar_url, _phone_clean)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, public.profiles.whatsapp_number);

  -- Quarentena de 72h: loja fica ativa mas marcada (UI esconde de destaques,
  -- saque/Asaas bloqueia até KYC + probation expirar)
  INSERT INTO public.stores (name, category, owner_id, delivery_mode, probation_until)
  VALUES (_store_name, _store_category, _user_id, 'own', now() + interval '72 hours')
  RETURNING id INTO _store_id;

  IF _selected_plan IN ('supporter','apoiador') THEN
    _plan_type := 'supporter'::public.store_plan_type;
    _monthly_fee := 130.00; _commission_rate := 0.00;
  ELSIF _selected_plan = 'fixed' THEN
    _plan_type := 'fixed'::public.store_plan_type;
    _monthly_fee := 180.00; _commission_rate := 0.00;
  ELSIF _selected_plan = 'hybrid' THEN
    _plan_type := 'hybrid'::public.store_plan_type;
    _monthly_fee := 100.00; _commission_rate := 2.5;
  ELSE
    _plan_type := 'commission_only'::public.store_plan_type;
    _monthly_fee := 0.00; _commission_rate := 6.0;
  END IF;

  INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
  VALUES (
    _store_id, _plan_type, _monthly_fee, _commission_rate, true,
    CASE WHEN _plan_type IN ('fixed','hybrid','supporter') THEN now() + interval '7 days' ELSE NULL END
  ) ON CONFLICT (store_id) DO NOTHING;

  RETURN _store_id;
END;
$func$;

-- Pronto. Quando a probation expirar, basta:
--   UPDATE stores SET probation_until = NULL WHERE probation_until < now();
-- (ou criar um cron). Saques pela subconta Asaas já dependem de KYC aprovado.

-- 5) Esconder lojas em probation do catálogo público --------------------
--    A view stores_public é a base do feed/diretório. Recriamos preservando
--    as colunas existentes mas excluindo lojas com probation_until > now().
DO $$
DECLARE
  _cols text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema='public' AND table_name='stores_public'
  ) THEN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO _cols
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stores_public';

    EXECUTE format($v$
      CREATE OR REPLACE VIEW public.stores_public AS
      SELECT %s FROM public.stores
      WHERE status = 'ativo'
        AND COALESCE(is_test, false) = false
        AND (probation_until IS NULL OR probation_until < now())
    $v$, _cols);

    GRANT SELECT ON public.stores_public TO anon, authenticated;
  END IF;
END $$;