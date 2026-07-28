import { Route, Navigate } from "react-router-dom";
import { RouteMeta } from "@/routes/meta";
import { ROUTES } from "@/routes/manifest";
import {
  StoreDirectory,
  CityStoresPage,
  TermosDeUso,
  PoliticaPrivacidade,
  PlanosPage,
  LinksPage,
  DownloadApp,
  SejaRevendedor,
  VagaPromoPage,
  BlogIndex,
  BlogPost,
  KdsPage,
} from "@/routes/lazyPages";

/**
 * Rotas públicas de baixa autenticação (landing, blog, docs legais, promo).
 * Retorna um fragmento — React Router 6 achata Fragments dentro de <Routes>.
 */
export const publicRoutes = (
  <>
    <Route
      path="/"
      element={
        <>
          <RouteMeta path={ROUTES.public.home} />
          <StoreDirectory />
        </>
      }
    />
    <Route path="/lojas" element={<Navigate to="/" replace />} />
    <Route path="/lojas/:cidade" element={<CityStoresPage />} />
    <Route path="/termos-de-uso" element={<TermosDeUso />} />
    <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
    <Route path="/termos" element={<Navigate to="/termos-de-uso" replace />} />
    <Route path="/privacidade" element={<Navigate to="/politica-de-privacidade" replace />} />
    {/* Redirects de typos comuns (antes caíam em 404 global). */}
    <Route path="/politica-privacidade" element={<Navigate to="/politica-de-privacidade" replace />} />
    <Route path="/politica-de-privacidad" element={<Navigate to="/politica-de-privacidade" replace />} />
    <Route path="/termo" element={<Navigate to="/termos-de-uso" replace />} />
    <Route path="/baixar-app" element={<Navigate to="/download" replace />} />
    <Route path="/app" element={<Navigate to="/download" replace />} />
    <Route path="/lp" element={<Navigate to="/" replace />} />
    <Route path="/home" element={<Navigate to="/" replace />} />
    <Route path="/index" element={<Navigate to="/" replace />} />
    <Route path="/landing" element={<Navigate to="/" replace />} />
    <Route
      path="/planos"
      element={
        <>
          <RouteMeta path={ROUTES.public.planos} />
          <PlanosPage />
        </>
      }
    />
    <Route path="/links" element={<LinksPage />} />
    <Route path="/download" element={<DownloadApp />} />
    <Route
      path="/seja-revendedor"
      element={
        <>
          <RouteMeta path={ROUTES.public.sejaRevendedor} />
          <SejaRevendedor />
        </>
      }
    />
    <Route path="/vaga/:cidade" element={<VagaPromoPage />} />
    <Route path="/blog" element={<BlogIndex />} />
    <Route path="/blog/:slug" element={<BlogPost />} />
    <Route path="/kds/:token" element={<KdsPage />} />
  </>
);
