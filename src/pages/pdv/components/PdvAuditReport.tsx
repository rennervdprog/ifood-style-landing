import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText, ShieldCheck, XCircle, ArrowUpFromLine, Loader2, Inbox,
} from "lucide-react";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";

interface Props {
  storeId: string;
}

type AuditKind = "cancelamento" | "sangria";

interface AuditItem {
  id: string;
  kind: AuditKind;
  at: string;
  operatorName: string;
  authorizedByName?: string;
  detail: string;
  amount: number;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

/**
 * Fase 3 — Relatório de auditoria do PDV.
 * Lista ações sensíveis: cancelamentos de venda e sangrias autorizadas
 * por gerente, com data/hora, operador e valor.
 * Acesso restrito a gerentes (gate de PIN na abertura).
 */
export function PdvAuditReport({ storeId }: Props) {
  const [authorized, setAuthorized] = useState(false);
  const [showGate, setShowGate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [filter, setFilter] = useState<"todos" | AuditKind>("todos");

  const load = async () => {
    setLoading(true);
    try {
      // Nomes dos operadores (id -> nome) para exibir quem fez/autorizou.
      const { data: ops } = await supabase.rpc("pdv_list_operators" as any, {
        _store_id: storeId,
      } as any);
      const nameById = new Map<string, string>();
      ((ops as any[]) || []).forEach((o: any) => {
        if (o?.id) nameById.set(o.id, o.name || "—");
      });

      // 1) Cancelamentos de venda.
      const { data: canc, error: e1 } = await supabase
        .from("pdv_sale_cancellations" as any)
        .select("id, operator_name, reason, amount, canceled_at")
        .eq("store_id", storeId)
        .order("canceled_at", { ascending: false })
        .limit(100);
      if (e1) throw e1;

      // 2) Sangrias autorizadas por gerente.
      const { data: movs, error: e2 } = await supabase
        .from("pdv_movements" as any)
        .select("id, amount, description, created_at, operator_id, authorized_by_operator_id")
        .eq("store_id", storeId)
        .eq("type", "sangria")
        .not("authorized_by_operator_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (e2) throw e2;

      const list: AuditItem[] = [
        ...((canc as any[]) || []).map((c: any) => ({
          id: String(c.id),
          kind: "cancelamento" as AuditKind,
          at: c.canceled_at,
          operatorName: c.operator_name || "—",
          detail: c.reason || "Sem motivo informado",
          amount: Number(c.amount) || 0,
        })),
        ...((movs as any[]) || []).map((m: any) => ({
          id: String(m.id),
          kind: "sangria" as AuditKind,
          at: m.created_at,
          operatorName: nameById.get(m.operator_id) || "—",
          authorizedByName: nameById.get(m.authorized_by_operator_id) || undefined,
          detail: m.description || "Sangria de caixa",
          amount: Number(m.amount) || 0,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      setItems(list);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  if (!authorized) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3 max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-black">Relatório de auditoria</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cancelamentos de venda e sangrias autorizadas.
              Exige PIN de gerente para visualizar.
            </p>
            <button
              onClick={() => setShowGate(true)}
              className="h-11 px-6 bg-primary text-primary-foreground rounded-xl text-sm font-black"
            >
              Autorizar com PIN
            </button>
          </div>
        </div>
        <PdvOperatorLoginDialog
          open={showGate}
          storeId={storeId}
          requiredRole="gerente"
          title="Gerente: ver auditoria"
          onClose={() => setShowGate(false)}
          onLogin={() => { setAuthorized(true); setShowGate(false); }}
        />
      </>
    );
  }

  const visible = filter === "todos" ? items : items.filter((i) => i.kind === filter);
  const nCanc = items.filter((i) => i.kind === "cancelamento").length;
  const nSang = items.filter((i) => i.kind === "sangria").length;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-black leading-tight">Auditoria</h2>
          <p className="text-[11px] text-muted-foreground">
            Ações sensíveis do caixa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { id: "todos", label: "Todos", count: items.length },
            { id: "cancelamento", label: "Cancelamentos", count: nCanc },
            { id: "sangria", label: "Sangrias", count: nSang },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-11 rounded-xl text-xs font-black border transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-bold text-muted-foreground">
            Nenhum registro encontrado
          </p>
          <p className="text-[11px] text-muted-foreground">
            Cancelamentos e sangrias autorizadas aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((it) => (
            <div
              key={`${it.kind}-${it.id}`}
              className="rounded-2xl border border-border bg-card p-3 flex gap-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                it.kind === "cancelamento" ? "bg-destructive/10" : "bg-amber-500/10"
              }`}>
                {it.kind === "cancelamento"
                  ? <XCircle className="h-5 w-5 text-destructive" />
                  : <ArrowUpFromLine className="h-5 w-5 text-amber-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-black">
                    {it.kind === "cancelamento" ? "Venda cancelada" : "Sangria autorizada"}
                  </p>
                  <p className="text-xs font-black text-foreground shrink-0">
                    {brl(it.amount)}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {it.detail}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
                  <span className="text-[10px] font-bold text-foreground">
                    {it.operatorName}
                  </span>
                  {it.authorizedByName && (
                    <span className="text-[10px] text-muted-foreground">
                      · autorizada por <b className="text-foreground">{it.authorizedByName}</b>
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    · {fmtDate(it.at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
        Mostrando até 100 registros mais recentes de cada tipo.
      </p>
    </div>
  );
}
