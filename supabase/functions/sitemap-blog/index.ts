import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://itasuper.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at, published_at, category")
    .eq("published", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  const { data: cats } = await supabase
    .from("blog_categories")
    .select("slug");

  const items: string[] = [];
  items.push(`<url><loc>${SITE_URL}/blog</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`);

  for (const c of (cats as { slug: string }[] | null) ?? []) {
    items.push(`<url><loc>${SITE_URL}/blog/categoria/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  }

  for (const p of (posts as { slug: string; updated_at: string; published_at: string }[] | null) ?? []) {
    const lastmod = (p.updated_at || p.published_at || new Date().toISOString()).slice(0, 10);
    items.push(`<url><loc>${SITE_URL}/blog/${p.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
});