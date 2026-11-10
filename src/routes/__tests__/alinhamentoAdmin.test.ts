/**
 * Alinhamento /admin ← /admin-teste (decisão do Renner, 2026-10-31;
 * virada na segunda 2026-11-02): o /admin oficial monta a árvore Teste.
 *
 * Promoção (decisão do Renner, 2026-11-10): a casca REORG, construída e
 * aprovada no /admin-teste (reorganização do painel, 2026-11-08), vira o
 * painel oficial — /admin passa a montar AdminDashboardReorg.
 *
 * Árvore única, dois mounts: /admin e /admin-teste renderizam o MESMO
 * componente (AdminDashboardReorg); /admin/pdv e /admin-teste/pdv
 * idem (PdvPageTeste). As árvores antigas (AdminDashboardV2,
 * AdminDashboardV2Teste e PdvPage) não podem estar montadas em nenhuma
 * rota do lojista — os arquivos seguem no repo para
 * rollback/consolidação pós-prazo.
 *
 * O teste anda a árvore de elementos de `lojistaRoutes` (sem renderizar:
 * os elementos lazy são comparados por identidade com as constantes de
 * lazyPages) e confere a fiação de prefetch por leitura de fonte, no
 * padrão dos testes estáticos do repo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { lojistaRoutes } from "../domains/lojista.routes";
import {
  AdminDashboardReorg,
  AdminDashboardV2,
  AdminDashboardV2Teste,
  PdvPage,
  PdvPageTeste,
} from "../lazyPages";

type RouteMount = { path: string; elementType: unknown };

function collectMounts(node: ReactNode, out: RouteMount[] = []): RouteMount[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectMounts(child, out));
    return out;
  }
  if (!isValidElement(node)) return out;
  const props = node.props as {
    path?: unknown;
    element?: ReactElement;
    children?: ReactNode;
  };
  if (typeof props.path === "string" && isValidElement(props.element)) {
    out.push({ path: props.path, elementType: props.element.type });
  }
  if (props.children !== undefined) collectMounts(props.children, out);
  return out;
}

const mounts = collectMounts(lojistaRoutes as ReactNode);
const byPath = new Map(mounts.map((m) => [m.path, m.elementType]));

describe("alinhamento /admin ← /admin-teste — mounts", () => {
  it("/admin monta AdminDashboardReorg", () => {
    expect(byPath.get("/admin")).toBe(AdminDashboardReorg);
  });

  it("/admin-teste monta a MESMA árvore de /admin", () => {
    expect(byPath.get("/admin-teste")).toBe(AdminDashboardReorg);
    expect(byPath.get("/admin-teste")).toBe(byPath.get("/admin"));
  });

  it("/admin/pdv monta PdvPageTeste", () => {
    expect(byPath.get("/admin/pdv")).toBe(PdvPageTeste);
  });

  it("/admin-teste/pdv monta a MESMA árvore de /admin/pdv", () => {
    expect(byPath.get("/admin-teste/pdv")).toBe(PdvPageTeste);
    expect(byPath.get("/admin-teste/pdv")).toBe(byPath.get("/admin/pdv"));
  });

  it("as árvores antigas não estão montadas em nenhuma rota do lojista", () => {
    const mountedTypes = new Set(mounts.map((m) => m.elementType));
    expect(mountedTypes.has(AdminDashboardV2)).toBe(false);
    expect(mountedTypes.has(AdminDashboardV2Teste)).toBe(false);
    expect(mountedTypes.has(PdvPage)).toBe(false);
  });
});

describe("alinhamento /admin ← /admin-teste — prefetch aponta para a árvore Reorg", () => {
  const lazyPagesSrc = readFileSync(
    join(process.cwd(), "src", "routes", "lazyPages.ts"),
    "utf8",
  );
  const appSrc = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

  it("PREFETCH_MAP de /admin importa a Reorg e o de /admin/pdv a página Teste", () => {
    expect(lazyPagesSrc).toContain(
      '[ROUTES.lojista.admin]: () => import("@/pages/AdminDashboardReorg")',
    );
    expect(lazyPagesSrc).toContain(
      '[ROUTES.lojista.pdv]: () => import("@/pages/PdvPageTeste")',
    );
  });

  it("prefetch Capacitor (modo parceiro) importa a Reorg e as páginas Teste", () => {
    expect(appSrc).toContain('import("./pages/AdminDashboardReorg")');
    expect(appSrc).toContain('import("./pages/PdvPageTeste")');
  });
});
