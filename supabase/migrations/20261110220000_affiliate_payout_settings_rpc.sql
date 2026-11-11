-- Sistema de Afiliados — Fase 2 (2026-11-11): dados de recebimento.
--
-- RPC update_affiliate_payout_settings: chamada pelo painel do afiliado
-- (/afiliado) para ele mesmo trocar a chave Pix e o dia do lote (5 ou 20).
-- A tabela affiliates só tem policy de SELECT para o dono (Fase 1.1) —
-- a escrita passa por esta função SECURITY DEFINER, que atualiza
-- EXCLUSIVAMENTE a linha de quem chama (user_id = auth.uid()), no mesmo
-- padrão da bind_store_to_affiliate (item 1.2).
--
-- Validações: autenticação obrigatória; dia ∈ {5, 20}; chave Pix não
-- vazia (depois do trim). Retorna 'ok'.

CREATE OR REPLACE FUNCTION public.update_affiliate_payout_settings(p_pix_key text, p_payout_day int)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_requester uuid := auth.uid();
  v_pix_key text := nullif(btrim(coalesce(p_pix_key, '')), '');
  v_status text;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  IF p_payout_day IS NULL OR p_payout_day NOT IN (5, 20) THEN
    RAISE EXCEPTION 'Dia de pagamento inválido: escolha o dia 5 ou o dia 20.'
      USING ERRCODE = '22023';
  END IF;

  IF v_pix_key IS NULL THEN
    RAISE EXCEPTION 'Informe sua chave Pix.' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_status
  FROM public.affiliates
  WHERE user_id = v_requester;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Cadastro de afiliado não encontrado.';
  END IF;

  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'Cadastro de afiliado suspenso: alterações de recebimento não permitidas.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.affiliates
  SET pix_key = v_pix_key,
      payout_day = p_payout_day,
      updated_at = now()
  WHERE user_id = v_requester;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro de afiliado não encontrado.';
  END IF;

  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION public.update_affiliate_payout_settings(text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_affiliate_payout_settings(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_affiliate_payout_settings(text, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_affiliate_payout_settings(text, int) IS
  'Afiliado atualiza a própria chave Pix e o dia do lote (5 ou 20) — Fase 2, painel /afiliado. Retorna ok.';
