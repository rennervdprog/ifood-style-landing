const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DDL = `
CREATE TABLE IF NOT EXISTS public.asaas_subaccounts_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  external_store_id uuid,
  wallet_id text NOT NULL,
  account_id text,
  api_key text,
  cpf_cnpj text,
  email text,
  status text NOT NULL DEFAULT 'created',
  raw_response jsonb,
  last_error jsonb,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS asaas_subaccounts_registry_wallet_id_key ON public.asaas_subaccounts_registry(wallet_id);
CREATE INDEX IF NOT EXISTS asaas_subaccounts_registry_store_id_idx ON public.asaas_subaccounts_registry(store_id);
GRANT ALL ON public.asaas_subaccounts_registry TO service_role;
ALTER TABLE public.asaas_subaccounts_registry ENABLE ROW LEVEL SECURITY;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF");
    const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
    if (!ref || !token) {
      return new Response(JSON.stringify({ error: "Missing EXTERNAL_SUPABASE_PROJECT_REF or EXTERNAL_SUPABASE_ACCESS_TOKEN" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: DDL }),
    });
    const text = await res.text();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, response: text }), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});