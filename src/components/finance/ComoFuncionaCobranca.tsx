import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function ComoFuncionaCobranca() {
  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-2.5">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            <div className="font-semibold text-foreground text-sm">Como funcionam as cobranças</div>
            <p><strong>Mensalidade</strong>: cobrada uma vez por mês na data de vencimento do seu plano.</p>
            <p><strong>R$ por entrega</strong>: acumula a cada pedido entregue pela plataforma — você paga junto no próximo PIX.</p>
            <p><strong>Comissão</strong>: percentual sobre o subtotal de cada pedido finalizado (planos com comissão).</p>
            <p><strong>Taxa PDV</strong>: R$ fixo por venda registrada no PDV (apenas no plano Essencial).</p>
            <p className="pt-1 text-amber-600 dark:text-amber-400 font-medium">⚠️ Se o saldo a pagar passar de R$ 500, a loja é pausada até a quitação.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}