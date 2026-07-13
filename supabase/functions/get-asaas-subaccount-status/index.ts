import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const EXTERNAL_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const EXTERNAL_SERVICE = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
      || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
      || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(EXTERNAL_URL, EXTERNAL_SERVICE);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const { store_id } = body;
    if (!store_id) return json({ error: "store_id is required" }, 400);

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, owner_id, asaas_account_id")
      .eq("id", store_id)
      .maybeSingle();

    if (storeErr || !store) return json({ error: "Loja não encontrada" }, 404);
    if (store.owner_id !== userId) return json({ error: "Sem permissão" }, 403);
    if (!store.asaas_account_id) return json({ error: "Subconta não configurada" }, 404);

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    // Padrão oficial Asaas: produção começa com $aact_prod_, sandbox com $aact_ apenas.
    const isSandbox = !ASAAS_API_KEY?.startsWith("$aact_prod_");
    const baseUrl = isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";

    const res = await fetch(`${baseUrl}/accounts/${store.asaas_account_id}/status`, {
      headers: { access_token: ASAAS_API_KEY! },
    });
    
    if (!res.ok) {
      const err = await res.json();
      return json({ error: "Erro ao consultar Asaas", details: err }, 400);
    }

    const raw = await res.json();
    // Normaliza para que o front possa ler tanto os nomes oficiais (atuais da API:
    // commercialInfo, bankAccountInfo, documentation, general) quanto os aliases
    // legados (bankAccount, document) usados em telas antigas.
    const status = {
      ...raw,
      commercialInfo: raw?.commercialInfo ?? null,
      bankAccountInfo: raw?.bankAccountInfo ?? raw?.bankAccount ?? null,
      documentation: raw?.documentation ?? raw?.document ?? null,
      general: raw?.general ?? null,
      // aliases legados (mantêm UI antiga funcionando)
      bankAccount: raw?.bankAccountInfo ?? raw?.bankAccount ?? null,
      document: raw?.documentation ?? raw?.document ?? null,
    };

    await adminClient
      .from("stores")
      .update({ asaas_activation_status: status })
      .eq("id", store_id);

    return json({ success: true, status });
  } catch (err) {
    console.error("get-asaas-subaccount-status error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
