/**
 * TELA 1 — Base canônica do /admin-teste (NÃO usada pelo /admin original).
 *
 * Wrappers de negócio sobre o Shadcn existente. Nada aqui muda dado,
 * texto de negócio ou fluxo: só padroniza a forma. As telas do piloto
 * (ex.: Pedidos) migram para estes componentes por onda, nas telas
 * seguintes; o /admin original continua byte-idêntico.
 *
 * ── REGRAS DURAS DESTA BASE ─────────────────────────────
 * 1. UM botão primário: altura única h-12, raio rounded-xl. Não existe
 *    variante de tamanho no AdminButtonTeste — hierarquia se faz por
 *    variante (primário / secundário / perigo / texto), nunca por altura.
 * 2. UM card: rounded-2xl, borda border-border, bg-card, p-4. É o padrão
 *    de fato do painel (o ui/card Shadcn é rounded-lg e NÃO é o padrão).
 * 3. UM vocabulário fechado de badges (AdminBadgeVariantTeste). Fora
 *    dele, não se inventa cor de status: o estado novo do pedido usa
 *    "novo" (vermelho, distinto de "preparando" âmbar — piloto Pedidos).
 * 4. Tipografia em 5 papéis nomeados (adminTextRoles). PROIBIDO tamanho
 *    fracionário no código novo (nada de 10,5px, 11,5px ou 13,5px):
 *    só text-xs / text-sm / text-base / text-xl.
 * 5. Valores monetários do delivery usam fonte tabular
 *    (font-variant-numeric: tabular-nums, classe `tabular-nums`), como
 *    o PDV já faz com pdv-mono — ver AdminMoneyTeste.
 *
 * ── RAIO ÚNICO POR FUNÇÃO ───────────────────────────────
 * card (superfície) ............ rounded-2xl
 * botão / campo / chip clicável  rounded-xl
 * badge / pílula de status ..... rounded-full
 * modal / diálogo (Radix) ...... rounded-lg (padrão do ui/dialog, intocado)
 * Nada de medidas soltas em px no código novo.
 *
 * ── ESCALA DE Z (documentada; os valores já usados no shell) ──
 * conteúdo ..................... z-auto (base)
 * header do painel ............. z-30
 * overlay da sidebar (mobile) .. z-40
 * sidebar / bottom nav ......... z-50
 * sheet "Mais" .................. REMOVIDO na Tela 1 (não existe mais)
 * diálogo (Radix) .............. z-[110] (ui/dialog, intocado)
 * toast (Sonner) ............... acima do diálogo (padrão da lib)
 * Regra: nada novo entre 50 e 110 sem motivo registrado aqui.
 */

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ── 1. Tipografia: 5 papéis nomeados ─────────────────────────── */

export const adminTextRoles = {
  /** Título da página/aba. Ex.: "Financeiro", "Pedidos". */
  pageTitle: "text-xl font-bold tracking-tight text-foreground",
  /** Título de seção dentro da página/card. */
  sectionTitle: "text-base font-bold text-foreground",
  /** Texto corrido. */
  body: "text-sm text-foreground",
  /** Rótulo secundário, dica, contador. Substitui o micro-texto de 10/11px. */
  caption: "text-xs text-muted-foreground",
  /** Valor monetário / número comparável: tabular, sem reflow. */
  money: "text-sm font-bold tabular-nums text-foreground",
} as const;

export type AdminTextRole = keyof typeof adminTextRoles;

export function AdminTextTeste({
  role,
  as: Tag = "p",
  className,
  children,
}: {
  role: AdminTextRole;
  as?: "p" | "span" | "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  return <Tag className={cn(adminTextRoles[role], className)}>{children}</Tag>;
}

/** Valor monetário do delivery em fonte tabular (não muda o texto). */
export function AdminMoneyTeste({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={cn(adminTextRoles.money, className)}>{value}</span>
  );
}

/* ── 2. Botão canônico: uma altura (h-12), um raio (rounded-xl) ── */

export type AdminButtonVariantTeste =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";

const adminButtonVariantMap: Record<
  AdminButtonVariantTeste,
  ButtonProps["variant"]
> = {
  primary: "default",
  secondary: "outline",
  danger: "destructive",
  ghost: "ghost",
};

export function AdminButtonTeste({
  variant = "primary",
  className,
  ...props
}: Omit<ButtonProps, "variant" | "size"> & {
  variant?: AdminButtonVariantTeste;
}) {
  return (
    <Button
      variant={adminButtonVariantMap[variant]}
      className={cn("h-12 rounded-xl px-4 text-sm font-bold", className)}
      {...props}
    />
  );
}

/* ── 3. Card canônico: rounded-2xl, p-4 ───────────────────────── */

export function AdminCardTeste({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn("rounded-2xl border-border bg-card p-4 shadow-none", className)}
      {...props}
    />
  );
}

export function AdminCardTitleTeste({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <CardTitle
      className={cn(adminTextRoles.sectionTitle, className)}
      {...props}
    />
  );
}

export function AdminCardDescriptionTeste({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <CardDescription
      className={cn(adminTextRoles.caption, className)}
      {...props}
    />
  );
}

/* ── 4. Badge canônico: vocabulário fechado de status ─────────── */

export type AdminBadgeVariantTeste =
  | "novo"
  | "preparando"
  | "pronto"
  | "entregando"
  | "entregue"
  | "finalizado"
  | "cancelado"
  | "neutro"
  | "aviso";

const adminBadgeClasses: Record<AdminBadgeVariantTeste, string> = {
  // Pedido novo: vermelho, distinto do âmbar de "preparando" (piloto Pedidos).
  novo: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  preparando: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  pronto: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  entregando: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  entregue: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  finalizado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  // Cancelado é estado terminal: sem cor de alerta, para não competir com "novo".
  cancelado: "border-border bg-muted text-muted-foreground",
  neutro: "border-border bg-muted text-muted-foreground",
  aviso: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function AdminBadgeTeste({
  variant,
  className,
  children,
}: {
  variant: AdminBadgeVariantTeste;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-bold",
        adminBadgeClasses[variant],
        className,
      )}
    >
      {children}
    </Badge>
  );
}

/* ── 5. Campo canônico: label + input + ajuda + erro inline ────
 * Hoje os formulários do painel só reportam erro por toast (Sonner).
 * O campo canônico mantém o toast onde ele já existe e ADICIONA o erro
 * inline por campo — sem mudar validação nem texto de negócio. */

export function AdminFieldTeste({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const hintId = hint ? `${id}-ajuda` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-bold text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(
          "h-12 rounded-xl border-border bg-card px-3 text-sm",
          error && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className={adminTextRoles.caption}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
