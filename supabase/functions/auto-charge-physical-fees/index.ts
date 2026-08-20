/**
 * auto-charge-physical-fees
 *
 * Roda por cron (ex: diariamente às 10h) ou chamada manual pelo admin.
 *
 * Para cada loja com saldo pendente de pagamentos físicos (dinheiro/cartão):
 *  - Planos fixo/apoiador: cobrar repasse_pendente (R$ 0,99 por entrega)
 *  - Plano hybrid: cobrar repasse_pendente (R$ 0,99/entrega) + comissao_pendente (2,5% físico)
 *  - Planos commission_only: cobrar comissao_pendente (% sobre vendas)
 *
 * Fluxo:
 *  1. Busca lojas com saldo pendente acima do mínimo configurado (R$ 150)
 *  2. Gera cobrança PIX via Asaas na subconta do lojista
 *  3. Salva em financial_transactions com status 'pending'
 *  4. Webhook Asaas confirma → zerará o saldo pendente
 *  5. Se não pagar em N dias → inativa a loja
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { REPASSE_POLICY, ageInDays } from "../_shared/repasse-policy.ts";

const BodySchema = z.object({
  store_id: z.string().uuid().optional(),
  dry_run: z.boolean().optional(),
}).partial();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Valores canônicos: não criar limiares ou prazos paralelos nesta função.
const MIN_CHARGE_AMOUNT = REPASSE_POLICY.MIN_AUTO_CHARGE_BRL;
const OVERDUE_DAYS_TO_BLOCK = REPASSE_POLICY.SUSPENSION_DAYS;

// ─── Woovi/OpenPix (gateway padrão) ───────────────────────────────────────────

function wooviEnabled(): boolean {
  return !!(Deno.env.get("WOOVI_APP_ID") || Deno.env.get("OPENPIX_APP_ID"));
}

/** Gateway ativo configurado no super admin (admin_settings.payment_gateway). */
async function getActiveGateway(client: any): Promise<string> {
  try {
    const { data } = await client
      .from("admin_settings")
      .select("value")
      .eq("key", "payment_gateway")
      .maybeSingle();
    const val = String((data?.value as any)?.provider || "").toUpperCase().trim();
    if (val) return val;
  } catch (_e) { /* fallback abaixo */ }
  return (Deno.env.get("ACTIVE_PAYMENT_PROVIDER") || "ASAAS").toUpperCase().trim();
}

async function createWooviCharge(params: {
  amount: number;
  description: string;
  externalId: string;
  customerName?: string;
  customerEmail?: string;
  customerCpfCnpj?: string;
}): Promise<{ ok: boolean; paymentId?: string; pixCopyPaste?: string; pixQrCode?: string; error?: string; safeToRelease?: boolean }> {
  const appId = Deno.env.get("WOOVI_APP_ID") || Deno.env.get("OPENPIX_APP_ID");
  if (!appId) return { ok: false, error: "WOOVI_APP_ID não configurado", safeToRelease: true };
  const taxId = String(params.customerCpfCnpj || "").replace(/\D/g, "");
  const body: Record<string, unknown> = {
    correlationID: params.externalId,
    value: Math.round(params.amount * 100),
    comment: String(params.description).substring(0, 140),
    expiresIn: 60 * 60 * 24 * 7,
    customer: {
      name: params.customerName || "Lojista",
      email: params.customerEmail || `lojista-${params.externalId}@itasuper.com`,
      ...(taxId.length === 11 || taxId.length === 14
        ? { taxID: { taxID: taxId, type: taxId.length === 11 ? "BR:CPF" : "BR:CNPJ" } }
        : {}),
    },
  };
  try {
    const res = await fetch("https://api.openpix.com.br/api/v1/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: appId },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.error) {
      return { ok: false, error: String(payload?.error || `Erro Woovi ${res.status}`), safeToRelease: true };
    }
    const charge = payload?.charge || payload;
    return {
      ok: true,
      paymentId: String(charge?.identifier || charge?.correlationID || params.externalId),
      pixCopyPaste: charge?.brCode || "",
      pixQrCode: "",
    };
  } catch (err) {
    // Falha de transporte pode ter ocorrido após a criação remota. Não é
    // seguro liberar a reserva: o retry deve reutilizar o correlationID.
    return { ok: false, error: String(err), safeToRelease: false };
  }
}

