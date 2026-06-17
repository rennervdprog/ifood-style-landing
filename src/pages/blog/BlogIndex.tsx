import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  author: string | null;
  published_at: string | null;
  tags: string[];
}

const SITE_URL = "https://itasuper.lovable.app";

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, author, published_at, tags")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(50);
      setPosts((data as BlogPost[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <Helmet>
        <title>Blog ItaSuper — dicas, novidades e bastidores do delivery</title>
        <meta
          name="description"
          content="Conteúdo para clientes, lojistas e entregadores: dicas de delivery, novidades do ItaSuper e bastidores do app."
        />
        <link rel="canonical" href={`${SITE_URL}/blog`} />
        <meta property="og:title" content="Blog ItaSuper" />
        <meta property="og:url" content={`${SITE_URL}/blog`} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="min-h-screen bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-10">
          <header className="mb-8">
            <Link to="/" className="text-sm text-muted-foreground hover:underline">
              ← Voltar
            </Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Blog ItaSuper</h1>
            <p className="mt-2 text-muted-foreground">
              Dicas, novidades e bastidores do delivery em Itatinga e região.
            </p>
          </header>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum post publicado ainda.</p>
          ) : (
            <ul className="space-y-6">
              {posts.map((p) => (
                <li key={p.id} className="border-b border-border pb-6 last:border-b-0">
                  <Link to={`/blog/${p.slug}`} className="group block">
                    {p.cover_url && (
                      <img
                        src={p.cover_url}
                        alt={p.title}
                        loading="lazy"
                        className="mb-3 aspect-video w-full rounded-lg object-cover"
                      />
                    )}
                    <h2 className="text-xl font-semibold group-hover:underline">{p.title}</h2>
                    {p.excerpt && (
                      <p className="mt-1 text-sm text-muted-foreground">{p.excerpt}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {p.author ? `${p.author} • ` : ""}
                      {p.published_at
                        ? new Date(p.published_at).toLocaleDateString("pt-BR")
                        : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}