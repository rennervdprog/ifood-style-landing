// Gera public/sitemap.xml e public/feed.xml a partir do banco (Fase 4 SEO/blog).
// Roda antes do vite build (script "build" do package.json).
// Defensivo: em qualquer falha, mantém os arquivos commitados e sai com 0 —
// um soluço de rede nunca pode derrubar o deploy.
import { readFileSync, writeFileSync } from "node:fs";

const SITE = "https://www.itasuper.com.br";
const STATIC_PATHS = [
  "/",
  "/cliente",
  "/planos",
  "/cadastro-lojista",
  "/cadastro-entregador",
  "/cadastro-motoboy-loja",
  "/download",
  "/links",
  "/portal-parceiro",
  "/termos-de-uso",
  "/politica-de-privacidade",
  "/blog",
];

function citySlug(raw) {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excerpt(md, max = 200) {
  const text = String(md ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`_~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

async function main() {
  const client = readFileSync("src/integrations/supabase/client.ts", "utf8");
  const url = client.match(/"(https:\/\/[a-z0-9]+\.supabase\.co)"/)?.[1];
  const anon = client.match(/"(eyJ[A-Za-z0-9_.-]+)"/)?.[1];
  if (!url || !anon) throw new Error("URL/anon key nao encontrados em client.ts");

  const headers = { apikey: anon, Authorization: `Bearer ${anon}` };
  const get = async (path) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`REST ${res.status} em ${path.split("?")[0]}`);
    return res.json();
  };

  const nowIso = new Date().toISOString();
  const posts = await get(
    "blog_posts?select=slug,title,seo_description,content_md,published_at,updated_at" +
      `&published=eq.true&published_at=lte.${encodeURIComponent(nowIso)}&order=published_at.desc&limit=500`,
  );
  const stores = await get(
    "stores_public?select=slug,address_city&is_matriz=eq.false&status=eq.ativo&limit=500",
  );
  if (!Array.isArray(posts) || posts.length === 0) throw new Error("0 posts — abortando");
  if (!Array.isArray(stores) || stores.length === 0) throw new Error("0 lojas — abortando");

  // ---------- sitemap.xml ----------
  const urls = [];
  for (const p of STATIC_PATHS) urls.push({ loc: SITE + p });
  const cities = [...new Set(stores.map((s) => citySlug(s.address_city)).filter(Boolean))].sort();
  for (const c of cities) urls.push({ loc: `${SITE}/lojas/${c}` });
  for (const s of [...stores].sort((a, b) => a.slug.localeCompare(b.slug))) {
    urls.push({ loc: `${SITE}/${s.slug}` });
  }
  for (const p of posts) {
    const lastmod = (p.updated_at || p.published_at || "").slice(0, 10);
    urls.push({ loc: `${SITE}/blog/${p.slug}`, lastmod: lastmod || undefined });
  }
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`,
      )
      .join("\n") +
    `\n</urlset>\n`;
  writeFileSync("public/sitemap.xml", sitemap);

  // ---------- feed.xml (RSS do blog, 20 posts mais recentes) ----------
  const items = posts.slice(0, 20);
  const feed =
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n` +
    `    <title>Blog ItaSuper — delivery, lojistas e gestão</title>\n` +
    `    <link>${SITE}/blog</link>\n` +
    `    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />\n` +
    `    <description>Conteúdo prático do ItaSuper para restaurantes e lojistas: delivery próprio, cardápio, PDV, entregas e gestão.</description>\n` +
    `    <language>pt-BR</language>\n` +
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n` +
    items
      .map((p) => {
        const link = `${SITE}/blog/${p.slug}`;
        const desc = p.seo_description?.trim() || excerpt(p.content_md);
        return (
          `    <item>\n      <title>${xmlEscape(p.title)}</title>\n      <link>${link}</link>\n` +
          `      <guid isPermaLink="true">${link}</guid>\n` +
          `      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>\n` +
          `      <description>${xmlEscape(desc)}</description>\n    </item>`
        );
      })
      .join("\n") +
    `\n  </channel>\n</rss>\n`;
  writeFileSync("public/feed.xml", feed);

  console.log(
    `[sitemap] gerados: ${urls.length} URLs (${posts.length} posts, ${stores.length} lojas, ${cities.length} cidades) + feed com ${items.length} itens`,
  );
}

main().catch((e) => {
  console.warn(`[sitemap] FALHA (${e.message}) — mantendo os arquivos commitados.`);
  process.exit(0);
});
