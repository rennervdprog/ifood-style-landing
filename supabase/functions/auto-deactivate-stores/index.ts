import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!;
    const serviceKey = (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY"))!;

    // Auth: only service_role (cron) or platform admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isServiceRole = token === serviceKey;

    if (!isServiceRole) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authClient = createClient(supabaseUrl, serviceKey);
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: isAdmin } = await adminClient.rpc("is_platform_admin", { _user_id: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores podem executar esta função." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Find stores with ANY pending balance (commission OR repasse/fixed-plan split)
    const { data: balanceDebt, error: balError } = await serviceClient
      .from("store_balances")
      .select("store_id, comissao_pendente, repasse_pendente, pending_commission")
      .or("comissao_pendente.gt.0,repasse_pendente.gt.0");

    // ALSO find stores with pending monthly-fee charges older than 3 days
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: monthlyDebt } = await serviceClient
      .from("financial_transactions")
      .select("store_id")
      .eq("transaction_kind", "commission_charge")
      .eq("status", "pending")
      .like("reference_code", "#MENS-%")
      .lte("created_at", cutoff);

    // Merge both lists, dedup by store_id
    const byStore = new Map<string, any>();
    for (const b of balanceDebt || []) byStore.set(b.store_id, b);
    for (const m of monthlyDebt || []) {
      if (!byStore.has(m.store_id)) {
        byStore.set(m.store_id, { store_id: m.store_id, comissao_pendente: 0, repasse_pendente: 0, pending_commission: 0 });
      }
    }
    const storesWithDebt = Array.from(byStore.values());

    if (balError) {
      console.error("Error fetching balances:", balError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deactivatedCount = 0;
    const deactivatedStores: string[] = [];

    // ─── Batch pre-fetch (P1-7: elimina N+1) ─────────────────────────────
    // Antes: 4 queries por loja (recentPayment, oldestUnpaidCharge,
    // oldestUnpaidMonthly, store). Agora: 4 queries totais usando .in().
    const storeIds = (storesWithDebt || []).map((b: any) => b.store_id);
    const threeDaysAgoMs = Date.now() - 3 * 24 * 60 * 60 * 1000;

    const recentPaymentsP = serviceClient
      .from("financial_transactions")
      .select("store_id")
      .in("store_id", storeIds)
      .in("transaction_kind", ["commission_charge", "store_payout"])
      .in("status", ["paid", "approved"])
      .gte("created_at", threeDaysAgo);

    const unpaidChargesP = serviceClient
      .from("financial_transactions")
      .select("store_id, created_at, transaction_kind, reference_code, amount")
      .in("store_id", storeIds)
      .in("transaction_kind", ["commission_charge", "store_payout"])
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const storesInfoP = serviceClient
      .from("stores")
      .select("id, name, status")
      .in("id", storeIds)
      .eq("status", "ativo");

    const balancesUpdatedP = serviceClient
      .from("store_balances")
      .select("store_id, updated_at")
      .in("store_id", storeIds);

    const [recentRes, unpaidRes, storesRes, balUpdRes] = await Promise.all([
      recentPaymentsP, unpaidChargesP, storesInfoP, balancesUpdatedP,
    ]);

    const recentSet = new Set((recentRes.data || []).map((r: any) => r.store_id));
    const storesById = new Map<string, any>(
      (storesRes.data || []).map((s: any) => [s.id, s]),
    );
    const balUpdatedById = new Map<string, string>(
      (balUpdRes.data || []).map((b: any) => [b.store_id, b.updated_at]),
    );
    // Primeira cobrança não-paga por loja, separando mensalidade de demais.
    const oldestChargeByStore = new Map<string, any>();
    const oldestMonthlyByStore = new Map<string, any>();
    for (const tx of unpaidRes.data || []) {
      const isMonthly = String(tx.reference_code || "").startsWith("#MENS-");
      const target = isMonthly ? oldestMonthlyByStore : oldestChargeByStore;
      if (!target.has(tx.store_id)) target.set(tx.store_id, tx);
    }

    for (const balance of storesWithDebt || []) {
      const hasCommissionDebt = Number(balance.comissao_pendente || 0) > 0;
      const hasRepasseDebt = Number(balance.repasse_pendente || 0) > 0;

      // Skip if store paid any platform charge in the last 3 days
      if (recentSet.has(balance.store_id)) continue;

      const oldestUnpaidMonthly = oldestMonthlyByStore.get(balance.store_id);
      const oldestUnpaidCharge = oldestChargeByStore.get(balance.store_id);

      let shouldDeactivate = false;
      let debtKind = "comissão";
      let debtAmount = 0;

      if (oldestUnpaidMonthly &&
          new Date(oldestUnpaidMonthly.created_at).getTime() < threeDaysAgoMs) {
        shouldDeactivate = true;
        debtKind = "mensalidade";
        debtAmount = Number(oldestUnpaidMonthly.amount) || 0;
      } else if (oldestUnpaidCharge) {
        shouldDeactivate =
          new Date(oldestUnpaidCharge.created_at).getTime() < threeDaysAgoMs;
        debtKind = oldestUnpaidCharge.transaction_kind === "store_payout" ? "repasse" : "comissão";
      } else {
        // No charge ever generated, but balance keeps accumulating — check store_balances.updated_at
        const updatedAt = balUpdatedById.get(balance.store_id);
        if (updatedAt) {
          shouldDeactivate =
            new Date(updatedAt).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000;
        }
      }

      if (!shouldDeactivate) continue;

      if (debtKind !== "mensalidade") {
        debtAmount = hasRepasseDebt
          ? Number(balance.repasse_pendente)
          : Number(balance.comissao_pendente);
        if (!hasCommissionDebt && hasRepasseDebt) debtKind = "repasse";
      }

      // Check current store status - only deactivate active stores
      const store = storesById.get(balance.store_id);
      if (!store) continue;

      // Deactivate the store
      const { error: updateError } = await serviceClient
        .from("stores")
        .update({ status: "bloqueado" })
        .eq("id", balance.store_id);

      if (!updateError) {
        deactivatedCount++;
        deactivatedStores.push(store.name);
        console.log(
          `Store deactivated: ${store.name} (${store.id}) - ${debtKind} pendente: R$ ${debtAmount}`
        );

        await serviceClient.from("compliance_alerts").insert({
          store_id: balance.store_id,
          alert_type: debtKind === "repasse"
            ? "repasse_overdue"
            : debtKind === "mensalidade"
              ? "monthly_fee_overdue"
              : "commission_overdue",
          message: `Loja "${store.name}" foi suspensa automaticamente por falta de pagamento de ${debtKind} (R$ ${debtAmount.toFixed(2)}) após 3 dias.`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        deactivated: deactivatedCount,
        stores: deactivatedStores,
        checked: storesWithDebt?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Auto-deactivate error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
