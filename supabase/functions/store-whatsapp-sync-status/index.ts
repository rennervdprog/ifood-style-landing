import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, baggage, sentry-trace",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const { store_id } = await req.json().catch(() => ({}));
    if (!store_id) return json({ error: "store_id required" }, 400);

    const anon = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: claims } = await anon.auth.getClaims(jwt);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL")!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY"))!,
    );

    // Autorização: dono da loja OU admin/super_admin
    const { data: store } = await admin.from("stores").select("id, owner_id").eq("id", store_id).maybeSingle();
    if (!store) return json({ error: "Store not found" }, 404);
    let allowed = store.owner_id === userId;
    if (!allowed) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
      allowed = (roles || []).some((r: any) => ["admin", "super_admin"].includes(r.role));
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Evolution não configurado" }, 500);

    const { data: cfg } = await admin
      .from("store_whatsapp_config")
      .select("id, evolution_instance_name, status, phone_number, connected_at")
      .eq("store_id", store_id)
      .maybeSingle();
    if (!cfg) return json({ error: "Config não encontrada" }, 404);

    const instance = cfg.evolution_instance_name || `store-${String(store_id).slice(0, 8)}`;
    const root = baseUrl.replace(/\/$/, "");
    const r = await fetch(`${root}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
    const data: any = await r.json().catch(() => ({}));
    const state: string = data?.instance?.state || data?.state || "";

    // Buscar owner/número via fetchInstances (mais confiável)
    let phone: string | undefined;
    try {
      const listR = await fetch(`${root}/instance/fetchInstances?instanceName=${instance}`, { headers: { apikey: apiKey } });
      const arr: any = await listR.json().catch(() => []);
      const inst = Array.isArray(arr) ? arr[0] : arr;
      const owner = inst?.ownerJid || inst?.instance?.owner || inst?.owner;
      if (typeof owner === "string") phone = owner.split("@")[0];
    } catch { /* ignore */ }

    let newStatus = "disconnected";
    if (state === "open" || state === "connected") newStatus = "connected";
    else if (state === "connecting") newStatus = "connecting";

    const norm = (v?: string | null) => String(v || "").replace(/\D/g, "");
    const phoneChanged = !!phone && norm(phone) !== norm(cfg.phone_number);
    const patch: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (phone) patch.phone_number = phone;
    // Reseta connected_at quando conectou agora OU quando o número mudou (reconexão com outro chip)
    if (newStatus === "connected" && (cfg.status !== "connected" || phoneChanged)) {
      patch.connected_at = new Date().toISOString();
    }
    // Se desconectou, limpa o número para não mostrar dado obsoleto
    if (newStatus === "disconnected") {
      patch.phone_number = null;
      patch.connected_at = null;
    }
    await admin.from("store_whatsapp_config").update(patch).eq("id", cfg.id);

    return json({ success: true, state, status: newStatus, phone, phoneChanged });
  } catch (e: any) {
    console.error("store-whatsapp-sync-status error:", e);
    return json({ error: "Internal error", message: e?.message }, 500);
  }
});