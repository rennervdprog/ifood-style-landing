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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Validate the webhook token from Asaas
    const asaasToken = req.headers.get("asaas-access-token");
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const apiKey = Deno.env.get("ASAAS_API_KEY");

    // Validate using dedicated webhook token or API key
    const expectedToken = webhookToken || apiKey;

    if (!expectedToken) {
      console.error("ASAAS_WEBHOOK_TOKEN/ASAAS_API_KEY not configured");
      return json({ error: "Not configured" }, 500);
    }

    // SECURITY: Require token header on ALL requests, not just when present
    if (!asaasToken || asaasToken !== expectedToken) {
      console.warn("Missing or invalid Asaas webhook token — rejecting request");
      return json({ error: "Unauthorized" }, 401);
    }

    const parsed = WebhookSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      console.error("Invalid webhook payload:", parsed.error.flatten());
      return json({ error: "Invalid payload" }, 400);
    }

    const { event, payment } = parsed.data;
    console.log("Asaas webhook received:", JSON.stringify({ event, payment_id: payment?.id, status: payment?.status }));

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
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine if this is an order payment or a financial transaction
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalReference);

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      if (isUuid) {
        // This is an order payment
        const { data: order, error: fetchError } = await supabase
          .from("orders")
          .select("id, status, store_id, subtotal, delivery_fee, payment_method")
          .eq("id", externalReference)
          .single();

        if (fetchError || !order) {
          console.error("Order not found:", externalReference, fetchError);
          return json({ error: "Order not found" }, 404);
        }

        // Idempotency: only update if still awaiting payment
        if (order.status !== "aguardando_pagamento") {
          console.log(`Order ${externalReference} already processed (status: ${order.status})`);
          return json({ received: true, already_processed: true });
        }

        // Payment confirmed → set to pendente
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: "pendente" as any,
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", externalReference);

        if (updateError) {
          console.error("Error updating order:", updateError);
        } else {
          console.log(`Order ${externalReference} payment confirmed via Asaas, status → pendente`);
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
            .select("plan_type, commission_rate")
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

            // Read delivery fee config for PIX operational fee
            let pixOpFee = 1;
            try {
              const { data: feeConfigRow } = await supabase
                .from("admin_settings")
                .select("value")
                .eq("key", "delivery_fee_config")
                .maybeSingle();
              if (feeConfigRow?.value) {
                const fc = feeConfigRow.value as any;
                pixOpFee = fc.pix_operational_fee ?? 1;
              }
            } catch (e) {
              console.warn("Could not load delivery_fee_config, using defaults", e);
            }

            let storeShare = 0;
            let commissionAmount = 0;

            if (isFixedPlan) {
              // Fixed plan: 0% commission, only PIX operational fee
              if (isOwnDelivery) {
                storeShare = Math.round((subtotal - pixOpFee + deliveryFee) * 100) / 100;
              } else {
                storeShare = Math.round((subtotal - pixOpFee) * 100) / 100;
              }
              commissionAmount = 0;
            } else {
              // Commission-based plans
              const rate = (storePlan?.commission_rate ?? store.commission_rate ?? 15) / 100;
              commissionAmount = Math.round(subtotal * rate * 100) / 100;
              if (isOwnDelivery) {
                storeShare = Math.round((subtotal * (1 - rate) + deliveryFee) * 100) / 100;
              } else {
                storeShare = Math.round(subtotal * (1 - rate) * 100) / 100;
              }
            }

            // Ensure store share is positive
            if (storeShare < 0) storeShare = 0;

            // Transfer store share via Asaas
            if (storeShare > 0) {
              const apiKey = Deno.env.get("ASAAS_API_KEY");
              if (apiKey) {
                const baseUrl = apiKey.startsWith("$aact_")
                  ? "https://api.asaas.com/v3"
                  : "https://sandbox.asaas.com/api/v3";

                const pixTypeMap: Record<string, string> = {
                  cpf: "CPF", cnpj: "CNPJ", email: "EMAIL", phone: "PHONE", random: "EVP",
                };

                const transferBody = {
                  value: storeShare,
                  operationType: "PIX",
                  pixAddressKey: ownerProfile.pix_key,
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
                  } else {
                    console.error(`Auto-transfer failed for ${store.name}:`, JSON.stringify(transferData));
                  }
                } catch (transferErr) {
                  console.error(`Auto-transfer exception for ${store.name}:`, transferErr);
                }
              }
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
          }
        }
      } else {
        // This is a financial transaction (commission charge, platform fee, etc.)
        const isPlatformFee = externalReference.startsWith("TAXA-");

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
          .select("store_id, transaction_kind, amount")
          .maybeSingle();

        if (txError) {
          console.error("Error updating financial transaction:", txError);
        } else {
          console.log(`Financial transaction ${externalReference} confirmed via Asaas`);

          if (isPlatformFee && txData?.store_id) {
            // Platform fee paid — clear repasse_pendente
            await supabase
              .from("store_balances")
              .update({ repasse_pendente: 0, updated_at: new Date().toISOString() })
              .eq("store_id", txData.store_id);

            console.log(`Store ${txData.store_id} platform fee R$${txData.amount} paid, repasse_pendente cleared`);
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
        console.log(`Asaas payment ${paymentId} was ${event} for order ${externalReference}`);
      } else {
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
