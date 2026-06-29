## Teste executado

Loguei como `16 99162-4997` no navegador headless, abri `/loja/pastelao-carioca`, tentei adicionar produtos (Pastel Doce e Refrigerante 600ml) e abrir o carrinho. Capturei console, network e screenshots.

## Bugs encontrados (em ordem de gravidade)

### 1. CRÍTICO — Modal de produto trava em "Carregando opções…" e não adiciona ao carrinho
`src/components/ProductDetailModal.tsx` força `totalSteps = 2` enquanto a query de addons está pendente (`addonsPending → return 2`). Resultado: TODO produto (mesmo sem addons, ex.: Refrigerante 600ml) entra em "Etapa 1 de 2 → Próximo: Personalizar → Carregando opções…" e o botão final fica desabilitado até o fetch terminar. Em produto sem addons, o `addonData` volta com arrays vazios mas o usuário já desistiu. Carrinho fica vazio.

**Correção**: enquanto `addonsPending`, manter `totalSteps = 1` (sem segundo passo) e desabilitar/labelar o botão como "Carregando…". Só virar 2 etapas DEPOIS que sabidamente existem `requiredAddonGroups` ou `hasSyntheticRequired`. Também garantir que produto sem addon nunca exija etapa 2.

### 2. CRÍTICO — `storeId` usa o slug antes da loja carregar → cascata de erros 400
`src/pages/StorePage.tsx:192` faz `const storeId = store?.id || id;`. Como a rota é `/loja/:id`, o param `id` é na verdade o slug `"pastelao-carioca"`. Antes de `store` resolver, todos os hooks rodam com slug no lugar de UUID e o Supabase devolve `22P02 invalid input syntax for type uuid`:

- `store_plans?store_id=eq.pastelao-carioca` (via `useStorePlan`)
- `stores_public?id=eq.pastelao-carioca`
- `promo_collections?store_id=eq.pastelao-carioca`
- `order_items?orders.store_id=eq.pastelao-carioca` (popular + reorder)

**Correção**: `const storeId = store?.id ?? null;` e em todos os `useQuery` colocar `enabled: !!store?.id && ...`. Hooks afetados: `useStorePlan(storeId)`, `store-hours`, `menu-sections`, `products`, `promo-collections`, `popular-products`, `reorder-products`.

### 3. ALTO — Tabela `fraud_attempts` não existe no Supabase externo
`src/lib/fraudCheck.ts` (usado em `StorePage`/`CheckoutPage`) chama `POST /rest/v1/fraud_attempts` → `PGRST205 Could not find the table 'public.fraud_attempts' (hint: signup_attempts)`. Cada abertura de loja gera erro.

**Correção (escolher um)**:
- (a) Criar tabela `public.fraud_attempts` no banco externo, com GRANTs + RLS, OU
- (b) Trocar a referência no código para a tabela existente `public.signup_attempts` se for o mesmo propósito.

Recomendo (a) — manter o nome do código, criar a tabela com schema idêntico ao usado por `fraudCheck.ts`.

### 4. MÉDIO — Tela de carrinho não persiste item entre rotas no fluxo testado
Mesmo quando o modal de produto consegue concluir, ao navegar para `/carrinho` o estado às vezes aparece "Seu carrinho está vazio". Suspeita: `CartContext` chaveia por `storeId` e o reset de `storeId` (bug #2) limpa o carrinho. Provavelmente desaparece sozinho ao corrigir #2 — revalidar depois.

### 5. BAIXO — Warning React `fetchPriority`
`<img fetchPriority="…">` deve ser `fetchpriority` (minúsculo) ou usar a prop como atributo customizado. Aparece em `StorePage` e `StoreDirectory`. Cosmético, mas polui console em produção.

## Plano de execução (na ordem)

1. Corrigir #2 em `StorePage.tsx` (storeId + `enabled` nos useQuery).
2. Corrigir #1 em `ProductDetailModal.tsx` (`calculateTotalSteps` não retornar 2 quando só `addonsPending`).
3. Resolver #3 criando `public.fraud_attempts` no banco externo via migração (com GRANT + RLS por `user_id`).
4. Re-rodar o teste end-to-end (login → adicionar produto sem addon → carrinho → finalizar pedido em dinheiro). Confirmar que `orders.delivery_pin` recebe o PIN do perfil (sistema novo de PIN fixo).
5. Limpar warning #5 (`fetchPriority` → `fetchpriority` ou remover).
6. Bump de versão para `1.10.335` em `PerfilPage.tsx` + `android/app/build.gradle` (versionCode +1).

## Detalhes técnicos

- Login synth-email confirmado: `wa55<digitos>@itasuper.app`. PIN do perfil já é replicado no trigger `set_order_number`/`generate_delivery_pin` (corrigido nas rodadas anteriores).
- Backend é o Supabase externo `EXTERNAL_SUPABASE_*` — vou aplicar a migração da `fraud_attempts` lá direto via Management API.
- Não tocar em UX da Pastelão Carioca além das correções acima.

Posso prosseguir aplicando os 6 passos?
