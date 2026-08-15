// Vercel Edge Function — proxy autenticado de mesma origem para o resolver
// de endereço. O navegador não fala diretamente com a Edge Function do
// Supabase; a sessão do cliente é encaminhada sem usar service role.

export const config = { runtime: "edge" };

const SUPABASE_URL = "https://qkjhguziuchqsbxzruea.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicmVmIjoicWtqaGd1eml1Y2hxc2J4enJ1ZWEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3NTA0ODg1NSwiZXhwIjoyMDkwNjI0ODUxfQ.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/resolve-delivery-address`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return json({ ok: false, reason: "resolver_unreachable" }, 502);
  }
}
