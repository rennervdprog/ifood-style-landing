import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

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

const BodySchema = z.object({
  store_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  description: z.string().max(256).optional(),
});

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

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return json({ error: "Chave de pagamento não configurada." }, 500);
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
        provider: "asaas",
      });
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

    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

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

    // Find or create customer
    let customerId: string | null = null;
    const customerEmail = ownerProfile?.email || userData.user.email || `lojista-${store.owner_id?.substring(0, 8)}@itasuper.com`;

    if (cleanCpf.length >= 11) {
      const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cleanCpf}`, {
        headers: { "access_token": ASAAS_API_KEY },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data?.length > 0) {
          customerId = searchData.data[0].id;
        }
      }
    }

    if (!customerId) {
      const customerBody: Record<string, unknown> = {
        name: ownerProfile?.full_name || "Lojista",
        email: customerEmail,
      };
      if (cleanCpf.length >= 11) customerBody.cpfCnpj = cleanCpf;

      const createRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify(customerBody),
      });
      if (!createRes.ok) {
        const errData = await createRes.json();
        return json({ error: errData?.errors?.[0]?.description || "Erro ao criar cliente." }, 500);
      }
      const customerData = await createRes.json();
      customerId = customerData.id;
    }

    // Create PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const desc = String(description || `Comissão ItaSuper - ${store.name} - ${referenceCode}`).substring(0, 140);

    const paymentBody = {
      customer: customerId,
      billingType: "PIX",
      notificationDisabled: true,
      value: Number(amount.toFixed(2)),
      dueDate: dueDate.toISOString().split("T")[0],
      description: desc,
      externalReference: referenceCode,
    };

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentRes.json();
    if (!paymentRes.ok) {
      console.error("Asaas Commission Charge Error:", JSON.stringify(paymentData));
      return json({ error: "Erro ao gerar cobrança PIX. Tente novamente." }, 500);
    }

    // Get QR code
    const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { "access_token": ASAAS_API_KEY },
    });
    const pixInfo = await pixRes.json();

    // Save transaction
    await serviceClient.from("financial_transactions").insert({
      store_id,
      transaction_kind: "commission_charge",
      reference_code: referenceCode,
      amount: Number(amount.toFixed(2)),
      status: "pending",
      provider: "asaas",
      mercado_pago_payment_id: paymentData.id,
      pix_qr_code: pixInfo?.payload || null,
      pix_qr_code_base64: pixInfo?.encodedImage || null,
      pix_copy_paste: pixInfo?.payload || null,
      created_at: createdAt,
      updated_at: createdAt,
      metadata: { store_name: store.name, description: desc },
    });

    return json({
      reference_code: referenceCode,
      payment_id: paymentData.id,
      status: "pending",
      qr_code: pixInfo?.payload || null,
      qr_code_base64: pixInfo?.encodedImage || null,
      amount: Number(amount.toFixed(2)),
      created_at: createdAt,
      provider: "asaas",
    });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
