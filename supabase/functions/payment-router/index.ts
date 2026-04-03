import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Schemas ──────────────────────────────────────────────────────────

const OrderPixSchema = z.object({
  action: z.literal("order_pix"),
  order_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  description: z.string().max(256).optional(),
  payer_first_name: z.string().max(100).optional(),
  payer_last_name: z.string().max(100).optional(),
  payer_cpf: z.string().optional(),
});

const CommissionChargeSchema = z.object({
  action: z.literal("commission_charge"),
  store_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  description: z.string().max(256).optional(),
});

const StorePayoutSchema = z.object({
  action: z.literal("store_payout"),
  store_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  pix_key: z.string().min(1).max(256),
  pix_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
});

const BodySchema = z.discriminatedUnion("action", [
  OrderPixSchema,
  CommissionChargeSchema,
  StorePayoutSchema,
]);

// ── Standardized response ────────────────────────────────────────────

interface StandardPixResponse {
  status: string;
  pix_code: string | null;
  qr_code_url: string | null;
  provider: string;
  reference_code: string;
  payment_id: string | null;
  amount: number;
  created_at: string;
  expires_at: string | null;
  reused?: boolean;
  extra?: Record<string, unknown>;
}

// ── Provider: Mercado Pago ───────────────────────────────────────────

async function createMercadoPagoPix(params: {
  amount: number;
  description: string;
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
  payerCpf: string;
  externalReference: string;
  idempotencyKey: string;
  expiresAt?: string;
}): Promise<{ ok: boolean; data: any; status: number; suspended?: boolean }> {
  const ACCESS_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!ACCESS_TOKEN) {
    return { ok: false, data: { message: "MERCADO_PAGO_ACCESS_TOKEN não configurado." }, status: 500 };
  }

  const paymentBody: Record<string, unknown> = {
    transaction_amount: params.amount,
    description: params.description,
    payment_method_id: "pix",
    payer: {
      email: params.payerEmail,
      first_name: params.payerFirstName,
      last_name: params.payerLastName,
      identification: { type: "CPF", number: params.payerCpf },
    },
    external_reference: params.externalReference,
  };

  if (params.expiresAt) {
    paymentBody.date_of_expiration = params.expiresAt;
  }

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify(paymentBody),
  });

  const data = await res.json();

  const suspended =
    !res.ok && (res.status === 401 || res.status === 403 || data?.message?.includes("suspended"));

  return { ok: res.ok, data, status: res.status, suspended };
}

// ── Provider: Asaas ──────────────────────────────────────────────────

