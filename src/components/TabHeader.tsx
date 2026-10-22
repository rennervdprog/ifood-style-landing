import TutorialHelpButton from "./TutorialHelp";

interface TabHeaderProps {
  title: string;
  subtitle: string;
  /** id do tutorial existente (TutoriaisPanel) — exibe o botão "Como funciona" (Fase 4) */
  tutorialId?: string;
}

/**
 * Cabeçalho padrão das abas do painel: título + frase curta explicando
 * para que a aba serve (camada de explicação — Fase 1). Com `tutorialId`,
 * ganha a ação discreta "Como funciona" abrindo o tutorial da área (Fase 4).
 */
export default function TabHeader({ title, subtitle, tutorialId }: TabHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {tutorialId && (
        <div className="flex-shrink-0 pt-0.5">
          <TutorialHelpButton tutorialId={tutorialId} />
        </div>
      )}
    </div>
  );
}
