# Plano: Produto por Peso no PDV (100% Supabase Externo)

> ⚠️ **Backend:** TODAS as operações de banco neste plano rodam exclusivamente no **Supabase externo `qkjhguziuchqsbxzruea`** via `EXTERNAL_SUPABASE_URL` / `EXTERNAL_SUPABASE_SERVICE_KEY`. Lovable Cloud **não é usado** neste projeto — nenhum `supabase--migration` interno será disparado. Migrations vão para `scripts/*.sql` e são aplicadas via `ext-sql-runner` (mesmo padrão já usado em `order-number-external.sql`, `antifraud-external.sql`, etc.).

## Pedido da lojista (Cantinho da Silvia)

Vender itens por peso (ex: R$ 59,90/kg) direto no PDV, **sem balança integrada**, com o resultado aparecendo no relatório do fechamento do dia.

## Análise do PDV atual

- `usePdvCatalog`: lê `products` do **externo** via `supabase.from("products")` (cliente já apontado para o externo).
- `usePdvCart`: agrega por `id + addons + observations`, com `basePrice`, `price` (unitário) e `quantity`.
- `usePdvCheckout`: grava `orders` + `order_items` + `pdv_movements` no externo.
- `PdvFechamentoScreen`: total vendido, abertura, sangrias, suprimentos e quebra por método — tudo de `pdv_movements` da sessão.
- `products` externo: hoje só tem `price` único, sem flag de peso.

Tudo compatível — faltam só 2 campos no produto, 1 modal no PDV e 1 card no relatório.

## Fase 1 — Banco externo (`qkjhguziuchqsbxzruea`)

Novo arquivo `scripts/pdv-weight-external.sql`, aplicado via `ext-sql-runner`:

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sold_by_weight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_per_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'kg';

NOTIFY pgrst, 'reload schema';
```

Em `order_items`, aproveitamos o `metadata jsonb` já existente: `{ weight_grams: 450, price_per_kg: 59.90 }`. **Sem nova coluna, sem nova policy** (RLS atual de `products` e `order_items` no externo já cobre).

## Fase 2 — Cadastro do produto (admin)

`MenuTab` (admin) — toda escrita continua indo para o externo via `supabase.from("products").upsert(...)`:

- Toggle **"Vender por peso"**.
- Quando ligado: campo `price_per_kg` substitui o `price` fixo; preview "R$ X,XX a cada 100 g".
- Ao salvar: gravar `price = price_per_kg` também, para não quebrar telas legadas que somam por preço unitário.

## Fase 3 — PDV: novo modal de peso

Novo `src/components/pdv/PdvWeightDialog.tsx`:

- Abre ao tocar num produto com `sold_by_weight = true` (em vez do modal de addons).
- Teclado numérico grande (mesma DS dos outros dialogs do PDV) pedindo **gramas**.
- Em tempo real: `(gramas / 1000) × price_per_kg = R$ Y,YY`.
- "Adicionar" → `handleModalAdd` com:
  - `quantity = 1`
  - `price = total calculado`
  - `observations = "450 g"`
  - `metadata.weight_grams = 450`
  - `metadata.price_per_kg = 59.90`

No `PdvCartSection`, item por peso é **não-incrementável** (+/− escondidos): mostra peso + botão remover/editar peso.

No checkout (`usePdvCheckout`), o `metadata` é repassado intacto no `insert` de `order_items` no externo.

## Fase 4 — Impressão térmica

Em `src/lib/thermalPrint.ts`, se `item.metadata?.weight_grams`:

```
PICANHA          450 g x R$ 59,90/kg
                                R$ 26,96
```

Validado nos dois layouts (58 mm e 80 mm) já cobertos pelos testes de `thermalPrint.test.ts`.

## Fase 5 — Relatório de fechamento

`PdvFechamentoScreen` + aba **Relatórios**:

- Novo card **"Vendas por peso"** (só aparece se houver): total de **gramas** vendidas e valor.
- "Mais vendidos": produtos por peso aparecem como "X,XX kg vendidos" no lugar de "N un".

Cálculo client-side a partir dos `order_items.metadata` dos pedidos da sessão (já buscados do externo). **Zero alteração** em `pdv_movements`.

## Fase 6 — Versão, testes e validação

- Bump patch em `src/lib/appVersion.ts` + `android/app/build.gradle` (`versionName` e `versionCode +1`).
- Vitest em `usePdvCart`: item por peso não duplica, não incrementa, e respeita `metadata`.
- Smoke manual no Cantinho da Silvia (loja real no externo): cadastrar produto teste, venda de 250 g, fechar caixa, conferir card.

## Segurança

- Migration roda no externo com `IF NOT EXISTS` (idempotente).
- Sem nova RLS porque reaproveita `products` / `order_items`.
- Conferir lint do externo após aplicar (sem novas tabelas, expectativa = 0 warnings novos).

## Fora de escopo (intencional)

- Integração com balança Toledo/Filizola via SDK.
- Integração Stone/Ton (maquininha) — plano separado.
- Qualquer escrita em Lovable Cloud — **não usamos**.

Posso seguir e implementar?
