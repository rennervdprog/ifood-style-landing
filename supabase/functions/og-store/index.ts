import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const storeId = url.searchParams.get("id");

    if (!slug && !storeId) {
      return new Response("Missing slug or id", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from("stores")
      .select("id, name, slug, image_url, category")
      .in("status", ["ativo"]);

    if (slug) query = query.eq("slug", slug);
    else if (storeId) query = query.eq("id", storeId);

    const { data: store, error } = await query.single();

    if (error || !store) {
      return new Response("Store not found", { status: 404 });
    }

    const appUrl = "https://itasuper.lovable.app";
    const storeUrl = store.slug ? `${appUrl}/${store.slug}` : `${appUrl}/loja/${store.id}`;
    const title = `${store.name} - ItaSuper`;
    const description = `Peça pelo ItaSuper: ${store.name} - ${store.category}. Entrega rápida em Itatinga!`;
    const image = store.image_url || `${appUrl}/icon-192x192.png`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${storeUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="ItaSuper">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <title>${title}</title>
  <meta http-equiv="refresh" content="0;url=${storeUrl}">
</head>
<body>
  <p>Redirecionando para <a href="${storeUrl}">${store.name}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return new Response("Internal error", { status: 500 });
  }
});
