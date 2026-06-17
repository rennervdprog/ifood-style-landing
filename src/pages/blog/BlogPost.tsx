import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_url: string | null;
  author: string | null;
  published_at: string | null;
  tags: string[];
}

const SITE_URL = "https://itasuper.lovable.app";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      setPost((data as BlogPost) || null);
      setLoading(false);
    })();
  }, [slug]);

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
  const description = post.excerpt || post.title;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    image: post.cover_url || undefined,
    datePublished: post.published_at || undefined,
    author: post.author ? { "@type": "Person", name: post.author } : undefined,
    mainEntityOfPage: url,
  };

  return (
    <>
      <Helmet>
        <title>{post.title} — Blog ItaSuper</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        {post.cover_url && <meta property="og:image" content={post.cover_url} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main className="min-h-screen bg-background">
        <article className="container mx-auto max-w-3xl px-4 py-10">
          <Link to="/blog" className="text-sm text-muted-foreground hover:underline">
            ← Blog
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{post.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {post.author ? `${post.author} • ` : ""}
            {post.published_at
              ? new Date(post.published_at).toLocaleDateString("pt-BR")
              : ""}
          </p>
          {post.cover_url && (
            <img
              src={post.cover_url}
              alt={post.title}
              className="mt-6 aspect-video w-full rounded-lg object-cover"
            />
          )}
          <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content_md}</ReactMarkdown>
          </div>
        </article>
      </main>
    </>
  );
}