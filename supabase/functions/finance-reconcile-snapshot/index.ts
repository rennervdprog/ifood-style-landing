import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    // Apenas super_admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const isSandbox = !ASAAS_API_KEY?.startsWith("$aact_prod_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    const { data: stores } = await admin
      .from("stores")
      .select("id, name, asaas_subaccount_api_key, is_test")
      .not("asaas_subaccount_api_key", "is", null);
    const { data: balances } = await admin
      .from("store_balances")
      .select("store_id, comissao_pendente, repasse_pendente");

    const items = await Promise.all(
      (stores || [])
        .filter((s: any) => !s.is_test)
        .map(async (s: any) => {
          const bal = balances?.find((b: any) => b.store_id === s.id);
          const interno =
            Number(bal?.comissao_pendente || 0) - Number(bal?.repasse_pendente || 0);
          try {
            const r = await fetch(`${baseUrl}/finance/balance`, {
              headers: { access_token: s.asaas_subaccount_api_key },
            });
            const j = await r.json();
            const asaas = Number(j?.balance ?? 0);
            return {
              store_id: s.id,
              name: s.name,
              asaas_balance: asaas,
              internal_balance: interno,
              diff: asaas - interno,
              ok: r.ok,
            };
          } catch (e) {
            return {
              store_id: s.id,
              name: s.name,
              asaas_balance: null,
              internal_balance: interno,
              diff: null,
              ok: false,
              error: String(e),
            };
          }
        }),
    );

    return json({
      success: true,
      snapshot_at: new Date().toISOString(),
      total: items.length,
      items,
    });
  } catch (e) {
    console.error("finance-reconcile-snapshot error:", e);
    return json({ error: "Erro interno" }, 500);
  }
});