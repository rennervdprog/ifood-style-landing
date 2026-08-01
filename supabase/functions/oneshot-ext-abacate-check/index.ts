const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const doSync = url.searchParams.get("sync") === "1";
  const out: Record<string, unknown> = {};

  const sr = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, { headers: { Authorization: `Bearer ${PAT}` } });
  const secrets = await sr.json().catch(() => []);
  const names = Array.isArray(secrets) ? secrets.map((s: any) => s.name) : secrets;
  out.external_secret_names = names;

  if (doSync) {
    const payload = [
      { name: "ABACATEPAY_API_KEY", value: Deno.env.get("ABACATEPAY_API_KEY") || "" },
      { name: "ABACATEPAY_WEBHOOK_SECRET", value: Deno.env.get("ABACATEPAY_WEBHOOK_SECRET") || "" },
    ].filter((s) => s.value);
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    out.sync = { status: r.status, body: await r.text(), synced: payload.map((p) => p.name) };
  }

  const br = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/store-platform-fee-pix/body`, { headers: { Authorization: `Bearer ${PAT}` } });
  const body = await br.text();
  out.ext_fn_has_abacate = body.includes("abacatepay");
  out.ext_fn_len = body.length;

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