// ─── Gerar cobrança PIX no Asaas (fallback) ───────────────────────────────────

async function createAsaasCharge(params: {
  amount: number;
  description: string;
  dueDate: string; // YYYY-MM-DD
  storeAccountId: string;
  customerName: string;
  customerEmail: string;
  customerCpfCnpj: string;
}): Promise<{ ok: boolean; paymentId?: string; pixCopyPaste?: string; pixQrCode?: string; error?: string }> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return { ok: false, error: "ASAAS_API_KEY não configurado" };

  const baseUrl = apiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  try {
    // Cobrança do repasse cai na CONTA PRINCIPAL Asaas (super admin).
    // Não é split, não usa walletId do lojista.
    // Precisamos de um customer: buscar/criar pelo externalReference da loja.
    const customerRes = await fetch(`${baseUrl}/customers?externalReference=store_${params.storeAccountId}`, {
      headers: { "access_token": apiKey },
    });
    const customerData = await customerRes.json();
    const existing = customerData?.data?.[0];
    let customerId: string | null = existing?.id || null;
    const cpf = (params.customerCpfCnpj || "").replace(/\D/g, "");

    // Se customer existe mas sem CPF/CNPJ, atualiza antes de cobrar
    if (customerId && !existing?.cpfCnpj && cpf.length >= 11) {
      await fetch(`${baseUrl}/customers/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": apiKey },
        body: JSON.stringify({ cpfCnpj: cpf, notificationDisabled: true }),
      });
    }

    // Garante que notificações estão desativadas (evita taxa de mensageria R$ 0,99)
    if (customerId && existing?.notificationDisabled === false) {
      await fetch(`${baseUrl}/customers/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": apiKey },
        body: JSON.stringify({ notificationDisabled: true }),
      });
    }

    if (!customerId) {
      if (cpf.length < 11) {
        return { ok: false, error: "Loja sem CPF/CNPJ cadastrado — preencha no perfil do lojista." };
      }
      const createRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": apiKey },
        body: JSON.stringify({
          name: params.customerName || `Loja ${params.storeAccountId.substring(0, 8)}`,
          email: params.customerEmail || `loja-${params.storeAccountId.substring(0, 8)}@itasuper.com`,
          cpfCnpj: cpf,
          externalReference: `store_${params.storeAccountId}`,
          notificationDisabled: true,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        return { ok: false, error: created?.errors?.[0]?.description || "Erro ao criar customer" };
      }
      customerId = created.id;
    }

    const res = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
      notificationDisabled: true,
        value: params.amount,
        dueDate: params.dueDate,
        description: params.description,
        externalReference: `charge_physical_${params.storeAccountId}_${Date.now()}`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.errors?.[0]?.description || data?.message || `Erro Asaas ${res.status}`;
      return { ok: false, error: errorMsg };
    }

    // Buscar PIX QR Code
    const qrRes = await fetch(`${baseUrl}/payments/${data.id}/pixQrCode`, {
      headers: { "access_token": apiKey },
    });
    const qrData = qrRes.ok ? await qrRes.json() : {};

    return {
      ok: true,
      paymentId: data.id,
      pixCopyPaste: qrData.payload || "",
      pixQrCode: qrData.encodedImage || "",
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Bloqueio financeiro reversível ─────────────────────────────────────────

async function blockStoreForBilling(
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  reason: "threshold" | "overdue"
) {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("stores")
    .update({
      status: "bloqueado",
      billing_blocked_at: nowIso,
      billing_block_reason: reason,
    } as any)
    .eq("id", storeId)
    .eq("status", "ativo");
  if (error) throw new Error(`Erro ao bloquear loja: ${error.message}`);
}

function brasiliaWeekday(now: Date): number {
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return local.getDay();
}

function weeklyCycleKey(now: Date): string {
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const daysSinceMonday = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - daysSinceMonday);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadReservedTransaction(supabase: any, transactionId: string) {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, reference_code, amount, status, mercado_pago_payment_id, pix_copy_paste")
    .eq("id", transactionId)
    .maybeSingle();
  if (error) throw new Error(`Erro ao carregar cobrança reservada: ${error.message}`);
  return data;
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!;
    const serviceKey = (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // SECURITY: requer autenticação. Aceita service-role / CRON_SECRET para cron
    // ou um JWT de admin para chamada manual. Nunca aceitar requests anônimas.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    // Aceita o segredo privado usado pelos agendamentos externos, nunca a chave anônima.
    const cronSecret = Deno.env.get("CRON_SECRET") || Deno.env.get("EXTERNAL_CRON_SECRET") || "";
    const isService =
      !!token && (token === serviceKey || (cronSecret !== "" && token === cronSecret));

    if (!isService) {
      if (!token) return json({ error: "Unauthorized" }, 401);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: user.id });
      if (!isAdmin) return json({ error: "Apenas admins" }, 403);
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const manualStoreId = parsed.data.store_id;
    const dryRun = parsed.data.dry_run === true; // true = simula sem gerar cobranças

    const results: any[] = [];
    const now = new Date();

    // A emissão automática é semanal, na segunda-feira, em horário de Brasília.
    // A chamada manual por store_id continua disponível apenas para suporte/admin.
    if (!manualStoreId && brasiliaWeekday(now) !== REPASSE_POLICY.WEEKLY_CHARGE_WEEKDAY) {
      return json({
        success: true,
        skipped: true,
        reason: "Cobrança automática programada para segunda-feira (horário de Brasília).",
      });
    }

    // Novas cobranças de taxa de plataforma usam exclusivamente Woovi.
    const activeGateway = await getActiveGateway(supabase);
    if (activeGateway !== "WOOVI") {
      return json({ error: "payment_gateway deve estar configurado como WOOVI" }, 409);
    }
    if (!wooviEnabled()) {
      return json({ error: "WOOVI_APP_ID não configurado" }, 500);
    }

    // ── 1. Buscar lojas com saldo pendente de pagamentos físicos ──
    // store_balances.repasse_pendente = R$ 0,99/entrega (planos fixed/supporter)
    // store_balances.comissao_pendente = % sobre vendas físicas (commission_only)
    let balanceQuery = supabase
      .from("store_balances")
      .select(`
        store_id,
        repasse_pendente,
        comissao_pendente,
        stores!inner(
          id, name, status, owner_id, asaas_account_id, asaas_wallet_id,
          store_plans!inner(plan_type, is_active, commission_rate, pdv_commission_pending)
        )
      `)
      .eq("stores.status", "ativo")
      .eq("stores.store_plans.is_active", true);

    if (manualStoreId) {
      balanceQuery = balanceQuery.eq("store_id", manualStoreId);
    }

    const { data: balances, error: balErr } = await balanceQuery;
    if (balErr) throw new Error(`Erro ao buscar saldos: ${balErr.message}`);

    for (const balance of (balances || [])) {
      const store = (balance as any).stores;
      if (!store) continue;

      const plan = Array.isArray(store.store_plans) ? store.store_plans[0] : store.store_plans;
      if (!plan) continue;

      const planType = plan.plan_type;
      const repasse = Number(balance.repasse_pendente || 0);
      const comissao = Number(balance.comissao_pendente || 0);
      const pdvPending = Number(plan.pdv_commission_pending || 0);

      // Calcular valor a cobrar por tipo de plano
      let chargeAmount = 0;
      let chargeDescription = "";
      // Base (balance): repasse + comissao — depende do plano.
      let baseAmount = 0;

      if (planType === "fixed" || planType === "supporter") {
        // Cobrar repasse_pendente (taxa por entrega física acumulada)
        baseAmount = repasse;
        chargeDescription = `Taxa de entrega ItaSuper — ${store.name} (R$ ${repasse.toFixed(2).replace(".", ",")} acumulados)`;
      } else if (planType === "hybrid") {
        // Hybrid: cobrar repasse_pendente + comissao_pendente (2,5% físico)
        baseAmount = repasse + comissao;
        const parts = [];
        if (repasse > 0) parts.push(`R$${repasse.toFixed(2)} taxa entrega`);
        if (comissao > 0) parts.push(`R$${comissao.toFixed(2)} comissão (2,5%)`);
        chargeDescription = `ItaSuper — ${store.name}: ${parts.join(" + ")}`;
      } else if (planType === "commission_only") {
        // Cobrar comissao_pendente (% sobre vendas físicas)
        baseAmount = comissao;
        chargeDescription = `Comissão ItaSuper — ${store.name} (vendas em dinheiro/cartão)`;
      }

      // Soma o pendente do PDV (independente do plano). Webhook decrementa
      // via metadata.pdv_pending_billed quando o PIX é confirmado.
      chargeAmount = baseAmount + pdvPending;
      if (pdvPending > 0) {
        chargeDescription = chargeDescription
          ? `${chargeDescription} + R$${pdvPending.toFixed(2)} comissão PDV`
          : `Comissão PDV ItaSuper — ${store.name}`;
      }

      if (chargeAmount < MIN_CHARGE_AMOUNT) {
        results.push({ store: store.name, status: "skip", reason: `Saldo abaixo de R$${MIN_CHARGE_AMOUNT}` });
        continue;
      }

      // O teto de R$ 500 bloqueia novas vendas até a quitação, sem desativar o plano.
      if (chargeAmount >= REPASSE_POLICY.BLOCK_THRESHOLD_BRL) {
        if (!dryRun) await blockStoreForBilling(supabase, balance.store_id, "threshold");
        results.push({
          store: store.name,
          status: dryRun ? "would_block" : "blocked",
          reason: `Saldo pendente atingiu R$${REPASSE_POLICY.BLOCK_THRESHOLD_BRL}`,
          amount: chargeAmount,
          dry_run: dryRun,
        });
        continue;
      }

      // Buscar TODAS as cobranças em aberto: cada ciclo gera uma cobrança
      // separada (não somamos com anteriores). Precisamos subtrair o que já
      // foi cobrado para calcular o delta do ciclo atual.
      const { data: openCharges } = await supabase
        .from("financial_transactions")
        .select("id, amount, created_at")
        .eq("store_id", balance.store_id)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      const alreadyBilled = (openCharges || []).reduce(
        (sum: number, c: any) => sum + Number(c.amount || 0),
        0,
      );

      // A cobrança mais antiga sem quitação bloqueia após o prazo canônico.
      // O plano não é desativado: o webhook reativa após a quitação integral.
      const oldest = (openCharges || [])[0];
      if (oldest) {
        const daysPending = ageInDays(oldest.created_at, now);
        if (daysPending > OVERDUE_DAYS_TO_BLOCK) {
          if (!dryRun) await blockStoreForBilling(supabase, balance.store_id, "overdue");
          results.push({
            store: store.name,
            status: dryRun ? "would_block" : "blocked",
            reason: `${Math.floor(daysPending)} dias sem pagar cobrança mais antiga`,
            dry_run: dryRun,
          });
          continue;
        }
      }

      // Delta do ciclo = saldo atual − o que já foi emitido em cobranças abertas.
      const cycleAmount = Number((chargeAmount - alreadyBilled).toFixed(2));
      if (cycleAmount < MIN_CHARGE_AMOUNT) {
        results.push({
          store: store.name,
          status: "skip",
          reason: `Delta do ciclo (R$${cycleAmount.toFixed(2)}) abaixo do mínimo de R$${MIN_CHARGE_AMOUNT}`,
        });
        continue;
      }
      chargeAmount = cycleAmount;
      chargeDescription = `${chargeDescription} — ciclo ${new Date().toLocaleDateString("pt-BR")}`;

      if (dryRun) {
        results.push({
          store: store.name,
          status: "would_charge",
          amount: chargeAmount,
          description: chargeDescription,
          plan: planType,
        });
        continue;
      }

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 7);
      const dueDateStr = dueDate.toISOString().split("T")[0];
      const chargeFamily = "weekly_delivery_fee";
      const idempotencyKey = `${chargeFamily}:${balance.store_id}:${weeklyCycleKey(now)}`;
      const referenceCandidate = `#REP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const reservationMetadata = {
        description: chargeDescription,
        plan_type: planType,
        repasse_pendente: repasse,
        comissao_pendente: comissao,
        pdv_commission_pending: pdvPending,
        balance_billed: baseAmount,
        pdv_pending_billed: pdvPending,
        due_date: dueDateStr,
        gateway: "woovi",
        charge_family: chargeFamily,
        idempotency_key: idempotencyKey,
      };

      // A reserva é feita antes da chamada externa. O índice único de ciclo
      // garante que cron, retry e execuções concorrentes compartilhem a mesma
      // reference_code/correlationID.
      const { data: reservationData, error: reservationError } = await supabase
        .rpc("reserve_commission_charge_reservation", {
          _store_id: balance.store_id,
          _idempotency_key: idempotencyKey,
          _reference_code: referenceCandidate,
          _amount: chargeAmount,
          _charge_family: chargeFamily,
          _provider: "woovi",
          _metadata: reservationMetadata,
        })
        .maybeSingle();
      if (reservationError || !reservationData) {
        results.push({ store: store.name, status: "error", reason: "Falha ao reservar cobrança semanal" });
        continue;
      }
      const reservation: any = reservationData;
      if (!reservation.created_new && reservation.state === "issuing" && !reservation.transaction_id) {
        // A tentativa anterior pode ter alcançado a Woovi e perdido a resposta.
        // Não repetimos o POST automaticamente: a reserva e o correlationID
        // ficam preservados para reconciliação segura, sem segundo PIX.
        results.push({
          store: store.name,
          status: "reconciliation_pending",
          reference_code: reservation.reference_code,
          reason: "Cobrança em emissão ambígua; aguardando reconciliação segura",
        });
        continue;
      }
      if (reservation.transaction_id) {
        const transaction = await loadReservedTransaction(supabase, reservation.transaction_id);
        results.push({
          store: store.name,
          status: "reused",
          amount: transaction?.amount ?? reservation.amount,
          provider: "woovi",
          reference_code: transaction?.reference_code ?? reservation.reference_code,
          payment_id: transaction?.mercado_pago_payment_id,
          due_date: dueDateStr,
          plan: planType,
        });
        continue;
      }

      const { data: claimData, error: claimError } = await supabase
        .rpc("claim_commission_charge_reservation", {
          _reservation_id: reservation.reservation_id,
          _lease_seconds: 300,
        })
        .maybeSingle();
      if (claimError || !claimData) {
        results.push({ store: store.name, status: "error", reason: "Falha ao adquirir reserva semanal" });
        continue;
      }
      const claim: any = claimData;
      if (claim.finalized && claim.transaction_id) {
        const transaction = await loadReservedTransaction(supabase, claim.transaction_id);
        results.push({
          store: store.name,
          status: "reused",
          amount: transaction?.amount ?? claim.amount,
          provider: "woovi",
          reference_code: transaction?.reference_code ?? claim.reference_code,
          payment_id: transaction?.mercado_pago_payment_id,
          due_date: dueDateStr,
          plan: planType,
        });
        continue;
      }
      if (!claim.acquired) {
        results.push({
          store: store.name,
          status: "processing",
          reference_code: claim.reference_code,
          reason: "Cobrança já está sendo emitida por outra execução",
        });
        continue;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("document, email, full_name")
        .eq("user_id", store.owner_id)
        .maybeSingle();
      const ownerDoc = String((prof as any)?.document || "");
      const ownerEmail = String((prof as any)?.email || "");
      const referenceCode = String(claim.reference_code);
      const charge = await createWooviCharge({
        amount: Number(claim.amount),
        description: chargeDescription,
        externalId: referenceCode,
        customerName: store.name,
        customerEmail: ownerEmail,
        customerCpfCnpj: ownerDoc,
      });

      if (!charge.ok) {
        if (charge.safeToRelease) {
          await supabase.rpc("release_commission_charge_reservation", {
            _reservation_id: reservation.reservation_id,
            _reason: charge.error || "Falha confirmada da Woovi",
          });
        }
        results.push({
          store: store.name,
          status: charge.safeToRelease ? "error" : "reconciliation_pending",
          reason: charge.error,
        });
        continue;
      }

      if (!charge.paymentId || !charge.pixCopyPaste) {
        // A Woovi pode ter aceitado a cobrança, mas a resposta ficou incompleta.
        // Mantemos a reserva em issuing para que o retry reutilize o mesmo ID.
        results.push({
          store: store.name,
          status: "reconciliation_pending",
          reference_code: referenceCode,
          reason: "Resposta da Woovi sem identificador ou PIX",
        });
        continue;
      }

      const { data: finalizedData, error: finalizeError } = await supabase
        .rpc("finalize_commission_charge_reservation", {
          _reservation_id: reservation.reservation_id,
          _provider: "woovi",
          _provider_payment_id: charge.paymentId,
          _pix_qr_code: "",
          _pix_qr_code_base64: charge.pixQrCode || "",
          _pix_copy_paste: charge.pixCopyPaste,
          _metadata: { woovi_charge_id: charge.paymentId },
        })
        .maybeSingle();
      if (finalizeError || !finalizedData) {
        results.push({
          store: store.name,
          status: "reconciliation_pending",
          reference_code: referenceCode,
          reason: "Cobrança emitida; finalização financeira pendente",
        });
        continue;
      }
      const transaction: any = finalizedData;

      if (transaction.created_new) {
        try {
          await supabase.functions.invoke("send-push", {
            body: {
              user_ids: [store.owner_id],
              title: "💰 Nova cobrança de repasse",
              body: `${store.name}: R$${Number(transaction.amount).toFixed(2)} — vence em ${dueDateStr.split("-").reverse().join("/")}. Pague pelo app.`,
              data: { type: "commission_charge", store_id: balance.store_id },
            },
          });
        } catch (e) {
          console.warn("[auto-charge] push falhou:", e);
        }
      }

      results.push({
        store: store.name,
        status: transaction.created_new ? "charged" : "reused",
        amount: transaction.amount,
        provider: "woovi",
        reference_code: transaction.reference_code,
        payment_id: transaction.provider_payment_id,
        due_date: dueDateStr,
        plan: planType,
      });
    }

    const charged = results.filter(r => r.status === "charged").length;
    const deactivated = results.filter(r => r.status === "deactivated").length;
    const errors = results.filter(r => r.status === "error").length;

    return json({
      success: true,
      dry_run: dryRun,
      summary: { charged, deactivated, errors, total: results.length },
      results,
    });

  } catch (err: any) {
    console.error("[auto-charge-physical-fees]", err);
    return json({ error: err.message || "Erro interno" }, 500);
  }
});
