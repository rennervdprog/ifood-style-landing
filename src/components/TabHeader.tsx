interface TabHeaderProps {
  title: string;
  subtitle: string;
}

/**
 * Cabeçalho padrão das abas do painel: título + frase curta explicando
 * para que a aba serve (camada de explicação — Fase 1).
 */
export default function TabHeader({ title, subtitle }: TabHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
