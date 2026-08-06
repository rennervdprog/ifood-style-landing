import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, baggage, sentry-trace",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({
  store_id: z.string().uuid(),
});

/* ── Gateways inline (deploy externo nao sobe subpastas) ── */
async function getActiveGateway(client: any): Promise<string> {
  try {
    const { data } = await client
      .from("admin_settings")
      .select("value")
      .eq("key", "payment_gateway")
      .maybeSingle();
    const val = String((data?.value as any)?.provider || "").toUpperCase().trim();
    if (val) return val;
  } catch (_e) { /* fallback */ }
  return (Deno.env.get("ACTIVE_PAYMENT_PROVIDER") || "ASAAS").toUpperCase().trim();
}

async function createWooviPix(params: {
  amount: number; description: string; externalId: string;
  customer?: { name?: string; email?: string; taxId?: string };
}): Promise<{ id: string; brCode: string | null }> {
  const appId = Deno.env.get("WOOVI_APP_ID") || Deno.env.get("OPENPIX_APP_ID");
  if (!appId) throw new Error("WOOVI_APP_ID não configurada");
  const taxId = String(params.customer?.taxId || "").replace(/\D/g, "");
  const body: Record<string, unknown> = {
    correlationID: params.externalId,
    value: Math.round(params.amount * 100),
    comment: String(params.description).substring(0, 140),
    expiresIn: 60 * 60 * 24,
  };
  if (params.customer?.name || params.customer?.email) {
    body.customer = {
      name: params.customer?.name || "Lojista",
      email: params.customer?.email || `lojista-${params.externalId}@itasuper.com`,
      ...(taxId.length === 11 || taxId.length === 14
        ? { taxID: { taxID: taxId, type: taxId.length === 11 ? "BR:CPF" : "BR:CNPJ" } }
        : {}),
    };
  }
  const res = await fetch("https://api.openpix.com.br/api/v1/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: appId },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.error) {
    console.error("[woovi] create error", res.status, JSON.stringify(payload));
    throw new Error(payload?.error || "Erro Woovi");
  }
  const charge = payload?.charge || payload;
  return { id: String(charge?.identifier || charge?.correlationID || ""), brCode: charge?.brCode || null };
}

