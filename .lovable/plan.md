# PDV Boutique — Modo Roupa

Objetivo: habilitar um "modo boutique" no PDV existente sem quebrar o food/varejo atual. Ativado por loja via `store_type = 'apparel'`. Todo o backend fica no Supabase externo.

## Escopo (o que entra agora)

1. Modelo de dados de variantes (grade tamanho × cor)
2. Estoque por SKU em tempo real (com movimentações)
3. Layout de venda adaptado — matriz visual P/M/G × cores
4. Cadastro de produto "roupa" (SKU-pai + variantes geradas)
5. Troca e devolução com vale-crédito do cliente
6. CRM básico do cliente (histórico, tamanho preferido, telefone)
7. Impressão de etiqueta com código de barras (EAN/Code128)
8. Ajustes de UI/UX (cards do catálogo, cores de categoria, histórico)
9. Testes E2E cobrindo cada fluxo novo

Fora do escopo desta fase: NFC-e / integração fiscal (esforço grande, exige certificado A1 do lojista — fica para fase 2).

## Estrutura técnica (para dev)

### Backend (Supabase externo)
Uma única migration aplicada via edge function `oneshot` com `EXTERNAL_SUPABASE_SERVICE_KEY`:

- `stores.store_type` enum: `food | apparel` (default `food`)
- `product_variants`: `id, product_id, size, color, sku, barcode, price_override, stock_qty, active, created_at, updated_at` + GRANT + RLS + trigger updated_at
- `stock_movements`: `id, store_id, variant_id, delta, reason (sale|return|adjust|entry), operator_id, ref_order_id, created_at` + GRANT + RLS
- `customer_credits` (vale-troca): `id, store_id, customer_id, amount, source_order_id, used_at, expires_at, created_at` + GRANT + RLS
- `customers_crm` (extensão do cliente por loja): `id, store_id, customer_id, preferred_size, notes, total_spent, last_purchase_at`
- `order_items.variant_id` (nullable, FK)

RPCs `SECURITY DEFINER` (padrão do projeto):
- `apparel_create_product_with_variants(product, variants[])`
- `apparel_adjust_stock(variant_id, delta, reason)`
- `apparel_return_item(order_item_id, qty, mode: 'credit'|'refund')` → gera `customer_credits` ou reembolso
- `apparel_apply_credit(customer_id, amount, order_id)`
- `apparel_stock_report(store_id, filters)`

### Frontend
- `src/pages/pdv/apparel/` isolado, carregado condicionalmente quando `store_type='apparel'`
- `ApparelCatalogGrid.tsx` — card do modelo com foto grande + chip de cores + "abrir grade"
- `ApparelVariantMatrix.tsx` — matriz tamanho × cor, célula mostra estoque, clique adiciona ao carrinho
- `ApparelProductForm.tsx` — cadastro do modelo com gerador automático de variantes
- `ApparelStockPage.tsx` — listagem, filtro por baixo estoque, ajuste rápido
- `ApparelReturnDialog.tsx` — troca/devolução a partir do histórico
- `CustomerCrmDrawer.tsx` — ficha do cliente no checkout
- `LabelPrintDialog.tsx` — geração de etiqueta (Code128 via JsBarcode) para impressora térmica

Roteamento: `PdvTabs` detecta `store_type` e troca o componente da aba Vender e Cardápio; demais abas (Mesas, Histórico, Relatórios, Caixa) permanecem.

### Super Admin
- Toggle `store_type` na tela de edição da loja
- `TestStoreCreator` ganha opção "PDV Boutique (roupas)"

## E2E (Playwright)
Nova suíte `/tmp/browser/pdv_apparel/`:
1. `01_setup.py` — cria loja sandbox `e2e-boutique@itasuper.test` via `e2e-mint-session`, seta `store_type='apparel'`
2. `02_cadastro_variantes.py` — cria modelo "Camiseta Básica" com grade P/M/G × 3 cores, valida 9 SKUs e estoque inicial
3. `03_venda_matriz.py` — abre caixa, adiciona 2 variantes pela matriz, finaliza pagamento, valida decremento de estoque
4. `04_troca_credito.py` — devolve 1 item do pedido, valida geração de `customer_credits` e reentrada no estoque
5. `05_aplicar_credito.py` — nova venda usando vale-crédito, valida `used_at`
6. `06_baixo_estoque.py` — força estoque = 0 em variante e valida bloqueio + alerta
7. `07_crm.py` — valida histórico e tamanho preferido do cliente
8. `08_etiqueta.py` — abre diálogo de etiqueta, valida SVG do código de barras
9. `09_mobile.py` — repete 03 e 04 em viewport mobile
10. `10_isolamento.py` — loja food não vê UI apparel; loja apparel não vê aba delivery

Cada script tira screenshot em cada passo e valida via `expect`. Roda em série; falha aborta a suíte.

## Entregas por fase

Fase 1 — Base (dia 1-2): migration + RPCs + toggle super admin
Fase 2 — Cadastro (dia 3): `ApparelProductForm` + gerador de variantes + E2E 01-02
Fase 3 — Venda (dia 4-5): matriz + estoque em tempo real + E2E 03, 06, 09
Fase 4 — Troca/CRM (dia 6-7): devolução, vale-crédito, ficha do cliente + E2E 04-05, 07
Fase 5 — Etiqueta + polish (dia 8): impressão + isolamento + E2E 08, 10
Fase 6 — Regressão: rodar suíte E2E antiga do PDV food para garantir zero quebra

## Riscos e mitigações
- **Quebrar PDV food**: todo código novo atrás de `if (store_type==='apparel')`; nenhuma tabela existente ganha coluna obrigatória
- **Estoque race condition**: `apparel_adjust_stock` usa `UPDATE ... WHERE stock_qty >= delta` com retorno; falha vira toast
- **Migração de loja existente food→apparel**: bloqueada por enquanto (só cria já como apparel)

## Versionamento
Ao final: bump para v1.21.0 (build 1063+), sincronizado em `appVersion.ts` e `build.gradle`.

Aprovando este plano, começo pela Fase 1 (migration + toggle) e sigo em sequência, rodando o E2E de cada fase antes de avançar.