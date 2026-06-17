import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Store as StoreIcon, ArrowLeft, Heart, TrendingUp, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/60">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold truncate leading-tight">
              Lojas em {cityName || "..."}
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {loading ? "Carregando..." : `${stores.length} ${stores.length === 1 ? "estabelecimento" : "estabelecimentos"}`}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="flex items-center gap-2 mb-4">
          <StoreIcon className="h-6 w-6" strokeWidth={2.2} />
          <h2 className="text-2xl font-black tracking-tight">Lojas</h2>
        </div>

        {!loading && stores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-border bg-muted/20">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <StoreIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">Nenhuma loja ativa em {cityName}</p>
            <p className="text-xs text-muted-foreground mt-1">Volte em breve, novidades chegando.</p>
            <Link to="/" className="mt-4 inline-flex items-center text-sm font-bold text-primary px-4 py-2 rounded-full bg-primary/10 active:scale-95 transition">
              Ver todas as lojas
            </Link>
          </div>
        )}

        <ul className="flex flex-col gap-3 pb-6">
          {stores.map((s) => {
            const open = !s.force_closed && !!s.is_open;
            const target = s.slug ? `/${s.slug}` : `/loja/${s.id}`;
            return (
              <li key={s.id}>
                <button
                  onClick={() => navigate(target)}
                  className="w-full text-left rounded-2xl bg-card border border-border/70 p-3 flex gap-3 active:scale-[0.99] transition hover:border-border hover:shadow-sm"
                >
                  <div className="shrink-0 w-[72px] h-[72px] rounded-2xl overflow-hidden bg-muted">
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.name}
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover ${!open ? "grayscale opacity-70" : ""}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <StoreIcon className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={`font-bold text-[15px] leading-tight truncate ${!open ? "text-muted-foreground" : "text-foreground"}`}>
                          {s.name}
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5 capitalize truncate">
                          {s.category || "Restaurante"}
                        </p>
                      </div>
                      <Heart className="h-[18px] w-[18px] text-muted-foreground/60 shrink-0" />
                    </div>

                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {open ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-500/60 text-emerald-600 text-[11px] font-semibold">
                          Aberto
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border text-muted-foreground text-[11px] font-semibold">
                          Fechado
                        </span>
                      )}
                      {typeof s.rating === "number" && s.rating > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-300/70 bg-amber-50 dark:bg-amber-500/10 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          <span className="text-[10px]">★</span>
                          {s.rating.toFixed(1).replace(".", ",")}
                        </span>
                      )}
                      {open && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-semibold">
                          <Flame className="h-3 w-3" />
                          Popular
                        </span>
                      )}
                      {!open && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
                          <TrendingUp className="h-3 w-3" />
                          Em breve
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}