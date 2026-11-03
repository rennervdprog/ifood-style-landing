import { Link } from "react-router-dom";
import {
  Bike,
  BookOpen,
  Clock,
  DollarSign,
  LayoutGrid,
  Megaphone,
  Newspaper,
  Search,
  SlidersHorizontal,
  Store,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Sistema visual do blog (redesenho 2026-11-03).
 *
 * Capa é SISTEMA, não produção: post sem foto ganha uma capa gerada com a
 * cor da categoria, um padrão de rota, o nome da categoria e a marca —
 * o mesmo molde pra todos, como fazem Stripe e Shopify. Post com foto
 * usa a foto, dentro do mesmo formato 16:9.
 */

interface CategoryStyle {
  bg: string;
  icon: LucideIcon;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  lojistas: { bg: "#FF6A00", icon: Store },
  financeiro: { bg: "#166534", icon: DollarSign },
  marketing: { bg: "#7C2D4E", icon: Megaphone },
  seo: { bg: "#155E63", icon: Search },
  nichos: { bg: "#3E4A7A", icon: LayoutGrid },
  guia: { bg: "#5B3A8E", icon: BookOpen },
  guias: { bg: "#5B3A8E", icon: BookOpen },
  cardapio: { bg: "#8A3324", icon: UtensilsCrossed },
  operacao: { bg: "#374151", icon: SlidersHorizontal },
  entregas: { bg: "#0E7490", icon: Truck },
  delivery: { bg: "#9A3412", icon: Bike },
};

const DEFAULT_STYLE: CategoryStyle = { bg: "#44403C", icon: Newspaper };

export function blogCategoryStyle(category?: string | null): CategoryStyle {
  const key = (category || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return CATEGORY_STYLES[key] ?? DEFAULT_STYLE;
}

export function formatBlogDate(s: string | null | undefined) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** 3 trilhos de "rota" — a variante sai do título, pra capa não repetir igualzinha. */
function patternIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 3;
}

function CoverPattern({ seed }: { seed: string }) {
  const v = patternIndex(seed);
  const paths = [
    "M-10 190 C 90 150, 150 210, 240 130 S 380 90, 420 60",
    "M-10 60 C 100 100, 200 30, 300 90 S 390 140, 420 130",
    "M-10 150 C 80 110, 190 190, 280 110 S 380 60, 420 80",
  ];
  const dots: Array<[number, number]> = [
    [240, 130],
    [300, 90],
    [280, 110],
  ];
  const [dx, dy] = dots[v];
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 225"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={paths[v]}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="2"
        strokeDasharray="7 7"
      />
      <circle cx={dx} cy={dy} r="5" fill="rgba(255,255,255,0.5)" />
      <circle cx="370" cy="300" r="120" fill="rgba(255,255,255,0.07)" />
    </svg>
  );
}

interface BlogCoverProps {
  title: string;
  category?: string | null;
  coverUrl?: string | null;
}

/**
 * A capa do post: foto real quando existe; capa gerada quando não.
 * O pai define o formato (aspect-video) — este componente preenche tudo.
 */
export function BlogCover({ title, category, coverUrl }: BlogCoverProps) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        loading="lazy"
        width={1280}
        height={720}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
      />
    );
  }
  const style = blogCategoryStyle(category);
  const Icon = style.icon;
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: style.bg }}
      role="img"
      aria-label={title}
    >
      <CoverPattern seed={title} />
      {category && (
        <span className="absolute left-3 top-3 rounded-full border-[1.5px] border-white/85 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
          {category}
        </span>
      )}
      <span className="absolute bottom-2.5 left-3 text-[10.5px] font-extrabold tracking-wide text-white/90">
        Blog ItaSuper
      </span>
      <Icon
        className="absolute bottom-2 right-3.5 text-white/95"
        style={{ width: 34, height: 34 }}
        strokeWidth={1.6}
      />
    </div>
  );
}

export interface BlogCardPost {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  cover_url: string | null;
  category: string | null;
  reading_minutes: number | null;
  published_at?: string | null;
}

/**
 * O card do blog — um só, em todo lugar (grade da home e "Leia também"):
 * capa 16:9 → categoria → título → tempo de leitura · data.
 */
export function BlogCard({ post }: { post: BlogCardPost }) {
  const style = blogCategoryStyle(post.category);
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="aspect-video overflow-hidden bg-muted">
        <BlogCover title={post.title} category={post.category} coverUrl={post.cover_url} />
      </div>
      <div className="flex flex-1 flex-col p-5">
        {post.category && (
          <span
            className="text-[11px] font-extrabold uppercase tracking-[0.08em]"
            style={{ color: style.bg }}
          >
            {post.category}
          </span>
        )}
        <h3 className="mt-2 text-[1.05rem] font-bold leading-snug line-clamp-2">
          {post.title}
        </h3>
        <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
          {post.reading_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {post.reading_minutes} min de leitura
            </span>
          ) : null}
          {post.reading_minutes && post.published_at ? <span>·</span> : null}
          {post.published_at ? <span>{formatBlogDate(post.published_at)}</span> : null}
        </div>
      </div>
    </Link>
  );
}
