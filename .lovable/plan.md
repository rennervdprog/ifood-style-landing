# Auditoria Real — Motoboy Maria Eduarda (Cantinho da Silvia)

Correção prévia: a motoboy é **Maria Eduarda Olindo** (id `e48f975d…`), não "Ana". Cadastrada em 29/jun. Vínculo ativo com a loja via `store_drivers` (`payment_mode: fim_do_dia`, status `accepted`). Marcada `is_online: true` na tabela `drivers`.

---

## Dados reais coletados do Supabase externo

| Métrica | Valor real | Leitura |
|---|---|---|
| Pedidos entregues pela Maria (total) | **19** (100% finalizado) | volume saudável |
| Fonte | 17 `delivery` + 2 `manual` | quase tudo pelo app |
| Loja de origem | 100% Cantinho da Silvia | vínculo único |
| Tempo criação → confirmação | **média 23,4 min · máx 53,8 min · mín 5,8 min** | 🔴 muito alto |
| Pontos GPS enviados pela Maria | **0** | 🔴 rastreamento quebrado |
| Pontos GPS na base inteira (últimos 7d) | **3** (de outros motoboys) | 🔴 problema sistêmico |
| Tokens FCM da Maria | **0** | 🔴 sem push registrado |
| Tokens OneSignal da Maria | **0** | 🔴 sem push registrado |
| `driver_earnings` da Maria | 19 registros, R$ 84 total, **100% pendente** | acumulando sem baixa |
| `store_driver_earnings` (repasse) | `fee_total=2` · `platform_cut=2` · **`driver_amount=0`** | 🔴 split zerado |
| `driver_balances` | pending R$ 84 · pago R$ 0 | consistente com earnings |
| Solicitações de saque | 0 | nunca pediu |

---

## Achados críticos (ordem de gravidade)

### 🔴 P0 — Split de repasse zerando `driver_amount`
`store_driver_earnings` grava `fee_total=2`, mas `driver_amount=0` e `platform_cut=2`. Ou seja: a plataforma está ficando com 100% da taxa e a motoboy com nada — enquanto `driver_earnings` (tabela paralela) mostra R$ 4-6 por corrida. As duas tabelas estão contando coisas diferentes e a fonte da verdade para o app da loja está errada. **Risco financeiro imediato.**

### 🔴 P0 — GPS silenciosamente quebrado
A base inteira tem 3 linhas de `driver_locations` em 7 dias, de 3 motoboys diferentes, nenhum da Maria. O plugin nativo não está fazendo `insert`. Cliente não vê motoboy no mapa, loja não sabe onde está a entrega.

### 🔴 P0 — Push não registra
Nem FCM, nem OneSignal. O app está tentando notificar novo pedido para uma tabela vazia. Isso explica os **23 min médios** entre criação e confirmação: ela só vê quando abre o app.

### 🟡 P1 — Coluna dupla `driver_id` vs `assigned_driver_id`
`orders` tem as duas. Todos os 19 pedidos da Maria estão em `driver_id`; `assigned_driver_id` está sempre nulo. Código que filtra pela coluna errada mostra tela vazia.

### 🟡 P1 — Schema desalinhado com o código
Tentativas de query em `orders.picked_up_at`, `orders.accepted_at`, `orders.delivered_at`, `compliance_alerts.user_id`, `withdrawal_requests.user_id`, `store_driver_earnings.amount` retornaram `42703` (coluna não existe). O código do app faz `select` desses campos → provavelmente falha silenciosa via `.maybeSingle()` ou renderiza estado vazio.

---

## Plano de ação — v1.10.409 (tudo OTA)

### Fase 1 — Corrigir o dinheiro (P0, mesmo dia)

**1. Auditar split `store_driver_earnings`**
- Ler o trigger/edge function que popula essa tabela (busca por `store_driver_earnings` em `supabase/functions/`).
- Corrigir cálculo para gravar `driver_amount = valor da entrega` e `platform_cut = comissão da plataforma`, coerente com `driver_earnings.amount`.
- Backfill: recomputar as 19 linhas da Maria já existentes.

