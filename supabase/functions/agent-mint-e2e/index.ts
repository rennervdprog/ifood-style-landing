// Agent-only helper: mints a session for the fixed E2E user by relaying
// to e2e-mint-session on the external project. Auth: verify_jwt=true so only
// an authenticated preview user (i.e. the Lovable agent tool) can invoke.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const EXT_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
  const TOKEN = Deno.env.get("E2E_SETUP_TOKEN") ?? "";
  if (!TOKEN) return new Response(JSON.stringify({ error: "no token" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const r = await fetch(`${EXT_URL}/functions/v1/e2e-mint-session`, {
    method: "POST",
    headers: { "x-e2e-token": TOKEN, apikey: ANON, "Content-Type": "application/json" },
    body: "{}",
  });
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
});