import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Fuse from "fuse.js";
import { Search, ArrowRight, Rocket, Bike, TrendingUp } from "lucide-react";
import NewsletterSignup from "@/components/blog/NewsletterSignup";
import { BlogCard, BlogCover, blogCategoryStyle, formatBlogDate } from "@/components/blog/BlogCover";
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

const SITE_URL = "https://www.itasuper.com.br";

/**
 * Trilhas por intenção (padrão "Jornadas" do blog de parceiros do iFood):
 * o lojista se reconhece na hora, em vez de encarar 10 categorias soltas.
 * Cada trilha filtra a grade pelas categorias do tema.
 */
const JOURNEYS = [
  {
    id: "comecar",
    title: "Começar um negócio",
    desc: "Do zero ao primeiro pedido: abertura, cardápio e os erros que custam caro no começo.",
    cats: ["Guias", "Guia", "Lojistas"],
    icon: Rocket,
  },
  {
    id: "delivery",
    title: "Começar no delivery",
    desc: "Delivery próprio ou marketplace? Taxas, raio, pedido mínimo e o combo com WhatsApp.",
    cats: ["Delivery", "Entregas", "Financeiro"],
    icon: Bike,
  },
  {
    id: "vender",
    title: "Vender mais todo dia",
    desc: "Google, avaliações, almoço executivo e os ajustes finos de quem já vende.",
    cats: ["Marketing", "SEO", "Cardápio", "Operação", "Nichos"],
    icon: TrendingUp,
  },
] as const;

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
  const [journey, setJourney] = useState<string | null>(null);

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
    const activeJourney = JOURNEYS.find((j) => j.id === journey);
    if (activeJourney) {
      list = list.filter((p) => p.category && (activeJourney.cats as readonly string[]).includes(p.category));
    }
    if (activeCat !== "Todos") list = list.filter((p) => p.category === activeCat);
    if (q.trim()) {
      const hits = fuse.search(q.trim()).map((r) => r.item);
      const ids = new Set(hits.map((h) => h.id));
      list = list.filter((p) => ids.has(p.id));
    }
    return list;
  }, [posts, activeCat, q, fuse, journey]);

  const featured = filtered.find((p) => p.featured) ?? filtered[0];
  const rest = filtered.filter((p) => p.id !== featured?.id);

  // O destaque editorial só aparece na home "limpa" — com busca, categoria
  // ou trilha ativa, tudo vai pra grade, sem post duplicado em cima.
  const anyFilter = journey !== null || activeCat !== "Todos" || q.trim() !== "";
  const showFeatured = !anyFilter && !!featured;
  const gridPosts = showFeatured ? rest : filtered;
  const activeJourney = JOURNEYS.find((j) => j.id === journey);
  const sectionTitle = activeJourney
    ? activeJourney.title
    : activeCat !== "Todos"
      ? activeCat
      : "Últimos artigos";

  const clearFilters = () => {
    setJourney(null);
    setActiveCat("Todos");
    setQ("");
  };

  const selectJourney = (id: string) => {
    setJourney((cur) => (cur === id ? null : id));
    setActiveCat("Todos");
    requestAnimationFrame(() => {
      document.getElementById("ultimos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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
        <section className="border-b border-border">
          <div className="container mx-auto max-w-5xl px-4 pt-10 pb-10 md:pt-14 md:pb-12">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Início
            </Link>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
              Blog ItaSuper
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl md:text-[3.4rem] font-extrabold leading-[1.08] tracking-tight">
              Ideias práticas pra sua loja{" "}
              <span className="text-primary">vender mais</span> — sem enrolação.
            </h1>
            <p className="mt-4 max-w-xl text-base md:text-lg text-muted-foreground">
              Guias, comparativos honestos e bastidores de quem vende comida
              de bairro, escritos pra quem tem pouco tempo e muito boleto.
            </p>
            <div className="mt-7 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm max-w-md focus-within:ring-2 focus-within:ring-primary/30">
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
          </div>
        </section>

        {/* TRILHAS POR INTENÇÃO */}
        <section className="container mx-auto max-w-5xl px-4 pt-8">
          <div className="grid gap-4 md:grid-cols-3">
            {JOURNEYS.map((j) => {
              const Icon = j.icon;
              const active = journey === j.id;
              return (
                <button
                  key={j.id}
                  onClick={() => selectJourney(j.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    active
                      ? "border-primary ring-1 ring-primary"
                      : "border-border"
                  }`}
                >
                  <span className="inline-flex rounded-[10px] bg-primary p-2 text-primary-foreground">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="mt-3.5 block text-[1.05rem] font-extrabold tracking-tight">
                    {j.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                    {j.desc}
                  </span>
                  <span className="mt-3 block text-[13px] font-bold text-primary">
                    {active ? "Vendo esta trilha ✓" : "Ver a trilha →"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* CONTEÚDO */}
        <section className="container mx-auto max-w-5xl px-4 py-10 md:py-12">
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
                Nenhum artigo encontrado.{" "}
                <button onClick={clearFilters} className="font-semibold text-primary hover:underline">
                  Limpar a busca
                </button>
              </p>
            </div>
          ) : (
            <>
              {/* DESTAQUE EDITORIAL */}
              {showFeatured && featured && (
                <>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                    Em destaque
                  </p>
                  <Link
                    to={`/blog/${featured.slug}`}
                    className="group mt-3 block overflow-hidden rounded-3xl border border-border bg-card transition-all hover:shadow-xl"
                  >
                    <div className="grid md:grid-cols-[1.25fr_1fr]">
                      <div className="aspect-video overflow-hidden bg-muted md:aspect-auto md:h-full">
                        <BlogCover
                          title={featured.title}
                          category={featured.category}
                          coverUrl={featured.cover_url}
                        />
                      </div>
                      <div className="flex flex-col justify-center p-6 md:p-8">
                        {featured.category && (
                          <span
                            className="self-start rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: blogCategoryStyle(featured.category).bg }}
                          >
                            {featured.category}
                          </span>
                        )}
                        <h2 className="mt-4 text-2xl md:text-[1.7rem] font-extrabold leading-tight tracking-tight">
                          {featured.title}
                        </h2>
                        {featured.excerpt && (
                          <p className="mt-3 text-muted-foreground line-clamp-3">
                            {featured.excerpt}
                          </p>
                        )}
                        <div className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span className="text-foreground">{featured.author ?? "Equipe ItaSuper"}</span>
                          <span>·</span>
                          <span>{formatBlogDate(featured.published_at)}</span>
                          {featured.reading_minutes ? (
                            <>
                              <span>·</span>
                              <span>{featured.reading_minutes} min de leitura</span>
                            </>
                          ) : null}
                        </div>
                        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                          Ler artigo{" "}
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </>
              )}

              {/* GRADE */}
              <div id="ultimos" className={`${showFeatured ? "mt-12" : ""} scroll-mt-24`}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-sm font-extrabold uppercase tracking-[0.14em]">
                    {sectionTitle}
                  </h2>
                  {anyFilter && (
                    <button
                      onClick={clearFilters}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Limpar filtros ×
                    </button>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActiveCat(c)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors border ${
                        activeCat === c
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {gridPosts.map((p) => (
                    <BlogCard key={p.id} post={p} />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* NEWSLETTER — produto nomeado */}
        <section className="container mx-auto max-w-5xl px-4 pb-14">
          <div className="grid items-center gap-6 rounded-3xl bg-neutral-900 px-6 py-8 md:grid-cols-[1.2fr_1fr] md:p-10">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                ItaSuper <span className="text-primary">na Prática</span>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300 md:text-base">
                Uma ideia por semana pra vender mais no seu bairro. Sem spam,
                sem enrolação — e você sai quando quiser.
              </p>
            </div>
            <NewsletterSignup variant="inline" source="blog-index" />
          </div>
        </section>
      </main>
    </>
  );
}
