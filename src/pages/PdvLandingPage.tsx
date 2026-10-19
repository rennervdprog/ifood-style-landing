import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, X, ShieldCheck, WifiOff, Receipt, ChefHat, Lock, BarChart3, Users, ArrowRight, MessageCircle } from "lucide-react";

const FAQS = [
  {
    q: "É caro?",
    a: "Menos de R$ 4 por dia. E considere: perdas médias no varejo são de 1,5% do faturamento em erros e desvios — numa loja de R$ 20 mil/mês, R$ 300 somem todo mês. O PDV se paga só no controle.",
  },
  {
    q: "Sou ruim com tecnologia. Vou conseguir usar?",
    a: "Sim. Nada para instalar — abre no navegador. Vender é tocar no produto e escolher a forma de pagamento. E no teste grátis, a gente configura tudo com você no WhatsApp.",
  },
  {
    q: "Meu caderno já funciona. Por que mudar?",
    a: "Até o dia em que o dinheiro não bate. O caderno não registra quem vendeu, não dá baixa no estoque e não mostra sobra ou falta por turno. Segundo o SEBRAE, 42% das empresas que fecharam não acompanhavam receitas e despesas.",
  },
  {
    q: "E se a internet cair no meio do rush?",
    a: "Você continua vendendo. O PDV tem modo offline de verdade: as vendas entram na fila e sincronizam sozinhas quando a internet volta — sem duplicar.",
  },
  {
    q: "Como funciona a ficha técnica?",
    a: "Você cadastra os ingredientes de cada prato uma vez (ex: marmita = 150g de arroz + 100g de feijão + 120g de frango). A cada venda, o sistema desconta automaticamente do estoque e avisa quando algo zera. E nunca trava a venda por isso.",
  },
  {
    q: "Tem fidelidade ou multa?",
    a: "Não. Sem fidelidade, sem multa, sem taxa de adesão. Cancele quando quiser — e seus dados são exportáveis.",
  },
  {
    q: "Serve para o meu tipo de comércio?",
    a: "Restaurantes, lanchonetes, padarias, pizzarias, mercadinhos, sorveterias, cafeterias e lojas de roupa (com modo vestuário: grade tamanho × cor, vales-troca e etiquetas com código de barras). O sistema também gerencia mesas e comandas.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Tudo em nuvem com backup automático — se o computador quebrar, nada se perde. E você pode exportar seus dados quando quiser.",
  },
];

const FEATURES = [
  {
    num: "1",
    icon: Receipt,
    title: "Venda em segundos, do jeito do balcão",
    desc: "Tocar no produto, escolher a forma de pagamento, receber. O troco calcula sozinho — e se o cliente quiser dividir a conta, o sistema divide por pessoa.",
    bullets: [
      "Troco automático — painel verde \"Troco\" / vermelho \"Falta\"",
      "Dividir por pessoa — a conta racha em até 12 partes, cada um paga como quiser",
      "Atalhos de teclado — F2 busca, F8 finaliza, F10 fecha o caixa",
      "Leitor de código de barras USB funciona direto",
    ],
  },
  {
    num: "2",
    icon: ChefHat,
    title: "Ficha técnica: sua receita vira estoque",
    desc: "Cadastre os ingredientes uma vez. A cada marmita vendida, arroz, feijão e frango descontam sozinhos — na medida certa. PDV comum só controla o produto final.",
    bullets: [
      "Baixa automática de ingredientes a cada venda",
      "Alerta na hora quando o ingrediente zera ou fica baixo",
      "Unidades: g, kg, ml, L ou un — com conversão automática",
      "Nunca trava a venda — só avisa, você decide",
    ],
  },
  {
    num: "3",
    icon: Lock,
    title: "Fechamento de caixa à prova de desvio",
    desc: "Em 4 passos guiados: conta o dinheiro, confere com o esperado, o gerente autoriza. E no modo cego, o operador conta sem ver o valor esperado — sem viés, sem \"ajeitadinha\".",
    bullets: [
      "Fechamento cego anti-fraude — conta sem ver o esperado",
      "Contagem por cédula e moeda — o sistema soma sozinho",
      "Mostra \"Sobra\" ou \"Falta\" por turno e por operador",
      "Sangria com limite — acima do limite, só com PIN do gerente",
    ],
  },
  {
    num: "4",
    icon: WifiOff,
    title: "Vende até sem internet",
    desc: "Caiu a internet no meio do rush? Continua vendendo. As vendas ficam na fila e sincronizam sozinhas quando volta — sem duplicar nada.",
    bullets: [
      "Modo offline real — fila de até 200 vendas",
      "Sincronização automática, sem duplicar",
      "Indicador Online/Offline sempre visível",
    ],
  },
];

