import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Puzzle, Crown, TrendingUp, XCircle } from "lucide-react";
import { formatBRL } from "@/lib/utils";

type AddonRow = {
  store_id: string;
  addon_code: string;
  enabled: boolean;
  price_override: number | null;
  cancels_at: string | null;
  activated_at: string | null;
  first_charge_done: boolean | null;
  stores: { name: string | null; plan_type: string | null; legacy_pdv: boolean | null } | null;
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function AddonsMrrTab() {
  const [q, setQ] = useState("");

  const catalogQ = useQuery({
    queryKey: ["addon-catalog"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_addons" as any)
        .select("code, name, monthly_price, is_active");
      const map = new Map<string, { name: string; price: number }>();
      (data ?? []).forEach((r: any) => map.set(r.code, { name: r.name, price: Number(r.monthly_price) || 0 }));
      return map;
    },
  });

  const rowsQ = useQuery({
    queryKey: ["admin-store-addons"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_addons" as any)
        .select("store_id, addon_code, enabled, price_override, cancels_at, activated_at, first_charge_done, stores!inner(name, plan_type, legacy_pdv)")
        .order("activated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AddonRow[];
    },
  });

  const isLoading = catalogQ.isLoading || rowsQ.isLoading;
  const catalog = catalogQ.data;
  const rows = rowsQ.data ?? [];

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const cat = catalog?.get(r.addon_code);
      const catalogPrice = cat?.price ?? 0;
      const priceOverride = r.price_override != null ? Number(r.price_override) : null;
      const monthly = priceOverride != null ? priceOverride : catalogPrice;
      const isVip = priceOverride === 0;
      const isCancelScheduled = !!r.cancels_at && new Date(r.cancels_at) > new Date();
      const isExpired = !!r.cancels_at && new Date(r.cancels_at) <= new Date();
      const status: "vip" | "ativo" | "cancelando" | "expirado" | "inativo" =
        !r.enabled ? "inativo"
        : isExpired ? "expirado"
        : isCancelScheduled ? "cancelando"
        : isVip ? "vip"
        : "ativo";
      return {
        ...r,
        addonName: cat?.name ?? r.addon_code,
        catalogPrice,
        monthly,
        isVip,
        status,
      };
    });
  }, [rows, catalog]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return enriched;
    return enriched.filter((r) =>
      (r.stores?.name ?? "").toLowerCase().includes(term) ||
      r.addon_code.toLowerCase().includes(term) ||
      r.addonName.toLowerCase().includes(term),
    );
  }, [enriched, q]);

  const kpis = useMemo(() => {
    const active = enriched.filter((r) => r.status === "ativo" || r.status === "cancelando");
    const vip = enriched.filter((r) => r.status === "vip");
    const cancelando = enriched.filter((r) => r.status === "cancelando");
    const mrr = active.reduce((sum, r) => sum + (r.monthly || 0), 0);
    const perCode = new Map<string, { count: number; mrr: number; name: string }>();
    active.forEach((r) => {
      const prev = perCode.get(r.addon_code) ?? { count: 0, mrr: 0, name: r.addonName };
      perCode.set(r.addon_code, { count: prev.count + 1, mrr: prev.mrr + (r.monthly || 0), name: r.addonName });
    });
    return {
      mrr,
      activeCount: active.length,
      vipCount: vip.length,
      cancelingCount: cancelando.length,
      perCode: Array.from(perCode.entries()).map(([code, v]) => ({ code, ...v })),
    };
  }, [enriched]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase">
              <TrendingUp className="h-3.5 w-3.5" /> MRR Add-ons
            </div>
            <div className="text-2xl font-black text-primary mt-1">{formatBRL(kpis.mrr)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.activeCount} ativo(s) — VIP ({kpis.vipCount}) fora do cálculo
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase">
              <Puzzle className="h-3.5 w-3.5" /> Ativos pagantes
            </div>
            <div className="text-2xl font-black mt-1">{kpis.activeCount - kpis.cancelingCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Cobrança mensal ligada</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase">
              <Crown className="h-3.5 w-3.5 text-amber-500" /> VIP grátis
            </div>
            <div className="text-2xl font-black text-amber-500 mt-1">{kpis.vipCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">price_override = 0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold uppercase">
              <XCircle className="h-3.5 w-3.5 text-destructive" /> Cancelamento agendado
            </div>
            <div className="text-2xl font-black text-destructive mt-1">{kpis.cancelingCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Some do MRR no vencimento</div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown por código */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">MRR por módulo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {kpis.perCode.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum add-on ativo.</p>
          ) : (
            <div className="space-y-1.5">
              {kpis.perCode.map((c) => (
                <div key={c.code} className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {c.name} <span className="text-muted-foreground text-xs">({c.code})</span>
                  </span>
                  <span className="tabular-nums">
                    <span className="text-muted-foreground text-xs mr-2">{c.count} loja(s)</span>
                    <span className="font-bold text-primary">{formatBRL(c.mrr)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista por loja */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-bold">Add-ons por loja ({filtered.length})</CardTitle>
            <div className="relative w-52">
              <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar loja ou módulo"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro encontrado.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase text-muted-foreground border-b">
                    <th className="text-left font-bold py-2">Loja</th>
                    <th className="text-left font-bold py-2">Plano</th>
                    <th className="text-left font-bold py-2">Add-on</th>
                    <th className="text-right font-bold py-2">Mensal</th>
                    <th className="text-left font-bold py-2 pl-3">Status</th>
                    <th className="text-left font-bold py-2">Ativado</th>
                    <th className="text-left font-bold py-2">Cancela em</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={`${r.store_id}-${r.addon_code}`} className="border-b border-border/50">
                      <td className="py-2 font-medium">{r.stores?.name ?? r.store_id.slice(0, 8)}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {r.stores?.plan_type ?? "—"}
                        {r.stores?.legacy_pdv ? " · legacy" : ""}
                      </td>
                      <td className="py-2">
                        {r.addonName} <span className="text-muted-foreground text-xs">({r.addon_code})</span>
                      </td>
                      <td className="py-2 text-right tabular-nums font-bold">
                        {r.isVip ? <span className="text-amber-500">VIP</span> : formatBRL(r.monthly)}
                      </td>
                      <td className="py-2 pl-3">
                        {r.status === "ativo" && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Ativo</Badge>}
                        {r.status === "vip" && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">VIP</Badge>}
                        {r.status === "cancelando" && <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">Cancelando</Badge>}
                        {r.status === "expirado" && <Badge variant="outline" className="text-muted-foreground">Expirado</Badge>}
                        {r.status === "inativo" && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{fmtDate(r.activated_at)}</td>
                      <td className="py-2 text-xs text-muted-foreground">{fmtDate(r.cancels_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}