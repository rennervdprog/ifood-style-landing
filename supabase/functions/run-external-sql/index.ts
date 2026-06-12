// One-shot: executa SQL arbitrário no projeto Supabase EXTERNO via Management API.
// Auth: exige o EXTERNAL_SUPABASE_ACCESS_TOKEN (PAT) ou EXTERNAL_SUPABASE_SERVICE_KEY no header.
const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";
const EXT_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!auth || (auth !== EXT_KEY && auth !== TOKEN)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const query: string = body?.query || "";
  if (!query) return new Response(JSON.stringify({ error: "missing query" }), { status: 400 });

  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});