import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Emite apenas cobranças Woovi Sandbox para uma loja explicitamente marcada
 * como is_test=true. Nunca usa URL, App ID ou registros do ambiente real.
 */
const WOOVI_SANDBOX_API = "https://api.woovi-sandbox.com";
const BodySchema = z.object({
  store_id: z.string().uuid(),
  expires_in_seconds: z.number().int().min(60).max(3600).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-woovi-sandbox-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const e2eSecret = Deno.env.get("WOOVI_SANDBOX_E2E_SECRET") || "";
  if (!e2eSecret || req.headers.get("x-woovi-sandbox-secret") !== e2eSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sandboxAppId = Deno.env.get("WOOVI_SANDBOX_APP_ID") || "";
  if (!sandboxAppId) return json({ error: "WOOVI_SANDBOX_APP_ID não configurada" }, 500);

  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
    || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
  if (!externalUrl || !serviceKey) return json({ error: "Configuração Supabase ausente" }, 500);

  let input: z.infer<typeof BodySchema>;
  try {
    input = BodySchema.parse(await req.json());
  } catch (error) {
    return json({ error: "Payload inválido", detail: String(error) }, 400);
  }

  const supabase = createClient(externalUrl, serviceKey);
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, owner_id, status, is_test")
    .eq("id", input.store_id)
    .maybeSingle();

  if (storeError) return json({ error: "Falha ao buscar loja" }, 500);
  if (!store?.is_test) return json({ error: "Somente lojas marcadas como teste podem usar sandbox" }, 403);
  if (store.status !== "ativo") return json({ error: "A loja de teste precisa estar ativa" }, 409);

  const { data: plan, error: planError } = await supabase
    .from("store_plans")
    .select("id, plan_type, monthly_fee, pdv_commission_pending, is_active")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .maybeSingle();
  if (planError) return json({ error: "Falha ao buscar plano" }, 500);
  if (!plan) return json({ error: "Plano ativo não encontrado para a loja de teste" }, 400);

  const monthlyFee = Number(plan.monthly_fee || 0);
  const pdvPending = Number(plan.pdv_commission_pending || 0);
  const totalAmount = Math.round((monthlyFee + pdvPending) * 100) / 100;
  if (totalAmount <= 0) return json({ error: "O plano de teste precisa ter valor mensal ou comissão pendente" }, 400);

  const referenceCode = `#MENS-SBX-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const expiresIn = input.expires_in_seconds ?? 900;
  // A Woovi Sandbox rejeita caracteres especiais/emoji no comentário.
  const description = `HOMOLOGACAO SANDBOX - mensalidade ${store.name} - ${referenceCode}`.slice(0, 140);

  const { data: owner } = await supabase
    .from("profiles")
    .select("full_name, email, document")
    .eq("user_id", store.owner_id)
    .maybeSingle();
  const taxId = String(owner?.document || "").replace(/\D/g, "");

  const chargeBody: Record<string, unknown> = {
    correlationID: referenceCode,
    value: Math.round(totalAmount * 100),
    comment: description,
    expiresIn,
    customer: {
      name: owner?.full_name || store.name || "Loja de teste ItaSuper",
      email: owner?.email || `sandbox-${store.id.slice(0, 8)}@itasuper.test`,
      ...(taxId.length === 11 || taxId.length === 14
        ? { taxID: { taxID: taxId, type: taxId.length === 11 ? "BR:CPF" : "BR:CNPJ" } }
        : {}),
    },
  };

  let wooviPayload: any;
  try {
    const response = await fetch(`${WOOVI_SANDBOX_API}/api/v1/charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: sandboxAppId },
      body: JSON.stringify(chargeBody),
    });
    wooviPayload = await response.json().catch(() => ({}));
    if (!response.ok || wooviPayload?.error) {
      console.error("[woovi-sandbox-monthly-billing] charge error", response.status, wooviPayload);
      return json({ error: "Falha ao criar cobrança sandbox", provider_status: response.status }, 502);
    }
  } catch (error) {
    console.error("[woovi-sandbox-monthly-billing] network error", error);
    return json({ error: "Falha de comunicação com Woovi Sandbox" }, 502);
  }

  const charge = wooviPayload?.charge || wooviPayload;
  const chargeId = String(charge?.identifier || "");
  const brCode = String(charge?.brCode || "");
  if (!chargeId || !brCode) return json({ error: "Resposta sandbox sem identificador ou PIX" }, 502);

  const { data: transaction, error: insertError } = await supabase
    .from("financial_transactions")
    .insert({
      store_id: store.id,
      transaction_kind: "commission_charge",
      reference_code: referenceCode,
      amount: totalAmount,
      status: "pending",
      provider: "woovi_sandbox",
      mercado_pago_payment_id: chargeId,
      pix_qr_code: brCode,
      pix_qr_code_base64: charge?.brCodeBase64 || null,
      pix_copy_paste: brCode,
      metadata: {
        sandbox: true,
        charge_family: "monthly_subscription_sandbox",
        plan_type: plan.plan_type,
        pdv_pending_billed: pdvPending,
        expires_in_seconds: expiresIn,
        woovi_environment: "TESTING",
      },
    })
    .select("id, reference_code, amount, status, mercado_pago_payment_id")
    .single();

  if (insertError) {
    console.error("[woovi-sandbox-monthly-billing] transaction insert error", insertError);
    return json({ error: "Cobrança sandbox criada, mas falhou o registro de homologação" }, 500);
  }

  await supabase
    .from("store_plans")
    .update({ last_billing_attempt_at: new Date().toISOString() })
    .eq("id", plan.id);

  return json({
    ok: true,
    environment: "sandbox",
    transaction,
    charge: {
      identifier: chargeId,
      correlation_id: referenceCode,
      expires_in_seconds: expiresIn,
      br_code: brCode,
      payment_link_url: charge?.paymentLinkUrl || null,
    },
  });
});
