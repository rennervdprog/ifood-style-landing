const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || Deno.env.get("EVOLUTION_API_KEY") || "";
  const results: any = {};
  for (const inst of ["store-b97f3a1a", "itasuper-platform"]) {
    const r = await fetch(`${base}/message/sendText/${inst}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ number: "5514991624997", text: `Teste envio de ${inst} - ItaSuper` }),
    });
    results[inst] = { status: r.status, body: await r.text() };
  }
  return new Response(JSON.stringify(results, null, 2), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
