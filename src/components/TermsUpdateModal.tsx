/**
 * TermsUpdateModal — v5.0 — diff dinâmico com aviso prévio
 *
 * Bottom sheet em mobile, modal em desktop. Renderiza SOMENTE as mudanças
 * entre a versão aceita pelo usuário e a versão atual (vindas do banco), e
 * apenas as que dizem respeito ao papel dele.
 *
 * Dois modos:
 *
 * - `notice`  — a versão foi publicada com vigência futura. É o aviso prévio de
 *   30 dias que os Termos prometem nas cláusulas 6.2 e 6.3. Não bloqueia: dá
 *   para fechar, adiar e continuar usando, e há o caminho de sair sem multa.
 * - `binding` — a vigência chegou. Aí sim bloqueia até aceitar.
 *
 * Em ambos os modos existe a recusa explícita. Consentimento sob bloqueio total
 * e sem saída não é consentimento livre (LGPD, art. 8º, §4º).
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  FileText, Shield, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, X, CalendarClock, LogOut,
} from "lucide-react";
import {
  LegalChange,
  PendingLegalChanges,
  recordLegalAcceptance,
} from "@/lib/legalDocuments";

// Mantido por compatibilidade — o App.tsx ainda importa esta constante.
// O versionamento real agora vive no banco (legal_documents.is_current).
export const CURRENT_TERMS_VERSION = "dynamic";

const CHANGE_TAG: Record<LegalChange["change_type"], { label: string; color: string }> = {
  added: { label: "NOVO", color: "bg-blue-500" },
  modified: { label: "ATUALIZADO", color: "bg-amber-500" },
  removed: { label: "REMOVIDO", color: "bg-rose-500" },
  fix: { label: "CORREÇÃO", color: "bg-muted-foreground" },
};

interface Props {
  pending: PendingLegalChanges;
  onAccepted: () => void;
  /** Adiar — só existe no modo aviso, quando a versão ainda não é vigente. */
  onDismiss?: () => void;
}

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;

