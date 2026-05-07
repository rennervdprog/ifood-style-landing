import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

// Tabelas a serem zeradas (ordem importa por FKs: filhos antes dos pais)
const TABLES_TO_WIPE = [
  "order_items",
  "order_messages",
  "order_ratings",
  "cash_transactions",
  "cash_registers",
  "driver_earnings",
  "store_driver_earnings",
  "withdrawal_requests",
  "wallet_transactions",
  "user_wallet",
  "moderator_earnings",
  "emergency_fund",
  "asaas_webhook_events",
  "partner_payouts",
  "payout_history",
  "refund_requests",
  "loyalty_points",
  "coupon_uses",
  "plan_change_requests",
  "compliance_alerts",
  "admin_logs",
  "driver_locations",
  "page_views",
  "financial_transactions",
  "store_balances",
  "driver_balances",
  "orders",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: exige header x-admin-token igual a um secret
    const adminToken = Deno.env.get("ADMIN_RESET_TOKEN");
    const provided = req.headers.get("x-admin-token");
    if (!adminToken || provided !== adminToken) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
    }

    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");
    if (!externalUrl || !externalKey) {
      return new Response(JSON.stringify({ error: "missing external creds" }), { status: 500, headers: JSON_HEADERS });
    }

    const ext = createClient(externalUrl, externalKey, { auth: { persistSession: false } });

    const results: Record<string, { ok: boolean; error?: string }> = {};
    for (const table of TABLES_TO_WIPE) {
      const { error } = await ext.from(table).delete().not("id", "is", null);
      results[table] = { ok: !error, error: error?.message };
    }

    return new Response(JSON.stringify({ done: true, results }), { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: JSON_HEADERS });
  }
});
