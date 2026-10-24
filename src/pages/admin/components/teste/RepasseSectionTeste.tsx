/**
 * TELA 4 — CÓPIA DE TESTE (/admin-teste) de src/pages/admin/sections/RepasseSection.tsx.
 *
 * O repasse vive SÓ aqui dentro do Financeiro (a Tela 1 já o tirou do
 * grupo Início; o shell de teste aponta a aba "repasse" para o
 * FinanceiroTeste, não para uma tela própria). Fluxo de pagamento
 * INTACTO: RepassePendingCharges e RepasseAlert são os componentes
 * originais, sem alteração — só a apresentação desta seção mudou.
 *
 * CORREÇÕES DE TEXTO LEGADO (o resto é cópia fiel):
 * 1. O parágrafo "Como funciona" do original somava uma taxa PIX por
 *    pedido ao valor por entrega. Virou: R$ 0,99 por entrega; Pix
 *    direto na conta da loja, sem taxa do ItaSuper.
 * 2. O selo do plano (taxa PIX) virou "Pix direto, sem taxa" para
 *    plano fixo. A taxa de entrega segue o split do plano (0,99).
 * Wrappers canônicos da Tela 1 no lugar dos cards hand-rolled.
 */
import { Banknote, CheckCircle2, CalendarClock, Info } from "lucide-react";
import RepasseAlert from "@/components/repasse/RepasseAlert";
import RepassePendingCharges from "@/components/RepassePendingCharges";
import { formatBRL } from "@/lib/utils";
import { usePendingRepasse } from "@/hooks/usePendingRepasse";
import { REPASSE_RULES } from "@/lib/repasseRules";
import TutorialHelpButton from "@/components/TutorialHelp";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminCardTeste,
  AdminMoneyTeste,
  AdminTextTeste,
} from "./AdminBaseTeste";

interface Props {
  storeId: string;
  storeName: string;
}

export default function RepasseSectionTeste({ storeId, storeName }: Props) {
  const { total: hookTotal, hasPendingCharge } = usePendingRepasse(storeId);
  const displayTotal = hookTotal || 0;
  const showAlert = displayTotal > 0 && !hasPendingCharge;

  // Plano ativo, para o selo de contexto (mesma query do card do plano).
  const { data: plan } = useQuery({
    queryKey: ["repasse-plano-teste", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_plans")
        .select("plan_type, platform_delivery_split_override")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      return data as any;
    },
  });
  const planLabel =
    plan?.plan_type === "fixed" ? "Essencial" :
    plan?.plan_type === "supporter" ? "Apoiador" :
    plan?.plan_type === "autonomy" ? "Autonomia" :
    plan?.plan_type === "hybrid" ? "Crescimento" : "Comissão";
  const deliveryTxt =
    Number(plan?.platform_delivery_split_override ?? 0.99) > 0
      ? `Entrega ${formatBRL(Number(plan?.platform_delivery_split_override ?? 0.99))}`
      : "Sem taxa de entrega";
  // Modelo atual: Pix direto, sem taxa do ItaSuper.
  const pixTxt = "Pix direto, sem taxa";

  const nextMonday = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const daysUntil = Math.max(
    0,
    Math.ceil((nextMonday.getTime() - Date.now()) / 86400000),
  );
  const nextMondayLabel = nextMonday.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div id="financeiro-repasse" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10">
          <Banknote className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">Repasse</h2>
          <p className="text-xs text-muted-foreground">
            {displayTotal > 0
              ? "Você tem valor acumulado a repassar à plataforma"
              : "Nenhum repasse pendente no momento"}
          </p>
        </div>
        <div className="ml-auto">
          <TutorialHelpButton tutorialId="finance" />
        </div>
      </div>

      <AdminTextTeste role="body">
        O que sua loja deve repassar ao ItaSuper e quando a cobrança acontece
      </AdminTextTeste>

      <AdminCardTeste>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Como funciona</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Durante a semana, tudo que você vende fica com você. Toda
              segunda-feira, o ItaSuper cobra via PIX o que acumulou: R$ 0,99
              por entrega. O Pix vai direto para a conta da sua loja, sem
              taxa do ItaSuper — só quando o acumulado passa de R$ 150. Se a
              dívida chegar a R$ 500, as vendas pausam até quitar. Hoje sua
              loja tem <strong className="text-foreground">{formatBRL(displayTotal)}</strong> a
              repassar.
            </p>
          </div>
        </div>
      </AdminCardTeste>

      {/* 1. Cobrança PIX ativa — sempre no topo, ação mais urgente (original, intacto) */}
      <RepassePendingCharges storeId={storeId} />

      {/* 2. Alerta unificado quando há saldo sem cobrança emitida (original, intacto) */}
      {showAlert && (
        <RepasseAlert
          storeId={storeId}
          storeName={storeName}
          onGoToFinance={() => {
            document.getElementById("financeiro-repasse")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {/* 3. Contexto do plano ativo */}
      <AdminCardTeste className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Plano</span>
        <span className="text-sm font-bold text-foreground">{planLabel}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-foreground">{deliveryTxt}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-foreground">{pixTxt}</span>
      </AdminCardTeste>

      {/* 4. Informativo — próximo repasse previsto */}
      <AdminCardTeste>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
            <CalendarClock className="h-5 w-5 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Próximo repasse previsto
            </p>
            <p className="truncate text-sm font-bold capitalize text-foreground">
              {nextMondayLabel}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {daysUntil === 0
                ? "Hoje é dia de repasse"
                : `Em ${daysUntil} dia${daysUntil > 1 ? "s" : ""} · Repasses são processados toda segunda-feira`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Acumulado
            </p>
            <AdminMoneyTeste value={formatBRL(displayTotal)} className="text-base" />
          </div>
        </div>
      </AdminCardTeste>

      {displayTotal <= 0 && !hasPendingCharge && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="font-bold text-foreground">Sem pendências de repasse</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Quando houver saldo acumulado (delivery, comissão do plano ou PDV), ele aparecerá aqui.
            Cobrança automática toda segunda a partir de {formatBRL(REPASSE_RULES.MIN_AUTO_CHARGE_BRL)}.
          </p>
        </div>
      )}
    </div>
  );
}
