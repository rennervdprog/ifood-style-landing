import { ReactNode } from "react";
import { useRuntime } from "@/lib/runtime";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Reserva espaço inferior para a bottom-tab bar (default 80px) */
  withBottomTabs?: boolean;
  className?: string;
};

/**
 * Container raiz para telas com cara de app nativo.
 * - Aplica classe `.native-app` (tokens já existentes em index.css)
 * - Respeita safe-area top/bottom
 * - Reserva padding-bottom para a NativeBottomTabs quando necessário
 * - Em browser web: renderiza só children (não interfere no layout web).
 */
export default function NativeShell({ children, withBottomTabs, className }: Props) {
  const { isNative } = useRuntime();

  if (!isNative) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground",
        withBottomTabs && "pb-[5.25rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}