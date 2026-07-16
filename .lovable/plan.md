
# PDV Profissional — plano de refatoração

## 1. Diagnóstico do que EXISTE hoje (auditado no código, não suposto)

**Núcleo (`src/pages/PdvPage.tsx` — 1007 linhas) + `src/pages/pdv/`:**
- Abertura / venda / fechamento de caixa (`pdv_sessions`).
- Carrinho com adicionais, observações, pizza meia-a-meia, pastel builder, produto por peso.
- Pagamentos: dinheiro, débito, crédito, PIX, e **split** (`PdvSplitPayment`).
- **Fechamento cego** com contagem por cédula (`PdvDenominationCount`).
- **Sangria / suprimento** (`PdvMovementDialog`) gravando em `pdv_movements`.
- **Outbox offline** (`pdvOutbox.ts`) — RPC `pdv_finalize_sale` idempotente por `client_uuid`.
- **Atalhos** F1/F2/F3/F4/F6/F7/F8/F10 + **leitor de código de barras HID** (heurística por velocidade).
- Impressão térmica 58/80 mm, cópias configuráveis, auto-print opcional.
- Histórico, turnos, relatórios (`PdvRelatorios`, `PdvHistorico`).
- Empties (garrafas retornáveis).
- Gating por plano (`useStorePdvAccess`) — pdv_only R$ 69, add-on R$ 49, legacy grátis.
- Alerta de entrega manual para lojas de delivery (`PdvDeliveryAlerts`).

**Banco (Supabase externo):** `pdv_sessions`, `pdv_movements`, `cash_registers`, `cash_transactions`, `orders(order_source='pdv', pdv_session_id, table_identifier)`, `order_items`. RPC atômica `pdv_finalize_sale`, trigger `tg_cleanup_pdv_addon_on_plan_change`.

**O que NÃO existe:**
- Comandas / mesas de verdade (só um campo texto `table_identifier`).
- KDS de cozinha para pedidos do PDV.
- NFC-e / SAT / emissão fiscal.
- Múltiplos caixas simultâneos por loja (1 sessão por vez).
- Permissões por operador (qualquer login da loja faz tudo, sem PIN).
- Relatório Z / X, DRE do turno, ranking de operador.
- Devolução / cancelamento de venda com trilha de auditoria.
- Cardápio dedicado do PDV com atalhos numéricos, favoritos, teclas rápidas.
- Fidelidade / cashback aplicado no ato.
- Impressão de comanda de produção (cozinha vs. balcão).
- Dashboard tempo real do PDV (agora, hoje, ticket médio, top produtos).

## 2. Referência de PDV profissional (Linx/Bematech/Consinco/Colibri)

Recursos-padrão do mercado que faltam: comandas/mesas com transferência e divisão de conta, KDS separado por área (cozinha/bar), NFC-e homologada, controle de operador com login/PIN e permissões, sangria/suprimento com motivo + comprovante impresso, Z-report ao fechar, múltiplos terminais gravando na mesma "jornada" da loja, integração com balança, gaveta de dinheiro (kick TCP/USB), TEF/Pinpad (SITEF/PayGo), fidelidade e cupom no ato, modo offline com fila auditável, dashboard operacional em tempo real.

## 3. Plano em 4 fases

### Fase A — UX profissional + operador (sem schema pesado, ~1 semana)
Refatorar toda a UI da tela de venda para o padrão "grid de teclas" que operador de PDV espera.

