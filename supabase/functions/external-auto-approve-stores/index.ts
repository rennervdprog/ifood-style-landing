// One-shot: aplica no banco EXTERNO a auto-aprovação de lojas e remove o gate de aprovação.
// - Atualiza public.register_as_lojista para já criar loja aprovada e ativa
// - Faz backfill de profiles/stores/store_networks pendentes
// Admin-only (service key OU JWT de admin externo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SQL = `
-- 1) Substitui register_as_lojista para já criar tudo aprovado e ativo
CREATE OR REPLACE FUNCTION public.register_as_lojista(
  _full_name text, _document text, _store_name text, _store_category store_category,
  _avatar_url text DEFAULT NULL::text, _whatsapp text DEFAULT NULL::text, _selected_plan text DEFAULT NULL::text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _store_id uuid;
  _plan_type store_plan_type;
  _monthly_fee numeric;
  _commission_rate numeric;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada. Faça login antes de cadastrar a loja.' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND role != 'cliente') THEN
    IF NOT EXISTS (SELECT 1 FROM stores WHERE owner_id = _user_id) THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Usuário já possui cadastro de parceiro.';
    END IF;
  END IF;

  INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number, is_approved)
  VALUES (_user_id, _full_name, 'lojista', _document, _avatar_url, _whatsapp, true)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'lojista',
    document = EXCLUDED.document,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, profiles.whatsapp_number),
    is_approved = true;

  INSERT INTO stores (name, category, owner_id, delivery_mode, status)
  VALUES (_store_name, _store_category, _user_id, 'own', 'ativo')
  RETURNING id INTO _store_id;

  IF _selected_plan IN ('supporter', 'apoiador') THEN
    _plan_type := 'supporter'::store_plan_type; _monthly_fee := 130.00; _commission_rate := 0.00;
  ELSIF _selected_plan = 'fixed' THEN
    _plan_type := 'fixed'::store_plan_type; _monthly_fee := 180.00; _commission_rate := 0.00;
  ELSIF _selected_plan = 'hybrid' THEN
    _plan_type := 'hybrid'::store_plan_type; _monthly_fee := 100.00; _commission_rate := 2.5;
  ELSE
    _plan_type := 'commission_only'::store_plan_type; _monthly_fee := 0.00; _commission_rate := 6.0;
  END IF;

  INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at)
  VALUES (_store_id, _plan_type, _monthly_fee, _commission_rate, true,
    CASE WHEN _plan_type IN ('fixed', 'hybrid', 'supporter') THEN now() + interval '7 days' ELSE NULL END
  ) ON CONFLICT (store_id) DO NOTHING;

  -- Horários fechados por padrão (lojista define depois)
  INSERT INTO opening_hours (store_id, day_of_week, is_closed_all_day, open_time, close_time)
  SELECT _store_id, d.day, true, '08:00', '22:00'
  FROM generate_series(0,6) AS d(day)
  ON CONFLICT DO NOTHING;

  RETURN _store_id;
END;
$function$;

-- 2) Backfill: tudo que estava pendente vira aprovado/ativo
UPDATE public.profiles SET is_approved = true
 WHERE role IN ('lojista','lojista_matriz','lojista_unidade') AND is_approved = false;

UPDATE public.stores SET status = 'ativo'
 WHERE status IN ('pendente','bloqueado_aprovacao');

-- 3) Matriz: aprovar todas as redes existentes (se a tabela existir)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='store_networks') THEN
    EXECUTE 'UPDATE public.store_networks SET is_approved = true WHERE is_approved = false';
  END IF;
END $$;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
  const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";
  const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const EXT_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const CRON = Deno.env.get("EXTERNAL_CRON_SECRET") || Deno.env.get("CRON_SECRET") || "";

  if (!TOKEN) return json({ error: "EXTERNAL_SUPABASE_ACCESS_TOKEN missing" }, 500);

  // Admin gate — service key, cron secret, or external admin JWT
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
  let isAdmin = !!auth && (auth === EXT_KEY || (!!CRON && auth === CRON));
  if (!isAdmin && auth) {
    try {
      const adm = createClient(EXT_URL, EXT_KEY);
      const { data: u } = await adm.auth.getUser(auth);
      if (u?.user) {
        const { data } = await adm.rpc("is_platform_admin", { _user_id: u.user.id });
        isAdmin = !!data;
      }
    } catch (e) { console.warn("auth check failed", e); }
  }
  if (!isAdmin) return json({ error: "Unauthorized", hasAuth: !!auth }, 401);

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  const text = await res.text();
  return json({ ok: res.ok, status: res.status, result: text.slice(0, 2000) }, res.ok ? 200 : 500);
});