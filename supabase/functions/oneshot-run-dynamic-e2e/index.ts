// oneshot: invokes e2e-dynamic-upgrade-flow for both plans using env secret.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secret = Deno.env.get("E2E_ADMIN_SECRET") || "";
  const extUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const extKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const admin = createClient(extUrl, extKey);

  // find dudalanches* stores
  const { data: stores } = await admin
    .from("stores")
    .select("id, name")
    .or("name.ilike.%dudalanches%,name.ilike.%fake%,name.ilike.%teste%")
    .limit(20);

  // sample orders row to see columns
  const { data: sample } = await admin.from("orders").select("*").limit(1);

  const results: any[] = [];
  // Prefer "Duda lanches Teste"; ensure it has an active store_plan
  const candidates = (stores || []).sort((a: any, b: any) => {
    const score = (s: any) => /duda.*teste/i.test(s.name) ? 0 : /duda/i.test(s.name) ? 1 : 2;
    return score(a) - score(b);
  });
  let target: any = null;
  for (const s of candidates) {
    const { data: plan } = await admin.from("store_plans")
      .select("id").eq("store_id", s.id).eq("is_active", true).maybeSingle();
    if (plan) { target = s; break; }
  }

  for (const plan_type of ["fixed", "autonomy"] as const) {
    const r = await fetch(`${url}/functions/v1/e2e-dynamic-upgrade-flow`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-e2e-secret": secret },
      body: JSON.stringify({ plan_type, store_id: target?.id }),
    });
    results.push({ plan_type, status: r.status, body: await r.json().catch(() => ({})) });
  }
  return new Response(JSON.stringify({ target, stores, order_columns: sample?.[0] ? Object.keys(sample[0]) : [], results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});