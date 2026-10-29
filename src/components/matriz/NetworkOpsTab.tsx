/**
 * NetworkOpsTab — aba "Operação" do Painel Matriz Gestor.
 *
 * Central de pendências derivada de dados reais:
 *  (a) unidade publicada sem pedidos há 2+ dias (orders);
 *  (b) unidade com divergência de cardápio (RPC network_menu_divergence
 *      da Fase 3, a mesma do modal de sincronização);
 *  (c) repasse pendente de uma unidade acima de 2× a média das outras
 *      (store_balances, via financeiro consolidado do painel);
 *  (d) checklist incompleto (RPC network_unit_checklist).
 * Ações em massa: sincronizar o cardápio de todas (loop sobre a mesma RPC
 * do sync individual) e — via RPCs novas da migration do Gestor, com
 * checagem de dono no banco — aplicar taxa de entrega e copiar o horário
 * de uma unidade para todas.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  checklistMissingLabels,
  parseMoneyField,
  parseResyncMenuResult,
  type UnitChecklist,
} from "@/lib/networkUnits";
import { daysSince } from "@/lib/networkGestor";
import {
  useLastOrderByUnit,
  useMenuDivergences,
  type GestorUnitLite,
} from "./useGestorData";

interface FinancialsProp {
  repasseByStore: { store_id: string; repasse: number }[];
}

interface AlertItem {
  key: string;
  level: "red" | "amber" | "green";
  title: string;
  desc: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** A RPC nova ainda não foi aplicada neste ambiente? */
function rpcUnavailable(err: any): boolean {
  const msg = String(err?.message || "");
  return err?.code === "PGRST202" || /does not exist|schema cache/i.test(msg);
}

const LEVEL_CLS = {
  red: "bg-red-500/10 text-red-600",
  amber: "bg-amber-500/10 text-amber-600",
  green: "bg-green-500/10 text-green-600",
};

