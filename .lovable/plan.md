# Sistema de Revenda — o que ainda falta

Status atual (v1.23.3): Fases 1–4 no ar + suíte E2E de RPCs verde (35/35). Faltam as automações que fazem o dinheiro andar sozinho, a captação pública e refinos de analytics/regra.

---

## Fase 5 — Automação (o coração comercial, nada disso existe hoje)

### 5.1 `reseller-check-activations` (cron diário, 03:00)
- Varre `reseller_referrals` com `status='pending'`.
- Marca `active` + grava `activated_at` quando a loja bater **20 pedidos entregues nos últimos 30 dias** E `stores.whatsapp_verified_at IS NOT NULL`.
- Cria bounty (`type='bounty'`, `amount_cents = resellers.bounty_amount * 100`) em `reseller_commissions` com `status='pending'`.
- Idempotente: só cria bounty se ainda não existe para o par `(reseller_id, store_id, type='bounty')`.

### 5.2 `reseller-monthly-recurring` (cron mensal, dia 5 às 04:00)
- Para cada `store_plans` com pagamento confirmado no mês anterior (`asaas_payment_status='RECEIVED'`), credita `commission_rate * mensalidade` em `reseller_commissions` (`type='recurring'`, `reference_month='YYYY-MM'`).
- Cobre Essencial (R$ 180), Autonomia (R$ 239,90), PDV addon (R$ 49), PDV Only (R$ 69), Apoiador (R$ 75).
- Respeita `commission_rate` individual do revendedor (VIP 30%).
- Skip se loja está `suspensa` ou `cancelada` no fim do mês de referência.

### 5.3 `reseller-gmv-bonus` (cron mensal, opcional — decisão pendente)
- Só liga se `gmv_bonus_rate > 0` no revendedor.
- Credita 0,3% do GMV entregue no mês para lojas ainda no período grátis.

### 5.4 `reseller-fraud-check` (cron semanal, domingo)
- Calcula ratio de lojas fantasma (0 pedidos em 90d) por revendedor.
- Se >30% E total de indicações ≥ 5 → `status='blocked'`, grava motivo em `notes`.
- Checa auto-indicação: CPF/CNPJ/user_id/device_id do dono da loja indicada contra o próprio revendedor via `signup_attempts` — se bater, bloqueia o referral e cria alerta.

### 5.5 `reseller-payout-processor` (chamada manual pelo admin ou cron 06:00)
- Hoje "marcar como pago" só muda status no banco. Falta **transferir de fato** via PIX Asaas (reaproveitar `create_pix_transfer` dos motoboys).
- Fluxo: `pending → processing → paid` com `asaas_transfer_id` real, retry em falha, notificação ao revendedor.

### 5.6 Trigger `reseller_locked_at`
- Trigger em `reseller_referrals` que grava `stores.reseller_locked_at = now()` quando `activated_at IS NOT NULL` → impede reatribuir revendedor depois de ativado.

---

## Fase 6 — Captação, materiais e E2E completo

### 6.1 Landing pública `/seja-revendedor`
- Copy persuasiva focada em "grátis-até-faturar" (diferencial vs Saipos/Ifood).
- Calculadora interativa: slider "quantas lojas vou indicar" → mostra MRR vitalício estimado.
- FAQ (bounty, saque, período grátis, anti-fraude).
- Formulário integrado a `reseller_register` com aprovação manual.
- SEO + JSON-LD + `robots.txt`/`llms.txt` como fizemos na StoreDirectory.

### 6.2 Aba "Materiais" no `/revendedor`
- Download do ebook PDF (o que geramos v2).
- Scripts prontos de WhatsApp (abordagem fria, follow-up, objeção "vou pensar").
- Imagens Andrômeda para stories/feed.
- Vídeo tutorial de 3 min "como fechar sua primeira loja".

### 6.3 Aba "Perfil" no `/revendedor`
- Edição de dados PIX (já existe via `reseller_update_pix`, falta UI dedicada).
- Aceite do contrato de revendedor (`resellers.contract_accepted_at`).
- Trocar código de indicação (com cooldown de 90 dias, opcional).

