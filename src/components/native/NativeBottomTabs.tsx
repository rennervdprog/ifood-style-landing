import { ReactNode } from "react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type NativeTab = {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: number;
};

type Props = {
  tabs: NativeTab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
};

/**
 * Bottom-tabs estilo nativo (iOS/Android Material 3).
 * - Altura 64dp + safe-area
 * - Toque mínimo 48dp
 * - Haptic light na troca
 * - Só deve ser montado quando `useRuntime().isNative === true`
 */
export default function NativeBottomTabs({ tabs, activeKey, onChange, className }: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Navegação"
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border",
        "pb-safe",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around h-16">
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <li key={t.key} className="flex-1">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={t.label}
                onClick={() => {
                  if (active) return;
                  haptic.light();
                  onChange(t.key);
                }}
                className={cn(
                  "relative w-full h-full flex flex-col items-center justify-center gap-0.5",
                  "transition-colors duration-150 active:scale-[0.96]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative flex items-center justify-center w-7 h-7">
                  {t.icon}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black flex items-center justify-center">
                      {t.badge > 99 ? "99+" : t.badge}
                    </span>
                  )}
                </span>
                <span className={cn("text-[10px] font-bold tracking-wide", active && "text-primary")}>
                  {t.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}