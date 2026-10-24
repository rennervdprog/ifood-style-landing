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
 * 1. "Mais" restaurado no mobile (como o original): a barra inferior
 *    fixa mostra só Início, Pedidos, Cardápio, Clientes + "Mais";
 *    Operação, Financeiro e Configurações (e, com elas, Motoboys)
 *    vivem no sheet do "Mais" — AdminBottomNavTeste. Só entram no
 *    sheet os grupos já visíveis para a loja (visibleGroupsTeste).
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
import { ChevronRight, Menu, Search, Settings, X } from "lucide-react";
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
import { bottomNavGroupKeys, moreSheetGroupKeys } from "../../constants";
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

/* ── Barra inferior mobile: 4 fixos + "Mais" (como o original) ──
 * Fixa, sem rolagem: os 4 grupos de bottomNavGroupKeys + o botão
 * "Mais" ocupam sempre a largura toda (flex-1 cada), então nenhum
 * item fica fora da tela. O sheet do "Mais" lista só os grupos de
 * moreSheetGroupKeys que já vieram em `groups` (visibilidade da loja
 * respeitada — ex.: pdv_only, que já filtra Operação fora).
 * Cores — só tokens do tema, nenhum hex inventado:
 * - ativo: text-primary + barrinha bg-primary no topo + ícone
 *   ampliado (scale-110) + rótulo font-black;
 * - inativo: text-muted-foreground (tom cheio, não /60, para o ícone
 *   não sumir no cinza) + hover:text-foreground;
 * - badge de pendentes no Pedidos: bg-amber-500 pulsante (como o
 *   original), não destructive;
 * - sheet: item ativo bg-primary/10 + text-primary + rótulo
 *   font-black; inativos com ícone em tamanho legível (h-6 w-6). */

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
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const groupMap = useMemo(
    () => new Map(groups.map((g) => [g.key, g])),
    [groups],
  );
  // Ordem canônica do original; grupos invisíveis para a loja já não
  // estão em `groups` e caem fora aqui pelo filter(Boolean).
  const bottomNavGroups = bottomNavGroupKeys
    .map((k) => groupMap.get(k))
    .filter(Boolean) as DashboardGroup[];
  const moreSheetGroups = moreSheetGroupKeys
    .map((k) => groupMap.get(k))
    .filter(Boolean) as DashboardGroup[];

  // activeGroupKey chega como string; o cast é seguro porque toda chave
  // de grupo vem de DashboardGroupKey (as listas acima são exaustivas).
  const isBottomNavMore = activeGroupKey
    ? !bottomNavGroupKeys.includes(activeGroupKey as DashboardGroup["key"])
    : false;
  const isMoreActive = isBottomNavMore || showMoreSheet;

  // Navegação por outro caminho (busca, sidebar, breadcrumb) fecha o
  // sheet aberto, como o original faz em handleTabChange.
  useEffect(() => {
    setShowMoreSheet(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupKey]);

  const goGroup = (groupKey: DashboardGroup["key"]) => {
    setShowMoreSheet(false);
    onGroupChange(groupKey);
  };

  return (
    <>
      {showMoreSheet && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 lg:hidden"
          onClick={() => setShowMoreSheet(false)}
        />
      )}

      {showMoreSheet && (
        <div className="fixed inset-x-0 bottom-0 z-[70] animate-in fade-in slide-in-from-bottom-4 duration-500 lg:hidden">
          <div className="rounded-t-2xl border-t border-border bg-card pb-safe">
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="grid grid-cols-3 gap-3 px-4 pb-4">
              {moreSheetGroups.map((group) => {
                const Icon = group.icon;
                const isActive = activeGroupKey === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => goGroup(group.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all",
                      isActive
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn("h-6 w-6", isActive && "scale-110")}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span
                      className={cn(
                        "text-[11px]",
                        isActive ? "font-black tracking-tight" : "font-bold",
                      )}
                    >
                      {group.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 pb-safe backdrop-blur-xl lg:hidden"
      >
        <div className="flex h-16 items-center justify-around px-2">
          {bottomNavGroups.map((group) => {
            const Icon = group.icon;
            const isActive = activeGroupKey === group.key && !showMoreSheet;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => goGroup(group.key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-1 flex-col items-center justify-center transition-all duration-300",
                  isActive
                    ? "translate-y-[-2px] text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive && (
                  <div className="absolute top-0 h-1 w-8 animate-in fade-in zoom-in rounded-full bg-primary duration-300" />
                )}
                <div className="relative mt-1">
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-transform duration-300",
                      isActive ? "scale-110" : "group-active:scale-90",
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {group.key === "pedidos" && pendingCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] animate-pulse items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white shadow-lg ring-2 ring-background">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1 text-[11px] transition-all duration-300",
                    isActive ? "font-black tracking-tight" : "font-bold",
                  )}
                >
                  {group.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMoreSheet(!showMoreSheet)}
            aria-expanded={showMoreSheet}
            aria-current={isMoreActive ? "page" : undefined}
            className={cn(
              "relative flex h-full flex-1 flex-col items-center justify-center transition-all duration-300",
              isMoreActive
                ? "translate-y-[-2px] text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isMoreActive && (
              <div className="absolute top-0 h-1 w-8 animate-in fade-in zoom-in rounded-full bg-primary duration-300" />
            )}
            <div className="relative mt-1">
              <div
                className={cn(
                  "transition-all duration-300",
                  showMoreSheet && "rotate-90 scale-110",
                )}
              >
                {showMoreSheet ? (
                  <X className="h-6 w-6" strokeWidth={2.5} />
                ) : (
                  <Menu className="h-6 w-6" strokeWidth={2} />
                )}
              </div>
            </div>
            <span
              className={cn(
                "mt-1 text-[11px] transition-all duration-300",
                isMoreActive ? "font-black tracking-tight" : "font-bold",
              )}
            >
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
