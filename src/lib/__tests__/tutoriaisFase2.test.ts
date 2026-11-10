/**
 * Testes ESTÁTICOS da Fase 2 dos tutoriais (2026-11-10): a ajuda voltou
 * para as telas e o conteúdo errado foi corrigido. O defeito mais grave
 * da auditoria era o FAQ ensinando o dinheiro AO CONTRÁRIO (a plataforma
 * repassando o PIX para a loja) — o modelo real é o cliente pagar 100%
 * direto à loja, que guarda e repassa a parte do ItaSuper no acerto.
 * Estes testes travam as frases erradas fora do código e conferem que
 * cada tela Reorg com lição tem o botão "Como funciona" ligado nela.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const panel = read("components/TutoriaisPanel.tsx");
const help = read("components/TutorialHelp.tsx");

describe("TutoriaisPanel — conteúdo corrigido (Fase 2)", () => {
  it("FAQ do dinheiro: nada de repasse da plataforma para a loja", () => {
    expect(panel).not.toContain("repassados pela plataforma direto");
    expect(panel).toContain("100% direto para a sua loja");
    expect(panel).toContain("R$ 0,99 por entrega");
  });

  it("planos reais: Essencial e Somente PDV, sem Crescimento/Comissão/Híbrido", () => {
    expect(panel).not.toContain("Crescimento");
    expect(panel).not.toContain("HÍBRIDO");
    expect(panel).not.toContain("COMISSÃO: não paga mensalidade");
    expect(panel).toContain("SOMENTE PDV");
    expect(panel).toContain("R$ 120/mês");
    expect(panel).toContain("R$ 89,90/mês");
  });

  it("motoboy: quem paga é a loja, por fora da plataforma", () => {
    expect(panel).not.toContain("Pode pagar via PIX direto pelo app");
    expect(panel).toContain("Quem paga o motoboy");
    expect(panel).toContain("por fora do ItaSuper");
  });

  it("chave PIX é onde a loja recebe do cliente, não 'repasses'", () => {
    expect(panel).not.toContain("receber os repasses");
    expect(panel).toContain("direto do cliente para você");
  });

  it("pedidos: sem chat interno inventado; a conversa é pelo WhatsApp", () => {
    expect(panel).not.toContain("Em cada pedido tem um botão de chat");
    expect(panel).toContain("Não existe chat dentro do painel");
  });

  it("Visão Geral descreve a tela atual (Primeiros passos)", () => {
    expect(panel).toContain("Primeiros passos");
    expect(panel).not.toContain("Cartões coloridos no topo");
  });
});

describe("TutorialHelp — modal sem caminho morto, com saída para o suporte", () => {
  it("não aponta mais para Configurações → Tutoriais", () => {
    expect(help).not.toContain("Configurações → Tutoriais");
    expect(help).toContain("botão <strong>?</strong> no topo do painel");
  });

  it("fecho 'Ainda com dúvida?' abre o WhatsApp com a tela de contexto", () => {
    expect(help).toContain("Ainda com dúvida? Falar com o suporte");
    expect(help).toContain("Estou na tela: ${section.title}");
    expect(help).toContain("SUPPORT_WHATSAPP");
  });
});

describe("Botão 'Como funciona' ligado nas telas Reorg (Fase 2)", () => {
  const casos: Array<[string, string]> = [
    ["pages/admin/sections/DashboardOverviewSectionReorg.tsx", 'tutorialId="dashboard"'],
    ["pages/admin/tabs/MenuTabReorg.tsx", 'tutorialId="menu"'],
    ["pages/admin/tabs/AddonsTabReorg.tsx", 'tutorialId="addons"'],
    ["pages/admin/tabs/DriversTabReorg.tsx", 'tutorialId="drivers"'],
    ["pages/admin/tabs/FinanceTabReorg.tsx", 'tutorialId="finance"'],
    ["pages/admin/sections/RepasseSectionReorg.tsx", 'tutorialId="finance"'],
    ["components/store/StoreReportsPanelReorg.tsx", 'tutorialId="reports"'],
    ["pages/admin/components/ClientsTabReorg.tsx", 'tutorialId="clients"'],
    ["pages/admin/tabs/PromotionsTab.tsx", 'tutorialId="coupons"'],
    ["pages/admin/tabs/SettingsTabReorg.tsx", 'tutorialId="settings"'],
  ];

  it.each(casos)("%s abre a lição %s", (arquivo, trecho) => {
    expect(read(arquivo)).toContain(trecho);
  });

  it("o '?' do cabeçalho mapeia Promoções para a lição de Cupons e Promoções", () => {
    expect(read("pages/AdminDashboardReorg.tsx")).toContain('dashboardTab === "promotions" ? "coupons"');
  });
});
