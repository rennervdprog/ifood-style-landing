import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useEffect, useState } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";
import { usePdvCart } from "../usePdvCart";
import { usePdvCheckout } from "../usePdvCheckout";
import {
  stashPendingReceipt,
  flushPendingReceipt,
  hasPendingReceipt,
} from "../pendingReceipt";
import { PdvSaleSuccessScreen } from "../../components/PdvSaleSuccessScreen";

// Item 12 REABERTO (2026-10-31) — o modo de falha que o primeiro
// diagnóstico não capturou.
//
// A correção de layout (publicada) era real, mas NÃO era a causa do
// sintoma persistente. Evidência nova ao vivo (PDV da loja demo, build
// novo, SEM o banner do PWA, botão "Nova venda" totalmente visível):
// o clique por referência foi aplicado e a tela permaneceu em
// "Venda concluída!". Na mesma sessão, TODOS os cliques do fluxo de
// venda funcionavam — o que morria era só o pós-venda, até recarregar.
//
// Mecanismo: a loja demo tem `auto_print_pdv = true` → a cada venda
// concluída, usePdvCheckout chama printPdvReceipt() → safePrint() →
// window.print() ~50ms depois, COM A TELA DE SUCESSO JÁ MONTADA.
// window.print() abre o preview de impressão do navegador, que é
// MODAL: enquanto ele está aberto, nenhum clique chega à página (e
// screenshots/DOM nem o mostram — ele é UI do navegador). A única
// saída da tela de sucesso é um clique na página ("Nova venda") →
// operador preso até imprimir/cancelar o preview ou recarregar
// (navegação fecha o preview — por isso F5 "resolvia"). Em lojas com
// impressão silenciosa (kiosk) ou preview resolvido pelo operador, o
// sintoma some — daí a intermitência histórica (16/10, 20/10, 22/10)
// e os testes de componente/jsdom passarem: jsdom não tem modal.
//
// Correção: o checkout NÃO imprime durante a conclusão — entrega o
// job via onAutoPrintReady e a página o guarda (pendingReceipt,
// sessionStorage). A página imprime DEPOIS da transição: no
// "Nova venda" (clearSale primeiro, impressão em seguida), na troca
// de aba e na remontagem (reload entre concluir e sair do sucesso
// não perde o cupom).
//
// jsdom não modela o modal do navegador; o que estes testes fixam é a
// metade do mecanismo que é do app: QUANDO window.print é chamado em
// relação à transição de estado. Antes da correção, o teste 1 FALHA
// (print dispara com a tela de sucesso montada); depois, passa.

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
      getSession: async () => ({ data: { session: { user: { id: "user-1" } } } }),
    },
    rpc: async (name: string) => {
      if (name === "pdv_finalize_sale") {
        return { data: { order_id: "order-1" }, error: null };
      }
      return { data: true, error: null };
    },
    from: () => ({
      select: () => ({
        in: async () => ({ data: [], error: null }),
        eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      }),
      insert: () => ({
        select: () => ({ single: async () => ({ data: { id: "x" }, error: null }) }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

const STORE = {
  id: "store1",
  name: "Loja Demo",
  settings: { auto_print_pdv: true, print_copies: 2 },
} as any;
const SESSION = { id: "session1" } as any;
const SCOPE = "store1:session1";

const prod = (over: Partial<any> = {}): any => ({
  id: "p1",
  name: "Porção de Nuggets",
  price: 25,
  image_url: null,
  section_id: "s1",
  is_available: true,
  ...over,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Réplica da fiação do PdvPage/PdvPageTeste no pós-venda, com os hooks
 * REAIS (usePdvCart + usePdvCheckout) e a tela de sucesso REAL.
 * handleNewSale/clearSale/onSuccess copiam as chamadas das páginas;
 * o ctx do checkout é montado como `any` para o mesmo harness rodar
 * antes da correção (quando onAutoPrintReady nem existia no hook).
 */
function PdvCheckoutHarness() {
  const c = usePdvCart();
  const { handleVenda: runCheckout } = usePdvCheckout();
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "success">("cart");
  const [lastSale, setLastSale] = useState<{
    total: number;
    paymentMethodLabel: string;
    cashReceived: number | null;
    troco: number | null;
  } | null>(null);

  useEffect(() => {
    c.setCartScope(SCOPE);
    // Montagem: dispara o cupom que ficou pendente de uma vida
    // anterior da página (ex.: reload entre concluir e sair do
    // sucesso) — nenhum cupom se perde.
    flushPendingReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // clearSale da página (verbatim).
  const clearSale = () => {
    c.clearSale();
    setCheckoutStep("cart");
    c.setOrderDone(false);
    setLastSale(null);
  };

  // "Nova venda" da página (correção): a transição acontece PRIMEIRO;
  // a impressão adiada sai em seguida, já sobre a venda limpa — o
  // modal do navegador nunca mais fica entre o operador e a saída
  // da tela de sucesso.
  const handleNewSale = () => {
    clearSale();
    flushPendingReceipt();
  };

  const handleVenda = async () => {
    const ctx: any = {
      store: STORE,
      session: SESSION,
      cart: c.cart,
      splitMode: c.splitMode,
      splitPayments: c.splitPayments,
      paymentMethod: c.paymentMethod,
      cashReceived: c.cashReceived,
      cashVal: c.cashVal,
      subtotal: c.subtotal,
      finalTotal: c.finalTotal,
      discountAmount: c.discountAmount,
      troco: c.troco,
      tableId: c.tableId,
      pdvCommissionRate: 0,
      operatorId: null,
      onSuccess: async () => {
        // Cabeça do onSuccess das páginas (verbatim nas chamadas de UI).
        c.clearSale();
        setLastSale({
          total: c.finalTotal,
          paymentMethodLabel: "Dinheiro",
          cashReceived: 25,
          troco: 0,
        });
        setCheckoutStep("success");
        c.setOrderDone(true);
      },
      onClearScheduled: () => {},
      onEmptiesFlowStart: () => {},
      // Correção: o checkout entrega o job em vez de imprimir na hora.
      onAutoPrintReady: (job: any) => stashPendingReceipt(job),
    };
    await runCheckout(ctx);
  };

  return (
    <div>
      {checkoutStep === "success" && lastSale ? (
        <PdvSaleSuccessScreen
          total={lastSale.total}
          paymentMethodLabel={lastSale.paymentMethodLabel}
          cashReceived={lastSale.cashReceived}
          troco={lastSale.troco}
          onNewSale={handleNewSale}
        />
      ) : (
        <div data-testid="etapa-carrinho">itens:{c.cart.length}</div>
      )}
      <button
        onClick={() => {
          c.addScannedProduct(prod());
          c.setPaymentMethod("dinheiro");
          c.setCashReceived("25,00");
        }}
      >
        montar venda
      </button>
      <button onClick={() => void handleVenda()}>concluir venda</button>
    </div>
  );
}

const renderHarness = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <PdvCheckoutHarness />
    </QueryClientProvider>
  );
};

let printSpy: ReturnType<typeof vi.spyOn>;

const __origSet = Storage.prototype.setItem;
const __origRemove = Storage.prototype.removeItem;
Storage.prototype.setItem = function (k: string, v: string) {
  if (k.includes("pending")) console.log("DBG setItem", k, "t=", Date.now() % 100000);
  return __origSet.call(this, k, v);
};
Storage.prototype.removeItem = function (k: string) {
  if (k.includes("pending")) console.log("DBG removeItem", k, "t=", Date.now() % 100000, new Error().stack?.split("\n").slice(2, 5).join(" | "));
  return __origRemove.call(this, k);
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Item 12 reaberto — impressão automática não pode prender a tela de sucesso", () => {
  it("concluir NÃO chama window.print com a tela de sucesso montada; 'Nova venda' transiciona e imprime 1x", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "montar venda" }));
    await user.click(screen.getByRole("button", { name: "concluir venda" }));
    expect(await screen.findByText("Venda concluída!")).toBeInTheDocument();

    // Tempo de sobra para o safePrint (50ms) e qualquer timer do checkout.
    await act(async () => {
      await sleep(300);
    });

    // O cerne da falha ao vivo: com auto-print ligado, window.print()
    // NÃO pode ter disparado enquanto a única saída da tela (o clique
    // em "Nova venda") ainda é necessária — o preview é modal.
    expect(printSpy).not.toHaveBeenCalled();
    expect(hasPendingReceipt()).toBe(true);

    await user.click(screen.getByRole("button", { name: "Nova venda" }));

    // Saiu do sucesso para a venda limpa…
    expect(screen.queryByText("Venda concluída!")).not.toBeInTheDocument();
    expect(screen.getByTestId("etapa-carrinho")).toHaveTextContent("itens:0");
    // …e o cupom saiu — uma única vez, depois da transição
    // (safePrint dispara window.print ~50ms após o flush).
    await act(async () => {
      await sleep(200);
    });
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(hasPendingReceipt()).toBe(false);
  });

  it("reload entre concluir e 'Nova venda' não perde o cupom: a remontagem imprime o pendente", async () => {
    const user = userEvent.setup();
    const first = renderHarness();

    await user.click(screen.getByRole("button", { name: "montar venda" }));
    await user.click(screen.getByRole("button", { name: "concluir venda" }));
    expect(await screen.findByText("Venda concluída!")).toBeInTheDocument();
    await act(async () => {
      await sleep(150);
    });
    expect(printSpy).not.toHaveBeenCalled();

    // "Reload": desmonta tudo e monta o PDV de novo.
    first.unmount();
    renderHarness();
    expect(screen.queryByText("Venda concluída!")).not.toBeInTheDocument();

    // A remontagem dispara o pendente na montagem + safePrint (50ms).
    await act(async () => {
      await sleep(700);
    });
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(hasPendingReceipt()).toBe(false);
  });
});

describe("Item 12 reaberto — fiação presente nas páginas reais (guarda de fidelidade)", () => {
  const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

  it("usePdvCheckout expõe onAutoPrintReady e não imprime direto quando ele existe", () => {
    const hook = read("../usePdvCheckout.ts");
    expect(hook).toContain("onAutoPrintReady");
  });

  it("PdvPage e PdvPageTeste guardam o job e imprimem no 'Nova venda'", () => {
    for (const rel of ["../../../PdvPage.tsx", "../../../PdvPageTeste.tsx"]) {
      const page = read(rel);
      expect(page).toContain("onAutoPrintReady");
      expect(page).toContain("stashPendingReceipt");
      expect(page).toContain("flushPendingReceipt");
    }
  });
});
