-- Aviso prévio e público-alvo nos documentos legais.
--
-- Dois problemas que esta migration resolve:
--
-- 1. AVISO PRÉVIO. Os Termos v6.6 prometem, nas cláusulas 6.2 e 6.3, 30 dias
--    corridos de aviso antes de qualquer alteração comercial entrar em vigor,
--    com direito de cancelar sem multa nesse intervalo. O sistema não sabia
--    fazer isso: bastava `is_current = true` para o modal passar a bloquear na
--    hora. A coluna `effective_date` já existia em `legal_documents` e não era
--    lida por ninguém. Agora a RPC compara `effective_date` com `now()` e
--    devolve `mode = 'notice'` (aviso, não bloqueia) ou `mode = 'binding'`
--    (bloqueia), mais os dias que faltam.
--
-- 2. PÚBLICO-ALVO. `legal_document_changes` não distinguia quem deve ver cada
--    mudança. O motoboy recebia a tabela de planos e a taxa de PIX do lojista,
--    e a mudança que de fato o afeta — o rastreamento em segundo plano da
--    cláusula 3.1 da Política — ficava perdida no meio da lista. Enterrar o que
--    importa enfraquece o aceite. A coluna `audience` filtra por papel.
--
-- Não executa pedidos, pagamentos, cobranças ou transferências.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Coluna de público-alvo
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.legal_document_changes
  ADD COLUMN IF NOT EXISTS audience text[] NOT NULL DEFAULT ARRAY['all']::text[];

COMMENT ON COLUMN public.legal_document_changes.audience IS
  'Papéis que devem ver esta mudança: all, cliente, lojista, motoboy. '
  'O padrão {all} mantém o comportamento antigo para linhas já existentes.';

CREATE INDEX IF NOT EXISTS legal_document_changes_audience_idx
  ON public.legal_document_changes USING gin (audience);

-- Classifica as mudanças do v6.6 já publicadas.
-- Preço, plano e cobrança são assunto de lojista. Rastreamento e não vinculação
-- são do motoboy. Pagamento no checkout é do cliente.
UPDATE public.legal_document_changes c
SET audience = ARRAY['lojista']::text[]
FROM public.legal_documents d
WHERE c.document_id = d.id
  AND d.version_num = 660
  AND c.section IN (
    'Taxa de R$ 0,99 por entrega e sua variação futura',
    'Tabela comercial dos planos',
    'Rateio da taxa de entrega'
  );

UPDATE public.legal_document_changes c
SET audience = ARRAY['motoboy']::text[]
FROM public.legal_documents d
WHERE c.document_id = d.id
  AND d.version_num = 660
  AND c.section IN (
    'Localização do motoboy em segundo plano',
    'Diretório de motoboys por cidade'
  );

UPDATE public.legal_document_changes c
SET audience = ARRAY['lojista', 'motoboy']::text[]
FROM public.legal_documents d
WHERE c.document_id = d.id
  AND d.version_num = 660
  AND c.section IN (
    'Não vinculação entre ItaSuper, motoboy e Lojista',
    'Papéis no tratamento e dados do motoboy'
  );

UPDATE public.legal_document_changes c
SET audience = ARRAY['cliente', 'lojista']::text[]
FROM public.legal_documents d
WHERE c.document_id = d.id
  AND d.version_num = 660
  AND c.section = 'Formas de pagamento do Cliente';

-- ─────────────────────────────────────────────────────────────
-- 2. RPC com vigência e filtro de público
-- ─────────────────────────────────────────────────────────────
--
-- Mantém a assinatura de dois argumentos funcionando (o app antigo e os APKs
-- Kotlin ainda chamam assim) e adiciona a versão de três argumentos.

