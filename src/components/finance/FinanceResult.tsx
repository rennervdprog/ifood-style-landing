import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ─── Fase 3 (Relatórios/Financeiro v2): Resultado de verdade ───
// DRE simplificado + ponto de equilíbrio + agenda de caixa, a partir do
// cadastro de custos da loja (tabela store_costs):
//  - CMV: um percentual sobre o subtotal vendido (cost_type='cmv_percent').
//  - Equipe e entregas / Custos fixos: valores MENSAIS (cost_type=
//    'fixed_monthly', category 'equipe'/'fixo'), rateados no período pela
//    convenção de mês comercial de 30 dias (valor × dias do período ÷ 30).
// Sem custo cadastrado, a tela mostra a estrutura com "a cadastrar" — nunca
// inventa número (prévia aprovada pelo Renner, Tela 8).

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtPtBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function parseMoney(v: string): number {
  const t = (v || "").trim().replace(/\s/g, "");
  if (!t) return 0;
  const n = t.includes(",")
    ? parseFloat(t.replace(/\./g, "").replace(",", "."))
    : parseFloat(t);
  return isNaN(n) ? 0 : n;
}
const INVALID = ["cancelado", "aguardando_pagamento", "aguardando_comprovante"];
const isValid = (o: any) => !INVALID.includes(o.status);

type Preset = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mespassado" | "custom";

