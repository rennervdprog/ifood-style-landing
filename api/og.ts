// Vercel Edge Function — serve HTML com Open Graph dinâmico por loja
// para crawlers de link preview (WhatsApp, Facebook, Telegram, Twitter, Slack).
// Usuários reais são redirecionados pra rota SPA da loja.

export const config = { runtime: "edge" };

const SUPABASE_URL = "https://qkjhguziuchqsbxzruea.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";

const SITE = "https://www.itasuper.com.br";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) {
    const parts = url.pathname.split("/").filter(Boolean);
    slug = decodeURIComponent(parts[parts.length - 1] || "").trim();
  }

  if (!slug || !/^[a-z0-9-]+$/i.test(slug) || slug.length > 120) {
    return new Response("invalid slug", { status: 400 });
  }

  const pageUrl = `${SITE}/${slug}`;

  let name = "ItaSuper";
  let description = "Cardápio digital — peça online com entrega rápida.";
  let image = `${SITE}/icon-512.png`;

  try {
    const upstream = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=name,description,image_url&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );
    if (upstream.ok) {
      const rows = (await upstream.json()) as Array<{
        name?: string;
        description?: string | null;
        image_url?: string | null;
      }>;
      const s = rows?.[0];
      if (s?.name) name = s.name;
      if (s?.description) description = s.description;
      if (s?.image_url) image = s.image_url;
    }
  } catch {
    // segue com fallback
  }

  const title = `${name} — Cardápio Digital`;
  const desc = description.length > 200 ? description.slice(0, 197) + "..." : description;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<link rel="canonical" href="${pageUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ItaSuper" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(desc)}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:alt" content="${escapeHtml(name)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(desc)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<meta http-equiv="refresh" content="0; url=${pageUrl}" />
</head>
<body>
<p>Redirecionando para <a href="${pageUrl}">${escapeHtml(name)}</a>…</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}