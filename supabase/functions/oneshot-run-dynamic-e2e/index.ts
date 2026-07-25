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
  const target = stores?.find((s: any) => /dudalanchesteste/i.test(s.name))
    || stores?.find((s: any) => /dudalanchesfake/i.test(s.name))
    || stores?.[0];

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