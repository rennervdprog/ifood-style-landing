const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const baseUrl = Deno.env.get("EVOLUTION_API_URL")!.replace(/\/$/, "");
  const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY")!;
  const instance = "itasuper-platform";
  const url = new URL(req.url);
  const testPhone = url.searchParams.get("send");
  if (url.searchParams.get("create") === "1") {
    const webhookToken = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
    const functionBaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${functionBaseUrl}/functions/v1/evolution-webhook?token=${webhookToken}`;
    const createR = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        webhookEvents: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
        rejectCall: true,
        msgCall: "Olá! No momento não consigo atender chamadas. Por favor envie uma mensagem 😊",
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      }),
    });
    const createJson = await createR.json().catch(() => ({}));
    const stateR = await fetch(`${baseUrl}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
    const stateJson = await stateR.json().catch(() => ({}));
    const qr = createJson?.base64 || createJson?.qrcode?.base64 || createJson?.code || createJson?.qrcode?.code;
    return new Response(JSON.stringify({
      create_status: createR.status,
      create_ok: createR.ok,
      created_instance: createJson?.instance?.instanceName || createJson?.instanceName || instance,
      has_qr_or_code: !!qr,
      create_keys: Object.keys(createJson || {}),
      state_status: stateR.status,
      state: stateJson?.instance?.state || stateJson?.state || null,
      state_body: stateJson,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (testPhone) {
    const number = "55" + testPhone.replace(/\D/g, "");
    const sendR = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number, text: "🚀 Teste do WhatsApp da plataforma ItaSuper — se você recebeu, está tudo funcionando!" }),
    });
    const sendJson = await sendR.json().catch(() => ({}));
    return new Response(JSON.stringify({ status: sendR.status, sendJson }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const r = await fetch(`${baseUrl}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
  const evo = await r.json().catch(() => ({}));
  const state: string = evo?.instance?.state || evo?.state || "";
  const phone: string | null = evo?.instance?.wuid?.split?.("@")?.[0] || evo?.instance?.owner?.split?.("@")?.[0] || null;
  let newStatus = "disconnected";
  if (state === "open" || state === "connected") newStatus = "connected";
  else if (state === "connecting") newStatus = "connecting";
  const sets = [`status='${newStatus}'`, `updated_at=now()`];
  if (phone) sets.push(`phone_number='${phone.replace(/'/g, "")}'`);
  if (newStatus === "connected") sets.push(`connected_at=COALESCE(connected_at, now())`);
  await q(`UPDATE public.platform_whatsapp_config SET ${sets.join(", ")} WHERE instance_name='${instance}';`);
  const cfg = await q(`SELECT instance_name, status, phone_number, connected_at, updated_at FROM public.platform_whatsapp_config;`);
  return new Response(JSON.stringify({ evo, state, phone, cfg }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
