import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useResellerDashboard, brl } from "./useResellerDashboard";
import { AppIcon } from "@/components/ui/app-icon";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import {
  getReferralEarningStage,
  stageBadge,
  remainingToPaidCents,
  freeGmvCentsFor,
  FREE_GMV_EXPLAINER,
} from "@/lib/resellerEarnings";

export default function ResellerIndicacoes() {
  const navigate = useNavigate();
  const { data, isLoading } = useResellerDashboard();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const stores = data?.stores || [];
  const filtered = useMemo(() => {
    return stores
      .filter((s) => (filter === "all" ? true : s.referral_status === filter))
      .filter((s) => (q ? s.name.toLowerCase().includes(q.toLowerCase()) : true));
  }, [stores, filter, q]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <AppIcon name="Loader2" className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 h-14 flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate("/cliente")}>
            <AppIcon name="ArrowLeft" className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-black tracking-tight">Minhas Indicações</h1>
            <p className="text-[10px] text-muted-foreground">
              {stores.length} lojas cadastradas pelo seu link
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 py-3 space-y-3 max-w-md mx-auto">
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-[11px] text-muted-foreground leading-snug">
          ℹ️ {FREE_GMV_EXPLAINER}
        </div>

        <div className="relative">
          <AppIcon name="Search" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar loja..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { v: "all", l: "Todas" },
            { v: "pending", l: "Pendentes" },
            { v: "active", l: "Ativas" },
            { v: "churned", l: "Canceladas" },
          ].map((t) => (
            <button
              key={t.v}
              onClick={() => setFilter(t.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                filter === t.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma indicação {filter !== "all" ? "nesse filtro" : "ainda"}.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const stage = getReferralEarningStage(s);
              const badge = stageBadge(stage);
              const free = freeGmvCentsFor(s.plan_type);
              const remaining = remainingToPaidCents(s);
              const progress = free > 0 ? Math.min(100, Math.round(((s.gmv_60d_cents || 0) / free) * 100)) : 0;
              return (
                <Card key={s.store_id}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {s.city || "—"} · Plano: {s.plan_type || "—"}
                        </div>
                        {s.activated_at && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Ativada em {new Date(s.activated_at).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    {stage === "bounty_paid_free_tier" && free > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Progresso até começar a pagar mensalidade</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Faltam <strong>{brl(remaining)}</strong> em vendas pra loja começar a pagar o plano — e você começar a receber os 20% recorrentes.
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                      <div>
                        <div className="text-[9px] text-muted-foreground uppercase">GMV 60d</div>
                        <div className="text-sm font-semibold">{brl(s.gmv_60d_cents)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground uppercase">Você já gerou</div>
                        <div className="text-sm font-semibold text-green-600">
                          {brl(s.commissions_total_cents)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}