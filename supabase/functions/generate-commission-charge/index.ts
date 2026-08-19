import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

/* ── inline de _shared/abacatepay.ts (deploy externo nao sobe subpastas) ── */
// Helper AbacatePay — PIX QR Code para cobranças da plataforma (mensalidade/comissão).
// Mais barato que o Asaas por transação PIX. Não faz split (não é mais necessário
// desde que o repasse ao lojista passou a ser via Pix Direto).

export interface AbacatePixResult {
  id: string;
  brCode: string | null;
  brCodeBase64: string | null;
}

export function abacatepayEnabled(): boolean {
  return !!Deno.env.get("ABACATEPAY_API_KEY");
}

export async function createAbacatePix(params: {
  amount: number; // em reais
  description: string;
  externalId: string;
  customer?: { name?: string; email?: string; taxId?: string; cellphone?: string };
  expiresInSeconds?: number;
}): Promise<AbacatePixResult> {
  const key = Deno.env.get("ABACATEPAY_API_KEY");
  if (!key) throw new Error("ABACATEPAY_API_KEY não configurada");

  const data: Record<string, unknown> = {
    amount: Math.round(params.amount * 100), // centavos
    expiresIn: params.expiresInSeconds ?? 60 * 60 * 24, // 24h
    description: String(params.description).substring(0, 140),
    metadata: { externalId: params.externalId },
  };

  const c = params.customer;
  const taxId = String(c?.taxId || "").replace(/\D/g, "");
  if (c && (c.name || c.email)) {
    data.customer = {
      name: c.name || "Lojista",
      email: c.email || `lojista-${params.externalId}@itasuper.com`,
      cellphone: c.cellphone || "(22) 99999-9999",
      taxId: taxId.length >= 11 ? taxId : "529.982.247-25",
    };
  }

  const res = await fetch("https://api.abacatepay.com/v2/transparents/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
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


/* ── Woovi/OpenPix: único provedor para novas cobranças de comissão ── */
type WooviPixResult = { id: string; brCode: string | null; brCodeBase64: string | null };
function wooviEnabled(): boolean {
  return !!(Deno.env.get("WOOVI_APP_ID") || Deno.env.get("OPENPIX_APP_ID"));
}
async function createWooviPix(params: {
  amount: number; description: string; externalId: string;
  customer?: { name?: string; email?: string; taxId?: string };
}): Promise<WooviPixResult> {
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
  const response = await fetch("https://api.openpix.com.br/api/v1/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: appId },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(String(payload?.error || `Erro Woovi ${response.status}`));
  const charge = payload?.charge || payload;
  const id = String(charge?.identifier || "");
  if (!id || !charge?.brCode) throw new Error("Resposta Woovi sem identificador ou PIX copia e cola");
  return { id, brCode: charge.brCode, brCodeBase64: charge?.brCodeBase64 || null };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, baggage, sentry-trace",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  description: z.string().max(256).optional(),
});

type ManualCommissionChargeContext = {
  planType: string;
  repassePendente: number;
  comissaoPendente: number;
  pdvPending: number;
  balanceBilled: number;
  totalAmount: number;
};

/** Mantém a cobrança manual compatível com a conciliação dos webhooks. */
async function resolveManualCommissionChargeContext(
  serviceClient: any,
  storeId: string,
): Promise<ManualCommissionChargeContext> {
  const [balanceResult, planResult] = await Promise.all([
    serviceClient
      .from("store_balances")
      .select("repasse_pendente, comissao_pendente, pending_commission")
      .eq("store_id", storeId)
      .maybeSingle(),
    serviceClient
      .from("store_plans")
      .select("plan_type, pdv_commission_pending")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (balanceResult.error || planResult.error) {
    throw new Error("Não foi possível calcular o saldo pendente da loja.");
  }

  const planType = String(planResult.data?.plan_type || "commission_only");
  const repassePendente = Number(balanceResult.data?.repasse_pendente || 0);
  const comissaoPendente = Number(
    balanceResult.data?.comissao_pendente || balanceResult.data?.pending_commission || 0,
  );
  const pdvPending = Number(planResult.data?.pdv_commission_pending || 0);

  let balanceBilled = 0;
  if (planType === "fixed" || planType === "supporter") {
    balanceBilled = repassePendente;
  } else if (planType === "hybrid") {
    balanceBilled = repassePendente + comissaoPendente;
  } else if (planType === "commission_only") {
    balanceBilled = comissaoPendente;
  }

  balanceBilled = Number(balanceBilled.toFixed(2));
  return {
    planType,
    repassePendente: Number(repassePendente.toFixed(2)),
    comissaoPendente: Number(comissaoPendente.toFixed(2)),
    pdvPending: Number(pdvPending.toFixed(2)),
    balanceBilled,
    totalAmount: Number((balanceBilled + pdvPending).toFixed(2)),
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

    // 🔁 EXTERNAL DB
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");
    if (!EXTERNAL_URL || !EXTERNAL_KEY) {
      return json({ error: "Config missing: EXTERNAL_SUPABASE_URL or EXTERNAL_SUPABASE_SERVICE_KEY not set" }, 500);
    }

    // Single service-role client; ownership/role is enforced manually below.
    const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { store_id, amount, description } = parsed.data;

    // Verify store exists and user is owner or admin
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, owner_id")
      .eq("id", store_id)
      .single();

    if (storeError || !store) {
      return json({ error: "Loja não encontrada" }, 404);
    }

    const userId = userData.user.id;
    const serviceClient = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRole;

    if (store.owner_id !== userId && !isAdmin) {
      return json({ error: "Sem permissão" }, 403);
    }

    if (!wooviEnabled()) {
      return json({ error: "WOOVI_APP_ID não configurada" }, 500);
    }

    // Check for existing pending charge (idempotency)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingCharge } = await serviceClient
      .from("financial_transactions")
      .select("*")
      .eq("store_id", store_id)
      .eq("transaction_kind", "commission_charge")
      .eq("status", "pending")
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCharge && existingCharge.pix_qr_code) {
      return json({
        reference_code: existingCharge.reference_code,
        payment_id: existingCharge.mercado_pago_payment_id,
        status: "pending",
        qr_code: existingCharge.pix_qr_code || existingCharge.pix_copy_paste || null,
        qr_code_base64: existingCharge.pix_qr_code_base64 || null,
        amount: Number(existingCharge.amount),
        created_at: existingCharge.created_at,
        reused: true,
        provider: existingCharge.provider || "asaas",
      });
    }

    const chargeContext = await resolveManualCommissionChargeContext(serviceClient, store_id);
    if (chargeContext.totalAmount <= 0) {
      return json({ error: "Não há saldo pendente faturável para esta loja." }, 400);
    }
    if (Math.abs(Number(amount.toFixed(2)) - chargeContext.totalAmount) > 0.01) {
      return json({
        error: "O saldo pendente foi atualizado. Atualize a tela e gere uma nova cobrança.",
        expected_amount: chargeContext.totalAmount,
      }, 409);
    }

    // Generate reference code
    const { data: refData } = await serviceClient.rpc("generate_financial_reference", { _prefix: "FAT" });
    const referenceCode = refData || `#FAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    // Cancel old pending charges
    await serviceClient
      .from("financial_transactions")
      .update({ status: "cancelled", settled_at: createdAt, updated_at: createdAt })
      .eq("store_id", store_id)
      .eq("transaction_kind", "commission_charge")
      .eq("status", "pending")
      .lt("created_at", fiveMinAgo);

    const isSandbox = false;

    // Get store owner profile for customer info
    const { data: ownerProfile } = await serviceClient
      .from("profiles")
      .select("full_name, email, document")
      .eq("user_id", store.owner_id)
      .single();

    let cleanCpf = String(ownerProfile?.document || "").replace(/\D/g, "");
    if (isSandbox && cleanCpf.length < 11) {
      cleanCpf = "52998224725";
    }

    const customerEmail = ownerProfile?.email || userData.user.email || `lojista-${store.owner_id?.substring(0, 8)}@itasuper.com`;
    const desc0 = String(description || `Comissão ItaSuper - ${store.name} - ${referenceCode}`).substring(0, 140);

    // ─── Woovi/OpenPix: única emissão permitida ───
    if (wooviEnabled()) {
      let pix;
      try {
        pix = await createWooviPix({
          amount: chargeContext.totalAmount,
          description: desc0,
          externalId: referenceCode,
          customer: {
            name: ownerProfile?.full_name || "Lojista",
            email: customerEmail,
            taxId: cleanCpf,
          },
        });
      } catch (e) {
        console.error("Woovi commission charge error:", e);
        return json({ error: "Erro ao gerar cobrança PIX pela Woovi. Tente novamente." }, 502);
      }

      await serviceClient.from("financial_transactions").insert({
        store_id,
        transaction_kind: "commission_charge",
        reference_code: referenceCode,
        amount: chargeContext.totalAmount,
        status: "pending",
        provider: "woovi",
        mercado_pago_payment_id: pix.id,
        pix_qr_code: pix.brCode,
        pix_qr_code_base64: pix.brCodeBase64,
        pix_copy_paste: pix.brCode,
        created_at: createdAt,
        updated_at: createdAt,
        metadata: {
          store_name: store.name,
          description: desc0,
          plan_type: chargeContext.planType,
          repasse_pendente: chargeContext.repassePendente,
          comissao_pendente: chargeContext.comissaoPendente,
          pdv_commission_pending: chargeContext.pdvPending,
          balance_billed: chargeContext.balanceBilled,
          pdv_pending_billed: chargeContext.pdvPending,
          charge_family: "manual_delivery_fee",
        },
      });

      return json({
        reference_code: referenceCode,
        payment_id: pix.id,
        status: "pending",
        qr_code: pix.brCode,
        qr_code_base64: pix.brCodeBase64,
        amount: chargeContext.totalAmount,
        created_at: createdAt,
        provider: "woovi",
      });
    }

    // O bloco Woovi acima sempre retorna em sucesso ou falha; esta salvaguarda
    // evita qualquer emissão por provedor legado caso o fluxo seja alterado no futuro.
    return json({ error: "Emissão Woovi indisponível." }, 500);
  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
