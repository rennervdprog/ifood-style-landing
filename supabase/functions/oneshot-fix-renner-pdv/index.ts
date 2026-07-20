import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const sb = createClient(URL_, SVC);

  async function sql(q: string) {
    const r = await fetch(`${URL_}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ query: q }),
    });
    return { status: r.status, body: await r.text() };
  }

  const results: any = {};

  // 1) Backfill: fix RennerPdv store_plans row
  results.fix_renner = await sql(`
    UPDATE public.store_plans
    SET plan_type='pdv_only'::store_plan_type,
        monthly_fee=69.00,
        commission_rate=0,
        pdv_enabled=true,
        pdv_commission_rate=0,
        pdv_fixed_fee_per_sale=0,
        trial_ends_at=COALESCE(trial_ends_at, now() + interval '7 days')
    WHERE store_id='363c52e2-6477-4aae-89df-6ad8224e5c71';
  `);

  // 2) Ensure add-on PDV enabled + store hidden
  results.fix_store = await sql(`
    UPDATE public.stores SET is_visible=false, is_open=false, plan_type='pdv_only' WHERE id='363c52e2-6477-4aae-89df-6ad8224e5c71';
    INSERT INTO public.store_addons (store_id, addon_key, status, price_override)
    VALUES ('363c52e2-6477-4aae-89df-6ad8224e5c71','pdv','active',0)
    ON CONFLICT (store_id, addon_key) DO UPDATE SET status='active', price_override=0;
  `);

  // 3) Harden register_as_lojista: normalize input + guarantee INSERT does NOT collide
  results.harden_rpc = await sql(`
    CREATE OR REPLACE FUNCTION public.register_as_lojista(
      _full_name text, _document text, _store_name text, _store_category store_category,
      _avatar_url text DEFAULT NULL, _whatsapp text DEFAULT NULL, _selected_plan text DEFAULT NULL
    ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
    DECLARE
      _user_id uuid := auth.uid();
      _store_id uuid;
      _plan_type store_plan_type;
      _monthly_fee numeric;
      _commission_rate numeric;
      _split_override numeric := NULL;
      _pdv_rate numeric := 2;
      _pix_fee numeric := 1.99;
      _sel text := lower(trim(coalesce(_selected_plan,'')));
    BEGIN
      IF _user_id IS NULL THEN RAISE EXCEPTION 'Sessao nao encontrada.' USING ERRCODE='28000'; END IF;
      IF EXISTS (SELECT 1 FROM stores WHERE owner_id=_user_id) THEN RAISE EXCEPTION 'Usuario ja possui cadastro de parceiro.'; END IF;

      INSERT INTO profiles (user_id, full_name, role, document, avatar_url, whatsapp_number)
      VALUES (_user_id,_full_name,'lojista',_document,_avatar_url,_whatsapp)
      ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name, role='lojista',
        document=EXCLUDED.document,
        avatar_url=COALESCE(EXCLUDED.avatar_url,profiles.avatar_url),
        whatsapp_number=COALESCE(EXCLUDED.whatsapp_number,profiles.whatsapp_number);

      INSERT INTO stores (name, category, owner_id, delivery_mode, is_visible, plan_type)
      VALUES (_store_name,_store_category,_user_id,'own',
        CASE WHEN _sel='pdv_only' THEN false ELSE true END,
        CASE WHEN _sel='pdv_only' THEN 'pdv_only' ELSE 'essencial' END)
      RETURNING id INTO _store_id;

      IF _sel='fixed' THEN _plan_type:='fixed'; _monthly_fee:=0; _commission_rate:=0;
      ELSIF _sel='autonomy' THEN _plan_type:='autonomy'; _monthly_fee:=0; _commission_rate:=0; _split_override:=0;
      ELSIF _sel IN ('supporter','apoiador') THEN _plan_type:='supporter'; _monthly_fee:=75; _commission_rate:=0;
      ELSIF _sel='hybrid' THEN _plan_type:='hybrid'; _monthly_fee:=50; _commission_rate:=2.5;
      ELSIF _sel IN ('pdv_only','pdv','somente_pdv') THEN
        _plan_type:='pdv_only'; _monthly_fee:=69; _commission_rate:=0; _pdv_rate:=0;
      ELSE _plan_type:='commission_only'; _monthly_fee:=0; _commission_rate:=6.0;
      END IF;

      INSERT INTO public.store_plans (
        store_id, plan_type, monthly_fee, commission_rate, is_active, trial_ends_at,
        platform_delivery_split_override, pdv_enabled, pdv_commission_rate,
        pdv_fixed_fee_per_sale, pix_operational_fee_override
      ) VALUES (
        _store_id, _plan_type, _monthly_fee, _commission_rate, true,
        CASE WHEN _plan_type IN ('hybrid','supporter','pdv_only') THEN now()+interval '7 days' ELSE NULL END,
        _split_override, true, _pdv_rate,
        CASE WHEN _plan_type='pdv_only' THEN 0 ELSE 1 END,
        _pix_fee
      ) ON CONFLICT (store_id) DO UPDATE SET
        plan_type=EXCLUDED.plan_type,
        monthly_fee=EXCLUDED.monthly_fee,
        commission_rate=EXCLUDED.commission_rate;

      IF _plan_type='pdv_only' THEN
        INSERT INTO public.store_addons (store_id, addon_key, status, price_override)
        VALUES (_store_id,'pdv','active',0)
        ON CONFLICT (store_id, addon_key) DO UPDATE SET status='active', price_override=0;
      END IF;

      RETURN _store_id;
    END; $$;
  `);

  return new Response(JSON.stringify(results, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});