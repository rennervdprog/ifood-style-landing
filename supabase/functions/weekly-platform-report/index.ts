import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 7 day window
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── Aggregate metrics ──
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total_price, app_fee, status, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const totalOrders = orders?.length || 0;
    const delivered = orders?.filter((o: any) => o.status === "entregue").length || 0;
    const cancelled = orders?.filter((o: any) => o.status === "cancelado").length || 0;
    const gmv = (orders || []).reduce((s: number, o: any) => s + Number(o.total_price || 0), 0);
    const commission = (orders || []).reduce((s: number, o: any) => s + Number(o.app_fee || 0), 0);

    const { count: newStores } = await supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .gte("created_at", start.toISOString());

    const { count: newDrivers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "motoboy")
      .gte("created_at", start.toISOString());

    const { count: pendingApprovals } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("role", ["lojista", "motoboy"])
      .eq("is_approved", false);

    // Overdue fixed plans
    const { data: overdueePlans } = await supabase
      .from("store_plans")
      .select("store_id, monthly_fee, next_billing_date, stores!inner(name)")
      .eq("plan_type", "fixed")
      .eq("is_active", true)
      .lt("next_billing_date", end.toISOString());

    const overdueAmount = (overdueePlans || []).reduce(
      (s: number, p: any) => s + Number(p.monthly_fee || 0),
      0
    );
    const overdueCount = overdueePlans?.length || 0;

    // ── Build report ──
    const summary =
      `📊 Relatório semanal\n\n` +
      `🛒 Pedidos: ${totalOrders} (✅ ${delivered} | ❌ ${cancelled})\n` +
      `💰 GMV: ${formatBRL(gmv)}\n` +
      `🏦 Comissão: ${formatBRL(commission)}\n` +
      `🏪 Novas lojas: ${newStores || 0}\n` +
      `🏍️ Novos entregadores: ${newDrivers || 0}\n` +
      `⏳ Aguardando aprovação: ${pendingApprovals || 0}\n` +
      `⚠️ Mensalidades vencidas: ${overdueCount} (${formatBRL(overdueAmount)})`;

    // ── Send to all admins via push ──
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (admins || []).map((a: any) => a.user_id).filter(Boolean);

    let pushResult: any = null;
    if (adminIds.length > 0) {
      const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          user_ids: adminIds,
          title: "📊 Relatório semanal da plataforma",
          body: `Pedidos: ${totalOrders} | GMV: ${formatBRL(gmv)} | Comissão: ${formatBRL(commission)}`,
          data: { link: "/admin", report: "weekly" },
        }),
      });
      pushResult = await pushRes.json().catch(() => null);
    }

    console.log("[weekly-platform-report] Summary:\n" + summary);

    return new Response(
      JSON.stringify({
        ok: true,
        period: { start: start.toISOString(), end: end.toISOString() },
        metrics: {
          totalOrders,
          delivered,
          cancelled,
          gmv,
          commission,
          newStores: newStores || 0,
          newDrivers: newDrivers || 0,
          pendingApprovals: pendingApprovals || 0,
          overdueCount,
          overdueAmount,
        },
        summary,
        push: pushResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[weekly-platform-report] error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
