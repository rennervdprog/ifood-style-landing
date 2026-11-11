-- Sistema de Afiliados — Fase 1.2 (2026-11-10): vínculo no cadastro.
--
-- RPC bind_store_to_affiliate: chamada pelo cliente logo depois que a loja
-- é criada (cadastro público /cadastro-lojista e conclusão em /parceiro),
-- com o código de indicação vindo do link (?ref=CODIGO) ou digitado no
-- formulário. Grava em affiliate_referrals (tabela do item 1.1, cuja RLS
-- não permite INSERT de authenticated — por isso a função SECURITY
-- DEFINER, no mesmo padrão da reseller_attach_signup).
--
-- Retornos (text):
--   'bound'         — vínculo criado (ou esta chamada venceu a corrida e o
--                     vínculo desta loja é deste afiliado)
--   'invalid_code'  — código vazio, inexistente ou de afiliado NÃO aprovado
--   'already_bound' — a loja já tinha afiliado (vínculo é único e
--                     permanente; repetir a chamada é seguro: idempotente)
--   'self_referral' — autoindicação detectada (ver antifraude abaixo)
--
-- Antifraude básico (fontes reais, gravadas no cadastro pela
-- register_as_lojista — nada inventado):
--   1. affiliates.user_id = stores.owner_id (a conta do afiliado é a dona
--      da loja) — mesmo critério da reseller_attach_signup;
--   2. affiliates.document (só dígitos) igual ao documento do dono
--      (profiles.document) ou ao documento da loja (stores.cnpj_cpf).
--   Se affiliates.document estiver vazio, o critério 2 simplesmente não
--   dispara (não há o que comparar); o critério 1 continua valendo.

CREATE OR REPLACE FUNCTION public.bind_store_to_affiliate(p_store_id uuid, p_code text, p_source text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_requester uuid := auth.uid();
  v_code text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  v_affiliate_id uuid;
  v_affiliate_user_id uuid;
  v_affiliate_document text;
  v_store_owner uuid;
  v_store_document text;
  v_owner_document text;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF p_source NOT IN ('link', 'code') THEN
    RAISE EXCEPTION 'Fonte de vínculo inválida.' USING ERRCODE = '22023';
  END IF;

  IF v_code = '' THEN
    RETURN 'invalid_code';
  END IF;

  -- Só afiliado APROVADO indica (pending/suspended não vinculam).
  SELECT id, user_id, regexp_replace(coalesce(document, ''), '\D', '', 'g')
    INTO v_affiliate_id, v_affiliate_user_id, v_affiliate_document
  FROM public.affiliates
  WHERE referral_code = v_code
    AND status = 'approved';

  IF v_affiliate_id IS NULL THEN
    RETURN 'invalid_code';
  END IF;

  SELECT owner_id, regexp_replace(coalesce(cnpj_cpf, ''), '\D', '', 'g')
    INTO v_store_owner, v_store_document
  FROM public.stores
  WHERE id = p_store_id;

  IF v_store_owner IS NULL THEN
    RAISE EXCEPTION 'Loja não encontrada.';
  END IF;

  -- Quem chama precisa ser o dono da loja recém-criada (ou admin).
  IF v_store_owner <> v_requester AND NOT public.is_platform_admin(v_requester) THEN
    RAISE EXCEPTION 'Sem permissão para vincular afiliado a esta loja.';
  END IF;

  -- Idempotência: loja já vinculada (a qualquer afiliado) não muda.
  IF EXISTS (
    SELECT 1 FROM public.affiliate_referrals WHERE store_id = p_store_id
  ) THEN
    RETURN 'already_bound';
  END IF;

  -- Antifraude: autoindicação pela conta (mesmo usuário) ...
  IF v_affiliate_user_id IS NOT NULL AND v_affiliate_user_id = v_store_owner THEN
    RETURN 'self_referral';
  END IF;

  -- ... ou pelo documento (afiliado × documento do dono/loja).
  IF v_affiliate_document <> '' THEN
    SELECT regexp_replace(coalesce(document, ''), '\D', '', 'g')
      INTO v_owner_document
    FROM public.profiles
    WHERE user_id = v_store_owner;

    IF v_affiliate_document = v_store_document
       OR (v_owner_document IS NOT NULL AND v_affiliate_document = v_owner_document) THEN
      RETURN 'self_referral';
    END IF;
  END IF;

  INSERT INTO public.affiliate_referrals (affiliate_id, store_id, source)
  VALUES (v_affiliate_id, p_store_id, p_source)
  ON CONFLICT (store_id) DO NOTHING;

  -- Corrida entre duas chamadas simultâneas: se o vínculo que ficou não é
  -- deste afiliado, quem gravou foi a outra chamada.
  IF EXISTS (
    SELECT 1 FROM public.affiliate_referrals
    WHERE store_id = p_store_id AND affiliate_id = v_affiliate_id
  ) THEN
    RETURN 'bound';
  END IF;

  RETURN 'already_bound';
END;
$function$;

REVOKE ALL ON FUNCTION public.bind_store_to_affiliate(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bind_store_to_affiliate(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.bind_store_to_affiliate(uuid, text, text) IS
  'Vincula a loja recém-criada ao afiliado do código de indicação (item 1.2). Retorna bound | invalid_code | already_bound | self_referral.';
