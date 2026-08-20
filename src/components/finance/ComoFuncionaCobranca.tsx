import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";
import { FINANCE_COPY, blockingRuleText, weeklyChargeRuleText } from "@/lib/financeCommunication";

export default function ComoFuncionaCobranca() {
  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <div className="font-semibold text-foreground text-sm">Como funcionam os valores da sua loja</div>
            <p><strong>Mensalidade do plano:</strong> é cobrada uma vez por mês, conforme seu plano, período de gratuidade e próximo vencimento exibidos acima.</p>
            <p><strong>{FINANCE_COPY.outstandingTitle}:</strong> podem incluir taxa de plataforma nas entregas, comissão do plano e taxa de PDV, conforme a forma de pagamento e os recursos utilizados.</p>
            <p><strong>Cobrança semanal:</strong> {weeklyChargeRuleText()}</p>
            <p><strong>Importante:</strong> pedidos pagos por PIX online seguem o fluxo de pagamento online; os custos de vendas pagas em dinheiro, cartão na entrega ou PIX maquininha podem aparecer neste ciclo.</p>
            <p className="pt-1 text-amber-700 dark:text-amber-400 font-medium">⚠️ {blockingRuleText()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
