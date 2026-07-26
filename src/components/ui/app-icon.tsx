/**
 * <AppIcon /> — wrapper opcional em cima do Iconify (pack Solar).
 *
 * Objetivo: manter os ícones do Lucide como padrão do app e usar Solar
 * (bold-duotone) só em pontos de destaque onde quisermos um visual mais
 * "premium" — sempre respeitando as cores do design system (currentColor
 * + tokens semânticos como text-primary / text-muted-foreground).
 *
 * Uso:
 *   <AppIcon name="cart-large-minimalistic" className="h-4 w-4" />
 *   <AppIcon name="pizza" variant="bold" className="h-4 w-4 text-primary" />
 *
 * Rollback: apagar este arquivo e reverter os poucos imports que apontam
 * pra ele — o resto do app continua no Lucide sem alteração.
 */
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

type SolarVariant = "bold-duotone" | "bold" | "linear" | "outline" | "line-duotone";

interface AppIconProps {
  /** Nome do ícone no pack Solar (sem prefixo). Ex: "pizza", "cart-large-minimalistic". */
  name: string;
  /** Variante visual do Solar. Padrão: bold-duotone (moderno, tipo iFood/Rappi). */
  variant?: SolarVariant;
  className?: string;
  "aria-hidden"?: boolean;
}

export const AppIcon = ({
  name,
  variant = "bold-duotone",
  className,
  "aria-hidden": ariaHidden = true,
}: AppIconProps) => {
  return (
    <Icon
      icon={`solar:${name}-${variant}`}
      className={cn("shrink-0 pointer-events-none", className)}
      aria-hidden={ariaHidden}
    />
  );
};

export default AppIcon;