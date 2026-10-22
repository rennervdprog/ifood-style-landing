/**
 * Seções da aba Configurações → Geral (Fase 4 — âncoras "Nesta página"
 * e busca Ctrl+K). Fonte única da lista de seções: a faixa de âncoras do
 * SettingsTab, os `id`s renderizados nas seções e o índice da busca
 * leem daqui para nunca divergirem.
 */

export type SettingsSubTabKey = "loja" | "whatsapp" | "conversas" | "kds";

export interface SettingsSection {
  /** id estável do elemento no DOM (âncora) */
  id: string;
  label: string;
  /** sub-aba interna do SettingsTab onde a seção vive */
  subTab: SettingsSubTabKey;
  /** some em lojas PDV Only (sub-abas WhatsApp/Conversas não existem) */
  hideOnPdvOnly?: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "config-loja", label: "Loja e logo", subTab: "loja" },
  { id: "config-endereco", label: "Endereço", subTab: "loja" },
  { id: "config-entrega", label: "Entrega e taxas", subTab: "loja" },
  { id: "config-pagamentos", label: "Pagamentos", subTab: "loja" },
  { id: "config-whatsapp", label: "WhatsApp", subTab: "whatsapp", hideOnPdvOnly: true },
  { id: "config-conversas", label: "Conversas do WhatsApp", subTab: "conversas", hideOnPdvOnly: true },
  { id: "config-kds", label: "Display de Cozinha (KDS)", subTab: "kds" },
];

export const SETTINGS_GOTO_EVENT = "itasuper:settings-goto";

let pendingSectionId: string | null = null;

/**
 * Pede para o SettingsTab mostrar uma seção (usado pela busca Ctrl+K):
 * guarda a intenção e avisa quem já estiver montado; se o SettingsTab
 * montar depois (troca de aba), ele consome a intenção no mount.
 */
export function requestSettingsSection(id: string) {
  pendingSectionId = id;
  window.dispatchEvent(new CustomEvent(SETTINGS_GOTO_EVENT, { detail: id }));
}

export function consumePendingSettingsSection(): string | null {
  const id = pendingSectionId;
  pendingSectionId = null;
  return id;
}

/** Rola até o elemento, tentando de novo por ~2s (a seção pode montar logo após a troca de aba). */
export function scrollToElementById(id: string) {
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  };
  if (attempt()) return;
  let tries = 0;
  const iv = window.setInterval(() => {
    tries += 1;
    if (attempt() || tries >= 15) window.clearInterval(iv);
  }, 120);
}
