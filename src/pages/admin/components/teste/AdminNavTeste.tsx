/**
 * TELA 1 — Navegação em 2 níveis do /admin-teste (NÃO usada pelo /admin).
 *
 * Achata os 3 níveis atuais do shell de teste:
 * - Nível 1: grupo (Início, Pedidos, Cardápio, Clientes, Operação,
 *   Financeiro, Configurações) — TODOS visíveis, sem grupo "Mais".
 * - Nível 2: sub-aba do grupo ativo (a GroupTabsBar original, intocada).
 * O 3º nível (seções internas de cada aba) não muda nesta tela.
 *
 * O que muda em relação ao shell original:
 * 1. FIM do sheet "Mais" no mobile: Operação, Financeiro e
 *    Configurações (e, com elas, Motoboys) passam a aparecer direto na
 *    barra inferior rolável — AdminBottomNavTeste.
 * 2. Repasse num SÓ lugar: filterTesteNavGroups remove a sub-aba
 *    "Repasse" do grupo Início e a mantém só no Financeiro. O destino,
 *    o componente e o texto não mudam — some só o caminho duplicado.
 * 3. Busca visível: AdminSearchBarTeste é uma entrada de busca
 *    permanente no cabeçalho (não só o atalho Ctrl+K). O índice é o
 *    mesmo do DashboardSearch original (grupos visíveis + seções de
 *    Configurações → Geral); o atalho Ctrl+K continua funcionando.
 * 4. Breadcrumb: AdminBreadcrumbTeste mostra "Grupo › Sub-aba" acima
 *    do conteúdo, para o lojista saber onde está sem decorar caminhos.
 *
 * Nenhuma aba deixa de existir e nenhuma passa a usar outro componente:
 * as demais abas continuam reutilizando os componentes originais, e a
 * aba Pedidos continua ligada ao OrdersSectionTeste.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { DashboardGroup } from "../../constants";
import type { DashboardTab } from "../../types";
import { SETTINGS_SECTIONS, requestSettingsSection } from "../../settingsSections";
import { cn } from "@/lib/utils";

/** Busca tolerante a acentos: "configuracoes" encontra "Configurações". */
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Regra da Tela 1: Repasse existe SÓ no Financeiro. Remove a duplicata
 * do grupo Início; grupos que ficarem sem sub-aba somem da navegação.
 * Não altera rótulos, ícones nem regras de visibilidade originais.
 */
export function filterTesteNavGroups(groups: DashboardGroup[]): DashboardGroup[] {
  return groups
    .map((g) =>
      g.key === "inicio"
        ? { ...g, subTabs: g.subTabs.filter((s) => s.key !== "repasse") }
        : g,
    )
    .filter((g) => g.subTabs.length > 0);
}

/** Grupo (já filtrado) que contém a aba atual — sem fallback para o
 *  grupo duplicado: se a aba não está na navegação filtrada, não há
 *  grupo ativo até o redirect do shell corrigir a aba. */
export function getTesteActiveGroup(
  groups: DashboardGroup[],
  tab: DashboardTab,
): DashboardGroup | undefined {
  return groups.find((g) => g.subTabs.some((s) => s.key === tab));
}

/* ── Breadcrumb: "Grupo › Sub-aba" ─────────────────────────────── */

export function AdminBreadcrumbTeste({
  group,
  tabLabel,
  onGroupClick,
}: {
  group: DashboardGroup;
  tabLabel?: string;
  onGroupClick: () => void;
}) {
  return (
    <nav aria-label="Navegação estrutural" className="px-4 pt-3 lg:px-6">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <button
            type="button"
            onClick={onGroupClick}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {group.label}
          </button>
        </li>
        {tabLabel && (
          <>
            <li aria-hidden="true">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </li>
            <li>
              <span aria-current="page" className="text-sm font-bold text-foreground">
                {tabLabel}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

/* ── Busca visível no cabeçalho (+ Ctrl+K, como antes) ─────────── */

export function AdminSearchBarTeste({
  groups,
  isPdvOnly,
  onNavigate,
}: {
  groups: DashboardGroup[];
  isPdvOnly: boolean;
  onNavigate: (tab: DashboardTab) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const settingsSections = useMemo(
    () => SETTINGS_SECTIONS.filter((s) => !(s.hideOnPdvOnly && isPdvOnly)),
    [isPdvOnly],
  );

  const goTab = (tab: DashboardTab) => {
    setOpen(false);
    onNavigate(tab);
  };

  const goSection = (id: string) => {
    setOpen(false);
    requestSettingsSection(id);
    onNavigate("settings");
  };

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Buscar telas (Ctrl+K)"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          Buscar telas e configurações…
        </span>
        <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1 text-xs font-bold md:inline">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-lg">
          <DialogTitle className="sr-only">Buscar telas do painel</DialogTitle>
          <Command
            filter={(value, search) =>
              normalize(value).includes(normalize(search)) ? 1 : 0
            }
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CommandInput placeholder="Buscar telas e configurações…" />
            <CommandList>
              <CommandEmpty>Nenhuma tela encontrada.</CommandEmpty>
              {groups.map((group) => {
                const groupLabel =
                  isPdvOnly && group.pdvLabel ? group.pdvLabel : group.label;
                return (
                  <CommandGroup key={group.key} heading={groupLabel}>
                    {group.subTabs.map((sub) => {
                      const Icon = sub.icon;
                      const label =
                        isPdvOnly && sub.pdvLabel ? sub.pdvLabel : sub.label;
                      return (
                        <CommandItem
                          key={`${group.key}-${sub.key}`}
                          value={`${label} ${groupLabel}`}
                          onSelect={() => goTab(sub.key)}
                        >
                          <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{label}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {groupLabel}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
              <CommandGroup heading="Configurações — Geral">
                {settingsSections.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`${s.label} Configurações Geral`}
                    onSelect={() => goSection(s.id)}
                  >
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{s.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      Configurações
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Barra inferior mobile: todos os grupos, sem "Mais" ──────────
 * Rolável na horizontal para caberem os 7 grupos sem espremer rótulo:
 * nenhum grupo fica escondido atrás de um segundo toque. */

export function AdminBottomNavTeste({
  groups,
  activeGroupKey,
  pendingCount,
  onGroupChange,
}: {
  groups: DashboardGroup[];
  activeGroupKey?: string;
  pendingCount: number;
  onGroupChange: (groupKey: DashboardGroup["key"]) => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 lg:hidden pb-safe"
    >
      <div className="flex h-16 items-stretch overflow-x-auto px-2">
        {groups.map((group) => {
          const Icon = group.icon;
          const isActive = activeGroupKey === group.key;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => onGroupChange(group.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-full min-w-[76px] shrink-0 flex-col items-center justify-center px-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {isActive && (
                <div className="absolute top-0 h-1 w-8 rounded-full bg-primary" />
              )}
              <div className="relative mt-1">
                <Icon
                  className="h-6 w-6"
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {group.key === "pedidos" && pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-black text-destructive-foreground ring-2 ring-background shadow-lg animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-xs",
                  isActive ? "font-black tracking-tight" : "font-bold",
                )}
              >
                {group.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
