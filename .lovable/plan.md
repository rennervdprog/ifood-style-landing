## Objetivo
Eliminar a etapa manual em `AdminApprovals` e aprovar lojistas/entregadores automaticamente assim que o cadastro estiver **completo + validado**, mantendo trilha de auditoria e antifraude para reverter casos suspeitos.

## Estado atual
- Hoje todo cadastro entra com `profiles.is_approved = false` e fica aguardando um clique do admin em `src/components/AdminApprovals.tsx` → RPC `admin_approve_partner`.
- Não há validação automática de documento, CNH, foto ou unicidade. Aprovação é 100% baseada em "olho do admin".
- WhatsApp de boas-vindas só dispara depois do clique.

## Critérios de aprovação automática

### Lojista (`role = 'lojista'`)
1. `full_name`, `document` (CPF ou CNPJ válido — dígito verificador), `email`, `whatsapp_number`, `cep`, `street`, `number`, `neighborhood`, `city` preenchidos.
2. Endereço geocodificado com sucesso (`stores.lat/lng` não nulos via núcleo `@/lib/location`).
3. Documento aceito pelo Asaas (cria/valida subconta — se Asaas devolver `commercialInfo: APPROVED`, libera).
4. Antifraude: documento + e-mail únicos em `profiles` e `archived_accounts`; IP/dispositivo não na blacklist de `fraud_attempts`.
5. Loja criada em `stores` com `category` definida.

### Entregador (`role = 'motoboy'`)
1. `full_name`, `document` (CPF válido), `whatsapp_number`, `city`, `vehicle`, `cnh_number`, `cnh_front_url`, `selfie_url` preenchidos.
2. CNH em formato válido (11 dígitos) e foto/selfie acessíveis no Storage (verificação de tamanho/MIME).
3. Antifraude: CPF + CNH únicos; selfie vs CNH com score mínimo (opcional — Lovable AI Vision).
4. Cidade dentro das cidades ativas em `cities`.

## Arquitetura

```text
Cadastro (Lojista/Entregador)
        │
        ▼
INSERT profiles + stores/drivers
        │
        ▼  trigger AFTER INSERT/UPDATE
auto_approve_partner()  ──► chama edge function "auto-approve-partner"
        │                         │
        │                         ├─ valida doc (mod11)
        │                         ├─ checa duplicidade
        │                         ├─ chama Asaas (lojista) / valida storage (entregador)
        │                         ├─ geocode check
        │                         └─ opcional: Lovable AI Vision (selfie x CNH)
        ▼
score >= threshold  ──► UPDATE profiles SET is_approved=true
                         + log_admin_action('auto_approve_partner')
                         + dispara WhatsApp de boas-vindas
score < threshold   ──► mantém pendente + insere linha em compliance_alerts
                         (admin revisa manualmente como hoje)
```

## Implementação por fases

**Fase 1 — Núcleo de validação (backend)**
- Migration: função `public.validate_partner_profile(_user_id uuid)` → retorna `jsonb` com `{ ok, score, missing[], reasons[] }`. Implementa dígito verificador CPF/CNPJ e checa completeness.
- Edge function `auto-approve-partner/index.ts` (verify_jwt=false, chamada por trigger via `pg_net`):
  - Recebe `user_id`.
  - Roda `validate_partner_profile`.
  - Para lojista: chama Asaas (`createSubaccount` ou `myAccount/status` se já existe).
  - Para entregador: HEAD nas URLs de `cnh_front_url`/`selfie_url` para confirmar upload.
  - Se aprovado: `UPDATE profiles SET is_approved = true`, registra `admin_logs` com `action='auto_approve_partner'`, dispara `send-whatsapp-message` (já existe).
  - Se reprovado: insere em `compliance_alerts` com motivo.

**Fase 2 — Disparo automático**
- Trigger `AFTER INSERT OR UPDATE OF document, cnh_front_url, selfie_url, address, cep ON profiles` → chama `auto-approve-partner` via `pg_net.http_post` (somente quando `is_approved=false` e `role IN ('lojista','motoboy')`).
- Trigger equivalente em `stores` (lat/lng preenchidos) e `drivers` (vínculo criado).
- Debounce simples: campo `profiles.auto_approval_last_run_at` para evitar reentrância.

**Fase 3 — Antifraude reforçada**
- Migration: unique index parcial em `profiles.document` (entre não-arquivados).
- Função `public.is_duplicate_document(_doc text, _exclude uuid)` consultando `profiles` + `archived_accounts` + `fraud_attempts`.
- Bloqueio automático com `is_blocked = true` e alerta em `compliance_alerts` quando duplicidade for detectada.

**Fase 4 — UI Admin (revisão de exceções)**
- `AdminApprovals.tsx` passa a mostrar **apenas** os cadastros que falharam na automação, com a lista de `reasons` vinda de `compliance_alerts`.
- Novo badge "Auto-aprovado" e filtro para auditar últimas 24h.
- Mantém botões Aprovar/Recusar para o fluxo de exceção.

**Fase 5 — Observabilidade**
- View `public.partner_auto_approval_stats` (total, aprovados, reprovados, motivos top-5) consumida pelo `SuperAdminDashboardV2` em um card novo.
- Logs estruturados na edge function (Sentry já configurado).

## Detalhes técnicos
- Reutilizar `src/lib/documentFormat.ts` para validar CPF/CNPJ no front e portar a mesma lógica em SQL.
- Asaas: usar `supabase/functions/asaas-create-subaccount` existente; só consumir resposta.
- Geocoding: já gravado pelo núcleo `@/lib/location` durante o cadastro; basta checar `lat IS NOT NULL`.
- Storage check: `supabase.storage.from('cnh').createSignedUrl(...)` para garantir que o objeto existe.
- WhatsApp: extrair o template atual do `handleApprove` em `AdminApprovals` para função compartilhada em `src/lib/partnerWelcome.ts`, reutilizada pela edge function via REST.
- Versionar (`appVersion.ts` + `build.gradle`) e adicionar testes em `src/lib/__tests__/documentFormat.test.ts` cobrindo casos novos.

## Rollout seguro
1. Deploy com flag `admin_settings.auto_approval_enabled = false` (default).
2. Modo "shadow": função roda e só registra decisão em `admin_logs` sem alterar `is_approved`.
3. Comparar 50 cadastros reais com decisão manual.
4. Ativar flag em produção; manter painel de exceções por 30 dias.
5. Kill switch: setar flag para `false` reverte ao fluxo manual atual sem mudança de código.
