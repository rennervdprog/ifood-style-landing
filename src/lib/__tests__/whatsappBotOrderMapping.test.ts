import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  mapPaymentMethodToRpc,
  mapCartToRpcItems,
  shortOrderCode,
  buildTrackingLink,
  classifyRpcError,
  translateRpcError,
  decideMinimumGate,
  buildDeliveryQuoteSnapshot,
  buildBotMetadataPatch,
  sendBestEffort,
  normalizePersonName,
  parseQuantity,
} from "../../../supabase/functions/whatsapp-bot-handler/orderMapping";

describe("mapPaymentMethodToRpc", () => {
  it("mapeia o vocabulário do bot para o do site", () => {
    expect(mapPaymentMethodToRpc("pix")).toBe("pix_machine");
    expect(mapPaymentMethodToRpc("cash")).toBe("dinheiro");
    expect(mapPaymentMethodToRpc("card")).toBe("cartao");
  });

  it("pix_direto não muda", () => {
    expect(mapPaymentMethodToRpc("pix_direto")).toBe("pix_direto");
  });

  it("valor desconhecido passa direto (não inventa mapeamento)", () => {
    expect(mapPaymentMethodToRpc("boleto")).toBe("boleto");
  });
});

describe("mapCartToRpcItems", () => {
  it("converte adicionais para camelCase com o id do catálogo", () => {
    const items = mapCartToRpcItems([
      {
        product_id: "11111111-1111-1111-1111-111111111111",
        quantity: 2,
        unit_price: 79.99,
        observations: "sem cebola",
        addons: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            group_id: "33333333-3333-3333-3333-333333333333",
            group_name: "Sabor 45 cm",
            name: "Calabresa",
            price: 79.99,
          },
          {
            id: "44444444-4444-4444-4444-444444444444",
            group_id: "55555555-5555-5555-5555-555555555555",
            group_name: "Borda",
            name: "Catupiry",
            price: 8,
          },
        ],
      },
    ]);
    expect(items).toEqual([
      {
        product_id: "11111111-1111-1111-1111-111111111111",
        quantity: 2,
        unit_price: 79.99,
        observations: "sem cebola",
        addons: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            groupId: "33333333-3333-3333-3333-333333333333",
            groupName: "Sabor 45 cm",
            name: "Calabresa",
            price: 79.99,
          },
          {
            id: "44444444-4444-4444-4444-444444444444",
            groupId: "55555555-5555-5555-5555-555555555555",
            groupName: "Borda",
            name: "Catupiry",
            price: 8,
          },
        ],
      },
    ]);
  });

  it("item sem adicional vira addons vazio e observations null", () => {
    const items = mapCartToRpcItems([
      { product_id: "p1", quantity: 1, unit_price: 25 },
    ]);
    expect(items).toEqual([
      {
        product_id: "p1",
        quantity: 1,
        unit_price: 25,
        addons: [],
        observations: null,
      },
    ]);
  });

  it("adicional sem id vira null (RPC cai para busca por nome)", () => {
    const items = mapCartToRpcItems([
      {
        product_id: "p1",
        quantity: 1,
        unit_price: 10,
        addons: [{ group_id: "g1", group_name: "Extra", name: "Bacon", price: 5 }],
      },
    ]);
    expect(items[0].addons).toEqual([
      { id: null, groupId: "g1", groupName: "Extra", name: "Bacon", price: 5 },
    ]);
  });
});

describe("shortOrderCode / buildTrackingLink", () => {
  it("número curto é o prefixo do UUID em maiúsculas", () => {
    expect(shortOrderCode("2a27f312-0000-4000-8000-000000000000")).toBe("#2A27F312");
  });

  it("link de acompanhamento usa os últimos 4 dígitos do telefone", () => {
    expect(buildTrackingLink("2a27f312-0000-4000-8000-000000000000", "5514991624997")).toBe(
      "https://www.itasuper.com.br/p/2a27f312-0000-4000-8000-000000000000?t=4997",
    );
  });
});

