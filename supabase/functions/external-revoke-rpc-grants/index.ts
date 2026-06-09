// One-shot: revokes EXECUTE on financial RPCs from `authenticated` on the
// EXTERNAL Supabase project (M2/M3 audit finding). Idempotent.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";
const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const EXT_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
  || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
  || "";
const CRON = Deno.env.get("CRON_SECRET") || Deno.env.get("EXTERNAL_CRON_SECRET") || "";

const SQL = `
REVOKE EXECUTE ON FUNCTION public.reconcile_debit_store_balance(uuid, numeric, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_store_commission(uuid, numeric, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_store_repasse(uuid, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_store_commission(uuid, numeric) FROM authenticated;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  let ok = !!auth && (auth === EXT_KEY || auth === TOKEN || (CRON && auth === CRON));

  // Also accept a platform-admin JWT issued by the EXTERNAL project.
  if (!ok && auth) {
    try {
      const admin = createClient(EXT_URL, EXT_KEY);
      const { data: u } = await admin.auth.getUser(auth);
      if (u?.user) {
        const { data: isAdmin } = await admin.rpc("is_platform_admin", { _user_id: u.user.id });
        ok = !!isAdmin;
      }
    } catch (_) { /* ignore */ }
  }

  if (!ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  const text = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: text }), {
    status: r.ok ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});