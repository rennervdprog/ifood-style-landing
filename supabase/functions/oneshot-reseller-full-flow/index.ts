// E2E real do sistema de revenda:
//   1) pega revendedor RENAN2026 (approved)
//   2) cria loja fake atrelada via reseller_attach_signup
//    3) semeia 20 pedidos com status='entregue' nos últimos 30d
//   4) marca whatsapp_verified_at do owner
//   5) roda reseller_process_bounties(false) e valida commission bounty criada
//   6) devolve resumo detalhado
//
// Uso: POST /functions/v1/oneshot-reseller-full-flow  (sem body).
// Cleanup opcional: POST ?mode=cleanup

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
const MGMT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;

async function sql(query: string): Promise<any[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await r.json().catch(() => ({}));
  if (r.status >= 300) throw new Error(`sql ${r.status}: ${JSON.stringify(body)}`);
  return body as any[];
}

const STORE_TAG = "e2e-reseller-full-flow";

async function cleanup() {
  await sql(`
    DELETE FROM public.reseller_commissions
      WHERE store_id IN (SELECT id FROM public.stores WHERE slug LIKE 'e2e-rff-%');
    DELETE FROM public.reseller_referrals
      WHERE store_id IN (SELECT id FROM public.stores WHERE slug LIKE 'e2e-rff-%');
    DELETE FROM public.orders
      WHERE store_id IN (SELECT id FROM public.stores WHERE slug LIKE 'e2e-rff-%');
    DELETE FROM public.stores WHERE slug LIKE 'e2e-rff-%';
    DELETE FROM auth.users WHERE email LIKE 'e2e-rff-%@itasuper.test';
  `);
}

async function run() {
  const steps: any[] = [];
  const push = (step: string, ok: boolean, data: unknown = null) => {
    steps.push({ step, ok, data });
    console.log(`[${ok ? "OK" : "FAIL"}] ${step}`, JSON.stringify(data));
  };

  // 1) Reseller aprovado
  const reseller = await sql(
    `SELECT id, user_id, code, status FROM public.resellers WHERE code='RENAN2026' LIMIT 1;`,
  );
  if (!reseller.length) throw new Error("RENAN2026 não existe");
  const r = reseller[0];
  push("reseller_lookup", true, r);
  if (r.status !== "approved") {
    await sql(`UPDATE public.resellers SET status='approved', approved_at=now() WHERE id='${r.id}';`);
    push("reseller_force_approved", true);
  }

  // 2) Criar owner + store fake
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `e2e-rff-${suffix}@itasuper.test`;
  const slug = `e2e-rff-${suffix}`;
  const owner = await sql(`
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      aud, role
    ) VALUES (
      gen_random_uuid(),'00000000-0000-0000-0000-000000000000','${email}',
      crypt('e2e-pass', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"E2E RFF"}'::jsonb, now(), now(),'authenticated','authenticated'
    ) RETURNING id;
  `);
  const ownerId = owner[0].id;
  await sql(`
    INSERT INTO public.profiles (user_id, full_name, whatsapp_verified_at)
    VALUES ('${ownerId}','E2E RFF', now())
    ON CONFLICT (user_id) DO UPDATE SET whatsapp_verified_at = now();
  `);
  const store = await sql(`
    INSERT INTO public.stores (name, category, slug, owner_id, plan_type, status, is_visible)
    VALUES ('E2E RFF Store','lanches','${slug}','${ownerId}','pdv_only','ativo', false)
    RETURNING id;
  `);
  const storeId = store[0].id;
  push("store_created", true, { storeId, ownerId, email });

  // 3) Referral (attach)
  await sql(`
    INSERT INTO public.reseller_referrals (reseller_id, store_id, status, created_at, updated_at)
    VALUES ('${r.id}','${storeId}','pending', now(), now())
    ON CONFLICT DO NOTHING;
  `);
  push("referral_attached", true);

  // 4) 20 pedidos entregues
  await sql(`
    INSERT INTO public.orders (store_id, status, total_price, subtotal, delivery_fee, payment_method, neighborhood, created_at)
    SELECT '${storeId}','entregue', 25.00, 25.00, 0, 'dinheiro', 'Centro',
           now() - (i * interval '1 hour')
    FROM generate_series(1,20) i;
  `);
  const count = await sql(`SELECT count(*)::int AS n FROM public.orders WHERE store_id='${storeId}' AND status='entregue';`);
  push("orders_seeded", count[0].n === 20, count[0]);

  // 5) Rodar bounty cron
  const cronResp = await sql(`SELECT public.reseller_process_bounties(false) AS result;`);
  push("bounty_cron_run", true, cronResp[0]);

  // 6) Validar commission bounty criada
  const comm = await sql(`
    SELECT id, type, amount_cents, status
    FROM public.reseller_commissions
    WHERE reseller_id='${r.id}' AND store_id='${storeId}' AND type='bounty';
  `);
  push("bounty_commission_present", comm.length === 1, comm[0] || null);

  const refStatus = await sql(`SELECT status, activated_at FROM public.reseller_referrals WHERE reseller_id='${r.id}' AND store_id='${storeId}';`);
  push("referral_activated", refStatus[0]?.status === "active", refStatus[0]);

  const summary = {
    ok: steps.every((s) => s.ok),
    reseller_id: r.id,
    store_id: storeId,
    owner_email: email,
    steps,
  };
  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  try {
    if (mode === "cleanup") {
      await cleanup();
      return new Response(JSON.stringify({ ok: true, cleaned: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const result = await run();
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});