import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BodySchema = z.object({ store_id: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { store_id } = parsed.data;

    const { data: store } = await supabase
      .from("stores").select("id, owner_id").eq("id", store_id).maybeSingle();
    if (!store || store.owner_id !== userData.user.id) return json({ error: "Forbidden" }, 403);

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    if (!baseUrl || !apiKey) return json({ error: "Servidor Evolution não configurado" }, 500);

    const instance = `store-${store_id.slice(0, 8)}`;
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-webhook?token=${webhookToken}`;

    // 1) cria instância (ignora erro se já existir)
    await fetch(`${baseUrl.replace(/\/$/, "")}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: { url: webhookUrl, byEvents: false, events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"] },
      }),
    }).catch(() => {});

    // 2) conecta e pega QR
    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/instance/connect/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: "Falha ao gerar QR", details: data }, 502);

    const qr = data?.base64 || data?.qrcode?.base64 || data?.code || data?.qrcode || null;

    // 3) persiste
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("store_whatsapp_config").upsert({
      store_id,
      evolution_api_url: baseUrl,
      evolution_instance_name: instance,
      qr_code: qr,
      status: "connecting",
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id" });

    return json({ success: true, qr_code: qr, instance });
  } catch (e) {
    console.error("evolution-qr-code error:", e);
    return json({ error: "Internal error" }, 500);
  }
});