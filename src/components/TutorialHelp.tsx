import { useState } from "react";
import { CircleHelp, Clock, MessageCircle, PlayCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openWhatsApp } from "@/lib/whatsapp";
import { SUPPORT_WHATSAPP, TUTORIAIS, TutorialStepsList, type TutorialSection } from "./TutoriaisPanel";

export function getTutorialSection(id: string): TutorialSection | undefined {
  return TUTORIAIS.find((t) => t.id === id);
}

interface TutorialHelpButtonProps {
  /** id da seção em TUTORIAIS (TutoriaisPanel) exibida no modal */
  tutorialId: string;
  className?: string;
}

/**
 * Botão discreto "Como funciona" (Fase 4 — ajuda no ponto da dúvida).
 * Abre um modal com o tutorial JÁ existente daquela área, reutilizando
 * os dados e a renderização de etapas do TutoriaisPanel — nenhum
 * conteúdo de ajuda novo é criado aqui. Se o id não existir, não renderiza.
 */
export default function TutorialHelpButton({ tutorialId, className = "" }: TutorialHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const section = getTutorialSection(tutorialId);
  if (!section) return null;
  const Icon = section.icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary ${className}`}
      >
        <CircleHelp className="h-4 w-4" />
        Como funciona
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 ${section.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`h-5 w-5 ${section.color}`} />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-base font-black tracking-tight">{section.title}</DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">{section.shortDesc}</DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-md">
                <PlayCircle className="h-3 w-3 text-primary" />
                {section.steps.length} etapas
              </span>
              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-md">
                <Clock className="h-3 w-3 text-primary" />
                {section.estimatedMinutes} min
              </span>
            </div>
          </DialogHeader>

          <div className="space-y-2">
            <TutorialStepsList section={section} />
          </div>

          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="text-[11px] text-muted-foreground">
              Todos os tutoriais ficam no botão <strong>?</strong> no topo do painel.
            </p>
            <button
              type="button"
              onClick={() =>
                openWhatsApp(
                  SUPPORT_WHATSAPP,
                  `Olá! Preciso de ajuda com o painel do lojista do ItaSuper. Estou na tela: ${section.title}.`,
                )
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              Ainda com dúvida? Falar com o suporte
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
