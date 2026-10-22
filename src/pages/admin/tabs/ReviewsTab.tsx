import { memo, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import {
  Star, MessageSquareReply, Loader2, Sparkles, Clock,
  CheckCircle2, AlertTriangle, Send, X, ChevronDown,
} from "lucide-react";

interface Props {
  storeId: string;
}

interface Aggregate {
  store_id: string;
  period: string;
  avg_rating: number;
  review_count: number;
  dist_1: number;
  dist_2: number;
  dist_3: number;
  dist_4: number;
  dist_5: number;
  novelty_until: string | null;
}

interface Review {
  id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  visibility: string;
  status: string;
  created_at: string;
  review_tags: { tag: string; sentiment: string }[];
  review_responses: {
    id: string;
    message: string;
    created_at: string;
  }[];
}

const TAG_LABELS: Record<string, string> = {
  tasty: "Saborosa",
  good_packaging: "Boa embalagem",
  generous_portion: "Porção generosa",
  on_time: "No prazo",
  good_value: "Vale o preço",
  cold: "Veio fria",
  bland: "Sem sabor",
  wrong_item: "Veio errada",
  missing_item: "Faltando item",
  late: "Atrasou muito",
  leaked: "Vazou",
  expensive: "Caro",
};

const RESPONSE_TEMPLATES = [
  "Obrigado pela avaliação! Ficamos felizes que gostou. Volte sempre! 🙏",
  "Agradecemos seu feedback! Já repassamos para nossa equipe e vamos melhorar.",
  "Sentimos muito pela experiência. Queremos fazer certo — entre em contato conosco para resolvermos.",
];

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

function slaInfo(createdAt: string): { label: string; urgent: boolean; expired: boolean } {
  const deadline = new Date(createdAt).getTime() + 5 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diffMs = deadline - now;
  if (diffMs <= 0) return { label: "Prazo esgotado", urgent: true, expired: true };
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days === 0) return { label: `${hours}h restantes`, urgent: true, expired: false };
  return { label: `${days}d ${hours}h restantes`, urgent: days < 2, expired: false };
}

