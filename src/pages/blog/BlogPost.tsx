import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { Clock, Share2, Link as LinkIcon, ArrowRight, ListOrdered } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import NewsletterSignup from "@/components/blog/NewsletterSignup";

const BlogComments = lazy(() => import("@/components/blog/BlogComments"));

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_url: string | null;
  author: string | null;
  published_at: string | null;
  updated_at?: string | null;
  tags: string[];
  category: string | null;
  reading_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
}

interface RelatedPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  category: string | null;
  reading_minutes: number | null;
}

const SITE_URL = "https://itasuper.com.br";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function extractHeadings(md: string) {
  const lines = md.split("\n");
  const out: { level: 2 | 3; text: string; id: string }[] = [];
  let inCode = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*$/);
    if (m) {
      const level = m[1].length as 2 | 3;
      const text = m[2].replace(/[*_`]/g, "");
      out.push({ level, text, id: slugify(text) });
    }
  }
  return out;
}

function estimateMinutes(md: string) {
  const words = md.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .lte("published_at", new Date().toISOString())
        .maybeSingle();
      setPost((data as BlogPost) || null);
      setLoading(false);
      window.scrollTo({ top: 0 });
    })();
  }, [slug]);

  // Track view (anonymous, throttled per session)
  useEffect(() => {
    if (!slug) return;
    const key = `blog_view_${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    (supabase as any).rpc("blog_increment_view", {
      _slug: slug,
      _ip_hash: null,
      _user_agent: navigator.userAgent.slice(0, 200),
      _referrer: document.referrer ? document.referrer.slice(0, 500) : null,
    }).then(() => {}, () => {});
  }, [slug]);

  // load related (same category, different slug)
  useEffect(() => {
    if (!post) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, category, reading_minutes")
        .eq("published", true)
        .lte("published_at", new Date().toISOString())
        .neq("id", post.id)
        .order("published_at", { ascending: false })
        .limit(3);
      setRelated(((data as RelatedPost[]) || []).slice(0, 3));
    })();
  }, [post]);

  // reading progress
  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const top = el.offsetTop;
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = window.scrollY - top;
      const pct = Math.min(100, Math.max(0, (scrolled / Math.max(1, total)) * 100));
      setProgress(pct);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [post]);

  const headings = useMemo(
    () => (post ? extractHeadings(post.content_md) : []),
    [post]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto max-w-3xl px-4 py-10">
          <Helmet>
            <title>Post não encontrado — Blog ItaSuper</title>
            <meta name="robots" content="noindex" />
          </Helmet>
          <p>Post não encontrado.</p>
          <Link to="/blog" className="text-primary hover:underline">
            ← Voltar ao blog
          </Link>
        </div>
      </main>
    );
  }

  const url = `${SITE_URL}/blog/${post.slug}`;
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || post.title;
  const minutes = post.reading_minutes ?? estimateMinutes(post.content_md);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    image: post.cover_url ? [post.cover_url] : undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    author: { "@type": "Organization", name: post.author || "ItaSuper" },
    publisher: {
      "@type": "Organization",
      name: "ItaSuper",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
    },
    mainEntityOfPage: url,
    timeRequired: `PT${minutes}M`,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  const shareWhats = `https://wa.me/?text=${encodeURIComponent(`${post.title} — ${url}`)}`;
  const shareTwitter = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <>
      <Helmet>
        <title>{title} — Blog ItaSuper</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        {post.cover_url && <meta property="og:image" content={post.cover_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {post.cover_url && <meta name="twitter:image" content={post.cover_url} />}
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>

      {/* progress bar */}
      <div
        className="blog-progress"
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden="true"
      />

      <main className="min-h-screen bg-background">
        {/* HEADER */}
        <header className="border-b border-border bg-gradient-to-b from-accent/30 to-background">
          <div className="container mx-auto max-w-3xl px-4 pt-8 pb-10 md:pt-12 md:pb-14">
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Início</Link>
              <span>/</span>
              <Link to="/blog" className="hover:text-foreground">Blog</Link>
              {post.category && (
                <>
                  <span>/</span>
                  <span>{post.category}</span>
                </>
              )}
            </nav>
            {post.category && (
              <span className="mt-5 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                {post.category}
              </span>
            )}
            <h1 className="font-editorial mt-4 text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-4 text-base md:text-lg text-muted-foreground">
                {post.excerpt}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {post.author ?? "Equipe ItaSuper"}
              </span>
              <span>·</span>
              <span>
                {post.published_at
                  ? new Date(post.published_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : ""}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {minutes} min de leitura
              </span>
            </div>
          </div>
        </header>

        {/* COVER */}
        {post.cover_url && (
          <div className="container mx-auto max-w-4xl px-4 -mt-2">
            <img
              src={post.cover_url}
              alt={post.title}
              width={1280}
              height={720}
              className="aspect-video w-full rounded-2xl object-cover shadow-lg"
            />
          </div>
        )}

        {/* BODY + SIDEBAR */}
        <div className="container mx-auto max-w-6xl px-4 py-10 md:py-14 grid gap-10 lg:grid-cols-[1fr_240px]">
          <article ref={articleRef} className="blog-prose min-w-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
              {post.content_md}
            </ReactMarkdown>

            {/* CTA inline */}
            <div className="not-prose mt-12 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-accent p-6 md:p-8">
              <h3 className="font-editorial text-xl md:text-2xl font-bold">
                Quer vender mais com taxa justa?
              </h3>
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                Cadastre sua loja na ItaSuper em 2 minutos — plataforma regional,
                comissão mais baixa que os grandes apps e suporte humano.
              </p>
              <Link
                to="/cadastro-lojista"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Cadastrar minha loja <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* share */}
            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Compartilhar
              </span>
              <a
                href={shareWhats}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a
                href={shareTwitter}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" /> X / Twitter
              </a>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <LinkIcon className="h-3.5 w-3.5" /> Copiar link
              </button>
            </div>
          </article>

          {/* TOC sidebar (desktop) */}
          {headings.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListOrdered className="h-3.5 w-3.5" /> Neste artigo
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {headings.map((h) => (
                    <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                      <a
                        href={`#${h.id}`}
                        className="text-muted-foreground hover:text-foreground transition-colors line-clamp-2"
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}
        </div>

        {/* RELATED */}
        {related.length > 0 && (
          <section className="border-t border-border bg-muted/30">
            <div className="container mx-auto max-w-5xl px-4 py-12">
              <h2 className="font-editorial text-2xl md:text-3xl font-bold tracking-tight">
                Leia também
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    to={`/blog/${r.slug}`}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg hover:-translate-y-0.5"
                  >
                    {r.cover_url ? (
                      <div className="aspect-video overflow-hidden bg-muted">
                        <img
                          src={r.cover_url}
                          alt={r.title}
                          loading="lazy"
                          width={1280}
                          height={720}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gradient-to-br from-primary/15 to-accent" />
                    )}
                    <div className="p-4">
                      {r.category && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                          {r.category}
                        </span>
                      )}
                      <h3 className="font-editorial mt-1.5 text-base font-bold leading-snug line-clamp-2">
                        {r.title}
                      </h3>
                      {r.reading_minutes && (
                        <p className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {r.reading_minutes} min
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}