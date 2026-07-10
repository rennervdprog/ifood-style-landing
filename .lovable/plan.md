
# Plano — Pix Direto (com comprovante) — v2

Novo método de pagamento **offline** (igual dinheiro/maquininha na PDV): cliente paga direto na chave Pix do lojista, envia comprovante, lojista confirma o recebimento e o pedido entra em produção com **1 clique só**.

Backend: **Supabase EXTERNO** (`qkjhguziuchqsbxzruea`) — aplicado via edge function `oneshot-*` usando `EXTERNAL_SUPABASE_SERVICE_KEY`.

---

## 1. Regras de negócio

- Sem taxa Asaas (1,99%) — dinheiro cai direto na conta do lojista
- Entra na comissão mensal do plano (igual dinheiro/maquininha)
- Disponível para todos os planos (delivery e pdv_only)
- Timeout de **20 min** sem comprovante → auto-cancela
- Após comprovante enviado → **sem timeout**, aguarda lojista
- Comprovante **apagado imediatamente** quando lojista confirma
- Se recusado → comprovante fica **7 dias** (disputa) → cron apaga
- Confirmar recebimento = confirmar Pix + aceitar pedido em uma ação só

---

## 2. Backend — Supabase externo

### 2.1 Alterações em `stores`

Colunas novas:
- `pix_direto_enabled` boolean default false
- `pix_direto_key` text
- `pix_direto_key_type` text check in ('cpf','cnpj','email','phone','random')
- `pix_direto_beneficiary` text
- `pix_direto_instructions` text (opcional — mensagem custom pro cliente)

### 2.2 Alterações em `orders`

Colunas novas:
- `pix_proof_url` text (path relativo no bucket)
- `pix_proof_uploaded_at` timestamptz
- `pix_confirmed_at` timestamptz
- `pix_refused_at` timestamptz
- `pix_refused_reason` text
- `pix_expires_at` timestamptz

Novos status (string livre já usada em `orders.status`):
- `aguardando_comprovante`
- `comprovante_enviado`
- `pix_direto_recusado`

Index parcial:
```sql
create index orders_pix_pending_idx on public.orders(store_id, created_at desc)
where status in ('aguardando_comprovante','comprovante_enviado');
```

Adicionar `pix_direto` como valor válido em `payment_method`.

### 2.3 Bucket `pix-proofs` (privado)

- Público: **NÃO**
- Path: `{store_id}/{order_id}.{ext}` (jpg/png/pdf)
- Limite: 5 MB
- MIME allowlist enforçado no frontend + validado em RPC

**RLS em `storage.objects`:**
- INSERT: dono do pedido (auth.uid = orders.user_id **OU** guest com `anon_session_id` bate)
- SELECT: dono da loja (via `store_id` no path)
- DELETE: `service_role` apenas (via edge function)

### 2.4 RPCs (todas `SECURITY DEFINER`, `search_path=public`)

| RPC | Assinatura | Regras |
|---|---|---|
| `create_pix_direto_order` | `(p_payload jsonb) returns uuid` | valida `pix_direto_enabled=true` + chave preenchida; cria pedido com `status='aguardando_comprovante'`, `pix_expires_at=now()+interval '20 min'`, `payment_method='pix_direto'` |
| `attach_pix_proof` | `(p_order_id uuid, p_proof_path text, p_anon_session text default null) returns void` | valida posse (auth.uid = user_id OR anon_session bate); valida `status='aguardando_comprovante' AND now() < pix_expires_at`; atualiza url + status `comprovante_enviado` |
| `confirm_pix_proof` | `(p_order_id uuid) returns void` | valida lojista dono da loja; muda status para o "aceito padrão" da loja (`confirmed`); grava `pix_confirmed_at`; retorna `pix_proof_url` pra edge apagar |
| `refuse_pix_proof` | `(p_order_id uuid, p_reason text) returns void` | valida lojista dono + `p_reason` não vazio; status = `pix_direto_recusado` |
| `expire_pending_pix_orders` | `() returns int` | cancela pedidos `aguardando_comprovante` expirados; retorna count |
| `cleanup_refused_pix_proofs` | `() returns setof (order_id uuid, proof_path text)` | lista recusados > 7 dias com url; edge remove e zera coluna |

Cada RPC recebe `GRANT EXECUTE TO authenticated` (e `anon` só nas 2 usadas por guest).

### 2.5 Edge Functions (deploy via `deploy-external.mjs`)

**`pix-direto-notify`** — invocada após `attach_pix_proof`:
- push (OneSignal + FCM) para o lojista
- WhatsApp (Evolution) se configurado (fallback silencioso)
- tolera ausência de token/whatsapp

