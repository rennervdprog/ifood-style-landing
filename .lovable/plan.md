
# Plano — Troca de Plano correta + Antifraude reforçado

Objetivo: fechar todos os gaps reais listados na auditoria, sem inventar features novas.

---

## Parte 1 — Troca de Plano (fica funcional de verdade)

### 1.1 Aplicar prorata de fato
- Adicionar coluna `billing_credit_cents INT NOT NULL DEFAULT 0` em `store_plans` (se não existir).
- Alterar RPC `approve_plan_change`:
  - Ler `prorata_credit` da solicitação.
  - Somar em `store_plans.billing_credit_cents`.
  - `monthly-billing` já deve descontar esse crédito antes de gerar a cobrança (ajustar edge function pra ler/zerar o crédito ao usar).

### 1.2 Recalcular ciclo de cobrança na troca
- Em `approve_plan_change`: setar `last_billed_at = now()` e `next_billing_date = now() + interval '30 days'` quando o plano muda de tipo/fee, evitando cobrança em data velha.

### 1.3 Destinos de troca consistentes
- Em `StoreSubscription.tsx`: substituir lista hardcoded (`fixed`, `autonomy`) por consulta a `plan_templates` (mesma fonte do admin), filtrando o plano atual e `pdv_only`.
- Manter labels/preços vindos do template pra não divergir do painel admin.

### 1.4 Histórico auditável
- Em `approve_plan_change` e `reject_plan_change`: inserir linha em `admin_logs` (`action='plan_change_approved'|'rejected'`, `target_store_id`, payload com from/to/fee/prorata).

### 1.5 Unificar caminho do auto-upgrade Autonomia Dinâmica
- `respond_essencial_upgrade` passa a criar uma linha em `plan_change_requests` com `status='approved'` e chama a mesma lógica interna de `approve_plan_change` (via função auxiliar `_apply_plan_change(store_id, new_plan, ...)`), pra ter histórico e prorata iguais.

---

## Parte 2 — Antifraude (fechar os buracos)

### 2.1 Rate-limit por IP + device no cadastro
- `register_as_lojista` passa a receber `p_ip TEXT, p_device_id TEXT` e gravar em `signup_attempts`.
- Regras adicionais: máx **5 tentativas / 24 h por IP** e **3 / 24 h por device_id**.
- Frontend do cadastro coleta `device_id` (fingerprint leve: `crypto.randomUUID()` persistido em `localStorage` + `navigator.userAgent` hash) e IP vem via header no edge function que chama o RPC.

### 2.2 Lista de e-mails descartáveis expandida
- Substituir lista inline por pacote `disposable-email-domains` (JSON estático ~3.500 domínios) carregado no edge function `register-lojista-guarded` (novo wrapper) que valida e chama o RPC.

### 2.3 Verificação de WhatsApp por OTP
- Novo edge function `send-whatsapp-otp` (usa Evolution API já configurada) + `verify-whatsapp-otp`.
- Código de 6 dígitos, TTL 10 min, tabela `whatsapp_otp` (hash do código, expires_at, attempts).
- `register_as_lojista` exige `whatsapp_verified_at` no perfil antes de criar a loja.

### 2.4 Fraude do cliente: fail-closed razoável
- `fraudCheck.ts`:
  - `MAX_DISTANCE_KM` passa a ser lido de `stores.max_delivery_km` (default 15 km).
  - Quando GPS negado E `deliveryCity` ausente → **bloqueia** (fail-closed) em vez de deixar passar.
  - Após **3 tentativas bloqueadas em 1 h** do mesmo `user_id` ou device → bloquear novos pedidos por 24 h (checar contagem em `fraud_attempts`).

### 2.5 Garantir unicidade CPF/CNPJ
- Migração idempotente: se `stores.cnpj_cpf` não existir, criar coluna + índice único parcial. Backfill a partir de `profiles.document` quando possível.

### 2.6 CAPTCHA no cadastro
- Adicionar hCaptcha (grátis) no formulário de cadastro de lojista; token validado no edge function wrapper antes de chamar o RPC.

---

## Ordem de execução (5 entregas)

1. **DB migration**: `billing_credit_cents`, `stores.cnpj_cpf` (se faltar), tabela `whatsapp_otp`, colunas IP/device já usadas em `signup_attempts`.
2. **RPCs**: `approve_plan_change` v2, `_apply_plan_change`, `register_as_lojista` v2 (IP/device/otp).
3. **Edge functions**: `register-lojista-guarded` (hCaptcha + disposable list + IP), `send-whatsapp-otp`, `verify-whatsapp-otp`, ajuste `monthly-billing` (consumir crédito).
4. **Frontend**: `StoreSubscription.tsx` dinâmico, cadastro com hCaptcha + OTP WhatsApp + device_id, `fraudCheck.ts` fail-closed + limite por loja.
5. **Bump versão** + smoke test Playwright (pedir troca de plano → admin aprova → conferir crédito aplicado na próxima fatura simulada; tentar cadastro com e-mail descartável / sem OTP → bloqueado).

---

## Fora de escopo (confirmar se quer incluir)
- SMS OTP (custo por mensagem — WhatsApp OTP já cobre o caso).
- Serviço pago tipo Kickbox pra e-mail (lista estática já reduz 95%).
- Score de risco por machine learning.

Aprova esse plano ou quer ajustar prioridades / remover alguma parte?