async function createAsaasPix(params: {
  amount: number;
  description: string;
  payerCpf: string;
  payerName: string;
  externalReference: string;
  expiresAt?: string;
}): Promise<{ ok: boolean; data: any; status: number }> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    return { ok: false, data: { message: "ASAAS_API_KEY não configurado." }, status: 500 };
  }

  // Asaas uses sandbox or production URL based on key prefix
  const baseUrl = apiKey.startsWith("$aact_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  try {
    // Step 1: Find or create customer by CPF
    const cleanCpf = params.payerCpf.replace(/\D/g, "");
    let customerId: string | null = null;

    const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cleanCpf}`, {
      headers: { "access_token": apiKey },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      }
    }

    if (!customerId) {
      const createCustomerRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": apiKey,
        },
        body: JSON.stringify({
          name: params.payerName || "Cliente FoodIta",
          cpfCnpj: cleanCpf,
        }),
      });

      if (!createCustomerRes.ok) {
        const errData = await createCustomerRes.text();
        console.error("Asaas create customer error:", createCustomerRes.status, errData);
        return { ok: false, data: { message: "Erro ao criar cliente no Asaas." }, status: createCustomerRes.status };
      }

      const customerData = await createCustomerRes.json();
      customerId = customerData.id;
    }

    // Step 2: Create payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Due tomorrow (Asaas requires future date)
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentBody = {
      customer: customerId,
      billingType: "PIX",
      value: params.amount,
      dueDate: dueDateStr,
      description: params.description.substring(0, 500),
      externalReference: params.externalReference,
    };

    console.log("Asaas creating PIX payment...");
    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: JSON.stringify(paymentBody),
    });

    if (!paymentRes.ok) {
      const errData = await paymentRes.text();
      console.error("Asaas payment error:", paymentRes.status, errData);
      
      // Check for minimum amount error
      if (errData.includes("não pode ser menor que R$") || errData.includes("menor que R$ 5")) {
        return { ok: false, data: { message: "O valor mínimo para pagamento PIX é R$ 5,00.", min_amount: true }, status: 400 };
      }
      
      return { ok: false, data: { message: `Erro ao criar pagamento Asaas: ${paymentRes.status}` }, status: paymentRes.status };
    }

    const paymentData = await paymentRes.json();
    const paymentId = paymentData.id;
    console.log("Asaas payment created:", paymentId, "status:", paymentData.status);

    // Step 3: Get PIX QR Code
    const pixRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
      headers: { "access_token": apiKey },
    });

    let pixCode: string | null = null;
    let qrCodeBase64: string | null = null;

    if (pixRes.ok) {
      const pixData = await pixRes.json();
      pixCode = pixData.payload || null;
      qrCodeBase64 = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null;
      console.log("Asaas QR code obtained");
    } else {
      console.warn("Asaas QR code fetch failed:", pixRes.status);
    }

    return {
      ok: true,
      data: {
        pix_code: pixCode,
        qr_code_url: qrCodeBase64,
        payment_id: paymentId,
        status: paymentData.status || "PENDING",
      },
      status: 200,
    };
  } catch (err) {
    console.error("Asaas exception:", err);
    return { ok: false, data: { message: "Erro interno ao processar pagamento Asaas." }, status: 500 };
  }
}

// ── Provider: Efí Bank (Full mTLS Implementation) ────────────────────

function getEfiHttpClient(): Deno.HttpClient | null {
  let certPem = "";
  let keyPem = "";

  const certB64 = Deno.env.get("EFI_CERT_PEM");
  const keyB64 = Deno.env.get("EFI_KEY_PEM");

  if (certB64 && keyB64) {
    try {
      certPem = atob(certB64);
      keyPem = atob(keyB64);
    } catch (e) {
      console.error("Error decoding EFI_CERT_PEM/EFI_KEY_PEM:", e);
    }
  }

  if (!certPem || !keyPem) {
    const pemBase64 = Deno.env.get("EFI_CERTIFICATE_PEM_BASE64");
    if (!pemBase64) {
      console.error("No Efí certificate configured");
      return null;
    }
    try {
      const pemContent = atob(pemBase64);
      const certMatches = pemContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
      certPem = certMatches ? certMatches.join("\n") : "";
      const keyMatch = pemContent.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
      keyPem = keyMatch ? keyMatch[0] : "";
    } catch (e) {
      console.error("Error decoding EFI_CERTIFICATE_PEM_BASE64:", e);
      return null;
    }
  }

  if (!certPem || !keyPem) {
    console.error("Could not extract cert or key. Cert found:", !!certPem, "Key found:", !!keyPem);
    return null;
  }

  try {
    console.log("Creating Efí mTLS client. Cert length:", certPem.length, "Key length:", keyPem.length);
    return Deno.createHttpClient({
      cert: certPem,
      key: keyPem,
    } as any);
  } catch (err) {
    console.error("Error creating Efí mTLS client:", err);
    return null;
  }
}

async function getEfiAccessToken(httpClient: Deno.HttpClient): Promise<string | null> {
  const clientId = Deno.env.get("EFI_CLIENT_ID");
  const clientSecret = Deno.env.get("EFI_CLIENT_SECRET");

  if (!clientId || !clientSecret) return null;

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const res = await fetch("https://pix.api.efipay.com.br/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
      // @ts-ignore Deno-specific mTLS client
      client: httpClient,
    });

    if (!res.ok) {
      console.error("Efí OAuth error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    console.log("Efí OAuth success, token obtained");
    return data.access_token || null;
  } catch (err) {
    console.error("Efí OAuth exception:", err);
    return null;
  }
}

async function createEfiBankPix(params: {
  amount: number;
  description: string;
  externalReference: string;
  expiresAt?: string;
}): Promise<{ ok: boolean; data: any; status: number }> {
  const httpClient = getEfiHttpClient();
  if (!httpClient) {
    return {
      ok: false,
      data: { message: "Certificado mTLS da Efí não configurado." },
      status: 500,
    };
  }

  const accessToken = await getEfiAccessToken(httpClient);

  if (!accessToken) {
    httpClient.close();
    return {
      ok: false,
      data: { message: "Credenciais da Efí Bank inválidas ou não configuradas." },
      status: 500,
    };
  }

  try {
    const expirationSeconds = params.expiresAt
      ? Math.max(60, Math.floor((new Date(params.expiresAt).getTime() - Date.now()) / 1000))
      : 300;

    const cobBody = {
      calendario: { expiracao: expirationSeconds },
      valor: { original: params.amount.toFixed(2) },
      chave: Deno.env.get("EFI_PIX_KEY") || "",
      infoAdicionais: [
        { nome: "Pedido", valor: params.externalReference.substring(0, 200) },
        { nome: "Descricao", valor: params.description.substring(0, 200) },
      ],
    };

    console.log("Efí creating cob with mTLS...");
    const cobRes = await fetch("https://pix.api.efipay.com.br/v2/cob", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(cobBody),
      // @ts-ignore Deno-specific mTLS client
      client: httpClient,
    });

    if (!cobRes.ok) {
      const errorData = await cobRes.text();
      console.error("Efí cob error:", cobRes.status, errorData);
      httpClient.close();
      return {
        ok: false,
        data: { message: `Erro ao criar cobrança Efí: ${cobRes.status}`, details: errorData },
        status: cobRes.status,
      };
    }

    const cobData = await cobRes.json();
    const txid = cobData.txid;
    const loc = cobData.loc;
    console.log("Efí cob created:", txid, "status:", cobData.status);

    let qrCode = null;
    let qrCodeBase64 = null;

    if (loc?.id) {
      const qrRes = await fetch(`https://pix.api.efipay.com.br/v2/loc/${loc.id}/qrcode`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        // @ts-ignore Deno-specific mTLS client
        client: httpClient,
      });

      if (qrRes.ok) {
        const qrData = await qrRes.json();
        qrCode = qrData.qrcode || null;
        qrCodeBase64 = qrData.imagemQrcode || null;
        console.log("Efí QR code obtained");
      } else {
        console.warn("Efí QR code fetch failed:", qrRes.status);
      }
    }

    if (!qrCode && cobData.pixCopiaECola) {
      qrCode = cobData.pixCopiaECola;
    }

    httpClient.close();
    return {
      ok: true,
      data: {
        pix_code: qrCode,
        qr_code_url: qrCodeBase64,
        payment_id: txid || cobData.txid,
        txid,
        loc_id: loc?.id,
        status: cobData.status || "ATIVA",
      },
      status: 200,
    };
  } catch (err) {
    console.error("Efí Bank exception:", err);
    httpClient.close();
    return {
      ok: false,
      data: { message: "Erro interno ao processar pagamento Efí." },
      status: 500,
    };
  }
}

