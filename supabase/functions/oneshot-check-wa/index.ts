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