**`pix-direto-confirm`** — wrapper:
1. chama RPC `confirm_pix_proof` (retorna `pix_proof_url`)
2. `storage.remove([path])` no bucket `pix-proofs`
3. notifica cliente (push + toast via realtime) "Pagamento confirmado 👨‍🍳"

**`pix-direto-refuse`** — wrapper:
1. chama RPC `refuse_pix_proof`
2. notifica cliente com motivo

**`pix-direto-cron`** — chamada 2 vias:
- a cada 5 min → `expire_pending_pix_orders`
- 1x/dia (04:00 BRT) → `cleanup_refused_pix_proofs` + remove arquivos

**`oneshot-pix-direto-external`** — aplica toda a migration SQL + cria bucket + policies via `EXTERNAL_SUPABASE_SERVICE_KEY` (idempotente).

### 2.6 Cron

`pg_cron` no externo:
```sql
select cron.schedule('pix-direto-expire','*/5 * * * *',
  $$select net.http_post(url:='.../functions/v1/pix-direto-cron?job=expire', ...)$$);
select cron.schedule('pix-direto-cleanup','0 7 * * *', -- 04:00 BRT
  $$select net.http_post(url:='.../functions/v1/pix-direto-cron?job=cleanup', ...)$$);
```

---

## 3. Frontend — Painel do lojista

### 3.1 Config integrada à aba **Métodos de Pagamento**

**Mudança pedida pelo usuário:** não criar seção separada — integrar no card de métodos de pagamento existente (dentro de `StoreSettings`).

Layout dentro da aba Métodos de Pagamento:

```text
Métodos aceitos
─────────────────────────────────
[✓] Cartão de crédito
[✓] Cartão de débito
[✓] Dinheiro
[✓] Pix na maquininha
[✓] Pix automático (Asaas 1,99%)

[ ] 🔑 Pix direto (comprovante)      ← switch novo
     Sem taxa. Cliente paga na sua chave
     e envia o comprovante pra você conferir.
─────────────────────────────────
```

Quando o switch **está ligado**, expande abaixo um card `PixDiretoConfigCard`:

```text
┌── 🔑 Pix Direto ─────────────────┐
│ Tipo da chave    [CPF ▼]         │
│ Chave Pix        [___________]   │
│ Beneficiário     [___________]   │
│                                  │
│ Instruções extras (opcional):    │
│ [textarea 200 chars]             │
│                                  │
│ ─── Preview pro cliente ───      │
│ ┌────────────────────────┐       │
│ │ Beneficiário           │       │
│ │ João da Silva          │       │
│ │ Chave (CPF)            │       │
│ │ 123.456.789-01 [Copiar]│       │
│ └────────────────────────┘       │
│                                  │
│ ℹ️ O dinheiro cai direto na sua  │
│    conta. Você precisa confirmar │
│    cada pagamento antes do       │
│    pedido ir pra produção. A     │
│    comissão do plano continua    │
│    contando normalmente.         │
│                                  │
│ [Salvar]                         │
└──────────────────────────────────┘
```

- Desligar o switch → confirm dialog "Desativar Pix direto?" (mantém dados salvos, só zera `pix_direto_enabled`)
- Validação: se ligar sem chave preenchida, bloqueia salvar e destaca campo
- Formata a chave usando `pixFormat.ts` já existente
- Componente novo: `src/components/pix-direto/PixDiretoConfigCard.tsx`
- Alterado: `src/components/StoreSettings.tsx` (ou o card de payment methods dentro dele) para renderizar o switch + card

### 3.2 Nova seção no painel de pedidos

Em `OrdersSection.tsx`, novo bloco **no topo** (acima de "Novos"):

```text
┌──────────────────────────────────┐
│ 🔑 AGUARDANDO PIX (2)      🔊    │  ← badge amarelo pulsante
├──────────────────────────────────┤
│ #1234  João  R$45,00  há 3 min   │
│ [Ver comprovante]                │
│ [✅ Confirmar]  [❌ Recusar]      │
└──────────────────────────────────┘
```

- Query nova: `orders where status='comprovante_enviado' and store_id=X`
- Hook novo `usePixDiretoPending(storeId)` — usa realtime channel já existente
- Toca som a cada 60s enquanto tiver pendente (respeita `sound_enabled`)
- Card componente: `PixDiretoOrderCard.tsx`

### 3.3 Modais

**`PixProofViewModal.tsx`** — preview do comprovante:
- Imagem: `<img>` com zoom pinch/scroll
- PDF: `<iframe src=signedUrl>` + botão "Abrir em nova aba"
- URL: signed URL TTL 5 min gerada só ao abrir modal
- Rodapé: [Confirmar] [Recusar] [Fechar]

**`PixConfirmModal.tsx`** — dupla confirmação:
```text
⚠️ Tem certeza?
Confirme apenas se R$ 45,00 realmente
caiu na sua conta Pix.
Ao confirmar, o pedido vai direto pra
produção. Ação irreversível.

[Cancelar]  [Sim, recebi o valor]
```

