import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.some((r) => ["admin", "super_admin"].includes(r))) return json({ error: "Forbidden" }, 403);

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Evolution não configurado" }, 500);

    const { data: cfg } = await admin
      .from("platform_whatsapp_config").select("id, instance_name, status").limit(1).maybeSingle();
    if (!cfg) return json({ error: "Config não encontrada" }, 404);

    const root = baseUrl.replace(/\/$/, "");
    const r = await fetch(`${root}/instance/connectionState/${cfg.instance_name}`, { headers: { apikey: apiKey } });
    const data = await r.json().catch(() => ({} as any));
    const state: string = data?.instance?.state || data?.state || "";
    const phone: string | undefined =
      data?.instance?.wuid?.split?.("@")?.[0] ||
      data?.instance?.owner ||
      data?.wuid?.split?.("@")?.[0];

    let newStatus = "disconnected";
    if (state === "open" || state === "connected") newStatus = "connected";
    else if (state === "connecting") newStatus = "connecting";

    const patch: any = {
      status: newStatus,
      phone_number: phone ?? undefined,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "connected" && cfg.status !== "connected") {
      patch.connected_at = new Date().toISOString();
    }
    await admin.from("platform_whatsapp_config").update(patch).eq("id", cfg.id);

    return json({ success: true, state, status: newStatus, phone });
  } catch (e) {
    console.error("platform-whatsapp-sync-status error:", e);
    return json({ error: "Internal error", message: e.message, stack: e.stack }, 500);
  }
});