export default function FinanceResult({ storeId, storeName }: { storeId: string; storeName?: string }) {
  const queryClient = useQueryClient();
  const today = useMemo(() => isoDate(new Date()), []);
  const [preset, setPreset] = useState<Preset>("30d");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return isoDate(d);
  });
  const [endDate, setEndDate] = useState<string>(today);

  function applyPreset(p: Preset) {
    setPreset(p);
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);
    if (p === "hoje") { /* mesmo dia */ }
    else if (p === "ontem") { start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); }
    else if (p === "7d") start.setDate(now.getDate() - 6);
    else if (p === "30d") start.setDate(now.getDate() - 29);
    else if (p === "mes") { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (p === "mespassado") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else return;
    setStartDate(isoDate(start));
    setEndDate(isoDate(end));
  }

  const daysInPeriod = Math.max(1, Math.round((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / 86400000) + 1);
  const rateio = daysInPeriod / 30;

  // Pedidos do período (margem de 1 dia + filtro pela data local).
  const { data: periodOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ["result-orders", storeId, startDate, endDate],
    queryFn: async () => {
      const from = parseISO(startDate); from.setDate(from.getDate() - 1);
      const to = parseISO(endDate); to.setDate(to.getDate() + 1);
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, status, total_price, subtotal, payment_method")
        .eq("store_id", storeId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return (data || []).filter((o: any) => {
        const d = isoDate(new Date(o.created_at));
        return d >= startDate && d <= endDate;
      });
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  // Taxas de entrega que a plataforma acumulou no período (valor exato).
  const { data: accrualsSum } = useQuery({
    queryKey: ["result-accruals", storeId, startDate, endDate],
    queryFn: async () => {
      const from = parseISO(startDate);
      const to = parseISO(endDate); to.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from("platform_fee_accruals" as any)
        .select("amount")
        .eq("store_id", storeId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  // Cadastro de custos da loja.
  const { data: costs } = useQuery({
    queryKey: ["store-costs", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_costs" as any)
        .select("id, name, amount, cost_type, category")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
    enabled: !!storeId,
  });

  // Mês atual (base do ponto de equilíbrio, que é mensal por natureza).
  const monthStart = useMemo(() => {
    const n = new Date();
    return isoDate(new Date(n.getFullYear(), n.getMonth(), 1));
  }, []);
  const { data: monthOrders } = useQuery({
    queryKey: ["result-month-orders", storeId, monthStart],
    queryFn: async () => {
      const from = parseISO(monthStart); from.setDate(from.getDate() - 1);
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, status, total_price, payment_method")
        .eq("store_id", storeId)
        .gte("created_at", from.toISOString());
      if (error) throw error;
      return (data || []).filter((o: any) => isValid(o) && isoDate(new Date(o.created_at)) >= monthStart);
    },
    staleTime: 60_000,
    enabled: !!storeId,
  });
  const { data: monthAccruals } = useQuery({
    queryKey: ["result-month-accruals", storeId, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_fee_accruals" as any)
        .select("amount")
        .eq("store_id", storeId)
        .gte("created_at", parseISO(monthStart).toISOString());
      if (error) throw error;
      return (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    },
    staleTime: 60_000,
    enabled: !!storeId,
  });

  // Agenda: saldos, plano e cobranças em aberto.
  const { data: agenda } = useQuery({
    queryKey: ["result-agenda", storeId],
    queryFn: async () => {
      const [bal, plan, txs] = await Promise.all([
        supabase.from("store_balances").select("repasse_pendente, comissao_pendente").eq("store_id", storeId).maybeSingle(),
        supabase.from("store_plans").select("monthly_fee, next_billing_date, pdv_commission_pending").eq("store_id", storeId).eq("is_active", true).maybeSingle(),
        supabase.from("financial_transactions").select("id, amount, status, created_at, metadata, reference_code")
          .eq("store_id", storeId).not("status", "in", "(paid,cancelled,settled)").order("created_at", { ascending: false }).limit(5),
      ]);
      return {
        repasse: Number((bal.data as any)?.repasse_pendente || 0) + Number((bal.data as any)?.comissao_pendente || 0) + Number((plan.data as any)?.pdv_commission_pending || 0),
        monthlyFee: Number((plan.data as any)?.monthly_fee || 0),
        nextBilling: (plan.data as any)?.next_billing_date as string | null,
        openCharges: (txs.data || []) as any[],
      };
    },
    staleTime: 60_000,
    enabled: !!storeId,
  });

  // ─── Derivados ───
  const valid = (periodOrders || []).filter(isValid);
  const receita = valid.reduce((s, o: any) => s + Number(o.total_price || 0), 0);
  const itensSubtotal = valid.reduce((s, o: any) => s + Number(o.subtotal || 0), 0);
  const pixCount = valid.filter((o: any) => o.payment_method === "pix" || o.payment_method === "pix_direto").length;
  const taxas = Number(accrualsSum || 0) + pixCount * 1.99;

  const cmvRow = (costs || []).find((c) => c.cost_type === "cmv_percent");
  const cmvPct = cmvRow ? Number(cmvRow.amount || 0) : null;
  const equipeRows = (costs || []).filter((c) => c.cost_type === "fixed_monthly" && c.category === "equipe");
  const fixoRows = (costs || []).filter((c) => c.cost_type === "fixed_monthly" && c.category === "fixo");
  const equipeMonthly = equipeRows.reduce((s, c) => s + Number(c.amount || 0), 0);
  const fixoMonthly = fixoRows.reduce((s, c) => s + Number(c.amount || 0), 0);
  const fixedMonthlyTotal = equipeMonthly + fixoMonthly;

  const cmvValue = cmvPct != null ? (itensSubtotal * cmvPct) / 100 : null;
  const hasCosts = cmvPct != null && fixedMonthlyTotal > 0;
  const sobrou = hasCosts
    ? receita - taxas - (cmvValue || 0) - equipeMonthly * rateio - fixoMonthly * rateio
    : null;

  // Ponto de equilíbrio (mês atual).
  const monthReceita = (monthOrders || []).reduce((s, o: any) => s + Number(o.total_price || 0), 0);
  const monthPix = (monthOrders || []).filter((o: any) => o.payment_method === "pix" || o.payment_method === "pix_direto").length;
  const monthTaxas = Number(monthAccruals || 0) + monthPix * 1.99;
  const monthTicket = (monthOrders || []).length ? monthReceita / (monthOrders || []).length : 0;
  const marginPct = cmvPct != null
    ? 1 - cmvPct / 100 - (monthReceita > 0 ? monthTaxas / monthReceita : 0)
    : null;
  const beMonth = hasCosts && marginPct != null && marginPct > 0.05 ? fixedMonthlyTotal / marginPct : null;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const beDay = beMonth != null ? beMonth / daysInMonth : null;
  const beOrdersDay = beDay != null && monthTicket > 0 ? beDay / monthTicket : null;
  const beProgress = beMonth != null && beMonth > 0 ? Math.min(100, (monthReceita / beMonth) * 100) : 0;
  const beMissing = beMonth != null ? Math.max(0, beMonth - monthReceita) : null;

  const nextMonday = useMemo(() => {
    const d = new Date();
    const add = (8 - d.getDay()) % 7;
    d.setDate(d.getDate() + add);
    return d;
  }, []);

  // ─── Ações do cadastro ───
  const [cmvInput, setCmvInput] = useState("");
  const [newCost, setNewCost] = useState<Record<string, { name: string; amount: string }>>({});
  const [saving, setSaving] = useState(false);

  const refreshCosts = () => queryClient.invalidateQueries({ queryKey: ["store-costs", storeId] });

  const saveCmv = async () => {
    const pct = parseMoney(cmvInput || (cmvPct != null ? String(cmvPct) : ""));
    if (!(pct > 0 && pct <= 100)) { toast.error("Informe um percentual entre 1 e 100."); return; }
    setSaving(true);
    try {
      if (cmvRow) {
        const { error } = await supabase.from("store_costs" as any).update({ amount: pct, updated_at: new Date().toISOString() }).eq("id", cmvRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_costs" as any).insert({ store_id: storeId, name: "Custo dos produtos (CMV)", amount: pct, cost_type: "cmv_percent", category: "cmv" });
        if (error) throw error;
      }
      toast.success("CMV salvo!");
      refreshCosts();
    } catch { toast.error("Não consegui salvar o CMV. Tente de novo."); }
    finally { setSaving(false); }
  };

  const addCost = async (category: "equipe" | "fixo") => {
    const draft = newCost[category] || { name: "", amount: "" };
    const amount = parseMoney(draft.amount);
    if (!draft.name.trim() || !(amount > 0)) { toast.error("Preencha o nome e o valor mensal do custo."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("store_costs" as any).insert({
        store_id: storeId, name: draft.name.trim(), amount, cost_type: "fixed_monthly", category,
      });
      if (error) throw error;
      setNewCost((s) => ({ ...s, [category]: { name: "", amount: "" } }));
      toast.success("Custo cadastrado!");
      refreshCosts();
    } catch { toast.error("Não consegui cadastrar. Tente de novo."); }
    finally { setSaving(false); }
  };

  const removeCost = async (id: string) => {
    try {
      const { error } = await supabase.from("store_costs" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Custo removido.");
      refreshCosts();
    } catch { toast.error("Não consegui remover. Tente de novo."); }
  };

  const presets: { key: Preset; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "ontem", label: "Ontem" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "mes", label: "Este mês" },
    { key: "mespassado", label: "Mês passado" },
  ];

  const costSection = (category: "equipe" | "fixo", title: string, rows: any[], monthly: number) => (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-foreground">{title}</p>
        <span className="text-[11px] text-muted-foreground">{monthly > 0 ? `${formatCurrency(monthly)}/mês` : "nada cadastrado"}</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2">
            <span className="flex-1 min-w-0 truncate text-xs font-semibold text-foreground">{c.name}</span>
            <span className="text-xs font-bold text-foreground">{formatCurrency(Number(c.amount || 0))}/mês</span>
            <button onClick={() => removeCost(c.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${c.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            value={(newCost[category]?.name || "")}
            onChange={(e) => setNewCost((s) => ({ ...s, [category]: { name: e.target.value, amount: s[category]?.amount || "" } }))}
            placeholder={category === "equipe" ? "Ex.: Motoboy, ajudante…" : "Ex.: Aluguel, luz, internet…"}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs"
          />
          <input
            value={(newCost[category]?.amount || "")}
            onChange={(e) => setNewCost((s) => ({ ...s, [category]: { name: s[category]?.name || "", amount: e.target.value } }))}
            placeholder="R$/mês"
            inputMode="decimal"
            className="w-24 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs"
          />
          <button
            onClick={() => addCost(category)}
            disabled={saving}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Período único (mesmo padrão dos Relatórios) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              preset === p.key ? "bg-foreground text-background" : "bg-card text-muted-foreground border border-border/60 hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="inline-flex items-center gap-1.5 ml-1">
          <input type="date" value={startDate} max={endDate} onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }} className="px-2 py-1.5 rounded-lg bg-card border border-border text-[11px] font-semibold" />
          <span className="text-[11px] text-muted-foreground">até</span>
          <input type="date" value={endDate} min={startDate} max={today} onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }} className="px-2 py-1.5 rounded-lg bg-card border border-border text-[11px] font-semibold" />
        </span>
      </div>

      {/* DRE simplificado */}
      <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
        <p className="text-xs font-bold text-foreground mb-1">📊 Resultado do período — DRE simplificado</p>
        <p className="text-[10px] text-muted-foreground mb-4">Período: <strong>{fmtPtBR(startDate)}</strong> a <strong>{fmtPtBR(endDate)}</strong>. Custos mensais entram rateados pelos dias do período (mês de 30 dias).</p>
        {loadingOrders ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-foreground">Vendeu</span>
              <span className="font-black text-foreground">{formatCurrency(receita)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">− Taxas da plataforma ItaSuper <span className="block text-[10px]">R$ 0,99 por entrega + R$ 1,99 por pedido Pix, no período</span></span>
              <span className="font-bold text-foreground">{formatCurrency(taxas)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">− Custo dos produtos (CMV){cmvPct != null && <span className="block text-[10px]">{cmvPct}% sobre os itens vendidos</span>}</span>
              <span className="font-bold text-foreground">{cmvValue != null ? formatCurrency(cmvValue) : <span className="text-primary text-xs font-bold">a cadastrar</span>}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">− Equipe e entregas{equipeMonthly > 0 && <span className="block text-[10px]">{formatCurrency(equipeMonthly)}/mês cadastrados</span>}</span>
              <span className="font-bold text-foreground">{equipeMonthly > 0 ? formatCurrency(equipeMonthly * rateio) : <span className="text-primary text-xs font-bold">a cadastrar</span>}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">− Custos fixos (aluguel, luz, internet…){fixoMonthly > 0 && <span className="block text-[10px]">{formatCurrency(fixoMonthly)}/mês cadastrados</span>}</span>
              <span className="font-bold text-foreground">{fixoMonthly > 0 ? formatCurrency(fixoMonthly * rateio) : <span className="text-primary text-xs font-bold">a cadastrar</span>}</span>
            </div>
            <div className="border-t border-border/60 pt-2.5 flex items-baseline justify-between gap-2">
              <span className="font-black text-foreground">= Sobrou no período</span>
              {sobrou != null ? (
                <span className={`text-lg font-black ${sobrou >= 0 ? "text-emerald-500" : "text-red-500"}`}>{formatCurrency(sobrou)}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">aparece quando os custos entrarem</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cadastro de custos */}
      <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
        <p className="text-xs font-bold text-foreground mb-1">✎ Meus custos</p>
        <p className="text-[10px] text-muted-foreground mb-4">Cadastre uma vez — o resultado e o ponto de equilíbrio se calculam sozinhos a cada período. Custo por produto entra numa próxima etapa; por enquanto o CMV é um percentual médio das suas vendas de itens.</p>
        <div className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold text-foreground">Custo dos produtos (CMV)</p>
              <span className="text-[11px] text-muted-foreground">{cmvPct != null ? `${cmvPct}% das vendas de itens` : "não cadastrado"}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={cmvInput}
                onChange={(e) => setCmvInput(e.target.value)}
                placeholder={cmvPct != null ? String(cmvPct) : "Ex.: 30"}
                inputMode="decimal"
                className="w-24 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs"
              />
              <span className="text-xs text-muted-foreground">% — quanto do que você vende é custo de mercadoria, em média</span>
              <button onClick={saveCmv} disabled={saving} className="shrink-0 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 disabled:opacity-50">
                Salvar CMV
              </button>
            </div>
          </div>
          {costSection("equipe", "Equipe e entregas (por mês)", equipeRows, equipeMonthly)}
          {costSection("fixo", "Custos fixos (por mês)", fixoRows, fixoMonthly)}
        </div>
      </div>

      {/* Ponto de equilíbrio */}
      <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
        <p className="text-xs font-bold text-foreground mb-1">🎯 Ponto de equilíbrio</p>
        {!hasCosts || beMonth == null ? (
          <p className="text-xs text-muted-foreground">Com os custos fixos e a margem cadastrados, aqui aparece: <em>"Você precisa vender R$ X por dia (≈ N pedidos) pra empatar o mês"</em> — e quanto falta hoje.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Você precisa vender <strong>{formatCurrency(beDay || 0)} por dia</strong>
              {beOrdersDay != null && <> (≈ <strong>{Math.max(1, Math.round(beOrdersDay))} pedidos</strong>)</>} pra empatar o mês — total de <strong>{formatCurrency(beMonth)}</strong> em {now.toLocaleDateString("pt-BR", { month: "long" })}.
            </p>
            <div>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Vendido no mês até agora</span>
                <span className="font-bold text-foreground">{formatCurrency(monthReceita)} · {beProgress.toFixed(0)}% do empate</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full" style={{ width: `${beProgress}%` }} />
              </div>
            </div>
            {beMissing != null && beMissing > 0 ? (
              <p className="text-xs text-muted-foreground">Faltam <strong className="text-foreground">{formatCurrency(beMissing)}</strong> pra empatar o mês.</p>
            ) : (
              <p className="text-xs font-bold text-emerald-500">Você já empatou o mês. Daqui pra frente é lucro. 🎉</p>
            )}
          </div>
        )}
      </div>

      {/* Agenda de caixa */}
      <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
        <p className="text-xs font-bold text-foreground mb-4">🗓️ Agenda de caixa — próximos vencimentos</p>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Segunda, {nextMonday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · Repasse ItaSuper</span>
            <span className="font-bold text-foreground">{formatCurrency(agenda?.repasse || 0)} acumulados*</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Mensalidade do plano{agenda?.nextBilling ? ` · próxima em ${fmtPtBR(String(agenda.nextBilling).slice(0, 10))}` : ""}</span>
            <span className="font-bold text-foreground">{(agenda?.monthlyFee || 0) > 0 ? `${formatCurrency(agenda?.monthlyFee || 0)}/mês` : "sem mensalidade ativa"}</span>
          </div>
          {(agenda?.openCharges || []).map((t: any) => (
            <div key={t.id} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Cobrança em aberto{t.metadata?.due_date ? ` · vence ${fmtPtBR(String(t.metadata.due_date).slice(0, 10))}` : ""}</span>
              <span className="font-bold text-foreground">{formatCurrency(Number(t.amount || 0))}</span>
            </div>
          ))}
          {fixoRows.concat(equipeRows).length === 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Contas da loja (aluguel, luz…)</span>
              <span className="text-[11px] text-muted-foreground">entram com o cadastro de custos</span>
            </div>
          ) : (
            fixoRows.concat(equipeRows).map((c) => (
              <div key={c.id} className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">Todo mês · {c.name}</span>
                <span className="font-bold text-foreground">{formatCurrency(Number(c.amount || 0))}</span>
              </div>
            ))
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">*A cobrança do repasse só é gerada quando o saldo passa de R$ 150, na segunda-feira.</p>
      </div>
    </div>
  );
}
