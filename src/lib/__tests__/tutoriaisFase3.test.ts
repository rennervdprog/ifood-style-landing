/**
 * Testes da Fase 3 dos tutoriais (2026-11-10): as 8 áreas que não tinham
 * lição ganharam conteúdo, e a conclusão das lições passou a ser medida
 * no servidor (tabela tutorial_progress), não só no localStorage.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TUTORIAIS } from "@/components/TutoriaisPanel";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("Lições novas da Fase 3", () => {
  const novas = ["stock", "reviews", "motoboys_map", "whatsapp", "conversations", "kds", "printing"];

  it.each(novas)("a lição %s existe, com etapas reais", (id) => {
    const licao = TUTORIAIS.find((t) => t.id === id);
    expect(licao, `lição ${id} não encontrada`).toBeDefined();
    expect(licao!.steps.length).toBeGreaterThanOrEqual(3);
    expect(licao!.steps.every((s) => s.title.length > 0 && s.content.length > 20)).toBe(true);
  });

  it("a biblioteca tem 26 lições (19 antigas + 7 novas)", () => {
    expect(TUTORIAIS).toHaveLength(26);
    expect(new Set(TUTORIAIS.map((t) => t.id)).size).toBe(26);
  });

  it("a lição de Notificações ensina os Avisos por voz", () => {
    const licao = TUTORIAIS.find((t) => t.id === "notifications");
    expect(licao!.steps.some((s) => s.title.includes("Avisos por voz"))).toBe(true);
  });

  it("a lição do WhatsApp não promete divisão automática de dinheiro", () => {
    const licao = TUTORIAIS.find((t) => t.id === "whatsapp");
    const texto = licao!.steps.map((s) => s.content).join(" ");
    expect(texto).not.toContain("split");
    expect(texto).not.toContain("repassa automaticamente");
  });
});

describe("Medição no servidor (tutorial_progress)", () => {
  it("o painel lê e grava o progresso na tabela", () => {
    const panel = read("components/TutoriaisPanel.tsx");
    expect(panel).toContain('from("tutorial_progress")');
    expect(panel).toContain("upsert");
    // o cache local continua existindo (offline)
    expect(panel).toContain("localStorage.setItem(storageKey");
  });

  it("a migration cria a tabela com RLS e políticas do próprio usuário", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20261110150000_tutorial_progress.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.tutorial_progress");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("primary key (user_id, section_id)");
  });
});

describe("Botões das telas novas (Fase 3)", () => {
  it("o alternador do Cardápio abre Estoque na visualização de estoque", () => {
    expect(read("pages/admin/tabs/MenuTabReorg.tsx")).toContain('view === "estoque" ? "stock" : "menu"');
  });

  it("Avaliações e Mapa têm o botão ligado nas suas lições", () => {
    expect(read("pages/admin/tabs/ReviewsTabReorg.tsx")).toContain('tutorialId="reviews"');
    expect(read("pages/admin/tabs/MotoboysMapTabReorg.tsx")).toContain('tutorialId="motoboys_map"');
  });

  it("as sub-abas de Configurações têm ajuda própria", () => {
    const settings = read("pages/admin/tabs/SettingsTabReorg.tsx");
    for (const par of [
      'notificacoes: "notifications"',
      'impressao: "printing"',
      'whatsapp: "whatsapp"',
      'conversas: "conversations"',
      'kds: "kds"',
    ]) {
      expect(settings).toContain(par);
    }
  });
});