describe("classifyRpcError / translateRpcError", () => {
  it("loja fechada", () => {
    expect(classifyRpcError("Loja fechada no momento.")).toBe("closed");
    expect(translateRpcError("Loja fechada no momento.").text).toContain("fechada");
  });

  it("pedido mínimo traz o valor da RPC na mensagem", () => {
    expect(classifyRpcError("Pedido mínimo desta loja: R$ 35.")).toBe("below_minimum");
    expect(translateRpcError("Pedido mínimo desta loja: R$ 35.").text).toContain("R$ 35");
  });

  it("preço divergente pede para montar de novo", () => {
    const msg =
      "Preço do adicional Calabresa divergente do catálogo (R$ 79,99 esperado, R$ 64,99 no carrinho). Revise o carrinho e tente novamente.";
    expect(classifyRpcError(msg)).toBe("price_changed");
    expect(translateRpcError(msg).text).toContain("preço");
  });

  it("produto indisponível", () => {
    expect(classifyRpcError("O produto X está indisponível.")).toBe("unavailable");
  });

  it("erro desconhecido vira mensagem genérica com atendente", () => {
    const { kind, text } = translateRpcError("algo muito estranho");
    expect(kind).toBe("unknown");
    expect(text).toContain("atendente");
  });
});

describe("decideMinimumGate", () => {
  it("mínimo desconhecido (leitura da loja falhou) trava FECHADO — nunca vira 0", () => {
    // O caso T4: subtotal 19 < mínimo 20, mas a leitura falhou — sem o
    // fail-closed o bot mostraria a confirmação e geraria idempotency_key.
    expect(decideMinimumGate(19, null)).toEqual({ action: "minimum_unknown" });
    expect(decideMinimumGate(19, undefined)).toEqual({ action: "minimum_unknown" });
    expect(decideMinimumGate(19, NaN)).toEqual({ action: "minimum_unknown" });
  });

  it("mínimo desconhecido trava mesmo com subtotal alto", () => {
    expect(decideMinimumGate(500, null)).toEqual({ action: "minimum_unknown" });
  });

  it("sem mínimo (0) confirma normal", () => {
    expect(decideMinimumGate(19, 0)).toEqual({ action: "show_confirmation" });
  });

  it("abaixo do mínimo volta ao carrinho com o quanto falta", () => {
    expect(decideMinimumGate(19, 20)).toEqual({ action: "below_minimum", missing: 1 });
    expect(decideMinimumGate(19.5, 20)).toEqual({ action: "below_minimum", missing: 0.5 });
  });

  it("no mínimo ou acima confirma normal", () => {
    expect(decideMinimumGate(20, 20)).toEqual({ action: "show_confirmation" });
    expect(decideMinimumGate(22, 20)).toEqual({ action: "show_confirmation" });
  });
});

describe("buildDeliveryQuoteSnapshot", () => {
  it("reduz o quote para o formato que a RPC grava", () => {
    const snap = buildDeliveryQuoteSnapshot(
      {
        policy_version: 2,
        distance: { km: 3.2, source: "osrm", max_km: 15 },
        destination: { precision: "rooftop" },
        pricing: {
          store_delivery_base: 5,
          platform_fee_customer: 0.99,
          platform_fee_store_absorbed: 0,
          vip_override_applied: true,
          split_mode: "lojista",
          plan_type: "essencial",
        },
      },
      5.99,
    );
    expect(snap).toEqual({
      policy_version: 2,
      distance_km: 3.2,
      distance_source: "osrm",
      max_delivery_km: 15,
      destination_precision: "rooftop",
      store_delivery_base: 5,
      platform_fee_customer: 0.99,
      platform_fee_store_absorbed: 0,
      delivery_fee: 5.99,
      vip_override_applied: true,
      split_mode: "lojista",
      plan_type: "essencial",
    });
  });

  it("sem quote retorna null", () => {
    expect(buildDeliveryQuoteSnapshot(null, 0)).toBeNull();
  });
});

describe("buildBotMetadataPatch", () => {
  it("monta os campos que o painel/debug lê", () => {
    expect(
      buildBotMetadataPatch(
        {
          customer_name: "Renner",
          street: "Rua das Flores",
          number: "123",
          neighborhood: "Centro",
          reference: "ao lado da praça",
        },
        "5514991624997",
      ),
    ).toEqual({
      source: "whatsapp_bot",
      customer_phone: "5514991624997",
      customer_name: "Renner",
      address_street: "Rua das Flores",
      address_number: "123",
      address_neighborhood: "Centro",
      address_reference: "ao lado da praça",
    });
  });
});

