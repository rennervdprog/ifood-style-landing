// Vercel Edge Function — serve HTML completo do blog para crawlers
// (buscadores e robôs de preview social): metas do post + o CONTEÚDO no
// corpo, que é o que a casca da SPA não entrega. Espelho da api/og.ts
// (lojas), com duas diferenças de propósito: aqui há texto de verdade
// (por isso NÃO há meta-refresh) e slug inexistente responde 404.
// Visitantes comuns não passam por aqui: as regras do vercel.json só
// casam user-agents de robô; o humano segue na SPA, sem mudar nada.

export const config = { runtime: "edge" };

const SUPABASE_URL = "https://qkjhguziuchqsbxzruea.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";

const SITE = "https://www.itasuper.com.br";
const DEFAULT_IMAGE = `${SITE}/og-cover.webp`;
const CACHE_OK = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
const CACHE_404 = "public, max-age=0, s-maxage=60, stale-while-revalidate=600";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Conversão enxuta de Markdown pra HTML (o conteúdo dos posts usa
// títulos, listas, negrito, links e código). Escapa tudo ANTES de
// converter: as marcações MD sobrevivem ao escape e o texto do post
// nunca vira HTML cru.
function inlineMd(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(md: string): string {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listOrdered = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inlineMd(escapeHtml(paragraph.join(" ")))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const tag = listOrdered ? "ol" : "ul";
      out.push(
        `<${tag}>` +
          list.map((i) => `<li>${inlineMd(escapeHtml(i))}</li>`).join("") +
          `</${tag}>`,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length, 3);
      out.push(`<h${level}>${inlineMd(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      out.push("<hr>");
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !bullet;
      if (list.length && ordered !== listOrdered) flushList();
      listOrdered = ordered;
      list.push((bullet || numbered)![1]);
      continue;
    }
    flushList();
    paragraph.push(line.replace(/^>\s?/, ""));
  }
  flushParagraph();
  flushList();
  return out.join("\n");
}

interface BlogPostRow {
  title?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  excerpt?: string | null;
  cover_url?: string | null;
  og_image?: string | null;
  content_md?: string | null;
  category?: string | null;
  author?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

async function supabaseGet(path: string): Promise<unknown[] | null> {
  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!upstream.ok) return null;
    const rows = (await upstream.json()) as unknown[];
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// Mesma regra de visibilidade do front (BlogPost.tsx):
// published = true e published_at <= agora.
function visibilityFilter(): string {
  return `published=eq.true&published_at=lte.${encodeURIComponent(new Date().toISOString())}`;
}

function htmlResponse(html: string, status: number, cache: string): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache },
  });
}

function notFoundHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Post não encontrado | Blog ItaSuper</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}/blog">
</head>
<body>
<h1>Post não encontrado</h1>
<p>Este conteúdo não existe ou ainda não foi publicado. Veja todos os artigos em <a href="${SITE}/blog">Blog ItaSuper</a>.</p>
</body>
</html>`;
}

async function postHtml(slug: string): Promise<Response> {
  const select =
    "title,seo_title,seo_description,excerpt,cover_url,og_image,content_md,category,author,published_at,updated_at";
  const rows = await supabaseGet(
    `blog_posts?slug=eq.${encodeURIComponent(slug)}&${visibilityFilter()}&select=${select}&limit=1`,
  );
  const post = (rows?.[0] ?? null) as BlogPostRow | null;
  if (!post || !post.title) {
    return htmlResponse(notFoundHtml(), 404, CACHE_404);
  }

  const pageUrl = `${SITE}/blog/${slug}`;
  const title = (post.seo_title || post.title).trim();
  const description = (
    post.seo_description ||
    post.excerpt ||
    "Blog ItaSuper — guias e dicas para vender mais no delivery."
  ).trim();
  const image = post.og_image || post.cover_url || DEFAULT_IMAGE;
  const author = (post.author || "Equipe ItaSuper").trim();
  const published = post.published_at || undefined;
  const modified = post.updated_at || post.published_at || undefined;
  const dateLabel = published
    ? new Date(published).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: [image],
    datePublished: published,
    dateModified: modified,
    author: { "@type": "Organization", name: author },
    publisher: { "@type": "Organization", name: "ItaSuper" },
    mainEntityOfPage: pageUrl,
  };

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} | Blog ItaSuper</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ItaSuper">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${escapeHtml(image)}">
${published ? `<meta property="article:published_time" content="${escapeHtml(published)}">` : ""}
${modified ? `<meta property="article:modified_time" content="${escapeHtml(modified)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script type="application/ld+json">${JSON.stringify(articleLd)}</script>
</head>
<body>
<article>
<h1>${escapeHtml(post.title)}</h1>
<p>${escapeHtml(author)}${dateLabel ? ` · ${escapeHtml(dateLabel)}` : ""}${post.category ? ` · ${escapeHtml(post.category)}` : ""}</p>
${post.cover_url ? `<img src="${escapeHtml(post.cover_url)}" alt="${escapeHtml(post.title)}">` : ""}
${post.excerpt ? `<p><em>${escapeHtml(post.excerpt)}</em></p>` : ""}
${markdownToHtml(post.content_md || "")}
<p><a href="${pageUrl}">Leia este artigo no site do ItaSuper</a></p>
</article>
</body>
</html>`;

  return htmlResponse(html, 200, CACHE_OK);
}

async function indexHtml(): Promise<Response> {
  const rows = (await supabaseGet(
    `blog_posts?${visibilityFilter()}&select=title,slug,excerpt,category,published_at&order=published_at.desc&limit=30`,
  )) as Array<{
    title?: string;
    slug?: string;
    excerpt?: string | null;
    category?: string | null;
    published_at?: string | null;
  }> | null;

  const items = (rows ?? [])
    .filter((p) => p.title && p.slug)
    .map((p) => {
      const url = `${SITE}/blog/${p.slug}`;
      const date = p.published_at
        ? new Date(p.published_at).toLocaleDateString("pt-BR")
        : "";
      return `<article><h2><a href="${url}">${escapeHtml(p.title!)}</a></h2>${
        p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ""
      }<p>${escapeHtml(p.category || "")}${date ? ` · ${escapeHtml(date)}` : ""}</p></article>`;
    })
    .join("\n");

  const pageUrl = `${SITE}/blog`;
  const title = "Blog ItaSuper — delivery, lojistas e Itatinga";
  const description =
    "Guias, comparativos e dicas para restaurantes, lanchonetes e mercados venderem mais no delivery em Itatinga e região.";

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ItaSuper">
<meta property="og:title" content="Blog ItaSuper">
<meta property="og:description" content="Guias, comparativos e dicas para vender mais no delivery.">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${DEFAULT_IMAGE}">
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
<h1>Blog ItaSuper</h1>
<p>${escapeHtml(description)}</p>
${items}
</body>
</html>`;

  return htmlResponse(html, 200, CACHE_OK);
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.searchParams.get("type") === "index") {
    return indexHtml();
  }

  let slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) {
    const parts = url.pathname.split("/").filter(Boolean);
    slug = decodeURIComponent(parts[parts.length - 1] || "").trim();
  }

  if (!slug || !/^[a-z0-9-]+$/i.test(slug) || slug.length > 120) {
    return htmlResponse(notFoundHtml(), 404, CACHE_404);
  }

  return postHtml(slug);
}
