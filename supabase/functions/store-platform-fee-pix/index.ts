import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders as baseCorsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  ...baseCorsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, baggage, sentry-trace",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().min(5).max(50000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Function roda no MESMO projeto do banco (external). Usa os secrets
    // padrão que o edge runtime injeta automaticamente.
    const SB_URL =
      Deno.env.get("SUPABASE_URL") ||
      Deno.env.get("EXTERNAL_SUPABASE_URL") ||
      "";
    const SB_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      "";
    if (!SB_URL || !SB_KEY) {
      return new Response(JSON.stringify({ error: "Backend não configurado." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SB_URL, SB_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { store_id, amount } = parsed.data;

    // Verify store ownership
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, owner_id, name")
      .eq("id", store_id)
      .eq("owner_id", userId)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada ou sem permissão." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify balance exists and has pending amount
    const adminSupabase = supabase;

    const { data: balance } = await adminSupabase
      .from("store_balances")
      .select("repasse_pendente, comissao_pendente")
      .eq("store_id", store_id)
      .single();

    const { data: planRow } = await adminSupabase
      .from("store_plans")
      .select("pdv_commission_pending")
      .eq("store_id", store_id)
      .eq("is_active", true)
      .maybeSingle();

    const repassePending = Number(balance?.repasse_pendente || 0);
    const comissaoPending = Number(balance?.comissao_pendente || 0);
    const pdvPending = Number(planRow?.pdv_commission_pending || 0);
    const pendingAmount = repassePending + comissaoPending + pdvPending;
    if (pendingAmount <= 0) {
      return new Response(JSON.stringify({ error: "Sem saldo pendente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow partial payments: amount can be <= pending. Cap at pending to avoid overpaying.
    if (amount - pendingAmount > 0.01) {
      return new Response(JSON.stringify({ error: `Valor maior que o saldo pendente (R$ ${pendingAmount.toFixed(2)}).` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split amount across buckets: prioritize store_balances (repasse+comissao) first,
    // then PDV. We record the PDV portion in metadata so the webhook can decrement it
    // on confirmation (store_balances already handled by reconcile_debit_store_balance).
    const balanceBucket = repassePending + comissaoPending;
    const amountToBalance = Math.min(amount, balanceBucket);
    const amountToPdv = Math.max(0, Number((amount - amountToBalance).toFixed(2)));

    // Generate PIX charge via Asaas
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: "Chave de pagamento não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    console.log(`[Asaas] Mode: ${isSandbox ? "SANDBOX" : "PRODUCTION"}, platform fee for ${store.name}`);

    // Get store owner profile for payer info
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name, email, document")
      .eq("user_id", userId)
      .single();

    let cleanCpf = String(profile?.document || "").replace(/\D/g, "");
    const referenceCode = `TAXA-${store_id.substring(0, 6).toUpperCase()}-${Date.now()}`;

    // In sandbox, use a valid CPF if the provided one is invalid
    if (isSandbox && cleanCpf.length < 11) {
      cleanCpf = "52998224725"; // Valid sandbox CPF
      console.log("[Asaas Sandbox] Using sandbox CPF for customer creation");
    }

    // Step 1: Find or create customer in Asaas
    const customerEmail = profile?.email || userData.user.email || `lojista-${userId.substring(0, 8)}@itasuper.com`;
    
    let customerId: string | null = null;

    if (cleanCpf.length >= 11) {
      const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cleanCpf}`, {
        headers: { "access_token": ASAAS_API_KEY },
      });
      const searchData = await searchRes.json();
      if (searchData.data?.length > 0) {
        customerId = searchData.data[0].id;
        console.log(`[Asaas] Found existing customer: ${customerId}`);
      }
    }

    if (!customerId) {
      // Create customer
      const customerBody: Record<string, unknown> = {
        name: profile?.full_name || "Lojista",
        email: customerEmail,
      };
      if (cleanCpf.length >= 11) {
        customerBody.cpfCnpj = cleanCpf;
      }

      console.log(`[Asaas] Creating customer: ${customerBody.name}`);
      const createRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify(customerBody),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        console.error("[Asaas] Create customer error:", JSON.stringify(createData));
        const errMsg = createData?.errors?.[0]?.description || "Erro ao criar cliente no gateway.";
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerId = createData.id;
      console.log(`[Asaas] Customer created: ${customerId}`);
    }

    // Step 2: Create PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 dias para pagar, alinhado ao cron automático
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentBody = {
      customer: customerId,
      billingType: "PIX",
      notificationDisabled: true,
      value: Number(amount.toFixed(2)),
      dueDate: dueDateStr,
      description: `Taxa plataforma - ${store.name}`.substring(0, 140),
      externalReference: referenceCode,
    };

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("Asaas PIX Error for store fee:", JSON.stringify(paymentData));
      return new Response(JSON.stringify({ error: "Erro ao gerar PIX. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Get PIX QR Code
    const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { "access_token": ASAAS_API_KEY },
    });
    const pixInfo = await pixRes.json();

    // Record the transaction
    await adminSupabase.from("financial_transactions").insert({
      store_id,
      transaction_kind: "commission_charge" as any,
      amount,
      reference_code: referenceCode,
      status: "pending",
      provider: "asaas",
      mercado_pago_payment_id: paymentData.id,
      // pix_qr_code legado guardava texto copy-paste em vez da imagem; agora
      // o texto fica em pix_copy_paste e a imagem base64 em pix_qr_code_base64.
      pix_qr_code: null,
      pix_qr_code_base64: pixInfo?.encodedImage || null,
      pix_copy_paste: pixInfo?.payload || null,
      metadata: {
        type: "platform_fee",
        store_name: store.name,
        balance_billed: amountToBalance,
        pdv_pending_billed: amountToPdv,
        due_date: dueDateStr,
        asaas_payment_id: paymentData.id,
      },
    });

    return new Response(
      JSON.stringify({
        payment_id: paymentData.id,
        qr_code: pixInfo?.payload || null,
        qr_code_base64: pixInfo?.encodedImage || null,
        reference_code: referenceCode,
        amount,
        expires_at: dueDateStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("store-platform-fee-pix error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Erro interno: ${msg}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
