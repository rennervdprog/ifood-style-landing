import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Mantém sessões Evolution vivas. Para cada loja com status "connected",
 * consulta o estado real e, se cair, dispara /instance/connect (que reusa o
 * auth salvo do Baileys — não pede QR de novo, a menos que a sessão tenha
 * sido invalidada do lado do WhatsApp).
 * Atualiza store_whatsapp_config.status para refletir o estado real.
 * Pode ser chamado de cron externo ou pelo próprio app a cada poucos min.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Evolution não configurado" }, 500);

    const admin = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const onlyStoreId = url.searchParams.get("store_id");

    let q = admin
      .from("store_whatsapp_config")
      .select("store_id, evolution_instance_name, status")
      .not("evolution_instance_name", "is", null);
    if (onlyStoreId) q = q.eq("store_id", onlyStoreId);
    const { data: configs } = await q;

    const root = baseUrl.replace(/\/$/, "");
    const results: any[] = [];

    for (const cfg of (configs ?? [])) {
      const inst = (cfg as any).evolution_instance_name as string;
      try {
        const r = await fetch(`${root}/instance/connectionState/${inst}`, { headers: { apikey: apiKey } });
        const j: any = await r.json().catch(() => ({}));
        const state: string = j?.instance?.state || j?.state || "";
        const isOpen = state === "open";

        if (!isOpen) {
          // tenta reconectar usando auth salvo — não exige QR novo se a sessão ainda existir
          await fetch(`${root}/instance/connect/${inst}`, { headers: { apikey: apiKey } }).catch(() => {});
        }

        const newStatus = isOpen ? "connected" : (state === "connecting" ? "connecting" : "disconnected");
        // Quando aberto, também confere o ownerJid real — se o chip trocou
        // (ou o webhook não disparou), corrige phone_number e connected_at.
        let realPhone: string | undefined;
        if (isOpen) {
          try {
            const fr = await fetch(`${root}/instance/fetchInstances?instanceName=${inst}`, { headers: { apikey: apiKey } });
            const arr: any = await fr.json().catch(() => []);
            const info = Array.isArray(arr) ? arr[0] : arr;
            const owner = info?.ownerJid || info?.owner;
            if (typeof owner === "string") realPhone = owner.split("@")[0].replace(/\D/g, "");
          } catch { /* ignore */ }
        }
        const { data: cur } = await admin
          .from("store_whatsapp_config")
          .select("phone_number, status, connected_at")
          .eq("store_id", (cfg as any).store_id)
          .maybeSingle();
        const norm = (v?: string | null) => String(v || "").replace(/\D/g, "");
        const phoneChanged = !!realPhone && norm(realPhone) !== norm(cur?.phone_number);
        const patch: any = {};
        if (newStatus !== (cfg as any).status) patch.status = newStatus;
        if (realPhone && phoneChanged) patch.phone_number = realPhone;
        if (isOpen && (cur?.status !== "connected" || phoneChanged || !cur?.connected_at)) {
          patch.connected_at = new Date().toISOString();
        }
        if (Object.keys(patch).length > 0) {
          patch.updated_at = new Date().toISOString();
          await admin.from("store_whatsapp_config").update(patch).eq("store_id", (cfg as any).store_id);
        }
        results.push({ store_id: (cfg as any).store_id, state, action: isOpen ? "noop" : "reconnect", phoneChanged });
      } catch (e) {
        results.push({ store_id: (cfg as any).store_id, error: String(e) });
      }
    }

    return json({ success: true, count: results.length, results });
  } catch (e) {
    console.error("evolution-keepalive error:", e);
    return json({ error: "Internal error", message: e.message, stack: e.stack }, 500);
  }
});