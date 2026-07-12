Deno.serve(async () => {
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const token = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") || "";
  const functionBase = Deno.env.get("SUPABASE_URL");
  const out: any = {};
  const setWebhook = async (inst: string, url: string) => {
    const r = await fetch(`${base}/webhook/set/${inst}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({
        webhook: {
          enabled: true, url, byEvents: false, base64: false,
          events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"],
        },
      }),
    });
    return { status: r.status, body: await r.json().catch(()=>null) };
  };
  out.store_set = await setWebhook("store-b97f3a1a", `${functionBase}/functions/v1/evolution-webhook?token=${token}`);
  out.platform_set = await setWebhook("itasuper-platform", `${functionBase}/functions/v1/evolution-webhook?token=${token}`);
  out.store_find = await (await fetch(`${base}/webhook/find/store-b97f3a1a`, { headers: { apikey: key } })).json().catch(()=>null);
  out.platform_find = await (await fetch(`${base}/webhook/find/itasuper-platform`, { headers: { apikey: key } })).json().catch(()=>null);
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
});
