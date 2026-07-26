# Plano — Taxa de entrega com fonte única de verdade

**Problema:** hoje 6+ locais calculam a taxa de entrega com fórmulas diferentes. Resultado: Pastelão Carioca aparece como **R$ 3,00** (lista), **R$ 4,75** (StorePage) e cobraria outro valor no checkout. Regras de VIP/autonomy só valem no front, então o **repasse do lojista sai errado no backend**.

## Fase 1 — Backend: RPC canônica

**Criar `public.compute_store_delivery_fee(_store_id uuid)`** que retorna JSON:
```
{ base_fee, platform_split_full, platform_add_customer,
  platform_add_payout_deduction, split_mode, plan_type, is_autonomy,
  customer_total }
```

Lógica única (aplica todas as regras de negócio):
1. Lê `stores.delivery_mode`, `stores.own_delivery_fee`, `stores.delivery_fee`, `stores.platform_fee_split`.
2. Lê `store_plans.platform_delivery_split_override` e `store_plans.plan_type`.
3. Lê `admin_settings.delivery_fee_config.platform_split` (default fixo **0,99** em todo lugar).
4. Se `plan_type='autonomy'` → `platform_split_full = 0`.
5. Se `delivery_mode='platform'` → `base_fee` já inclui split → `platform_add_customer = 0`.
6. Se `delivery_mode='own'`:
   - `cliente` → add cliente=full, deduz repasse=0
   - `meio_a_meio` → add cliente=full/2, deduz=full/2
   - `lojista` → add cliente=0, deduz=full

**Aposentar** `get_store_platform_split` (fantasma, não existe nas migrations) e transformar `get_store_platform_fee_charge` em wrapper que chama a nova RPC (compat).

## Fase 2 — Backend: reconciliar pedido e repasse

- **Trigger `validate_order_prices`**: recalcular `delivery_fee` server-side via RPC (frontend deixa de ser fonte de verdade do valor cobrado). Fecha vulnerabilidade de manipulação.
- **Edge function `confirm-order-payment`**: usar `platform_add_payout_deduction` da RPC em vez de deduzir sempre o split cheio. Respeita split_mode e autonomy.
- **Trigger `accrue_fixed_plan_split`**: mesma correção para pagamentos físicos (dinheiro/cartão).

## Fase 3 — Frontend: helper único

- Criar `src/lib/deliveryFeeDisplay.ts` com `describeStoreFee(store, storePlan)` retornando `{ customerTotal, label, prefix }`.
- Expor colunas necessárias na view `stores_public` (`platform_fee_split`, `platform_delivery_split_override`, `plan_type`) — sem N+1.
- **Substituir** em todos os locais para usar a helper:
  - `ClientHomeContent.formatFeeLabel`
  - `StoreCard` (row + grid) — e corrigir bug de usar `own_delivery_fee` quando `delivery_mode='platform'`
  - `ClientBuscaPage`
  - `StorePage` — card "Taxa"
  - `CheckoutPage` — linha de resumo
- **`useStorePlan.ts`**: remover duplo default (`2.0` vs `0.99`) — único fallback = **0,99**.

## Fase 4 — Testes (Pastelão Carioca, base R$ 4,00)

| split_mode | Home | StorePage | Checkout | Repasse deduz |
|---|---|---|---|---|
| cliente | R$ 4,99 | R$ 4,99 | R$ 4,99 | R$ 0,00 |
| meio_a_meio | R$ 4,50 | R$ 4,50 | R$ 4,50 | R$ 0,50 |
| lojista | R$ 4,00 | R$ 4,00 | R$ 4,00 | R$ 0,99 |
| autonomy (qualquer) | R$ 4,00 | R$ 4,00 | R$ 4,00 | R$ 0,00 |

## Detalhes técnicos (referência)

- Nova RPC é `SECURITY DEFINER`, `SET search_path = public`.
- View `stores_public` ganha 3 colunas via `CREATE OR REPLACE VIEW ... WITH (security_invoker = on)`.
- Trigger `validate_order_prices` passa a chamar RPC — teste extra para pedidos legados.
- Não mexer em `orders.app_fee` nem em comissão (fora de escopo).

## Riscos

- Trigger `validate_order_prices` reescrevendo `delivery_fee` pode divergir do que o cliente viu se a config mudou entre a exibição e o envio; solução: usar snapshot do split enviado pelo cliente e validar apenas margem de erro.
- Migrar `get_store_platform_fee_charge` para wrapper pode afetar `accrue_fixed_plan_split` — testar em uma loja de teste antes de aplicar em prod.