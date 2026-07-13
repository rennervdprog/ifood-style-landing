import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

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

const DriverPayoutSchema = z.object({
  action: z.literal("driver_payout"),
  driver_user_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  pix_key: z.string().min(1).max(256),
  pix_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
  withdrawal_request_id: z.string().uuid().optional(),
});

const CancelPaymentSchema = z.object({
  action: z.literal("cancel_payment"),
  order_id: z.string().uuid(),
});

const BodySchema = z.discriminatedUnion("action", [
  OrderPixSchema,
  CommissionChargeSchema,
  StorePayoutSchema,
  DriverPayoutSchema,
  CancelPaymentSchema,
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

function validateAsaasApiKey(key: string): { valid: boolean; sandbox: boolean; error?: string } {
  const trimmed = key.trim();
  if (!trimmed) return { valid: false, sandbox: false, error: "ASAAS_API_KEY is empty" };
  
  const isSandbox = !trimmed.startsWith("$aact_prod_");
  
  if (trimmed.length < 20) {
    return { valid: false, sandbox: isSandbox, error: `Key too short (${trimmed.length} chars). Copy the full key from Asaas dashboard.` };
  }
  
  return { valid: true, sandbox: isSandbox };
}

// Generate a valid CPF for sandbox testing (Asaas sandbox rejects invalid CPFs)
function generateValidSandboxCpf(): string {
  const digits = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 9; i++) digits[i] = Math.floor(Math.random() * 9);
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  digits.push(d1);
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  digits.push(d2);
  
  return digits.join("");
}

function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(clean[9]) !== d1) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return parseInt(clean[10]) === d2;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function createAsaasPix(supabase: any, params: {
  orderId?: string;
  storeId?: string;
  subtotal?: number;
  deliveryFee?: number;
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

  const keyValidation = validateAsaasApiKey(apiKey);
  if (!keyValidation.valid) {
    console.error("Asaas API key validation failed:", keyValidation.error);
    return { ok: false, data: { message: `Chave Asaas inválida: ${keyValidation.error}` }, status: 500 };
  }

  const isSandbox = keyValidation.sandbox;
  const baseUrl = isSandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";

  console.log(`[Asaas] Mode: ${isSandbox ? "SANDBOX" : "PRODUCTION"}, Key: [SET]`);

  try {
    // Asaas only generates PIX charges when the account has at least one active PIX key.
    const pixKeysRes = await fetch(`${baseUrl}/pix/addressKeys?limit=1`, {
      headers: { "access_token": apiKey },
    });

    if (pixKeysRes.ok) {
      const pixKeysData = await pixKeysRes.json();
      const hasPixKey = Number(pixKeysData?.totalCount || 0) > 0 || (Array.isArray(pixKeysData?.data) && pixKeysData.data.length > 0);
      if (!hasPixKey) {
        console.error("[Asaas] No PIX key available for receiving charges");
        return {
          ok: false,
          data: {
            message: "Sua conta Asaas ainda não possui chave Pix cadastrada para receber cobranças. Cadastre/ative uma chave Pix no Asaas e tente novamente.",
            missing_pix_key: true,
          },
          status: 200,
        };
      }
    } else {
      const pixKeysErr = await pixKeysRes.text();
      console.warn(`[Asaas] PIX key preflight failed (${pixKeysRes.status}):`, pixKeysErr);
    }

    // Step 1: Find or create customer by CPF
    let cleanCpf = params.payerCpf.replace(/\D/g, "");
    
    // In sandbox, use a valid CPF if the provided one is invalid
    if (isSandbox && !isValidCpf(cleanCpf)) {
      console.warn(`[Asaas Sandbox] Invalid CPF provided (${cleanCpf}), generating valid sandbox CPF`);
      cleanCpf = generateValidSandboxCpf();
    }
    
    let customerId: string | null = null;

    // Search existing customer
    const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cleanCpf}`, {
      headers: { "access_token": apiKey },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
        console.log(`[Asaas] Found existing customer: ${customerId}`);
      }
    } else {
      const searchErr = await searchRes.text();
      console.warn(`[Asaas] Customer search failed (${searchRes.status}):`, searchErr);
    }

    if (!customerId) {
      const customerName = (params.payerName || "Cliente ItaSuper").substring(0, 200);
      const customerBody: Record<string, unknown> = {
        name: customerName,
        cpfCnpj: cleanCpf,
      };
      
      // Sandbox needs email to avoid duplicate issues
      if (isSandbox) {
        customerBody.email = `cliente-${cleanCpf}@sandbox.itasuper.com`;
      }

      console.log(`[Asaas] Creating customer: name=${customerName}, cpf=${cleanCpf.substring(0, 3)}***`);
      
      const createCustomerRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": apiKey,
        },
        body: JSON.stringify(customerBody),
      });

      if (!createCustomerRes.ok) {
        const errData = await createCustomerRes.text();
        console.error(`[Asaas] Create customer FAILED (${createCustomerRes.status}):`, errData);
        
        // Parse Asaas error for better user message
        let userMsg = "Erro ao criar cliente no Asaas.";
        try {
          const errJson = JSON.parse(errData);
          if (errJson.errors?.[0]?.description) {
            userMsg = `Asaas: ${errJson.errors[0].description}`;
          }
        } catch {}
        
        return { ok: false, data: { message: userMsg, asaas_error: errData }, status: createCustomerRes.status };
      }

      const customerData = await createCustomerRes.json();
      customerId = customerData.id;
      console.log(`[Asaas] Customer created: ${customerId}`);
    }

    // Step 2a: Compute split (same logic as create-pix-payment)
    let splitArray: Array<{ walletId: string; fixedValue: number }> | undefined;
    if (params.orderId && params.storeId) {
      try {
        const { data: splitInfo, error: splitErr } = await supabase.rpc(
          "get_asaas_split_for_order",
          {
            _store_id: params.storeId,
            _subtotal: params.subtotal || 0,
            _delivery_fee: params.deliveryFee || 0,
            _payment_method: "pix",
          }
        );
        if (!splitErr && splitInfo && (splitInfo as any).has_split) {
          const platformAmount = Number((splitInfo as any).platform_amount || 0);
          const storeWalletId = (splitInfo as any).store_wallet_id as string | null;
          const total = Number(params.amount);
          const storeAmount = Math.max(0, Number((total - platformAmount).toFixed(2)));
          if (storeWalletId && storeAmount > 0 && storeAmount < total) {
            splitArray = [{ walletId: storeWalletId, fixedValue: storeAmount }];
          }
        }
      } catch (e) {
        console.warn("[Router] Split computation failed:", e);
      }
    }

    // Step 2: Create payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentBody: Record<string, unknown> = {
      customer: customerId,
      billingType: "PIX",
      notificationDisabled: true,
      value: params.amount,
      dueDate: dueDateStr,
      description: params.description.substring(0, 500),
      externalReference: params.externalReference,
    };

    if (splitArray?.length) {
      paymentBody.split = splitArray;
      console.log(`[Router] Applied split to Asaas payment: ${JSON.stringify(splitArray)}`);
    }

    console.log(`[Asaas] Creating PIX payment: R$${params.amount}, ref=${params.externalReference}`);
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
      console.error(`[Asaas] Payment creation FAILED (${paymentRes.status}):`, errData);
      
      if (errData.includes("não pode ser menor que R$") || errData.includes("menor que R$ 5")) {
        return { ok: false, data: { message: "O valor mínimo para pagamento PIX é R$ 5,00.", min_amount: true }, status: 400 };
      }
      
      let userMsg = `Erro ao criar pagamento Asaas (${paymentRes.status})`;
      try {
        const errJson = JSON.parse(errData);
        if (errJson.errors?.[0]?.description) {
          userMsg = `Asaas: ${errJson.errors[0].description}`;
        }
      } catch {}

      if (userMsg.includes("Não há nenhuma chave Pix disponível")) {
        return {
          ok: false,
          data: {
            message: "Sua conta Asaas ainda não possui chave Pix cadastrada para receber cobranças. Cadastre/ative uma chave Pix no Asaas e tente novamente.",
            missing_pix_key: true,
          },
          status: 200,
        };
      }
      
      return { ok: false, data: { message: userMsg, asaas_error: errData }, status: paymentRes.status };
    }

    const paymentData = await paymentRes.json();
    const paymentId = paymentData.id;
    console.log(`[Asaas] Payment created: ${paymentId}, status: ${paymentData.status}`);

    let pixCode: string | null = null;
    let qrCodeBase64: string | null = null;

    // Step 3: Get PIX QR Code — Asaas can take a short moment to release it after payment creation.
    for (let attempt = 1; attempt <= 4; attempt++) {
      const pixRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
        headers: { "access_token": apiKey },
      });

      if (pixRes.ok) {
        const pixData = await pixRes.json();
        pixCode = pixData.payload || null;
        qrCodeBase64 = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null;
        if (pixCode || qrCodeBase64) {
          console.log(`[Asaas] QR code obtained successfully on attempt ${attempt}`);
          break;
        }
        console.warn(`[Asaas] QR code empty on attempt ${attempt}:`, JSON.stringify(pixData).slice(0, 500));
      } else {
        const pixErr = await pixRes.text();
        console.warn(`[Asaas] QR code fetch failed attempt ${attempt} (${pixRes.status}):`, pixErr);
      }

      if (attempt < 4) await wait(650 * attempt);
    }

    if (!pixCode && !qrCodeBase64) {
      return {
        ok: false,
        data: {
          message: "Pagamento criado no Asaas, mas o QR Code ainda não foi liberado. Tente gerar novamente em alguns segundos.",
          payment_id: paymentId,
          no_qr: true,
        },
        status: 202,
      };
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
    console.error("[Asaas] Exception:", err);
    return { ok: false, data: { message: "Erro interno ao processar pagamento Asaas." }, status: 500 };
  }
}

// ── Provider: Asaas Transfer (Payout) ────────────────────────────────

async function createAsaasTransfer(params: {
  amount: number;
  pixKey: string;
  pixType: string;
  description: string;
}): Promise<{ ok: boolean; data: any; status: number }> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    return { ok: false, data: { message: "ASAAS_API_KEY não configurado." }, status: 500 };
  }

  const baseUrl = apiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  // Map pix_type to Asaas pixAddressKeyType
  const pixTypeMap: Record<string, string> = {
    cpf: "CPF",
    cnpj: "CNPJ",
    email: "EMAIL",
    phone: "PHONE",
    random: "EVP",
  };

  const transferBody = {
    value: params.amount,
    operationType: "PIX",
    pixAddressKey: params.pixKey,
    pixAddressKeyType: pixTypeMap[params.pixType] || "CPF",
    description: params.description.substring(0, 140),
  };

  try {
    console.log("Asaas creating transfer...", JSON.stringify({ amount: params.amount, pixType: params.pixType }));
    const res = await fetch(`${baseUrl}/transfers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: JSON.stringify(transferBody),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Asaas transfer error:", res.status, JSON.stringify(data));
      const errorMsg = data?.errors?.[0]?.description || data?.message || `Erro Asaas: ${res.status}`;
      return { ok: false, data: { message: errorMsg }, status: res.status };
    }

    console.log("Asaas transfer created:", data.id, "status:", data.status);
    return {
      ok: true,
      data: {
        transfer_id: data.id,
        status: data.status,
        value: data.value,
        operationType: data.operationType,
      },
      status: 200,
    };
  } catch (err) {
    console.error("Asaas transfer exception:", err);
    return { ok: false, data: { message: "Erro interno ao processar transferência Asaas." }, status: 500 };
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
    "00020126580014br.gov.bcb.pix0136SIMULACAO-ITASUPER-MODO-TESTE520400005303986540510.005802BR5913ITASUPER TESTE6014CIDADE TESTE62070503***6304ABCD";
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

function getServiceRoleKey(): string | undefined {
  return Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

async function getActiveProviderFromDB(): Promise<Provider> {
  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getServiceRoleKey()!,
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
  if (env === "MERCADO_PAGO") return "MERCADO_PAGO";
  if (env === "SIMULATED") return "SIMULATED";
  return "ASAAS";
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
  console.log(`[OrderPix] 🔵 START order=${order_id} amount=${amount} user=${userId.slice(0,8)}`);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, client_id, total_price, subtotal, delivery_fee, status, store_id")
    .eq("id", order_id)
    .eq("client_id", userId)
    .single();

  if (orderError || !order) {
    console.warn(`[OrderPix] ❌ Order not found: ${orderError?.message}`);
    return json({ error: "Pedido não encontrado" }, 404);
  }
  console.log(`[OrderPix] ✅ Order ok: status=${order.status} total=${order.total_price} store=${order.store_id}`);
  if (order.status !== "aguardando_pagamento") {
    console.warn(`[OrderPix] ❌ Wrong status: ${order.status}`);
    return json({ error: "Pedido não está aguardando pagamento" }, 400);
  }

  if (typeof amount !== "number" || amount <= 0 || amount > 100000) return json({ error: "Valor inválido" }, 400);

  const cleanCpf = String(payer_cpf || "").replace(/\D/g, "");
  if (!cleanCpf || cleanCpf.length !== 11) {
    console.warn(`[OrderPix] ❌ Invalid CPF: length=${cleanCpf.length}`);
    return json({ error: "CPF inválido. Informe um CPF com 11 dígitos." }, 400);
  }

  // Payment goes 100% to main account. Store share transferred via webhook on confirmation.

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const desc = String(description || `Pedido ItaSuper #${order_id.substring(0, 6).toUpperCase()}`).substring(0, 256);
  const idempotencyKey = `pix-${order_id}-${Date.now()}`;
  console.log(`[OrderPix] 🚀 Routing to provider…`);

  // Security check: Verify amount matches order total in DB
  const orderTotal = Number(order.total_price);
  if (Math.abs(orderTotal - amount) > 0.01) {
    console.error(`[Router Security] Amount mismatch: order=${orderTotal}, received=${amount}`);
    return json({ error: "O valor do pagamento não coincide com o total do pedido." }, 400);
  }

  return await routePixCreation({
    amount,
    description: desc,
    payerEmail: userEmail || "cliente@itasuper.com",
    payerFirstName: String(payer_first_name || "Cliente").substring(0, 100),
    payerLastName: String(payer_last_name || "ItaSuper").substring(0, 100),
    payerCpf: cleanCpf,
    externalReference: order_id,
    idempotencyKey,
    expiresAt,
    // Pass order info for split calculation
    orderId: order.id,
    storeId: order.store_id,
    subtotal: Number(order.subtotal || 0),
    deliveryFee: Number(order.delivery_fee || 0),
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

  // Fetch store owner's profile for real CPF
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    getServiceRoleKey()!,
  );

  const { data: ownerProfile } = await serviceClient
    .from("profiles")
    .select("document, full_name, email")
    .eq("user_id", store.owner_id)
    .single();

  // serviceClient already created above for owner profile lookup

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

  const desc = String(description || `Comissão ItaSuper - ${store.name} - ${referenceCode}`).substring(0, 256);
  const idempotencyKey = `commission-${store_id}-${referenceCode}`;

  const result = await routePixCreation({
    amount: Number(amount.toFixed(2)),
    description: desc,
    payerEmail: ownerProfile?.email || userEmail || "lojista@itasuper.com",
    payerFirstName: ownerProfile?.full_name?.split(" ")[0] || store.name.substring(0, 100),
    payerLastName: ownerProfile?.full_name?.split(" ").slice(1).join(" ") || "ItaSuper",
    payerCpf: ownerProfile?.document?.replace(/\D/g, "") || "00000000000",
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
    getServiceRoleKey()!,
  );

  // Check admin via DB function
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
  const desc = `Repasse ItaSuper - ${store.name} - ${referenceCode}`;

  // Try Asaas Transfer (real money transfer) first
  const provider = await getActiveProviderFromDB();
  let transferSuccess = false;
  let transferData: any = null;

  if (provider === "ASAAS" || hasAsaasCredentials()) {
    const transferResult = await createAsaasTransfer({
      amount: Number(amount.toFixed(2)),
      pixKey: pix_key,
      pixType: pix_type,
      description: desc,
    });

    if (transferResult.ok) {
      transferSuccess = true;
      transferData = transferResult.data;
    } else {
      console.warn("Asaas transfer failed, falling back to QR code generation:", transferResult.data?.message);
    }
  }

  if (transferSuccess) {
    // Transfer was sent directly via Asaas
    const txRecord: Record<string, unknown> = {
      store_id,
      transaction_kind: "store_payout",
      reference_code: referenceCode,
      amount: Number(amount.toFixed(2)),
      status: "approved",
      provider: "asaas",
      mercado_pago_payment_id: String(transferData?.transfer_id || ""),
      settled_at: new Date().toISOString(),
      metadata: { store_name: store.name, pix_key, pix_type, description: desc, transfer_type: "asaas_transfer" },
    };
    await serviceClient.from("financial_transactions").insert(txRecord);

    // Log to payout_history
    await serviceClient.from("payout_history").insert({
      entity_type: "store",
      entity_id: store_id,
      entity_name: store.name,
      amount: Number(amount.toFixed(2)),
      payout_type: "auto_asaas",
      notes: `Transferência automática Asaas: ${referenceCode} | PIX: ${pix_key} (${pix_type})`,
      admin_user_id: userId,
    });

    // Zero balances
    await serviceClient
      .from("store_balances")
      .update({ repasse_pendente: 0, comissao_pendente: 0, pending_commission: 0 })
      .eq("store_id", store_id);

    return json({
      success: true,
      reference_code: referenceCode,
      transfer_id: transferData?.transfer_id,
      status: "approved",
      amount: Number(amount.toFixed(2)),
      provider: "asaas",
      transfer_type: "direct",
      message: `Transferência de R$ ${amount.toFixed(2)} enviada para ${store.name} via Asaas!`,
    });
  }

  // Fallback: generate PIX QR code (old behavior)
  const idempotencyKey = `payout-${store_id}-${Date.now()}`;
  const result = await routePixCreation({
    amount: Number(amount.toFixed(2)),
    description: desc.substring(0, 256),
    payerEmail: _userEmail || "admin@itasuper.com",
    payerFirstName: "ItaSuper",
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
  orderId?: string;
  storeId?: string;
  subtotal?: number;
  deliveryFee?: number;
}): Promise<Response> {
  // Get service role supabase client to allow RPC call
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!,
  );

  const provider = await getActiveProviderFromDB();
  console.log(`[Route] 🎯 Active provider: ${provider} | hasAsaas=${hasAsaasCredentials()} hasMP=${hasMpCredentials()} hasEfi=${hasEfiCredentials()}`);

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
    const asaasResult = await createAsaasPix(serviceClient, {
      amount: params.amount,
      description: params.description,
      payerCpf: params.payerCpf,
      payerName: `${params.payerFirstName} ${params.payerLastName}`.trim(),
      externalReference: params.externalReference,
      expiresAt: params.expiresAt,
      orderId: params.orderId,
      storeId: params.storeId,
      subtotal: params.subtotal,
      deliveryFee: params.deliveryFee,
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

    if (asaasResult.data?.no_qr) {
      return json({ error: asaasResult.data.message, provider: "asaas", payment_id: asaasResult.data.payment_id }, 202);
    }

    // Asaas failed → check if it's a minimum amount error (don't fallback for validation errors)
    if (asaasResult.data?.min_amount) {
      return json({ error: asaasResult.data.message, provider: "asaas" }, 400);
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

    return json(
      {
        error: asaasResult.data?.message || "Erro ao gerar PIX. Tente novamente.",
        provider: "asaas",
        missing_pix_key: !!asaasResult.data?.missing_pix_key,
      },
      asaasResult.status >= 400 ? asaasResult.status : 200,
    );
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
      const asaasResult = await createAsaasPix(serviceClient, {
        amount: params.amount,
        description: params.description,
        payerCpf: params.payerCpf,
        payerName: `${params.payerFirstName} ${params.payerLastName}`.trim(),
        externalReference: params.externalReference,
        expiresAt: params.expiresAt,
        orderId: params.orderId,
        storeId: params.storeId,
        subtotal: params.subtotal,
        deliveryFee: params.deliveryFee,
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
        const asaasResult = await createAsaasPix(serviceClient, {
          amount: params.amount,
          description: params.description,
          payerCpf: params.payerCpf,
          payerName: `${params.payerFirstName} ${params.payerLastName}`.trim(),
          externalReference: params.externalReference,
          expiresAt: params.expiresAt,
          orderId: params.orderId,
          storeId: params.storeId,
          subtotal: params.subtotal,
          deliveryFee: params.deliveryFee,
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

// ── Route: cancel payment ────────────────────────────────────────────

async function cancelAsaasPayment(paymentId: string): Promise<boolean> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return false;

  const baseUrl = apiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  try {
    const res = await fetch(`${baseUrl}/payments/${paymentId}`, {
      method: "DELETE",
      headers: { "access_token": apiKey },
    });
    console.log("Asaas cancel payment response:", res.status);
    return res.ok;
  } catch (err) {
    console.error("Asaas cancel error:", err);
    return false;
  }
}

async function cancelMercadoPagoPayment(paymentId: string): Promise<boolean> {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!token) return false;

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    console.log("MP cancel payment response:", res.status);
    return res.ok;
  } catch (err) {
    console.error("MP cancel error:", err);
    return false;
  }
}

// ── Route: driver payout (Asaas Transfer) ────────────────────────────

async function handleDriverPayout(
  body: z.infer<typeof DriverPayoutSchema>,
  userId: string,
  _userEmail: string,
  supabase: any,
): Promise<Response> {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    getServiceRoleKey()!,
  );

  // Only admin can do driver payouts
  const { data: isAdmin } = await serviceClient.rpc("is_platform_admin", { _user_id: userId });
  if (!isAdmin) return json({ error: "Apenas o administrador pode realizar repasses a motoboys." }, 403);

  const { driver_user_id, amount, pix_key, pix_type, withdrawal_request_id } = body;

  // Get driver name
  const { data: driver } = await serviceClient
    .from("drivers")
    .select("name")
    .eq("user_id", driver_user_id)
    .single();

  const driverName = driver?.name || "Entregador";

  // Generate reference
  const { data: refData } = await serviceClient.rpc("generate_financial_reference", { _prefix: "MOT" });
  const referenceCode = refData || `#MOT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const desc = `Repasse Motoboy - ${driverName} - ${referenceCode}`;

  // Try Asaas Transfer first
  const provider = await getActiveProviderFromDB();
  let transferResult: { ok: boolean; data: any } = { ok: false, data: { message: "Nenhum provedor configurado" } };

  if (provider === "ASAAS" || hasAsaasCredentials()) {
    transferResult = await createAsaasTransfer({
      amount: Number(amount.toFixed(2)),
      pixKey: pix_key,
      pixType: pix_type,
      description: desc,
    });
  }

  // Save to financial_transactions (need a store_id - use a system placeholder or first store)
  // For driver payouts we need to handle the store_id requirement
  // We'll record it but mark it as driver_payout
  const txRecord: Record<string, unknown> = {
    store_id: "00000000-0000-0000-0000-000000000000", // placeholder for driver payouts
    transaction_kind: "driver_payout",
    reference_code: referenceCode,
    amount: Number(amount.toFixed(2)),
    status: transferResult.ok ? "approved" : "failed",
    provider: provider === "ASAAS" ? "asaas" : "manual",
    mercado_pago_payment_id: transferResult.ok ? String(transferResult.data?.transfer_id || "") : null,
    metadata: {
      driver_user_id,
      driver_name: driverName,
      pix_key,
      pix_type,
      description: desc,
      withdrawal_request_id: withdrawal_request_id || null,
    },
  };

  if (transferResult.ok) {
    txRecord.settled_at = new Date().toISOString();
  }

  // We need a valid store_id. Let's skip financial_transactions for driver payouts
  // and just log to payout_history instead
  await serviceClient.from("payout_history").insert({
    entity_type: "driver",
    entity_id: driver_user_id,
    entity_name: driverName,
    amount: Number(amount.toFixed(2)),
    payout_type: transferResult.ok ? "auto_asaas" : "manual",
    notes: transferResult.ok
      ? `Transferência automática Asaas: ${referenceCode} | PIX: ${pix_key} (${pix_type})`
      : `Falha na transferência automática: ${transferResult.data?.message || "erro desconhecido"}`,
    admin_user_id: userId,
  });

  if (transferResult.ok) {
    // Update driver balance
    await serviceClient
      .from("driver_balances")
      .update({
        pending_amount: 0,
        paid_amount: Number(amount.toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq("driver_user_id", driver_user_id);

    // Update driver earnings
    await serviceClient
      .from("driver_earnings")
      .update({ status: "pago" })
      .eq("driver_user_id", driver_user_id)
      .in("status", ["pendente", "waiting_store_settlement"]);

    // If withdrawal request, mark as paid
    if (withdrawal_request_id) {
      await serviceClient
        .from("withdrawal_requests")
        .update({
          status: "pago",
          processed_at: new Date().toISOString(),
          admin_notes: `Pago automaticamente via Asaas. Ref: ${referenceCode}`,
        })
        .eq("id", withdrawal_request_id);
    }

    return json({
      success: true,
      reference_code: referenceCode,
      transfer_id: transferResult.data?.transfer_id,
      status: "approved",
      amount: Number(amount.toFixed(2)),
      driver_name: driverName,
      provider: "asaas",
    });
  }

  return json({
    success: false,
    reference_code: referenceCode,
    status: "manual_required",
    message: `Transferência automática falhou: ${transferResult.data?.message}. Realize manualmente PIX de R$ ${amount.toFixed(2)} para ${pix_key} (${pix_type})`,
    pix_key,
    pix_type,
    amount: Number(amount.toFixed(2)),
    driver_name: driverName,
  });
}

async function handleCancelPayment(
  body: z.infer<typeof CancelPaymentSchema>,
  userId: string,
  supabase: any,
): Promise<Response> {
  const { order_id } = body;

  // Verify order belongs to user and is still awaiting payment
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, client_id, status")
    .eq("id", order_id)
    .eq("client_id", userId)
    .single();

  if (orderError || !order) return json({ error: "Pedido não encontrado" }, 404);
  if (order.status !== "aguardando_pagamento") {
    return json({ error: "Pedido não está aguardando pagamento" }, 400);
  }

  // Look for pending financial transactions with this order_id as reference
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    getServiceRoleKey()!,
  );

  // Try to find any payment record linked to this order
  const { data: txns } = await serviceClient
    .from("financial_transactions")
    .select("mercado_pago_payment_id, provider")
    .eq("reference_code", order_id)
    .eq("status", "pending");

  let cancelledOnProvider = false;

  // Cancel on provider if we have a payment ID
  if (txns && txns.length > 0) {
    for (const tx of txns) {
      if (tx.mercado_pago_payment_id) {
        if (tx.provider === "asaas") {
          cancelledOnProvider = await cancelAsaasPayment(tx.mercado_pago_payment_id);
        } else if (tx.provider === "mercado_pago") {
          cancelledOnProvider = await cancelMercadoPagoPayment(tx.mercado_pago_payment_id);
        }
      }
    }
    // Mark transactions as cancelled
    await serviceClient
      .from("financial_transactions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("reference_code", order_id)
      .eq("status", "pending");
  }

  // Also try direct Asaas search by externalReference (order PIX payments aren't in financial_transactions)
  if (!cancelledOnProvider) {
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (apiKey) {
      const baseUrl = apiKey.startsWith("$aact_prod_")
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";
      try {
        const searchRes = await fetch(`${baseUrl}/payments?externalReference=${order_id}`, {
          headers: { "access_token": apiKey },
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.data) {
            for (const payment of searchData.data) {
              if (payment.status === "PENDING" || payment.status === "OVERDUE") {
                await cancelAsaasPayment(payment.id);
                cancelledOnProvider = true;
              }
            }
          }
        }
      } catch (err) {
        console.error("Asaas search for cancel error:", err);
      }
    }
  }

  // Cancel the order
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "cancelado" as any })
    .eq("id", order_id)
    .eq("client_id", userId);

  if (updateError) {
    return json({ error: "Erro ao cancelar pedido" }, 500);
  }

  console.log(`Order ${order_id} cancelled. Provider cancelled: ${cancelledOnProvider}`);
  return json({ success: true, provider_cancelled: cancelledOnProvider });
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqId = crypto.randomUUID().slice(0, 8);
    console.log(`[PR ${reqId}] ▶️ ${req.method} ${new URL(req.url).pathname}`);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn(`[PR ${reqId}] ❌ Missing Authorization header`);
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
      console.warn(`[PR ${reqId}] ❌ Auth failed:`, userError?.message);
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || "";

    const rawBody = await req.json();
    console.log(`[PR ${reqId}] 👤 user=${userId.slice(0, 8)} action=${(rawBody as any)?.action} body=${JSON.stringify(rawBody).slice(0, 300)}`);
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      console.warn(`[PR ${reqId}] ❌ Schema invalid:`, JSON.stringify(parsed.error.flatten().fieldErrors));
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
      case "driver_payout":
        return await handleDriverPayout(body, userId, userEmail, supabase);
      case "cancel_payment":
        return await handleCancelPayment(body, userId, supabase);
      default:
        return json({ error: "Ação desconhecida" }, 400);
    }
  } catch (err) {
    console.error("[PR] 💥 Payment Router Error:", err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
    return json({ error: "Erro interno no roteador de pagamentos", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