- **Nova UI de venda:** layout de 3 colunas em desktop (categorias | grid de produtos grandes com atalho numérico | carrinho fixo direito com totais bem grandes). Manter o mobile atual.
- **Favoritos / grade rápida:** top 20 produtos vendidos no turno em teclas grandes, direto sem busca.
- **Cardápio PDV dedicado** (`/admin/pdv/cardapio`): ordenação livre por drag-and-drop, cor por categoria, código curto (01, 02...) para digitar + Enter e adicionar.
- **Login de operador com PIN de 4 dígitos** (usa a coluna `pin_hash` já existente em `profiles`): PDV pede PIN a cada abertura de caixa e grava `opened_by` / `pdv_movements.created_by` corretamente. Bloqueia sangria acima de X sem PIN de gerente.
- **Sangria/suprimento com motivo obrigatório** (categoria: troco, depósito, retirada dono, despesa) e impressão automática do comprovante.
- **Cancelamento de venda** com motivo + impressão de "cupom cancelamento" (grava `orders.status='cancelado'` + reverso em `pdv_movements`).
- **Relatório Z** ao fechar caixa: cupom impresso com total por forma, sangrias, suprimentos, ticket médio, nº de operações, diferença. Já temos os dados — só falta o layout de impressão.
- **Dashboard "Agora":** card no topo com vendas do dia, ticket médio, top 3 produtos, últimas 5 vendas atualizando via `queryClient.invalidate` a cada nova venda.

### Fase B — Comandas e mesas (~1 semana + migration)
Transformar o `table_identifier` texto em algo real, sem quebrar o PDV atual.

**Novas tabelas (externo, via oneshot):**
```
pdv_tables (id, store_id, label, seats, status, opened_at, opened_by)
pdv_tabs   (id, store_id, table_id, customer_name, status, opened_at)
```
- `orders.pdv_tab_id` (nullable) linka pedido à comanda; balcão continua com `pdv_tab_id NULL`.
- Grid visual de mesas colorido por status (livre/ocupada/aguardando pagamento).
- Divisão de conta por pessoa e transferência de comanda entre mesas.
- RPC `pdv_close_tab(_tab_id, _payments)` fecha comanda gerando `orders` e liberando mesa.

### Fase C — Fiscal + hardware (~2 semanas, depende de homologação)
- **NFC-e** via provedor terceiro (Focus NFe / TecnoSpeed): edge function `pdv-nfce-issue` recebe `order_id`, monta XML, envia, guarda `chave`, `pdf_url`, `status` numa tabela `fiscal_documents`. Botão "Emitir NFC-e" ao finalizar. Contingência offline.
- **Gaveta de dinheiro:** comando ESC/POS via mesma impressora térmica que já usamos.
- **Balança:** protocolo Toledo Prix serial (feature flag — só se cliente tiver).
- **TEF:** integração PayGo/SITEF só sob demanda (custo alto, deixar como add-on).

### Fase D — Multi-caixa + KDS + fidelidade (~1 semana)
- **Múltiplas sessões simultâneas** por loja: adicionar `pdv_sessions.terminal_id` + `pdv_terminals(id, store_id, label)`; UI escolhe terminal no login.
- **KDS PDV:** rota `/admin/pdv/kds` mostra pedidos de comandas em preparo, com bump (produção→pronto→entregue). Reaproveita `KdsPage.tsx`.
- **Fidelidade no ato:** integração com `loyalty_config` / `loyalty_points` já existente — resgatar pontos direto no checkout do PDV.

## 4. Detalhes técnicos

- Toda mudança de schema entra por **edge function oneshot** no Supabase externo (`EXTERNAL_SUPABASE_SERVICE_KEY` → `rpc/exec_sql`), padrão que já usamos.
- Refatorar `PdvPage.tsx` (1007 linhas) em `PdvSaleScreen`, `PdvOperatorLock`, `PdvQuickGrid`, `PdvTablesGrid` para acabar com o "god component".
- Design tokens em `index.css` — nada de cor hardcoded. Botões grandes (min 56 px), fonte tabular nos totais, contraste AA no modo escuro do balcão.
- Testes: manter cobertura de `usePdvCart`, `pdvOutbox` e adicionar teste de `PdvOperatorLock` (PIN) e `pdv_close_tab`.
- Versão sobe a cada fase (Core rule).

## 5. Prioridade sugerida
Fase A primeiro — dá impressão de "PDV pro" imediata sem risco fiscal.
Fase B logo depois — comandas/mesas é o gap mais visível pros clientes de bar/lanchonete.
Fase C e D só quando um lojista real pedir NFC-e ou tiver >1 balcão.

## Fora deste plano
Integração com estoque perpétuo, compras/fornecedores, produção com ficha técnica, e-mail marketing pós-venda, delivery próprio do PDV (isso já vive no app principal).
