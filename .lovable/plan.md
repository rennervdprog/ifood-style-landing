
# Plano de Correção: Termos de Uso × Aplicação

Objetivo: eliminar os 5 riscos jurídicos apontados pela auditoria sem quebrar cobrança/planos atuais. Fases ordenadas por severidade — cada fase é independente e pode ser aprovada isoladamente.

---

## Fase 1 — CRÍTICO: Garantir que exclusão de conta e reembolso rodam no banco externo

**Problema:** `delete-account` e `cancel-order-refund` usam só `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, sem fallback `EXTERNAL_SUPABASE_URL`. Se os secrets não coincidirem exatamente com o projeto externo, LGPD Art. 18 (direito de eliminação) e CDC (reembolso) falham silenciosamente.

**Ação:**
- Padronizar as duas functions com o mesmo padrão de `asaas-webhook` / `confirm-order-payment`:
  ```
  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  ```
- Rodar `oneshot-verify-external-target` (nova) que compara `EXTERNAL_URL` × host real onde as tabelas `profiles`/`orders` existem, e loga em `admin_logs`.
- Adicionar teste manual: chamar `delete-account` numa conta de teste do externo e verificar que `profiles` sumiu lá.

**Risco de quebra:** baixo. É aditivo (fallback), não muda comportamento se secrets já estão corretos.

---

## Fase 2 — CRÍTICO: Upgrade Essencial R$0→R$180 com aceite expresso e 30 dias

**Problema:** `check-essencial-upgrade` força `UPDATE monthly_fee=180` após 7 dias, sem aceite. Termo promete aceite + 30 dias.

**Ação (2 sub-fases):**

**2a. Migração DB** (`oneshot-essencial-upgrade-consent`):
- Adiciona em `store_plans`:
  - `essencial_upgrade_notified_at timestamptz`
  - `essencial_upgrade_scheduled_for timestamptz`
  - `essencial_upgrade_accepted_at timestamptz`
  - `essencial_upgrade_declined_at timestamptz`

**2b. Reescrever `check-essencial-upgrade`:**
- Muda `GRACE_DAYS` de 7 → **30**.
- Ao detectar loja elegível: só grava `essencial_upgrade_notified_at = now()` + `essencial_upgrade_scheduled_for = now()+30d` e dispara notificação (WhatsApp + push + banner in-app).
- **Nunca** faz `UPDATE monthly_fee` sem `essencial_upgrade_accepted_at IS NOT NULL`.
- Nova edge function `essencial-upgrade-response` com actions `accept`, `decline`, `migrate_plan` (para pular pra Autonomia/Crescimento).
- Se `declined_at` setado → downgrade automático para plano gratuito compatível (Apoiadores) ou desativação com aviso.

**2c. UI (`EssencialProgressCard.tsx`, novo `EssencialUpgradeBanner.tsx`):**
- Mostra countdown dos 30 dias com 3 botões: **Aceitar reajuste**, **Migrar para outro plano**, **Recusar**.
- Bloqueia o auto-upgrade até resposta.

**Risco de quebra:** médio — muda fluxo de billing. Mitigação: lojas atualmente marcadas como vitalícias (`essencial_lifetime_free`) continuam intocadas.

---

## Fase 3 — ALTO: Alinhar planos `hybrid`/`commission_only` com Termos

**Problema:** Código cobra 2,5%+ desses planos mas Termos só descrevem planos 0% comissão.

**Ação — decisão do usuário necessária, mas o plano oferece dois caminhos:**

**Opção A (recomendada) — Aditar os Termos:**
- Adicionar seção 5.7 aos Termos descrevendo os planos `hybrid` (X% comissão + R$Y fixo) e `commission_only` (X% comissão pura), com valores exatos lidos de `plan_templates`.
- Publicar como nova versão em `legal_documents` (kind='terms', version_num+1) e disparar modal de re-aceite (`legal_document_changes` já existe).

**Opção B — Retirar do código:**
- Marcar `hybrid` e `commission_only` como `deprecated=true` em `plan_templates`.
- Migrar lojas existentes desses planos para `fixed` (Essencial) mantendo condições atuais como VIP.

Padrão: **Opção A**, pois há lojas ativas.

---

## Fase 4 — MÉDIO-ALTO: Implementar bloqueio parcial por saldo > R$500

**Problema:** Cláusula 8.2 detalha valor (R$500), prazo (5 dias úteis) e efeito (restrição parcial) — nenhum implementado. Só existe desativação total após 30d.

**Ação:**
- Migração: adicionar `stores.partial_lock_status text` (null | `warning` | `restricted`), `stores.partial_lock_notified_at`, `stores.partial_lock_deadline`.
- Estender `is_store_blocked_by_balance` (já existe) para retornar 3 estados: `ok` / `warning_soon` / `restricted`.
- Nova edge function `check-balance-restrictions` (cron diário) que:
  1. Detecta saldo pendente > R$500 → grava `partial_lock_status='warning'` + `deadline = now() + 5 business days` + notifica.
  2. Ao vencer deadline sem quitação → `partial_lock_status='restricted'`.
- Frontend: bloquear novas ações no `AdminDashboardV2` quando `restricted` (mas manter aba "Financeiro" e pedidos em andamento acessíveis).
- Trigger `enforce_store_balance_lock` atual (que joga exception em R$500 duro) precisa ser suavizado para respeitar os 5 dias úteis.

**Risco de quebra:** médio — envolve trigger que hoje bloqueia inserção. Mitigação: fase de sombra (loga sem bloquear) por 7 dias antes de ativar.

---

## Fase 5 — MÉDIO: Divulgar regras de saque do motoboy nos Termos

**Problema:** Mín R$5, 1x/semana existem em código+`admin_settings`, não nos Termos.

**Ação:**
- Adicionar seção 7.5 aos Termos: "Saques do Entregador" com mín, periodicidade, prazo D+1 útil, e "quaisquer alterações serão comunicadas com 30 dias de antecedência".
- Nova coluna `admin_settings.value->>'notified_at'` para trilha de auditoria.
- Publicar nova versão em `legal_documents` (junto com Fase 3 se aprovada).
- Criar edge function `notify-withdrawal-rule-change` disparada por trigger em `admin_settings` quando `key='withdrawal_limits'` muda — envia push + email pra todos os motoboys ativos com 30d de antecedência.

---

## Fase 6 — HIGIENE: Auditoria contínua

**Ação:**
- Criar `docs/terms-vs-code-audit.md` com tabela viva Cláusula → Implementação → Arquivo:linha.
- CI check: script `scripts/audit-terms-implementation.mjs` que roda em PR verificando que preços em `plansInfo.ts` batem com o texto renderizado em `TermosDeUso.tsx`.
- Criar edge function `oneshot-diff-legal-documents` que compara `TermosDeUso.tsx` estático × versão vigente em `legal_documents` e alerta se divergirem.

---

## Ordem de execução sugerida (por versão)

| Versão | Fase | Impacto usuário |
|---|---|---|
| v1.14.8 | Fase 1 (fallback external) | Zero (só backend) |
| v1.14.9 | Fase 6 (audit doc + CI) | Zero |
| v1.15.0 | Fase 2 (upgrade consent) | Alto — nova UI + fluxo |
| v1.15.1 | Fase 4 sombra (log-only) | Zero |
| v1.15.2 | Fase 5 (regras saque) | Baixo — texto + modal aceite |
| v1.15.3 | Fase 3 (aditar planos) | Baixo — modal re-aceite |
| v1.15.4 | Fase 4 ativa (restrição) | Médio — lojas em débito |

---

## Detalhes técnicos (para revisão do desenvolvedor)

- Todas as migrações via edge function `oneshot-*` usando `EXTERNAL_SUPABASE_SERVICE_KEY` (nunca migration tool do Lovable Cloud, pois DB é externo).
- Toda mudança em `legal_documents` precisa entrada em `legal_document_changes` para o modal `get_pending_legal_changes` funcionar.
- Cada fase incrementa versão em `src/lib/appVersion.ts` + `android/app/build.gradle` (versionName + versionCode).
- Fase 2 e 4 exigem cron pausado antes do deploy (`cron.unschedule('check-essencial-upgrade')`) para evitar race.

---

## O que **não** está neste plano

- Reescrever o texto dos Termos por completo (só aditamentos pontuais nas Fases 3 e 5).
- Auditoria de LGPD além do direito de eliminação (Fase 1 cobre o mínimo).
- Retenção/expurgo automático de `archived_accounts` — merece plano próprio.
- `reviewCount` fixo no schema.org (nota lateral do auditor, não é cláusula).

**Pergunta antes de começar:** aprovar tudo em ordem, ou quer priorizar só Fases 1+2 (as CRÍTICAS) por enquanto?