// ── Provider: Simulation ─────────────────────────────────────────────

function createSimulatedPix(params: {
  amount: number;
  description: string;
  externalReference: string;
}): StandardPixResponse {
  const fakeQr =
    "00020126580014br.gov.bcb.pix0136SIMULACAO-FOODITA-MODO-TESTE520400005303986540510.005802BR5913FOODITA TESTE6014CIDADE TESTE62070503***6304ABCD";
  const now = new Date().toISOString();
  return {
    status: "pending",
    pix_code: fakeQr,
    qr_code_url: null,
    provider: "simulated",
    reference_code: params.externalReference,
    payment_id: `sim_${Date.now()}`,
    amount: params.amount,
    created_at: now,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

// ── Helper: resolve active provider ──────────────────────────────────

type Provider = "MERCADO_PAGO" | "EFI_BANK" | "ASAAS" | "SIMULATED";

async function getActiveProviderFromDB(): Promise<Provider> {
  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await serviceClient
      .from("admin_settings")
      .select("value")
      .eq("key", "payment_gateway")
      .single();

    if (data?.value) {
      const val = ((data.value as any)?.provider || "").toUpperCase().trim();
      if (val === "EFI_BANK") return "EFI_BANK";
      if (val === "ASAAS") return "ASAAS";
      if (val === "SIMULATED") return "SIMULATED";
      if (val === "MERCADO_PAGO") return "MERCADO_PAGO";
    }
  } catch {
    // Fall through to env var
  }

  const env = (Deno.env.get("ACTIVE_PAYMENT_PROVIDER") || "").toUpperCase().trim();
  if (env === "EFI_BANK") return "EFI_BANK";
  if (env === "ASAAS") return "ASAAS";
  if (env === "SIMULATED") return "SIMULATED";
  return "MERCADO_PAGO";
}

function hasEfiCredentials(): boolean {
  return !!(Deno.env.get("EFI_CLIENT_ID") && Deno.env.get("EFI_CLIENT_SECRET") && (Deno.env.get("EFI_CERT_PEM") || Deno.env.get("EFI_CERTIFICATE_PEM_BASE64")));
}

function hasMpCredentials(): boolean {
  return !!Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
}

function hasAsaasCredentials(): boolean {
  return !!Deno.env.get("ASAAS_API_KEY");
}

// ── Route: order PIX ─────────────────────────────────────────────────

async function handleOrderPix(
  body: z.infer<typeof OrderPixSchema>,
  userId: string,
  userEmail: string,
  supabase: any,
): Promise<Response> {
  const { order_id, amount, description, payer_first_name, payer_last_name, payer_cpf } = body;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, client_id, total_price, status")
    .eq("id", order_id)
    .eq("client_id", userId)
    .single();

  if (orderError || !order) return json({ error: "Pedido não encontrado" }, 404);
  if (order.status !== "aguardando_pagamento") return json({ error: "Pedido não está aguardando pagamento" }, 400);

  if (typeof amount !== "number" || amount <= 0 || amount > 100000) return json({ error: "Valor inválido" }, 400);

  const cleanCpf = String(payer_cpf || "").replace(/\D/g, "");
  if (!cleanCpf || cleanCpf.length !== 11) return json({ error: "CPF inválido. Informe um CPF com 11 dígitos." }, 400);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const desc = String(description || `Pedido FoodIta #${order_id.substring(0, 6).toUpperCase()}`).substring(0, 256);
  const idempotencyKey = `pix-${order_id}-${Date.now()}`;

  return await routePixCreation({
    amount,
    description: desc,
    payerEmail: userEmail || "cliente@foodita.com",
    payerFirstName: String(payer_first_name || "Cliente").substring(0, 100),
    payerLastName: String(payer_last_name || "FoodIta").substring(0, 100),
    payerCpf: cleanCpf,
    externalReference: order_id,
    idempotencyKey,
    expiresAt,
  });
}

// ── Route: commission charge ─────────────────────────────────────────

async function handleCommissionCharge(
  body: z.infer<typeof CommissionChargeSchema>,
  userId: string,
  userEmail: string,
  supabase: any,
): Promise<Response> {
  const { store_id, amount, description } = body;

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, owner_id")
    .eq("id", store_id)
    .single();

  if (storeError || !store) return json({ error: "Loja não encontrada" }, 404);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Check admin via DB function
  const { data: isAdmin } = await serviceClient.rpc("is_platform_admin", { _user_id: userId });
  if (store.owner_id !== userId && !isAdmin) return json({ error: "Sem permissão" }, 403);

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
      status: "pending",
      pix_code: existingCharge.pix_copy_paste || existingCharge.pix_qr_code || null,
      qr_code_url: existingCharge.pix_qr_code_base64 || null,
      provider: existingCharge.provider || "mercado_pago",
      reference_code: existingCharge.reference_code,
      payment_id: existingCharge.mercado_pago_payment_id,
      amount: Number(existingCharge.amount),
      created_at: existingCharge.created_at,
      expires_at: null,
      reused: true,
    } satisfies StandardPixResponse);
  }

  const { data: refData } = await serviceClient.rpc("generate_financial_reference", { _prefix: "FAT" });
  const referenceCode = refData || `#FAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await serviceClient
    .from("financial_transactions")
    .update({ status: "cancelled", settled_at: createdAt, updated_at: createdAt })
    .eq("store_id", store_id)
    .eq("transaction_kind", "commission_charge")
    .eq("status", "pending")
    .lt("created_at", fiveMinAgo);

  const desc = String(description || `Comissão FoodIta - ${store.name} - ${referenceCode}`).substring(0, 256);
  const idempotencyKey = `commission-${store_id}-${referenceCode}`;

  const result = await routePixCreation({
    amount: Number(amount.toFixed(2)),
    description: desc,
    payerEmail: userEmail || "lojista@foodita.com",
    payerFirstName: store.name.substring(0, 100),
    payerLastName: "FoodIta",
    payerCpf: "00000000000",
    externalReference: referenceCode,
    idempotencyKey,
    expiresAt,
  });

  const resultBody = await result.clone().json();

  if (result.ok) {
    await serviceClient.from("financial_transactions").insert({
      store_id,
      transaction_kind: "commission_charge",
      reference_code: referenceCode,
      amount: Number(amount.toFixed(2)),
      status: "pending",
      provider: resultBody.provider || "mercado_pago",
      mercado_pago_payment_id: resultBody.payment_id ? String(resultBody.payment_id) : null,
      pix_qr_code: resultBody.pix_code || null,
      pix_qr_code_base64: resultBody.qr_code_url || null,
      pix_copy_paste: resultBody.pix_code || null,
      created_at: createdAt,
      updated_at: createdAt,
      metadata: { store_name: store.name, description: desc, expires_at: expiresAt },
    });
  }

  return result;
}

// ── Route: store payout ──────────────────────────────────────────────

async function handleStorePayout(
  body: z.infer<typeof StorePayoutSchema>,
  userId: string,
  _userEmail: string,
  supabase: any,
): Promise<Response> {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Check admin via DB function instead of hardcoded email
  const { data: isAdmin } = await serviceClient.rpc("is_platform_admin", { _user_id: userId });
  if (!isAdmin) return json({ error: "Apenas o administrador pode realizar repasses." }, 403);

  const { store_id, amount, pix_key, pix_type } = body;

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", store_id)
    .single();

  if (storeError || !store) return json({ error: "Loja não encontrada" }, 404);

  const { data: refData } = await serviceClient.rpc("generate_financial_reference", { _prefix: "REP" });
  const referenceCode = refData || `#REP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const desc = `Repasse FoodIta - ${store.name} - ${referenceCode}`;
  const idempotencyKey = `payout-${store_id}-${Date.now()}`;

  const result = await routePixCreation({
    amount: Number(amount.toFixed(2)),
    description: desc.substring(0, 256),
    payerEmail: _userEmail || "admin@foodita.com",
    payerFirstName: "FoodIta",
    payerLastName: "Admin",
    payerCpf: "00000000000",
    externalReference: referenceCode,
    idempotencyKey,
  });

  const resultBody = await result.clone().json();

  const txRecord: Record<string, unknown> = {
    store_id,
    transaction_kind: "store_payout",
    reference_code: referenceCode,
    amount: Number(amount.toFixed(2)),
    status: result.ok ? "pending" : "failed",
    provider: resultBody.provider || "mercado_pago",
    mercado_pago_payment_id: resultBody.payment_id ? String(resultBody.payment_id) : null,
    pix_qr_code: resultBody.pix_code || null,
    pix_qr_code_base64: resultBody.qr_code_url || null,
    pix_copy_paste: resultBody.pix_code || null,
    metadata: { store_name: store.name, pix_key, pix_type, description: desc },
  };

  await serviceClient.from("financial_transactions").insert(txRecord);

  if (!result.ok) {
    return json({
      reference_code: referenceCode,
      status: "manual_required",
      message: `Não foi possível gerar PIX automático. Realize a transferência manual de R$ ${amount.toFixed(2)} para a chave PIX: ${pix_key} (${pix_type})`,
      pix_key,
      pix_type,
      amount: Number(amount.toFixed(2)),
      provider: resultBody.provider || "unknown",
    });
  }

  await serviceClient
    .from("store_balances")
    .update({ repasse_pendente: 0 })
    .eq("store_id", store_id);

  return result;
}

