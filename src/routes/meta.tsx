import { Helmet } from "react-helmet-async";
import { ROUTES } from "@/routes/manifest";

/**
 * Fase 6 — SEO declarativo por rota.
 *
 * Fonte única de `<title>` / `<meta description>` para as rotas de maior
 * tráfego. Páginas com Helmet próprio (blog, termos, LP) continuam
 * sobrescrevendo — `react-helmet-async` faz merge por deepest-child-wins.
 */
export interface RouteMetaEntry {
  title: string;
  description: string;
}

export const ROUTE_META: Record<string, RouteMetaEntry> = {
  [ROUTES.public.home]: {
    title: "ItaSuper — Delivery, marketplace e PDV para lojistas",
    description:
      "Peça em restaurantes e lojas locais com entrega rápida. Plataforma completa de delivery, marketplace e PDV.",
  },
  [ROUTES.cliente.home]: {
    title: "Início — ItaSuper",
    description: "Encontre lojas e restaurantes perto de você e peça pelo ItaSuper.",
  },
  [ROUTES.cliente.busca]: {
    title: "Buscar lojas — ItaSuper",
    description: "Busque restaurantes, mercados e lojas próximos por nome, categoria ou distância.",
  },
  [ROUTES.cliente.carrinho]: {
    title: "Carrinho — ItaSuper",
    description: "Revise seu pedido antes de finalizar a compra.",
  },
  [ROUTES.cliente.checkout]: {
    title: "Finalizar pedido — ItaSuper",
    description: "Confirme endereço, forma de pagamento e finalize seu pedido.",
  },
  [ROUTES.auth.login]: {
    title: "Entrar — ItaSuper",
    description: "Acesse sua conta ItaSuper para acompanhar pedidos e favoritos.",
  },
  [ROUTES.auth.portalParceiro]: {
    title: "Portal Parceiro — ItaSuper",
    description: "Acesso para lojistas, entregadores e revendedores parceiros ItaSuper.",
  },
  [ROUTES.public.planos]: {
    title: "Planos e preços — ItaSuper",
    description: "Conheça os planos ItaSuper para lojistas e escolha o que melhor cabe no seu negócio.",
  },
  [ROUTES.public.sejaRevendedor]: {
    title: "Seja Revendedor — ItaSuper",
    description: "Ganhe comissão indicando lojistas para o ItaSuper. Programa oficial de revenda.",
  },
};

interface Props {
  path: keyof typeof ROUTE_META | string;
  /** Override manual (ex.: título dinâmico de loja/pedido). */
  title?: string;
  description?: string;
}

export function RouteMeta({ path, title, description }: Props) {
  const entry = ROUTE_META[path];
  const finalTitle = title ?? entry?.title;
  const finalDesc = description ?? entry?.description;
  if (!finalTitle && !finalDesc) return null;
  return (
    <Helmet>
      {finalTitle && <title>{finalTitle}</title>}
      {finalDesc && <meta name="description" content={finalDesc} />}
      {finalTitle && <meta property="og:title" content={finalTitle} />}
      {finalDesc && <meta property="og:description" content={finalDesc} />}
    </Helmet>
  );
}

export default RouteMeta;