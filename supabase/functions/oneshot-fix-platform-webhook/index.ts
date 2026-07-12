const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const token = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  const ext = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const url = `${ext}/functions/v1/evolution-webhook?token=${token}`;
  const payload = { webhook: { enabled: true, url, byEvents: false, base64: false, events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"] } };
  const r = await fetch(`${base}/webhook/set/itasuper-platform`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  return new Response(JSON.stringify({ status: r.status, url, body }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});