**`PixRefuseModal.tsx`** — motivo obrigatório:
```text
Motivo da recusa:
○ Valor divergente
○ Não recebi o valor
○ Comprovante suspeito/falso
○ Outro (descreva)
[textarea]

[Cancelar]  [Recusar pedido]
```

---

## 4. Frontend — Cliente

### 4.1 Checkout (`CartPage.tsx` + `GuestCheckoutPage.tsx`)

Nova opção no seletor de método (só aparece se `stores.pix_direto_enabled=true`):

```text
🔑 Pix direto (enviar comprovante)
   Sem taxa • Pague na chave da loja
```

Ao selecionar + finalizar:
- **NÃO** chama o fluxo padrão de criar pedido
- Chama RPC `create_pix_direto_order` com o payload do carrinho
- `navigate('/pix-direto/:orderId')`

### 4.2 Tela nova `PixDiretoPaymentPage.tsx` (rota `/pix-direto/:orderId`)

Mobile-first, tela cheia. Estados:

**Estado 1 — aguardando_comprovante:**
```text
┌──────────────────────────────┐
│ ← Pix Direto                 │
├──────────────────────────────┤
│ ⏱ Expira em 19:32            │
│                              │
│ Beneficiário                 │
│ João da Silva                │
│                              │
│ Chave Pix (CPF)              │
│ 123.456.789-01     [Copiar]  │
│                              │
│ Valor a pagar                │
│ R$ 45,00           [Copiar]  │
│                              │
│ ─────────────────────────    │
│ Passo a passo:               │
│ 1. Abra seu banco            │
│ 2. Faça o Pix pelo app       │
│ 3. Envie o comprovante       │
│                              │
│ [📎 Enviar comprovante]      │
│ Aceita: foto (JPG/PNG) ou PDF│
│ Máx 5 MB                     │
└──────────────────────────────┘
```

**Estado 2 — enviando:** botão com spinner
**Estado 3 — comprovante_enviado:** tela de sucesso + link "Acompanhar pedido"
**Estado 4 — expirado/cancelled:** "⏰ Tempo esgotado" + botão "Fazer novo pedido"
**Estado 5 — confirmed:** redirect automático para tracking do pedido
**Estado 6 — pix_direto_recusado:** motivo + link "Falar com a loja" (WhatsApp)

### 4.3 Componentes novos

- `src/pages/PixDiretoPaymentPage.tsx`
- `src/components/pix-direto/PixKeyDisplay.tsx` — reusa `formatPixKeyDisplay`
- `src/components/pix-direto/PixCopyButton.tsx` — usa `copyToClipboard` + toast + haptic
- `src/components/pix-direto/PixCountdown.tsx` — timer regressivo
- `src/components/pix-direto/PixProofUpload.tsx` — input file + preview + compressão de imagem via `compressImage.ts` existente
- `src/hooks/usePixCountdown.ts`
- `src/hooks/usePixDiretoOrder.ts` — subscription realtime pra mudanças de status

### 4.4 Notificações ao cliente

- **Comprovante enviado** → toast local
- **Lojista confirmou** → push "🎉 Pagamento confirmado" + redirect tracking
- **Lojista recusou** → push "❌ Pagamento não confirmado — motivo: X"
- **Expirou** → toast "Tempo esgotado, pedido cancelado"

---

## 5. Testes (obrigatório antes de release)

### 5.1 Deno tests (edge functions)

`supabase/functions/pix-direto-confirm/index.test.ts`
- ✅ Confirma pedido válido → status muda, retorna proof path
- ❌ Loja de outro dono → 403
- ❌ Status errado → 400
- ✅ Chama `storage.remove` com path correto

`supabase/functions/pix-direto-refuse/index.test.ts`
- ✅ Motivo vazio → 400
- ✅ Motivo válido → status muda, mantém arquivo

`supabase/functions/pix-direto-notify/index.test.ts`
- ✅ Dispara push
- ✅ WhatsApp opcional (loja sem device conectado → sucesso)

`supabase/functions/pix-direto-cron/index.test.ts`
- ✅ `?job=expire` cancela > 20 min
- ✅ `?job=expire` não toca comprovante enviado
- ✅ `?job=cleanup` remove arquivos > 7 dias

### 5.2 Testes de RPC (script Deno `scripts/test-pix-direto-rpcs.mjs`)

Fixture cria loja + usuário + pedido no externo e:
- `create_pix_direto_order` com loja sem chave → erro
- `attach_pix_proof` fora do prazo → erro
- `attach_pix_proof` por usuário errado → erro
- `confirm_pix_proof` por não-dono → erro
- `refuse_pix_proof` motivo vazio → erro
- Fluxo feliz completo → status final `confirmed`

