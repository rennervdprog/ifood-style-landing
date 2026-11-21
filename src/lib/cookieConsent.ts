/**
 * Consentimento de cookies / analytics (itens 15 e 16 da auditoria).
 *
 * Fonte única de verdade da escolha do visitante:
 * - `localStorage` (chave `itasuper_consent`) — funciona para visitante
 *   anônimo e logado, sem depender de rede.
 * - Para usuário logado, a escolha é espelhada em `raw_user_meta_data`
 *   (`cookie_consent`) via `supabase.auth.updateUser` — melhor esforço,
 *   nunca bloqueia a escolha local. Não existe coluna dedicada em
 *   `profiles` ainda; quando houver migration para ela, o espelho passa
 *   a ser lá (ver `mirrorConsentToProfile`).
 *
 * Categorias:
 * - `necessary` — sempre ligado (sessão, carrinho, preferências, versão
 *   legal aceita). Desligar quebraria o login e o carrinho.
 * - `analytics` — Firebase Analytics (app nativo) + Vercel Analytics /
 *   Speed Insights (web). Só liga com consentimento explícito.
 * - `marketing` — reservado para o futuro (hoje não há pixel nem
 *   remarketing no site). O controle já existe para não precisar
 *   redesenhar o banner quando houver.
 *
 * Sem consentimento registrado, tudo que é opcional fica DESLIGADO e o
 * app funciona igual — o banner só aparece no primeiro acesso.
 */
import { supabase } from "@/integrations/supabase/client";

export const CONSENT_STORAGE_KEY = "itasuper_consent";
export const CONSENT_VERSION = 1;

/** Evento disparado sempre que a escolha muda (banner, página /cookies). */
export const CONSENT_CHANGED_EVENT = "itasuper:consent-changed";
/** Evento que pede a abertura do centro de preferências (ex.: link na /cookies). */
export const OPEN_PREFERENCES_EVENT = "itasuper:open-cookie-preferences";

export interface CookieConsent {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export const DEFAULT_CONSENT: CookieConsent = {
  version: CONSENT_VERSION,
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: "",
};

function parseStored(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

/** Lê a escolha salva, ou `null` quando o visitante ainda não escolheu. */
export function getConsent(): CookieConsent | null {
  try {
    return parseStored(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** `true` quando há uma escolha registrada (aceitou, recusou ou personalizou). */
export function hasConsentDecision(): boolean {
  return getConsent() !== null;
}

/** `true` só quando o visitante consentiu explicitamente com analytics. */
export function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics === true;
}

/** `true` só quando o visitante consentiu explicitamente com marketing. */
export function hasMarketingConsent(): boolean {
  return getConsent()?.marketing === true;
}

/**
 * Espelha a escolha no perfil do usuário logado (melhor esforço, sem
 * bloquear). Hoje vai para `raw_user_meta_data.cookie_consent`; se a
 * migration da coluna dedicada em `profiles` existir, o espelho passa
 * a ser feito lá — o `localStorage` continua sendo a fonte lida em
 * tempo de execução, então nada quebra enquanto a coluna não existe.
 */
async function mirrorConsentToProfile(consent: CookieConsent): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.auth.updateUser({
      data: { cookie_consent: consent },
    });
  } catch {
    // Consentimento local já está salvo; o espelho é prova adicional,
    // nunca motivo para falhar a escolha do usuário.
  }
}

/**
 * Salva a escolha (local + espelho no perfil, se logado) e avisa os
 * ouvintes — é o evento que liga/desliga o analytics em tempo real.
 */
export function saveConsent(choice: Omit<CookieConsent, "version" | "updatedAt">): CookieConsent {
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    necessary: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Armazenamento indisponível (modo privado restrito): a escolha vale
    // só para a sessão; o banner volta no próximo acesso.
  }
  void mirrorConsentToProfile(consent);
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
  return consent;
}

/** Atalho: aceitar tudo (necessários + analytics + marketing). */
export function acceptAllConsent(): CookieConsent {
  return saveConsent({ necessary: true, analytics: true, marketing: true });
}

/** Atalho: recusar tudo que é opcional (só necessários). */
export function rejectAllConsent(): CookieConsent {
  return saveConsent({ necessary: true, analytics: false, marketing: false });
}

/** Pede a abertura do centro de preferências onde quer que o banner esteja montado. */
export function requestOpenPreferences(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT));
}
