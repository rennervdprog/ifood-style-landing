# E2E Sistema de Revenda — Cobertura Total

Objetivo: exercitar **cada RPC + cada tela + cada regra de negócio** do sistema de revenda, do zero até o saque pago, com asserts no banco externo.

## Contas de teste (provisionar via oneshot no externo)

- `e2e-reseller-1@itasuper.test` — revendedor "feliz" (aprovado)
- `e2e-reseller-2@itasuper.test` — revendedor pending (nunca aprovado)
- `e2e-reseller-3@itasuper.test` — revendedor blocked (para testar bloqueio)
- `e2e-lojista-ref-1@itasuper.test` … `-4` — lojas indicadas
- `e2e-admin@itasuper.test` — já existe, usa role admin
- Loja `e2e-self-ref` — tentativa de auto-indicação (mesmo CPF do reseller-1)

Script `scripts/e2e/reseller/00_seed.py` cria/reseta tudo via edge function `oneshot-e2e-reseller-seed` (idempotente, apaga runs anteriores por prefixo de email).

## Suites (ordem de execução)

### Suite 1 — Cadastro do revendedor (`01_register.py`)
- `reseller_register("RENAN2026")` → status pending, retorna row.
- Chamar de novo com mesmo code → erro `code_taken`.
- Chamar sem estar logado → erro auth.
- Reseller-2 tenta `reseller_get_dashboard()` estando pending → deve retornar payload vazio, sem 500.
- Admin lista via `admin_reseller_list()` e vê os 3 revendedores.

### Suite 2 — Aprovação / bloqueio / config (`02_admin_flow.py`)
- Admin roda `admin_reseller_set_status(reseller-1, 'approved')` → cria role `revendedor` em `user_roles`, `approved_at` preenchido.
- `admin_reseller_update_config(reseller-1, commission_rate=0.30, bounty_amount_cents=20000)` → confere update.
- `admin_reseller_set_status(reseller-3, 'blocked', notes='fraude')`.
- Reseller não-admin tenta chamar RPC admin → erro `unauthorized`.

### Suite 3 — Vínculo `?ref=` no cadastro lojista (`03_referral_link.py`)
- Abrir Playwright em `/cadastro?ref=RENAN2026` como `e2e-lojista-ref-1`, completar signup.
- Assert `stores.referred_by_reseller_id = reseller-1.id` e `reseller_locked_at` setado.
- Assert row em `reseller_referrals` (status `pending`, source `link`).
- Repetir cadastro com `?ref=CODIGOINVALIDO` → loja criada sem vínculo, sem erro.
- Reseller-1 tenta cadastrar loja com próprio CPF → assert **bloqueio anti-auto-indicação** (após Fase 5).

### Suite 4 — Trigger de bounty (`04_bounty.py`)
- Injetar 19 pedidos entregues para lojista-ref-1 → rodar `reseller-check-activations` → assert **nenhum** bounty.
- Injetar 20º pedido + `whatsapp_verified_at` → rodar cron → assert:
  - `reseller_referrals.status = 'active'`, `activated_at` setado.
  - `reseller_commissions` com `type='bounty'`, `amount_cents=20000` (rate VIP), `status='pending'`.
- Rodar cron 2ª vez → idempotente, não duplica.

### Suite 5 — Recorrente mensal (`05_recurring.py`)
- Simular pagamento de plano Essencial (R$ 180) via insert em `store_plans` + `financial_transactions` no mês anterior.
- Rodar `reseller-monthly-recurring` → assert commission `type='recurring'`, `amount_cents = 180 * rate`, `reference_month` correto.
- Rodar de novo → idempotente (unique em `reseller_id + store_id + reference_month + type`).
- Loja suspensa no mês → **não** credita.
- Testar todos os planos: Essencial, Autonomia, PDV addon, PDV Only, Apoiador.

### Suite 6 — GMV bonus opcional (`06_gmv_bonus.py`)
- Ligar `gmv_bonus_rate=0.003` no reseller-1.
- Injetar GMV R$ 3.000 no período grátis → assert commission `type='gmv_bonus'`, valor R$ 9,00.
- Reseller-2 (rate 0) → nenhum bonus.

### Suite 7 — Dashboard revendedor (`07_dashboard.py`)
- Login como reseller-1, `GET /revendedor`.
- Assert cards: saldo pendente, saldo pago, nº lojas ativas, comissão do mês.
- Assert lista de lojas com GMV 60d, plano, status, "quanto falta pro trigger".
- Extrato filtra por período e por tipo (bounty/recurring/gmv_bonus).
- Copiar link → checa clipboard contém `/cadastro?ref=RENAN2026`.

