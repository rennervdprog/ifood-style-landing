// Cron diário — Fase 4 (SOMBRA): apenas detecta e loga. Não altera partial_lock_status para 'restricted'.
// Cláusula 8.2 dos Termos: aviso em saldo pendente > R$ 500, 5 dias úteis, depois restrição parcial.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const THRESHOLD = 500;
const SHADOW_MODE = true; // 🔒 Fase sombra: só loga

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  const { data: balances, error } = await sb
    .from("store_balances")
    .select("store_id, repasse_pendente, comissao_pendente");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const flagged: Array<{ store_id: string; total: number; status: string }> = [];
  for (const b of balances || []) {
    const total = Number(b.repasse_pendente || 0) + Number(b.comissao_pendente || 0);
    if (total < THRESHOLD) continue;

    // Checa se já foi notificada
    const { data: store } = await sb
      .from("stores")
      .select("id, partial_lock_status, partial_lock_notified_at, partial_lock_deadline")
      .eq("id", b.store_id)
      .maybeSingle();
    if (!store) continue;

    let newStatus = store.partial_lock_status;
    const patch: Record<string, unknown> = {};

    if (!store.partial_lock_notified_at) {
      // primeiro aviso — 5 dias úteis (aprox 7 dias corridos)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      patch.partial_lock_status = "warning";
      patch.partial_lock_notified_at = new Date().toISOString();
      patch.partial_lock_deadline = deadline.toISOString();
      newStatus = "warning";
    } else if (store.partial_lock_deadline && new Date(store.partial_lock_deadline) < new Date()) {
      // deadline vencido — em prod, viraria 'restricted'; em sombra, só loga
      if (!SHADOW_MODE) {
        patch.partial_lock_status = "restricted";
        newStatus = "restricted";
      } else {
        newStatus = "would_restrict (shadow)";
      }
    }

    if (Object.keys(patch).length > 0) {
      await sb.from("stores").update(patch).eq("id", b.store_id);
    }

    flagged.push({ store_id: b.store_id, total, status: newStatus || "unknown" });

    await sb.from("admin_logs").insert({
      action: "balance_restriction_check",
      metadata: { store_id: b.store_id, total, status: newStatus, shadow: SHADOW_MODE },
    });
  }

  return new Response(JSON.stringify({ shadow: SHADOW_MODE, flagged_count: flagged.length, flagged }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});