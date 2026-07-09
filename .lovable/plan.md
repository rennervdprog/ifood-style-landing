# Plano — Cadastro PDV Standalone

Novo fluxo de cadastro para lojistas que querem **apenas o PDV** (frente de caixa), sem cardápio online, sem delivery, sem vitrine pública.

## Sugestões de preço

Referência de mercado (PDV SaaS para pequeno comércio/food): Colibri ~R$ 90, Ciss ~R$ 120, Bling PDV ~R$ 40, Stone/Ton PDV ~R$ 30–70, iFood Shop ~R$ 50.

Três cenários possíveis:

| Plano | Preço | Racional |
|---|---|---|
| **Agressivo (entrada)** | R$ 49/mês | Mesmo preço do add-on. Simples de comunicar ("PDV é sempre R$ 49"), mas não captura valor extra de quem não usa delivery. |
| **Recomendado** | R$ 69/mês | +R$ 20 sobre o add-on. Justifica suporte dedicado, relatórios e o fato de ser produto "cabeça" (não add-on). Ainda abaixo dos concorrentes diretos. |
| **Premium** | R$ 89/mês | Alinhado com Colibri. Só faz sentido se incluir algo a mais (multi-caixa, sangria avançada, integração fiscal). |

**Minha recomendação: R$ 69/mês**, com desconto de R$ 59 no primeiro mês ou anual (R$ 690 = 2 meses grátis). Deixa espaço para upsell futuro ("+ delivery por R$ 30" — vira Essencial R$ 99, coerente).

Trial: 7 dias grátis, igual aos outros planos.

## Escopo funcional

Loja `pdv_only` tem:
- ✅ PDV completo (vendas, sangria, fechamento, relatórios)
- ✅ Cadastro de produtos (usado no PDV)
- ✅ Financeiro / caixa
- ✅ WhatsApp (grátis, igual aos outros)
- ❌ Vitrine pública / link da loja
- ❌ Cardápio online / pedidos delivery
- ❌ Entregadores, taxa de entrega, área de atendimento
- ❌ Comissão por pedido (não existe pedido online)

## Mudanças técnicas

### 1. Banco (externo)
- Adicionar `'pdv_only'` ao enum `plan_type` (ou usar string livre se já for text).
- `stores.is_visible` default `false` quando `plan_type='pdv_only'`.
- Preço no `store_plans` ou hardcoded no `plansInfo.ts` (R$ 69).
- Ao criar loja `pdv_only`, inserir automaticamente `store_addons` com `addon_key='pdv'` ativo e `price_override=0` (PDV já embutido no preço do plano, não cobrar duas vezes).

### 2. `src/lib/plansInfo.ts`
- Adicionar entrada `pdv_only`: label "Somente PDV", preço R$ 69, features (PDV completo, WhatsApp grátis, sem delivery/vitrine).
- `isPagante('pdv_only') = true`.

### 3. `CadastroLojista.tsx`
- Novo card no step de seleção de plano: **"Somente PDV — R$ 69/mês"** com selo "Sem delivery".
- Quando selecionado:
  - Pular steps de: horário de funcionamento, área de entrega, taxa de entrega, upload de cardápio.
  - Manter: dados da loja, endereço (só p/ nota/cadastro), dados do responsável, pagamento.
- Copy explicando: "Sua loja não aparecerá na vitrine ItaSuper. Você usará apenas o PDV para vendas presenciais."

### 4. Guards de rota
- `useStorePdvAccess`: já libera. Adicionar `plan_type==='pdv_only'` como acesso total ao PDV.
- Criar guard `useStoreDeliveryEnabled()` que retorna `false` para `pdv_only` e esconde no menu do lojista: "Pedidos online", "Entregadores", "Cardápio público", "Horários", "Taxa de entrega".
- Rota pública `/{slug}` deve retornar 404 (ou redirect) se `plan_type='pdv_only'`.

### 5. Super Admin
- Filtro no `StoreList` por tipo de plano (incluir "Somente PDV").
- `AdminPlanManager`: mostrar plano `pdv_only` e permitir migração (upgrade para Essencial adiciona delivery).

### 6. Cobrança (`monthly-billing`)
- Loja `pdv_only`: cobrar R$ 69 fixo. Não somar add-on PDV (já embutido). Não aplicar comissão/repasse.

### 7. Landing (`StoreDirectory.tsx`)
- Novo bloco/plano na seção de planos: "Somente PDV — R$ 69/mês". Copy: "Já tem sua clientela na loja física? Use só o caixa."
- FAQ: "Posso assinar só o PDV? Sim, R$ 69/mês, sem delivery, sem vitrine."

### 8. Termos
- Cláusula: plano `pdv_only` não gera presença na vitrine e não inclui serviço de intermediação de pedidos.

## Ondas de entrega

1. **Onda 1** — Banco + `plansInfo` + guard de acesso PDV + cobrança.
2. **Onda 2** — Fluxo de cadastro (`CadastroLojista`) com skip de steps.
3. **Onda 3** — Guards no painel do lojista (esconder menus de delivery) + rota pública 404.
4. **Onda 4** — Super Admin (filtro, gestão) + landing + termos + FAQ.

Cada onda incrementa versão e mantém `versionCode` sincronizado.

## Perguntas antes de codar

1. **Preço final**: fico com R$ 69 sugerido, ou prefere R$ 49 / R$ 89?
2. **Trial**: 7 dias grátis igual aos outros, ok?
3. **Upgrade futuro**: lojista `pdv_only` que quiser ativar delivery vira `essencial` (R$ 99) mantendo o PDV embutido? (recomendo sim)
