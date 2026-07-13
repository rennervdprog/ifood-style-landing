import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Crown, Truck, Percent, ShoppingCart, CheckCircle2, MessageCircle, AlertTriangle } from "lucide-react";
import { brl } from "@/components/finance/financeExport";
import { planLabel } from "@/lib/plansInfo";
import { toast } from "sonner";

type ReceivableKind = "mensalidade" | "comissao" | "entrega_fee" | "pdv_fee";

const KIND_META: Record<ReceivableKind, { label: string; icon: typeof Crown; color: string }> = {
  mensalidade: { label: "Mensalidade", icon: Crown, color: "text-primary" },
  comissao: { label: "Comissão", icon: Percent, color: "text-primary" },
  entrega_fee: { label: "Taxa/entrega", color: "text-amber-500", icon: Truck },
  pdv_fee: { label: "PDV (R$1)", color: "text-emerald-500", icon: ShoppingCart },
};

interface StoreReceivable {
  store_id: string;
  name: string;
  plan_type: string;
  phone?: string | null;
  mensalidade: number;
  mensalidade_overdue_days: number;
  comissao: number;
  entrega_fee: number;
  pdv_fee: number;
  total: number;
}

const AReceberTab = () => {
  const qc = useQueryClient();
  const [paying, setPaying] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["areceber-platform"],
    queryFn: async () => {
      // Fonte única de verdade: RPC SECURITY DEFINER no banco externo.
      // Garante que Super Admin e Lojista enxerguem exatamente os mesmos números,
      // sem depender de variações de RLS entre store_balances / store_plans / stores.
      const { data: rpcRows, error } = await (supabase as any).rpc("get_platform_receivables");
      if (error) throw error;
      const now = Date.now();
      const rows: StoreReceivable[] = (rpcRows || [])
        .map((r: any) => {
          const due = r.next_billing_date ? new Date(r.next_billing_date).getTime() : 0;
          const overdueDays = due && due < now ? Math.floor((now - due) / 86400000) : 0;
          return {
            store_id: r.store_id,
            name: r.store_name,
            phone: r.phone,
            plan_type: r.plan_type || "—",
            mensalidade: Number(r.mensalidade || 0),
            mensalidade_overdue_days: overdueDays,
            comissao: Number(r.comissao || 0),
            entrega_fee: Number(r.entrega_fee || 0),
            pdv_fee: Number(r.pdv_fee || 0),
            total: Number(r.total || 0),
          };
        })
        .filter((r: StoreReceivable) => r.total > 0)
        .sort((a: StoreReceivable, b: StoreReceivable) => b.total - a.total);
      return rows;
    },
    staleTime: 30_000,
  });

  const rows = data || [];
  const totals = useMemo(
    () => ({
      mensalidade: rows.reduce((s, r) => s + r.mensalidade, 0),
      comissao: rows.reduce((s, r) => s + r.comissao, 0),
      entrega_fee: rows.reduce((s, r) => s + r.entrega_fee, 0),
      pdv_fee: rows.reduce((s, r) => s + r.pdv_fee, 0),
      total: rows.reduce((s, r) => s + r.total, 0),
    }),
    [rows],
  );

  async function markPaid(row: StoreReceivable, kind: ReceivableKind, amount: number) {
    if (amount <= 0) return;
    setPaying(`${row.store_id}:${kind}`);
    try {
      const { data: u } = await supabase.auth.getUser();
      const adminId = u.user?.id;
      if (!adminId) throw new Error("Sem usuário");

      const ins = await supabase.from("payout_history").insert([{
        entity_type: "store",
        entity_id: row.store_id,
        entity_name: row.name,
        amount,
        payout_type: "manual",
        kind,
        notes: `Marcado como pago manualmente pelo super admin (${KIND_META[kind].label})`,
        admin_user_id: adminId,
      } as any]);
      if (ins.error) throw ins.error;

      if (kind === "comissao") {
        await supabase
          .from("store_balances")
          .update({ comissao_pendente: 0 })
          .eq("store_id", row.store_id);
      } else if (kind === "entrega_fee") {
        await supabase
          .from("store_balances")
          .update({ repasse_pendente: 0 })
          .eq("store_id", row.store_id);
      } else if (kind === "pdv_fee") {
        await supabase
          .from("store_plans")
          .update({ pdv_commission_pending: 0 })
          .eq("store_id", row.store_id)
          .eq("is_active", true);
      } else if (kind === "mensalidade") {
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
        await supabase
          .from("store_plans")
          .update({ next_billing_date: next.toISOString() })
          .eq("store_id", row.store_id)
          .eq("is_active", true);
      }

      toast.success(`${KIND_META[kind].label} de ${row.name} marcada como paga`);
      qc.invalidateQueries({ queryKey: ["areceber-platform"] });
      qc.invalidateQueries({ queryKey: ["historico-repasses"] });
    } catch (e: any) {
      toast.error("Falha ao marcar pago", { description: e.message });
    } finally {
      setPaying(null);
    }
  }

  function cobrarWhatsApp(row: StoreReceivable) {
    if (!row.phone) {
      toast.error("Loja sem telefone cadastrado");
      return;
    }
    const parts: string[] = [];
    if (row.mensalidade > 0) parts.push(`• Mensalidade: ${brl(row.mensalidade)}${row.mensalidade_overdue_days > 0 ? ` (${row.mensalidade_overdue_days}d atraso)` : ""}`);
    if (row.comissao > 0) parts.push(`• Comissão: ${brl(row.comissao)}`);
    if (row.entrega_fee > 0) parts.push(`• Taxa R$2/entrega: ${brl(row.entrega_fee)}`);
    if (row.pdv_fee > 0) parts.push(`• PDV: ${brl(row.pdv_fee)}`);
    const msg = `Olá ${row.name}! 👋\n\nValores pendentes na plataforma:\n${parts.join("\n")}\n\nTotal: *${brl(row.total)}*\n\nQualquer dúvida estamos à disposição!`;
    const phone = String(row.phone).replace(/\D/g, "");
    const url = `https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      {/* Hero total */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Wallet className="w-4 h-4" /> Total a receber das lojas
          </div>
          <p className="text-3xl font-black text-primary tabular-nums">{brl(totals.total)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
            <Breakdown icon={Crown} label="Mensalidades" value={totals.mensalidade} color="text-primary" />
            <Breakdown icon={Truck} label="R$2/entrega" value={totals.entrega_fee} color="text-amber-500" />
            <Breakdown icon={Percent} label="Comissão" value={totals.comissao} color="text-primary" />
            <Breakdown icon={ShoppingCart} label="PDV" value={totals.pdv_fee} color="text-emerald-500" />
          </div>
        </CardContent>
      </Card>

      {/* Por loja */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            ✅ Nenhuma loja com valor pendente. Tudo em dia!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.store_id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{r.name}</span>
                    <Badge variant="outline" className="text-[10px]">{planLabel(r.plan_type)}</Badge>
                    {r.mensalidade_overdue_days > 0 && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="w-3 h-3" /> {r.mensalidade_overdue_days}d atraso
                      </Badge>
                    )}
                  </div>
                  <span className="text-lg font-black text-foreground tabular-nums">{brl(r.total)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(["mensalidade", "comissao", "entrega_fee", "pdv_fee"] as ReceivableKind[]).map((k) => {
                    const v = r[k];
                    if (v <= 0) return null;
                    const meta = KIND_META[k];
                    const Icon = meta.icon;
                    const key = `${r.store_id}:${k}`;
                    return (
                      <div key={k} className="flex items-center justify-between bg-muted/40 rounded-lg p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                          <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground leading-tight">{meta.label}</p>
                            <p className="text-sm font-bold leading-tight tabular-nums">{brl(v)}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={paying === key}
                          onClick={() => markPaid(r, k, v)}
                          className="h-7 text-[11px] gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Pago
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => cobrarWhatsApp(r)} className="gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> Cobrar via WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

function Breakdown({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Crown;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-background/60 rounded-lg p-2 border border-border/60">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className={`w-3 h-3 ${color}`} /> {label}
      </div>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{brl(value)}</p>
    </div>
  );
}

export default AReceberTab;