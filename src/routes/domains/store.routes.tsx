import { Route } from "react-router-dom";
import { StorePage, NotFound } from "@/routes/lazyPages";

/**
 * Catch-all da loja por slug + fallback 404.
 * DEVE ser importado por último no `<Routes>`, senão engole outras rotas.
 * O guard interno de `StorePage` já bloqueia slugs reservados (ver
 * `src/routes/reservedSlugs.ts`).
 */
export const storeRoutes = (
  <>
    <Route path="/loja/:id" element={<StorePage />} />
    <Route path="/:slug" element={<StorePage />} />
    <Route path="*" element={<NotFound />} />
  </>
);
