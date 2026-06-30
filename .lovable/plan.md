# Plano: Pré-Pedido com Disparo Agendado

> Backend: **Supabase EXTERNO** (`qkjhguziuchqsbxzruea`). Lovable Cloud não será tocado.

## Objetivo

Permitir que o lojista aceite pedidos até **X minutos antes** de abrir. O cliente faz o pedido normalmente, mas a loja **só recebe o alerta sonoro, WhatsApp e impressão no horário oficial de abertura** — evitando que o motoboy/atendente seja acordado fora do expediente.

## Como o cliente e o lojista verão

**Cliente:**
- Card da loja mostra badge azul "Pré-pedido · abre 18:00"
- Checkout exibe aviso: *"Sua loja abre às 18:00. Confirmaremos seu pedido nesse horário."*
- Pedido aparece em "Meus pedidos" com status **Agendado**

**Lojista:**
- Em *Configurações → Horários*: novo toggle **"Aceitar pré-pedido"** + campo "minutos antes" (padrão 60)
- Pedidos agendados ficam em uma aba separada **"Agendados"** (sem som, sem impressão) até o horário
- No horário de abertura, o pedido **migra automaticamente** para "Novos" → toca som, imprime e dispara WhatsApp normal

## Fases

### Fase 1 — Banco externo (migração SQL)
- `stores`: adicionar `preorder_enabled boolean default false`, `preorder_minutes_before int default 60`
- `orders`: adicionar `release_at timestamptz null` + novo valor `'scheduled'` em status
- Função `release_scheduled_orders()` (SECURITY DEFINER) que move pedidos `scheduled` com `release_at <= now()` para `pending` e dispara os triggers existentes de notificação
- Cron `pg_cron` rodando a cada 1 minuto chamando a função
- Atualizar `getStoreOpenStatus` para retornar `acceptingPreorder: true` quando faltarem ≤ N min para abrir

### Fase 2 — Lojista (UI)
- `StoreHoursManager.tsx`: bloco "Pré-pedido" com switch + input de minutos
- `OrdersSection.tsx`: nova sub-aba "Agendados" com contagem e horário de disparo de cada pedido
- Persistência via update direto em `stores` no banco externo

### Fase 3 — Cliente (UI)
- `StoreCard` / `stores_public`: badge "Pré-pedido · abre HH:MM" quando `acceptingPreorder`
- `CheckoutPage`: aviso amarelo explicando o agendamento + checkbox de confirmação
- Ao criar pedido, calcular `release_at` = próximo horário de abertura e gravar `status='scheduled'`

### Fase 4 — Disparo & notificações
- Trigger `on_order_released` já existente: garantir que dispara som/WhatsApp/print só quando vem de `scheduled → pending` (não duplicar)
- Edge function `evolution-webhook`: ignorar pedidos `scheduled` no envio inicial
- Realtime: cliente recebe push "Seu pedido foi confirmado" quando soltar

### Fase 5 — Rollout seguro
- Feature ligada **por loja** (desativada por padrão) — Cantinho da Silvia ativa primeiro como piloto
- Botão "Cancelar pré-pedido" para o cliente até 15 min antes do disparo
- Log em `admin_logs` de cada release automático
- Bump de versão (1.10.365) + versionCode 694

## Detalhes técnicos

**Status flow:**
```text
cliente cria → scheduled (release_at = 18:00)
                    ↓ pg_cron 1min
                  pending (18:00) → toca som/print/WhatsApp
                    ↓
                  accepted → ... → delivered
```

**Cálculo do `release_at`:** usa `opening_hours` da loja + timezone `America/Sao_Paulo`; se a loja já está aberta, vira pedido normal (`pending`) — sem agendamento.

**Segurança:**
- RLS em `orders` mantida; cliente só vê os próprios `scheduled`
- Função `release_scheduled_orders` com `SECURITY DEFINER` + `search_path = public`
- Validação no trigger para impedir `release_at` > 24h no futuro (evita abuso)

## Fora de escopo (próxima fase)
- Agendamento para data futura (ex: pedido para amanhã)
- Pré-pedido recorrente
- Pré-pedido com pagamento Pix segurado (autoriza só no disparo)
