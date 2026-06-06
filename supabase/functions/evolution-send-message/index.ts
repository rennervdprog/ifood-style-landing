import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({
  store_id: z.string().uuid(),
  phone: z.string().min(10).max(20),
  message: z.string().min(1).max(4000),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { store_id, phone, message } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cfg } = await admin
      .from("store_whatsapp_config")
      .select("evolution_instance_name, status")
      .eq("store_id", store_id)
      .maybeSingle();

    if (!cfg?.evolution_instance_name) return json({ error: "Evolution não configurado" }, 400);
    if (cfg.status !== "connected") return json({ error: "WhatsApp não conectado" }, 400);

    const baseUrl = Deno.env.get("EVOLUTION_API_URL");
    const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!baseUrl || !apiKey) return json({ error: "Servidor Evolution não configurado" }, 500);

    let number = phone.replace(/\D/g, "");
    if (number.length <= 11) number = "55" + number;

    const r = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${cfg.evolution_instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text: message }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: "Falha Evolution", details: data }, 502);
    return json({ success: true, data });
  } catch (e) {
    console.error("evolution-send-message error:", e);
    return json({ error: "Internal error" }, 500);
  }
});