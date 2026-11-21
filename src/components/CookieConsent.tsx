/**
 * Banner de consentimento de cookies + centro de preferências
 * (item 15 da auditoria — LGPD).
 *
 * Comportamento:
 * - Aparece só no primeiro acesso (sem escolha registrada em
 *   `localStorage`, chave `itasuper_consent`). Depois da escolha, some
 *   e só reaparece pelo link "Cookies" do rodapé ou pelo botão
 *   "Gerenciar preferências" da página /cookies.
 * - "Aceitar tudo" liga analytics + marketing; "Recusar" deixa só os
 *   necessários; "Preferências" abre o centro com um interruptor por
 *   categoria (necessários sempre ligados e travados).
 * - Sem consentimento, nada de analytics — o app funciona igual.
 *
 * Visual: laranja ItaSuper (#FF6A00 via `text-primary`/`bg-primary`) +
 * neutros do tema. Nada de âmbar/amarelo.
 */
import { useCallback, useEffect, useState } from "react";
import { Cookie, Settings2, X } from "lucide-react";
import {
  acceptAllConsent,
  getConsent,
  hasConsentDecision,
  OPEN_PREFERENCES_EVENT,
  rejectAllConsent,
  saveConsent,
  type CookieConsent,
} from "@/lib/cookieConsent";

interface CategoryProps {
  title: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (checked: boolean) => void;
}

function CategoryRow({ title, description, checked, locked, onChange }: CategoryProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-muted/40 px-4 py-3">
      <div>
        <p className="text-sm font-black text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        {locked && (
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Sempre ativo
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={locked}
        onClick={() => onChange?.(!checked)}
        className={`mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        } ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const openPreferences = useCallback((saved: CookieConsent | null) => {
    setAnalytics(saved?.analytics ?? false);
    setMarketing(saved?.marketing ?? false);
    setShowPreferences(true);
    setVisible(true);
  }, []);

  useEffect(() => {
    // Só mostra no primeiro acesso: quem já escolheu não vê o banner.
    if (!hasConsentDecision()) setVisible(true);
    const onOpen = () => openPreferences(getConsent());
    window.addEventListener(OPEN_PREFERENCES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, onOpen);
  }, [openPreferences]);

  if (!visible) return null;

  const handleAcceptAll = () => {
    acceptAllConsent();
    setVisible(false);
    setShowPreferences(false);
  };

  const handleRejectAll = () => {
    rejectAllConsent();
    setVisible(false);
    setShowPreferences(false);
  };

  const handleSavePreferences = () => {
    saveConsent({ necessary: true, analytics, marketing });
    setVisible(false);
    setShowPreferences(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-5 shadow-[0_24px_64px_-24px_hsl(var(--foreground)/0.45)] sm:p-6">
        {!showPreferences ? (
          <>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Cookie className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-black text-foreground">A gente usa cookies</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Usamos cookies só para o site funcionar e, se você permitir, para entender
                  como ele é usado e melhorar. Sem a sua permissão, nada de medição — o site
                  continua funcionando do mesmo jeito.{" "}
                  <a href="/cookies" className="font-bold text-primary underline underline-offset-2">
                    Saiba mais
                  </a>
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-2 sm:items-center">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="h-14 sm:h-11 flex-1 rounded-xl bg-primary px-4 text-base sm:text-sm font-black text-primary-foreground"
              >
                Aceitar tudo
              </button>
              <button
                type="button"
                onClick={handleRejectAll}
                className="h-14 sm:h-11 flex-1 rounded-xl border-2 border-border bg-card px-4 text-base sm:text-sm font-black text-foreground"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={() => openPreferences(getConsent())}
                className="flex h-14 sm:h-11 items-center justify-center gap-2 rounded-xl px-4 text-base sm:text-sm font-bold text-muted-foreground hover:text-foreground max-sm:border-2 max-sm:border-border max-sm:bg-card max-sm:font-black max-sm:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
                Preferências
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-foreground">Preferências de cookies</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Escolha o que o ItaSuper pode usar. Você pode mudar isso quando quiser no
                  rodapé do site, em “Cookies”.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                aria-label="Voltar ao banner"
                className="rounded-lg p-3 sm:p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <CategoryRow
                title="Necessários"
                description="Mantêm você logado, guardam o carrinho e lembram suas preferências. Sem eles o site não funciona."
                checked
                locked
              />
              <CategoryRow
                title="Analytics"
                description="Medem como o site é usado (páginas visitadas, erros) para a gente melhorar. Só ligam com a sua permissão."
                checked={analytics}
                onChange={setAnalytics}
              />
              <CategoryRow
                title="Marketing"
                description="Serviriam para ofertas e campanhas. Hoje o ItaSuper não usa nenhum recurso de marketing — o controle já está aqui para quando houver."
                checked={marketing}
                onChange={setMarketing}
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="h-14 sm:h-11 flex-1 rounded-xl bg-primary px-4 text-base sm:text-sm font-black text-primary-foreground"
              >
                Salvar preferências
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="h-14 sm:h-11 flex-1 rounded-xl border-2 border-border bg-card px-4 text-base sm:text-sm font-black text-foreground"
              >
                Aceitar tudo
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Detalhes em{" "}
              <a href="/cookies" className="font-bold text-primary underline underline-offset-2">
                Política de Cookies
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
