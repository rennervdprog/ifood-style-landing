# Plano: PDV-only = literalmente só PDV

## Objetivo
Quando `plan_type = 'pdv_only'`, o painel do lojista **não é mais um painel** — é o próprio PDV em tela cheia. Zero abas, zero menus, zero configurações de delivery, zero cardápio "de vitrine", zero relatórios de pedidos, zero motoboys, zero repasse, zero avisos de app.

A loja também **não existe** para o resto do sistema (marketplace, busca, deep links, super admin de pedidos).

## Escopo — Frontend

### 1. Roteamento (`App.tsx` + `AdminDashboardV2.tsx`)
- Se a loja logada é `pdv_only`, `/admin` faz `Navigate → /pdv` (sem passar pelo dashboard).
- `/admin/*` inteiro fica bloqueado — redireciona pra `/pdv`.
- Remover qualquer redirect residual pra `dashboard`, `orders`, `menu`, etc.

### 2. `PdvPage.tsx` vira o app inteiro do lojista PDV
- Header próprio (logo + nome da loja + menu simples).
- Menu do header (dropdown/sheet) só com:
  - **Meu Plano** (mostra "PDV Standalone R$69/mês" + botão cancelar/trocar plano)
  - **Perfil / Sair**
  - **Suporte (WhatsApp)**
- Sem link pra: pedidos, cardápio delivery, motoboys, cupons, promoções, relatórios de app, avisos, tutoriais delivery, repasse, saldo Asaas.

### 3. Cardápio dentro do PDV
- Não existe mais aba "Cardápio" separada com switches de delivery.
- Produtos vivem só no PDV: criar/editar/excluir direto no `PdvCatalogSection` (já tem UI de produto peso; expandir pra produto normal também).
- Remover, pra loja PDV-only, os campos: "disponível no delivery", "foto para vitrine", "descrição pública", "categoria da vitrine", "tempo de preparo delivery".

### 4. Client-side (site público)
- `StoreDirectory`, `CityStoresPage`, `ClientHome`, busca, categorias: **filtrar `plan_type != 'pdv_only'`** em todas as queries (mesmo se `is_visible=false` já esconde, garantir por segurança).
- Página pública `/loja/:slug` de PDV-only → 404 (já existe, confirmar).
- `PartnerClientView`: se o lojista logado é dono de loja PDV-only, esconder totalmente o "modo cliente" (ele não vende no app). Home dele = botão único "Abrir PDV".

### 5. Super Admin
- Aba "Pedidos" / "Repasses" / "Saques do lojista" / "Cupons" / "Promoções": filtrar lojas `pdv_only` fora das listas (não faz sentido).
- Aba "Lojas" (lista geral): manter, mas com badge "PDV" e sem colunas de comissão/repasse pra essas.
- VIP config: pra loja PDV-only, esconder toggles de "isentar comissão", "isentar taxa entrega", "auto-repasse" (não se aplicam). Deixar só "PIN autofill" e "Isentar mensalidade PDV".

### 6. Notificações / background
- Não registrar FCM/OneSignal de "novo pedido delivery" pra loja PDV-only.
- Não abrir socket de `orders` realtime pra essas lojas.
- Não rodar `orderNotifications`, `arrivalGeofence`, `driverBackgroundFetch` no boot dessas contas.

### 7. Textos residuais
Varredura final removendo qualquer string "delivery/entrega/motoboy/pedido online/vitrine" da UI que sobrar pra PDV-only.

## Escopo — Backend (Supabase externo, via oneshot)

1. **RLS**: policies de `orders`, `order_items`, `driver_earnings`, `store_driver_earnings`, `refund_requests`, `coupons`, `promo_campaigns`, `loyalty_points` — adicionar cláusula `AND stores.plan_type <> 'pdv_only'` onde acessam via store_id (defensivo; UI já não chama, mas fecha a porta).
2. **Trigger** em `stores`: ao mudar `plan_type` pra `pdv_only`, setar `is_visible=false` automaticamente e cancelar entregas em aberto.
3. **`monthly-billing`**: pra loja `pdv_only`, cobrar só a mensalidade do plano (R$69) e **não** cobrar add-on PDV separado (já embutido). Confirmar que já está assim; corrigir se não.
4. **Cron / edge functions**: `orders-timeout-check`, `auto-refund`, `driver-arrival-check`, `weekly-payout` — early-return quando `plan_type='pdv_only'`.

## Fora de escopo
- Não redesenhar o PDV em si (layout do caixa fica igual).
- Não mexer em cobrança do Asaas além do filtro acima.
- Não migrar lojas existentes automaticamente — só afeta lojas novas ou que trocarem pra `pdv_only`.

## Entregáveis
1. ~8 arquivos frontend editados + 2–3 componentes novos (header do PDV, menu de perfil PDV, tela "Meu Plano" enxuta).
2. 1 oneshot edge function aplicando as policies e o trigger no Supabase externo.
3. Ajustes em 4 edge functions de cron pra early-return.
4. Bump de versão (patch) + nota ao usuário.

## Teste manual
- Criar loja fake PDV-only no super admin → login → cai direto no PDV, sem qualquer aba/menu de delivery, sem badge de pedidos, sem repasse.
- Buscar essa loja no marketplace → não aparece.
- Abrir `/loja/slug-dela` → 404.
- Super admin: aba Pedidos não lista essa loja; aba Lojas mostra com badge PDV.
