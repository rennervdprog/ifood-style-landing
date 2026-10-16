import { Check } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface PdvSaleSuccessScreenProps {
  total: number;
  paymentMethodLabel: string;
  cashReceived: number | null; // valor entregue (só quando dinheiro)
  troco: number | null; // troco devolvido (só quando dinheiro)
  onNewSale: () => void;
}

export const PdvSaleSuccessScreen = ({
  total,
  paymentMethodLabel,
  cashReceived,
  troco,
  onNewSale,
}: PdvSaleSuccessScreenProps) => {
  const valorRecebido = cashReceived ?? total;
  const isDinheiro = troco !== null;

  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Conteúdo central */}
      <div className="flex flex-1 flex-col items-center justify-center px-7 py-8 text-center">
        <div
          className="mb-5 flex items-center justify-center rounded-full"
          style={{
            width: 110,
            height: 110,
            backgroundColor: "#16A34A",
            boxShadow: "0 12px 30px rgba(22, 163, 74, 0.35)",
          }}
        >
          <Check size={52} strokeWidth={3} className="text-white" />
        </div>

        <h2 className="mb-1.5 text-2xl font-extrabold text-neutral-900">
          Venda concluída!
        </h2>
        <p className="text-sm leading-relaxed text-neutral-500">
          Pode chamar o próximo cliente.
        </p>

        {/* Recibo */}
        <div
          className="mt-5 w-full border border-dashed border-neutral-300 bg-neutral-50 p-4 text-left"
          style={{ borderRadius: 14 }}
        >
          <div className="flex justify-between py-1 text-sm text-neutral-500">
            <span>Valor recebido</span>
            <b className="font-bold text-neutral-900">
              {formatBRL(valorRecebido)}
            </b>
          </div>
          <div className="flex justify-between py-1 text-sm text-neutral-500">
            <span>Forma</span>
            <b className="font-bold text-neutral-900">{paymentMethodLabel}</b>
          </div>
          {isDinheiro && (
            <div className="flex justify-between py-1 text-sm text-neutral-500">
              <span>Troco devolvido</span>
              <b className="font-bold text-neutral-900">{formatBRL(troco)}</b>
            </div>
          )}
          <div className="mt-1.5 flex justify-between border-t border-neutral-200 pt-2.5 text-[15px] text-neutral-500">
            <span>Total da venda</span>
            <b className="font-extrabold text-neutral-900">
              {formatBRL(total)}
            </b>
          </div>
        </div>
      </div>

      {/* CTA fixo no rodapé */}
      <div className="px-4 pb-5">
        <button
          type="button"
          onClick={onNewSale}
          className="w-full font-extrabold text-white cursor-pointer select-none"
          style={{
            height: 56,
            borderRadius: 16,
            backgroundColor: "#16A34A",
            fontSize: 17,
            boxShadow: "0 8px 20px rgba(22, 163, 74, 0.3)",
          }}
        >
          Nova venda
        </button>
      </div>
    </div>
  );
};