async function createAbacatePix(params: {
  amount: number; description: string; externalId: string;
  customer?: { name?: string; email?: string; taxId?: string };
}): Promise<{ id: string; brCode: string | null; brCodeBase64: string | null }> {
  const key = Deno.env.get("ABACATEPAY_API_KEY");
  if (!key) throw new Error("ABACATEPAY_API_KEY não configurada");
  const taxId = String(params.customer?.taxId || "").replace(/\D/g, "");
  const data: Record<string, unknown> = {
    amount: Math.round(params.amount * 100),
    expiresIn: 60 * 60 * 24,
    description: String(params.description).substring(0, 140),
    metadata: { externalId: params.externalId },
    customer: {
      name: params.customer?.name || "Lojista",
      email: params.customer?.email || `lojista-${params.externalId}@itasuper.com`,
      cellphone: "(22) 99999-9999",
      taxId: taxId.length >= 11 ? taxId : "529.982.247-25",
    },
  };
  const res = await fetch("https://api.abacatepay.com/v2/transparents/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ method: "PIX", data }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.error) {
    console.error("[abacatepay] create error", res.status, JSON.stringify(payload));
    throw new Error(payload?.error?.message || payload?.error || "Erro AbacatePay");
  }
  const out = payload?.data || payload;
  return {
    id: String(out?.id || ""),
    brCode: out?.brCode || null,
    brCodeBase64: (out?.brCodeBase64 || "").replace(/^data:image\/\w+;base64,/, "") || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY"))!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const { store_id } = parsed.data;

    // Verify store ownership
    const adminSupabase = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY"))!
    );

    const { data: store } = await adminSupabase
      .from("stores")
      .select("id, owner_id, name")
      .eq("id", store_id)
      .eq("owner_id", userId)
      .single();

    if (!store) {
      return json({ error: "Loja não encontrada ou sem permissão." }, 403);
    }

    // Get the active plan
    const { data: plan } = await adminSupabase
      .from("store_plans")
      .select("id, plan_type, monthly_fee, trial_ends_at")
      .eq("store_id", store_id)
      .eq("is_active", true)
      .single();

    if (!plan || plan.monthly_fee <= 0) {
      return json({ error: "Este plano não requer pagamento." }, 400);
    }

    // Check if trial is actually expired
    if (plan.trial_ends_at) {
      const trialEnd = new Date(plan.trial_ends_at);
      if (trialEnd > new Date()) {
        return json({ error: "Seu período de teste ainda está ativo." }, 400);
      }
    }

    // Check for existing pending subscription payment
    const { data: existingTx } = await adminSupabase
      .from("financial_transactions")
      .select("id, pix_copy_paste, pix_qr_code_base64, reference_code, amount, mercado_pago_payment_id")
      .eq("store_id", store_id)
      .eq("status", "pending")
      .like("reference_code", "#ASSIN-%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTx?.pix_copy_paste) {
      // Return existing pending payment
      return json({
        payment_id: existingTx.mercado_pago_payment_id,
        qr_code: existingTx.pix_copy_paste,
        qr_code_base64: existingTx.pix_qr_code_base64,
        reference_code: existingTx.reference_code,
        amount: existingTx.amount,
        existing: true,
      });
    }

    // Gateway ativo (seletor no painel super admin)
    const gateway = await getActiveGateway(adminSupabase);

    const { data: gwProfile } = await adminSupabase
      .from("profiles")
      .select("full_name, email, document")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: gwRef } = await adminSupabase.rpc("generate_financial_reference", { _prefix: "ASSIN" });
    const gwReference = gwRef || `#ASSIN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const gwPlanLabel =
      plan.plan_type === "fixed" ? "Plano Essencial"
      : plan.plan_type === "supporter" ? "Plano Apoiador"
      : plan.plan_type === "hybrid" ? "Plano Crescimento"
      : "Plano";

    if (gateway === "WOOVI" || gateway === "ABACATEPAY") {
      try {
        const customer = {
          name: gwProfile?.full_name || "Lojista",
          email: gwProfile?.email || userData.user.email || `lojista-${userId.substring(0, 8)}@itasuper.com`,
          taxId: String(gwProfile?.document || ""),
        };
        const pix = gateway === "WOOVI"
          ? { ...(await createWooviPix({ amount: Number(plan.monthly_fee), description: `${gwPlanLabel} - ${store.name}`, externalId: gwReference, customer })), brCodeBase64: null as string | null }
          : await createAbacatePix({ amount: Number(plan.monthly_fee), description: `${gwPlanLabel} - ${store.name}`, externalId: gwReference, customer });

        await adminSupabase.from("financial_transactions").insert({
          store_id,
          transaction_kind: "commission_charge",
          amount: Number(plan.monthly_fee),
          reference_code: gwReference,
          status: "pending",
          provider: gateway.toLowerCase(),
          mercado_pago_payment_id: pix.id,
          pix_qr_code: pix.brCode,
          pix_qr_code_base64: pix.brCodeBase64,
          pix_copy_paste: pix.brCode,
          metadata: {
            type: "plan_subscription",
            plan_type: plan.plan_type,
            plan_label: gwPlanLabel,
            store_name: store.name,
          },
        });

        return json({
          payment_id: pix.id,
          qr_code: pix.brCode,
          qr_code_base64: pix.brCodeBase64,
          reference_code: gwReference,
          amount: Number(plan.monthly_fee),
          provider: gateway.toLowerCase(),
        });
      } catch (e) {
        console.error(`[${gateway}] mensalidade falhou, tentando Asaas:`, e);
      }
    }

    // Generate PIX charge via Asaas
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return json({ error: "Chave de pagamento não configurada." }, 500);
    }

    const baseUrl = ASAAS_API_KEY.startsWith("$aact_prod_")
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    // Get owner profile
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name, email, document")
      .eq("user_id", userId)
      .single();

    const cleanCpf = String(profile?.document || "").replace(/\D/g, "");

    const { data: refData } = await adminSupabase.rpc("generate_financial_reference", {
      _prefix: "ASSIN",
    });
    const referenceCode = refData || `#ASSIN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Find or create customer
    let customerId: string | null = null;
    const customerEmail = profile?.email || userData.user.email || `lojista-${userId.substring(0, 8)}@itasuper.com`;
    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");

    // Use a valid CPF for sandbox if needed
    let effectiveCpf = cleanCpf;
    if (isSandbox && cleanCpf.length < 11) {
      // Generate deterministic sandbox CPF based on userId
      effectiveCpf = "52998224725"; // Valid sandbox CPF
      console.log("[Asaas Sandbox] Using sandbox CPF for customer creation");
    }

    console.log(`[Asaas] Mode: ${isSandbox ? "SANDBOX" : "PRODUCTION"}, creating subscription for ${store.name}`);

    if (effectiveCpf.length >= 11) {
      const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${effectiveCpf}`, {
        headers: { "access_token": ASAAS_API_KEY },
      });
      const searchData = await searchRes.json();
      if (searchData.data?.length > 0) {
        customerId = searchData.data[0].id;
        console.log(`[Asaas] Found existing customer: ${customerId}`);
      }
    }

    if (!customerId) {
      const customerBody: Record<string, unknown> = {
        name: profile?.full_name || "Lojista",
        email: customerEmail,
      };
      if (effectiveCpf.length >= 11) {
        customerBody.cpfCnpj = effectiveCpf;
      }

      console.log(`[Asaas] Creating customer for subscription: ${customerBody.name}`);
      const createRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify(customerBody),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        console.error("[Asaas] Create customer error:", JSON.stringify(createData));
        const errMsg = createData?.errors?.[0]?.description || "Erro ao criar cliente no gateway.";
        return json({ error: errMsg, asaas_details: createData }, 500);
      }
      customerId = createData.id;
      console.log(`[Asaas] Customer created: ${customerId}`);
    }

    // Create PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const planLabel =
      plan.plan_type === "fixed"
        ? "Plano Essencial"
        : plan.plan_type === "supporter"
          ? "Plano Apoiador"
          : plan.plan_type === "hybrid"
            ? "Plano Crescimento"
            : "Plano";
    const paymentBody = {
      customer: customerId,
      billingType: "PIX",
      notificationDisabled: true,
      value: Number(plan.monthly_fee),
      dueDate: dueDateStr,
      description: `${planLabel} - ${store.name} - ${referenceCode}`.substring(0, 140),
      externalReference: referenceCode,
    };

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentRes.json();
    if (!paymentRes.ok) {
      console.error("Asaas PIX Error:", JSON.stringify(paymentData));
      return json({ error: "Erro ao gerar PIX." }, 500);
    }

    // Get QR code
    const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { "access_token": ASAAS_API_KEY },
    });
    const pixInfo = await pixRes.json();

    // Record transaction
    await adminSupabase.from("financial_transactions").insert({
      store_id,
      transaction_kind: "commission_charge",
      amount: Number(plan.monthly_fee),
      reference_code: referenceCode,
      status: "pending",
      provider: "asaas",
      mercado_pago_payment_id: paymentData.id,
      pix_qr_code: pixInfo?.payload || null,
      pix_qr_code_base64: pixInfo?.encodedImage || null,
      pix_copy_paste: pixInfo?.payload || null,
      metadata: {
        type: "plan_subscription",
        plan_type: plan.plan_type,
        plan_label: planLabel,
        store_name: store.name,
      },
    });

    return json({
      payment_id: paymentData.id,
      qr_code: pixInfo?.payload || null,
      qr_code_base64: pixInfo?.encodedImage || null,
      reference_code: referenceCode,
      amount: Number(plan.monthly_fee),
    });
  } catch (err) {
    console.error("subscribe-plan-payment error:", err);
    return json({ error: "Erro interno." }, 500);
  }
});
