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

const BodySchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive().max(100000),
  description: z.string().max(256).optional(),
  payer_first_name: z.string().max(100).optional(),
  payer_last_name: z.string().max(100).optional(),
  payer_cpf: z.string().min(11).max(14),
});

function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
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
      return json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { order_id, amount, description, payer_first_name, payer_last_name, payer_cpf } = parsed.data;

    // Verify the order belongs to this user and is awaiting payment
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, client_id, total_price, status, store_id, subtotal, delivery_fee, payment_method")
      .eq("id", order_id)
      .eq("client_id", userId)
      .single();

    if (orderError || !order) {
      return json({ error: "Pedido não encontrado" }, 404);
    }

    if (order.status !== "aguardando_pagamento") {
      return json({ error: "Pedido não está aguardando pagamento" }, 400);
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return json({ error: "Chave de pagamento não configurada." }, 500);
    }

    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    let cleanCpf = String(payer_cpf).replace(/\D/g, "");
    if (isSandbox && !isValidCpf(cleanCpf)) {
      cleanCpf = generateValidSandboxCpf();
      console.log("[Asaas Sandbox] Using generated valid CPF");
    }

    if (!isSandbox && cleanCpf.length !== 11) {
      return json({ error: "CPF inválido. Informe um CPF com 11 dígitos." }, 400);
    }

    // Step 1: Find or create customer
    let customerId: string | null = null;

    const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cleanCpf}`, {
      headers: { "access_token": ASAAS_API_KEY },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data?.length > 0) {
        customerId = searchData.data[0].id;
      }
    }

    if (!customerId) {
      const customerBody: Record<string, unknown> = {
        name: `${payer_first_name || "Cliente"} ${payer_last_name || ""}`.trim(),
        cpfCnpj: cleanCpf,
      };
      if (isSandbox) {
        customerBody.email = `cliente-${cleanCpf}@sandbox.itasuper.com`;
      }

      const createRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify(customerBody),
      });
      if (!createRes.ok) {
        const errData = await createRes.json();
        const errMsg = errData?.errors?.[0]?.description || "Erro ao criar cliente.";
        return json({ error: errMsg }, 500);
      }
      const customerData = await createRes.json();
      customerId = customerData.id;
    }

    // Step 2: Create PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    // Security check: Verify amount matches order total in DB
    const orderTotal = Number(order.total_price);
    if (Math.abs(orderTotal - Number(amount)) > 0.01) {
      console.error(`[Security] Amount mismatch: order=${orderTotal}, received=${amount}`);
      return json({ error: "O valor do pagamento não coincide com o total do pedido." }, 400);
    }

    // Step 2a: Compute split (only if store has Asaas subaccount configured)
    let splitArray: Array<{ walletId: string; fixedValue: number }> | undefined;
    try {
      const { data: splitInfo, error: splitErr } = await supabase.rpc(
        "get_asaas_split_for_order",
        {
          _store_id: order.store_id,
          _subtotal: Number(order.subtotal || 0),
          _delivery_fee: Number(order.delivery_fee || 0),
          _payment_method: "pix",
        }
      );
      if (!splitErr && splitInfo && (splitInfo as any).has_split) {
        const platformAmount = Number((splitInfo as any).platform_amount || 0);
        const storeWalletId = (splitInfo as any).store_wallet_id as string | null;
        
        const total = Number(amount);
        // Round everything to 2 decimals for safety
        const storeAmount = Math.max(0, Number((total - platformAmount).toFixed(2)));
        
        if (storeWalletId && storeAmount > 0 && storeAmount < total) {
          splitArray = [{ walletId: storeWalletId, fixedValue: storeAmount }];
          console.log(`[Split] order=${order_id} platform=${platformAmount} store=${storeAmount} wallet=${storeWalletId}`);
        }
      } else {
        console.log(`[Split] no split for order ${order_id} (fallback to legacy flow or wallet missing)`);
      }
    } catch (e) {
      console.warn("Split computation failed, proceeding without split:", e);
    }

    const paymentBody: Record<string, unknown> = {
      customer: customerId,
      billingType: "PIX",
      value: Number(amount),
      dueDate: dueDate.toISOString().split("T")[0],
      description: String(description || `Pedido ItaSuper #${order_id.substring(0, 6).toUpperCase()}`).substring(0, 140),
      externalReference: order_id,
    };
    if (splitArray && splitArray.length > 0) {
      paymentBody.split = splitArray;
    }

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
      body: JSON.stringify(paymentBody),
    });

    const paymentData = await paymentRes.json();
    if (!paymentRes.ok) {
      console.error("Asaas PIX Error:", JSON.stringify(paymentData));
      return json({ error: "Erro ao gerar PIX. Tente novamente." }, 500);
    }

    // Persist asaas_payment_id and flag whether the native split was applied,
    // so the webhook / polling endpoint can skip the manual /transfers call
    // and avoid double-paying the store.
    try {
      await supabase
        .from("orders")
        .update({
          asaas_payment_id: paymentData.id,
          asaas_split_native: !!(splitArray && splitArray.length > 0),
        })
        .eq("id", order_id);
    } catch (e) {
      console.warn("Could not persist asaas_payment_id/split flag:", e);
    }

    // Step 3: Get QR code
    const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { "access_token": ASAAS_API_KEY },
    });
    const pixInfo = await pixRes.json();

    // Use the real Asaas due date (typically next day 23:59:59) so the UI
    // doesn't mark a still-valid QR code as expired after 5 minutes.
    let expiresAt: string;
    try {
      const due = paymentData?.dueDate ? new Date(`${paymentData.dueDate}T23:59:59`) : null;
      expiresAt = due && !isNaN(due.getTime())
        ? due.toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } catch {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    return json({
      payment_id: paymentData.id,
      status: paymentData.status || "PENDING",
      qr_code: pixInfo?.payload || null,
      qr_code_base64: pixInfo?.encodedImage ? `data:image/png;base64,${pixInfo.encodedImage}` : null,
      ticket_url: null,
      expires_at: expiresAt,
      provider: "asaas",
    });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
