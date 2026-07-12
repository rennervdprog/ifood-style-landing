# Impressão automática confiável (delivery)

## Problema
Mesmo com "Impressão automática" ligada nas configurações, o lojista precisa clicar manualmente em "Imprimir" na aba Pedidos. Hoje a impressão depende de **3 chaves ao mesmo tempo** e de vários gatilhos frágeis — qualquer falha silenciosa faz o pedido não sair.

Causas prováveis (levantadas no código atual `AdminDashboardV2.tsx` + `thermalPrint.ts`):

1. **Toggle local `localStorage.autoPrint`** convive com o setting do banco. Se o lojista já clicou uma vez no sino do topo, ele vira `false` naquele navegador e sobrepõe a configuração — parece "ligado" nas Configurações mas está desligado no dispositivo.
2. **Dedupe em `sessionStorage`** por aba: se o navegador bloqueou o pop-up ou fechou a janela antes de imprimir, a chave já foi gravada e o pedido nunca mais tenta.
3. **Pop-up blocker do Chrome/Edge**: `printThermalReceipt` abre `window.open` fora de gesto do usuário → maioria dos navegadores bloqueia silenciosamente. Não há feedback nenhum.
4. **Realtime pode não disparar** (canal caído, aba em background com throttling), e o "sweep" só roda quando o painel abre/reconecta — pedidos que entram com a aba em segundo plano só imprimem quando a aba volta ao foco.
5. **PIX confirmado (`aguardando_pagamento → pendente`)**: se o webhook chega antes do INSERT ser processado no cliente, a lógica de UPDATE não acha o pedido em cache e ignora.
6. **Sem observabilidade pro lojista** — os `console.info("[auto-print]…")` só aparecem no DevTools; ele não tem como saber por que não imprimiu.

## Objetivo
Impressão sair **sozinha em 100% dos pedidos de delivery** enquanto o painel estiver aberto, com diagnóstico visível quando não sair.

## Escopo (6 correções)

### 1. Unificar a fonte da verdade
- Remover o override oculto do `localStorage.autoPrint`. O sino do topo passa a **espelhar e alterar** `store.settings.auto_print_delivery` no banco (com optimistic update).
- Uma única regra: `settings.auto_print_delivery !== false` → imprime.
- Migrar valores locais existentes (uma leitura na inicialização; se `false`, propõe manter desligado nas configurações e mostra aviso).

### 2. Dedupe persistente e recuperável
- Trocar `sessionStorage["printed-order:{id}"]` por coluna `orders.printed_at timestamptz` (server-side) + fallback em `localStorage` (não sessionStorage).
- Só marca `printed_at` **depois** que `printThermalReceipt` confirmar que a janela abriu (ver #3).
- Sweep passa a buscar `printed_at IS NULL AND status='pendente' AND created_at > now() - interval '6h'` (era 2h e dependia de flag local).

### 3. Detectar bloqueio de pop-up
- `printThermalReceipt` já usa `window.open`; capturar o retorno: se `null`, **não** marcar como impresso, mostrar toast persistente "Pop-up bloqueado — clique para imprimir #1234" com botão que reabre no gesto do usuário.
- Enfileirar pedidos bloqueados num badge visível no header ("3 pedidos aguardando impressão"). Clique único imprime todos em sequência.
- Instruir uma vez (primeira execução) a liberar pop-ups do domínio via banner no painel.

### 4. Gatilhos redundantes
Além do Realtime INSERT/UPDATE atuais:
- **Polling leve** a cada 20s buscando `printed_at IS NULL AND status='pendente'` das últimas 6h (custa 1 select indexado).
- **Refetch on focus** já existe no react-query — hook explícito para rodar o sweep sempre que a aba volta a ficar visível (`visibilitychange`).
- **Wake lock** opcional (`navigator.wakeLock`) para manter a aba viva quando o lojista deixa o painel aberto no tablet da cozinha.

### 5. Robustez do fluxo PIX → pendente
- No handler de UPDATE, se o pedido não estiver em cache, buscar direto do banco antes de decidir imprimir (evita o "pulou porque não achei").
- Garantir que `aguardando_pagamento → pendente` **sempre** cai no mesmo caminho de INSERT (função única `enqueueAutoPrint(orderId)`).

### 6. Observabilidade pro lojista
- Nova aba "Diagnóstico de impressão" dentro de Configurações → Impressão:
  - Últimos 20 pedidos com status: `impresso`, `bloqueado (popup)`, `desligado`, `erro`.
  - Botão "Testar impressão agora" que gera um cupom fake.
  - Indicador ao vivo do canal Realtime (verde/vermelho) e do último polling.
- Logs `[auto-print]` continuam no console, mas agora com `printed_at` no banco dá pra auditar remotamente.

## Fora de escopo
- PDV (usa outro fluxo).
- Impressão via bridge nativa (USB/Bluetooth direto) — continua sendo `window.open` do navegador.
- App mobile / notificação push para impressão.

## Detalhes técnicos

**Migração backend:**
```sql
ALTER TABLE public.orders ADD COLUMN printed_at timestamptz;
CREATE INDEX orders_pending_unprinted_idx
  ON public.orders (store_id, created_at DESC)
  WHERE printed_at IS NULL AND status = 'pendente';
```
Policy: `UPDATE printed_at` liberado para dono da loja (já coberto pela policy geral de `orders`).

**Arquivos afetados:**
- `src/pages/AdminDashboardV2.tsx` — remover override local, unificar `enqueueAutoPrint`, adicionar fila de bloqueados, polling, visibilitychange, wake lock.
- `src/lib/thermalPrint.ts` — retornar `boolean` (janela abriu?) em vez de `void`.
- `src/pages/admin/tabs/SettingsTab.tsx` (aba Impressão) — nova seção Diagnóstico + botão de teste.
- `src/components/admin/PrintQueueBadge.tsx` (novo) — badge no header.
- `supabase/migrations/*_orders_printed_at.sql` (nova).

**Rollout:**
1. Migração + coluna (sem quebrar nada, default null).
2. Deploy do front com fonte única de verdade + fila de bloqueados.
3. Monitorar por 48h via nova aba de diagnóstico; ajustar intervalo do polling se necessário.

Versão prevista após aplicar: **v1.14.18 (build 953)**.
