import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

// Endpoint exclusivo de homologação. Nunca usa a Woovi de produção e só aceita loja is_test.
const WOOVI_SANDBOX_API = "https://api.woovi-sandbox.com";
const MIN_CHARGE_AMOUNT = 150;
const BLOCK_THRESHOLD = 500;
const RESERVATION_LEASE_SECONDS = 300;
const BodySchema = z.object({
  store_id: z.string().uuid(),
  expires_in_seconds: z.number().int().min(300).max(3600).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-woovi-sandbox-secret",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function weeklyCycleKey(now = new Date()): string {
  // A chave permanece igual do início da segunda-feira até o domingo seguinte,
  // no fuso operacional. Assim, cron, retry e chamadas simultâneas representam
  // uma única cobrança lógica por loja/ciclo.
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const daysSinceMonday = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - daysSinceMonday);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `weekly_delivery_fee_sandbox:${year}-${month}-${day}`;
}

async function loadFinalizedTransaction(supabase: any, transactionId: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, reference_code, amount, status, mercado_pago_payment_id, pix_copy_paste")
    .eq("id", transactionId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível carregar cobrança reservada: ${error.message}`);
  return data;
}

async function findWooviSandboxCharge(appId: string, correlationID: string): Promise<{
  found: boolean;
  charge?: any;
  retryableError?: string;
}> {
  try {
    const response = await fetch(`${WOOVI_SANDBOX_API}/api/v1/charge/${encodeURIComponent(correlationID)}`, {
      headers: { Authorization: appId },
    });
    if (response.status === 404) return { found: false };
    const payload = await response.json().catch(() => ({}));
    const errorText = String(payload?.error || payload?.message || "");
    if (response.status === 400 && /not[ _-]?found|não encontrado|nao encontrado/i.test(errorText)) {
      return { found: false };
    }
    if (!response.ok || payload?.error) {
      return { found: false, retryableError: `Consulta Woovi HTTP ${response.status}` };
    }
    return { found: true, charge: payload?.charge || payload };
  } catch (error) {
    return { found: false, retryableError: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const e2eSecret = Deno.env.get("WOOVI_SANDBOX_E2E_SECRET") || "";
  if (!e2eSecret || req.headers.get("x-woovi-sandbox-secret") !== e2eSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  const sandboxAppId = Deno.env.get("WOOVI_SANDBOX_APP_ID") || "";
  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
    || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!sandboxAppId || !externalUrl || !serviceKey) return json({ error: "Configuração sandbox ausente" }, 500);

  let input: z.infer<typeof BodySchema>;
  try { input = BodySchema.parse(await req.json()); }
  catch (error) { return json({ error: "Payload inválido", detail: String(error) }, 400); }

  const supabase = createClient(externalUrl, serviceKey);
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, owner_id, status, is_test")
    .eq("id", input.store_id)
    .maybeSingle();
  if (!store?.is_test) return json({ error: "Somente loja de teste pode usar o sandbox" }, 403);
  if (store.status !== "ativo") return json({ error: "A loja sandbox precisa estar ativa" }, 409);

  const [{ data: plan }, { data: balance }] = await Promise.all([
    supabase.from("store_plans")
      .select("id, plan_type, pdv_commission_pending")
      .eq("store_id", store.id).eq("is_active", true).maybeSingle(),
    supabase.from("store_balances")
      .select("repasse_pendente, comissao_pendente, pending_commission")
      .eq("store_id", store.id).maybeSingle(),
  ]);
  if (!plan || !balance) return json({ error: "Plano ou saldo de teste não encontrado" }, 400);

  const repasse = Number(balance.repasse_pendente || 0);
  const comissao = Number(balance.comissao_pendente || balance.pending_commission || 0);
  const pdvPending = Number(plan.pdv_commission_pending || 0);
  let baseAmount = 0;
  if (plan.plan_type === "fixed" || plan.plan_type === "supporter") baseAmount = repasse;
  else if (plan.plan_type === "hybrid") baseAmount = repasse + comissao;
  else if (plan.plan_type === "commission_only") baseAmount = comissao;
  const totalAmount = Number((baseAmount + pdvPending).toFixed(2));

  if (totalAmount < MIN_CHARGE_AMOUNT) {
    return json({ error: "Saldo abaixo do mínimo semanal", minimum: MIN_CHARGE_AMOUNT, amount: totalAmount }, 409);
  }
  if (totalAmount >= BLOCK_THRESHOLD) {
    await supabase.from("stores").update({
      status: "bloqueado", billing_blocked_at: new Date().toISOString(), billing_block_reason: "threshold",
    }).eq("id", store.id).eq("is_test", true).eq("status", "ativo");
    return json({ ok: true, environment: "sandbox", status: "blocked", amount: totalAmount, threshold: BLOCK_THRESHOLD });
  }

  // Mantém compatibilidade com cobranças pendentes anteriores à migration.
  const { data: pending } = await supabase
    .from("financial_transactions")
    .select("id, reference_code, amount, mercado_pago_payment_id, pix_copy_paste, created_at")
    .eq("store_id", store.id).eq("transaction_kind", "commission_charge")
    .eq("status", "pending").eq("provider", "woovi_sandbox")
    .like("reference_code", "#REP-SBX-%").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (pending) {
    const ageInDays = (Date.now() - new Date(pending.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 30) {
      await supabase.from("stores").update({
        status: "bloqueado", billing_blocked_at: new Date().toISOString(), billing_block_reason: "overdue",
      }).eq("id", store.id).eq("is_test", true).eq("status", "ativo");
      return json({ ok: true, environment: "sandbox", status: "blocked", reason: "overdue", days_pending: Math.floor(ageInDays) });
    }
    return json({ ok: true, environment: "sandbox", reused: true, transaction: pending });
  }

  const chargeFamily = "weekly_delivery_fee_sandbox";
  const idempotencyKey = `${chargeFamily}:${store.id}:${weeklyCycleKey()}`;
  const referenceCandidate = `#REP-SBX-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const expiresIn = input.expires_in_seconds ?? 900;
  const reservationMetadata = {
    sandbox: true,
    charge_family: chargeFamily,
    plan_type: plan.plan_type,
    repasse_pendente: repasse,
    comissao_pendente: comissao,
    balance_billed: baseAmount,
    pdv_pending_billed: pdvPending,
    expires_in_seconds: expiresIn,
    woovi_environment: "TESTING",
    idempotency_key: idempotencyKey,
  };

  const { data: reservationData, error: reservationError } = await supabase
    .rpc("reserve_commission_charge_reservation", {
      _store_id: store.id,
      _idempotency_key: idempotencyKey,
      _reference_code: referenceCandidate,
      _amount: totalAmount,
      _charge_family: chargeFamily,
      _provider: "woovi_sandbox",
      _metadata: reservationMetadata,
    })
    .maybeSingle();
  if (reservationError || !reservationData) {
    console.error("[woovi-sandbox-weekly-repasse] reserve error", reservationError);
    return json({ error: "Falha ao reservar cobrança semanal sandbox" }, 500);
  }
  const reservation: any = reservationData;

  if (reservation.transaction_id) {
    const transaction = await loadFinalizedTransaction(supabase, reservation.transaction_id);
    return json({ ok: true, environment: "sandbox", reused: true, transaction });
  }

  const { data: claimData, error: claimError } = await supabase
    .rpc("claim_commission_charge_reservation", {
      _reservation_id: reservation.reservation_id,
      _lease_seconds: RESERVATION_LEASE_SECONDS,
    })
    .maybeSingle();
  if (claimError || !claimData) {
    console.error("[woovi-sandbox-weekly-repasse] claim error", claimError);
    return json({ error: "Falha ao adquirir reserva semanal sandbox" }, 500);
  }
  const claim: any = claimData;

  if (claim.finalized && claim.transaction_id) {
    const transaction = await loadFinalizedTransaction(supabase, claim.transaction_id);
    return json({ ok: true, environment: "sandbox", reused: true, transaction });
  }
  if (!claim.acquired) {
    return json({
      ok: true,
      environment: "sandbox",
      processing: true,
      reused: true,
      reference_code: claim.reference_code,
      retry_after_seconds: RESERVATION_LEASE_SECONDS,
    }, 202);
  }

  const referenceCode = String(claim.reference_code);
  let charge: any = null;

  // A primeira emissão não depende do escopo de consulta da provedora. Em um
  // retry, consulta a mesma referência antes de qualquer novo POST. Se a App
  // ID não puder consultar, preserva a reserva para reconciliação sem risco de
  // criar um PIX duplicado.
  if (!reservation.created_new) {
    const existingLookup = await findWooviSandboxCharge(sandboxAppId, referenceCode);
    if (existingLookup.retryableError) {
      console.warn("[woovi-sandbox-weekly-repasse] lookup indisponível", existingLookup.retryableError);
      return json({
        ok: true,
        environment: "sandbox",
        processing: true,
        reused: true,
        reference_code: referenceCode,
        reason: "Aguardando reconciliação segura da cobrança existente",
      }, 202);
    }
    charge = existingLookup.charge || null;
  }

  if (!charge) {
    const { data: owner } = await supabase
      .from("profiles").select("full_name, email, document").eq("user_id", store.owner_id).maybeSingle();
    const taxId = String(owner?.document || "").replace(/\D/g, "");
    const description = `HOMOLOGACAO SANDBOX - repasse semanal ${store.name} - ${referenceCode}`.slice(0, 140);

    let response: Response;
    try {
      response = await fetch(`${WOOVI_SANDBOX_API}/api/v1/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: sandboxAppId },
        body: JSON.stringify({
          correlationID: referenceCode,
          value: Math.round(Number(claim.amount) * 100),
          comment: description,
          expiresIn,
          customer: {
            name: owner?.full_name || store.name,
            email: owner?.email || `sandbox-${store.id.slice(0, 8)}@itasuper.test`,
            ...(taxId.length === 11 || taxId.length === 14
              ? { taxID: { taxID: taxId, type: taxId.length === 11 ? "BR:CPF" : "BR:CNPJ" } }
              : {}),
          },
        }),
      });
    } catch (error) {
      console.error("[woovi-sandbox-weekly-repasse] transport error", error);
      return json({ error: "Falha temporária ao criar cobrança semanal sandbox" }, 502);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      await supabase.rpc("release_commission_charge_reservation", {
        _reservation_id: reservation.reservation_id,
        _reason: `Provedora respondeu HTTP ${response.status}`,
      });
      console.error("[woovi-sandbox-weekly-repasse] charge error", response.status, payload);
      return json({ error: "Falha ao criar cobrança semanal sandbox", provider_status: response.status }, 502);
    }
    charge = payload?.charge || payload;
  }

  const chargeId = String(charge?.identifier || charge?.paymentMethods?.pix?.identifier || "");
  const brCode = String(charge?.brCode || charge?.paymentMethods?.pix?.brCode || "");
  if (!chargeId || !brCode) {
    // Resposta incompleta pode representar sucesso remoto parcial: conserva a
    // reserva em issuing para que o retry idempotente reconcilie a mesma chave.
    return json({ error: "Resposta sandbox sem identificador ou PIX" }, 502);
  }

  const { data: finalizedData, error: finalizeError } = await supabase
    .rpc("finalize_commission_charge_reservation", {
      _reservation_id: reservation.reservation_id,
      _provider: "woovi_sandbox",
      _provider_payment_id: chargeId,
      _pix_qr_code: brCode,
      _pix_qr_code_base64: charge?.brCodeBase64 || "",
      _pix_copy_paste: brCode,
      _metadata: { woovi_charge_id: chargeId },
    })
    .maybeSingle();
  if (finalizeError || !finalizedData) {
    // Não libera: a cobrança remota pode existir. O retry reutiliza o mesmo
    // correlationID e conclui a finalização sem duplicar o PIX.
    console.error("[woovi-sandbox-weekly-repasse] finalize error", finalizeError);
    return json({ error: "Cobrança sandbox emitida; finalização pendente de reconciliação" }, 502);
  }
  const transaction: any = finalizedData;

  return json({
    ok: true,
    environment: "sandbox",
    transaction: {
      id: transaction.transaction_id,
      reference_code: transaction.reference_code,
      amount: transaction.amount,
      status: transaction.status,
      mercado_pago_payment_id: transaction.provider_payment_id,
    },
    charge: { identifier: chargeId, correlation_id: referenceCode, expires_in_seconds: expiresIn, br_code: brCode },
  });
});
