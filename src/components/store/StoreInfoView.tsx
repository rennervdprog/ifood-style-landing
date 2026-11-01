import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Heart, MapPin, Clock, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Tela "Sobre a loja" da vitrine web — cópia do StoreInfoScreen do app
// (KMP): abas Avaliações | Informações, mapa com "Traçar rota", cards de
// Funcionamento (horários agrupados), Pagamento (selos por método) e
// Endereço. Adaptações da cópia: as estrelas do resumo eram âmbar no app
// (#FFA000) — aqui usam o laranja da marca, pela regra de design do Renner
// (nada de âmbar/amarelo); o "Abre amanhã às 08:00" fixo do app vira o
// próximo horário real calculado pelo storeStatus da web.

export interface RatingAggregate {
  avg: number;
  count: number;
  /** Contagens de 5, 4, 3, 2 e 1 estrelas, nesta ordem. */
  dist: number[];
}

interface StoreInfoViewProps {
  store: any;
  hours: any[];
  isOpen: boolean;
  statusReason: string;
  initialTab: "info" | "aval";
  aggregate: RatingAggregate | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
  onOpenMaps: () => void;
}

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatOneDecimal(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/** Agrupa dias consecutivos (Dom→Sáb) com o mesmo horário, como o app. */
function groupHours(hours: any[]): { label: string; range: string }[] {
  if (!hours || hours.length === 0) return [];
  const byDay = new Map<number, any>();
  hours.forEach((h) => byDay.set(Number(h.day_of_week), h));
  const rangeOf = (day: number): string => {
    const h = byDay.get(day);
    if (!h || h.is_closed_all_day) return "Fechado";
    return `${String(h.open_time).slice(0, 5)} – ${String(h.close_time).slice(0, 5)}`;
  };
  const result: { label: string; range: string }[] = [];
  let start = 0;
  for (let day = 1; day <= 7; day++) {
    if (day === 7 || rangeOf(day) !== rangeOf(start)) {
      const end = day - 1;
      result.push({
        label: start === end ? DAY_NAMES[start] : `${DAY_NAMES[start]} – ${DAY_NAMES[end]}`,
        range: rangeOf(start),
      });
      start = day;
    }
  }
  return result;
}

function displayAddress(store: any): string {
  if (store.address) return store.address;
  return [
    [store.address_street, store.address_number].filter(Boolean).join(", "),
    store.address_neighborhood,
    [store.address_city, store.address_state].filter(Boolean).join(" – "),
    store.address_cep,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Métodos aceitos a partir das configurações da loja (mesma leitura da vitrine atual). */
function paymentMethods(store: any): { label: string; badge: string; badgeBg: string }[] {
  const s = (store?.settings || {}) as Record<string, any>;
  const pixOnline = s.accept_pix_online === true;
  const pixMachine = s.accept_pix_machine === true;
  const card = s.accept_card !== false;
  const cash = s.accept_cash !== false;
  const methods: { label: string; badge: string; badgeBg: string }[] = [];
  // Selos nas cores do app (PaymentBadge do KMP).
  if (pixOnline) methods.push({ label: "Pix online", badge: "PIX", badgeBg: "#32BCAD" });
  if (pixMachine) methods.push({ label: "Pix na maquininha", badge: "PIX", badgeBg: "#32BCAD" });
  if (card) methods.push({ label: "Cartão", badge: "CA", badgeBg: "#9E9E9E" });
  if (cash) methods.push({ label: "Dinheiro", badge: "R$", badgeBg: "#4CAF50" });
  return methods;
}

/** "há 2 h", "agora mesmo" etc. — porte do formatRelativeTime do app. */
function formatRelativeTime(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return "";
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return "agora mesmo";
    if (minutes < 60) return `há ${minutes} min`;
    if (hours < 24) return `há ${hours} h`;
    if (days < 7) return days === 1 ? "há 1 dia" : `há ${days} dias`;
    if (days < 30) { const w = Math.floor(days / 7); return w === 1 ? "há 1 semana" : `há ${w} semanas`; }
    if (days < 365) { const m = Math.floor(days / 30); return m === 1 ? "há 1 mês" : `há ${m} meses`; }
    const y = Math.floor(days / 365);
    return y === 1 ? "há 1 ano" : `há ${y} anos`;
  } catch {
    return "";
  }
}

function Stars({ filled, className }: { filled: (index: number) => boolean; className?: string }) {
  return (
    <span className={`inline-flex gap-[3px] ${className || ""}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={filled(i) ? "text-[#1A1A1A] dark:text-foreground" : "text-[#E0E0E0] dark:text-muted"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function StoreInfoView({
  store,
  hours,
  isOpen,
  statusReason,
  initialTab,
  aggregate,
  isFavorite,
  onToggleFavorite,
  onBack,
  onOpenMaps,
}: StoreInfoViewProps) {
  const [tab, setTab] = useState<"info" | "aval">(initialTab);
  const storeId = store?.id as string | undefined;
  const avg = aggregate?.avg ?? 0;
  const count = aggregate?.count ?? 0;
  const address = displayAddress(store);
  const payments = paymentMethods(store);
  const grouped = groupHours(hours);
  const nextOpening = !isOpen && statusReason.startsWith("Abre") ? statusReason : "";

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["store-public-reviews", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reviews")
        .select("id, author_id, rating, comment, created_at, review_responses(message, created_at)")
        .eq("target_type", "store")
        .eq("target_id", storeId!)
        .eq("status", "approved")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const items = (data || []) as any[];
      const authorIds = [...new Set(items.map((r) => r.author_id).filter(Boolean))];
      const nameMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: names } = await (supabase as any)
          .from("review_author_names")
          .select("user_id, display_name")
          .in("user_id", authorIds);
        (names || []).forEach((n: any) => {
          if (n.user_id) nameMap.set(n.user_id, n.display_name || "Cliente");
        });
      }
      return items.map((r) => ({
        id: r.id,
        authorName: nameMap.get(r.author_id) || "Cliente",
        rating: Number(r.rating) || 0,
        comment: typeof r.comment === "string" ? r.comment : "",
        createdAt: r.created_at as string,
        storeResponse: (r.review_responses || [])[0]?.message || "",
      }));
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 3,
  });

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-background pb-10">
      {/* Barra superior: voltar + favoritar (título maiúsculo ao rolar fica fora da v1) */}
      <div className="flex items-center justify-between px-2 py-2">
        <button
          onClick={onBack}
          aria-label="Voltar para a loja"
          className="w-10 h-10 flex items-center justify-center"
        >
          <ArrowLeft className="h-6 w-6 text-primary" />
        </button>
        <button
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar loja"}
          className="w-10 h-10 flex items-center justify-center"
        >
          <Heart className={`h-6 w-6 ${isFavorite ? "fill-[#FF5252] text-[#FF5252]" : "text-primary"}`} />
        </button>
      </div>

      {/* Cabeçalho: nome + categoria | logo circular */}
      <div className="flex items-start justify-between gap-3 px-4 pt-1">
        <div className="min-w-0">
          <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-[#1A1A1A] dark:text-foreground leading-tight">
            {store.name}
          </h2>
          <p className="text-[13px] text-[#777777] dark:text-muted-foreground mt-1">
            {capitalize(store.category || "")}
          </p>
        </div>
        {store.image_url ? (
          <img src={store.image_url} alt={store.name} className="w-[52px] h-[52px] rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-[52px] h-[52px] rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-primary">{(store.name || "?").charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Nota + nº de avaliações */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2 text-[15px] text-[#1A1A1A] dark:text-foreground">
          <span>{count > 0 ? formatOneDecimal(avg) : "–"}</span>
          <Stars filled={(i) => avg > i} className="text-[15px]" />
        </div>
        <span className="text-sm text-[#777777] dark:text-muted-foreground">
          {count === 1 ? "1 avaliação" : `${count} avaliações`}
        </span>
      </div>

      {/* Abas */}
      <div className="flex border-b border-[#EEEEEE] dark:border-border">
        <button
          onClick={() => setTab("aval")}
          className={`flex-1 py-3 text-[15px] ${
            tab === "aval"
              ? "text-primary font-semibold shadow-[inset_0_-2px_0_0] shadow-primary"
              : "text-[#999999] dark:text-muted-foreground"
          }`}
        >
          Avaliações
        </button>
        <button
          onClick={() => setTab("info")}
          className={`flex-1 py-3 text-[15px] ${
            tab === "info"
              ? "text-primary font-semibold shadow-[inset_0_-2px_0_0] shadow-primary"
              : "text-[#999999] dark:text-muted-foreground"
          }`}
        >
          Informações
        </button>
      </div>

      {tab === "info" && (
        <div>
          {/* Mapa destaque */}
          <div
            className="mx-4 mt-3 h-[190px] rounded-[20px] relative overflow-hidden cursor-pointer"
            style={{
              backgroundColor: "#DCEFE0",
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.55) 10px, transparent 10px), linear-gradient(90deg, rgba(255,255,255,.55) 10px, transparent 10px), linear-gradient(rgba(255,255,255,.35) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.35) 2px, transparent 2px)",
              backgroundSize: "120px 120px, 120px 120px, 30px 30px, 30px 30px",
            }}
            onClick={() => { if (address) onOpenMaps(); }}
            role="button"
            aria-label="Abrir endereço no mapa"
          >
            <MapPin className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[88%] h-10 w-10 fill-[#E5484D] text-[#C9343C]" />
            <div className="absolute top-3.5 left-3.5 bg-white rounded-[14px] px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
              {store.image_url ? (
                <img src={store.image_url} alt="" className="w-[38px] h-[38px] rounded-[10px] object-cover" />
              ) : (
                <div className="w-[38px] h-[38px] rounded-[10px] bg-[#1A1A1A] flex items-center justify-center">
                  <span className="text-base font-bold text-primary">{(store.name || "?").charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div>
                <p className="text-[13.5px] font-extrabold text-[#1A1A1A] leading-tight">{store.name}</p>
                <p className="text-[11.5px] text-[#777777]">{capitalize(store.category || "")}</p>
              </div>
            </div>
            {address && (
              <span className="absolute bottom-3.5 right-3.5 bg-[#1A1A1A] text-white text-[12.5px] font-bold px-[18px] py-2.5 rounded-full">
                Traçar rota →
              </span>
            )}
          </div>

          {/* Funcionamento */}
          <section className="mx-4 mt-3.5 bg-white dark:bg-card rounded-[20px] p-[18px]">
            <div className="flex items-center gap-2 mb-3.5">
              <Clock className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1A1A] dark:text-foreground">Funcionamento</h3>
            </div>
            <div
              className={`flex items-center gap-2 rounded-[13px] px-3.5 py-3 ${
                isOpen ? "bg-[#F0FDF4] dark:bg-green-500/10" : "bg-[#FEF2F2] dark:bg-destructive/10"
              }`}
            >
              <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${isOpen ? "bg-[#16A34A]" : "bg-[#DC2626]"}`} />
              <span className={`text-[13.5px] font-bold flex-1 ${isOpen ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                {isOpen ? "Aberto agora" : "Fechado agora"}
              </span>
              {nextOpening && (
                <span className="text-[12.5px] text-[#777777] dark:text-muted-foreground">{nextOpening}</span>
              )}
            </div>
            {grouped.length === 0 ? (
              <p className="text-[13.5px] text-[#999999] dark:text-muted-foreground pt-3">Horários não informados pela loja.</p>
            ) : (
              grouped.map((g) => (
                <div key={g.label} className="flex items-center justify-between pt-4">
                  <span className="text-[13.5px] text-[#777777] dark:text-muted-foreground">{g.label}</span>
                  <span className="text-[13.5px] font-bold text-[#1A1A1A] dark:text-foreground">{g.range}</span>
                </div>
              ))
            )}
          </section>

          {/* Pagamento */}
          <section className="mx-4 mt-3.5 bg-white dark:bg-card rounded-[20px] p-[18px]">
            <div className="flex items-center gap-2 mb-3.5">
              <CreditCard className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1A1A] dark:text-foreground">Pagamento</h3>
            </div>
            {payments.length === 0 ? (
              <p className="text-[13.5px] text-[#999999] dark:text-muted-foreground">Formas de pagamento não informadas pela loja.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {payments.map((m) => (
                  <div key={m.label} className="flex items-center gap-2.5 bg-[#F9FAFB] dark:bg-muted/40 rounded-[13px] p-3">
                    <span
                      className="w-9 h-[26px] rounded-md flex items-center justify-center text-[10px] font-extrabold text-white flex-shrink-0"
                      style={{ backgroundColor: m.badgeBg }}
                    >
                      {m.badge}
                    </span>
                    <span className="text-[13px] font-semibold text-[#374151] dark:text-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Endereço */}
          <section className="mx-4 mt-3.5 bg-white dark:bg-card rounded-[20px] p-[18px]">
            <div className="flex items-center gap-2 mb-3.5">
              <MapPin className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-[15px] font-extrabold tracking-[-0.2px] text-[#1A1A1A] dark:text-foreground">Endereço</h3>
            </div>
            <p className="text-sm leading-[22px] text-[#374151] dark:text-foreground">
              {address || "Endereço não informado pela loja."}
            </p>
          </section>
        </div>
      )}

      {tab === "aval" && (
        <div className="px-4 py-4">
          {reviewsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : count === 0 ? (
            <div className="text-center py-10">
              <div className="text-[40px] leading-none text-[#DDDDDD] dark:text-muted">★</div>
              <p className="text-base font-bold text-[#1A1A1A] dark:text-foreground mt-2">Nenhuma avaliação ainda</p>
              <p className="text-[13px] text-[#999999] dark:text-muted-foreground mt-1.5">Seja o primeiro a avaliar esta loja!</p>
            </div>
          ) : (
            <div>
              {/* Resumo: nota grande + histograma */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-4xl font-extrabold text-[#1A1A1A] dark:text-foreground">{formatOneDecimal(avg)}</p>
                  <div className="mt-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className={`text-sm ${i < Math.floor(avg) ? "text-primary" : "text-[#E0E0E0] dark:text-muted"}`}>★</span>
                    ))}
                  </div>
                  <p className="text-xs text-[#999999] dark:text-muted-foreground mt-1">
                    {count} avaliações
                  </p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star, idx) => {
                    const c = aggregate?.dist[idx] ?? 0;
                    const max = Math.max(1, ...(aggregate?.dist ?? [0]));
                    return (
                      <div key={star} className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#999999] dark:text-muted-foreground w-3">{star}</span>
                        <div className="flex-1 h-1.5 rounded bg-[#EEEEEE] dark:bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded ${star >= 4 ? "bg-primary" : "bg-[#CCCCCC] dark:bg-muted-foreground/40"}`}
                            style={{ width: `${(c / max) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[#999999] dark:text-muted-foreground w-6 text-right">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-[#EEEEEE] dark:bg-border my-4" />

              {/* Lista de avaliações */}
              <div className="space-y-4">
                {(reviews || []).map((r, i) => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-[#1A1A1A] dark:text-foreground">{r.authorName}</span>
                      <span className="text-[11px] text-[#AAAAAA] dark:text-muted-foreground">{formatRelativeTime(r.createdAt)}</span>
                    </div>
                    <div className="mt-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={`text-[13px] ${star <= r.rating ? "text-primary" : "text-[#E0E0E0] dark:text-muted"}`}>★</span>
                      ))}
                    </div>
                    {r.comment && r.comment !== "null" && (
                      <p className="text-sm text-[#1A1A1A] dark:text-foreground mt-1">{r.comment}</p>
                    )}
                    {r.storeResponse && (
                      <div className="bg-[#F8F8F8] dark:bg-muted/40 rounded-lg p-2.5 mt-2">
                        <p className="text-[11px] font-bold text-primary">Resposta da loja</p>
                        <p className="text-[13px] text-[#444444] dark:text-foreground mt-0.5">{r.storeResponse}</p>
                      </div>
                    )}
                    {i < (reviews?.length ?? 0) - 1 && <div className="h-px bg-[#F5F5F5] dark:bg-border mt-4" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
