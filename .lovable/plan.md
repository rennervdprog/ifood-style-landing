# Plano PDV ItaSuper — correções do relatório

Baseado no `Relatorio-PDV-ItaSuper_1.md`. Só o que já existe no código atual (`src/pages/pdv/*`, `src/lib/thermalPrint.ts`, tabelas `pdv_sessions` / `pdv_movements` / `orders`) — nada novo de mercado (KDS, totem, NFC-e, TEF, balança, código de barras ficam fora).

## Fase 1 — Bugs P0 (crítico, mesmo dia)

1. **XSS na impressão térmica** (`src/lib/thermalPrint.ts:507`)
   - Trocar `innerHTML` de campos do pedido por `textContent` / builder DOM. Nome do cliente, observação e nome do produto hoje entram crus.
2. **Checkout não-atômico** (`src/pages/pdv/state/usePdvCheckout.ts:119-172`)
   - 3 inserts sequenciais (order → items → movements). Se cair no meio, fica pedido sem itens ou sem movimento.
   - Criar RPC `pdv_finalize_sale(payload jsonb)` no Supabase externo que faz tudo em uma transação. Client chama só a RPC.
3. **`removeItem` apaga todas as linhas do produto** (`PdvCartSection.tsx:107`)
   - Passar `cartIndex` em vez de `id` para o remover; ajustar `usePdvCart.removeItem`.
4. **Merge errado no carrinho** (`usePdvCart.ts:109`)
   - Chave de agregação precisa incluir `observations` além de `id + addons`.
5. **Closure stale no atalho F4** (`PdvPage.tsx:413`)
   - Corrigir deps do `useCallback cyclePayment` (incluir `paymentMethod`, `splitMode`).

## Fase 2 — P1 (semana)

6. **Sessão duplicada** (`usePdvSession.ts:57`): antes do insert, `checkSession()` de novo; e criar `UNIQUE INDEX pdv_sessions (store_id) WHERE status='open'` (migration no banco externo).
7. **`created_by` / `closed_by`** em `pdv_movements` e `pdv_sessions` — auditoria de operador.
8. **F8 dentro de input** (`usePdvShortcuts.ts:56`): ignorar quando `document.activeElement` for input/textarea.
9. **Timezone no cupom** (`thermalPrint.ts:363`): usar `toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })`.
10. **`auto_print_pdv` com settings null** (`usePdvCheckout.ts:201`): default explícito.
11. **Confirmação ao limpar carrinho / sair do PDV com carrinho cheio** (`PdvCartSection`, `PdvTopbar`) via `useConfirmDialog` já existente.
12. **Enter abre caixa / bloqueio de fechamento vazio / autoFocus em sangria** — pequenos ajustes de forms nas telas de abertura, fechamento e movimento.
13. **CHECK constraints** em `pdv_movements` (`amount > 0`, `type IN (...)`).

## Fase 3 — Resiliência offline (Quick win já discutido antes)

Já conversamos disso pro Cantinho. Entra aqui sem inventar nada novo:

14. Wrapper `AbortController` + timeout 3s no `handleVenda` e `handleMovement`.
15. Fila em `localStorage` (`pdv:pending:<sessionId>`) para vendas que falharem.
16. Badge "Sincronizar (N)" no `PdvStatusBar` + botão flush manual.
17. Quando a RPC da Fase 1.2 existir, ela vira idempotente por `client_uuid` — flush fica seguro.

## Fase 4 — UX / acessibilidade pequenas

18. `aria-label` nos +/- do catálogo, `role=tablist` nas abas do PDV, `padding-bottom` safe-area no fechamento (iOS).
19. Dedup do bloco de impressão em `buildReceiptPayload()` dentro de `usePdvCheckout`.
20. `movements` nas deps do `useMemo` em `PdvRelatorios.tsx:186`.

## Fora de escopo (mesmo estando no relatório)

- KDS, autoatendimento/totem, cardápio QR, NFC-e/SAT, TEF, balança, código de barras, IA/chatbot, multi-terminal em LAN. São features novas de mercado — só entram se você pedir.

## Entrega

- Cada fase = um commit + bump de versão (patch) no `appVersion.ts` + `build.gradle` (versionName + versionCode).
- Sem mudança de plano de infra, sem novas dependências além do que já está no projeto (`DOMPurify` só se você preferir sanitizar em vez de reescrever com `textContent`).