export default function NetworkOpsTab({
  network,
  sublojas,
  checklists,
  financials,
  onShowUnit,
  onSyncUnit,
  onGoFinance,
}: {
  network: { id: string };
  sublojas: GestorUnitLite[];
  checklists: Map<string, UnitChecklist>;
  financials?: FinancialsProp | null;
  onShowUnit: (unitId: string) => void;
  onSyncUnit: (unit: GestorUnitLite) => void;
  onGoFinance: () => void;
}) {
  const queryClient = useQueryClient();
  const sublojaIds = sublojas.map((u) => u.id);
  const published = sublojas.filter((u) => !u.is_draft);
  const publishedIds = published.map((u) => u.id);

  const { data: lastOrderByUnit } = useLastOrderByUnit(sublojaIds);
  const { sourceStoreId, data: divergences, isLoading: divLoading } =
    useMenuDivergences(network.id, publishedIds);

  const [syncAll, setSyncAll] = useState<{
    running: boolean;
    done: number;
    total: number;
    results: { unitName: string; ok: boolean; message: string }[];
  }>({ running: false, done: 0, total: 0, results: [] });
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [feeValue, setFeeValue] = useState("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [hoursSourceId, setHoursSourceId] = useState<string>("");
  const [hoursSaving, setHoursSaving] = useState(false);

  /* ─── Alertas ─────────────────────────────────────────────────────── */
  const alerts: AlertItem[] = [];

  for (const u of published) {
    const last = lastOrderByUnit?.get(u.id);
    const ref = last ? new Date(last) : u.created_at ? new Date(u.created_at) : null;
    const days = ref ? daysSince(ref) : null;
    if (days !== null && days >= 2) {
      alerts.push({
        key: `sem-pedidos-${u.id}`,
        level: "red",
        title: last
          ? `${u.name} sem pedidos há ${days} dias`
          : `${u.name} ainda não recebeu pedidos`,
        desc: last
          ? "A unidade está publicada, mas não recebe pedidos há dias. Pode ser cardápio, taxa de entrega ou a loja fechada na prática."
          : `Publicada há ${days} dias e nenhum pedido até agora. Confira cardápio, taxa de entrega e horário.`,
        actionLabel: "Ver a unidade →",
        onAction: () => onShowUnit(u.id),
      });
    }
  }

  for (const u of published) {
    if (u.id === sourceStoreId) continue;
    const div = divergences?.get(u.id);
    if (div && div.needsSync > 0) {
      alerts.push({
        key: `divergencia-${u.id}`,
        level: "amber",
        title: `${u.name} com cardápio dessincronizado`,
        desc: `${div.needsSync} ${div.needsSync === 1 ? "item está diferente" : "itens estão diferentes"} do cardápio da rede${div.ownPrice > 0 ? ` (${div.ownPrice} com preço próprio)` : ""}. Sincronize pra voltar ao padrão.`,
        actionLabel: "Sincronizar agora →",
        onAction: () => onSyncUnit(u),
      });
    }
  }

  const repasseByStore = financials?.repasseByStore || [];
  for (const r of repasseByStore) {
    if (r.repasse <= 0) continue;
    const others = repasseByStore.filter((x) => x.store_id !== r.store_id && x.repasse > 0);
    if (others.length === 0) continue;
    const meanOthers = others.reduce((s, x) => s + x.repasse, 0) / others.length;
    if (r.repasse > 2 * meanOthers) {
      const unit = sublojas.find((u) => u.id === r.store_id);
      if (!unit) continue;
      alerts.push({
        key: `repasse-${r.store_id}`,
        level: "amber",
        title: `Repasse da ${unit.name} acima do normal`,
        desc: `${formatBRL(r.repasse)} pendentes — mais que o dobro da média das outras unidades. Confere na segunda, no fechamento do repasse.`,
        actionLabel: "Ver financeiro →",
        onAction: onGoFinance,
      });
    }
  }

  const incomplete = sublojas.filter((u) => {
    const c = checklists.get(u.id);
    return c && !c.ready;
  });
  if (incomplete.length > 0) {
    const first = incomplete[0];
    const firstChecklist = checklists.get(first.id);
    alerts.push({
      key: "checklist",
      level: incomplete.length === sublojas.length && sublojas.length > 0 ? "amber" : "green",
      title: incomplete.length === 1
        ? `Checklist da ${first.name} incompleto`
        : `${incomplete.length} unidades com checklist incompleto`,
      desc: firstChecklist
        ? `Na ${first.name} falta: ${checklistMissingLabels(firstChecklist).join(", ").toLowerCase()}. Sem o checklist completo, a unidade não publica.`
        : "Complete o checklist para publicar as unidades.",
      actionLabel: "Ver a unidade →",
      onAction: () => onShowUnit(first.id),
    });
  }

  const attentionCount = alerts.filter((a) => a.level !== "green").length;

  /* ─── Ações em massa ──────────────────────────────────────────────── */
  const handleSyncAll = async () => {
    if (!sourceStoreId) {
      toast.error("Nenhuma unidade publicada para ser a fonte do cardápio.");
      return;
    }
    const targets = published.filter((u) => u.id !== sourceStoreId);
    if (targets.length === 0) {
      toast.info("Só a unidade-fonte está publicada — nada para sincronizar.");
      return;
    }
    setSyncAll({ running: true, done: 0, total: targets.length, results: [] });
    const results: { unitName: string; ok: boolean; message: string }[] = [];
    for (const u of targets) {
      try {
        const { data, error } = await (supabase as any).rpc("resync_menu_from_matriz", {
          _source_store_id: sourceStoreId,
          _target_store_id: u.id,
          _overwrite_price: false,
        });
        if (error) throw error;
        const r = parseResyncMenuResult(data);
        results.push({
          unitName: u.name,
          ok: true,
          message: `${r.productsCopied} novos · ${r.productsUpdated} atualizados${r.productsPriceSkipped > 0 ? ` · ${r.productsPriceSkipped} preços próprios preservados` : ""}`,
        });
      } catch (err: any) {
        results.push({ unitName: u.name, ok: false, message: err?.message || "Falha ao sincronizar." });
      }
      setSyncAll({ running: true, done: results.length, total: targets.length, results: [...results] });
    }
    setSyncAll({ running: false, done: results.length, total: targets.length, results });
    const okCount = results.filter((r) => r.ok).length;
    if (okCount === results.length) toast.success(`Cardápio sincronizado em ${okCount} unidade(s).`);
    else toast.error(`${okCount} de ${results.length} unidades sincronizadas — veja os detalhes abaixo.`);
    queryClient.invalidateQueries({ queryKey: ["matriz-gestor-divergences"] });
    queryClient.invalidateQueries({ queryKey: ["matriz-v2-checklists"] });
  };

  const handleApplyFee = async () => {
    const fee = parseMoneyField(feeValue);
    if (fee === null || fee < 0) {
      toast.error("Digite uma taxa de entrega válida (ex.: 6,99).");
      return;
    }
    setFeeSaving(true);
    try {
      const { error } = await (supabase as any).rpc("set_network_delivery_fee", {
        _network_id: network.id,
        _fee: fee,
      });
      if (error) throw error;
      toast.success(`Taxa de entrega de ${formatBRL(fee)} aplicada em todas as sublojas.`);
      setFeeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["matriz-v2-stores"] });
    } catch (err: any) {
      toast.error(
        rpcUnavailable(err)
          ? "A taxa em massa entra no ar com a atualização do Gestor (migration ainda não aplicada)."
          : err?.message || "Erro ao aplicar a taxa.",
      );
    } finally {
      setFeeSaving(false);
    }
  };

  const handleApplyHours = async () => {
    const sourceId = hoursSourceId || sourceStoreId || published[0]?.id;
    if (!sourceId) {
      toast.error("Nenhuma unidade publicada para copiar o horário.");
      return;
    }
    setHoursSaving(true);
    try {
      const { error } = await (supabase as any).rpc("apply_network_opening_hours", {
        _network_id: network.id,
        _source_store_id: sourceId,
      });
      if (error) throw error;
      toast.success("Horário aplicado em todas as sublojas.");
      setHoursModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["matriz-gestor-open-status"] });
      queryClient.invalidateQueries({ queryKey: ["matriz-v2-checklists"] });
    } catch (err: any) {
      toast.error(
        rpcUnavailable(err)
          ? "O horário em massa entra no ar com a atualização do Gestor (migration ainda não aplicada)."
          : err?.message || "Erro ao aplicar o horário.",
      );
    } finally {
      setHoursSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Central de pendências */}
      <p className="text-xs font-black text-muted-foreground uppercase">
        Central de pendências{attentionCount > 0 ? ` · ${attentionCount} ${attentionCount === 1 ? "precisa" : "precisam"} de atenção` : ""}
      </p>
      {alerts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-4 flex gap-3">
          <div className="w-9 h-9 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Tudo em dia na rede</p>
            <p className="text-xs text-muted-foreground mt-0.5">Nenhuma pendência operacional encontrada nas unidades publicadas.</p>
          </div>
        </div>
      ) : (
        alerts.map((a) => (
          <div key={a.key} className="bg-card border border-border rounded-2xl p-3.5 flex gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${LEVEL_CLS[a.level]}`}>
              {a.level === "green" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</p>
              {a.actionLabel && a.onAction && (
                <button onClick={a.onAction} className="text-xs font-bold text-primary mt-1.5">
                  {a.actionLabel}
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* Ações em massa */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">Ações para a rede inteira</p>
      <button
        onClick={handleSyncAll}
        disabled={syncAll.running}
        className="w-full bg-primary text-primary-foreground rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
      >
        {syncAll.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {syncAll.running
          ? `Sincronizando… ${syncAll.done}/${syncAll.total}`
          : "Sincronizar cardápio de todas"}
      </button>
      {syncAll.results.length > 0 && !syncAll.running && (
        <div className="bg-card border border-border rounded-2xl p-3.5 space-y-1.5">
          {syncAll.results.map((r) => (
            <p key={r.unitName} className="text-xs flex items-start gap-1.5">
              {r.ok
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                : <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />}
              <span><b>{r.unitName}:</b> <span className="text-muted-foreground">{r.message}</span></span>
            </p>
          ))}
        </div>
      )}
      <button
        onClick={() => setFeeModalOpen(true)}
        className="w-full bg-card border border-border rounded-2xl py-3.5 font-bold text-sm active:scale-[0.98] transition-transform"
      >
        Aplicar taxa de entrega em todas
      </button>
      <button
        onClick={() => { setHoursSourceId(sourceStoreId || published[0]?.id || ""); setHoursModalOpen(true); }}
        className="w-full bg-card border border-border rounded-2xl py-3.5 font-bold text-sm active:scale-[0.98] transition-transform"
      >
        Definir horário de funcionamento em todas
      </button>

      {/* Status de sincronização */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">Sincronização do cardápio</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        {!sourceStoreId && (
          <p className="text-sm text-muted-foreground">
            Nenhuma subloja publicada na rede para usar como fonte do cardápio.
          </p>
        )}
        {published.map((u, i) => {
          const isSource = u.id === sourceStoreId;
          const div = divergences?.get(u.id);
          return (
            <div key={u.id} className={`flex items-center gap-2 py-2.5 ${i > 0 ? "border-t border-border" : "pt-0"} ${i === published.length - 1 ? "pb-0" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{u.name}</p>
                <p className={`text-[11px] mt-0.5 ${!isSource && div && div.needsSync > 0 ? "text-amber-600 font-bold" : "text-green-600 font-bold"}`}>
                  {isSource
                    ? "É a unidade-fonte do cardápio"
                    : divLoading || !divergences
                      ? "Comparando…"
                      : div && div.needsSync > 0
                        ? `${div.needsSync} ${div.needsSync === 1 ? "divergência" : "divergências"}`
                        : "Sincronizado"}
                </p>
              </div>
              {isSource ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 uppercase shrink-0">Fonte</span>
              ) : div && div.needsSync > 0 ? (
                <button onClick={() => onSyncUnit(u)} className="text-xs font-bold text-primary shrink-0">
                  Sincronizar
                </button>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 uppercase shrink-0">Em dia</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: taxa de entrega em massa */}
      {feeModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-black">Taxa de entrega da rede</h2>
              <button onClick={() => setFeeModalOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aplica a mesma taxa de entrega nas <b>{sublojas.length} sublojas</b> da rede de uma vez.
                Cada loja continua podendo ter a sua própria depois, no painel dela.
              </p>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Taxa de entrega (R$)</label>
                <input
                  value={feeValue}
                  onChange={(e) => setFeeValue(e.target.value)}
                  placeholder="6,99"
                  inputMode="decimal"
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
              <button
                onClick={handleApplyFee}
                disabled={feeSaving}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {feeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Aplicar em todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: horário em massa (copia de uma unidade-fonte) */}
      {hoursModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-black">Horário de funcionamento da rede</h2>
              <button onClick={() => setHoursModalOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Escolha a unidade com o horário certo — ele é copiado para todas as outras sublojas,
                substituindo o horário atual delas.
              </p>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Copiar o horário de</label>
                <select
                  value={hoursSourceId}
                  onChange={(e) => setHoursSourceId(e.target.value)}
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm"
                >
                  {published.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleApplyHours}
                disabled={hoursSaving || published.length === 0}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {hoursSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Aplicar em todas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
