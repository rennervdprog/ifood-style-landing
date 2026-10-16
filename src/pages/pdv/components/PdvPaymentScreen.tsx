import { ArrowLeft, Calculator, Loader2, Split, Wallet } from "lucide-react";
import { PDV_METHODS } from "@/pages/pdv/constants";
import { PdvSplitPayment } from "@/components/pdv/PdvSplitPayment";
import type { SplitPayment } from "@/components/pdv/PdvSplitPayment";
import { formatBRL } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";

interface PdvPaymentScreenProps {
  finalTotal: number;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  cashReceived: string;
  setCashReceived: (v: string) => void;
  troco: number;
  trocoNegativo: boolean;
  splitMode: boolean;
  setSplitMode: (v: boolean) => void;
  splitPayments: SplitPayment[];
  setSplitPayments: (v: SplitPayment[]) => void;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
  canConfirm: boolean;
}

/** Cores do quadrado arredondado por trás de cada ícone (mesmo padrão do protótipo). */
const ICON_TILE: Record<string, string> = {
  emerald: "bg-[#E7F6EC] text-[#15803D]",
  blue: "bg-[#EAF1FE] text-[#2563EB]",
  indigo: "bg-[#EEF0FD] text-[#52525B]",
  orange: "bg-[#FFF1E6] text-[#E05A00]",
};

const CASH_SHORTCUTS = [10, 20, 50];

/**
 * Tela cheia de pagamento do PDV (Tela 2 do fluxo: Venda → Pagamento → Concluída).
 * Componente puramente visual — toda a lógica de negócio vive no pai (PdvPage).
 */
export const PdvPaymentScreen = ({
  finalTotal,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  troco,
  trocoNegativo,
  splitMode,
  setSplitMode,
  splitPayments,
  setSplitPayments,
  onBack,
  onConfirm,
  loading,
  canConfirm,
}: PdvPaymentScreenProps) => {
  const isCash = paymentMethod === "dinheiro" && !splitMode;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ===== Header: voltar + título + pill "Caixa aberto" ===== */}
      <header className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a venda"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-neutral-500 active:bg-neutral-100"
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          <h1 className="text-[17px] font-extrabold text-neutral-900">Pagamento</h1>
        </div>
        <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full bg-green-50 px-3 text-[13px] font-bold text-green-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-600" />
          </span>
          Caixa aberto
        </span>
      </header>

      {/* ===== Conteúdo rolável ===== */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Total gigante */}
        <div className="py-3 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wider text-neutral-400">
            Total a receber
          </p>
          <p className="text-[52px] font-extrabold leading-tight text-neutral-900">
            {formatBRL(finalTotal)}
          </p>
        </div>

        {/* Grade 2x2 de formas de pagamento */}
        <div className="grid grid-cols-2 gap-3">
          {PDV_METHODS.map((m) => {
            const selected = paymentMethod === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                aria-pressed={selected}
                className={`flex min-h-[118px] flex-col items-center justify-center gap-3 rounded-2xl border-2 px-3 py-4 transition-colors ${
                  selected
                    ? "border-[#FF6A00] bg-[#FFF1E6]"
                    : "border-neutral-200 bg-white active:bg-neutral-50"
                }`}
              >
                <span
                  className={`flex h-[52px] w-[52px] items-center justify-center rounded-xl ${ICON_TILE[m.color] ?? "bg-neutral-100 text-neutral-500"}`}
                >
                  <Icon size={28} strokeWidth={2} />
                </span>
                <span className="text-[15px] font-extrabold text-neutral-900">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* ===== Dinheiro: quanto entregou + atalhos + troco ===== */}
        {isCash && (
          <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-neutral-500" />
              <p className="text-[15px] font-bold text-neutral-800">Quanto o cliente entregou?</p>
            </div>

            {/* Chips de atalho */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {CASH_SHORTCUTS.map((v) => {
                const active = parseBRL(cashReceived) === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCashReceived(String(v))}
                    className={`min-h-[48px] rounded-xl border-2 text-[15px] font-extrabold ${
                      active
                        ? "border-[#FF6A00] bg-[#FFF1E6] text-[#E05A00]"
                        : "border-neutral-200 bg-white text-neutral-700 active:bg-neutral-100"
                    }`}
                  >
                    R$ {v}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCashReceived(String(finalTotal))}
                className="min-h-[48px] rounded-xl border-2 border-neutral-200 bg-white text-[15px] font-extrabold text-neutral-700 active:bg-neutral-100"
              >
                Exato
              </button>
            </div>

            {/* Campo de valor recebido */}
            <input
              type="text"
              inputMode="decimal"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder="0,00"
              aria-label="Valor recebido em dinheiro"
              className="mt-3 min-h-[52px] w-full rounded-xl border-2 border-neutral-200 bg-white px-4 text-center text-[22px] font-extrabold text-neutral-900 placeholder:text-neutral-300 focus:border-[#FF6A00] focus:outline-none"
            />

            {/* Troco / Falta */}
            {trocoNegativo ? (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
                <div>
                  <p className="text-[13px] font-extrabold uppercase tracking-wide text-red-700">
                    Falta
                  </p>
                  <p className="text-[11.5px] font-medium text-red-600">
                    o cliente deve completar
                  </p>
                </div>
                <p className="text-[24px] font-extrabold text-red-700">
                  {formatBRL(Math.abs(troco))}
                </p>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#E7F6EC] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-green-700" />
                  <div>
                    <p className="text-[13px] font-extrabold uppercase tracking-wide text-green-800">
                      Troco
                    </p>
                    <p className="text-[11.5px] font-medium text-green-700">
                      devolver ao cliente
                    </p>
                  </div>
                </div>
                <p className="text-[24px] font-extrabold text-green-800">
                  {formatBRL(troco)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== Toggle dividir pagamento + painel ===== */}
        <button
          type="button"
          onClick={() => setSplitMode(!splitMode)}
          role="switch"
          aria-checked={splitMode}
          className="mt-4 flex min-h-[48px] w-full items-center justify-between rounded-xl bg-neutral-50 px-4"
        >
          <span className="flex items-center gap-2 text-[14px] font-bold text-neutral-700">
            <Split size={18} className="text-neutral-500" />
            Dividir pagamento
          </span>
          <span
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              splitMode ? "bg-[#FF6A00]" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                splitMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </span>
        </button>

        {splitMode && (
          <div className="mt-3">
            <PdvSplitPayment
              total={finalTotal}
              payments={splitPayments}
              onChange={setSplitPayments}
            />
          </div>
        )}
      </div>

      {/* ===== CTA fixo no rodapé ===== */}
      <footer className="border-t border-neutral-100 bg-white p-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || loading}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-extrabold text-white transition-opacity disabled:opacity-40"
        >
          {loading && <Loader2 size={20} className="animate-spin" />}
          Confirmar recebimento
        </button>
      </footer>
    </div>
  );
};