**2. Alinhar `driver_id` como única fonte da verdade**
- Grep global no app trocando queries de `assigned_driver_id` → `driver_id` (dashboard motoboy, KDS, admin, rastreamento).
- Manter `assigned_driver_id` só como legado (sem escrever mais).

### Fase 2 — Corrigir o rastreamento (P0)

**3. Registro de push obrigatório no boot do app motoboy**
- No `main.tsx` / `AuthContext`, quando `role === 'motoboy'` e sessão ativa, chamar `registerPushNotifications()` incondicionalmente e logar falha via Sentry.
- Migration: `ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS platform text` (para escolher canal certo).
- Edge function de push filtra por `platform`.

**4. GPS voltar a inserir**
- Revisar `driverGeolocation.ts` e `backgroundGeolocation.ts`: `Geolocation.requestPermissions()` sendo aguardado; `watchPosition` com `enableHighAccuracy: true`; log de erro em `sendLocation`.
- Throttle: envia se moveu >15 m **ou** passaram 30 s.
- Fallback: se `watchPosition` não emitir em 60 s, chamar `getCurrentPosition` a cada 30 s.
- Meta: em 10 min após deploy, ver ≥ 20 linhas da Maria em `driver_locations`.

### Fase 3 — Reduzir tempo de aceite (P0/UX)

**5. Alerta sonoro em loop + vibração até aceitar**
- Enquanto houver pedido `pronto_para_entrega` sem `driver_id`, som a cada 3 s e vibração pulsada (Capacitor Haptics).
- Badge "há X min aguardando" (amarelo >2min, vermelho >5min).

**6. Realtime filtrado**
- Canal `orders` do motoboy: `filter: 'driver_id=eq.<user_id>'` + canal separado para pedidos disponíveis por cidade/loja vinculada.
- Reduz payload ~80%.

### Fase 4 — Performance (P1)

**7. Lazy-load do mapa Leaflet** (`React.lazy` + `Suspense`).
**8. React Query `staleTime: 60_000` + `refetchOnWindowFocus: false`** em ganhos/saldo/histórico.
**9. Debounce 500 ms + estado otimista** no toggle online/offline.

### Fase 5 — Banco (migrations no externo, aprovar separado)

**10. Índices**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_driver_status
  ON orders (driver_id, status) WHERE driver_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_locations_user_updated
  ON driver_locations (driver_user_id, updated_at DESC);
```

**11. Purga diária** via `pg_cron`: `DELETE FROM driver_locations WHERE updated_at < now() - interval '7 days'` às 03:00.

---

## Segurança (verificação obrigatória)

- RLS mantida: `driver_user_id = auth.uid()` em `driver_locations` e `driver_earnings`; `driver_id = auth.uid()` em `orders`.
- Filtros de Realtime **reduzem payload**, não afrouxam policy — Postgres autoriza linha por linha.
- Nenhuma service key exposta no cliente.
- Após implementar Fase 1, rodar `security--run_security_scan` para validar que a correção do split não abriu policy.

---

## Ordem de execução

1. Fase 1 (dinheiro) → mais crítico, deploy OTA imediato.
2. Fase 2 (GPS + push) → mesmo release.
3. Fases 3-4 → mesmo release.
4. Validar em produção com a Maria (10 min de observação).
5. Fase 5 (migrations) → aprovar separado, sem novo APK.
6. Bump `APP_VERSION` → `1.10.409` em `src/lib/appVersion.ts` + `android/app/build.gradle`.

## Detalhes técnicos

Arquivos alvo: `src/lib/driverGeolocation.ts`, `src/lib/backgroundGeolocation.ts`, `src/lib/pushRegistration.ts`, `src/lib/orderNotifications.ts`, `src/pages/DriverDashboardV2.tsx`, `src/components/StoreDriverView.tsx`, `supabase/functions/*` (procurar `store_driver_earnings`).

Sem alteração em plugin nativo → **não requer novo APK** nem bump de `versionCode`. Rollback OTA da versão anterior fica disponível.

Aprova executar **Fase 1 (split de repasse)** primeiro?
