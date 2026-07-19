import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Search, User, Wallet, X, Check } from "lucide-react";

export interface ApparelCustomer {
  phone: string;
  name: string;
}
export interface ApparelCredit {
  id: string;
  amount: number;
}

interface Props {
  storeId?: string | null;
  customer: ApparelCustomer;
  onCustomerChange: (c: ApparelCustomer) => void;
  credit: ApparelCredit | null;
  onCreditChange: (c: ApparelCredit | null) => void;
  finalTotal: number;
}

interface CreditRow {
  id: string;
  balance: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
}
interface CrmRow {
  name: string | null;
  preferred_size: string | null;
  total_spent: number | null;
  purchases_count: number | null;
}

/**
 * Painel Boutique — Fase 4.2:
 * - Captura telefone/nome do cliente (CRM)
 * - Busca vale-crédito ativo e permite aplicar como desconto
 * O componente é auto-suficiente: o cast p/ o preço final acontece no PdvPage
 * (setDiscountInput/Type) via useEffect controlado por `credit`.
 */
export default function ApparelCustomerPanel({
  storeId, customer, onCustomerChange, credit, onCreditChange, finalTotal,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [crm, setCrm] = useState<CrmRow | null>(null);

  useEffect(() => {
    // Ao trocar telefone limpa lista antiga
    setCredits([]); setCrm(null);
  }, [customer.phone]);

  const buscar = async () => {
    if (!storeId) return;
    const phone = customer.phone.trim();
    if (!phone) { toast.error("Informe o telefone."); return; }
    setLoading(true);
    try {
      const [{ data: cr, error: e1 }, { data: crmRow }] = await Promise.all([
        (supabase as any).rpc("apparel_list_credits", { _store_id: storeId, _phone: phone }),
        (supabase as any).from("customers_crm")
          .select("name, preferred_size, total_spent, purchases_count")
          .eq("store_id", storeId).eq("phone", phone).maybeSingle(),
      ]);
      if (e1) throw e1;
      const rows = ((cr || []) as CreditRow[]).filter((r) => Number(r.balance) > 0);
      setCredits(rows);
      if (crmRow) {
        setCrm(crmRow as CrmRow);
        if (!customer.name && (crmRow as any).name) {
          onCustomerChange({ ...customer, name: (crmRow as any).name });
        }
      }
      if (rows.length === 0 && !crmRow) toast.info("Nenhum cliente/vale encontrado.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao buscar cliente.");
    } finally { setLoading(false); }
  };

  const toggleCredit = (row: CreditRow) => {
    if (credit?.id === row.id) { onCreditChange(null); return; }
    // Nunca aplicar mais do que o total do carrinho
    const applyAmount = Math.min(Number(row.balance), Math.max(0, finalTotal + Number(row.balance)));
    onCreditChange({ id: row.id, amount: applyAmount });
  };

  return (
    <div className="px-3 py-2 border-b border-border/40 bg-muted/20 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <User className="h-3 w-3" /> Cliente da venda
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="tel" inputMode="tel" placeholder="Telefone"
          value={customer.phone}
          onChange={(e) => onCustomerChange({ ...customer, phone: e.target.value.replace(/[^\d]/g, "").slice(0, 15) })}
          className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
          data-pdv-no-hotkey
        />
        <button
          onClick={buscar}
          disabled={loading || !customer.phone.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
        </button>
      </div>
      <input
        type="text" placeholder="Nome (opcional)"
        value={customer.name}
        onChange={(e) => onCustomerChange({ ...customer, name: e.target.value.slice(0, 80) })}
        className="w-full px-2 py-1.5 rounded-lg text-xs bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary/30"
        data-pdv-no-hotkey
      />

      {crm && (
        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1.5">
          {crm.preferred_size && <span className="px-1.5 py-0.5 rounded bg-card border border-border">Tam. {crm.preferred_size}</span>}
          {typeof crm.total_spent === "number" && <span className="px-1.5 py-0.5 rounded bg-card border border-border">Gastou {formatBRL(Number(crm.total_spent))}</span>}
          {typeof crm.purchases_count === "number" && <span className="px-1.5 py-0.5 rounded bg-card border border-border">{crm.purchases_count} compras</span>}
        </div>
      )}

      {credits.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Vales disponíveis
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {credits.map((r) => {
              const sel = credit?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => toggleCredit(r)}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-left transition ${sel ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/30"}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${sel ? "bg-primary border-primary" : "border-border"}`}>
                      {sel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    <span className="text-[11px] font-bold truncate">Vale-crédito</span>
                  </div>
                  <span className="text-[11px] font-black text-emerald-500 tabular-nums">{formatBRL(Number(r.balance))}</span>
                </button>
              );
            })}
          </div>
          {credit && (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2 py-1.5">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Vale aplicado</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-emerald-600 tabular-nums">−{formatBRL(credit.amount)}</span>
                <button onClick={() => onCreditChange(null)} className="p-0.5 rounded hover:bg-emerald-500/10">
                  <X className="h-3 w-3 text-emerald-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}