const ReviewsTab = memo(({ storeId }: Props) => {
  const qc = useQueryClient();
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Agregados (90 dias)
  const { data: agg } = useQuery({
    queryKey: ["store-rating-agg", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_rating_aggregates")
        .select("*")
        .eq("store_id", storeId)
        .eq("period", "90d")
        .maybeSingle();
      if (error) throw error;
      return data as Aggregate | null;
    },
    enabled: !!storeId,
  });

  // Avaliações da loja
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["store-reviews", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reviews")
        .select(`
          id, order_id, rating, comment, visibility, status, created_at,
          review_tags (tag, sentiment),
          review_responses (id, message, created_at)
        `)
        .eq("target_type", "store")
        .eq("target_id", storeId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Review[];
    },
    enabled: !!storeId,
  });

  // Tempo real: nova avaliação → atualiza lista + agregados + toast
  useEffect(() => {
    if (!storeId) return;
    const channel = (supabase as any)
      .channel(`store-reviews-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reviews" },
        () => {
          qc.invalidateQueries({ queryKey: ["store-reviews", storeId] });
          qc.invalidateQueries({ queryKey: ["store-rating-agg", storeId] });
          toast.info("Nova avaliação recebida!", { icon: <Star className="h-4 w-4 text-amber-400" /> });
        },
      )
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [storeId, qc]);

  const responseRate = useMemo(() => {
    if (reviews.length === 0) return 0;
    const responded = reviews.filter((r) => r.review_responses?.length > 0).length;
    return Math.round((responded / reviews.length) * 100);
  }, [reviews]);

  const pendingReviews = useMemo(
    () => reviews.filter((r) => !r.review_responses || r.review_responses.length === 0),
    [reviews],
  );

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) {
      toast.error("Escreva uma resposta antes de enviar.");
      return;
    }
    setSending(true);
    try {
      const review = reviews.find((r) => r.id === reviewId);
      const sla = review ? slaInfo(review.created_at) : null;
      const { error } = await (supabase as any).from("review_responses").insert({
        review_id: reviewId,
        store_id: storeId,
        responder_id: (await (supabase as any).auth.getUser()).data.user?.id,
        message: responseText.trim(),
        responded_within_sla: sla ? !sla.expired : null,
      });
      if (error) throw error;
      toast.success("Resposta publicada!");
      setRespondingTo(null);
      setResponseText("");
      qc.invalidateQueries({ queryKey: ["store-reviews", storeId] });
    } catch (e: any) {
      toast.error("Erro ao responder: " + (e.message || "tente de novo"));
    } finally {
      setSending(false);
    }
  };

  const dist = agg ? [agg.dist_5, agg.dist_4, agg.dist_3, agg.dist_2, agg.dist_1] : [0, 0, 0, 0, 0];
  const maxDist = Math.max(...dist, 1);
  const isNovelty = agg?.novelty_until && new Date(agg.novelty_until) >= new Date();

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
          <Star className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground">Avaliações</h2>
          <p className="text-xs text-muted-foreground">O que seus clientes estão achando.</p>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">Nota média (90d)</p>
          <div className="flex items-end gap-1 mt-1">
            <span className="text-3xl font-black text-foreground">
              {agg ? Number(agg.avg_rating).toFixed(1) : "—"}
            </span>
            <Star className="h-5 w-5 fill-amber-400 text-amber-400 mb-1" />
          </div>
          {isNovelty && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-orange-600 bg-orange-500/10 rounded-full px-2 py-0.5">
              <Sparkles className="h-3 w-3" /> Novidade
            </span>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">Avaliações</p>
          <p className="text-3xl font-black text-foreground mt-1">{agg?.review_count ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-1">últimos 90 dias</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">Taxa de resposta</p>
          <p className="text-3xl font-black text-foreground mt-1">{responseRate}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">responda em até 5 dias</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">Aguardando resposta</p>
          <p className="text-3xl font-black text-foreground mt-1">{pendingReviews.length}</p>
          {pendingReviews.length > 0 && (
            <p className="text-[11px] font-bold text-orange-600 mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> precisam de você
            </p>
          )}
        </div>
      </div>

      {/* Histograma */}
      {agg && agg.review_count > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-bold text-foreground mb-3">Distribuição das notas</p>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star, i) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground w-6">{star}★</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${star >= 4 ? "bg-amber-400" : star === 3 ? "bg-orange-300" : "bg-red-400"}`}
                    style={{ width: `${(dist[i] / maxDist) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{dist[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de avaliações */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-bold text-foreground mb-3">
          Avaliações recentes ({reviews.length})
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={<Star className="h-10 w-10 text-muted-foreground/30" />}
            title="Nenhuma avaliação ainda"
            description="Quando um cliente avaliar um pedido, a avaliação aparece aqui."
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => {
              const responded = r.review_responses && r.review_responses.length > 0;
              const sla = !responded ? slaInfo(r.created_at) : null;
              return (
                <div key={r.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} />
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-foreground mt-1.5">"{r.comment}"</p>
                  )}
                  {r.review_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.review_tags.map((t) => (
                        <span
                          key={t.tag}
                          className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                            t.sentiment === "positive"
                              ? "bg-green-500/10 text-green-700"
                              : "bg-red-500/10 text-red-700"
                          }`}
                        >
                          {TAG_LABELS[t.tag] || t.tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Resposta existente */}
                  {responded && (
                    <div className="mt-2 rounded-lg bg-muted/50 p-3">
                      <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" /> Sua resposta
                      </p>
                      <p className="text-sm text-foreground">{r.review_responses[0].message}</p>
                    </div>
                  )}

                  {/* Responder */}
                  {!responded && (
                    <div className="mt-2">
                      {sla && (
                        <p className={`text-[11px] font-bold flex items-center gap-1 mb-2 ${sla.urgent ? "text-red-600" : "text-muted-foreground"}`}>
                          <Clock className="h-3 w-3" />
                          {sla.expired ? "Prazo de 5 dias esgotado — ainda dá pra responder" : `Responda em até 5 dias · ${sla.label}`}
                        </p>
                      )}
                      {respondingTo === r.id ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {RESPONSE_TEMPLATES.map((t, i) => (
                              <button
                                key={i}
                                onClick={() => setResponseText(t)}
                                className="text-[11px] rounded-full border border-border px-2 py-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                              >
                                Modelo {i + 1}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            placeholder="Escreva sua resposta..."
                            rows={3}
                            maxLength={2000}
                            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRespond(r.id)}
                              disabled={sending}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                            >
                              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              Publicar resposta
                            </button>
                            <button
                              onClick={() => { setRespondingTo(null); setResponseText(""); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground"
                            >
                              <X className="h-4 w-4" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRespondingTo(r.id); setResponseText(""); }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-bold text-primary hover:border-primary transition-colors"
                        >
                          <MessageSquareReply className="h-4 w-4" /> Responder
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {reviews.length >= 50 && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full flex items-center justify-center gap-1 py-2 text-sm font-bold text-primary"
              >
                <ChevronDown className="h-4 w-4" /> Ver mais
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dica */}
      <div className="rounded-xl border border-dashed border-border p-3 flex gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Responder avaliações — principalmente as negativas — mostra cuidado e pode fazer o
          cliente rever a nota. Avaliações privadas não aparecem na nota pública da loja.
        </p>
      </div>
    </div>
  );
});

export default ReviewsTab;
