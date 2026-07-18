// Utilitário do agente: roda SQL arbitrário no Supabase EXTERNO via service-role.
// Protegido por EXTERNAL_CRON_SECRET no header x-admin-secret.
// Roda SQL no projeto externo via Supabase Management API.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // SECURITY: exige header x-admin-secret === EXTERNAL_CRON_SECRET.
  // Sem o secret configurado a função fica desativada (503).
  const ADMIN_SECRET = Deno.env.get("EXTERNAL_CRON_SECRET") || "";
  if (!ADMIN_SECRET) return json({ error: "EXTERNAL_CRON_SECRET not configured" }, 503);
  const provided = req.headers.get("x-admin-secret") || "";
  if (provided !== ADMIN_SECRET) return json({ error: "Unauthorized" }, 401);

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
  const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const CRON = Deno.env.get("EXTERNAL_CRON_SECRET") || "";

  async function runSql(query: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const text = await r.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    return { status: r.status, ok: r.ok, data };
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  try {
    if (action === "run_sql") {
      const query = body?.query as string;
      if (!query) return json({ error: "query obrigatória" }, 400);
      return json(await runSql(query));
    }

    if (action === "inspect_fks") {
      const table = (body?.table as string) || "store_balances";
      const q = `
        SELECT conname,
               a.attname AS column_name,
               confrelid::regclass::text AS references_table,
               af.attname AS references_column
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
        WHERE c.contype = 'f' AND c.conrelid = ('public.${table}')::regclass
      `;
      return json(await runSql(q));
    }

    if (action === "call_ext_fn") {
      const name = body?.name as string;
      const payload = body?.body;
      const useCron = body?.use_cron === true;
      const bearer = useCron ? CRON : SVC;
      const r = await fetch(`${EXT_URL}/functions/v1/${name}`, {
        method: body?.method || "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: `Bearer ${bearer}`,
          "x-cron-secret": CRON,
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const t = await r.text();
      let d: unknown = t;
      try { d = JSON.parse(t); } catch {}
      return json({ status: r.status, ok: r.ok, data: d });
    }

    if (action === "test_embed") {
      const r = await fetch(`${EXT_URL}/rest/v1/store_balances?select=store_id,repasse_pendente,stores!inner(id,name,status,store_plans!inner(plan_type,is_active))&stores.status=eq.ativo&stores.store_plans.is_active=eq.true`, {
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
      });
      const t = await r.text();
      let d: unknown = t;
      try { d = JSON.parse(t); } catch {}
      return json({ status: r.status, ok: r.ok, data: d });
    }

    if (action === "list_ext_fns") {
      const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, {
        headers: { Authorization: `Bearer ${PAT}` },
      });
      const t = await r.text();
      let d: unknown = t;
      try { d = JSON.parse(t); } catch {}
      return json({ status: r.status, data: d });
    }

    if (action === "get_ext_fn_body") {
      const slug = body?.slug as string;
      const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/${slug}/body`, {
        headers: { Authorization: `Bearer ${PAT}` },
      });
      const text = await r.text();
      return json({ status: r.status, body: text });
    }

    if (action === "auth_admin") {
      // Proxy call to external /auth/v1/admin/*
      const path = body?.path as string;
      const method = (body?.method as string) || "POST";
      const payload = body?.body;
      if (!path) return json({ error: "path obrigatório" }, 400);
      const r = await fetch(`${EXT_URL}/auth/v1/admin/${path.replace(/^\//, "")}`, {
        method,
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const t = await r.text(); let d: unknown = t; try { d = JSON.parse(t); } catch {}
      return json({ status: r.status, ok: r.ok, data: d });
    }

    if (action === "set_ext_secrets") {
      // Set secrets on the external project via Management API.
      // body.secrets = [{ name, value }, ...]
      const secrets = body?.secrets;
      if (!Array.isArray(secrets) || !secrets.length) return json({ error: "secrets obrigatório" }, 400);
      const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
        body: JSON.stringify(secrets),
      });
      const t = await r.text(); let d: unknown = t; try { d = JSON.parse(t); } catch {}
      return json({ status: r.status, ok: r.ok, data: d });
    }

    if (action === "deploy_ext_fn") {
      const slug = body?.slug as string;
      const code = body?.code as string;
      const verifyJwt = body?.verify_jwt === true;
      if (!slug || !code) return json({ error: "slug e code obrigatórios" }, 400);
      const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/${slug}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: slug, verify_jwt: verifyJwt, body: code }),
      });
      const t = await r.text();
      let d: unknown = t;
      try { d = JSON.parse(t); } catch {}
      // Se a função ainda não existe, cria via POST /functions
      if (r.status === 404) {
        const r2 = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
          body: JSON.stringify({ slug, name: slug, verify_jwt: verifyJwt, body: code }),
        });
        const t2 = await r2.text();
        let d2: unknown = t2;
        try { d2 = JSON.parse(t2); } catch {}
        return json({ status: r2.status, ok: r2.ok, data: d2, created: true });
      }
      return json({ status: r.status, ok: r.ok, data: d });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});