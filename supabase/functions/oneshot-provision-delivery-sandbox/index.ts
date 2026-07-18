// Provisions a FRESH delivery sandbox: new auth user + new store owned by them.
// Auth: header x-admin-secret === EXTERNAL_CRON_SECRET.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const EMAIL = "e2e-delivery@itasuper.test";
const STORE_NAME = "E2E Delivery Sandbox";
const STORE_SLUG = "e2e-delivery-sandbox";

function rand(len = 24) {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("").slice(0, len);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const ADMIN = Deno.env.get("EXTERNAL_CRON_SECRET") || "";
  if (!ADMIN || req.headers.get("x-admin-secret") !== ADMIN) return json({ error: "unauthorized" }, 401);

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

  const password = rand(24);
  const steps: any[] = [];

  // 1) create/find user
  let userId = "";
  const cr = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password, email_confirm: true, user_metadata: { full_name: "E2E Delivery" } }),
  });
  const cd = await cr.json().catch(() => ({}));
  steps.push({ step: "create_user", status: cr.status, id: cd?.id, msg: cd?.msg || cd?.error_description });
  if (cd?.id) userId = cd.id;
  else {
    const lu = await fetch(`${URL_}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(EMAIL)}`, {
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    });
    const ld = await lu.json().catch(() => ({}));
    const found = ld?.users?.find?.((u: any) => u.email === EMAIL);
    if (!found?.id) return json({ error: "no user", steps }, 500);
    userId = found.id;
    const upd = await fetch(`${URL_}/auth/v1/admin/users/${userId}`, {
      method: "PUT", headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password, email_confirm: true }),
    });
    steps.push({ step: "reset_password", status: upd.status });
  }

  async function sql(q: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const t = await r.text(); let d: any; try { d = JSON.parse(t); } catch { d = t; }
    return { status: r.status, data: d };
  }

  steps.push({ step: "profile", ...await sql(`
    INSERT INTO public.profiles (user_id, email, full_name, role)
    VALUES ('${userId}', '${EMAIL}', 'E2E Delivery', 'lojista')
    ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email, role='lojista';
  `) });

  // 2) create store (fresh, owned by new user)
  steps.push({ step: "create_store", ...await sql(`
    INSERT INTO public.stores (owner_id, name, slug, category, plan_type, is_visible, status, is_open, force_closed, delivery_enabled, is_test)
    VALUES ('${userId}', '${STORE_NAME}', '${STORE_SLUG}', 'Lanches', 'essencial', true, 'ativo', true, false, true, true)
    ON CONFLICT (slug) DO UPDATE SET owner_id=EXCLUDED.owner_id, is_visible=true, status='ativo', is_open=true, force_closed=false
    RETURNING id, slug, name, plan_type, status;
  `) });

  return json({
    ok: true,
    email: EMAIL,
    password,
    user_id: userId,
    store_slug: STORE_SLUG,
    steps,
    note: "Guarde a senha — só é retornada aqui uma vez. Login em /admin com esse e-mail.",
  });
});