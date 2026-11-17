/**
 * Correções frontend do E2E de matriz (17/11/2026) — guardas estáticos.
 *
 * F1: login de lojista_matriz/lojista_unidade caía em /cliente.
 * F2: modal "Termos atualizados" em conta recém-criada (o cadastro não
 *     gravava as versões aceitas em profiles).
 * F4/F5/F6: o /matriz antigo é aposentado — redireciona para /matriz-v2.
 * F12: após aceitar o convite, caía em /cliente (cache de papel).
 * F17: âmbar no painel da matriz (badge de preço próprio, botão de
 *     sobrescrever, faixas de status) — laranja da marca + neutros.
 * F10: página do convite sem CTA de cadastro.
 * Item 2 (pós-E2E): pós-cadastro de matriz caía em /admin (cache de papel
 *   preenchido com o papel antigo durante o signIn; o F3 — toast "Acesso
 *   negado" — é a mesma causa).
 *
 * Padrão dos testes estáticos do repo: andar a árvore de rotas sem
 * renderizar + leitura de fonte (ver alinhamentoAdmin.test.ts).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { lojistaRoutes } from "../domains/lojista.routes";
import { MatrizDashboard, MatrizDashboardV2 } from "../lazyPages";

const src = (...parts: string[]) => readFileSync(join(process.cwd(), "src", ...parts), "utf8");

type RouteMount = { path: string; elementType: unknown; elementProps: Record<string, unknown> };

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
    out.push({
      path: props.path,
      elementType: props.element.type,
      elementProps: (props.element.props ?? {}) as Record<string, unknown>,
    });
  }
  if (props.children !== undefined) collectMounts(props.children, out);
  return out;
}

const mounts = collectMounts(lojistaRoutes as ReactNode);
const byPath = new Map(mounts.map((m) => [m.path, m]));

describe("F4/F5/F6 — /matriz antigo aposentado: redireciona para /matriz-v2", () => {
  it("/matriz redireciona para /matriz-v2 (replace)", () => {
    const mount = byPath.get("/matriz");
    expect(mount).toBeDefined();
    expect(mount!.elementType).toBe(Navigate);
    expect(mount!.elementProps.to).toBe("/matriz-v2");
    expect(mount!.elementProps.replace).toBe(true);
  });

  it("/matriz-v2 monta o painel refeito", () => {
    expect(byPath.get("/matriz-v2")?.elementType).toBe(MatrizDashboardV2);
  });

  it("o painel antigo não está montado em nenhuma rota do lojista", () => {
    const mountedTypes = new Set(mounts.map((m) => m.elementType));
    expect(mountedTypes.has(MatrizDashboard)).toBe(false);
  });

  it("useUserRouting: home da matriz é /matriz-v2 (tipo + resolver)", () => {
    const routing = src("hooks", "useUserRouting.ts");
    expect(routing).toContain('homeRoute = "/matriz-v2"');
    expect(routing).toContain('| "/matriz-v2"');
    expect(routing.match(/"\/matriz"/g) ?? []).toHaveLength(0);
  });

  it("CadastroLojista: conta matriz cai em /matriz-v2", () => {
    const cadastro = src("pages", "CadastroLojista.tsx");
    expect(cadastro).toContain('navigate(accountType === "matriz" ? "/matriz-v2" : "/admin"');
  });

  it("painéis /admin redirecionam a matriz para /matriz-v2", () => {
    for (const file of ["AdminDashboardReorg.tsx", "AdminDashboardV2.tsx", "AdminDashboardV2Teste.tsx"]) {
      const page = src("pages", file);
      expect(page).toContain('navigate("/matriz-v2", { replace: true })');
      expect(page).not.toContain('navigate("/matriz", { replace: true })');
    }
  });

  it("Capacitor: /matriz-v2 é rota de parceiro permitida (e /matriz segue listada)", () => {
    const guard = src("components", "CapacitorRouteGuard.tsx");
    expect(guard.match(/"\/matriz-v2"/g) ?? []).toHaveLength(2);
    expect(guard).toContain('"/matriz"');
  });

  it("partnerDashboard: tipo do destino da matriz é /matriz-v2", () => {
    const partner = src("lib", "partnerDashboard.ts");
    expect(partner).toContain('| "/matriz-v2"');
  });
});

describe("F1 — login roteia papéis de rede para a home certa", () => {
  it("AuthPage roteia lojista_matriz → /matriz-v2 e lojista_unidade → /admin", () => {
    const auth = src("pages", "AuthPage.tsx");
    expect(auth).toContain('prof?.role === "lojista_matriz"');
    expect(auth).toContain('navigate("/matriz-v2", { replace: true })');
    expect(auth).toContain('prof?.role === "lojista_unidade"');
  });
});

describe("F2 — cadastro grava as versões dos termos aceitas em profiles", () => {
  it("CadastroLojista grava terms/privacy_version_accepted no aceite do cadastro", () => {
    const cadastro = src("pages", "CadastroLojista.tsx");
    expect(cadastro).toContain("terms_version_accepted: CURRENT_TERMS_VERSION");
    expect(cadastro).toContain("privacy_version_accepted: CURRENT_PRIVACY_VERSION");
  });

  it("AuthPage (cadastro /auth) grava as versões no update de profiles do signup", () => {
    const auth = src("pages", "AuthPage.tsx");
    expect(auth).toContain("terms_version_accepted: CURRENT_TERMS_VERSION");
    expect(auth).toContain("privacy_version_accepted: CURRENT_PRIVACY_VERSION");
  });
});

describe("F12 — aceite do convite aguarda o papel novo antes de navegar", () => {
  it("ConviteRede invalida o cache de roteamento e aguarda o refetch antes de ir para /admin", () => {
    const convite = src("pages", "ConviteRede.tsx");
    expect(convite).toContain("USER_ROUTING_QUERY_KEY");
    expect(convite).toContain(
      "await queryClient.invalidateQueries({ queryKey: [USER_ROUTING_QUERY_KEY, user?.id] })",
    );
    expect(convite).toContain('await queryClient.invalidateQueries({ queryKey: ["user-role", user?.id] })');
    expect(convite).toContain(
      "await queryClient.refetchQueries({ queryKey: [USER_ROUTING_QUERY_KEY, user?.id] })",
    );
    // A navegação acontece DEPOIS do refetch (ordem no fonte).
    expect(
      convite.indexOf("await queryClient.refetchQueries"),
    ).toBeLessThan(convite.indexOf('navigate("/admin", { replace: true })'));
  });
});

describe("F17 — painel da matriz sem âmbar (laranja da marca + neutros)", () => {
  it("MatrizDashboardV2 não tem nenhuma ocorrência de amber", () => {
    const v2 = src("pages", "MatrizDashboardV2.tsx");
    expect(v2).not.toContain("amber");
  });

  it("badge de preço próprio e botão de sobrescrever usam o laranja da marca", () => {
    const v2 = src("pages", "MatrizDashboardV2.tsx");
    expect(v2).toContain('it.status === "preco_proprio" ? "bg-primary/10 text-primary"');
    expect(v2).toContain("border-primary/50 text-primary");
  });
});

describe("F10 — página do convite tem CTA de cadastro", () => {
  it("ConviteRede mostra o botão de criar conta levando ao /auth", () => {
    const convite = src("pages", "ConviteRede.tsx");
    expect(convite).toContain("Criar conta com esse e-mail");
    expect(convite).toContain('navigate("/auth")');
  });

  it("ConviteRede não tem âmbar", () => {
    expect(src("pages", "ConviteRede.tsx")).not.toContain("amber");
  });
});

describe("Item 2 — cadastro de matriz aguarda o papel novo antes de navegar", () => {
  it("CadastroLojista invalida o cache de roteamento e aguarda o refetch antes de ir para /matriz-v2", () => {
    const cadastro = src("pages", "CadastroLojista.tsx");
    expect(cadastro).toContain("USER_ROUTING_QUERY_KEY");
    expect(cadastro).toContain(
      "await queryClient.invalidateQueries({ queryKey: [USER_ROUTING_QUERY_KEY, signUpData.user.id] })",
    );
    expect(cadastro).toContain(
      'await queryClient.invalidateQueries({ queryKey: ["user-role", signUpData.user.id] })',
    );
    expect(cadastro).toContain(
      "await queryClient.refetchQueries({ queryKey: [USER_ROUTING_QUERY_KEY, signUpData.user.id] })",
    );
    // A navegação para /matriz-v2 acontece DEPOIS do refetch (ordem no fonte).
    expect(cadastro.indexOf("await queryClient.refetchQueries")).toBeLessThan(
      cadastro.indexOf('navigate(accountType === "matriz" ? "/matriz-v2" : "/admin"'),
    );
  });

  it("o refresh do cache só roda no caminho de matriz (cadastro comum intacto)", () => {
    const cadastro = src("pages", "CadastroLojista.tsx");
    const refetchIdx = cadastro.indexOf("await queryClient.refetchQueries");
    expect(refetchIdx).toBeGreaterThan(-1);
    // O guard de matriz está imediatamente antes do bloco de refresh.
    const window = cadastro.slice(Math.max(0, refetchIdx - 600), refetchIdx);
    expect(window).toContain('if (accountType === "matriz")');
  });

  it("o refresh nunca trava o cadastro se o refetch falhar (fail-open)", () => {
    const cadastro = src("pages", "CadastroLojista.tsx");
    const refetchIdx = cadastro.indexOf("await queryClient.refetchQueries");
    expect(refetchIdx).toBeGreaterThan(-1);
    // O bloco de refresh vive dentro de try/catch: falha de rede não impede
    // a navegação (pior caso = o comportamento antigo).
    const window = cadastro.slice(Math.max(0, refetchIdx - 600), refetchIdx + 200);
    expect(window).toContain("try {");
    expect(window).toContain("} catch {");
  });
});
