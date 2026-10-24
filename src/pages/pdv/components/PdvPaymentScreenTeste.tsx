import { ArrowLeft, Calculator, Loader2, Split, Wallet } from "lucide-react";
import { PDV_METHODS } from "@/pages/pdv/constants";
import { PdvSplitPayment } from "@/components/pdv/PdvSplitPayment";
import type { SplitPayment } from "@/components/pdv/PdvSplitPayment";
import { formatBRL } from "@/lib/utils";

/**
 * TELA 6 — Tela de pagamento do PDV no /admin-teste (cópia de PdvPaymentScreen).
 * Mesma lógica, mesmos rótulos, mesmos cálculos (troco/falta, atalhos de
 * dinheiro, divisão). Só muda a forma:
 * 1) TOKENS do produto: sai a paleta neutra + hex solto fora dos tokens
 *    (os hex da tela original listados no audit, seção 5.5 item 19) e entram foreground, muted,
 *    border-border, primary e success. Os tiles de método usam a paleta
 *    Tailwind (sem hex literal) + primary para o laranja ItaSuper.
 * 2) Tamanhos nos papéis da Tela 1: sem fracionário (nada de 17px, 15px,
 *    13px, 12px, 11,5px, 22px, 24px, 52px) — text-xs/sm/base/xl/2xl/5xl.
 * 3) Regras da divisão EXPLÍCITAS na tela: por valor, por pessoa e o
 *    restante ("Falta receber"); e o que NÃO existe: divisão por item
 *    (os itens continuam numa única venda — divide-se o valor a pagar).
 *    Nenhuma regra de negócio foi alterada, só explicitada.
 */
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
  emerald: "bg-success/10 text-success",
  blue: "bg-blue-500/10 text-blue-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
  orange: "bg-primary/10 text-primary",
};

const CASH_SHORTCUTS = [10, 20, 50];

/**
 * Tela cheia de pagamento do PDV (Tela 2 do fluxo: Venda → Pagamento → Concluída).
 * Componente puramente visual — toda a lógica de negócio vive no pai (PdvPage).
 */
export const PdvPaymentScreenTeste = ({
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
    <div className="flex h-full flex-col bg-card">
      {/* ===== Header: voltar + título + pill "Caixa aberto" ===== */}
      <header className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a venda"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-muted-foreground active:bg-muted"
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          <h1 className="text-base font-extrabold text-foreground">Pagamento</h1>
        </div>
        <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full bg-success/10 px-3 text-xs font-bold text-success">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          Caixa aberto
        </span>
      </header>

      {/* ===== Conteúdo rolável ===== */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Total gigante */}
        <div className="py-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Total a receber
          </p>
          <p className="text-5xl font-extrabold leading-tight text-foreground">
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
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card active:bg-muted"
                }`}
              >
                <span
                  className={`flex h-[52px] w-[52px] items-center justify-center rounded-xl ${ICON_TILE[m.color] ?? "bg-muted text-muted-foreground"}`}
                >
                  <Icon size={28} strokeWidth={2} />
                </span>
                <span className="text-sm font-extrabold text-foreground">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* ===== Dinheiro: quanto entregou + atalhos + troco ===== */}
        {isCash && (
          <div className="mt-4 rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">Quanto o cliente entregou?</p>
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
                    className={`min-h-[48px] rounded-xl border-2 text-sm font-extrabold ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground active:bg-muted"
                    }`}
                  >
                    R$ {v}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCashReceived(String(finalTotal))}
                className="min-h-[48px] rounded-xl border-2 border-border bg-card text-sm font-extrabold text-foreground active:bg-muted"
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
              className="mt-3 min-h-[52px] w-full rounded-xl border-2 border-border bg-card px-4 text-center text-xl font-extrabold text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />

            {/* Troco / Falta */}
            {trocoNegativo ? (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-destructive/10 px-4 py-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-destructive">
                    Falta
                  </p>
                  <p className="text-xs font-medium text-destructive">
                    o cliente deve completar
                  </p>
                </div>
                <p className="text-2xl font-extrabold text-destructive">
                  {formatBRL(Math.abs(troco))}
                </p>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-success/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-success" />
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-success">
                      Troco
                    </p>
                    <p className="text-xs font-medium text-success">
                      devolver ao cliente
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-success">
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
          className="mt-4 flex min-h-[48px] w-full items-center justify-between rounded-xl bg-muted/50 px-4"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Split size={18} className="text-muted-foreground" />
            Dividir pagamento
          </span>
          <span
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              splitMode ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                splitMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </span>
        </button>

        {!splitMode && (
          <p className="mt-2 text-xs text-muted-foreground">
            Dividir: por valor ou por pessoa. A soma das partes precisa fechar o total para confirmar.
          </p>
        )}

        {splitMode && (
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
              <p className="text-sm font-bold text-foreground">Como funciona a divisão</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>
                  <span className="font-bold text-foreground">Por valor:</span> cada parte é uma
                  forma de pagamento + um valor. Some as partes até fechar o total.
                </li>
                <li>
                  <span className="font-bold text-foreground">Por pessoa:</span> o total é repartido
                  em partes iguais; a última parte absorve os centavos que sobram. Depois, cada
                  pessoa pode trocar a forma de pagamento da sua parte.
                </li>
                <li>
                  <span className="font-bold text-foreground">O que falta:</span> aparece como
                  &ldquo;Falta receber&rdquo;. A venda só confirma quando a soma das partes fechar
                  o total — sem completar, o botão fica bloqueado.
                </li>
                <li>
                  <span className="font-bold text-foreground">Por item não existe:</span> os itens
                  continuam numa única venda — o que se divide é o valor a pagar, não a lista de itens.
                </li>
              </ul>
            </div>
            <PdvSplitPayment
              total={finalTotal}
              payments={splitPayments}
              onChange={setSplitPayments}
            />
          </div>
        )}
      </div>

      {/* ===== CTA fixo no rodapé ===== */}
      <footer className="border-t border-border bg-card p-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-extrabold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {loading && <Loader2 size={20} className="animate-spin" />}
          Confirmar recebimento
        </button>
      </footer>
    </div>
  );
};

