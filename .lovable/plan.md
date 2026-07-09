# Alinhamento de textos do PDV na landing (StoreDirectory)

Depois de virar o PDV em módulo pago opcional (R$ 49/mês para novas lojas, R$ 1/venda para lojas legacy), a landing pública ainda tem textos inconsistentes entre os 3 planos. Só o Essencial menciona o PDV; Comissão e Autonomia ficam mudos, o que confunde o lojista na comparação.

## Objetivo
Deixar a linha do PDV **idêntica e explícita nos 3 planos** — mesma frase, mesmo preço, mesma posição no card — para que o lojista entenda que PDV é um módulo à parte, independente do plano escolhido.

## Mudanças de texto (só `src/pages/StoreDirectory.tsx`)

### 1. Bloco `features` (linha 36) — seção "O que vem no app"
De:
`"PDV de balcão" — "Módulo opcional (R$ 49/mês) — caixa, troco e fechamento do dia."`

Para:
`"PDV de balcão (opcional)" — "Módulo à parte por R$ 49/mês. Caixa, troco e fechamento do dia."`

Motivo: reforçar "à parte" para não parecer incluso.

### 2. Bloco `plans` (linhas 48–98) — adicionar linha de PDV nos 3 cards, no mesmo formato

- **Comissão** (`features`): adicionar como último item
  `"PDV: módulo opcional (+ R$ 49/mês)"`

- **Essencial** (`features`, linha 77): trocar
  `"PDV: módulo opcional (R$ 49/mês)"` → `"PDV: módulo opcional (+ R$ 49/mês)"`
  (padroniza com o "+" dos outros)

- **Autonomia** (`features`): adicionar como último item, antes do "7 dias grátis"
  `"PDV: módulo opcional (+ R$ 49/mês)"`

### 3. FAQ (linhas 106–119) — nova pergunta ao final

```
{
  q: "O PDV está incluso em algum plano?",
  a: "Não. O PDV é um módulo opcional, contratado à parte por R$ 49/mês, e funciona com qualquer plano (Comissão, Essencial ou Autonomia). Lojas antigas que já usavam o PDV mantêm a regra anterior de R$ 1 por venda presencial.",
}
```

### 4. Meta description (linha 283)
De: `"Cardápio digital, PIX automático, motoboy e PDV num app só..."`
Para: `"Cardápio digital, PIX automático e motoboy num app só. PDV de balcão como módulo opcional. Sem comissão por pedido..."`

Motivo: PDV não é "incluso no app" — é add-on.

### 5. Hero (linha 394)
De: `"Cardápio, PIX, motoboy e PDV num app só. Sem mensalidade pra começar."`
Para: `"Cardápio, PIX e motoboy num app só — com PDV de balcão opcional. Sem mensalidade pra começar."`

## Fora de escopo
- Não mexer em `plansInfo.ts`, `PlansComparisonTable`, `PlanosPage` (já foram alinhados nas ondas anteriores).
- Sem mudança de lógica, componente ou estilo — só copy.
- Versão sobe pro patch seguinte (v1.12.3, build 857) conforme regra do projeto.
