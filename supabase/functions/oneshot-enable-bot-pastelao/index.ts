import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const sb = createClient(url, key);
  const { data: store } = await sb.from("stores").select("id,name").ilike("name", "%pastel%carioca%").maybeSingle();
  if (!store) return new Response(JSON.stringify({ error: "no store" }), { status: 404, headers: cors });
  const { data: existing } = await sb.from("whatsapp_bot_config").select("*").eq("store_id", store.id).maybeSingle();
  const payload = {
    store_id: store.id,
    enabled: true,
    trigger_keywords: ["menu", "cardapio", "cardápio", "pedido", "quero", "oi", "ola", "olá", "boa", "bom dia", "boa tarde", "boa noite"],
    escape_keywords: ["atendente", "humano", "pessoa", "falar com alguem", "falar com alguém"],
    accepted_payment_methods: ["pix", "cash", "card"],
    welcome_message: null,
  };
  const res = existing
    ? await sb.from("whatsapp_bot_config").update(payload).eq("store_id", store.id).select().single()
    : await sb.from("whatsapp_bot_config").insert(payload).select().single();
  return new Response(JSON.stringify({ store, result: res }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});