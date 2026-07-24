import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useResellerDashboard, brl } from "./useResellerDashboard";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  active: { label: "Ativa", cls: "bg-green-500/10 text-green-600" },
  churned: { label: "Cancelada", cls: "bg-red-500/10 text-red-600" },
  blocked: { label: "Bloqueada", cls: "bg-red-500/10 text-red-600" },
};

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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 h-14 flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate("/cliente")}>
            <ArrowLeft className="h-4 w-4" />
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
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
              const st = STATUS_LABELS[s.referral_status] || STATUS_LABELS.pending;
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
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
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