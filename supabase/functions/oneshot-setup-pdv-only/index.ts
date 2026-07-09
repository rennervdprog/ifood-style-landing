import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const EXTERNAL_KEY =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;
    const svc = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    const report: Record<string, unknown> = {};

    // 1) Diagnóstico rápido: quais plan_types existem em plan_templates
    const { data: existingTemplates } = await svc
      .from("plan_templates")
      .select("plan_type, monthly_fee, commission_rate, is_active");
    report.existing_templates = existingTemplates;

    // 2) Tenta inserir template pdv_only (idempotente via upsert em plan_type)
    const pdvTemplate = {
      plan_type: "pdv_only",
      monthly_fee: 69,
      commission_rate: 0,
      is_active: true,
    };
    const { data: upserted, error: upErr } = await svc
      .from("plan_templates")
      .upsert(pdvTemplate, { onConflict: "plan_type" })
      .select();
    if (upErr) report.template_error = upErr.message;
    else report.template_upserted = upserted;

    // 3) Diagnóstico: coluna plan_type em stores aceita 'pdv_only'?
    //    Testa criando uma linha efêmera via consulta select
    const { data: sampleStore } = await svc
      .from("stores")
      .select("id, plan_type")
      .limit(1)
      .maybeSingle();
    report.sample_store = sampleStore;

    return json({ ok: true, report });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});