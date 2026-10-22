import { useEffect, useMemo, useState } from "react";
import { Search, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { DashboardGroup } from "../constants";
import type { DashboardTab } from "../types";
import { SETTINGS_SECTIONS, requestSettingsSection } from "../settingsSections";

/** Busca tolerante a acentos: "configuracoes" encontra "Configurações". */
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface DashboardSearchProps {
  /** grupos já filtrados pelas regras de visibilidade do dashboard */
  groups: DashboardGroup[];
  isPdvOnly: boolean;
  /** mesmo mecanismo de navegação do dashboard (handleTabChange) */
  onNavigate: (tab: DashboardTab) => void;
}

/**
 * Busca de telas do painel agrupado (Fase 4): botão no cabeçalho +
 * atalho Ctrl+K / Cmd+K. Índice estático derivado dos grupos visíveis
 * (constants.dashboardGroups já filtrados) + seções da aba Geral de
 * Configurações (settingsSections). Sem backend.
 */
export default function DashboardSearch({ groups, isPdvOnly, onNavigate }: DashboardSearchProps) {
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Buscar telas (Ctrl+K)"
        className="flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Buscar</span>
        <kbd className="hidden rounded border border-border bg-muted px-1 font-sans text-[9px] font-bold md:inline">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-lg">
          <DialogTitle className="sr-only">Buscar telas do painel</DialogTitle>
          <Command
            filter={(value, search) => (normalize(value).includes(normalize(search)) ? 1 : 0)}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CommandInput placeholder="Buscar telas e configurações…" />
            <CommandList>
              <CommandEmpty>Nenhuma tela encontrada.</CommandEmpty>
              {groups.map((group) => {
                const groupLabel = isPdvOnly && group.pdvLabel ? group.pdvLabel : group.label;
                return (
                  <CommandGroup key={group.key} heading={groupLabel}>
                    {group.subTabs.map((sub) => {
                      const Icon = sub.icon;
                      const label = isPdvOnly && sub.pdvLabel ? sub.pdvLabel : sub.label;
                      return (
                        <CommandItem
                          key={`${group.key}-${sub.key}`}
                          value={`${label} ${groupLabel}`}
                          onSelect={() => goTab(sub.key)}
                        >
                          <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{label}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground">{groupLabel}</span>
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
                    <span className="ml-auto text-[11px] text-muted-foreground">Configurações</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
