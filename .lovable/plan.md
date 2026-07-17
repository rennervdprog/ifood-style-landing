
# PDV Fase B — Comandas e Mesas

Transforma o campo texto `table_identifier` em mesas e comandas de verdade, sem quebrar o balcão atual.

## 1. Schema (externo, via edge function oneshot)

Novas tabelas em `public`:

```text
pdv_tables
  id uuid PK
  store_id uuid FK stores
  label text            -- "Mesa 01", "Balcão 2"
  seats int default 4
  status text           -- 'free' | 'occupied' | 'billing'
  opened_at timestamptz
  opened_by uuid
  sort_order int

pdv_tabs
  id uuid PK
  store_id uuid FK
  table_id uuid FK pdv_tables (nullable = comanda avulsa)
  code text             -- número curto da comanda ("12")
  customer_name text
  status text           -- 'open' | 'closed' | 'canceled'
  opened_at, closed_at timestamptz
  opened_by uuid
```

Coluna nova:
- `orders.pdv_tab_id uuid NULL` (balcão continua NULL, não quebra nada).

Índices: `(store_id, status)` em ambas; `(store_id, code) WHERE status='open'` único em `pdv_tabs`.

RLS: `authenticated` só enxerga rows da própria store (via `store_admins`/`stores.owner_id`, mesmo padrão de `pdv_sessions`). GRANTs completos.

## 2. RPC atômica no externo

```text
pdv_open_tab(_store_id, _table_id, _customer_name) → tab_id
pdv_close_tab(_tab_id, _payments jsonb) → order_id
  - soma itens já lançados na comanda
  - chama internamente a mesma lógica do pdv_finalize_sale
  - marca tab.status='closed', libera mesa (status='free')
pdv_transfer_tab(_tab_id, _new_table_id)
pdv_split_tab(_tab_id, _splits jsonb)     -- divisão por pessoa
pdv_cancel_tab(_tab_id, _reason)
```

Todas `SECURITY DEFINER`, `search_path=public`, EXECUTE só a `authenticated`/`service_role`.

## 3. Frontend

Novos arquivos em `src/pages/pdv/`:

- `state/usePdvTables.ts` — query + realtime das mesas/comandas.
- `components/PdvTablesGrid.tsx` — grid visual colorido (verde=livre, laranja=ocupada, vermelho=aguardando pagamento).
- `components/PdvTabDrawer.tsx` — abre comanda, adiciona itens (reutiliza `usePdvCart`), imprime parcial.
- `components/PdvTabCloseDialog.tsx` — fechamento com split (dividir por pessoa) + pagamentos existentes.
- `components/PdvTablesAdmin.tsx` — CRUD simples de mesas em `/admin/pdv/mesas`.

Mudanças em telas existentes:
- `PdvPage.tsx`: nova aba **"Mesas"** ao lado de Venda/Histórico/Turnos/Relatórios. Balcão continua igual.
- `PdvSaleScreen`: botão "Enviar para comanda" quando uma mesa/comanda está selecionada, em vez de "Finalizar".
- Recibo térmico ganha "Comanda #12 — Mesa 03".

## 4. Segurança

- RLS restringe leitura/escrita à store do usuário.
- `pdv_close_tab` valida que a sessão do PDV está aberta antes de fechar.
- Cancelamento de comanda exige PIN de gerente (reaproveita `usePdvOperator`).
- Log em `pdv_movements` (type='tab_cancel') para trilha de auditoria.

## 5. Testes

- Unit: `usePdvTables` (mock supabase), reducer de split de conta.
- E2E Playwright: abrir mesa 01 → lançar 2 itens → fechar 50/50 dinheiro+pix → conferir `orders` com `pdv_tab_id` e mesa liberada.

## 6. Rollout

1. Migration externa oneshot (idempotente + rollback SQL em `scripts/pdv-fase-b-rollback.sql`).
2. Feature flag `admin_settings.pdv_tables_enabled` — só liga quando lojista quiser.
3. Bump para **v1.16.0** (build 1010) — mudança grande, sobe minor.

## Fora do escopo desta fase
Reserva de mesa, QR code por mesa (cliente pede pelo celular na mesa), integração com KDS (fica pra Fase D), rateio de couvert/serviço automático.
