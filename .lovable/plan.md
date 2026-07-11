# Plano — Correção Pastelão Carioca + Cobrança + WhatsApp ItaSuper

## Diagnóstico rápido

- **Pastelão Carioca** está com `store_plans.monthly_fee = 90` (valor antigo), trial vencido em 10/07 e cobrança `#ASSIN-69490ADA` R$90 pending. O `TrialExpiredGuard` prende o lojista na tela de PIX sem saída.
- **Não existe** hoje configuração de WhatsApp de suporte da plataforma. Cada loja tem sua própria instância Evolution (`store_secrets.evolution_instance_name`). Para avisar lojistas em nome da ItaSuper precisamos de uma **instância Evolution dedicada da plataforma**, configurável no Super Admin.

---

## Parte 1 — Hotfix Pastelão + lojas legadas Essencial

**Objetivo**: desbloquear agora e alinhar todas as lojas antigas ao novo modelo (R$0 até bater R$5k).

1. **Data fix (via insert tool no externo)**:
   - `UPDATE store_plans SET monthly_fee = 0, next_billing_date = NULL WHERE plan_type='fixed' AND is_active=true AND monthly_fee IN (90, 180)`.
   - `UPDATE financial_transactions SET status='cancelled' WHERE status='pending' AND (reference_code LIKE '#ASSIN-%' OR reference_code LIKE '#MENS-%') AND store_id IN (...lojas afetadas)`.

2. **Escape route no `TrialExpiredGuard.tsx`**:
   - Se `storePlan.monthlyFee === 0` → nunca bloqueia (retorna children direto).
   - Botão "Falar com suporte" que abre WhatsApp da ItaSuper (número vindo de `admin_settings.support_whatsapp`).
   - Link "Ver histórico de cobranças" que fecha o guard e navega para aba Financeiro.

---

## Parte 2 — WhatsApp ItaSuper (base para todos os avisos)

**Novidade solicitada pelo usuário**: precisamos de um WhatsApp da plataforma para avisar lojistas sobre mensalidade, repasse e mais.

1. **Instância Evolution dedicada da plataforma** (nome fixo: `itasuper-platform`).

2. **Nova tabela** `platform_whatsapp_config` no externo (única linha):
   ```
   id, instance_name, phone_number, status, connected_at,
   support_display_name, support_link_message, updated_at
   ```
   Grants: `authenticated` SELECT (para lojistas abrirem link de suporte), `service_role` ALL. RLS: SELECT liberado, INSERT/UPDATE só admin (`has_role(auth.uid(),'admin')`).

3. **Nova aba no Super Admin — "WhatsApp Plataforma"** (`src/pages/super-admin/tabs/PlatformWhatsAppTab.tsx`):
   - QR Code de conexão (reaproveita `evolution-qr-code` com override de instance).
   - Status da conexão (online/offline, último ping).
   - Campo para número de suporte visível ao lojista (`support_whatsapp`).
   - Botão "Testar envio" (envia mensagem de teste para número informado).
   - Toggle "Ativar avisos automáticos" (mestre — desliga cron sem apagar config).

4. **Nova edge function `platform-whatsapp-send`** (`supabase/functions/platform-whatsapp-send/index.ts`):
   - Recebe `{ phone, message, kind, store_id? }`.
   - Lê `platform_whatsapp_config`, envia via Evolution na instância `itasuper-platform`.
   - Deduplica por `(phone, kind, store_id, dia)` em `platform_whatsapp_log` (nova tabela).
   - Sem envio se `avisos_ativos = false`.

5. **`admin_settings.support_whatsapp`** — string com número/link (`https://wa.me/55…`) usado como fallback pelo `TrialExpiredGuard` e por qualquer botão "Falar com suporte" no app.

---

## Parte 3 — Avisos de mensalidade (D-3, D-1, D+1, D+3)

