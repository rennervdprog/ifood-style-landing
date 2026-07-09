# Alinhar textos do PDV no Cadastro do Lojista

O `StoreDirectory` (landing) e a `PlanosPage` já foram alinhados: PDV é **módulo opcional a R$ 49/mês**, contratado à parte, funciona com qualquer plano; lojas legacy mantêm a regra de R$ 1/venda.

O cadastro do lojista (`CadastroLojista.tsx`, step "Escolha seu plano") ainda tem textos inconsistentes porque puxa `p.features` de `src/lib/plansInfo.ts` — e lá:

- **Comissão** e **Essencial** não mencionam PDV.
- **Autonomia** ainda diz `"PDV: R$1,00 por venda presencial"` (regra legacy — não vale mais pra loja nova que vai se cadastrar).

Resultado: o lojista novo escolhe o plano sem saber que o PDV é add-on de R$ 49/mês.

## Mudanças (só copy, sem lógica)

### 1. `src/lib/plansInfo.ts` — features dos 3 planos ativos

Adicionar/substituir a linha de PDV com **exatamente o mesmo texto** dos 3, batendo com a landing:

- **`commission_only`** (Comissão) — adicionar como último item:
  `"PDV: módulo opcional (+ R$ 49/mês)"`

- **`fixed`** (Essencial) — adicionar como último item:
  `"PDV: módulo opcional (+ R$ 49/mês)"`

- **`autonomy`** (Autonomia) — **substituir** a linha atual
  `"PDV: R$1,00 por venda presencial"` por
  `"PDV: módulo opcional (+ R$ 49/mês)"`

Isso propaga automaticamente pro cadastro, pra `PlanosPage`, pro `StoreSubscription` e qualquer outro consumidor de `PLANS[...].features`.

### 2. `src/pages/CadastroLojista.tsx` — nota curta abaixo do bloco de features

Dentro do card expandido de plano (logo depois do `<ul>` das features, ~linha 620, antes de `<PlanFeeBreakdown/>`), adicionar uma linha informativa única, igual pros 3 planos:

```
<p className="text-[11px] text-muted-foreground leading-relaxed">
  💡 O <strong>PDV de balcão</strong> é um módulo à parte (R$ 49/mês),
  independente do plano. Você pode ativar/cancelar quando quiser em
  "Meu Plano".
</p>
```

Motivo: garantir que a mensagem apareça mesmo se o lojista não abrir cada plano — reforça que a escolha do plano **não inclui** PDV.

### 3. Versão

Bump para **v1.12.4 (build 858)** em `src/lib/appVersion.ts` e `android/app/build.gradle` conforme regra do projeto.

## Fora de escopo
- Não mexer em `StoreDirectory`, `PlanosPage`, `PlansComparisonTable` (já alinhados).
- Não tocar em lógica de billing, hooks, ou no `PdvUpsellScreen`.
- Sem mudanças de layout/estilo — só copy + 1 linha extra.