export const TermsUpdateModal = ({ pending, onAccepted, onDismiss }: Props) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<number | null>(0);
  const [checkedTerms, setCheckedTerms] = useState(!pending.needs_terms);
  const [checkedPrivacy, setCheckedPrivacy] = useState(!pending.needs_privacy);
  const [accepting, setAccepting] = useState(false);
  const [showRefuse, setShowRefuse] = useState(false);

  const termsVer = pending.current_terms_version || "—";
  const privacyVer = pending.current_privacy_version || "—";
  const isNotice = pending.mode === "notice";
  const daysLeft = pending.days_until_effective ?? 0;
  const effectiveOn =
    formatDate(pending.terms_effective_date) || formatDate(pending.privacy_effective_date);
  const canAccept =
    (!pending.needs_terms || checkedTerms) &&
    (!pending.needs_privacy || checkedPrivacy);

  const sections = [
    pending.needs_terms && {
      kind: "terms" as const,
      title: "Termos de Uso",
      version: termsVer,
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/8",
      border: "border-primary/20",
      changes: pending.terms_changes,
    },
    pending.needs_privacy && {
      kind: "privacy" as const,
      title: "Política de Privacidade",
      version: privacyVer,
      icon: Shield,
      color: "text-emerald-600",
      bg: "bg-emerald-500/8",
      border: "border-emerald-500/20",
      changes: pending.privacy_changes,
    },
  ].filter(Boolean) as Array<{
    kind: "terms" | "privacy";
    title: string;
    version: string;
    icon: typeof FileText;
    color: string;
    bg: string;
    border: string;
    changes: LegalChange[];
  }>;

  const handleAccept = async () => {
    if (!canAccept || !user) return;
    setAccepting(true);
    try {
      await recordLegalAcceptance(user.id, termsVer, privacyVer, isNotice ? "notice" : "binding");
      toast.success("Termos aceitos. Obrigado!");
      onAccepted();
    } catch (e: any) {
      console.error("[terms] exception:", e);
      toast.error("Erro ao registrar aceite: " + (e?.message || "tente novamente"));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:items-center sm:justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/*
        Mobile: bottom sheet com altura máxima de 90vh, scroll interno
        Desktop: modal centrado, largura máxima 480px
      */}
      <div className="relative w-full sm:max-w-[480px] sm:mx-4 flex flex-col bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl"
        style={{ maxHeight: "90dvh" }}>

        {/* ── Handle (mobile) ── */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* ── Header ── */}
        <div className="px-4 pt-2 pb-3 sm:pt-4 sm:pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isNotice ? "bg-sky-500/10" : "bg-primary/10"}`}>
              {isNotice
                ? <CalendarClock className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
                : <FileText className="h-4.5 w-4.5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-foreground leading-tight">
                {isNotice ? "Nossos termos vão mudar" : "Termos atualizados"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Termos v{termsVer} · Privacidade v{privacyVer}
              </p>
            </div>
            {isNotice ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2 py-1 rounded-full">
                  Aviso prévio
                </span>
                {onDismiss && (
                  <button onClick={onDismiss} aria-label="Fechar aviso"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[10px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-1 rounded-full shrink-0">
                Obrigatório
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {isNotice
              ? <>Estas mudanças passam a valer{effectiveOn ? <> em <strong className="text-foreground">{effectiveOn}</strong></> : " em breve"}
                  {daysLeft > 0 && <> — faltam <strong className="text-foreground">{daysLeft} dia{daysLeft !== 1 ? "s" : ""}</strong></>}.
                  Você pode continuar usando normalmente até lá. Veja abaixo o que muda.</>
              : "Veja abaixo somente o que mudou desde o seu último aceite."}
          </p>
        </div>

        {/* ── Scroll interno — ocupa espaço disponível ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 min-h-0">

          {/* Aviso LGPD / aviso prévio */}
          {isNotice ? (
            <div className="flex items-start gap-2 bg-sky-500/8 border border-sky-500/20 rounded-xl px-3 py-2.5">
              <CalendarClock className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-sky-700 dark:text-sky-400 leading-relaxed">
                Este é o aviso prévio que prometemos nos Termos. Nada muda para você agora: as condições
                atuais valem até a data acima, e nenhuma alteração é retroativa. Se não concordar, você pode
                sair sem multa antes da vigência.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Conforme a LGPD (Art. 8º), é necessário consentir com as novas versões antes de continuar.
              </p>
            </div>
          )}

          {/* Seções expansíveis — só renderiza o que de fato mudou */}
          {sections.map((section, idx) => {
            const Icon = section.icon;
            const isOpen = expanded === idx;
            return (
              <div key={idx} className={`rounded-xl border ${section.border} overflow-hidden`}>
                <button
                  className={`w-full flex items-center gap-2.5 px-3.5 py-3 ${section.bg} text-left`}
                  onClick={() => setExpanded(isOpen ? null : idx)}>
                  <Icon className={`h-3.5 w-3.5 ${section.color} shrink-0`} />
                  <p className={`text-sm font-bold ${section.color} flex-1`}>
                    {section.title} <span className="text-muted-foreground font-normal">v{section.version}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {section.changes.length} mudança{section.changes.length !== 1 ? "s" : ""}
                  </span>
                  {isOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-3.5 py-3 space-y-3 bg-card/50">
                    {section.changes.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Sem detalhes registrados.</p>
                    )}
                    {section.changes.map((c, i) => {
                      const tag = CHANGE_TAG[c.change_type];
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`${tag.color} text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 mt-0.5`}>
                            {tag.label}
                          </span>
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground/70 font-semibold mb-0.5">
                              v{c.version} · {c.section}
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{c.summary}</p>
                            {c.legal_basis && (
                              <p className="text-[10px] text-primary/70 mt-1 font-medium">📖 {c.legal_basis}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Links leitura completa */}
          <div className="flex gap-2">
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-muted/40 border border-border rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="h-3.5 w-3.5" /> Ler Termos
            </a>
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-muted/40 border border-border rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <Shield className="h-3.5 w-3.5" /> Ler Política
            </a>
          </div>
        </div>

        {/* ── Footer fixo — checkboxes + botão ── */}
        <div className="px-4 pt-3 pb-safe-bottom sm:pb-4 border-t border-border shrink-0 space-y-2.5"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>

          {pending.needs_terms && (
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setCheckedTerms(!checkedTerms)}
                aria-pressed={checkedTerms}
                aria-label="Confirmar aceite dos Termos de Uso"
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  checkedTerms ? "bg-primary border-primary" : "bg-background border-border"
                }`}
              >
                {checkedTerms && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
              </button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Li e aceito os{" "}
                <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline underline-offset-2">
                  Termos de Uso
                </a>{" "}
                versão {termsVer}.
              </p>
            </div>
          )}

          {pending.needs_privacy && (
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setCheckedPrivacy(!checkedPrivacy)}
                aria-pressed={checkedPrivacy}
                aria-label="Confirmar aceite da Política de Privacidade"
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  checkedPrivacy ? "bg-emerald-500 border-emerald-500" : "bg-background border-border"
                }`}
              >
                {checkedPrivacy && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              </button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Li e aceito a{" "}
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-600 underline underline-offset-2">
                  Política de Privacidade
                </a>{" "}
                versão {privacyVer}.
              </p>
            </div>
          )}

          {/* Botão aceitar */}
          <button
            onClick={handleAccept}
            disabled={!canAccept || accepting}
            className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-2xl text-sm disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-1">
            {accepting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
              : <><CheckCircle2 className="h-4 w-4" /> {isNotice ? "Aceitar desde já" : "Aceitar e continuar"}</>}
          </button>

          {/* Adiar — só no aviso prévio, quando ainda não é obrigatório */}
          {isNotice && onDismiss && (
            <button
              onClick={onDismiss}
              className="w-full py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
              Ver depois
            </button>
          )}

          {/* Recusa explícita — consentimento sem saída não é livre */}
          {!showRefuse ? (
            <button
              onClick={() => setShowRefuse(true)}
              className="w-full py-1.5 text-[11px] font-semibold text-muted-foreground/80 underline underline-offset-2 hover:text-foreground transition-colors">
              Não concordo com as mudanças
            </button>
          ) : (
            <div className="bg-muted/40 border border-border rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isNotice
                  ? "Você pode encerrar sua conta antes da data de vigência, sem multa de rescisão — só ficam devidos os valores de serviços já prestados. Seus dados podem ser exportados ou excluídos a qualquer momento."
                  : "Sem o aceite não é possível seguir usando a conta, porque o serviço passa a ser prestado sob as novas condições. Você pode encerrar a conta e pedir a exclusão dos seus dados, ou falar com o suporte antes de decidir."}
              </p>
              <div className="flex flex-col gap-1.5">
                <a href="/perfil" className="flex items-center justify-center gap-1.5 bg-background border border-border rounded-lg py-2 text-[11px] font-bold text-foreground hover:bg-muted transition-colors">
                  <LogOut className="h-3 w-3" /> Meus dados e exclusão de conta
                </a>
                <a
                  href="https://wa.me/5522992796291"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-background border border-border rounded-lg py-2 text-[11px] font-bold text-foreground hover:bg-muted transition-colors">
                  Falar com o suporte
                </a>
                <button
                  onClick={() => setShowRefuse(false)}
                  className="py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  Voltar
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Consentimento registrado com data e hora conforme a LGPD (Lei nº 13.709/2018).
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsUpdateModal;