**Nova edge function `billing-reminders`** (cron diário 08:00 BRT):
- Varre `financial_transactions` pending com `#MENS-%` ou `#ASSIN-%`.
- Para cada cobrança calcula dias até/após vencimento e dispara **via `platform-whatsapp-send`** (WhatsApp ItaSuper, não da loja).
- Templates:
  - **D-3**: "Olá! Sua mensalidade ItaSuper vence em 3 dias — R$X. PIX: [código]"
  - **D-1**: "Vence amanhã — R$X"
  - **D+1**: "Em atraso. Em 2 dias sua loja será suspensa."
  - **D+3** (após bloqueio): "Loja suspensa. Pague o PIX para reativar."
- Registra em `compliance_alerts` (`alert_type='monthly_reminder_dX'`) para não repetir.

---

## Parte 4 — Card de progresso Essencial + grace period 7 dias

**`EssencialProgressCard`** no `DashboardOverviewSection`:
- Só aparece para `plan_type='fixed' AND monthly_fee=0`.
- Barra `GMV 60d / R$5.000` + "Faltam R$Y para virar plano pago (R$180/mês)".
- Ao passar de R$5k: card muda para "🎉 A partir de [data +7d] sua mensalidade será R$180/mês".

**`check-essencial-upgrade` — grace period**:
- Nova coluna `store_plans.essencial_upgrade_scheduled_at TIMESTAMPTZ`.
- 1ª vez que GMV ≥ R$5k → grava `now() + 7 days` e envia WhatsApp: "Parabéns! Bateu R$5k. Mensalidade R$180 começa em [data]."
- Só aplica `monthly_fee=180` quando `now() >= essencial_upgrade_scheduled_at`.
- Envia 2º WhatsApp no dia da virada.

---

## Parte 5 — Card de repasse semanal com previsão

**`RepasseSection.tsx`**:
- Badge "Próximo repasse: sexta-feira DD/MM" (calculado do próximo dia da semana fixo).
- Se `repasse_pendente > 0` e último `store_payout paid` >7 dias → alerta amarelo "Repasse atrasado — falamos com o suporte" com botão para WhatsApp ItaSuper.
- Reutiliza número do `admin_settings.support_whatsapp`.

---

## Sumário técnico

**Arquivos a editar**:
- `src/components/TrialExpiredGuard.tsx` — bypass fee=0, botão suporte, link financeiro.
- `src/pages/admin/sections/DashboardOverviewSection.tsx` — montar `EssencialProgressCard`.
- `src/pages/admin/sections/RepasseSection.tsx` — badge previsão + alerta atraso.
- `src/pages/SuperAdminDashboard.tsx` — nova aba "WhatsApp Plataforma".
- `supabase/functions/check-essencial-upgrade/index.ts` — grace period 7 dias + WhatsApp.

**Arquivos a criar**:
- `src/components/EssencialProgressCard.tsx`.
- `src/pages/super-admin/tabs/PlatformWhatsAppTab.tsx`.
- `supabase/functions/platform-whatsapp-send/index.ts`.
- `supabase/functions/billing-reminders/index.ts` + cron diário.

**Migrations (externo)**:
- `store_plans.essencial_upgrade_scheduled_at TIMESTAMPTZ`.
- Nova tabela `platform_whatsapp_config` + `platform_whatsapp_log` (com GRANTs + RLS).
- Novo `admin_settings.support_whatsapp` (row + policy admin-only para UPDATE).

**Data ops (insert tool no externo)**:
- Migrar lojas Essencial legadas para monthly_fee=0.
- Cancelar cobranças `#ASSIN-*` / `#MENS-*` órfãs dessas lojas.

**Cron novo no externo** (via `setup-external-crons`):
- `billing-reminders-daily` — 11:00 UTC (08:00 BRT).

**Bump**: v1.13.45 (build 904).

---

## Ordem de execução

1. **Hotfix Pastelão** (Parte 1) — desbloqueia agora, sem dependências.
2. **WhatsApp Plataforma** (Parte 2) — base para tudo que vem depois.
3. **Progresso Essencial + grace period** (Parte 4) — usa WhatsApp Plataforma.
4. **Reminders de mensalidade** (Parte 3) — usa WhatsApp Plataforma.
5. **Card de repasse** (Parte 5) — polimento final.
