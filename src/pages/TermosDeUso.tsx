import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import termsMd from "@/content/legal/terms_v6_2.md?raw";

/**
 * Página pública dos Termos de Uso.
 * O conteúdo vem do markdown versionado em src/content/legal.
 */
export default function TermosDeUso() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-black text-foreground">Termos de Uso</h1>
        </div>
      </header>

      <article className="prose prose-sm mx-auto max-w-3xl px-4 py-6 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{termsMd}</ReactMarkdown>
      </article>
    </main>
  );
}
