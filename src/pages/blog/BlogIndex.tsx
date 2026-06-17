import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Fuse from "fuse.js";
import { Search, Clock, ArrowRight } from "lucide-react";
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
  category: string | null;
  reading_minutes: number | null;
  featured: boolean;
}

const SITE_URL = "https://itasuper.com.br";

function fmtDate(s: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("Todos");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("blog_posts")
        .select(
          "id, slug, title, excerpt, cover_url, author, published_at, tags, category, reading_minutes, featured"
        )
        .eq("published", true)
        .lte("published_at", new Date().toISOString())
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(50);
      setPosts((data as BlogPost[]) || []);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.category && set.add(p.category));
    return ["Todos", ...Array.from(set)];
  }, [posts]);

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: ["title", "excerpt", "tags", "category"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [posts]
  );

  const filtered = useMemo(() => {
    let list = posts;
    if (activeCat !== "Todos") list = list.filter((p) => p.category === activeCat);
    if (q.trim()) {
      const hits = fuse.search(q.trim()).map((r) => r.item);
      const ids = new Set(hits.map((h) => h.id));
      list = list.filter((p) => ids.has(p.id));
    }
    return list;
  }, [posts, activeCat, q, fuse]);

  const featured = filtered.find((p) => p.featured) ?? filtered[0];
  const rest = filtered.filter((p) => p.id !== featured?.id);

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Blog ItaSuper",
    url: `${SITE_URL}/blog`,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/blog?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
    ],
  };

  return (
    <>
      <Helmet>
        <title>Blog ItaSuper — delivery, lojistas e Itatinga</title>
        <meta
          name="description"
          content="Guias, comparativos e dicas para restaurantes, lanchonetes e mercados venderem mais no delivery em Itatinga e região."
        />
        <link rel="canonical" href={`${SITE_URL}/blog`} />
        <meta property="og:title" content="Blog ItaSuper" />
        <meta
          property="og:description"
          content="Guias, comparativos e dicas para vender mais no delivery."
        />
        <meta property="og:url" content={`${SITE_URL}/blog`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(websiteLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background">
        {/* HERO */}
        <section className="border-b border-border bg-gradient-to-b from-accent/30 via-background to-background">
          <div className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Início
            </Link>
            <h1 className="font-editorial mt-5 text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
              O blog do delivery
              <br />
              <span className="text-primary">de bairro.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base md:text-lg text-muted-foreground">
              Guias práticos, comparativos honestos e bastidores de quem vende
              comida em Itatinga e cidades vizinhas — sem enrolação.
            </p>

            {/* search */}
            <div className="mt-8 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm max-w-md focus-within:ring-2 focus-within:ring-primary/30">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar no blog…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                aria-label="Buscar no blog"
              />
            </div>

            {/* categories */}
            <div className="mt-5 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCat(c)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border ${
                    activeCat === c
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* CONTENT */}
        <section className="container mx-auto max-w-5xl px-4 py-10 md:py-14">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-border bg-card p-4"
                >
                  <div className="aspect-video w-full rounded-xl bg-muted" />
                  <div className="mt-4 h-5 w-3/4 rounded bg-muted" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">
                Nenhum post encontrado. Tente outra busca ou categoria.
              </p>
            </div>
          ) : (
            <>
              {/* FEATURED */}
              {featured && (
                <Link
                  to={`/blog/${featured.slug}`}
                  className="group block overflow-hidden rounded-3xl border border-border bg-card transition-all hover:shadow-xl hover:-translate-y-0.5"
                >
                  <div className="grid md:grid-cols-2">
                    {featured.cover_url && (
                      <div className="aspect-video md:aspect-auto md:h-full overflow-hidden bg-muted">
                        <img
                          src={featured.cover_url}
                          alt={featured.title}
                          width={1280}
                          height={720}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                          Em destaque
                        </span>
                        {featured.category && (
                          <span className="text-muted-foreground">
                            • {featured.category}
                          </span>
                        )}
                      </div>
                      <h2 className="font-editorial mt-4 text-2xl md:text-3xl font-bold leading-tight tracking-tight">
                        {featured.title}
                      </h2>
                      {featured.excerpt && (
                        <p className="mt-3 text-muted-foreground line-clamp-3">
                          {featured.excerpt}
                        </p>
                      )}
                      <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{featured.author ?? "Equipe ItaSuper"}</span>
                        <span>•</span>
                        <span>{fmtDate(featured.published_at)}</span>
                        {featured.reading_minutes && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {featured.reading_minutes} min
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                        Ler artigo <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* GRID */}
              {rest.length > 0 && (
                <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => (
                    <Link
                      key={p.id}
                      to={`/blog/${p.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5"
                    >
                      {p.cover_url ? (
                        <div className="aspect-video overflow-hidden bg-muted">
                          <img
                            src={p.cover_url}
                            alt={p.title}
                            loading="lazy"
                            width={1280}
                            height={720}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-primary/15 to-accent" />
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        {p.category && (
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                            {p.category}
                          </span>
                        )}
                        <h3 className="font-editorial mt-2 text-lg font-bold leading-snug line-clamp-2">
                          {p.title}
                        </h3>
                        {p.excerpt && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {p.excerpt}
                          </p>
                        )}
                        <div className="mt-auto pt-4 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{fmtDate(p.published_at)}</span>
                          {p.reading_minutes && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {p.reading_minutes} min
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}