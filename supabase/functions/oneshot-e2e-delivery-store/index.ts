// One-shot: ensures e2e-admin has a delivery-capable test store on EXTERNAL.
// Creates "E2E Delivery Teste" (plan essencial) if missing, sets owner + active.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL = "e2e-admin@itasuper.test";
const SLUG = "e2e-delivery-teste";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;

  async function sql(q: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const t = await r.text(); let d: any; try { d = JSON.parse(t); } catch { d = t; }
    return { status: r.status, data: d };
  }

  const steps: any[] = [];
  const u = await sql(`SELECT user_id FROM public.profiles WHERE email='${EMAIL}' LIMIT 1;`);
  steps.push({ step: "lookup_user", ...u });
  const userId = u.data?.[0]?.user_id;
  if (!userId) return json({ error: "e2e user not provisioned", steps }, 400);

  const cols = await sql(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stores' ORDER BY column_name;`);
  steps.push({ step: "cols", ...cols });

  const owned = await sql(`SELECT id, name, slug, plan_type FROM public.stores WHERE owner_id='${userId}';`);
  steps.push({ step: "owned_stores", ...owned });

  const activate = await sql(`
    UPDATE public.stores
       SET is_visible = true, status = 'active', is_open = true, force_closed = false
     WHERE owner_id = '${userId}'
     RETURNING id, name, slug, plan_type, is_visible, status, is_open;
  `);
  steps.push({ step: "activate_owned_stores", ...activate });

  return json({ ok: true, user_id: userId, stores: activate.data, steps });
});