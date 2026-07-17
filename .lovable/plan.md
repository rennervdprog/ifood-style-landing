# PDV — Plano para fechar os gaps auditados

Ordenado por **impacto no lojista × esforço**. Cada fase sobe versão (core rule) e vira testável isoladamente. Nada de escopo novo além do que a auditoria listou.

---

## Fase 1 — Consertar o que está parcial (2-3 dias, baixo risco)

Foco: fechar buracos silenciosos sem features novas.

1. **Migração versionada da Fase B**
   - Criar `supabase/migrations/*_pdv_tables_tabs.sql` espelhando o que o `oneshot-pdv-fase-b-tables` já criou no banco (tabelas + 6 RPCs + GRANTs + RLS + realtime + REPLICA IDENTITY).
   - Idempotente (`IF NOT EXISTS`) para não quebrar produção.
2. **Cupom de cancelamento**
   - `PdvCancelSaleDialog.tsx` chama `printCancelReceipt()` novo em `thermalPrint.ts` (motivo, operador, valor, id da venda) após `pdv_cancel_sale` OK.
3. **Trilha por operador PIN**
   - `usePdvSession.ts` e `usePdvCheckout.ts` passam `operator_id` (do login por PIN) para `pdv_sessions.opened_by_operator_id` e `pdv_movements.operator_id`. Migração adiciona as duas colunas nullable.
4. **Renomear rota do cardápio PDV**
   - Adicionar rota-alias `/admin/pdv/cardapio` → mesma tela, sem quebrar `/admin/cardapio`.
5. **Sangria com categoria enum**
   - Trocar texto livre por `Select` fixo: `troco | deposito | retirada_dono | despesa | outro`. Coluna `pdv_movements.reason_category`.
6. **Favoritos: label correto**
   - Renomear "Favoritos do turno" → "Mais vendidos (30d)". Sem mudar a query.
7. **Testes**
   - Adicionar Playwright E2E cobrindo: PIN login → abrir caixa → venda → sangria → cancelamento → Z-report → fechar caixa.
   - Vitest para `printCancelReceipt`.

Versão: **v1.16.2**.

---

## Fase 2 — Alçada de gerente + divisão por pessoa (3-4 dias)

Features mais pedidas por bar/restaurante.

8. **Alçada de gerente**
   - `admin_settings.pdv_sangria_manager_limit` (default R$ 200).
   - Se sangria > limite → dialog exige PIN de um `pdv_operator` com `role='gerente'` (nova coluna `pdv_operators.role`).
   - Log em `pdv_movements.authorized_by_operator_id`.
9. **Divisão de conta por pessoa**
   - Ampliar `PdvSplitPayment.tsx`: modo "por pessoa" divide total em N partes iguais ou custom, cada pessoa escolhe forma.
   - Impressão de comprovante por pessoa (Nº 1/4, 2/4…).
   - Aproveita `pdv_close_tab(_payments jsonb)` — só a UI muda; RPC já aceita array.

Versão: **v1.17.0**.

---

## Fase 3 — Hardware balcão (2 dias)

10. **Comando ESC/POS gaveta**
    - Adicionar `openCashDrawer()` em `thermalPrint.ts` enviando `ESC p 0 25 250` na mesma conexão da impressora.
    - Disparar automaticamente ao finalizar venda em dinheiro; botão manual em Turno.
    - Feature-flag `store.settings.pdv_drawer_enabled`.

11. **Balança Toledo Prix** *(atrás de feature-flag, só se lojista pedir)*
    - `src/lib/toledoScale.ts` via Web Serial API (protocolo Prix 3/4).
    - `PdvWeightDialog.tsx` ganha botão "Ler balança".
    - Não bloqueia — é opcional, some se navegador não suporta.

Versão: **v1.17.5**.

---

## Fase 4 — Multi-terminal + KDS do PDV (4-5 dias)

12. **Múltiplos terminais na mesma loja**
    - Migração: `pdv_terminals(id, store_id, label, last_seen_at)` + `pdv_sessions.terminal_id`.
    - Login PDV escolhe/cria terminal (localStorage guarda `terminal_id`).
    - Relatório Z filtra por terminal; dashboard "Agora" mostra por terminal.

13. **KDS do PDV com bump**
    - Nova rota autenticada `/admin/pdv/kds` (não a `/kds/:token` pública).
    - Lê `pdv_tab_items` em preparo agrupados por mesa/comanda.
    - Estados: `pendente → preparando → pronto → entregue`, com botão "bump" único por item.
    - Coluna `pdv_tab_items.kds_status` + `bumped_at` + `bumped_by`.
    - Realtime já ativo nas tabelas (Fase B).

Versão: **v1.18.0**.

---

## Fase 5 — Fiscal NFC-e (2 semanas, depende de credencial)

14. **Emissão NFC-e via Focus NFe**
    - Migração: `fiscal_documents(id, store_id, order_id, chave, xml, pdf_url, status, error)`.
    - Edge function `pdv-nfce-issue` (assinada JWT, POST Focus NFe).
    - Secret `FOCUS_NFE_TOKEN` (add_secret quando lojista pedir).
    - Botão "Emitir NFC-e" em `PdvCheckoutDialog` após venda finalizada; campo CPF/CNPJ opcional.
    - Contingência: se Focus falhar, marca `status='contingencia'` e cron `nfce-retry` reenvia a cada 5 min.
    - Cupom impresso ganha QR Code + chave.

Versão: **v1.19.0**.

---

## Fase 6 — Fidelidade no PDV (2 dias)

15. **Resgate de pontos no checkout**
    - `PdvCheckoutDialog` mostra saldo do cliente (busca por CPF/telefone em `loyalty_points`).
    - Botão "Usar X pontos = R$ Y" aplica desconto e grava `loyalty_points.redemption`.
    - Acúmulo automático pós-venda (já existe lógica no delivery — reaproveitar `applyLoyaltyEarn`).

Versão: **v1.19.5**.

---

## Fora deste plano (explícito)

- Estoque perpétuo, compras/fornecedores, ficha técnica com baixa automática
- TEF/Pinpad (custo alto, só sob demanda)
- SAT (só SP, NFC-e cobre 96% dos casos)
- Combos por horário, busca fonética, segunda tela do cliente, modo escuro específico do balcão, meta por operador, SPED — foram sugestões minhas na resposta anterior, mas não estavam no seu plano original. Se quiser algum, entra em fase própria.

---

## Prioridade sugerida

**Fase 1 imediato** (fecha risco silencioso, custo baixo).
**Fase 2 e 3** juntas (semana seguinte) — dão a percepção "PDV pro" completo.
**Fase 4** quando aparecer o primeiro lojista com 2+ caixas.
**Fase 5** quando o primeiro lojista pedir nota (é o que trava adoção séria).
**Fase 6** quando marketing pedir engajamento.

Confirma que fecho neste escopo (com essa ordem) para eu começar pela Fase 1?
