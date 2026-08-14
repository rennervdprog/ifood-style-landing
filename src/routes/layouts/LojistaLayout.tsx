import LojistaHomeRedirect from "@/components/LojistaHomeRedirect";
import { Outlet } from "react-router-dom";

/**
 * Wrapper que aplica LojistaHomeRedirect apenas em /admin (dashboard raiz).
 * Filhos que não devem sofrer redirect (pdv, cardapio, etc.) ficam fora deste layout.
 */
export function LojistaHomeLayout() {
  return (
    <LojistaHomeRedirect>
      <Outlet />
    </LojistaHomeRedirect>
  );
}

export default LojistaHomeLayout;