// ── Core: route to active provider with failover ─────────────────────

async function routePixCreation(params: {
  amount: number;
  description: string;
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
  payerCpf: string;
  externalReference: string;
  idempotencyKey: string;
  expiresAt?: string;
}): Promise<Response> {
  const provider = await getActiveProviderFromDB();

  // ── Simulation ──
  if (provider === "SIMULATED") {
    const sim = createSimulatedPix({
      amount: params.amount,
      description: params.description,
      externalReference: params.externalReference,
    });
    return json(sim);
  }

  // ── Asaas (primary) ──
  if (provider === "ASAAS") {
    const asaasResult = await createAsaasPix({
      amount: params.amount,
      description: params.description,
      payerCpf: params.payerCpf,
      payerName: `${params.payerFirstName} ${params.payerLastName}`.trim(),
      externalReference: params.externalReference,
      expiresAt: params.expiresAt,
    });

    if (asaasResult.ok) {
      const resp: StandardPixResponse = {
        status: "pending",
        pix_code: asaasResult.data?.pix_code || null,
        qr_code_url: asaasResult.data?.qr_code_url || null,
        provider: "asaas",
        reference_code: params.externalReference,
        payment_id: asaasResult.data?.payment_id || null,
        amount: params.amount,
        created_at: new Date().toISOString(),
        expires_at: params.expiresAt || null,
      };
      return json(resp);
    }

    // Asaas failed → fallback to Mercado Pago
    if (hasMpCredentials()) {
      console.warn("Asaas failed, falling back to Mercado Pago");
      const mpResult = await createMercadoPagoPix(params);
      if (mpResult.ok) {
        const pix = mpResult.data.point_of_interaction?.transaction_data;
        const resp: StandardPixResponse = {
          status: mpResult.data.status || "pending",
          pix_code: pix?.qr_code || null,
          qr_code_url: pix?.qr_code_base64 || null,
          provider: "mercado_pago",
          reference_code: params.externalReference,
          payment_id: String(mpResult.data.id),
          amount: params.amount,
          created_at: new Date().toISOString(),
          expires_at: params.expiresAt || null,
        };
        return json(resp);
      }
    }

    return json({ error: "Erro ao gerar PIX via Asaas.", provider: "asaas" }, 500);
  }

  // ── Efí Bank (primary) ──
  if (provider === "EFI_BANK") {
    const efiResult = await createEfiBankPix({
      amount: params.amount,
      description: params.description,
      externalReference: params.externalReference,
      expiresAt: params.expiresAt,
    });

    if (efiResult.ok) {
      const resp: StandardPixResponse = {
        status: "pending",
        pix_code: efiResult.data?.pix_code || null,
        qr_code_url: efiResult.data?.qr_code_url || null,
        provider: "efi_bank",
        reference_code: params.externalReference,
        payment_id: efiResult.data?.payment_id || null,
        amount: params.amount,
        created_at: new Date().toISOString(),
        expires_at: params.expiresAt || null,
      };
      return json(resp);
    }

    // Efí failed → fallback to Asaas then Mercado Pago
    if (hasAsaasCredentials()) {
      console.warn("Efí Bank failed, falling back to Asaas");
      const asaasResult = await createAsaasPix({
        amount: params.amount,
        description: params.description,
        payerCpf: params.payerCpf,
        payerName: `${params.payerFirstName} ${params.payerLastName}`.trim(),
        externalReference: params.externalReference,
        expiresAt: params.expiresAt,
      });
      if (asaasResult.ok) {
        const resp: StandardPixResponse = {
          status: "pending",
          pix_code: asaasResult.data?.pix_code || null,
          qr_code_url: asaasResult.data?.qr_code_url || null,
          provider: "asaas",
          reference_code: params.externalReference,
          payment_id: asaasResult.data?.payment_id || null,
          amount: params.amount,
          created_at: new Date().toISOString(),
          expires_at: params.expiresAt || null,
        };
        return json(resp);
      }
    }

    if (hasMpCredentials()) {
      console.warn("Efí Bank failed, falling back to Mercado Pago");
      const mpResult = await createMercadoPagoPix(params);
      if (mpResult.ok) {
        const pix = mpResult.data.point_of_interaction?.transaction_data;
        const resp: StandardPixResponse = {
          status: mpResult.data.status || "pending",
          pix_code: pix?.qr_code || null,
          qr_code_url: pix?.qr_code_base64 || null,
          provider: "mercado_pago",
          reference_code: params.externalReference,
          payment_id: String(mpResult.data.id),
          amount: params.amount,
          created_at: new Date().toISOString(),
          expires_at: params.expiresAt || null,
        };
        return json(resp);
      }
    }

    return json({ error: "Erro ao gerar PIX via Efí Bank.", provider: "efi_bank" }, 500);
  }

  // ── Mercado Pago (primary) ──
  if (provider === "MERCADO_PAGO") {
    const mpResult = await createMercadoPagoPix(params);

    if (mpResult.ok) {
      const pix = mpResult.data.point_of_interaction?.transaction_data;
      const resp: StandardPixResponse = {
        status: mpResult.data.status || "pending",
        pix_code: pix?.qr_code || null,
        qr_code_url: pix?.qr_code_base64 || null,
        provider: "mercado_pago",
        reference_code: params.externalReference,
        payment_id: String(mpResult.data.id),
        amount: params.amount,
        created_at: new Date().toISOString(),
        expires_at: params.expiresAt || null,
      };
      return json(resp);
    }

    if (mpResult.status === 429) {
      return json({ error: "Sistema de pagamentos temporariamente indisponível.", rate_limited: true }, 429);
    }

    // Suspended → failover to Asaas then Efí
    if (mpResult.suspended) {
      if (hasAsaasCredentials()) {
        console.warn("Mercado Pago suspended, falling back to Asaas");
        const asaasResult = await createAsaasPix({
          amount: params.amount,
          description: params.description,
          payerCpf: params.payerCpf,
          payerName: `${params.payerFirstName} ${params.payerLastName}`.trim(),
          externalReference: params.externalReference,
          expiresAt: params.expiresAt,
        });
        if (asaasResult.ok) {
          const resp: StandardPixResponse = {
            status: "pending",
            pix_code: asaasResult.data?.pix_code || null,
            qr_code_url: asaasResult.data?.qr_code_url || null,
            provider: "asaas",
            reference_code: params.externalReference,
            payment_id: asaasResult.data?.payment_id || null,
            amount: params.amount,
            created_at: new Date().toISOString(),
            expires_at: params.expiresAt || null,
          };
          return json(resp);
        }
      }

      if (hasEfiCredentials()) {
        console.warn("Mercado Pago suspended, falling back to Efí Bank");
        const efiResult = await createEfiBankPix({
          amount: params.amount,
          description: params.description,
          externalReference: params.externalReference,
          expiresAt: params.expiresAt,
        });
        if (efiResult.ok) {
          const resp: StandardPixResponse = {
            status: "pending",
            pix_code: efiResult.data?.pix_code || null,
            qr_code_url: efiResult.data?.qr_code_url || null,
            provider: "efi_bank",
            reference_code: params.externalReference,
            payment_id: efiResult.data?.payment_id || null,
            amount: params.amount,
            created_at: new Date().toISOString(),
            expires_at: params.expiresAt || null,
          };
          return json(resp);
        }
      }
    }

    let userMessage = "Erro ao gerar PIX. Tente novamente.";
    if (mpResult.data?.message?.includes("access_token")) {
      userMessage = "Chave do Mercado Pago inválida. Contate o administrador.";
    } else if (mpResult.suspended) {
      userMessage = "Conta de pagamentos suspensa. O administrador precisa trocar o provedor de pagamentos.";
    }
    return json({ error: userMessage, provider: "mercado_pago" }, 500);
  }

  return json({ error: "Provedor de pagamentos não configurado." }, 500);
}

// ── Main handler ─────────────────────────────────────────────────────

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
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || "";

    const rawBody = await req.json();
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }

    const body = parsed.data;

    switch (body.action) {
      case "order_pix":
        return await handleOrderPix(body, userId, userEmail, supabase);
      case "commission_charge":
        return await handleCommissionCharge(body, userId, userEmail, supabase);
      case "store_payout":
        return await handleStorePayout(body, userId, userEmail, supabase);
      default:
        return json({ error: "Ação desconhecida" }, 400);
    }
  } catch (err) {
    console.error("Payment Router Error:", err);
    return json({ error: "Erro interno no roteador de pagamentos" }, 500);
  }
});
