-- Fase 2 — Sistema de Matriz e Sublojas (plano 28/10/2026, decisões 1–11).
--
-- 1. stores.is_draft — a subloja nasce RASCUNHO invisível (C9/M8): fora da
--    vitrine (get_public_stores exige is_visible = true) e sem vender, até
--    o dono publicar com o checklist completo (migration 20261028142000).
-- 2. store_networks.is_paused — a rede pausada pausa as sublojas junto
--    (decisão 9, com confirmação na tela; RPC set_network_paused na
--    migration 20261028142000).
-- 3. is_unit_manager SEM o fallback legado — a branch que lia
--    profiles.unit_store_id sai agora: em 28/10/2026 havia 0 perfis com
--    unit_store_id preenchido e 0 vínculos ativos em store_managers, e o
--    campo do perfil é só-leitura desde a Fase 1. A fonte da verdade passa
--    a ser só store_managers (plano 4.1).
-- 4. ensure_lojista_has_store reescrito — o trigger que recriou 12 lojas
--    sozinho na limpeza da Fase 0: ao rebaixar 12 perfis para 'lojista', o
--    UPDATE disparou a criação de loja. A partir daqui:
--      INSERT de perfil lojista  -> cria a loja se não existir (cadastro
--        real: register_as_lojista conta com esse fallback);
--      UPDATE que vira lojista  -> NUNCA cria loja; só reativa a loja
--        existente (status 'analise' -> 'ativo') e garante o plano.
--    A linha morta `NEW.is_approved := true` sai: o trigger é AFTER, então
--    a atribuição não tinha efeito (a aprovação no INSERT é do trigger
--    force_auto_approve_trg).
--
-- O trigger em si não existe no repo (só no banco, como store_networks
-- antes da Fase 1) — por isso a função E o trigger são recriados aqui.
-- NÃO TOCA em monthly-billing, repasse ou qualquer função de cobrança.

-- ---------------------------------------------------------------------------
-- 1. stores.is_draft
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'stores'
                 AND column_name = 'is_draft') THEN
    ALTER TABLE public.stores ADD COLUMN is_draft boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. store_networks.is_paused
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'store_networks'
                 AND column_name = 'is_paused') THEN
    ALTER TABLE public.store_networks ADD COLUMN is_paused boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. is_unit_manager — só store_managers (fim do fallback legado)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_unit_manager(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.store_managers
    WHERE user_id = _user_id AND store_id = _store_id AND is_active
  );
$function$;

-- ---------------------------------------------------------------------------
-- 4. ensure_lojista_has_store — INSERT cria, UPDATE nunca cria
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_lojista_has_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid; v_name text; v_base_slug text; v_slug text; v_i int := 0;
BEGIN
  IF NEW.role = 'lojista' AND coalesce(NEW.is_approved, true) = true THEN
    SELECT id INTO v_store_id FROM public.stores WHERE owner_id = NEW.user_id LIMIT 1;
    IF v_store_id IS NULL THEN
      -- Só o cadastro (INSERT) cria loja. Um UPDATE que vira lojista
      -- (rebaixamento, limpeza, ajuste manual) NUNCA cria loja sozinho.
      IF TG_OP = 'INSERT' THEN
        v_name := coalesce(nullif(trim(NEW.full_name), ''), 'Minha Loja');
        v_base_slug := regexp_replace(lower(unaccent(v_name)), '[^a-z0-9]+', '-', 'g');
        v_base_slug := trim(both '-' from v_base_slug);
        IF v_base_slug = '' THEN v_base_slug := 'loja'; END IF;
        v_slug := v_base_slug;
        WHILE EXISTS (SELECT 1 FROM public.stores WHERE slug = v_slug) LOOP
          v_i := v_i + 1; v_slug := v_base_slug || '-' || v_i;
        END LOOP;
        INSERT INTO public.stores (owner_id, name, slug, status)
        VALUES (NEW.user_id, v_name, v_slug, 'ativo') RETURNING id INTO v_store_id;

        -- Garante plano ativo (default commission_only quando a RPC ainda
        -- não rodou).
        INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active,
          pdv_enabled, pdv_fixed_fee_per_sale, pdv_commission_rate)
        VALUES (v_store_id, 'commission_only', 0, 6.0, true, true, 1.00, 0)
        ON CONFLICT (store_id) DO NOTHING;
      END IF;
    ELSE
      UPDATE public.stores SET status = 'ativo' WHERE id = v_store_id AND status = 'analise';
      -- Garante plano ativo (default commission_only quando a RPC ainda não rodou).
      INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active,
        pdv_enabled, pdv_fixed_fee_per_sale, pdv_commission_rate)
      VALUES (v_store_id, 'commission_only', 0, 6.0, true, true, 1.00, 0)
      ON CONFLICT (store_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_lojista_has_store ON public.profiles;
CREATE TRIGGER trg_ensure_lojista_has_store
  AFTER INSERT OR UPDATE OF role, is_approved ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_lojista_has_store();
