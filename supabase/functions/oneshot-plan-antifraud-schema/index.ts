const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const SQL = `
-- 1.1 Prorata real
ALTER TABLE public.store_plans
  ADD COLUMN IF NOT EXISTS billing_credit_cents INTEGER NOT NULL DEFAULT 0;

-- 2.1 Rate-limit por IP/device
ALTER TABLE public.signup_attempts
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS signup_attempts_ip_idx ON public.signup_attempts (ip, created_at);
CREATE INDEX IF NOT EXISTS signup_attempts_device_idx ON public.signup_attempts (device_id, created_at);

-- 2.3 WhatsApp OTP
CREATE TABLE IF NOT EXISTS public.whatsapp_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  whatsapp TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_otp TO authenticated;
GRANT ALL ON public.whatsapp_otp TO service_role;
ALTER TABLE public.whatsapp_otp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own otp" ON public.whatsapp_otp;
CREATE POLICY "own otp" ON public.whatsapp_otp FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS whatsapp_otp_user_idx ON public.whatsapp_otp (user_id, created_at);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;

-- 2.4 Fraude por loja
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS max_delivery_km NUMERIC NOT NULL DEFAULT 15;

-- 2.5 Unicidade CPF/CNPJ (garantir)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS stores_cnpj_cpf_unique_idx
  ON public.stores (cnpj_cpf)
  WHERE cnpj_cpf IS NOT NULL;

NOTIFY pgrst, 'reload schema';
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(JSON.stringify({ status: r.status, body: await r.text() }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});