// e2e-pix-flow — Roda o fluxo ponta-a-ponta de PIX em sandbox:
//  1) escolhe um cliente sandbox + uma loja sandbox com subconta Asaas
//  2) cria pedido (status=aguardando_pagamento) com 1 produto da loja
//  3) gera cobrança PIX real no Asaas sandbox com split nativo
//  4) simula o pagamento chamando o asaas-webhook com um evento PAYMENT_RECEIVED
//     forjado (assinado com ASAAS_WEBHOOK_TOKEN), exatamente como o Asaas faria
//  5) aguarda alguns segundos e devolve o estado final do pedido + split
//
// Apenas admin pode chamar. Não interfere na sessão do usuário no preview.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const steps: Array<{ step: string; ok: boolean; info?: unknown; error?: string }> = [];
  const log = (step: string, ok: boolean, info?: unknown, error?: string) => {
    steps.push({ step, ok, info, error });
    console.log(`[e2e-pix-flow] ${step} ok=${ok}`, info ?? "", error ?? "");
  };

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const EXTERNAL_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const EXTERNAL_SVC =
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
      Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(EXTERNAL_URL, EXTERNAL_SVC);

    const token = auth.replace("Bearer ", "");
    // Bypass: header x-e2e-secret == EXTERNAL_CRON_SECRET (ou service-role key) permite rodar via tooling/CI
    const cronSecret = Deno.env.get("EXTERNAL_CRON_SECRET") || "";
    const e2eHeader = req.headers.get("x-e2e-secret") || "";
    if (token === EXTERNAL_SVC || (cronSecret && e2eHeader === cronSecret)) {
      log("auth_admin", true, { via: "service_or_cron_secret" });
    } else {
      const { data: u } = await userClient.auth.getUser(token);
      if (!u?.user) return json({ error: "Unauthorized" }, 401);
      const { data: roleRow } = await admin
        .from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) return json({ error: "Apenas admin" }, 403);
      log("auth_admin", true, { admin_user_id: u.user.id });
    }

    // 1) cliente sandbox
    const { data: clientList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const client = clientList?.users?.find((x) =>
      x.email?.toLowerCase() === "sandbox+cliente1@itasuper.test",
    );
    if (!client) return json({ error: "Cliente sandbox não encontrado. Rode 'Criar perfis sandbox' antes.", steps }, 400);
    log("pick_client", true, { client_id: client.id });

    // 2) loja sandbox com wallet
    const { data: stores } = await admin
      .from("stores")
      .select("id, name, owner_id, asaas_wallet_id, commission_rate, delivery_mode")
      .eq("is_test", true)
      .not("asaas_wallet_id", "is", null)
      .limit(1);
    const store = stores?.[0];
    if (!store) return json({ error: "Nenhuma loja sandbox com subconta Asaas. Rode 'Criar subcontas Asaas'.", steps }, 400);
    log("pick_store", true, { store_id: store.id, name: store.name, wallet: store.asaas_wallet_id });

    // 3) produto
    const { data: prods } = await admin
      .from("products").select("id, name, price").eq("store_id", store.id).eq("is_available", true).limit(1);
    const prod = prods?.[0];
    if (!prod) return json({ error: "Loja sandbox sem produtos.", steps }, 400);
    log("pick_product", true, prod);

    // 4) cria pedido
    const subtotal = Number(prod.price);
    const deliveryFee = 5;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;
    const { data: order, error: ordErr } = await admin
      .from("orders")
      .insert({
        client_id: client.id,
        store_id: store.id,
        subtotal,
        delivery_fee: deliveryFee,
        total_price: total,
        commission_rate: store.commission_rate ?? 0,
        payment_method: "pix",
        status: "aguardando_pagamento",
        neighborhood: "Centro",
        address_details: "Rua Sandbox, 100",
      } as any)
      .select("id")
      .single();
    if (ordErr || !order) {
      log("create_order", false, null, ordErr?.message);
      return json({ error: "Falha ao criar pedido", steps }, 500);
    }
    const orderId = order.id as string;
    log("create_order", true, { order_id: orderId, total });

    const { error: itemErr } = await admin.from("order_items").insert({
      order_id: orderId,
      product_id: prod.id,
      quantity: 1,
      unit_price: subtotal,
    } as any);
    if (itemErr) log("create_item", false, null, itemErr.message);
    else log("create_item", true);

    // 5) cria PIX no Asaas sandbox com split
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) return json({ error: "ASAAS_API_KEY ausente", steps }, 500);
    const isSandbox = !ASAAS_API_KEY.startsWith("$aact_prod_");
    const baseUrl = isSandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";
    if (!isSandbox) return json({ error: "ASAAS_API_KEY é PRODUÇÃO — abortei para não cobrar de verdade.", steps }, 400);

    // cliente Asaas pelo CPF do profile do cliente sandbox
    const { data: clientProfile } = await admin
      .from("profiles").select("document, full_name").eq("user_id", client.id).maybeSingle();
    const cpf = String(clientProfile?.document || "").replace(/\D/g, "") || "24971563792";

    let customerId: string | null = null;
    const cs = await fetch(`${baseUrl}/customers?cpfCnpj=${cpf}`, { headers: { access_token: ASAAS_API_KEY } });
    if (cs.ok) {
      const j = await cs.json();
      if (j.data?.length > 0) customerId = j.data[0].id;
    }
    if (!customerId) {
      const cr = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
        body: JSON.stringify({ name: clientProfile?.full_name || "Sandbox Cliente", cpfCnpj: cpf, email: `cliente-${cpf}@sandbox.itasuper.com` }),
      });
      const cj = await cr.json();
      if (!cr.ok) return json({ error: "Falha criar customer Asaas", details: cj, steps }, 500);
      customerId = cj.id;
    }
    log("asaas_customer", true, { customerId });

    // split
    let splitArray: Array<{ walletId: string; fixedValue: number }> | undefined;
    try {
      const { data: splitInfo } = await admin.rpc("get_asaas_split_for_order", {
        _store_id: store.id,
        _subtotal: subtotal,
        _delivery_fee: deliveryFee,
        _payment_method: "pix",
      });
      if (splitInfo && (splitInfo as any).has_split) {
        const platformAmount = Number((splitInfo as any).platform_amount || 0);
        const storeWalletId = (splitInfo as any).store_wallet_id as string | null;
        const storeAmount = Math.max(0, Number((total - platformAmount).toFixed(2)));
        if (storeWalletId && storeAmount > 0 && storeAmount < total) {
          splitArray = [{ walletId: storeWalletId, fixedValue: storeAmount }];
        }
        log("compute_split", true, { platformAmount, storeAmount, storeWalletId });
      } else {
        log("compute_split", true, { has_split: false });
      }
    } catch (e) {
      log("compute_split", false, null, String(e));
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const payBody: Record<string, unknown> = {
      customer: customerId,
      billingType: "PIX",
      value: total,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `E2E ${orderId.slice(0, 8)}`,
      externalReference: orderId,
    };
    if (splitArray) payBody.split = splitArray;

    const pr = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify(payBody),
    });
    const pj = await pr.json();
    if (!pr.ok) {
      log("asaas_create_pix", false, pj, `HTTP ${pr.status}`);
      return json({ error: "Falha criar cobrança PIX", details: pj, steps }, 500);
    }
    log("asaas_create_pix", true, { payment_id: pj.id, status: pj.status });
    await admin.from("orders").update({
      asaas_payment_id: pj.id,
      asaas_split_native: !!splitArray,
    }).eq("id", orderId);

    // 6) simula o pagamento: usa o endpoint sandbox para confirmar e
    //    também dispara o webhook manualmente (garantia de fluxo igual prod).
    // 6a) marca como recebido em dinheiro no Asaas sandbox (efeito: status RECEIVED)
    try {
      const today = new Date().toISOString().split("T")[0];
      const rc = await fetch(`${baseUrl}/payments/${pj.id}/receiveInCash`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
        body: JSON.stringify({ paymentDate: today, value: total, notifyCustomer: false }),
      });
      const rcj = await rc.json().catch(() => ({}));
      log("asaas_receive_cash", rc.ok, rcj, rc.ok ? undefined : `HTTP ${rc.status}`);
    } catch (e) {
      log("asaas_receive_cash", false, null, String(e));
    }

    // 6b) dispara webhook PAYMENT_RECEIVED forjado (mesmo caminho que o Asaas usa)
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (!webhookToken) {
      log("invoke_webhook", false, null, "ASAAS_WEBHOOK_TOKEN ausente");
    } else {
      const projectUrl = Deno.env.get("SUPABASE_URL")!;
      const fakeEvent = {
        id: `evt_e2e_${Date.now()}`,
        event: "PAYMENT_RECEIVED",
        payment: { id: pj.id, externalReference: orderId, value: total, status: "RECEIVED" },
      };
      try {
        const wr = await fetch(`${projectUrl}/functions/v1/asaas-webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "asaas-access-token": webhookToken,
          },
          body: JSON.stringify(fakeEvent),
        });
        const wj = await wr.json().catch(() => ({}));
        log("invoke_webhook", wr.ok, wj, wr.ok ? undefined : `HTTP ${wr.status}`);
      } catch (e) {
        log("invoke_webhook", false, null, String(e));
      }
    }

    // 7) polling: aguarda confirmação + split
    let final: any = null;
    for (let i = 0; i < 10; i++) {
      await sleep(1500);
      const { data: o } = await admin
        .from("orders")
        .select("id, status, confirmed_at, store_payout_id, store_payout_at, store_payout_error, asaas_split_native")
        .eq("id", orderId).maybeSingle();
      final = o;
      if (o?.status && o.status !== "aguardando_pagamento" &&
          (o.asaas_split_native || o.store_payout_id || o.store_payout_error)) break;
    }
    log("poll_final", true, final);

    // diagnóstico simples
    const issues: string[] = [];
    if (!final) issues.push("pedido sumiu");
    if (final?.status === "aguardando_pagamento") issues.push("status não avançou para 'pendente'");
    if (!final?.asaas_split_native && !final?.store_payout_id) issues.push("split não foi executado");
    if (final?.store_payout_error) issues.push(`split error: ${final.store_payout_error}`);

    return json({
      ok: issues.length === 0,
      order_id: orderId,
      asaas_payment_id: pj.id,
      issues,
      final,
      steps,
    });
  } catch (e) {
    console.error("[e2e-pix-flow] fatal", e);
    return json({ error: String((e as Error).message || e), steps }, 500);
  }
});