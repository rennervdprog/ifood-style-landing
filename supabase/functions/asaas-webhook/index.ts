import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Asaas webhook payload schema
const WebhookSchema = z.object({
  event: z.string(),
  payment: z.object({
    id: z.string(),
    status: z.string(),
    value: z.number().optional(),
    externalReference: z.string().optional().nullable(),
    billingType: z.string().optional(),
  }).optional(),
}).passthrough();

const TransferAuthorizationSchema = z.object({
  type: z.string(),
  transfer: z.object({
    id: z.string().optional(),
    status: z.string().optional(),
    value: z.number().optional(),
    operationType: z.string().optional(),
    description: z.string().optional().nullable(),
  }).passthrough().optional(),
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const wId = crypto.randomUUID().slice(0, 8);
    console.log(`[ASAAS-WH ${wId}] ▶️ ${req.method} body_len=${rawBody.length}`);

    // Validate the webhook token from Asaas
    const asaasToken = req.headers.get("asaas-access-token");
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const apiKey = Deno.env.get("ASAAS_API_KEY");

    // Validate using dedicated webhook token or API key
    const expectedToken = webhookToken || apiKey;

    if (!expectedToken) {
      console.error(`[ASAAS-WH ${wId}] ❌ ASAAS_WEBHOOK_TOKEN/ASAAS_API_KEY not configured`);
      return json({ error: "Not configured" }, 500);
    }

    // SECURITY: Require token header on ALL requests, not just when present
    if (!asaasToken || asaasToken !== expectedToken) {
      console.warn(`[ASAAS-WH ${wId}] ❌ Token inválido (recebido=${asaasToken ? asaasToken.slice(0,6)+"..." : "MISSING"} esperado_prefix=${expectedToken.slice(0,6)}...)`);
      return json({ error: "Unauthorized" }, 401);
    }

    const payload = JSON.parse(rawBody);
    const transferAuth = TransferAuthorizationSchema.safeParse(payload);
    if (transferAuth.success && transferAuth.data.type === "TRANSFER") {
      const transfer = transferAuth.data.transfer;
      const value = Number(transfer?.value ?? 0);
      const description = String(transfer?.description || "");
      const transferId = transfer?.id || "unknown";

      // Service-role client for review-queue inserts (no RLS bypass needed otherwise)
      const reviewClient = createClient(
        Deno.env.get("EXTERNAL_SUPABASE_URL")!,
        Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!
      );

      // SECURITY: only auto-approve transfers that match our system's payout pattern
      // and stay below a hard ceiling. Anything else goes to manual review.
      const MAX_AUTO_APPROVE = 5000; // R$5.000
      // System-generated descriptions:
      //   "Repasse pedido #<8 hex> - <store name>"
      //   "Saque SK-XXXX ..." (driver withdrawals)
      //   "Plano ..." / "Comissão ..." (platform charges to subaccounts)
      const allowedDescriptionRe = /^(Repasse pedido #[0-9a-f]{8}\b|Saque SK-\d{3,}\b|Plano\b|Comiss[aã]o\b)/i;

      const overCeiling = value > MAX_AUTO_APPROVE;
      const badDescription = !allowedDescriptionRe.test(description);

      if (overCeiling || badDescription) {
        const reason = overCeiling
          ? `value_above_ceiling (R$${value} > R$${MAX_AUTO_APPROVE})`
          : `description_does_not_match_system_pattern`;
        console.warn(`[ASAAS-WH ${wId}] ⚠️ TRANSFER pendente de revisão manual transfer_id=${transferId} value=${value} desc="${description}" reason=${reason}`);
        try {
          await reviewClient.from("asaas_transfer_review_queue").insert({
            transfer_id: transferId,
            value,
            description,
            reason,
            payload,
            status: "pending",
          });
        } catch (e) {
          console.error(`[ASAAS-WH ${wId}] could not enqueue review:`, e);
        }
        // Reject the authorization — Asaas will hold the transfer.
        return json({ status: "REJECTED", reason: "manual_review_required" }, 200);
      }

      console.log(`[ASAAS-WH ${wId}] ✅ TRANSFER auto-aprovado transfer_id=${transferId} value=${value} desc="${description}"`);
      return json({ status: "APPROVED" });
    }

    const parsed = WebhookSchema.safeParse(payload);
    if (!parsed.success) {
      console.error(`[ASAAS-WH ${wId}] ❌ Payload inválido:`, JSON.stringify(parsed.error.flatten()));
      return json({ error: "Invalid payload" }, 400);
    }

    const { event, payment } = parsed.data;
    console.log(`[ASAAS-WH ${wId}] 📨 event=${event} payment_id=${payment?.id} status=${payment?.status} ext_ref=${payment?.externalReference} value=${payment?.value}`);

    // Only process payment events
    if (!event.startsWith("PAYMENT_") || !payment) {
      return json({ received: true });
    }

    const paymentId = payment.id;
    const externalReference = payment.externalReference;

    if (!externalReference) {
      console.log("No external reference, skipping");
      return json({ received: true });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!
    );

    // ── IDEMPOTENCY GUARD ──────────────────────────────────────────────
    // Asaas can re-deliver the same event. Use a unique (payment_id, event)
    // row as a lock: the INSERT only succeeds the first time; on a retry
    // it fails with a 23505 (unique_violation) and we short-circuit.
    {
      const { error: idemErr } = await supabase
        .from("asaas_webhook_events")
        .insert({
          payment_id: paymentId,
          event,
          external_reference: externalReference,
          payload,
        });
      if (idemErr) {
        // Postgres unique_violation → already processed
        // (other errors should not block the response either, but we log)
        if ((idemErr as any).code === "23505") {
          console.log(`[ASAAS-WH ${wId}] ⏭️ duplicate event payment_id=${paymentId} event=${event} — skipping`);
          return json({ received: true, duplicate: true });
        }
        console.warn(`[ASAAS-WH ${wId}] could not record idempotency row:`, idemErr);
      }
    }

    // Determine if this is an order payment or a financial transaction
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalReference);

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      if (isUuid) {
        // This is an order payment
        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("id, status, store_id, subtotal, delivery_fee, payment_method, asaas_split_native, store_payout_id")
          .eq("id", externalReference)
          .single();

        if (fetchError || !order) {
          console.error("Order not found:", externalReference, fetchError);
          return json({ error: "Order not found" }, 404);
        }

        // Status update — only first time
        if (order.status === "aguardando_pagamento") {
          const { error: updateError } = await supabase
            .from("orders")
            .update({
              status: "pendente" as any,
              confirmed_at: new Date().toISOString(),
            })
            .eq("id", externalReference)
            .eq("status", "aguardando_pagamento" as any); // race-safe transition
          if (updateError) {
            console.error("Error updating order:", updateError);
          } else {
            console.log(`Order ${externalReference} payment confirmed via Asaas, status → pendente`);
          }
        } else {
          console.log(`Order ${externalReference} status=${order.status} (already past aguardando_pagamento) — will still attempt payout if pending`);
        }

        // ── SPLIT-NATIVO GUARD ──
        // If the PIX charge was created with Asaas' native `split` array,
        // the platform's share is already routed by Asaas. We MUST NOT also
        // send a manual /transfers — that would pay the store twice.
        if ((order as any).asaas_split_native === true) {
          console.log(`[ASAAS-WH ${wId}] order ${externalReference} used native split — skipping manual transfer & commission accrual`);
          return json({ received: true, native_split: true });
        }

        if ((order as any).store_payout_id) {
          console.log(`Order ${externalReference} already split (transfer ${(order as any).store_payout_id}) — skipping`);
          return json({ received: true, already_processed: true, split_already_done: true });
        }

        // ── OPTIMISTIC LOCK ──
        // Reserve the payout slot before calling Asaas. If another worker
        // (or the polling endpoint) wins the race, our UPDATE affects 0
        // rows and we bail out without firing /transfers.
        const lockSentinel = `LOCK:${wId}:${Date.now()}`;
        const { data: lockRows, error: lockErr } = await supabase
          .from("orders")
          .update({ store_payout_id: lockSentinel })
          .eq("id", externalReference)
          .is("store_payout_id", null)
          .select("id");
        if (lockErr) {
          console.error(`[ASAAS-WH ${wId}] payout lock error:`, lockErr);
          return json({ received: true, lock_error: true });
        }
        if (!lockRows || lockRows.length === 0) {
          console.log(`[ASAAS-WH ${wId}] payout already locked/processed for order ${externalReference} — skipping`);
          return json({ received: true, already_locked: true });
        }

        // ── Auto-transfer store share to owner's PIX key ──
        if (order.store_id && order.subtotal) {
          const subtotal = Number(order.subtotal) || 0;
          const deliveryFee = Number(order.delivery_fee) || 0;

          // Get store info + owner PIX key
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
            // "fixed" = Essencial | "supporter" = Apoiador — ambos pagam PIX R$1,99, 0% comissão
            const isFixedPlan = storePlan?.plan_type === "fixed" || storePlan?.plan_type === "supporter";
            const isOwnDelivery = store.delivery_mode === "own";

            // Read delivery fee config for PIX operational fee and platform split
            let pixOpFee = 1.99;
            let platformSplit = 2;
            try {
              const { data: feeConfigRow } = await supabase
                .from("admin_settings")
                .select("value")
                .eq("key", "delivery_fee_config")
                .maybeSingle();
              if (feeConfigRow?.value) {
                const fc = feeConfigRow.value as any;
                pixOpFee = fc.pix_operational_fee ?? 1.99;
                platformSplit = fc.platform_split ?? 2;
              }
            } catch (e) {
              console.warn("Could not load delivery_fee_config, using defaults", e);
            }

            // VIP overrides per store (null = use global; numeric = use override, including 0)
            const pixOverride = (storePlan as any)?.pix_operational_fee_override;
            const splitOverride = (storePlan as any)?.platform_delivery_split_override;
            if (pixOverride !== null && pixOverride !== undefined) {
              pixOpFee = Number(pixOverride);
              console.log(`[Asaas VIP] Store ${order.store_id} pix_operational_fee override: R$${pixOpFee}`);
            }
            if (splitOverride !== null && splitOverride !== undefined) {
              platformSplit = Number(splitOverride);
              console.log(`[Asaas VIP] Store ${order.store_id} platform_split override: R$${platformSplit}`);
            }

            let storeShare = 0;
            let commissionAmount = 0;

            if (isFixedPlan) {
              // Fixed plan: 0% commission, PIX operational fee + platform split on delivery
              if (isOwnDelivery) {
                // Deduct R$1 pix fee from subtotal + deduct R$2 platform split from delivery fee
                const deliveryAfterSplit = Math.max(0, deliveryFee - platformSplit);
                storeShare = Math.round((subtotal - pixOpFee + deliveryAfterSplit) * 100) / 100;
                console.log(`[Asaas] Fixed+OwnDelivery: subtotal=${subtotal}, pixOpFee=${pixOpFee}, deliveryFee=${deliveryFee}, platformSplit=${platformSplit}, storeShare=${storeShare}`);
              } else {
                storeShare = Math.round((subtotal - pixOpFee) * 100) / 100;
              }
              commissionAmount = 0;
            } else {
              // Commission-based plans
              const rate = (storePlan?.commission_rate ?? store.commission_rate ?? 6) / 100;
              commissionAmount = Math.round(subtotal * rate * 100) / 100;
              if (isOwnDelivery) {
                // R$2 plataforma é descontado do deliveryFee em todos os planos
                const deliveryAfterPlatformSplit = Math.max(0, deliveryFee - platformSplit);
                storeShare = Math.round((subtotal * (1 - rate) + deliveryAfterPlatformSplit) * 100) / 100;
              } else {
                storeShare = Math.round(subtotal * (1 - rate) * 100) / 100;
              }
            }

            // Ensure store share is positive
            if (storeShare < 0) storeShare = 0;

            // Transfer store share via Asaas
            if (storeShare > 0) {
              const apiKey = Deno.env.get("ASAAS_API_KEY");
              if (!apiKey) {
                // No API key — release lock so a manual replay can fix it later
                await supabase.from("orders").update({
                  store_payout_id: null,
                  store_payout_error: "asaas_api_key_missing",
                }).eq("id", externalReference);
              } else {
                const baseUrl = apiKey.startsWith("$aact_")
                  ? "https://api.asaas.com/v3"
                  : "https://sandbox.asaas.com/api/v3";

                const pixTypeMap: Record<string, string> = {
                  cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", phone: "PHONE", random: "EVP",
                };

                // Sanitize PIX key for Asaas API requirements
                const sanitizePix = (key: string, type: string): string => {
                  const raw = (key || "").trim();
                  switch ((type || "random").toLowerCase()) {
                    case "cpf":
                    case "cnpj":
                      return raw.replace(/\D/g, "");
                    case "phone": {
                      const digits = raw.replace(/\D/g, "");
                      // Asaas espera formato E.164: +5514991624997
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

                const transferBody = {
                  value: storeShare,
                  operationType: "PIX",
                  pixAddressKey: sanitizePix(ownerProfile.pix_key, ownerProfile.pix_type || "random"),
                  pixAddressKeyType: pixTypeMap[ownerProfile.pix_type || "random"] || "EVP",
                  description: `Repasse pedido #${externalReference.substring(0, 8)} - ${store.name}`.substring(0, 140),
                };

                try {
                  const transferRes = await fetch(`${baseUrl}/transfers`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "access_token": apiKey,
                    },
                    body: JSON.stringify(transferBody),
                  });

                  const transferData = await transferRes.json();
                  if (transferRes.ok) {
                    console.log(`Auto-transfer R$${storeShare} to ${store.name} (PIX: ${ownerProfile.pix_key}) — transfer ID: ${transferData.id}`);
                    await supabase.from("orders").update({
                      store_payout_id: transferData.id,
                      store_payout_at: new Date().toISOString(),
                      store_payout_error: null,
                    }).eq("id", externalReference);
                  } else {
                    console.error(`Auto-transfer failed for ${store.name}:`, JSON.stringify(transferData));
                    // Release the lock so a future retry / manual replay can re-attempt
                    await supabase.from("orders").update({
                      store_payout_id: null,
                      store_payout_error: JSON.stringify(transferData).substring(0, 500),
                    }).eq("id", externalReference);
                  }
                } catch (transferErr) {
                  console.error(`Auto-transfer exception for ${store.name}:`, transferErr);
                  await supabase.from("orders").update({
                    store_payout_id: null,
                    store_payout_error: String(transferErr).substring(0, 500),
                  }).eq("id", externalReference);
                }
              }
            } else {
              // No money to transfer — release the lock immediately
              await supabase.from("orders").update({
                store_payout_id: null,
              }).eq("id", externalReference);
            }

            // Track commission for commission-based plans
            if (commissionAmount > 0) {
              const { data: existing } = await supabase
                .from("store_balances")
                .select("comissao_pendente, pending_commission")
                .eq("store_id", order.store_id)
                .single();

              if (existing) {
                await supabase
                  .from("store_balances")
                  .update({
                    comissao_pendente: Number(existing.comissao_pendente || 0) + commissionAmount,
                    pending_commission: Number(existing.pending_commission || 0) + commissionAmount,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("store_id", order.store_id);
              } else {
                await supabase.from("store_balances").insert({
                  store_id: order.store_id,
                  comissao_pendente: commissionAmount,
                  pending_commission: commissionAmount,
                  updated_at: new Date().toISOString(),
                });
              }
              console.log(`Commission R$${commissionAmount} tracked for store ${order.store_id}`);
            }
          } else {
            console.warn(`Store ${order.store_id} owner has no PIX key, skipping auto-transfer`);
            // Release the lock — no transfer attempted, so future runs can retry once PIX is configured
            await supabase.from("orders").update({
              store_payout_id: null,
              store_payout_error: "owner_pix_key_missing",
            }).eq("id", externalReference);
          }
        }
      } else {
        // This is a financial transaction (commission charge, platform fee, subscription, monthly billing, etc.)
        const isPlatformFee = externalReference.startsWith("TAXA-");
        const isSubscription = externalReference.startsWith("#ASSIN-");
        const isMonthlyBilling = externalReference.startsWith("#MENS-");

        const { data: txData, error: txError } = await supabase
          .from("financial_transactions")
          .update({
            status: "paid",
            settled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            mercado_pago_payment_id: paymentId,
          })
          .eq("reference_code", externalReference)
          .eq("status", "pending")
          .select("store_id, transaction_kind, amount, metadata")
          .maybeSingle();

        if (txError) {
          console.error("Error updating financial transaction:", txError);
        } else {
          console.log(`Financial transaction ${externalReference} confirmed via Asaas`);

          if ((isSubscription || isMonthlyBilling) && txData?.store_id) {
            // Plan subscription paid — clear trial, set billing dates based on payment date
            const now = new Date();
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            await supabase
              .from("store_plans")
              .update({
                trial_ends_at: null,
                last_billed_at: now.toISOString(),
                next_billing_date: nextMonth.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq("store_id", txData.store_id)
              .eq("is_active", true);

            console.log(`Store ${txData.store_id} ${isMonthlyBilling ? "monthly fee" : "subscription"} paid, next billing: ${nextMonth.toISOString()}`);

            // Reactivate store if blocked for late fee
            await supabase
              .from("stores")
              .update({ status: "ativo" })
              .eq("id", txData.store_id)
              .eq("status", "bloqueado");

            // Resolve any open monthly_fee_overdue alert
            await supabase
              .from("compliance_alerts")
              .update({ is_resolved: true, resolved_at: new Date().toISOString() })
              .eq("store_id", txData.store_id)
              .eq("alert_type", "monthly_fee_overdue")
              .eq("is_resolved", false);
          } else if (isPlatformFee && txData?.store_id) {
            // Platform fee paid — subtract paid amount from repasse_pendente (avoid losing accruals
            // that occurred between charge generation and payment confirmation)
            const paidAmount = Number(txData.amount) || 0;
            const { data: balRow } = await supabase
              .from("store_balances")
              .select("repasse_pendente")
              .eq("store_id", txData.store_id)
              .single();

            const currentPending = Number(balRow?.repasse_pendente || 0);
            const newPending = Math.max(0, currentPending - paidAmount);

            await supabase
              .from("store_balances")
              .update({ repasse_pendente: newPending, updated_at: new Date().toISOString() })
              .eq("store_id", txData.store_id);

            // Reactivate store if blocked
            await supabase
              .from("stores")
              .update({ status: "ativo" })
              .eq("id", txData.store_id)
              .eq("status", "bloqueado");

            // Resolve any open repasse_overdue alert
            await supabase
              .from("compliance_alerts")
              .update({ is_resolved: true, resolved_at: new Date().toISOString() })
              .eq("store_id", txData.store_id)
              .eq("alert_type", "repasse_overdue")
              .eq("is_resolved", false);

            console.log(`Store ${txData.store_id} platform fee R$${paidAmount} paid; repasse_pendente: ${currentPending} -> ${newPending}`);
          } else if (txData?.transaction_kind === "commission_charge" && txData.store_id) {
            // Commission charge paid
            const paidAmount = Number(txData.amount) || 0;

            const { data: balance } = await supabase
              .from("store_balances")
              .select("comissao_pendente")
              .eq("store_id", txData.store_id)
              .single();

            if (balance) {
              const newPending = Math.max(0, Number(balance.comissao_pendente) - paidAmount);
              await supabase
                .from("store_balances")
                .update({
                  comissao_pendente: newPending,
                  pending_commission: newPending,
                  updated_at: new Date().toISOString(),
                })
                .eq("store_id", txData.store_id);
            }

            // Reactivate store if it was blocked
            const { error: reactivateError } = await supabase
              .from("stores")
              .update({ status: "ativo" })
              .eq("id", txData.store_id)
              .eq("status", "bloqueado");

            if (!reactivateError) {
              console.log(`Store ${txData.store_id} reactivated after commission payment`);

              await supabase
                .from("compliance_alerts")
                .update({ is_resolved: true, resolved_at: new Date().toISOString() })
                .eq("store_id", txData.store_id)
                .eq("alert_type", "commission_overdue")
                .eq("is_resolved", false);
            }
          }
        }
      }
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      // Payment failed/cancelled
      if (isUuid) {
        // 🔒 BUG FIX: PIX vencido/deletado cancela o pedido automaticamente
        // Antes apenas logava — pedido ficava preso em 'aguardando_pagamento' para sempre
        const { data: order } = await supabase
          .from("orders")
          .select("id, status")
          .eq("id", externalReference)
          .single();

        if (order && order.status === "aguardando_pagamento") {
          await supabase
            .from("orders")
            .update({
              status: "cancelado" as any,
            })
            .eq("id", externalReference)
            .eq("status", "aguardando_pagamento" as any); // race-safe: só cancela se ainda aguardando

          console.log(`[ASAAS-WH] Order ${externalReference} cancelled due to ${event}`);
        } else {
          console.log(`[ASAAS-WH] Order ${externalReference} ${event} — status=${order?.status || "not found"}, no action needed`);
        }
      } else {
        // Transação financeira (mensalidade, comissão) — marca como falha
        await supabase
          .from("financial_transactions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("reference_code", externalReference)
          .eq("status", "pending");
        console.log(`Financial transaction ${externalReference} marked as failed (${event})`);
      }
    }

    return json({ received: true });
  } catch (err) {
    console.error("Asaas webhook error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