### 6.4 E2E completo com Playwright (bloco 2 de testes)
Hoje temos só E2E de RPCs. Falta o fluxo UI ponta-a-ponta:
- Revendedor se cadastra em `/seja-revendedor` → admin aprova no Super Admin.
- Lojista abre `/cadastro?ref=CODIGO` → cria loja → 20 pedidos fake → bounty aparece.
- Revendedor vê no dashboard, solicita saque → admin paga → comissões viram `paid`.

---

## Refinos do Super Admin (RevendedoresTab hoje é básica)

- **Ranking por MRR trazido** (não só nº de lojas), com sparkline dos últimos 6 meses.
- **Cohort 3/6/12 meses**: quantas lojas indicadas ainda ativas após N meses.
- **CAC efetivo**: comissão paga total ÷ MRR gerado; alerta se CAC > 6× LTV mensal.
- **Alertas de fraude** por revendedor (badge vermelho, motivo, ação rápida).
- **Log de auditoria** de cada comissão creditada/paga com origem visível.

---

## Regra comercial ainda divergente do plano

- **Saque mínimo:** hoje `reseller_request_withdrawal` valida R$ 50 hardcoded. Plano pede **R$ 100 semanal**. Mudar constante + adicionar cooldown de 7 dias entre saques do mesmo revendedor.
- **Frequência:** hoje é sob demanda; plano prevê "semanal PIX". Manter sob demanda mas com o cooldown já cobre.

---

## Ordem sugerida de entrega (patch por patch, sempre bumpando versão)

1. **v1.23.4 — Fase 5.6 + regra saque** (trigger de lock + R$ 100 + cooldown). Rápido, sem risco.
2. **v1.24.0 — Fase 5.1 (bounty cron)**. Já libera dinheiro real quando lojas ativarem.
3. **v1.24.1 — Fase 5.2 (recorrente mensal)**. Consolida receita vitalícia.
4. **v1.24.2 — Fase 5.4 (anti-fraude)** antes de escalar aquisição.
5. **v1.24.3 — Fase 5.5 (payout PIX real)** para fechar o ciclo financeiro.
6. **v1.25.0 — Fase 6.1 (landing pública)**. Só liga captação depois do motor rodando.
7. **v1.25.1 — Fase 6.2 + 6.3 (materiais + perfil)**.
8. **v1.25.2 — Refinos Super Admin** (cohort/CAC/alertas).
9. **v1.25.3 — E2E Playwright completo (bloco 2)** validando ponta-a-ponta.
10. **v1.26.0 — Fase 5.3 (GMV bonus)** apenas se decidirem ligar.

---

## Decisões que preciso de você antes de começar

1. **Ligo o 0,3% GMV bonus** (5.3) ou deixamos desligado por padrão?
2. **Payout PIX real** (5.5): usar mesma subconta Asaas dos motoboys ou subconta separada só de revendedores (melhor pra conciliação)?
3. **Ordem confirmada?** Começo pela **v1.23.4 (regra de saque + trigger de lock)** já na próxima mensagem, ou você prefere pular direto pra bounty cron (v1.24.0)?

## Detalhes técnicos (referência)

- Todos os crons via `pg_cron` + `net.http_post` chamando edge functions com service-role interno (nunca expor anon).
- Edge functions novas: `reseller-check-activations`, `reseller-monthly-recurring`, `reseller-gmv-bonus`, `reseller-fraud-check`, `reseller-payout-processor`.
- Cada cron loga em nova tabela `reseller_cron_runs (id, function, run_at, processed, credited_cents, errors_json)` pra debug e auditoria.
- Todas as novas RPCs seguem o padrão já estabelecido: `SECURITY DEFINER`, `search_path=public`, `REVOKE ALL FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated` (ou só `service_role` para as internas de cron).
- E2E de cada cron: hook `_dry_run=true` para simular sem creditar de fato — usado pela suíte `oneshot-e2e-reseller` já existente.
