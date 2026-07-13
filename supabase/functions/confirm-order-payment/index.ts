// Polling-based fallback for Asaas webhook.
// The client calls this every few seconds while a PIX QR code is open.
// It checks Asaas directly and, if the payment is confirmed, runs the
// same order-confirmation + split logic as the webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function getServiceRoleKey() {
  return (
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
    Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    ""
  );
}

async function confirmAndSplit(supabase: any, orderId: string, paymentId: string | null) {
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, store_id, subtotal, delivery_fee, payment_method, store_payout_id, asaas_split_native")
    .eq("id", orderId)
    .single();

  if (!order) return { confirmed: false, reason: "order_not_found" };

  // Move to pendente only if still awaiting
  if (order.status === "aguardando_pagamento") {
    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: "pendente" as any, confirmed_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "aguardando_pagamento");
    if (updErr) {
      console.error("[confirm-order-payment] update error:", updErr);
      return { confirmed: false, reason: "update_failed" };
    }
  }

  // Native-split guard — Asaas already routed the platform/store cut.
  if (order.asaas_split_native === true) {
    return { confirmed: true, reason: "native_split", payment_id: paymentId };
  }

  // Skip split if already done
  if (order.store_payout_id) {
    return { confirmed: true, reason: "already_split", status: "pendente", payout_id: order.store_payout_id };
  }

  // Optimistic lock — only one caller may proceed past this point.
  const lockSentinel = `LOCK:cop:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const { data: lockRows, error: lockErr } = await supabase
    .from("orders")
    .update({ store_payout_id: lockSentinel })
    .eq("id", orderId)
    .is("store_payout_id", null)
    .select("id");
  if (lockErr) {
    console.error("[confirm-order-payment] lock error:", lockErr);
    return { confirmed: true, reason: "lock_error" };
  }
  if (!lockRows || lockRows.length === 0) {
    return { confirmed: true, reason: "already_locked", payment_id: paymentId };
  }

  // ── Auto-transfer store share via Asaas (mirrors asaas-webhook logic) ──
  if (order.store_id && order.subtotal) {
    const subtotal = Number(order.subtotal) || 0;
    const deliveryFee = Number(order.delivery_fee) || 0;

    const { data: store } = await supabase
      .from("stores")
      .select("id, name, owner_id, delivery_mode, commission_rate")
      .eq("id", order.store_id)
      .single();

    const { data: storePlan } = await supabase
      .from("store_plans")
      .select("plan_type, commission_rate, pix_operational_fee_override, platform_delivery_split_override")
      .eq("store_id", order.store_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("pix_key, pix_type, full_name")
      .eq("user_id", store?.owner_id)
      .single();

    if (store && ownerProfile?.pix_key) {
      const isFixedPlan = storePlan?.plan_type === "fixed";
      const isOwnDelivery = store.delivery_mode === "own";

      let pixOpFee = 1.99;
      let platformSplit = 0.99;
      try {
        const { data: feeConfigRow } = await supabase
          .from("admin_settings")
          .select("value")
          .eq("key", "delivery_fee_config")
          .maybeSingle();
        if (feeConfigRow?.value) {
          const fc = feeConfigRow.value as any;
          // Chave correta no banco é "pix_fee" dentro do JSON delivery_fee_config
          pixOpFee = fc.pix_fee ?? fc.pix_operational_fee ?? 1.99;
          platformSplit = fc.platform_split ?? 0.99;
        }
      } catch (_) {}

      const pixOverride = (storePlan as any)?.pix_operational_fee_override;
      const splitOverride = (storePlan as any)?.platform_delivery_split_override;
      if (pixOverride !== null && pixOverride !== undefined) pixOpFee = Number(pixOverride);
      if (splitOverride !== null && splitOverride !== undefined) platformSplit = Number(splitOverride);

      let storeShare = 0;
      let commissionAmount = 0;

      const isHybridPlan = storePlan?.plan_type === "hybrid";
      if (isFixedPlan) {
        // Fixed/Supporter: storeShare = subtotal - PIX fee + delivery líquido
        if (isOwnDelivery) {
          const deliveryAfterSplit = Math.max(0, deliveryFee - platformSplit);
          storeShare = Math.round((subtotal - pixOpFee + deliveryAfterSplit) * 100) / 100;
        } else {
          storeShare = Math.round((subtotal - pixOpFee) * 100) / 100;
        }
      } else if (isHybridPlan) {
        // Hybrid: cobra comissão % sobre subtotal + R$ 0,99 de entrega
        const rate = (storePlan?.commission_rate ?? store.commission_rate ?? 2.5) / 100;
        commissionAmount = Math.round(subtotal * rate * 100) / 100;
        if (isOwnDelivery) {
          const deliveryAfterSplit = Math.max(0, deliveryFee - platformSplit);
          storeShare = Math.round((subtotal * (1 - rate) + deliveryAfterSplit) * 100) / 100;
        } else {
          storeShare = Math.round(subtotal * (1 - rate) * 100) / 100;
        }
      } else {
        // Commission_only: cobra comissão % sobre subtotal
        const rate = (storePlan?.commission_rate ?? store.commission_rate ?? 6) / 100;
        commissionAmount = Math.round(subtotal * rate * 100) / 100;
        storeShare = isOwnDelivery
          ? Math.round((subtotal * (1 - rate) + deliveryFee) * 100) / 100
          : Math.round(subtotal * (1 - rate) * 100) / 100;
      }
      if (storeShare < 0) storeShare = 0;

      if (storeShare > 0) {
        const apiKey = Deno.env.get("ASAAS_API_KEY");
        if (apiKey) {
          const baseUrl = apiKey.startsWith("$aact_prod_")
            ? "https://api.asaas.com/v3"
            : "https://sandbox.asaas.com/api/v3";
          const pixTypeMap: Record<string, string> = {
            cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", phone: "PHONE", random: "EVP",
          };
          const sanitizePix = (key: string, type: string): string => {
            const raw = (key || "").trim();
            switch ((type || "random").toLowerCase()) {
              case "cpf":
              case "cnpj":
                return raw.replace(/\D/g, "");
              case "phone": {
                const digits = raw.replace(/\D/g, "");
                if (digits.length === 11) return `+55${digits}`;
                if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
                if (raw.startsWith("+")) return raw;
                return `+${digits}`;
              }
              case "email":
                return raw.toLowerCase();
              default:
                return raw;
            }
          };
          try {
            const transferRes = await fetch(`${baseUrl}/transfers`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "access_token": apiKey },
              body: JSON.stringify({
                value: storeShare,
                operationType: "PIX",
                pixAddressKey: sanitizePix(ownerProfile.pix_key, ownerProfile.pix_type || "random"),
                pixAddressKeyType: pixTypeMap[ownerProfile.pix_type || "random"] || "EVP",
                description: `Repasse pedido #${orderId.substring(0, 8)} - ${store.name}`.substring(0, 140),
              }),
            });
            const tData = await transferRes.json();
            if (transferRes.ok) {
              console.log(`[confirm-order-payment] split R$${storeShare} → ${store.name} ok (${tData.id})`);
              await supabase.from("orders").update({
                store_payout_id: tData.id,
                store_payout_at: new Date().toISOString(),
                store_payout_error: null,
              }).eq("id", orderId);
            } else {
              console.error(`[confirm-order-payment] split failed:`, JSON.stringify(tData));
              // Keep the lock to prevent duplicate splits on retry.
              // The transfer may have partially succeeded server-side; a human
              // must review before another attempt. Record the failure but do
              // NOT clear store_payout_id.
              await supabase.from("orders").update({
                store_payout_error: JSON.stringify(tData).substring(0, 500),
              }).eq("id", orderId);
            }
          } catch (e) {
            console.error("[confirm-order-payment] split exception:", e);
            // Network/exception: the Asaas request may have reached the server.
            // Keep the lock to avoid duplicate transfers; log the error for
            // manual reconciliation.
            await supabase.from("orders").update({
              store_payout_error: String(e).substring(0, 500),
            }).eq("id", orderId);
          }
        } else {
          // No API key — release lock for later retry
          await supabase.from("orders").update({
            store_payout_id: null,
            store_payout_error: "asaas_api_key_missing",
          }).eq("id", orderId);
        }
      } else {
        // Nothing to transfer — release the lock
        await supabase.from("orders").update({
          store_payout_id: null,
        }).eq("id", orderId);
      }

      if (commissionAmount > 0) {
        // A-1: crédito atômico (evita race condition em confirmações simultâneas)
        const { error: credErr } = await supabase.rpc("credit_store_commission", {
          _store_id: order.store_id,
          _amount: commissionAmount,
        });
        if (credErr) {
          console.error("[confirm-order-payment] credit_store_commission error:", credErr);
        }
      }
    } else {
      console.warn(`[confirm-order-payment] Store ${order.store_id} owner has no PIX key — split skipped`);
      await supabase.from("orders").update({
        store_payout_id: null,
        store_payout_error: "owner_pix_key_missing",
      }).eq("id", orderId);
    }
  }

  return { confirmed: true, reason: "newly_confirmed", payment_id: paymentId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // Webhook bypass: when called by asaas-webhook with the service-role key
    // and the x-webhook-bypass header, skip user auth/ownership checks.
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = getServiceRoleKey();
    const isWebhookBypass =
      req.headers.get("x-webhook-bypass") === "asaas" &&
      serviceKey.length > 0 &&
      token === serviceKey;

    let userId: string | null = null;
    let userClient: any;
    if (isWebhookBypass) {
      userClient = createClient((Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!, serviceKey);
    } else {
      userClient = createClient(
        (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
        (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      userId = userData.user.id;
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: "order_id inválido" }, 400);
    }

    // Verify ownership and current status
    const { data: ord } = await userClient
      .from("orders")
      .select("id, client_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (!ord) return json({ error: "Pedido não encontrado" }, 404);
    if (!isWebhookBypass && ord.client_id !== userId) return json({ error: "Sem permissão" }, 403);
    // When called by the asaas-webhook, the order may already be in "pendente"
    // (the webhook updates status before delegating here). We MUST still run
    // the split/transfer logic — confirmAndSplit is idempotent and skips the
    // status transition when already moved. Only short-circuit for end states.
    if (!isWebhookBypass && ord.status !== "aguardando_pagamento") {
      // For cancelled/refused orders, confirmed must be false so the UI doesn't lie.
      const failedStatuses = new Set(["cancelado", "recusado", "cancelled", "refused"]);
      const isFailed = failedStatuses.has(String(ord.status));
      return json({ confirmed: !isFailed, status: ord.status, reason: isFailed ? "failed" : "already_processed" });
    }
    if (isWebhookBypass) {
      const terminalStatuses = new Set(["cancelado", "recusado", "cancelled", "refused"]);
      if (terminalStatuses.has(String(ord.status))) {
        return json({ confirmed: false, status: ord.status, reason: "failed" });
      }
    }

    // Query Asaas by externalReference
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) return json({ confirmed: false, reason: "no_provider" });

    const baseUrl = apiKey.startsWith("$aact_prod_")
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    const searchRes = await fetch(`${baseUrl}/payments?externalReference=${orderId}&limit=10`, {
      headers: { "access_token": apiKey },
    });

    if (!searchRes.ok) {
      const txt = await searchRes.text();
      console.error("[confirm-order-payment] asaas search failed", searchRes.status, txt);
      return json({ confirmed: false, reason: "asaas_search_failed" });
    }

    const searchData = await searchRes.json();
    const payments: any[] = Array.isArray(searchData?.data) ? searchData.data : [];
    const paid = payments.find((p) => p?.status === "RECEIVED" || p?.status === "CONFIRMED" || p?.status === "RECEIVED_IN_CASH");

    if (!paid) {
      return json({ confirmed: false, reason: "not_paid_yet", checked: payments.length });
    }

    // Use service role to bypass RLS for the split logic
    const adminClient = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      getServiceRoleKey(),
    );

    const result = await confirmAndSplit(adminClient, orderId, paid.id);
    return json(result);
  } catch (err) {
    console.error("[confirm-order-payment] exception:", err);
    return json({ error: "Erro interno" }, 500);
  }
});