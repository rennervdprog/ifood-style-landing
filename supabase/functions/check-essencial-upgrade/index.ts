// Cron diário: promove Essencial R$0 → R$180/mês quando GMV últimos 60 dias >= R$5.000.
// Roda contra Supabase EXTERNO (mesmo padrão de monthly-billing).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const THRESHOLD_BRL = 5000;
const WINDOW_DAYS = 60;
const UPGRADE_FEE = 180;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const EXTERNAL_KEY =
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
    Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth: service key ou CRON_SECRET
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "") ||
    req.headers.get("apikey") || "";
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const svc = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ok =
    !!auth && (auth === svc || auth === EXTERNAL_KEY || (cronSecret && auth === cronSecret));
  if (!ok) return json({ error: "Unauthorized" }, 401);

  try {
    const sb = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    // Essencial grátis (fixed, monthly_fee=0, ativo)
    const { data: plans, error: pErr } = await sb
      .from("store_plans")
      .select("id, store_id, monthly_fee, plan_type, is_active, stores!inner(name, status)")
      .eq("plan_type", "fixed")
      .eq("is_active", true)
      .eq("monthly_fee", 0);
    if (pErr) return json({ error: pErr.message }, 500);

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const upgraded: any[] = [];
    const skipped: any[] = [];

    for (const p of plans || []) {
      const store = (p as any).stores;
      if (!store || store.status !== "ativo") continue;

      const { data: orders, error: oErr } = await sb
        .from("orders")
        .select("total")
        .eq("store_id", p.store_id)
        .eq("status", "delivered")
        .gte("created_at", since);
      if (oErr) {
        skipped.push({ store: store.name, error: oErr.message });
        continue;
      }
      const gmv = (orders || []).reduce((s: number, o: any) => s + Number(o.total || 0), 0);

      if (gmv >= THRESHOLD_BRL) {
        const { error: uErr } = await sb
          .from("store_plans")
          .update({ monthly_fee: UPGRADE_FEE, updated_at: new Date().toISOString() })
          .eq("id", p.id);
        if (uErr) {
          skipped.push({ store: store.name, gmv, error: uErr.message });
        } else {
          upgraded.push({ store: store.name, gmv, new_fee: UPGRADE_FEE });
          // Log de auditoria (best-effort)
          await sb.from("admin_logs").insert({
            action: "essencial_auto_upgrade",
            metadata: { store_id: p.store_id, gmv, window_days: WINDOW_DAYS, new_fee: UPGRADE_FEE },
          }).then(() => {}, () => {});
        }
      } else {
        skipped.push({ store: store.name, gmv, reason: "below_threshold" });
      }
    }

    return json({
      checked: (plans || []).length,
      upgraded_count: upgraded.length,
      upgraded,
      skipped,
      threshold: THRESHOLD_BRL,
      window_days: WINDOW_DAYS,
    });
  } catch (e: any) {
    console.error("[check-essencial-upgrade]", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});