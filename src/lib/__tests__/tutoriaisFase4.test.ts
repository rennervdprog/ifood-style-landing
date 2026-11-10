/**
 * Testes da Fase 4 dos tutoriais (2026-11-10): as telas vazias das abas
 * principais ensinam o que aparece ali e como trazer o primeiro item,
 * e a Visão Geral ganhou o cartão Novidade de 1 passo (lançamento
 * anuncia 1 vez e some no "Entendi", com a dispensa salva por loja).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NOVIDADES, novidadeStorageKey, novidadeVisivel } from "@/lib/novidades";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("Cartão Novidade", () => {
  it("tem pelo menos 1 lançamento, com id único e textos completos", () => {
    expect(NOVIDADES.length).toBeGreaterThanOrEqual(1);
    expect(new Set(NOVIDADES.map((n) => n.id)).size).toBe(NOVIDADES.length);
    for (const n of NOVIDADES) {
      expect(n.titulo.length).toBeGreaterThan(5);
      expect(n.texto.length).toBeGreaterThan(40);
    }
  });

  it("o lançamento atual é o dos avisos por voz, apontando pras Configurações", () => {
    const atual = NOVIDADES[0];
    expect(atual.id).toBe("avisos-por-voz-2026-11");
    expect(atual.ctaTab).toBe("settings");
    expect(atual.texto).toContain("Configurações → Notificações");
    expect(atual.texto).toContain("desligado por padrão");
  });

  it("novidadeVisivel devolve a primeira não dispensada e null quando todas foram", () => {
    expect(novidadeVisivel(new Set())?.id).toBe(NOVIDADES[0].id);
    expect(novidadeVisivel(new Set(NOVIDADES.map((n) => n.id)))).toBeNull();
  });

  it("a chave de dispensa é por loja e por novidade", () => {
    expect(novidadeStorageKey("loja-1", "x")).toBe("novidade_dispensada_loja-1_x");
    expect(novidadeStorageKey("loja-1", "x")).not.toBe(novidadeStorageKey("loja-2", "x"));
  });

  it("o cartão está montado na Visão Geral e dispensa pelo Entendi", () => {
    const overview = read("pages/admin/sections/DashboardOverviewSectionReorg.tsx");
    expect(overview).toContain("NovidadeCard");
    expect(overview).toContain('storeId={store.id}');
    const card = read("pages/admin/components/NovidadeCard.tsx");
    expect(card).toContain("Entendi");
    expect(card).toContain("NOVIDADE");
    expect(card).toContain("localStorage.setItem");
  });

  it("nada de âmbar/amarelo nos arquivos novos da fase", () => {
    for (const rel of ["lib/novidades.ts", "pages/admin/components/NovidadeCard.tsx"]) {
      expect(read(rel)).not.toMatch(/amber|yellow/);
    }
  });
});

describe("Telas vazias que ensinam", () => {
  it("Cupons: o vazio explica o que é cupom e aponta pros modelos prontos", () => {
    const src = read("components/CouponManagerReorg.tsx");
    expect(src).toContain("Nenhum cupom criado ainda");
    expect(src).toContain("PRIMEIRA10");
    expect(src).toContain("Criação rápida");
    expect(src).not.toContain("Nenhum cupom criado ainda.</p>");
  });

  it("Avaliações: o vazio ensina quando a avaliação chega e o prazo de resposta", () => {
    const src = read("pages/admin/tabs/ReviewsTabReorg.tsx");
    expect(src).toContain("depois que o pedido é entregue");
    expect(src).toContain("em até 5 dias");
  });

  it("Clientes: o vazio ensina que o cliente nasce do primeiro pedido", () => {
    const src = read("pages/admin/components/ClientsTabReorg.tsx");
    expect(src).toContain("a partir do primeiro pedido de cada um");
    expect(src).toContain("chama de volta quem esfriou");
  });

  it("Mapa de motoboys: o vazio ensina a vincular e o que aparece depois", () => {
    const src = read("pages/admin/tabs/MotoboysMapTabReorg.tsx");
    expect(src).toContain("Nenhum motoboy vinculado ainda");
    expect(src).toContain("app do entregador");
  });

  it("Pedidos: a coluna de pendentes convida a compartilhar o cardápio (nas 2 variantes)", () => {
    for (const rel of [
      "pages/admin/components/orders/OrdersEmptyState.tsx",
      "pages/admin/components/orders/OrdersEmptyStateTeste.tsx",
    ]) {
      const src = read(rel);
      expect(src).toContain("Compartilhe o link do seu cardápio");
      expect(src).not.toContain("Relaxe!");
    }
  });
});
