import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEffect, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdvSaleSuccessScreen } from "../PdvSaleSuccessScreen";
import { usePdvCart } from "../../state/usePdvCart";

// Item 12 (varredura 2026-10-30): após "Venda concluída!", o botão
// "Nova venda" "não faz nada" e a tela fica presa no sucesso.
//
// Diagnóstico que estes testes documentam:
// 1) A CADEIA DO HANDLER sempre esteve íntegra — o clique chama onNewSale
//    e o reset da página (clearSale) devolve a venda limpa. Provado abaixo
//    com o hook real (usePdvCart) + a tela real, replicando a fiação do
//    PdvPage/PdvPageTeste (idêntica nos dois painéis).
// 2) O MODO DE FALHA é de layout, no layout DESKTOP: a tela de sucesso é
//    filha da coluna do caixa (overflow-hidden), abaixo do PdvSessionCard
//    e do botão "Ver produtos" (ambos shrink-0). A raiz da tela encolhe
//    (min-h-0, correção de 22/10), mas o miolo (flex-1 SEM min-h-0 e SEM
//    overflow) e o rodapé (SEM shrink-0) têm altura mínima intrínseca de
//    ~485px: em janelas com menos de ~680px de altura útil, o rodapé com
//    o botão é empurrado para além da borda da coluna e CORTADO — o botão
//    fica inalcançável (mesma queixa do commit c96d8a41, "botão Nova
//    venda fora da tela", corrigida então só na raiz).
//    jsdom não faz layout: o que se prova aqui é a PROPRIEDADE ESTRUTURAL
//    que garante o rodapé alcançável — miolo encolhível/rolável
//    (min-h-0 + overflow-y-auto, padrão do PdvPaymentScreen) e rodapé
//    fixo (shrink-0, padrão dos cabeçalhos do PdvCartSection).
//    Antes da correção estes testes estruturais FALHAM (reprodução);
//    depois, passam.

const SCOPE = "store1:session1";
const KEY = `pdv_cart_draft_v1:${SCOPE}`;

const prod = (over: Partial<any> = {}): any => ({
  id: "p1",
  name: "Coca 2L",
  price: 25,
  image_url: null,
  section_id: "s1",
  is_available: true,
  ...over,
});

describe("PdvSaleSuccessScreen — clique e recibo", () => {
  it("mostra os dados da venda e o clique chama onNewSale uma vez", async () => {
    const user = userEvent.setup();
    const onNewSale = vi.fn();
    render(
      <PdvSaleSuccessScreen
        total={25}
        paymentMethodLabel="Dinheiro"
        cashReceived={30}
        troco={5}
        onNewSale={onNewSale}
      />
    );

    expect(screen.getByText("Venda concluída!")).toBeInTheDocument();
    expect(screen.getByText("Dinheiro")).toBeInTheDocument();
    expect(screen.getByText("R$ 25,00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nova venda" }));
    expect(onNewSale).toHaveBeenCalledTimes(1);
  });
});

describe("PdvSaleSuccessScreen — rodapé sempre alcançável (a correção)", () => {
  it("miolo encolhe/rola (min-h-0 + overflow-y-auto) e rodapé é fixo (shrink-0)", () => {
    const { container } = render(
      <PdvSaleSuccessScreen
        total={25}
        paymentMethodLabel="Dinheiro"
        cashReceived={25}
        troco={0}
        onNewSale={() => {}}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    const content = root.firstElementChild as HTMLElement;
    const footer = screen.getByRole("button", { name: "Nova venda" })
      .parentElement as HTMLElement;

    // A raiz contém o transbordamento (padrão do PdvCartSection).
    expect(root.className).toContain("overflow-hidden");
    expect(root.className).toContain("min-h-0");
    // O miolo pode encolher e rolar em janelas baixas — é ele quem cede,
    // nunca o rodapé.
    expect(content.className).toContain("min-h-0");
    expect(content.className).toContain("overflow-y-auto");
    // O rodapé do botão nunca encolhe nem é cortado.
    expect(footer.className).toContain("shrink-0");
  });
});

/**
 * Réplica fiel da fiação pós-venda do PdvPage/PdvPageTeste (os dois
 * painéis têm clearSale/handleNewSale/onSuccess idênticos): usa o hook
 * real do carrinho e a tela de sucesso real. O "concluir" executa a
 * mesma sequência do onSuccess pós-item-11 (clearSaleCart primeiro,
 * depois lastSale + step "success").
 */
function PdvPostSaleHarness() {
  const c = usePdvCart();
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "success">("cart");
  const [lastSale, setLastSale] = useState<{
    total: number;
    paymentMethodLabel: string;
    cashReceived: number | null;
    troco: number | null;
  } | null>(null);

  useEffect(() => {
    c.setCartScope(SCOPE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // clearSale da página (verbatim): limpa carrinho + volta ao carrinho.
  const clearSale = () => {
    c.clearSale();
    setCheckoutStep("cart");
    c.setOrderDone(false);
    setLastSale(null);
  };

  // "Nova venda" da página (verbatim).
  const handleNewSale = () => {
    clearSale();
  };

  // Conclusão (cabeça do onSuccess pós-item-11, verbatim nas chamadas).
  const concluir = () => {
    c.clearSale();
    setLastSale({
      total: 25,
      paymentMethodLabel: "Dinheiro",
      cashReceived: 25,
      troco: 0,
    });
    setCheckoutStep("success");
    c.setOrderDone(true);
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
        <div data-testid="etapa-carrinho">
          itens:{c.cart.length} pagamento:{c.paymentMethod || "—"}
        </div>
      )}
      <button
        onClick={() => {
          c.addScannedProduct(prod());
          c.setPaymentMethod("dinheiro");
        }}
      >
        montar venda
      </button>
      <button onClick={concluir}>concluir venda</button>
    </div>
  );
}

describe("Fluxo pós-venda (fiação da página + hook real + tela real)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("concluir → sucesso → 'Nova venda' → venda limpa, sem reload", async () => {
    const user = userEvent.setup();
    render(<PdvPostSaleHarness />);

    await user.click(screen.getByRole("button", { name: "montar venda" }));
    expect(screen.getByTestId("etapa-carrinho")).toHaveTextContent("itens:1");

    await user.click(screen.getByRole("button", { name: "concluir venda" }));
    expect(screen.getByText("Venda concluída!")).toBeInTheDocument();
    // Item 11 preservado: a conclusão já apagou o rascunho persistido.
    expect(localStorage.getItem(KEY)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Nova venda" }));
    // Saiu da tela de sucesso e voltou à venda limpa — sem reload.
    expect(screen.queryByText("Venda concluída!")).not.toBeInTheDocument();
    expect(screen.getByTestId("etapa-carrinho")).toHaveTextContent("itens:0");
    expect(screen.getByTestId("etapa-carrinho")).toHaveTextContent("pagamento:—");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("o ciclo se repete: nova venda após 'Nova venda' salva rascunho de novo", async () => {
    const user = userEvent.setup();
    render(<PdvPostSaleHarness />);

    await user.click(screen.getByRole("button", { name: "montar venda" }));
    await user.click(screen.getByRole("button", { name: "concluir venda" }));
    await user.click(screen.getByRole("button", { name: "Nova venda" }));

    await user.click(screen.getByRole("button", { name: "montar venda" }));
    expect(screen.getByTestId("etapa-carrinho")).toHaveTextContent("itens:1");
    // Venda em aberto volta a persistir (recurso do item 11 intacto).
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });
});
