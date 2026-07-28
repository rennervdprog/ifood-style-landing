/**
 * Fonte única de slugs reservados no topo da URL.
 *
 * O catch-all `"/:slug"` renderiza `StorePage` para qualquer path de 1 nível
 * que não seja uma rota registrada. Sem esta lista, `/baixar-app`,
 * `/politica-privacidade` (typo), `/lp`, etc. cairiam em `StorePage` e
 * mostrariam "🍽️ Loja fechada no momento" em vez de 404.
 *
 * Regra: qualquer path de 1º nível usado em `App.tsx` (rota real, redirect,
 * alias ou variação comum) precisa estar aqui.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // rotas reais
  "lojas",
  "cliente",
  "painel",
  "loja",
  "carrinho",
  "checkout",
  "checkout-rapido",
  "pix-direto",
  "p",
  "pedidos",
  "perfil",
  "auth",
  "portal-parceiro",
  "admin",
  "matriz",
  "entregador",
  "super-admin",
  "parceiro",
  "revendedor",
  "seja-revendedor",
  "cadastro-entregador",
  "cadastro-lojista",
  "cadastro-motoboy-loja",
  "termos-de-uso",
  "politica-de-privacidade",
  "planos",
  "moderador",
  "suporte",
  "links",
  "download",
  "kds",
  "blog",
  "vaga",
  // aliases/redirects legados
  "admin2",
  "entregador1",
  "entregador2",
  "super-admin1",
  "super-admin2",
  "termos",
  "privacidade",
  // typos comuns que já viraram bugs em produção
  "baixar-app",
  "politica-privacidade",
  "termo",
  "landing",
  "home",
  "sobre",
  "contato",
  "app",
  "site",
  "index",
  "lp",
]);

export function isReservedSlug(slug: string | undefined | null): boolean {
  if (!slug) return false;
  return RESERVED_SLUGS.has(slug.toLowerCase());
}