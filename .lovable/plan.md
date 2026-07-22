# Sistema de Revenda ItaSuper

Modelo comercial e painel completo estilo Saipos, alinhado com a lógica **real** de gratuidade por GMV (não por tempo) que já existe no sistema.

## Modelo comercial

**Bounty + Recorrente vitalício** (mais alinhado ao nosso modelo grátis-até-faturar):

- **R$ 150 fixo** quando a loja indicada atinge "ativação real": 20 pedidos entregues em 30 dias (evita loja fantasma)
- **20% vitalício** sobre toda mensalidade paga (Essencial R$ 180, Autonomia R$ 239,90, PDV addon R$ 49, PDV Only R$ 69, Apoiador R$ 75)
- **0,3% do GMV** da loja durante o período grátis (opcional, incentivo pra revendedor trazer loja ativa mesmo antes de virar pagante) — só liga se quiser

Regras:
- Comissão suspende se loja for suspensa ou cancelar plano
- Revendedor pode ter % individual (VIP 30%) definido pelo Super Admin
- Saque mínimo R$ 100, semanal via PIX (reaproveita infra Asaas dos motoboys)

## Anti-fraude

- Bloqueio auto se >30% das lojas do revendedor virarem fantasma em 90 dias (0 pedidos)
- Revendedor não pode se auto-indicar (checa CPF/CNPJ/user_id/device_id contra `signup_attempts`)
- Bounty só libera após loja ter 20 pedidos entregues + WhatsApp verificado (usa `whatsapp_verified_at`)
- Cadastro de revendedor precisa aprovação manual do Super Admin

## Painel do Revendedor (`/revendedor`)

Novo dashboard, layout parecido com o do motoboy:

- **Meu link**: `/cadastro?ref=CODIGO` + QR code + botão copiar
- **Minhas lojas**: card por loja com nome, cidade, plano, status (grátis / pagante / suspensa), GMV últimos 60d, quanto falta pro trigger de cobrança, comissão do mês
- **Extrato**: bounties, recorrentes e GMV bonus separados, com filtro por período
- **Saldo + Solicitar saque**: PIX, mínimo R$ 100
- **Materiais**: PDF do ebook, scripts WhatsApp, imagens Andrômeda, tutorial em vídeo
- **Perfil**: dados PIX, contrato aceito

## Super Admin — nova aba "Revendedores"

- **Ranking** por MRR trazido, nº de lojas ativas, churn 90d
- **Lista de revendedores**: aprovar/bloquear, ajustar % individual, ver detalhes
- **Detalhe do revendedor**: todas as lojas indicadas, GMV agregado, comissão paga total, alertas de fraude
- **Cohort**: quantas lojas indicadas por revendedor X ainda ativas após 3/6/12 meses
- **CAC efetivo**: comissão paga vs MRR gerado
- **Log completo**: toda comissão creditada e paga, timestamp e origem (bounty/recorrente/gmv)
- **Aprovação de saques**: reaproveita fila de `withdrawal_requests`

## Detalhes técnicos

### Novas tabelas (Supabase externo)

```
resellers
  id, user_id (auth.users), code (único, ex "RENAN2026"),
  status (pending|approved|blocked), commission_rate (default 0.20),
  bounty_amount (default 150), gmv_bonus_rate (default 0),
  pix_key, pix_key_type, approved_at, approved_by, notes,
  created_at, updated_at

reseller_referrals
  id, reseller_id, store_id, source (link|manual|import),
  activated_at (quando bateu 20 pedidos), status (pending|active|churned),
  created_at

reseller_commissions
  id, reseller_id, store_id, type (bounty|recurring|gmv_bonus),
  amount_cents, reference_month (YYYY-MM),
  billing_ref (store_plans.id ou order.id), status (pending|paid),
  paid_at, created_at

reseller_withdrawal_requests
  (mesma estrutura de withdrawal_requests, campo reseller_id)
```

Todas com RLS: revendedor vê só as próprias, admin vê tudo, service_role acesso total. GRANTs para authenticated e service_role.

### Novos campos existentes

- `stores.referred_by_reseller_id` (nullable) — grava no cadastro se `?ref=CODIGO`
- `stores.reseller_locked_at` — quando o vínculo trava (não muda mais)

### Novas RPCs

- `reseller_register(code_wanted)` — cria pending, valida colisão de code
- `reseller_get_dashboard()` — retorna lojas, GMV, comissão do mês (SECURITY DEFINER com filtro por auth.uid)
- `admin_reseller_approve(reseller_id, rate?, bounty?)`
- `admin_reseller_block(reseller_id, reason)`
- `admin_reseller_stats()` — ranking, cohort, CAC

### Novas edge functions (cron)

- `reseller-check-activations` (diário): varre `reseller_referrals` pending, marca `active` quando loja bater 20 pedidos, cria bounty em `reseller_commissions`
- `reseller-monthly-recurring` (dia 5 de cada mês): pra cada loja com plano pago no mês anterior, credita 20% em `reseller_commissions`
- `reseller-fraud-check` (semanal): calcula ratio de lojas fantasma por revendedor, bloqueia auto se >30%
- `reseller-payout-processor`: processa `reseller_withdrawal_requests` via PIX Asaas

### Frontend

- `src/pages/ResellerDashboard.tsx` — rota nova `/revendedor` com RoleGuard novo role "revendedor"
- `src/pages/super-admin/tabs/ResellersTab.tsx` — nova aba
- Ajuste em `src/pages/CadastroLojista.tsx`: ler `?ref=`, gravar em `sessionStorage`, incluir em `register_as_lojista`
- Novo role `revendedor` em `user_roles` + em `useUserRole` + em `resolvePartnerDashboard`

### Landing pública

- `/seja-revendedor` — página de captação com copy persuasiva, calculadora ("indique 10 lojas Essencial ativas = R$ 360/mês vitalício"), FAQ, formulário

## Ordem de entrega

1. **Fase 1 — Infra** (tabelas, RLS, RPCs básicas, role revendedor)
2. **Fase 2 — Cadastro** (`?ref=` no cadastro lojista + página `/seja-revendedor`)
3. **Fase 3 — Dashboard revendedor** (visão de lojas, extrato, saque)
4. **Fase 4 — Super Admin** (aba Revendedores com ranking + aprovação)
5. **Fase 5 — Automação** (cron de bounty, recorrente, anti-fraude, payout)
6. **Fase 6 — Materiais + landing pública** + E2E completo

Cada fase ~1 versão patch, com incremento em `PerfilPage.tsx` + `build.gradle` e reporte da versão.

## Perguntas antes de começar

1. Modelo confirmado (bounty R$ 150 + 20% recorrente vitalício)? Ou quer ajustar valores?
2. Ligar o **0,3% GMV bonus** durante o grátis (pra motivar revendedor a trazer loja que vende mesmo antes de cobrar)?
3. Cadastro de revendedor: **aprovação manual sua** (recomendo) ou aberto pra qualquer um?
4. Já rodo a Fase 1 (infra + tabelas) na sequência após você aprovar, ou quer que eu pare após cada fase pra revisar?
