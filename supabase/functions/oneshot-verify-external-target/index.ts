import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Diagnóstico: mostra QUAL projeto Supabase cada conjunto de secrets aponta.
// Uso: chamar via `supabase.functions.invoke("oneshot-verify-external-target")`.
// Só admin da plataforma pode chamar.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const lovableUrl = Deno.env.get("SUPABASE_URL") || "";
  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
  const lovableSvc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const externalSvc = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
    || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
    || Deno.env.get("SERVICE_ROLE_KEY") || "";

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Autentica contra o externo (fonte de verdade dos user_roles).
  const externalKey = externalSvc || lovableSvc;
  const externalUrlEff = externalUrl || lovableUrl;
  let isAdmin = false;
  try {
    const admin = createClient(externalUrlEff, externalKey);
    const { data: u } = await admin.auth.getUser(token);
    if (u?.user) {
      const { data: role } = await admin
        .from("user_roles").select("role")
        .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      isAdmin = !!role;
    }
  } catch (_) { /* fallthrough */ }

  if (!isAdmin) return json({ error: "Unauthorized" }, 401);

  // Detecta em qual projeto cada conjunto realmente aterra: conta linhas de profiles.
  const probe = async (label: string, u: string, k: string) => {
    if (!u || !k) return { label, url: u || null, error: "missing_secret" };
    try {
      const c = createClient(u, k);
      const { count, error } = await c.from("profiles")
        .select("user_id", { count: "exact", head: true });
      if (error) return { label, url: u, error: error.message };
      // Também tenta ler uma tabela específica do externo (stores) pra confirmar
      const { count: sc, error: sErr } = await c.from("stores")
        .select("id", { count: "exact", head: true });
      return {
        label,
        url: u,
        host_short: u.replace(/^https?:\/\//, "").split(".")[0],
        profiles_count: count,
        stores_count: sErr ? null : sc,
        stores_error: sErr?.message || null,
      };
    } catch (e) {
      return { label, url: u, error: String(e) };
    }
  };

  const [defaultProbe, externalProbe] = await Promise.all([
    probe("SUPABASE_URL (default/lovable)", lovableUrl, lovableSvc),
    probe("EXTERNAL_SUPABASE_URL (external)", externalUrl, externalSvc),
  ]);

  const same = lovableUrl && externalUrl && lovableUrl === externalUrl;
  const externalPresent = !!externalUrl && !!externalSvc;
  const risk = !externalPresent
    ? "HIGH: EXTERNAL_SUPABASE_URL/KEY não configurados — functions sem fallback rodam no projeto default (potencial Lovable Cloud)."
    : same
      ? "OK: default e external apontam para o mesmo projeto."
      : "OK: external configurado — functions com fallback atingem o projeto certo.";

  return json({
    same_project: same,
    external_configured: externalPresent,
    risk_assessment: risk,
    default: defaultProbe,
    external: externalProbe,
    checked_at: new Date().toISOString(),
  });
});