### Suite 8 — Saque (`08_withdrawal.py`)
- Reseller-1 com saldo < R$ 100 → `reseller_request_withdrawal` erro `min_amount`.
- Ajustar mínimo pra R$ 100 (config atual está R$ 50 — plano manda 100).
- Saldo suficiente → cria withdrawal `pending`.
- Segunda tentativa com pending aberto → erro `already_pending`.
- Admin `admin_reseller_withdrawal_process(id, 'reject', 'dados PIX errados')` → status rejected, comissões continuam pending.
- Novo saque → admin `'approve'` → status approved.
- Admin `'paid'` com `_asaas_transfer_id` → assert:
  - Withdrawal `status='paid'`, `processed_at` setado.
  - Comissões correspondentes viraram `paid` com `paid_batch_id`.
  - Saldo pendente do dashboard zerou.

### Suite 9 — Anti-fraude (`09_fraud.py`, depende Fase 5)
- Criar reseller-4 com 10 lojas indicadas, 4 delas 0 pedidos em 90d.
- Rodar `reseller-fraud-check` → assert `status='blocked'`, notes com motivo.
- Reseller bloqueado tenta abrir dashboard → 403 amigável.

### Suite 10 — Super Admin analytics (`10_admin_analytics.py`)
- Abrir aba **Financeiro → Revendedores** via Playwright.
- Assert KPIs de `admin_reseller_summary()` batem com queries diretas no banco.
- Aprovar/bloquear pela UI (não só RPC) e conferir toast + refresh.
- Processar saque pela UI (approve → paid).

### Suite 11 — Landing pública (`11_landing.py`, depende Fase 6)
- `GET /seja-revendedor` sem auth → 200, título correto, calculadora funciona (10 lojas Essencial = R$ 360/mês).
- Submit do form → cria `resellers` pending + envia notificação admin.

### Suite 12 — RLS / segurança (`12_rls.py`)
- Como reseller-1 anon-key JWT: tenta `SELECT * FROM resellers WHERE id != own` → 0 rows.
- Tenta `SELECT` em `reseller_commissions` de outro reseller → 0 rows.
- Tenta UPDATE direto em `resellers.commission_rate` → negado.
- Tenta chamar `admin_reseller_*` → `unauthorized`.
- Service_role bypassa (usado pelas edge functions cron).

## Infra dos testes

- `scripts/e2e/reseller/` — todas as suites em Python + Playwright (mesmo padrão de `apparel/` e `snackbar/`).
- `scripts/e2e/reseller/README.md` — como rodar local + CI.
- Edge functions helper:
  - `oneshot-e2e-reseller-seed` — cria contas, dá role, reseta estado.
  - `oneshot-e2e-reseller-inject-orders` — injeta N pedidos entregues numa loja (bypass Asaas).
  - `oneshot-e2e-reseller-tick-cron` — dispara os 4 crons on-demand para o teste não esperar horário.
- Workflow `.github/workflows/reseller-e2e.yml` roda suites 1–8 e 12 em cada PR (as que dependem de Fase 5/6 rodam quando essas fases entrarem).
- Cada suite escreve JSON em `/tmp/e2e/reseller/<suite>.json` + screenshots.

## Cobertura final (RPC checklist)

Publicas do revendedor:
- `reseller_register`, `reseller_lookup_code`, `reseller_get_dashboard`, `reseller_attach_signup`, `reseller_request_withdrawal` → suites 1,3,7,8.

Admin:
- `admin_reseller_list`, `admin_reseller_set_status`, `admin_reseller_update_config`, `admin_reseller_referrals`, `admin_reseller_commissions`, `admin_reseller_withdrawals`, `admin_reseller_withdrawal_process`, `admin_reseller_summary` → suites 2,8,10,12.

Crons (Fase 5):
- `reseller-check-activations`, `reseller-monthly-recurring`, `reseller-gmv-bonus`, `reseller-fraud-check`, `reseller-payout-processor` → suites 4,5,6,8,9.

## Ordem de entrega

1. Seed + suites 1,2,3,7,8,10,12 (já dá pra rodar hoje, cobre tudo que existe).
2. Suites 4,5,6,9 (após Fase 5 estar deployada).
3. Suite 11 (após Fase 6).
4. Ligar workflow no CI.

Cada bloco entregue = versão patch (`PerfilPage.tsx` + `build.gradle`) com report ao usuário.
