const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const token = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  const ext = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const target = `${ext}/functions/v1/evolution-webhook?token=${token}`;

  const list = await fetch(`${base}/instance/fetchInstances`, { headers: { apikey: key } }).then(r => r.json());
  const results: any[] = [];
  for (const inst of list) {
    const name = inst?.name || inst?.instance?.instanceName || inst?.instanceName;
    if (!name) continue;
    const w = await fetch(`${base}/webhook/find/${name}`, { headers: { apikey: key } });
    const wj = await w.json().catch(() => ({}));
    const currentUrl = wj?.url || wj?.webhook?.url || "";
    let repaired: any = null;
    if (!currentUrl || !currentUrl.includes("token=")) {
      const payload = { webhook: { enabled: true, url: target, byEvents: false, base64: false, events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"] } };
      const r = await fetch(`${base}/webhook/set/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify(payload),
      });
      repaired = { status: r.status, body: await r.json().catch(() => ({})) };
    }
    results.push({ name, currentUrl, repaired });
  }
  return new Response(JSON.stringify({ target, count: results.length, results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});