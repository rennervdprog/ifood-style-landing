/**
 * Página pública da Política de Cookies (item 16 da auditoria).
 *
 * Reaproveita o §6 da Política de Privacidade v6.8 — não é texto novo
 * escrito do zero. A tabela lista só o que existe de verdade no site:
 * não há Google Analytics (nada de `_ga`).
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cookie, Settings2 } from "lucide-react";
import { requestOpenPreferences } from "@/lib/cookieConsent";

export default function PoliticaCookies() {
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
          <h1 className="text-base font-black text-foreground">Política de Cookies</h1>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-start gap-3 rounded-3xl border border-border bg-card p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Esta página explica o que o ItaSuper guarda no seu navegador ou aparelho,
            para que serve cada coisa e como você controla isso. A versão completa
            das regras de privacidade está na{" "}
            <a
              href="/politica-de-privacidade"
              className="font-bold text-primary underline underline-offset-2"
            >
              Política de Privacidade
            </a>{" "}
            (§6, versão 6.8).
          </p>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-black text-foreground">O que fica guardado</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-black uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Para que serve</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs font-bold">session</td>
                  <td className="px-4 py-3 text-muted-foreground">Manter você logado</td>
                  <td className="px-4 py-3">Essencial</td>
                  <td className="px-4 py-3 text-muted-foreground">Sessão</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs font-bold">cart</td>
                  <td className="px-4 py-3 text-muted-foreground">Preservar os itens do carrinho</td>
                  <td className="px-4 py-3">Essencial</td>
                  <td className="px-4 py-3 text-muted-foreground">7 dias</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs font-bold">prefs</td>
                  <td className="px-4 py-3 text-muted-foreground">Lembrar preferências (tema, cidade)</td>
                  <td className="px-4 py-3">Funcional</td>
                  <td className="px-4 py-3 text-muted-foreground">30 dias</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs font-bold">legal_version</td>
                  <td className="px-4 py-3 text-muted-foreground">Registrar a versão dos termos aceitos</td>
                  <td className="px-4 py-3">Essencial</td>
                  <td className="px-4 py-3 text-muted-foreground">1 ano</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs font-bold">itasuper_consent</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Registrar a sua escolha de cookies (necessários, analytics, marketing)
                  </td>
                  <td className="px-4 py-3">Funcional</td>
                  <td className="px-4 py-3 text-muted-foreground">1 ano</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Os cookies essenciais não podem ser desligados sem prejudicar o funcionamento:
            sem eles, não dá para manter a sessão nem o carrinho.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-black text-foreground">Medição de uso — só com a sua permissão</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            O ItaSuper <strong className="text-foreground">não usa Google Analytics</strong>.
            A medição de uso é feita só por duas ferramentas, e as duas só ligam quando
            você aceita a categoria <strong className="text-foreground">Analytics</strong>:
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li className="rounded-2xl border border-border bg-card px-4 py-3">
              <strong className="text-foreground">Firebase Analytics</strong> (aplicativo
              Android) — telas visitadas e eventos de uso, sem identificar você por nome,
              e-mail ou documento.
            </li>
            <li className="rounded-2xl border border-border bg-card px-4 py-3">
              <strong className="text-foreground">Vercel Analytics e Speed Insights</strong>{" "}
              (site) — páginas visitadas e velocidade de carregamento, de forma agregada.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Sem o seu consentimento, nenhuma das duas coleta nada — e o site e o aplicativo
            continuam funcionando normalmente. Recusar não muda nada no uso: pedidos,
            carrinho, login e acompanhamento continuam iguais.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-black text-foreground">Como mudar a sua escolha</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Você pode mudar a escolha a qualquer momento. Também dá para apagar ou bloquear
            cookies nas configurações do navegador ou do aparelho — isso pode impedir o
            funcionamento de recursos como login, carrinho e preferências.
          </p>
          <button
            type="button"
            onClick={requestOpenPreferences}
            className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"
          >
            <Settings2 className="h-4 w-4" />
            Gerenciar minhas preferências
          </button>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-black text-foreground">Notificações</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            As notificações push dependem da permissão no sistema operacional e podem ser
            desligadas nas configurações do aparelho ou do aplicativo. Desligar não impede
            o acesso à conta, mas você pode deixar de receber avisos de pedido, segurança
            ou alterações importantes.
          </p>
        </section>

        <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          ItaSuper — Renner Vinicius Dias (MEI), CNPJ 66.155.289/0001-26. Dúvidas sobre
          privacidade: Itasupersuporte@gmail.com ou WhatsApp +55 22 99279-6291.
          Versão 6.8 da Política de Privacidade, vigente a partir de 21 de novembro de 2026.
        </p>
      </article>
    </main>
  );
}