describe("sendBestEffort", () => {
  it("devolve true quando o envio dá certo", async () => {
    await expect(sendBestEffort(async () => "ok")).resolves.toBe(true);
  });

  it("devolve false e não lança quando o envio falha (a transição continua)", async () => {
    await expect(
      sendBestEffort(async () => {
        throw new Error("send_text_failed_400");
      }),
    ).resolves.toBe(false);
  });

  it("devolve false e não lança quando o envio rejeita com valor não-Error", async () => {
    await expect(sendBestEffort(async () => {
      throw "boom";
    })).resolves.toBe(false);
  });
});

describe("normalizePersonName (Fase 6C, P2-8)", () => {
  it("capitaliza a primeira letra de cada palavra", () => {
    expect(normalizePersonName("ana")).toBe("Ana");
    expect(normalizePersonName("ana maria")).toBe("Ana Maria");
    expect(normalizePersonName("renner teste")).toBe("Renner Teste");
  });

  it("capitaliza após hífen", () => {
    expect(normalizePersonName("joão-pedro")).toBe("João-Pedro");
    expect(normalizePersonName("maria-josé silva")).toBe("Maria-José Silva");
  });

  it("não força o resto para minúsculas (McDonald não quebra)", () => {
    expect(normalizePersonName("McDonald")).toBe("McDonald");
    expect(normalizePersonName("ANA MARIA")).toBe("ANA MARIA");
    expect(normalizePersonName("maria McDonald")).toBe("Maria McDonald");
  });

  it("apara espaços e aceita vazio", () => {
    expect(normalizePersonName("  ana  ")).toBe("Ana");
    expect(normalizePersonName("")).toBe("");
  });
});

describe("parseQuantity (Fase 6C, P2-5)", () => {
  it("aceita inteiros de 1 a 10", () => {
    expect(parseQuantity("1")).toBe(1);
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity("10")).toBe(10);
    expect(parseQuantity(" 3 ")).toBe(3);
  });

  it("recusa 0, 11+, texto, decimal e vazio", () => {
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("11")).toBeNull();
    expect(parseQuantity("99")).toBeNull();
    expect(parseQuantity("dois")).toBeNull();
    expect(parseQuantity("2.5")).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("   ")).toBeNull();
  });
});

describe("drift: index.ts inline == orderMapping.ts", () => {
  it("o bloco inline do handler é idêntico à fonte da verdade", () => {
    // O deploy externo só sobe index.ts (AGENTS.md: functions autocontidas),
    // por isso o handler carrega as funções puras INLINADAS. Se este teste
    // falhar, edite orderMapping.ts e copie o bloco para index.ts (sem o
    // `export`), entre os marcadores INÍCIO/FIM inline de orderMapping.ts.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(here, "../../..");
    const mapping = readFileSync(
      path.join(root, "supabase/functions/whatsapp-bot-handler/orderMapping.ts"),
      "utf8",
    );
    const handler = readFileSync(
      path.join(root, "supabase/functions/whatsapp-bot-handler/index.ts"),
      "utf8",
    );
    const startMarker = "// ── INÍCIO inline de orderMapping.ts (Fase 1) ──";
    const endMarker = "// ── FIM inline de orderMapping.ts ──";
    const start = handler.indexOf(startMarker);
    const end = handler.indexOf(endMarker);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const normalize = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\s+$/, ""))
        .join("\n")
        .trim();

    const mappingBody = normalize(
      mapping
        .slice(mapping.indexOf("export type BotPaymentMethod"))
        .replace(/^export /gm, ""),
    );
    const inlineBody = normalize(
      handler
        .slice(start + startMarker.length, end)
        .split("\n")
        .filter(
          (l) =>
            !l.startsWith("// Fonte da verdade") &&
            !l.startsWith("// (deploy externo") &&
            !l.startsWith("//  src/lib/__tests__"),
        )
        .join("\n"),
    );
    expect(inlineBody).toBe(mappingBody);
  });
});
