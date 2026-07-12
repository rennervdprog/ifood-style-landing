import { createClient } from "npm:@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const secrets = [
    { name: "EVOLUTION_API_URL", value: Deno.env.get("EVOLUTION_API_URL") ?? "" },
    { name: "EVOLUTION_GLOBAL_API_KEY", value: Deno.env.get("EVOLUTION_GLOBAL_API_KEY") ?? "" },
    { name: "EVOLUTION_API_KEY", value: Deno.env.get("EVOLUTION_API_KEY") ?? "" },
  ].filter((s) => s.value);
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(secrets),
  });
  const text = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: text, sent: secrets.map((s) => s.name) }), {
    headers: { "Content-Type": "application/json" },
  });
});