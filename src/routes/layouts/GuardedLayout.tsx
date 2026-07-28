import { Outlet } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import type { ComponentProps } from "react";

type GuardProps = Omit<ComponentProps<typeof RoleGuard>, "children">;

/**
 * Layout que aplica RoleGuard uma única vez a uma sub-árvore de rotas.
 * Usado com rotas aninhadas para eliminar repetição de <RoleGuard> em cada <Route>.
 */
export function GuardedLayout(props: GuardProps) {
  return (
    <RoleGuard {...props}>
      <Outlet />
    </RoleGuard>
  );
}

export default GuardedLayout;