CREATE OR REPLACE FUNCTION public.get_pending_legal_changes(
  _terms_accepted text,
  _privacy_accepted text,
  _audience text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _terms_num int := 0;
  _privacy_num int := 0;
  _current_terms record;
  _current_privacy record;
  _aud text := COALESCE(NULLIF(_audience, ''), 'all');
  _terms_binding boolean := false;
  _privacy_binding boolean := false;
  _result jsonb;
BEGIN
  SELECT version_num INTO _terms_num FROM public.legal_documents
    WHERE kind = 'terms' AND version = _terms_accepted LIMIT 1;
  SELECT version_num INTO _privacy_num FROM public.legal_documents
    WHERE kind = 'privacy' AND version = _privacy_accepted LIMIT 1;

  _terms_num := COALESCE(_terms_num, 0);
  _privacy_num := COALESCE(_privacy_num, 0);

  SELECT * INTO _current_terms FROM public.legal_documents
    WHERE kind = 'terms' AND is_current = true LIMIT 1;
  SELECT * INTO _current_privacy FROM public.legal_documents
    WHERE kind = 'privacy' AND is_current = true LIMIT 1;

  -- Só bloqueia depois que a vigência chega. Antes disso é aviso.
  _terms_binding := _current_terms.effective_date IS NULL
    OR _current_terms.effective_date <= now();
  _privacy_binding := _current_privacy.effective_date IS NULL
    OR _current_privacy.effective_date <= now();

  _result := jsonb_build_object(
    'needs_terms', (_current_terms.version_num IS NOT NULL AND _current_terms.version_num > _terms_num),
    'needs_privacy', (_current_privacy.version_num IS NOT NULL AND _current_privacy.version_num > _privacy_num),
    'current_terms_version', _current_terms.version,
    'current_privacy_version', _current_privacy.version,
    'terms_effective_date', _current_terms.effective_date,
    'privacy_effective_date', _current_privacy.effective_date,
    -- 'binding' = já vigente, bloqueia o app até aceitar.
    -- 'notice'  = publicado com vigência futura, só avisa.
    'mode', CASE WHEN _terms_binding AND _privacy_binding THEN 'binding' ELSE 'notice' END,
    'days_until_effective', GREATEST(0, LEAST(
      CASE WHEN _current_terms.effective_date IS NULL THEN 0
           ELSE CEIL(EXTRACT(EPOCH FROM (_current_terms.effective_date - now())) / 86400.0) END,
      CASE WHEN _current_privacy.effective_date IS NULL THEN 0
           ELSE CEIL(EXTRACT(EPOCH FROM (_current_privacy.effective_date - now())) / 86400.0) END
    ))::int,
    'audience', _aud,
    'terms_changes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version', d.version,
        'effective_date', d.effective_date,
        'section', c.section,
        'change_type', c.change_type,
        'summary', c.summary,
        'legal_basis', c.legal_basis
      ) ORDER BY d.version_num, c.display_order)
      FROM public.legal_documents d
      JOIN public.legal_document_changes c ON c.document_id = d.id
      WHERE d.kind = 'terms' AND d.version_num > _terms_num
        AND d.version_num <= COALESCE(_current_terms.version_num, 0)
        AND (_aud = 'all' OR c.audience && ARRAY['all', _aud]::text[])
    ), '[]'::jsonb),
    'privacy_changes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'version', d.version,
        'effective_date', d.effective_date,
        'section', c.section,
        'change_type', c.change_type,
        'summary', c.summary,
        'legal_basis', c.legal_basis
      ) ORDER BY d.version_num, c.display_order)
      FROM public.legal_documents d
      JOIN public.legal_document_changes c ON c.document_id = d.id
      WHERE d.kind = 'privacy' AND d.version_num > _privacy_num
        AND d.version_num <= COALESCE(_current_privacy.version_num, 0)
        AND (_aud = 'all' OR c.audience && ARRAY['all', _aud]::text[])
    ), '[]'::jsonb)
  );

  RETURN _result;
END;
$$;

-- Compatibilidade: a assinatura de dois argumentos continua existindo para os
-- clientes que ainda não passam o papel, e delega para a nova.
CREATE OR REPLACE FUNCTION public.get_pending_legal_changes(
  _terms_accepted text,
  _privacy_accepted text
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_pending_legal_changes(_terms_accepted, _privacy_accepted, 'all');
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_legal_changes(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_legal_changes(text, text, text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Prova de aceite mais completa
-- ─────────────────────────────────────────────────────────────
--
-- `terms_acceptance` guardava só a string da versão. Guardar também qual linha
-- de `legal_documents` foi aceita e em que modo (aviso antecipado ou aceite
-- obrigatório) torna o registro autossuficiente: dá para recuperar o texto
-- exato que a pessoa viu, sem depender de a string continuar batendo.

ALTER TABLE public.terms_acceptance
  ADD COLUMN IF NOT EXISTS terms_document_id uuid REFERENCES public.legal_documents(id),
  ADD COLUMN IF NOT EXISTS privacy_document_id uuid REFERENCES public.legal_documents(id),
  ADD COLUMN IF NOT EXISTS acceptance_mode text NOT NULL DEFAULT 'binding';

COMMENT ON COLUMN public.terms_acceptance.acceptance_mode IS
  'binding = aceite exigido para continuar usando; '
  'notice = aceite antecipado, feito durante o período de aviso prévio.';

CREATE INDEX IF NOT EXISTS terms_acceptance_user_accepted_at_idx
  ON public.terms_acceptance (user_id, accepted_at DESC);

COMMIT;
