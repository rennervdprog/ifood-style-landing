// Registra/atualiza o webhook da Woovi apontando para a função externa com o secret na URL.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const APP_ID = Deno.env.get("WOOVI_APP_ID")!;
const SECRET = Deno.env.get("WOOVI_WEBHOOK_SECRET")!;
const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const TARGET = `${EXT_URL}/functions/v1/woovi-webhook`;
const h = { Authorization: APP_ID, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: any = { existing: [], removed: [], created: null };

  const list = await fetch("https://api.openpix.com.br/api/v1/webhook", { headers: h });
  const lj = await list.json().catch(() => ({}));
  const hooks = lj?.webhooks || [];
  out.existing = hooks.map((w: any) => ({ id: w.id, url: String(w.url || "").split("?")[0], event: w.event, isActive: w.isActive }));

  for (const w of hooks) {
    if (String(w.url || "").startsWith(TARGET)) {
      const d = await fetch(`https://api.openpix.com.br/api/v1/webhook/${w.id}`, { method: "DELETE", headers: h });
      out.removed.push({ id: w.id, status: d.status });
    }
  }

  const create = await fetch("https://api.openpix.com.br/api/v1/webhook", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      webhook: {
        name: "ItaSuper Webhook",
        event: "OPENPIX:CHARGE_COMPLETED",
        url: `${TARGET}?webhookSecret=${SECRET}`,
        isActive: true,
      },
    }),
  });
  const cj = await create.json().catch(() => ({}));
  out.created = { status: create.status, id: cj?.webhook?.id, url: String(cj?.webhook?.url || "").split("?")[0], error: cj?.error };

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
