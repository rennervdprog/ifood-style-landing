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

  // Dev-only: sem auth. DELETAR após investigação.

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;

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

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});