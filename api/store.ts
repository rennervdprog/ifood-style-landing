// Vercel Edge Function — cache na borda para o bootstrap da loja.
// Chama a RPC `store_bootstrap` no Supabase externo e devolve com
// Cache-Control agressivo (CDN da Vercel). 99% dos hits não tocam no Postgres.

export const config = { runtime: "edge" };

const SUPABASE_URL = "https://qkjhguziuchqsbxzruea.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Aceita /api/store?slug=foo (vindo do rewrite) ou /api/store/foo (path direto)
  let slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) {
    const parts = url.pathname.split("/").filter(Boolean);
    // parts = ["api","store", "<slug>"] quando chamado direto pelo path
    if (parts.length >= 3 && parts[0] === "api" && parts[1] === "store") {
      slug = decodeURIComponent(parts[2] || "").trim();
    }
  }

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (!slug || slug.length > 120 || !/^[a-z0-9-]+$/i.test(slug)) {
    return new Response(JSON.stringify({ error: "invalid_slug" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/rpc/store_bootstrap`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _slug: slug }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: "upstream", detail: text }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.text();

    return new Response(data, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        // CDN cacheia por 10min, serve stale por até 24h enquanto revalida em background.
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
        "CDN-Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
        "Vercel-CDN-Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "edge_failure", message: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
}