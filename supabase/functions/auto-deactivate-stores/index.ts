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
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Find stores with pending commission balance AND no paid commission charge in last 3 days
    const { data: storesWithDebt, error: balError } = await serviceClient
      .from("store_balances")
      .select("store_id, comissao_pendente, pending_commission")
      .gt("comissao_pendente", 0);

    if (balError) {
      console.error("Error fetching balances:", balError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deactivatedCount = 0;
    const deactivatedStores: string[] = [];

    for (const balance of storesWithDebt || []) {
      // Check if there's any paid commission charge in the last 3 days
      const { data: recentPayment } = await serviceClient
        .from("financial_transactions")
        .select("id")
        .eq("store_id", balance.store_id)
        .eq("transaction_kind", "commission_charge")
        .in("status", ["paid", "approved"])
        .gte("created_at", threeDaysAgo)
        .limit(1)
        .maybeSingle();

      if (recentPayment) continue; // Store paid recently, skip

      // Check if store has had pending commission for more than 3 days
      // by looking at when the balance was last at zero (or first charge created)
      const { data: oldestUnpaidCharge } = await serviceClient
        .from("financial_transactions")
        .select("created_at")
        .eq("store_id", balance.store_id)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Only deactivate if the oldest unpaid charge is older than 3 days
      // OR if the balance has been pending and no charge was ever created (use balance update time)
      const shouldDeactivate = oldestUnpaidCharge
        ? new Date(oldestUnpaidCharge.created_at).getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000
        : false; // If no charge exists, we can't deactivate based on charge age

      if (!shouldDeactivate) continue;

      // Check current store status - only deactivate active stores
      const { data: store } = await serviceClient
        .from("stores")
        .select("id, name, status")
        .eq("id", balance.store_id)
        .eq("status", "ativo")
        .single();

      if (!store) continue;

      // Deactivate the store
      const { error: updateError } = await serviceClient
        .from("stores")
        .update({ status: "bloqueado" })
        .eq("id", balance.store_id);

      if (!updateError) {
        deactivatedCount++;
        deactivatedStores.push(store.name);
        console.log(`Store deactivated: ${store.name} (${store.id}) - pending commission: R$ ${balance.comissao_pendente}`);

        // Create compliance alert
        await serviceClient.from("compliance_alerts").insert({
          store_id: balance.store_id,
          alert_type: "commission_overdue",
          message: `Loja "${store.name}" foi suspensa automaticamente por falta de pagamento da comissão (R$ ${Number(balance.comissao_pendente).toFixed(2)}) após 3 dias.`,
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
