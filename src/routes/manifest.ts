/**
 * Route manifest — fonte única para paths tipados.
 *
 * Uso preferencial: `navigate(ROUTES.lojista.admin)` em vez de
 * `navigate("/admin")`. Evita typos silenciosos e permite refactors seguros
 * (rename cai no TS, não em runtime).
 *
 * Migração incremental: novos call-sites já usam `ROUTES`; call-sites
 * antigos migram sob demanda, sem big-bang.
 */
export const ROUTES = {
  public: {
    home: "/",
    lojas: "/lojas",
    lojasCidade: (cidade: string) => `/lojas/${encodeURIComponent(cidade)}`,
    download: "/download",
    termos: "/termos-de-uso",
    privacidade: "/politica-de-privacidade",
    blog: "/blog",
    blogPost: (slug: string) => `/blog/${slug}`,
    planos: "/planos",
    sejaRevendedor: "/seja-revendedor",
    vaga: (cidade: string) => `/vaga/${encodeURIComponent(cidade)}`,
    links: "/links",
  },
  auth: {
    login: "/auth",
    portalParceiro: "/portal-parceiro",
  },
  cliente: {
    home: "/cliente",
    busca: "/cliente/busca",
    carrinho: "/carrinho",
    checkout: "/checkout",
    checkoutRapido: "/checkout-rapido",
    pedidos: "/pedidos",
    perfil: "/perfil",
    pixDireto: (orderId: string) => `/pix-direto/${orderId}`,
    trackingPublico: (orderId: string) => `/p/${orderId}`,
  },
  store: {
    bySlug: (slug: string) => `/${slug}`,
    byId: (id: string) => `/loja/${id}`,
  },
  lojista: {
    admin: "/admin",
    matriz: "/matriz",
    pdv: "/admin/pdv",
    pdvKds: "/admin/pdv/kds",
    cardapio: "/admin/cardapio",
    parceiroOnboarding: "/parceiro",
    cadastroLojista: "/cadastro-lojista",
    cadastroMotoboyLoja: "/cadastro-motoboy-loja",
  },
  entregador: {
    home: "/entregador",
  },
  admin: {
    superAdmin: "/super-admin",
    sandbox: "/super-admin/sandbox-tests",
    moderador: "/moderador",
    suporte: "/suporte",
    blog: "/admin/blog",
    blogNovo: "/admin/blog/novo",
    blogEdit: (id: string) => `/admin/blog/${id}`,
  },
  revendedor: {
    home: "/revendedor",
    entrar: "/revendedor/entrar",
    cadastro: "/revendedor/cadastro",
  },
  kds: (token: string) => `/kds/${token}`,
} as const;

export type RoutesManifest = typeof ROUTES;