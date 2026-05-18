/**
 * TermsUpdateModal
 * Exibido quando o usuário logado ainda não aceitou a versão atual
 * dos Termos de Uso e Política de Privacidade.
 *
 * Mostra um resumo do que mudou (diff) e exige aceite antes de continuar.
 * Registra na tabela terms_acceptance e atualiza profiles.terms_version_accepted.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText, Shield, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle,
} from "lucide-react";

// ─── Versão atual do sistema ──────────────────────────────────────────────────
export const CURRENT_TERMS_VERSION = "3.0";

// ─── O que mudou da v1.0 → v2.0 ─────────────────────────────────────────────
const CHANGES = [
  {
    section: "Termos de Uso",
    icon: FileText,
    color: "text-primary",
    bg: "bg-primary/8",
    border: "border-primary/20",
    items: [
      {
        tag: "NOVO",
        tagColor: "bg-blue-500",
        text: "Cláusula 4-A — Canal de Suporte ao Usuário: sistema de tickets digitais com prazo de resposta de 2 dias úteis e rastreabilidade dos agentes.",
      },
      {
        tag: "NOVO",
        tagColor: "bg-blue-500",
        text: "Cláusula 10-A — Prevenção a Fraudes: pedidos podem ser bloqueados automaticamente se o endereço estiver em cidade diferente da loja.",
      },
      {
        tag: "ATUALIZADO",
        tagColor: "bg-amber-500",
        text: "Plano Apoiador: agora detalha as taxas fixas (R$ 1,99/PIX, R$ 2,00/entrega, R$ 1,00/venda PDV) — antes apenas constava '0% comissão'.",
      },
      {
        tag: "ATUALIZADO",
        tagColor: "bg-amber-500",
        text: "Item 9.2 — Taxa PDV: Essencial e Apoiador têm taxa fixa de R$ 1,00 por venda presencial (não comissão percentual).",
      },
      {
        tag: "NOVO",
        tagColor: "bg-blue-500",
        text: "Item 4.2 — Serviços: inclusão do sistema de suporte via tickets e do Sales Coach (IA de recomendação para lojistas).",
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
        text: "Seção 1 — Dados coletados: incluídos dados de suporte (tickets abertos, mensagens trocadas com agentes, categoria e prioridade dos chamados).",
      },
      {
        tag: "NOVO",
        tagColor: "bg-blue-500",
        text: "Seção 2 — Finalidades: uso de dados pelo Sales Coach (IA) para recomendações. Pode ser desativado nas configurações da conta.",
      },
      {
        tag: "NOVO",
        tagColor: "bg-blue-500",
        text: "Seção 4 — Retenção: dados de suporte (tickets e mensagens) mantidos por até 2 anos após encerramento do ticket.",
      },
    ],
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
interface Props {
  onAccepted: () => void;
}

export const TermsUpdateModal = ({ onAccepted }: Props) => {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [checkedTerms, setCheckedTerms] = useState(false);
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const canAccept = checkedTerms && checkedPrivacy;

  const handleAccept = async () => {
    if (!canAccept || !user) return;
    setAccepting(true);
    try {
      // Registrar aceite na tabela de histórico
      await supabase.from("terms_acceptance" as any).insert({
        user_id: user.id,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_TERMS_VERSION,
        user_agent: navigator.userAgent.slice(0, 200),
        accepted_at: new Date().toISOString(),
      });

      // Atualizar versão aceita no profile
      await supabase
        .from("profiles")
        .update({ terms_version_accepted: CURRENT_TERMS_VERSION } as any)
        .eq("user_id", user.id);

      toast.success("Termos aceitos. Obrigado!");
      onAccepted();
    } catch (e: any) {
      toast.error("Erro ao registrar aceite. Tente novamente.");
      console.error(e);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Overlay escuro — não fecha ao clicar (aceite obrigatório) */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full sm:max-w-lg max-h-[92vh] bg-background rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-base font-black text-foreground">Termos Atualizados</p>
              <p className="text-xs text-muted-foreground">Versão 2.0 · 13 de maio de 2026</p>
            </div>
            <span className="ml-auto text-[10px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-1 rounded-full">
              Aceite obrigatório
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Atualizamos nossos Termos de Uso e Política de Privacidade (versão 3.0 — maio/2025).
            Principais mudanças: PIX Maquininha, cobrança de repasse toda segunda-feira a partir de R$30, e bloqueio por inadimplência acima de R$150.
          </p>
        </div>

        {/* ── Conteúdo com scroll ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Aviso legal */}
          <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-2xl px-3.5 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              De acordo com a LGPD (Art. 8º), você precisa consentir explicitamente
              com as novas versões antes de continuar usando a plataforma.
            </p>
          </div>

          {/* Seções de mudanças */}
          {CHANGES.map((section, idx) => {
            const Icon = section.icon;
            const isOpen = expanded === idx;
            return (
              <div key={idx}
                className={`rounded-2xl border ${section.border} overflow-hidden`}>
                {/* Cabeçalho da seção */}
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 ${section.bg} text-left`}
                  onClick={() => setExpanded(isOpen ? null : idx)}>
                  <Icon className={`h-4 w-4 ${section.color} shrink-0`} />
                  <p className={`text-sm font-bold ${section.color} flex-1`}>
                    {section.section}
                  </p>
                  <span className="text-[10px] text-muted-foreground mr-1">
                    {section.items.length} mudança{section.items.length > 1 ? "s" : ""}
                  </span>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Lista de mudanças */}
                {isOpen && (
                  <div className="px-4 py-3 space-y-3 bg-card/50">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`${item.tagColor} text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 mt-0.5`}>
                          {item.tag}
                        </span>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Links para leitura completa */}
          <div className="flex gap-2">
            <a href="/termos" target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-muted/40 border border-border rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <FileText className="h-3.5 w-3.5" />
              Ler Termos completos
            </a>
            <a href="/privacidade" target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-muted/40 border border-border rounded-xl py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <Shield className="h-3.5 w-3.5" />
              Ler Política completa
            </a>
          </div>
        </div>

        {/* ── Footer com checkboxes e botão ── */}
        <div className="px-5 pt-3 pb-6 border-t border-border shrink-0 space-y-3">
          {/* Checkbox Termos */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => setCheckedTerms(!checkedTerms)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
                checkedTerms
                  ? "bg-primary border-primary"
                  : "bg-background border-border"
              }`}>
              {checkedTerms && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Li e aceito os{" "}
<a href="/termos" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline underline-offset-2">Termos de Uso</a>{" "}
              versão 2.0, incluindo as novas cláusulas sobre suporte, antifraude e IA.
            </p>
          </label>

          {/* Checkbox Privacidade */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => setCheckedPrivacy(!checkedPrivacy)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
                checkedPrivacy
                  ? "bg-emerald-500 border-emerald-500"
                  : "bg-background border-border"
              }`}>
              {checkedPrivacy && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Li e aceito a{" "}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-600 underline underline-offset-2">Política de Privacidade</a>{" "}
              versão 2.0, incluindo coleta de dados de suporte e uso pelo Sales Coach.
            </p>
          </label>

          {/* Botão de aceite */}
          <button
            onClick={handleAccept}
            disabled={!canAccept || accepting}
            className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-2xl text-sm disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            {accepting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
              : <><CheckCircle2 className="h-4 w-4" /> Aceitar e continuar</>}
          </button>

          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Ao aceitar, seu consentimento será registrado com data, hora e versão
            conforme exigido pela LGPD (Lei nº 13.709/2018).
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsUpdateModal;
