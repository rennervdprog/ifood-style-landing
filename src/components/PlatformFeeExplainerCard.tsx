import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Info, Truck, Calendar, QrCode, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { REPASSE_RULES } from "@/lib/repasseRules";

interface Props {
  storeId: string;
  splitPerOrder: number;
}

/**
 * Card permanente no Dashboard explicando a taxa de R$ X/entrega.
 * - A taxa é PAGA PELO CLIENTE (somada à taxa de entrega).
 * - A parcela da plataforma é acompanhada em vendas pagas fora do PIX online.
 * - Cobrança semanal quando o ciclo atingir o mínimo vigente.
 * Estado colapsado é persistido por loja em localStorage.
 */
export default function PlatformFeeExplainerCard({ storeId, splitPerOrder }: Props) {
  const storageKey = `pfx_explainer_collapsed_${storeId}`;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, [storageKey]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const valor = splitPerOrder > 0 ? splitPerOrder : 0.99;
  const valorFmt = `R$ ${valor.toFixed(2).replace(".", ",")}`;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Info className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground leading-tight">
            Como funciona a taxa de {valorFmt}/entrega
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Paga pelo cliente. Acompanhe a taxa no Financeiro em pagamentos físicos.
          </p>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          <p className="text-xs text-foreground leading-relaxed">
            <strong>A taxa de {valorFmt} por entrega é paga pelo cliente</strong> — ela já vem somada à taxa de entrega no checkout.
          </p>
          <p className="text-xs text-foreground leading-relaxed">
            Em pedidos pagos em <strong>dinheiro, cartão na entrega ou PIX maquininha</strong>, a parcela da plataforma é registrada em <strong>taxas e comissões em aberto</strong>, pois o valor é recebido diretamente pela loja.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pedidos pagos por <strong>PIX online no app</strong> seguem o fluxo automático de pagamento; a taxa operacional aplicável é tratada nesse próprio fluxo.
          </p>

          {/* Timeline */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { icon: Truck, label: "Pedido físico" },
              { icon: Info, label: `Acumula ${valorFmt}` },
              { icon: Calendar, label: `Segunda, se ≥ R$ ${REPASSE_RULES.MIN_AUTO_CHARGE_BRL}` },
              { icon: QrCode, label: "PIX no painel" },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <step.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[9px] text-muted-foreground leading-tight">{step.label}</span>
              </div>
            ))}
          </div>

          {/* Consequências */}
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[10.5px] text-foreground leading-snug">
              <strong>R$ 500 ou mais</strong> pode bloquear novos pedidos · uma cobrança pendente por <strong>{REPASSE_RULES.SUSPENSION_DAYS} dias</strong> também pode bloquear a loja até a regularização.
            </p>
          </div>

          <Link
            to="/termos-de-uso"
            className="block text-[11px] text-primary hover:underline text-center pt-1"
          >
            Ver termos completos
          </Link>
        </div>
      )}
    </div>
  );
}