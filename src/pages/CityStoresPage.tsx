import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Store as StoreIcon, ArrowLeft, MapPin } from "lucide-react";
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

      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <h1 className="text-base font-black truncate">
              Lojas em {cityName || "..."}
            </h1>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        <p className="text-xs text-muted-foreground mb-3">
          {loading ? "Carregando..." : `${stores.length} loja${stores.length === 1 ? "" : "s"} encontrada${stores.length === 1 ? "" : "s"}`}
        </p>

        {!loading && stores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <StoreIcon className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma loja ativa em {cityName} no momento.</p>
            <Link to="/" className="mt-4 text-sm font-bold text-primary">Ver todas as lojas</Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
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