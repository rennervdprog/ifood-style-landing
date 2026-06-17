import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Store as StoreIcon, ArrowLeft, MapPin, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StoreCard from "@/components/StoreCard";
import { citySlug, cityDisplay } from "@/lib/citySlug";

interface StoreRow {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  category: string | null;
  is_open: boolean | null;
  force_closed: boolean | null;
  rating: number | null;
  address_city: string | null;
  address_neighborhood: string | null;
}

const BASE_URL = "https://itasuper.lovable.app";

export default function CityStoresPage() {
  const { cidade } = useParams<{ cidade: string }>();
  const slug = (cidade || "").toLowerCase();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("stores_public")
        .select("id, name, slug, image_url, category, is_open, force_closed, rating, address_city, address_neighborhood")
        .eq("status", "ativo")
        .limit(200);
      if (cancelled) return;
      const filtered = ((data || []) as StoreRow[]).filter(
        (s) => citySlug(s.address_city) === slug,
      );
      const cityRaw = filtered[0]?.address_city || slug.replace(/-/g, " ");
      setCityName(cityDisplay(cityRaw));
      setStores(filtered);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const title = cityName ? `Lojas em ${cityName} - ItaSuper` : "Lojas - ItaSuper";
  const description = cityName
    ? `Veja todas as lojas, restaurantes e mercados em ${cityName} no ItaSuper. Peça delivery rápido ou retire na loja.`
    : "Lojas no ItaSuper.";
  const canonical = `${BASE_URL}/lojas/${slug}`;

  const jsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    itemListElement: stores.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/${s.slug || s.id}`,
      name: s.name,
    })),
  }), [stores, title]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="sticky top-0 z-40 bg-card/85 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-2 px-4 h-14">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold truncate text-muted-foreground">
            {cityName || "Lojas"}
          </h1>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-8 pb-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/20 mb-3">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black uppercase tracking-wider text-primary">Sua cidade</span>
          </div>
          <h2 className="text-3xl font-black leading-tight">
            Lojas em <span className="text-primary">{cityName || "..."}</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {loading
              ? "Carregando lojas..."
              : `${stores.length} ${stores.length === 1 ? "loja disponível" : "lojas disponíveis"} agora`}
          </p>
        </div>
      </section>

      <main className="px-4 pt-5">

        {!loading && stores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-border bg-muted/30">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <StoreIcon className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-semibold">Nenhuma loja ativa em {cityName}</p>
            <p className="text-xs text-muted-foreground mt-1">Volte em breve, novidades chegando.</p>
            <Link to="/" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary px-4 py-2 rounded-full bg-primary/10 active:scale-95 transition">
              Ver todas as lojas
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 pb-6">
          {stores.map((s) => (
            <StoreCard
              key={s.id}
              id={s.id}
              name={s.name}
              category={s.category || ""}
              image_url={s.image_url}
              is_open={!s.force_closed && !!s.is_open}
              rating={s.rating}
              slug={s.slug}
            />
          ))}
        </div>
      </main>
    </div>
  );
}