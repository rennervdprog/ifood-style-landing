// One-shot: provisions the E2E admin user on the EXTERNAL Supabase project,
// links it as owner of "Duda lanches Teste", and sets the required secrets
// (E2E_SETUP_TOKEN / E2E_TEST_EMAIL / E2E_TEST_PASSWORD) on the external project.
//
// Auth: requires header x-admin-secret === EXTERNAL_CRON_SECRET (local Cloud env).
// Returns the generated E2E_SETUP_TOKEN and password ONCE so we can persist
// them here in Lovable Cloud secrets. Never call this again unless rotating.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const STORE_ID = "71462610-0086-4619-a1fe-8788daf924a9"; // Duda lanches Teste
const EMAIL = "e2e-admin@itasuper.test";

function rand(len = 40) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, len);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const ADMIN = Deno.env.get("EXTERNAL_CRON_SECRET") || "";
  if (!ADMIN || req.headers.get("x-admin-secret") !== ADMIN) return json({ error: "unauthorized" }, 401);

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;

  const body = await req.json().catch(() => ({} as any));
  const password: string = body?.password || rand(24);
  const token: string = body?.token || rand(48);

  const steps: any[] = [];

  // 1) Create or fetch user via Auth Admin API
  let userId = "";
  {
    const r = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password, email_confirm: true, user_metadata: { full_name: "E2E Admin" } }),
    });
    const t = await r.text();
    let d: any; try { d = JSON.parse(t); } catch { d = t; }
    steps.push({ step: "create_user", status: r.status, body: d });
    if (r.ok && d?.id) {
      userId = d.id;
    } else {
      // maybe already exists — look up
      const lu = await fetch(`${URL_}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(EMAIL)}`, {
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
      });
      const lt = await lu.text();
      let ld: any; try { ld = JSON.parse(lt); } catch { ld = lt; }
      const found = ld?.users?.find?.((u: any) => u.email === EMAIL) || (Array.isArray(ld) ? ld.find((u: any) => u.email === EMAIL) : null);
      if (found?.id) {
        userId = found.id;
        // reset password so we know it
        const upd = await fetch(`${URL_}/auth/v1/admin/users/${userId}`, {
          method: "PUT",
          headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
          body: JSON.stringify({ password, email_confirm: true }),
        });
        steps.push({ step: "reset_password", status: upd.status });
      } else {
        return json({ error: "could not create or find user", steps }, 500);
      }
    }
  }

  async function runSql(query: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const t = await r.text(); let d: any; try { d = JSON.parse(t); } catch { d = t; }
    return { status: r.status, ok: r.ok, data: d };
  }

  // 2) Make user owner of the test store + ensure profile
  steps.push({ step: "upsert_profile", ...await runSql(`
    INSERT INTO public.profiles (user_id, email, full_name, role)
    VALUES ('${userId}', '${EMAIL}', 'E2E Admin', 'lojista')
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, role = 'lojista';
  `) });
  steps.push({ step: "set_owner", ...await runSql(`
    UPDATE public.stores SET owner_id = '${userId}' WHERE id = '${STORE_ID}';
  `) });
  steps.push({ step: "grant_role", ...await runSql(`
    INSERT INTO public.user_roles (user_id, role) VALUES ('${userId}', 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  `) });

  // 3) Push secrets to EXTERNAL project via Management API
  const secretsPayload = [
    { name: "E2E_SETUP_TOKEN", value: token },
    { name: "E2E_TEST_EMAIL", value: EMAIL },
    { name: "E2E_TEST_PASSWORD", value: password },
  ];
  const sr = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify(secretsPayload),
  });
  const st = await sr.text(); let sd: any; try { sd = JSON.parse(st); } catch { sd = st; }
  steps.push({ step: "set_external_secrets", status: sr.status, data: sd });

  return json({
    ok: true,
    user_id: userId,
    email: EMAIL,
    store_id: STORE_ID,
    E2E_SETUP_TOKEN: token,
    E2E_TEST_PASSWORD: password,
    steps,
    note: "Save E2E_SETUP_TOKEN + E2E_TEST_EMAIL + E2E_TEST_PASSWORD in Lovable Cloud secrets too. External secrets take ~1 min to propagate.",
  });
});