### 5.3 Unit tests frontend (vitest)

- `src/hooks/__tests__/usePixCountdown.test.ts` — timer + expiração
- `src/components/pix-direto/__tests__/PixKeyDisplay.test.tsx` — cada tipo formatado
- `src/components/pix-direto/__tests__/PixProofUpload.test.tsx` — valida MIME + tamanho

### 5.4 Smoke E2E manual (adicionar em `docs/smoke-checklist.md`)

1. Lojista abre aba Métodos de Pagamento → liga switch → preenche chave → salva
2. Cliente vê nova opção no checkout
3. Cliente finaliza → cai na tela Pix com dados corretos
4. Cliente envia foto (< 5MB, jpg) → pedido aparece na seção "Aguardando Pix" do lojista com som
5. Lojista clica "Ver comprovante" → modal abre com signed URL
6. Lojista confirma → cliente recebe push, tela vira tracking, arquivo some do bucket
7. Segundo fluxo: lojista recusa com motivo → cliente recebe push
8. Terceiro fluxo: cliente não envia em 20 min → cron cancela

---

## 6. Arquivos

**Novos:**
- `scripts/pix-direto-external.sql` (migration completa pro externo)
- `supabase/functions/oneshot-pix-direto-external/index.ts`
- `supabase/functions/pix-direto-notify/{index.ts, index.test.ts}`
- `supabase/functions/pix-direto-confirm/{index.ts, index.test.ts}`
- `supabase/functions/pix-direto-refuse/{index.ts, index.test.ts}`
- `supabase/functions/pix-direto-cron/{index.ts, index.test.ts}`
- `src/pages/PixDiretoPaymentPage.tsx`
- `src/components/pix-direto/PixDiretoConfigCard.tsx`
- `src/components/pix-direto/PixDiretoOrderCard.tsx`
- `src/components/pix-direto/PixKeyDisplay.tsx`
- `src/components/pix-direto/PixCopyButton.tsx`
- `src/components/pix-direto/PixCountdown.tsx`
- `src/components/pix-direto/PixProofUpload.tsx`
- `src/components/pix-direto/PixProofViewModal.tsx`
- `src/components/pix-direto/PixConfirmModal.tsx`
- `src/components/pix-direto/PixRefuseModal.tsx`
- `src/hooks/usePixCountdown.ts`
- `src/hooks/usePixDiretoOrder.ts`
- `src/hooks/usePixDiretoPending.ts`
- `scripts/test-pix-direto-rpcs.mjs`

**Alterados:**
- `src/components/StoreSettings.tsx` — switch + card Pix Direto na aba Métodos de Pagamento
- `src/pages/CartPage.tsx` — nova opção de pagamento
- `src/pages/GuestCheckoutPage.tsx` — nova opção de pagamento
- `src/pages/admin/sections/OrdersSection.tsx` — seção "Aguardando Pix" no topo
- `src/App.tsx` — rota `/pix-direto/:orderId` (lazy)
- `docs/smoke-checklist.md` — passos novos
- `src/lib/appVersion.ts` + `android/app/build.gradle` — bump para v1.14.0 (build 874)

---

## 7. Ordem de execução

1. Criar `scripts/pix-direto-external.sql` + edge `oneshot-pix-direto-external`, aplicar no externo (bucket + colunas + RPCs + policies + cron)
2. Deploy edges `notify` / `confirm` / `refuse` / `cron` + rodar testes Deno
3. Rodar `scripts/test-pix-direto-rpcs.mjs` contra o externo
4. Config no painel (switch + card em Métodos de Pagamento)
5. Checkout + `PixDiretoPaymentPage`
6. Seção "Aguardando Pix" no painel + modais
7. Smoke E2E manual completo
8. Bump versão + release

---

## 8. Detalhes técnicos importantes

- **Timezone:** `pix_expires_at` sempre UTC; frontend usa `new Date()` local (JS resolve).
- **Realtime:** reusa canal existente `orders:store_id=eq.X`; filtra por status novo.
- **Storage:** delete só via service_role em edge function.
- **Segurança:** `attach_pix_proof` valida `auth.uid()` OU `anon_session_id` (guest).
- **Signed URL:** TTL 5 min, gerada só quando lojista abre modal.
- **Path:** `store_id/order_id.ext` — regra RLS extrai `store_id` do path para SELECT.
- **Compressão:** imagens > 1MB passam por `compressImage.ts` antes do upload.
- **Debounce:** `PixConfirmModal` desabilita botão por 500ms depois do click pra evitar duplo confirm.
- **Concorrência:** RPC `confirm_pix_proof` faz `UPDATE ... WHERE status='comprovante_enviado'` e verifica linhas afetadas — evita race entre 2 abas do lojista.

