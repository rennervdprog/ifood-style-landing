Deno.serve(async () => {
  const base = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
  const key = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") || "";
  const out: any = {};
  for (const inst of ["store-b97f3a1a", "itasuper-platform"]) {
    const s = await fetch(`${base}/instance/connectionState/${inst}`, { headers: { apikey: key } });
    const f = await fetch(`${base}/instance/fetchInstances?instanceName=${inst}`, { headers: { apikey: key } });
    out[inst] = { state: await s.json().catch(()=>null), fetch: await f.json().catch(()=>null) };
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
});
