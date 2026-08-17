import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import privacyContent from "@/content/legal/privacy_v6_0.md?raw";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Política de Privacidade — ItaSuper</title>
        <meta
          name="description"
          content="Como o ItaSuper trata dados pessoais de clientes, lojistas e entregadores."
        />
        <link rel="canonical" href="https://itasuper.com.br/politica-de-privacidade" />
        <meta property="og:title" content="Política de Privacidade — ItaSuper" />
        <meta property="og:description" content="Informações sobre dados pessoais, direitos e segurança no ItaSuper." />
        <meta property="og:url" content="https://itasuper.com.br/politica-de-privacidade" />
      </Helmet>

      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="rounded-xl p-1.5 transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Política de Privacidade</h1>
        <span className="ml-auto text-xs text-muted-foreground">v6.0 · 17 ago. 2026</span>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <article className="prose prose-sm max-w-none text-muted-foreground prose-headings:text-foreground prose-a:text-primary prose-a:underline prose-strong:text-foreground prose-table:block prose-table:overflow-x-auto prose-th:text-foreground dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{privacyContent}</ReactMarkdown>
        </article>
      </main>
    </div>
  );
};

export default PoliticaPrivacidade;