const SECURITY_ITEMS = [
  { icon: Users, title: "PIN por operador", desc: "Cada funcionário tem o seu. Sessão expira em 8h." },
  { icon: ShieldCheck, title: "Anti-força-bruta", desc: "5 PINs errados = bloqueio de 15 minutos." },
  { icon: Lock, title: "Fechamento cego", desc: "Operador conta sem ver o valor esperado." },
  { icon: Receipt, title: "Cancelamento auditado", desc: "Motivo obrigatório + PIN do gerente + comprovante." },
  { icon: BarChart3, title: "Sangria controlada", desc: "Limite por loja; acima dele, só o gerente autoriza." },
  { icon: Check, title: "Auditoria completa", desc: "Quem cancelou, quem autorizou, quando e quanto." },
];

const PRICE_FEATURES = [
  "Frente de caixa completa",
  "Estoque com baixa automática",
  "Ficha técnica de ingredientes",
  "Fechamento de caixa anti-fraude",
  "Operadores com PIN + auditoria",
  "Relatórios: curva ABC, horário de pico, ranking por operador",
  "Modo offline",
  "Mesas e comandas",
];

function PhoneMock() {
  return (
    <div className="bg-neutral-900 rounded-[2rem] p-3 shadow-2xl max-w-[320px] w-full mx-auto">
      <div className="bg-white rounded-[1.6rem] overflow-hidden flex flex-col min-h-[540px]">
        <div className="bg-primary text-white px-5 py-4">
          <p className="text-[11px] opacity-80 uppercase tracking-wide">ItaSuper PDV · Turno manhã</p>
          <h3 className="text-xl font-extrabold">Nova venda</h3>
        </div>
        <div className="p-4 flex-1 bg-neutral-50 space-y-2.5">
          <div className="bg-white rounded-xl px-3.5 py-3 flex justify-between items-center shadow-sm text-sm">
            <span>🍗 Marmita P — Frango</span><b>R$ 18,00</b>
          </div>
          <div className="bg-white rounded-xl px-3.5 py-3 flex justify-between items-center shadow-sm text-sm">
            <span>🧃 Suco natural 500ml</span><b>R$ 8,00</b>
          </div>
          <div className="bg-white rounded-xl px-3.5 py-3 flex justify-between items-center shadow-sm text-sm">
            <span>🏷️ Desconto 5%</span><b className="text-green-600">−R$ 1,30</b>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between text-sm text-muted-foreground py-0.5"><span>Subtotal</span><span>R$ 26,00</span></div>
            <div className="flex justify-between text-sm text-muted-foreground py-0.5"><span>Desconto</span><span>−R$ 1,30</span></div>
            <div className="flex justify-between text-xl font-extrabold mt-2 pt-2 border-t-2 border-dashed"><span>Total</span><span>R$ 24,70</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {["💵 Dinheiro", "⚡ Pix", "💳 Crédito", "💳 Débito"].map((m, i) => (
              <div key={m} className={`rounded-xl py-3 text-center text-sm font-bold border-2 ${i === 1 ? "border-green-500 bg-green-50 text-green-700" : "bg-white border-neutral-200"}`}>{m}</div>
            ))}
          </div>
        </div>
        <div className="bg-primary text-white text-center font-extrabold text-lg py-4">Receber R$ 24,70 →</div>
      </div>
    </div>
  );
}

