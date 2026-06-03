import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { store_id } = body;
    if (!store_id) return json({ error: "store_id is required" }, 400);

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, owner_id")
      .eq("id", store_id)
      .maybeSingle();

    if (storeErr || !store) return json({ error: "Loja não encontrada" }, 404);
    if (store.owner_id !== userId) return json({ error: "Sem permissão" }, 403);

    const { data: creds } = await supabase
      .from("store_credentials")
      .select("store_id, asaas_account_id")
      .eq("store_id", store_id)
      .maybeSingle();
    if (!creds?.asaas_account_id) return json({ error: "Subconta não configurada" }, 404);

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    const isSandbox = !ASAAS_API_KEY?.startsWith("$aact_");
    const baseUrl = isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";

    const res = await fetch(`${baseUrl}/accounts/${creds.asaas_account_id}/status`, {
      headers: { access_token: ASAAS_API_KEY! },
    });
    
    if (!res.ok) {
      const err = await res.json();
      return json({ error: "Erro ao consultar Asaas", details: err }, 400);
    }

    const status = await res.json();

    await adminClient
      .from("store_credentials")
      .update({ asaas_activation_status: status })
      .eq("store_id", store_id);

    return json({ success: true, status });
  } catch (err) {
    console.error("get-asaas-subaccount-status error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
