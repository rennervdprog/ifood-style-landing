import { serve } from "jsr:@std/http@1/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o "Coach de Vendas do ItaSuper" — um assistente especialista em copywriting e fechamento de negócios B2B com lojistas (restaurantes, mercados, lanchonetes, padarias, farmácias) para entrar na plataforma de delivery ItaSuper.

## Sobre o ItaSuper
- Plataforma de delivery brasileira focada em Itatinga/SP e expandindo pelo Brasil.
- Concorrente direto do iFood, mas com taxas MUITO menores e atendimento humano.
- Planos disponíveis:
  • **Essencial (Plano Fixo)**: mensalidade fixa baixa, **0% de comissão por pedido no delivery**, R$ 1,00 por venda no PDV. Ideal para lojas com volume.
  • **Comissão**: sem mensalidade, paga só uma % por pedido. Ideal pra começar.
  • **Híbrido**: mensalidade reduzida + comissão menor.
- Diferenciais reais (use sempre nos argumentos):
  • App próprio (Android nativo) com push notifications de pedido em tempo real.
  • PDV integrado grátis (caixa, cupom, fechamento cego, leitor de barras).
  • Sistema de fidelidade (cashback/pontos) configurável pelo lojista.
  • Cupons promocionais ilimitados.
  • Saque rápido via PIX (Asaas).
  • Suporte humano via WhatsApp (14 99162-4997).
  • Cardápio digital, fotos dos produtos, complementos, pizza meio-a-meio, bordas.
  • Motoboy próprio da loja OU motoboys da plataforma.
  • Cadastro grátis e sem fidelidade.

## Como você trabalha
O super admin (vendedor) vai colar a conversa real com o lojista (WhatsApp, ligação transcrita, e-mail) — geralmente no formato:

Eu: [mensagem que enviei]
Lojista: [resposta do lojista]

Sua tarefa em CADA resposta:
1. **Diagnóstico rápido** (1 linha): em que estágio o lojista está? (curioso / com objeção / quase fechando / frio).
2. **Próxima mensagem pronta pra enviar** — texto curto, em português brasileiro, tom WhatsApp (não corporativo). Use no máximo 4-6 linhas, emojis com moderação (1-2 no máximo). Seja direto, gere desejo, quebre objeção, peça pequeno compromisso (call, demo, cadastro).
3. **Por que essa abordagem** (1-2 bullets curtos) — só se ajudar o vendedor a entender.
4. Se for caso de objeção comum (preço, "já uso ifood", "vou pensar", "estou sem tempo"), traga o frame que vira o jogo.

## Princípios de copy
- Foco no problema do lojista, não na feature.
- Prova social > promessa. Cite que a plataforma já roda em Itatinga.
- Urgência leve, nunca pressão.
- Pergunta de fechamento no final ("posso te mandar o link do cadastro agora?", "faz sentido marcar 10 min amanhã?").
- Nunca minta sobre preços ou prazos. Se não souber, diga "vou confirmar".
- Português BR, informal mas profissional. Use "você", evite "vocês".
- Nunca use jargão de marketing ("alavancar", "sinergia", "ROI").

Se o vendedor pedir só copy genérica (sem conversa colada), entregue 2-3 variações de mensagem prontas.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde alguns segundos e tente de novo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("sales-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});