// SEO da página é gerenciado via <RouteMeta path={ROUTES.public.pdv} /> na rota
// (src/routes/domains/public.routes.tsx + src/routes/meta.tsx).
// NÃO renderizar <title>/<meta>/<link>/<script> crus aqui — causa React error #60.
export default function PdvLandingPage() {
  return (
    <>
      <div className="min-h-screen bg-white text-neutral-900 antialiased">
        {/* NAV */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-orange-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 font-extrabold text-xl">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-orange-700 text-white flex items-center justify-center font-black text-base shadow-md">iS</span>
              ItaSuper <span className="text-primary">PDV</span>
            </Link>
            <div className="flex items-center gap-3">
              <a href="#preco" className="hidden sm:inline-flex"><Button variant="outline" size="sm">Ver preço</Button></a>
              <Link to="/cadastro-lojista"><Button size="sm">Testar grátis</Button></Link>
            </div>
          </div>
        </nav>

        {/* 1. HERO */}
        <header className="py-12 sm:py-16 md:py-20 bg-[radial-gradient(1000px_500px_at_50%_-100px,#FFE9D2_0%,#fff_60%)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div className="text-center md:text-left">
              <span className="inline-block bg-neutral-900 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-5">🖥️ SISTEMA PDV PARA O PEQUENO COMÉRCIO</span>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-5">
                O caixa da sua loja sob controle por <span className="text-primary">R$ 120/mês.</span> Sem taxa por venda.
              </h1>
              <p className="text-lg text-muted-foreground mb-6 max-w-xl mx-auto md:mx-0">
                Frente de caixa no navegador, <b className="text-neutral-900">estoque que baixa sozinho</b> e fechamento de caixa à prova de desvio. <b className="text-neutral-900">Venda em segundos</b> — do jeito que o balcão pede.
              </p>
              <div className="inline-flex flex-wrap items-center justify-center md:justify-start gap-2.5 bg-green-50 border-[1.5px] border-green-200 rounded-2xl px-5 py-3 mb-6 font-bold">
                <span className="line-through text-muted-foreground font-medium text-sm sm:text-base">PDVs completos: R$ 200–400/mês</span>
                <span className="text-2xl text-green-600">R$ 120 fixos</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link to="/cadastro-lojista"><Button size="lg" className="w-full sm:w-auto text-base px-8">Testar grátis agora <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
              </div>
              <p className="text-[13px] text-muted-foreground mt-3">Sem cartão de crédito · Sem instalar nada · Funciona no celular</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-sm font-semibold text-muted-foreground justify-center md:justify-start">
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" strokeWidth={3} /> Sem instalar nada</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" strokeWidth={3} /> R$ 0 por venda</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" strokeWidth={3} /> Vende até sem internet</span>
              </div>
            </div>
            <div><PhoneMock /></div>
          </div>
        </header>

        {/* 2. DOR */}
        <section className="py-16 md:py-20 bg-neutral-900 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center mb-4">Chega de adivinhar para onde foi o dinheiro do caixa.</h2>
            <p className="text-center text-neutral-400 max-w-2xl mx-auto mb-10 md:mb-12 text-base sm:text-lg">
              Perdas no varejo somem <b className="text-orange-300">1,5% do faturamento todo ano</b> em erros e desvios. Numa loja de R$ 20 mil/mês, são <b className="text-orange-300">R$ 300 jogados fora</b> — quase 3x o preço deste PDV.
            </p>
            <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              <div className="rounded-2xl p-6 sm:p-8 bg-[#231a14] border-[1.5px] border-[#4a2f1d]">
                <h3 className="text-lg font-bold mb-4">📓 Sem o ItaSuper PDV</h3>
                <ul className="space-y-2.5 text-[15px] text-neutral-300">
                  {["Dinheiro não bate no fim do dia — e ninguém sabe por quê", "Estoque contado no \"olhômetro\", no fim do mês", "Desconto dado sem controle, sangria sem registro", "Ingredientes acabam no meio do rush", "Qualquer um cancela venda, ninguém responde por nada"].map((t) => (
                    <li key={t} className="flex gap-2.5"><X className="h-5 w-5 text-red-500 shrink-0 mt-0.5" strokeWidth={3} />{t}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl p-6 sm:p-8 bg-[#12241a] border-[1.5px] border-[#1f5c36]">
                <h3 className="text-lg font-bold mb-4">🖥️ Com o ItaSuper PDV</h3>
                <ul className="space-y-2.5 text-[15px] text-green-100">
                  {["Fechamento mostra sobra ou falta — por turno, por operador", "Estoque baixa sozinho a cada venda", "Desconto alto e sangria exigem PIN do gerente", "Alerta na hora quando o ingrediente zera", "Cancelamento com motivo + auditoria completa"].map((t) => (
                    <li key={t} className="flex gap-2.5"><Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" strokeWidth={3} />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3. RECURSOS */}
        <section className="py-16 md:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
              <p className="text-primary font-extrabold text-sm uppercase tracking-[1.5px] mb-3">Recursos</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Tudo que o balcão precisa. Nada que ele não entenda.</h2>
              <p className="text-muted-foreground text-base sm:text-lg">Cada tela foi desenhada para quem nunca usou um PDV: botões grandes, fluxo guiado, zero treinamento.</p>
            </div>
            <div className="space-y-14 md:space-y-20">
              {FEATURES.map((f, i) => (
                <div key={f.num} className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
                  <div className={i % 2 === 1 ? "md:order-2" : ""}>
                    <span className="inline-flex w-11 h-11 rounded-xl bg-orange-100 text-primary font-black text-xl items-center justify-center mb-4">{f.num}</span>
                    <h3 className="text-2xl sm:text-[27px] font-extrabold tracking-tight mb-3">{f.title}</h3>
                    <p className="text-muted-foreground text-base sm:text-[17px] mb-4">{f.desc}</p>
                    <ul className="space-y-2">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex gap-2.5 text-[15px] sm:text-base"><Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" strokeWidth={3} /><span dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }} /></li>
                      ))}
                    </ul>
                  </div>
                  <div className={`bg-neutral-100 rounded-2xl border border-neutral-200 min-h-[280px] flex items-center justify-center p-5 sm:p-7 ${i % 2 === 1 ? "md:order-1" : ""}`}>
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-[360px] overflow-hidden">
                      <div className="bg-primary text-white px-4 py-3 font-extrabold text-sm flex items-center gap-2">
                        <f.icon className="h-4 w-4" /> {f.title.split(":")[0]}
                      </div>
                      <div className="p-4 text-sm text-muted-foreground">
                        {f.num === "1" && (
                          <>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {["💵 Dinheiro", "⚡ Pix", "💳 Crédito", "💳 Débito"].map((m, j) => (
                                <div key={m} className={`rounded-lg py-2.5 text-center text-[13px] font-bold border-2 ${j === 1 ? "border-green-500 bg-green-50 text-green-700" : "border-neutral-200"}`}>{m}</div>
                              ))}
                            </div>
                            <div className="flex gap-1.5 mb-3 flex-wrap">
                              {["R$ 10", "R$ 20", "R$ 50", "Exato"].map((c) => (
                                <span key={c} className="text-xs font-bold bg-neutral-100 rounded-full px-3 py-1.5">{c}</span>
                              ))}
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center font-extrabold text-green-700 text-base">Troco: R$ 5,30</div>
                          </>
                        )}
                        {f.num === "2" && (
                          <>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {["🍚 Arroz 150g", "🫘 Feijão 100g", "🍗 Frango 120g", "🥗 Salada 50g"].map((p) => (
                                <span key={p} className="text-xs font-semibold bg-green-50 text-green-800 rounded-full px-3 py-1.5">{p}</span>
                              ))}
                            </div>
                            <div className="bg-orange-50 rounded-lg p-3 text-[13px] mb-2.5"><b>↓ Vendeu 1 marmita</b><br />Estoque: Arroz −150g · Feijão −100g · Frango −120g</div>
                            <div className="bg-red-50 rounded-lg p-3 text-[13px] text-red-700 font-semibold">⚠️ Frango atingiu o estoque mínimo (0,8 kg)</div>
                          </>
                        )}
                        {f.num === "3" && (
                          <>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {[["R$ 640", "Dinheiro"], ["R$ 380", "Cartão"], ["R$ 220", "Pix"], ["R$ 1.240 ✓", "Total bateu"]].map(([v, l]) => (
                                <div key={l} className="bg-neutral-100 rounded-lg p-3 text-center"><b className="text-base">{v}</b><br /><span className="text-xs text-muted-foreground">{l}</span></div>
                              ))}
                            </div>
                            <p className="text-center text-[13px]">🔐 Aguardando PIN do gerente…</p>
                          </>
                        )}
                        {f.num === "4" && (
                          <>
                            <div className="space-y-2 mb-3">
                              {[["#141", "R$ 32,00"], ["#142", "R$ 24,70"], ["#143", "R$ 15,00"]].map(([n, v]) => (
                                <div key={n} className="bg-neutral-100 rounded-lg px-3 py-2.5 flex justify-between text-[13px]"><span>🧾 Venda {n}</span><b>{v}</b></div>
                              ))}
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center text-[13px] text-green-700 font-bold">✓ Sincronizado — 0 duplicadas</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. SEGURANÇA */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-neutral-900 to-[#2b1a08] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-10 md:mb-12">
              <p className="text-orange-300 font-extrabold text-sm uppercase tracking-[1.5px] mb-3">Segurança</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Só quem pode, mexe.</h2>
              <p className="text-neutral-400 text-base sm:text-lg">7 ações sensíveis exigem o PIN do gerente. Se faltar dinheiro, você sabe exatamente de qual turno — e de qual operador.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {SECURITY_ITEMS.map((s) => (
                <div key={s.title} className="bg-white/[.06] border border-white/10 rounded-2xl p-5 sm:p-6">
                  <s.icon className="h-7 w-7 text-orange-400 mb-3" />
                  <h4 className="font-bold mb-1.5">{s.title}</h4>
                  <p className="text-sm text-neutral-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. COMO FUNCIONA */}
        <section className="py-16 md:py-20 bg-orange-50/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-primary font-extrabold text-sm uppercase tracking-[1.5px] mb-3">Como funciona</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Da conta à primeira venda no mesmo dia.</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[
                ["1", "Crie sua conta", "Sem cartão de crédito, sem instalar nada. Abre no navegador do computador, tablet ou celular."],
                ["2", "Cadastre os produtos", "Ou mande seu cardápio no WhatsApp e a gente cadastra com você."],
                ["3", "Venda hoje", "Abra o caixa, toque nos produtos, receba. O estoque e o financeiro se atualizam sozinhos."],
              ].map(([n, t, d]) => (
                <div key={n} className="bg-white rounded-2xl p-7 pt-9 shadow-sm relative">
                  <span className="absolute -top-5 left-7 w-11 h-11 rounded-full bg-primary text-white font-black text-xl flex items-center justify-center shadow-lg">{n}</span>
                  <h4 className="text-lg font-bold mb-2 mt-1">{t}</h4>
                  <p className="text-muted-foreground text-[15px]">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. PREÇO */}
        <section id="preco" className="py-16 md:py-20 text-center scroll-mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mx-auto mb-10">
              <p className="text-primary font-extrabold text-sm uppercase tracking-[1.5px] mb-3">Preço</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Um plano. Tudo incluído.</h2>
              <p className="text-muted-foreground text-base sm:text-lg">Menos de <b className="text-neutral-900">R$ 4 por dia</b>. Venda R$ 10 mil ou R$ 100 mil no mês: você paga os mesmos R$ 120.</p>
            </div>
            <div className="flex justify-center gap-4 flex-wrap mb-9">
              <div className="bg-neutral-100 rounded-xl px-6 py-3.5 text-sm text-muted-foreground"><b className="block text-xl text-neutral-900 line-through">R$ 50–150/mês</b>PDVs simples</div>
              <div className="bg-neutral-100 rounded-xl px-6 py-3.5 text-sm text-muted-foreground"><b className="block text-xl text-neutral-900 line-through">R$ 200–400/mês</b>PDVs completos</div>
            </div>
            <div className="bg-white border-[3px] border-primary rounded-3xl max-w-[460px] mx-auto p-8 sm:p-10 shadow-2xl relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white font-extrabold text-sm px-6 py-1.5 rounded-full whitespace-nowrap shadow-lg">SOMENTE PDV</span>
              <h3 className="text-xl font-bold mb-1">Plano único, sem pegadinha</h3>
              <div className="text-6xl font-black tracking-tight my-2">R$ 120<small className="text-lg text-muted-foreground font-semibold">/mês</small></div>
              <p className="text-green-600 font-extrabold text-lg mb-1">R$ 0 de taxa por venda</p>
              <p className="text-muted-foreground text-sm mb-6">Sem taxa de adesão · Sem fidelidade · Sem multa</p>
              <ul className="text-left mb-7 space-y-0">
                {PRICE_FEATURES.map((f) => (
                  <li key={f} className="flex gap-2.5 py-2 text-[15px] border-b border-orange-50 last:border-0"><Check className="h-5 w-5 text-green-600 shrink-0" strokeWidth={3} />{f}</li>
                ))}
              </ul>
              <Link to="/cadastro-lojista" className="block"><Button size="lg" className="w-full text-lg">Começar teste grátis →</Button></Link>
              <p className="text-[13px] text-muted-foreground mt-2.5">Sem cartão de crédito</p>
            </div>
            <p className="flex items-center justify-center gap-2.5 mt-7 text-muted-foreground text-[15px]"><ShieldCheck className="h-5 w-5 text-green-600" /><span><b className="text-neutral-900">Sem fidelidade.</b> Cancele quando quiser, sem multa. Seus dados são exportáveis.</span></p>
          </div>
        </section>

        {/* 7. FAQ */}
        <section className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <p className="text-primary font-extrabold text-sm uppercase tracking-[1.5px] mb-3">Dúvidas</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Perguntas frequentes</h2>
            </div>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`q${i}`} className="border-[1.5px] border-orange-100 rounded-2xl px-5 sm:px-6 bg-white data-[state=open]:border-primary">
                  <AccordionTrigger className="font-bold text-left text-[15px] sm:text-base py-4 sm:py-5 hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-[14.5px] sm:text-[15px] pb-5" dangerouslySetInnerHTML={{ __html: f.a.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }} />
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* 8. CTA FINAL */}
        <section className="bg-gradient-to-br from-primary to-orange-700 text-white text-center px-6 py-16 md:py-20 relative overflow-hidden">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4 relative">Pronto para organizar seu caixa?</h2>
          <p className="text-lg opacity-95 mb-8 relative">Em minutos você já está registrando vendas. Sem cartão, sem instalação, sem complicação.</p>
          <Link to="/cadastro-lojista" className="relative inline-block"><Button size="lg" variant="secondary" className="text-primary text-lg px-10 font-extrabold">Começar teste grátis →</Button></Link>
          <p className="text-sm mt-4 opacity-85 relative flex items-center justify-center gap-2"><MessageCircle className="h-4 w-4" /> Ou chame no WhatsApp e a gente cadastra seus produtos com você.</p>
        </section>

        {/* STICKY MOBILE CTA */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-3 z-40 shadow-[0_-8px_24px_rgba(0,0,0,.08)]">
          <Link to="/cadastro-lojista" className="block"><Button className="w-full">Testar grátis — R$ 120/mês</Button></Link>
        </div>
        <div className="h-[76px] md:hidden" />

        <footer className="py-8 px-6 text-center text-muted-foreground text-sm bg-orange-50/50">
          ItaSuper PDV — feito para quem vende de verdade.<br />
          <span className="text-xs">🔒 Dados protegidos (LGPD) · ☁️ 100% em nuvem · 💾 Backup automático</span>
        </footer>
      </div>
    </>
  );
}
