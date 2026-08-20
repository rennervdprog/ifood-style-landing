import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, TrendingUp, Wallet, Shield, Users, Rocket, Info } from "lucide-react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Oferta vigente para novas indicações: Essencial a R$ 89,90 após o gatilho aplicável.
const AVG_MRR_PER_STORE = 89.90;
const COMMISSION = 0.20; // 20% vitalício
const BOUNTY = 50;

export default function SejaRevendedor() {
  const [stores, setStores] = useState<number[]>([10]);
  const n = stores[0];

  const monthly = useMemo(() => n * AVG_MRR_PER_STORE * COMMISSION, [n]);
  const bounty = useMemo(() => n * BOUNTY, [n]);
  const year1 = useMemo(() => monthly * 12 + bounty, [monthly, bounty]);

  const title = "Seja Revendedor ItaSuper — 20% vitalício + R$ 50 por loja";
  const description = "Ganhe 20% de comissão vitalícia sobre cada loja indicada + R$ 50 de bônus por ativação. Grátis para começar.";

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href={typeof window !== "undefined" ? `${window.location.origin}/seja-revendedor` : ""} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              { "@type": "Question", name: "Preciso pagar pra ser revendedor?", acceptedAnswer: { "@type": "Answer", text: "Não. O cadastro é gratuito e a aprovação sai em até 48h úteis." } },
              { "@type": "Question", name: "Quando recebo o bônus de R$ 50?", acceptedAnswer: { "@type": "Answer", text: "Quando a loja indicada atinge 20 pedidos entregues em até 30 dias e valida o WhatsApp." } },
              { "@type": "Question", name: "Qual o valor mínimo do saque?", acceptedAnswer: { "@type": "Answer", text: "R$ 100 via PIX, com cooldown de 7 dias entre solicitações." } },
              { "@type": "Question", name: "A comissão de 20% é para sempre?", acceptedAnswer: { "@type": "Answer", text: "Sim — enquanto a loja continuar ativa e pagando o plano, você recebe mensalmente." } },
            ],
          }),
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
              <Rocket className="h-3 w-3" /> Programa de revenda ItaSuper
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              Ganhe <span className="text-primary">20% vitalício</span> +<br className="hidden md:block" />
              R$ 50 por loja ativada
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Indique restaurantes, hamburguerias, pizzarias e boutiques pra usar o ItaSuper.
              Nós cobramos só quando a loja fatura. Você recebe todo mês, pra sempre.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/revendedor/cadastro">
                <Button size="lg" className="w-full sm:w-auto">Quero me cadastrar</Button>
              </Link>
              <a href="#calculadora">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">Simular ganhos</Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Sem mensalidade. Sem meta. Sem letras miúdas.</p>
          </div>
        </section>

        {/* Como você ganha — 3 estágios explícitos */}
        <section className="max-w-3xl mx-auto px-4 pt-10">
          <div className="rounded-2xl border bg-card p-5 md:p-6">
            <div className="flex items-start gap-2 mb-4">
              <Info className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <h2 className="text-lg font-bold">Como você ganha (passo a passo)</h2>
                <p className="text-xs text-muted-foreground">Sem letras miúdas — os 3 estágios do seu ganho por loja indicada.</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-600 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong>Bounty de R$ 50</strong> — pago após a loja indicada completar 20 pedidos entregues.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong>Loja em fase gratuita → R$ 0 de recorrente.</strong> Enquanto a loja ficar abaixo do GMV gratuito
                  de R$ 5.000 no período de análise do Essencial, a mensalidade é zero — logo, sua comissão recorrente também.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-green-500/15 text-green-600 text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <strong>Loja passou do GMV → 20% da mensalidade, todo mês.</strong> A partir do mês em que a loja começa
                  a pagar o plano, você recebe 20% do valor cobrado enquanto ela continuar ativa.
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* Diferenciais */}
        <section className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-4">
          {[
            { icon: <Wallet className="h-5 w-5 text-primary" />, title: "Comissão vitalícia", desc: "20% do MRR da loja indicada, todo mês, enquanto ela pagar o plano." },
            { icon: <TrendingUp className="h-5 w-5 text-primary" />, title: "Bônus de ativação", desc: "R$ 50 quando a loja atingir 20 pedidos entregues em 30 dias." },
            { icon: <Shield className="h-5 w-5 text-primary" />, title: "Grátis até faturar", desc: "No Essencial, a loja começa grátis e só pode ter mensalidade após o gatilho de R$ 5.000 no período de análise." },
            { icon: <Users className="h-5 w-5 text-primary" />, title: "Link exclusivo", desc: "Toda loja cadastrada no seu link fica vinculada permanentemente." },
            { icon: <CheckCircle2 className="h-5 w-5 text-primary" />, title: "Pagamento em PIX", desc: "Saque a partir de R$ 100. Pagamento manual em até 3 dias úteis." },
            { icon: <Rocket className="h-5 w-5 text-primary" />, title: "Materiais prontos", desc: "Ebook, scripts de WhatsApp e artes — tudo dentro do painel." },
          ].map((f, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">{f.icon}<CardTitle className="text-base">{f.title}</CardTitle></div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{f.desc}</CardContent>
            </Card>
          ))}
        </section>

        {/* Calculadora */}
        <section id="calculadora" className="bg-muted/30 border-y">
          <div className="max-w-3xl mx-auto px-4 py-12">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold">Simule sua renda</h2>
              <p className="text-sm text-muted-foreground">Baseado em ticket médio de {brl(AVG_MRR_PER_STORE)}/mês por loja.</p>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Lojas indicadas por ano</span>
                    <span className="text-sm font-semibold">{n}</span>
                  </div>
                  <Slider value={stores} onValueChange={setStores} min={1} max={50} step={1} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded bg-background">
                    <div className="text-xs text-muted-foreground">MRR ao final do ano</div>
                    <div className="text-xl font-bold text-primary">{brl(monthly)}</div>
                    <div className="text-[10px] text-muted-foreground">por mês, vitalício</div>
                  </div>
                  <div className="p-3 rounded bg-background">
                    <div className="text-xs text-muted-foreground">Bônus 1º ano</div>
                    <div className="text-xl font-bold">{brl(bounty)}</div>
                    <div className="text-[10px] text-muted-foreground">R$ 50 × ativações</div>
                  </div>
                  <div className="p-3 rounded bg-background">
                    <div className="text-xs text-muted-foreground">Total 1º ano</div>
                    <div className="text-xl font-bold text-green-600">{brl(year1)}</div>
                    <div className="text-[10px] text-muted-foreground">MRR × 12 + bônus</div>
                  </div>
                </div>
                <div className="text-center">
                  <Link to="/revendedor/cadastro">
                    <Button size="lg">Começar agora</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger>Preciso pagar pra ser revendedor?</AccordionTrigger>
              <AccordionContent>Não. Cadastro gratuito, aprovação em até 48h úteis.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Quando recebo o bônus de R$ 50?</AccordionTrigger>
              <AccordionContent>Quando a loja indicada atinge 20 pedidos entregues em 30 dias e valida o WhatsApp.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2b">
              <AccordionTrigger>Quando começo a receber a mensalidade (20%)?</AccordionTrigger>
              <AccordionContent>
                A partir do mês em que a loja indicada ultrapassa o GMV gratuito de R$ 5.000 no período de análise do Essencial
                e passa a pagar a mensalidade. Enquanto a loja estiver na faixa gratuita, a mensalidade é R$ 0 — e por isso a
                comissão recorrente também é R$ 0.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>E se a loja não vender?</AccordionTrigger>
              <AccordionContent>Sem problema — no Essencial, a loja começa grátis até o gatilho de R$ 5.000 no período de análise. A loja só passa a pagar quando cresce, e você ganha quando ela paga.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>Qual o valor mínimo do saque?</AccordionTrigger>
              <AccordionContent>R$ 100 via PIX, com cooldown de 7 dias entre saques.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5">
              <AccordionTrigger>A comissão é realmente vitalícia?</AccordionTrigger>
              <AccordionContent>Sim. Enquanto a loja continuar ativa e pagando o plano, você recebe 20% todo mês. Se ela cancelar, a comissão para — sem multas.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="q6">
              <AccordionTrigger>Existe checagem anti-fraude?</AccordionTrigger>
              <AccordionContent>Sim: auto-indicação é bloqueada automaticamente, e contas com mais de 30% de lojas fantasma passam por revisão.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* CTA final */}
        <section className="border-t bg-primary/5">
          <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold">Pronto pra começar?</h2>
            <p className="text-muted-foreground">Cadastro em 2 minutos. Aprovação em até 48h úteis.</p>
            <Link to="/revendedor/cadastro">
              <Button size="lg">Quero meu link de indicação</Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}