/**
 * auto-charge-physical-fees
 *
 * Roda por cron (ex: diariamente às 10h) ou chamada manual pelo admin.
 *
 * Para cada loja com saldo pendente de pagamentos físicos (dinheiro/cartão):
 *  - Planos fixo/apoiador: cobrar repasse_pendente (R$2 por entrega)
 *  - Plano hybrid: cobrar repasse_pendente (R$2/entrega) + comissao_pendente (2,5% físico)
 *  - Planos commission_only: cobrar comissao_pendente (% sobre vendas)
 *
 * Fluxo:
 *  1. Busca lojas com saldo pendente acima do mínimo configurado (default R$5)
 *  2. Gera cobrança PIX via Asaas na subconta do lojista
 *  3. Salva em financial_transactions com status 'pending'
 *  4. Webhook Asaas confirma → zerará o saldo pendente
 *  5. Se não pagar em N dias → inativa a loja
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Mínimo para gerar cobrança (evita PIX de centavos)
const MIN_CHARGE_AMOUNT = 5.0;

// Dias de atraso antes de inativar a loja
const OVERDUE_DAYS_TO_DEACTIVATE = 30;

// ─── Gerar cobrança PIX no Asaas ──────────────────────────────────────────────

async function createAsaasCharge(params: {
  walletId: string;
  amount: number;
  description: string;
  dueDate: string; // YYYY-MM-DD
  storeAccountId: string;
}): Promise<{ ok: boolean; paymentId?: string; pixCopyPaste?: string; pixQrCode?: string; error?: string }> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return { ok: false, error: "ASAAS_API_KEY não configurado" };

  const baseUrl = apiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  try {
    const res = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
        // Criar cobrança na subconta do lojista via walletId
        "asaas-wallet-id": params.walletId,
      },
      body: JSON.stringify({
        billingType: "PIX",
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

// ─── Inativar loja por inadimplência ──────────────────────────────────────────

async function deactivateOverdueStore(
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  storeName: string
) {
  // Inativa a loja
  await supabase
    .from("stores")
    .update({ status: "inativo" } as any)
    .eq("id", storeId);

  // Desativa o plano
  await supabase
    .from("store_plans")
    .update({ is_active: false } as any)
    .eq("store_id", storeId)
    .eq("is_active", true);

  console.log(`[auto-charge] Loja ${storeName} inativada por inadimplência`);
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
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const isService =
      !!token && (token === serviceKey || (cronSecret !== "" && token === cronSecret));

    if (!isService) {
      if (!token) return json({ error: "Unauthorized" }, 401);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return json({ error: "Unauthorized" }, 401);

      const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: user.id });
      if (!isAdmin) return json({ error: "Apenas admins" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const manualStoreId = body?.store_id;
    const dryRun = body?.dry_run === true; // true = simula sem gerar cobranças

    const results: any[] = [];
    const now = new Date();

    // ── 1. Buscar lojas com saldo pendente de pagamentos físicos ──
    // store_balances.repasse_pendente = R$2/entrega (planos fixed/supporter)
    // store_balances.comissao_pendente = % sobre vendas físicas (commission_only)
    let balanceQuery = supabase
      .from("store_balances")
      .select(`
        store_id,
        repasse_pendente,
        comissao_pendente,
        stores!inner(
          id, name, status, asaas_account_id, asaas_wallet_id,
          store_plans!inner(plan_type, is_active, commission_rate)
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

      const plan = store.store_plans?.[0];
      if (!plan) continue;

      const planType = plan.plan_type;
      const repasse = Number(balance.repasse_pendente || 0);
      const comissao = Number(balance.comissao_pendente || 0);

      // Calcular valor a cobrar por tipo de plano
      let chargeAmount = 0;
      let chargeDescription = "";

      if (planType === "fixed" || planType === "supporter") {
        // Cobrar repasse_pendente (R$2 por entrega)
        if (repasse >= MIN_CHARGE_AMOUNT) {
          chargeAmount = repasse;
          chargeDescription = `Taxa de entrega ItaSuper — ${store.name} (${repasse.toFixed(0)} entregas × R$2,00)`;
        }
      } else if (planType === "hybrid") {
        // Hybrid: cobrar repasse_pendente (R$2/entrega) + comissao_pendente (2,5% físico)
        const total = repasse + comissao;
        if (total >= MIN_CHARGE_AMOUNT) {
          chargeAmount = total;
          const parts = [];
          if (repasse > 0) parts.push(`R$${repasse.toFixed(2)} taxa entrega`);
          if (comissao > 0) parts.push(`R$${comissao.toFixed(2)} comissão (2,5%)`);
          chargeDescription = `ItaSuper — ${store.name}: ${parts.join(" + ")}`;
        }
      } else if (planType === "commission_only") {
        // Cobrar comissao_pendente (% sobre vendas físicas)
        if (comissao >= MIN_CHARGE_AMOUNT) {
          chargeAmount = comissao;
          chargeDescription = `Comissão ItaSuper — ${store.name} (vendas em dinheiro/cartão)`;
        }
      }

      if (chargeAmount <= 0) {
        results.push({ store: store.name, status: "skip", reason: `Saldo abaixo de R$${MIN_CHARGE_AMOUNT}` });
        continue;
      }

      // Verificar se já existe cobrança pendente não paga
      const { data: existingCharge } = await supabase
        .from("financial_transactions")
        .select("id, created_at, status")
        .eq("store_id", balance.store_id)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCharge) {
        // Verificar se está vencida há mais de OVERDUE_DAYS_TO_DEACTIVATE dias
        const createdAt = new Date(existingCharge.created_at);
        const daysPending = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysPending > OVERDUE_DAYS_TO_DEACTIVATE) {
          if (!dryRun) {
            await deactivateOverdueStore(supabase, balance.store_id, store.name);
          }
          results.push({
            store: store.name,
            status: "deactivated",
            reason: `${Math.floor(daysPending)} dias sem pagar`,
            dry_run: dryRun,
          });
          continue;
        }

        results.push({
          store: store.name,
          status: "skip",
          reason: `Já tem cobrança pendente há ${Math.floor(daysPending)} dias`,
        });
        continue;
      }

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

      // ── 2. Gerar PIX Asaas ──
      if (!store.asaas_wallet_id || !store.asaas_account_id) {
        results.push({
          store: store.name,
          status: "error",
          reason: "Sem conta Asaas configurada — cobrar manualmente",
        });
        continue;
      }

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 7); // 7 dias para pagar
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const charge = await createAsaasCharge({
        walletId: store.asaas_wallet_id,
        storeAccountId: store.asaas_account_id,
        amount: chargeAmount,
        description: chargeDescription,
        dueDate: dueDateStr,
      });

      if (!charge.ok) {
        results.push({ store: store.name, status: "error", reason: charge.error });
        continue;
      }

      // ── 3. Salvar em financial_transactions ──
      await supabase.from("financial_transactions").insert({
        store_id: balance.store_id,
        transaction_kind: "commission_charge",
        reference_code: charge.paymentId,
        amount: chargeAmount,
        status: "pending",
        provider: "asaas",
        pix_copy_paste: charge.pixCopyPaste,
        pix_qr_code_base64: charge.pixQrCode,
        metadata: {
          description: chargeDescription,
          plan_type: planType,
          repasse_pendente: repasse,
          comissao_pendente: comissao,
          due_date: dueDateStr,
          asaas_payment_id: charge.paymentId,
        },
      } as any);

      results.push({
        store: store.name,
        status: "charged",
        amount: chargeAmount,
        asaas_id: charge.paymentId,
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
