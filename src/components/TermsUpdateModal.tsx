/**
 * TermsUpdateModal — v3.0 — mobile-first
 * Bottom sheet em mobile, modal centrado em desktop
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  FileText, Shield, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle,
} from "lucide-react";

export const CURRENT_TERMS_VERSION = "4.4";

const CHANGES = [
  {
    section: "Termos de Uso",
    icon: FileText,
    color: "text-primary",
    bg: "bg-primary/8",
    border: "border-primary/20",
    items: [
      {
        tag: "CORREÇÃO",
        tagColor: "bg-amber-500",
        text: "Cláusula 2.2: cadastro de Lojista e Entregador agora exige 18 anos. Menores 16-17 podem usar apenas como Cliente, com assistência dos responsáveis.",
      },
      {
        tag: "CORREÇÃO",
        tagColor: "bg-amber-500",
        text: "Cláusula 8.2: corrigida a citação do Pix Automático para Resolução BCB nº 103/2024 (texto anterior citava nº 403/2024).",
      },
      {
        tag: "CORREÇÃO",
        tagColor: "bg-amber-500",
        text: "Cláusula 13.1: exclusão de responsabilidade não se aplica a violações de dados pessoais nem a falhas de segurança imputáveis ao ItaSuper.",
      },
      {
        tag: "AJUSTE",
        tagColor: "bg-amber-500",
        text: "Cláusula 12.2: licença de uso de marca pós-contrato reduzida de 90 para 30 dias, restrita à remoção de cache/backups e finalização de entregas pendentes (CDC, Art. 51).",
      },
      {
        tag: "AJUSTE",
        tagColor: "bg-muted-foreground",
        text: "Estrutura HTML da seção 10-A / 11 corrigida (Condutas Proibidas agora é seção independente).",
      },
    ],
  },
  {
    section: "Política de Privacidade",
    icon: Shield,
    color: "text-emerald-600",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/20",
    items: [
      {
        tag: "NOVO",
        tagColor: "bg-blue-500",
        text: "Seção 3: declarados novos operadores — Mercado Pago (residual), Sentry (monitoramento de erros) e OpenStreetMap/Nominatim (geocodificação de endereços).",
      },
      {
        tag: "NOVO",
        tagColor: "bg-blue-500",
        text: "Seção 1.2: Lojista reconhecido como controlador conjunto dos dados de seus clientes finais (LGPD).",
      },
      {
        tag: "ATUALIZADO",
        tagColor: "bg-amber-500",
        text: "Seção 8: transferência internacional reescrita com base em SCC da Comissão Europeia + SOC 2 / ISO 27001 (em vez de citar GDPR como framework).",
      },
      {
        tag: "ATUALIZADO",
        tagColor: "bg-muted-foreground",
        text: "Seção 10: incidentes de segurança passam a citar também a Resolução CD/ANPD nº 18/2024 (atuação do DPO).",
      },
    ],
  },
];

interface Props { onAccepted: () => void; }

export const TermsUpdateModal = ({ onAccepted }: Props) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<number | null>(0);
  const [checkedTerms, setCheckedTerms] = useState(false);
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const canAccept = checkedTerms && checkedPrivacy;

  const handleAccept = async () => {
    if (!canAccept || !user) return;
    setAccepting(true);
    try {
      const { error: insErr } = await supabase.from("terms_acceptance" as any).insert({
        user_id: user.id,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_TERMS_VERSION,
        user_agent: navigator.userAgent.slice(0, 200),
        accepted_at: new Date().toISOString(),
      });
      if (insErr) console.warn("[terms] insert error:", insErr);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ terms_version_accepted: CURRENT_TERMS_VERSION } as any)
        .eq("user_id", user.id);
      if (updErr) {
        console.error("[terms] profile update error:", updErr);
        toast.error("Erro ao salvar aceite: " + (updErr.message || "tente novamente"));
        return;
      }
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
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-foreground leading-tight">Termos atualizados</p>
              <p className="text-[11px] text-muted-foreground">Versão {CURRENT_TERMS_VERSION} · Junho 2026</p>
            </div>
            <span className="text-[10px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-1 rounded-full shrink-0">
              Obrigatório
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Novos métodos de pagamento (PIX Maquininha) e regras de repasse foram adicionados.
          </p>
        </div>

        {/* ── Scroll interno — ocupa espaço disponível ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 min-h-0">

          {/* Aviso LGPD */}
          <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Conforme a LGPD (Art. 8º), é necessário consentir com as novas versões antes de continuar.
            </p>
          </div>

          {/* Seções expansíveis */}
          {CHANGES.map((section, idx) => {
            const Icon = section.icon;
            const isOpen = expanded === idx;
            return (
              <div key={idx} className={`rounded-xl border ${section.border} overflow-hidden`}>
                <button
                  className={`w-full flex items-center gap-2.5 px-3.5 py-3 ${section.bg} text-left`}
                  onClick={() => setExpanded(isOpen ? null : idx)}>
                  <Icon className={`h-3.5 w-3.5 ${section.color} shrink-0`} />
                  <p className={`text-sm font-bold ${section.color} flex-1`}>{section.section}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {section.items.length} mudança{section.items.length > 1 ? "s" : ""}
                  </span>
                  {isOpen
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-3.5 py-3 space-y-3 bg-card/50">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`${item.tagColor} text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 mt-0.5`}>
                          {item.tag}
                        </span>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Links leitura completa */}
          <div className="flex gap-2">
            <a href="/termos" target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-muted/40 border border-border rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="h-3.5 w-3.5" /> Ler Termos
            </a>
            <a href="/privacidade" target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-muted/40 border border-border rounded-xl py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <Shield className="h-3.5 w-3.5" /> Ler Política
            </a>
          </div>
        </div>

        {/* ── Footer fixo — checkboxes + botão ── */}
        <div className="px-4 pt-3 pb-safe-bottom sm:pb-4 border-t border-border shrink-0 space-y-2.5"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>

          {/* Checkbox Termos */}
          <button
            onClick={() => setCheckedTerms(!checkedTerms)}
            className="w-full flex items-start gap-3 text-left">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              checkedTerms ? "bg-primary border-primary" : "bg-background border-border"
            }`}>
              {checkedTerms && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Li e aceito os{" "}
              <a href="/termos" target="_blank" rel="noopener noreferrer"
                className="font-bold text-primary underline underline-offset-2">
                Termos de Uso
              </a>{" "}
              versão {CURRENT_TERMS_VERSION}, incluindo razão social atualizada do Asaas, Encarregado de Dados (DPO) e correções de numeração.
            </p>
          </button>

          {/* Checkbox Privacidade */}
          <button
            onClick={() => setCheckedPrivacy(!checkedPrivacy)}
            className="w-full flex items-start gap-3 text-left">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              checkedPrivacy ? "bg-emerald-500 border-emerald-500" : "bg-background border-border"
            }`}>
              {checkedPrivacy && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Li e aceito a{" "}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer"
                className="font-bold text-emerald-600 underline underline-offset-2">
                Política de Privacidade
              </a>{" "}
              versão {CURRENT_TERMS_VERSION}.
            </p>
          </button>

          {/* Botão aceitar */}
          <button
            onClick={handleAccept}
            disabled={!canAccept || accepting}
            className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-2xl text-sm disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-1">
            {accepting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
              : <><CheckCircle2 className="h-4 w-4" /> Aceitar e continuar</>}
          </button>

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Consentimento registrado com data e hora conforme a LGPD (Lei nº 13.709/2018).
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsUpdateModal;
