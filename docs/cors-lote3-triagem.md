# Item 9 — CORS lote 3: triagem das funções restantes com `*`

**Data:** 23/11/2026 · **Base:** `origin/main` HEAD `333126d11c5eb16d00bcb12f267ef3d8162749e8`
**Escopo:** SOMENTE triagem — nenhum patch, deploy, migration ou escrita no banco.
**Método:** árvore recursiva da base via API do GitHub + leitura de cada
`supabase/functions/*/index.ts` via API; `supabase/config.toml` para o `verify_jwt`;
chamadores por busca de `supabase.functions.invoke('<slug>')`, `functions/v1/<slug>`,
`externalFunctionUrl('<slug>')` e `callClaimFunction('<slug>', …)` em `src/` e nas
próprias edges. Verificação local pulada por restrição de execução do lote
(sem clone, sem `git`/`npm`/`tsc` sobre o conteúdo do repo).

## Contagem — e por que não são ~92

| Onde | Quantidade |
|---|---:|
| Total de edge functions (`supabase/functions/*/index.ts`) | 110 |
| Com allowlist no repo (`ALLOWED_ORIGINS`) | 12 |
| Com `Access-Control-Allow-Origin: "*"` no repo | **88** |
| Sem nenhum header CORS | 10 |

A triagem de 21/11 contou **97** arquivos com `*`. Desde então entraram na main
**9** allowlists: PR #817 (`monthly-billing`, lote 1) + PR #820 (8 funções, lote 2).
97 − 9 = **88** — a conta fecha exatamente. O `~92` da ordem do lote estava 4 acima,
provavelmente por contar parte das 10 sem CORS ou por usar o número pré-lote 2.
O plano falava em 112 funções; o repo tem **110** `index.ts` (2 a menos — funções
removidas ou contadas a mais no plano; não investigado, fora do escopo).

## Resumo por classe

| Classe | Qtd | O que fazer no próximo lote |
|---|---:|--:|
| **A — navegador/app** (precisa de allowlist) | 36 | aplicar o padrão (ordem abaixo) |
| **B — servidor/cron/webhook interno** (CORS irrelevante) | 32 | nada de CORS; só auth/secret (já existe na maioria) |
| **C — pública legítima** (webhook com validação própria / leitura pública) | 12 | nada de CORS |
| **D — stub/legado desativado** | 5 | nada de CORS; candidato a remoção futura |
| **NM — não mexer** (deployado desconhecido/divergente) | 3 | nada — investigação própria fora do escopo |
| **Total com `*`** | **88** | |

Dentro da classe A, **13 já estão com allowlist NO AR** (deployadas em 21/11 com o
padrão, versões v6–v74) — no repo o fonte ainda tem `*`. Para essas 13 o próximo lote
só **registra o código no repo** (mesmo padrão do PR #820), não re-aplica nada no ar.
Restam **23 funções A novas** para receber a allowlist de verdade.

## Ordem sugerida para o próximo lote (aplicação)

### 1. Registrar no repo as 13 já allowlistadas no ar (só código, sem deploy)

- `backfill-coords` — chamador: src/pages/super-admin/tabs/DebugLojaTab.tsx; cron (migration 20260814)
- `delete-account` — chamador: src/pages/PerfilPage.tsx (fetch direto)
- `evolution-qr-code` — chamador: src/components/whatsapp/WhatsAppConnection.tsx
- `evolution-send-message` — chamador: src/pages/admin/components/AdminOrderCard.tsx (+Teste); src/lib/orderNotifications.ts; edges: evolution-webhook, evolution-webhook-teste, order-status-whatsapp, whatsapp-bot-handler
- `generate-commission-charge` — chamador: src/components/finance/ComissoesPanel.tsx
- `guest-checkout` — chamador: src/pages/GuestCheckoutPage.tsx
- `manage-store-addon` — chamador: src/components/StoreAddonsPanel.tsx; src/components/admin/AdminStoreAddonsPanel.tsx; src/components/pdv/PdvUpsellScreen.tsx; src/pages/pdv/components/PdvMigratePlanCard.tsx
- `payment-router` — chamador: src/components/CommissionAlert.tsx; src/components/PlatformSplitAlert.tsx; src/components/StoreFinanceBasic.tsx (+Reorg); src/components/StoreFinancePanel.tsx (+Reorg); src/components/TrialExpiredGuard.tsx; src/components/repasse/RepasseAlert.tsx; src/pages/PedidosPage.tsx
- `reconcile-payments` — chamador: src/components/finance/ConciliacaoAsaasPanel.tsx; src/pages/super-admin/tabs/AuditoriaTab.tsx
- `register-push-device` — chamador: src/lib/pushRegistration.ts
- `send-push` — chamador: src/components/DebugOverlay.tsx; src/lib/firebase.ts; edges: admin-broadcast-push, weekly-platform-report, auto-charge-physical-fees; cron (migration 20260418)
- `store-whatsapp-sync-status` — chamador: src/components/WhatsAppSetup.tsx (+Teste)
- `subscribe-plan-payment` — chamador: src/components/TrialExpiredGuard.tsx

Fontes deployadas salvas em 21/11 em `~/workspace/auditoria-40-itens/*-cors-v*.ts`
(ex.: `payment-router-cors-v67.ts`). Antes de registrar, **reconferir deployado vs repo
função por função** — o deployado pode ter andado desde 21/11 (lição do `evolution-keepalive`).

### 2. Allowlist nova — P1 dinheiro (4)

- `admin-payout-store` — edge: auto-payout-cron — JWT (getUser) + admin; dinheiro (payout manual da loja). Sem chamador no painel neste repo — confirmar o botao antes de aplicar.
- `cancel-order-refund` — sem chamador real (so o proprio index.test.ts) — Bearer obrigatorio (401 sem); dinheiro (cancelamento/reembolso). Chamador real nao encontrado neste repo — provavel app nativo; conferir antes de aplicar.
- `confirm-order-payment` — edge: asaas-webhook; polling guest (triagem 21/11) — Fluxo guest (sem JWT por desenho — nao da para ligar JWT); so confirma se o Asaas disser que pagou. Falta rate limit (item 8). Sem chamador em src/ neste repo — provavel app nativo.
- `create-pix-payment` — sem chamador real (so o proprio index.test.ts) — JWT (getUser); dinheiro (criacao de pagamento Pix). Chamador real nao encontrado — conferir antes de aplicar.

### 3. Allowlist nova — P2 navegador com dados/JWT (12)

- `admin-set-pin-autofill` — src/components/AdminPlanManager.tsx (+Teste) — JWT + role admin; verify_jwt=true ja.
- `asaas-financial-panel` — sem chamador neste repo — JWT + dono da loja; verify_jwt=true ja. O painel financeiro deve chamar por caminho nao encontrado — conferir antes de aplicar.
- `batch-store-distances` — src/hooks/useBatchStoreDistances.ts — Sem auth de entrada visivel; so leitura de distancias. Allowlist resolve.
- `claim-check` — src/pages/AuthPage.tsx (via callClaimFunction) — Fluxo guest (sem JWT por desenho); so diz se o telefone tem conta. Falta rate limit (item 8).
- `claim-verify-otp` — src/pages/AuthPage.tsx (via callClaimFunction) — Fluxo guest (OTP); deployado no projeto EXTERNO (comentario no fonte). Falta rate limit (item 8).
- `create-asaas-subaccount` — edge: seed-test-accounts (so) — JWT + admin/dono; verify_jwt=true ja. Sem chamador no painel neste repo.
- `get-asaas-subaccount-status` — sem chamador neste repo — JWT via header Authorization repassado ao cliente supabase; dinheiro (status da subconta).
- `pix-direto-confirm` — sem chamador real (so o proprio index.test.ts) — JWT via header Authorization; dinheiro (Pix direto). Chamador real nao encontrado — provavel app nativo.
- `pix-direto-refuse` — sem chamador neste repo — JWT via header Authorization; dinheiro (recusa de Pix direto).
- `sales-coach` — src/components/SalesCoachPanel.tsx (via externalFunctionUrl) — ATENCAO: sem auth de entrada visivel no repo (usa LOVABLE_API_KEY so para fora). Antes de aplicar a allowlist, confirmar se o painel manda JWT e se a funcao valida — se nao validar, o buraco nao e o CORS.
- `upload-asaas-documents` — sem chamador neste repo — JWT (getUser); upload de documentos para o Asaas.
- `whatsapp-diag` — sem chamador neste repo — JWT + role admin/super_admin; verify_jwt=true ja.

### 4. Allowlist nova — P3 leitura pública / baixo risco (7)

- `agent-mint-e2e` — ferramenta do agente Lovable (externo) — verify_jwt=true por default (ausente no config.toml); so usuario autenticado do preview invoca. Risco baixo.
- `count-supporters` — src/hooks/useSupporterCount.ts — Leitura publica inofensiva (nº agregado); verify_jwt=false.
- `ota-update` — capacitor.config.ts; src/lib/otaUpdate.ts (app) — Leitura publica de versao (manifest do Storage); verify_jwt=false. Sem auth — por desenho, como count-supporters.
- `platform-whatsapp-sync-status` — sem chamador neste repo — JWT (getUser); leitura de status de sincronizacao.
- `send-whatsapp-otp` — sem chamador neste repo (legado do fluxo OTP; so citado em comentario de claim-send-otp/claim-verify-otp) — JWT (getUser). O fluxo atual de OTP do guest usa claim-send-otp/claim-verify-otp — verificar se esta ainda e usada antes de gastar lote nela.
- `verify-whatsapp-otp` — sem chamador neste repo (legado do fluxo OTP; so citado em comentario de claim-send-otp/claim-verify-otp) — JWT (getUser). Mesmo aviso de send-whatsapp-otp: confirmar uso antes de gastar lote.
- `zapi-send-message` — sem chamador neste repo — JWT via getClaims(token).

### 5. Não recebem patch de CORS (B + C + D = 49)

CORS é irrelevante para elas (cron, edge-to-edge, webhook de provedor, leitura pública
por desenho, stub). Exceções com FLAG para olhar antes de fechar o item (não são CORS,
são auth): `daily-finance-digest`, `pix-direto-cron`, `sales-coach` (ver tabela), e as
manuais sem auth de entrada (`seed-ricburguer-demo`, `import-ricburguer-menu`,
`setup-app-releases-bucket`, `vercel-audit`) — candidatas a trancar ou remover.

## Tabela completa — as 88 com `*`

`verify_jwt` = valor no `config.toml` da base. `(ausente)` = não está no `config.toml`;
o default do gateway é `true`, mas **o valor que vale em produção é o da metadata do
deploy** (lição da triagem 21/11) — conferir deployado vs repo antes de qualquer virada.
`P*` na prioridade com `*` = já allowlistada no ar, só falta registrar no repo.

| Função | verify_jwt | Classe | Prioridade | Chamador(es) | Auth / observação |
|---|:---:|:---:|:---:|---|---|
| `admin-payout-store` | (ausente no config.toml — default true) | A | P1 | edge: auto-payout-cron | JWT (getUser) + admin; dinheiro (payout manual da loja). Sem chamador no painel neste repo — confirmar o botao antes de aplicar. |
| `admin-set-pin-autofill` | true | A | P2 | src/components/AdminPlanManager.tsx (+Teste) | JWT + role admin; verify_jwt=true ja. |
| `agent-mint-e2e` | (ausente no config.toml — default true) | A | P3 | ferramenta do agente Lovable (externo) | verify_jwt=true por default (ausente no config.toml); so usuario autenticado do preview invoca. Risco baixo. |
| `asaas-financial-panel` | true | A | P2 | sem chamador neste repo | JWT + dono da loja; verify_jwt=true ja. O painel financeiro deve chamar por caminho nao encontrado — conferir antes de aplicar. |
| `backfill-coords` | (ausente no config.toml — default true) | A | P2* | src/pages/super-admin/tabs/DebugLojaTab.tsx; cron (migration 20260814) | JA NO AR com allowlist (deploy v15/v16, 21/11) — repo so registra o codigo. |
| `batch-store-distances` | (ausente no config.toml — default true) | A | P2 | src/hooks/useBatchStoreDistances.ts | Sem auth de entrada visivel; so leitura de distancias. Allowlist resolve. |
| `cancel-order-refund` | (ausente no config.toml — default true) | A | P1 | sem chamador real (so o proprio index.test.ts) | Bearer obrigatorio (401 sem); dinheiro (cancelamento/reembolso). Chamador real nao encontrado neste repo — provavel app nativo; conferir antes de aplicar. |
| `claim-check` | (ausente no config.toml — default true) | A | P2 | src/pages/AuthPage.tsx (via callClaimFunction) | Fluxo guest (sem JWT por desenho); so diz se o telefone tem conta. Falta rate limit (item 8). |
| `claim-verify-otp` | (ausente no config.toml — default true) | A | P2 | src/pages/AuthPage.tsx (via callClaimFunction) | Fluxo guest (OTP); deployado no projeto EXTERNO (comentario no fonte). Falta rate limit (item 8). |
| `confirm-order-payment` | false | A | P1 | edge: asaas-webhook; polling guest (triagem 21/11) | Fluxo guest (sem JWT por desenho — nao da para ligar JWT); so confirma se o Asaas disser que pagou. Falta rate limit (item 8). Sem chamador em src/ neste repo — provavel app nativo. |
| `count-supporters` | false | A | P3 | src/hooks/useSupporterCount.ts | Leitura publica inofensiva (nº agregado); verify_jwt=false. |
| `create-asaas-subaccount` | true | A | P2 | edge: seed-test-accounts (so) | JWT + admin/dono; verify_jwt=true ja. Sem chamador no painel neste repo. |
| `create-pix-payment` | (ausente no config.toml — default true) | A | P1 | sem chamador real (so o proprio index.test.ts) | JWT (getUser); dinheiro (criacao de pagamento Pix). Chamador real nao encontrado — conferir antes de aplicar. |
| `delete-account` | (ausente no config.toml — default true) | A | P2* | src/pages/PerfilPage.tsx (fetch direto) | JA NO AR com allowlist (deploy v50, 21/11) — repo so registra o codigo. JWT (getUser). |
| `evolution-qr-code` | (ausente no config.toml — default true) | A | P2* | src/components/whatsapp/WhatsAppConnection.tsx | JA NO AR com allowlist (deploy v66/v67, 21/11) — repo so registra o codigo. JWT + EVOLUTION_WEBHOOK_TOKEN. |
| `evolution-send-message` | false | A | P2* | src/pages/admin/components/AdminOrderCard.tsx (+Teste); src/lib/orderNotifications.ts; edges: evolution-webhook, evolution-webhook-teste, order-status-whatsapp, whatsapp-bot-handler | JA NO AR com allowlist (deploy v74, 21/11) — repo so registra o codigo. JWT + EVOLUTION_WEBHOOK_TOKEN. |
| `generate-commission-charge` | (ausente no config.toml — default true) | A | P1* | src/components/finance/ComissoesPanel.tsx | JA NO AR com allowlist (deploy v56, 21/11) — repo so registra o codigo. JWT (getUser); dinheiro. |
| `get-asaas-subaccount-status` | (ausente no config.toml — default true) | A | P2 | sem chamador neste repo | JWT via header Authorization repassado ao cliente supabase; dinheiro (status da subconta). |
| `guest-checkout` | (ausente no config.toml — default true) | A | P1* | src/pages/GuestCheckoutPage.tsx | JA NO AR com allowlist (deploy v40, 21/11) — repo so registra o codigo. Fluxo guest; dinheiro. |
| `manage-store-addon` | true | A | P2* | src/components/StoreAddonsPanel.tsx; src/components/admin/AdminStoreAddonsPanel.tsx; src/components/pdv/PdvUpsellScreen.tsx; src/pages/pdv/components/PdvMigratePlanCard.tsx | JA NO AR com allowlist (deploy v6, 21/11) — repo so registra o codigo. JWT + dono/admin; verify_jwt=true ja. |
| `ota-update` | false | A | P3 | capacitor.config.ts; src/lib/otaUpdate.ts (app) | Leitura publica de versao (manifest do Storage); verify_jwt=false. Sem auth — por desenho, como count-supporters. |
| `payment-router` | (ausente no config.toml — default true) | A | P1* | src/components/CommissionAlert.tsx; src/components/PlatformSplitAlert.tsx; src/components/StoreFinanceBasic.tsx (+Reorg); src/components/StoreFinancePanel.tsx (+Reorg); src/components/TrialExpiredGuard.tsx; src/components/repasse/RepasseAlert.tsx; src/pages/PedidosPage.tsx | JA NO AR com allowlist (deploy v67, 21/11) — repo so registra o codigo. JWT (getUser); dinheiro (roteador de pagamentos). |
| `pix-direto-confirm` | (ausente no config.toml — default true) | A | P2 | sem chamador real (so o proprio index.test.ts) | JWT via header Authorization; dinheiro (Pix direto). Chamador real nao encontrado — provavel app nativo. |
| `pix-direto-refuse` | (ausente no config.toml — default true) | A | P2 | sem chamador neste repo | JWT via header Authorization; dinheiro (recusa de Pix direto). |
| `platform-whatsapp-sync-status` | (ausente no config.toml — default true) | A | P3 | sem chamador neste repo | JWT (getUser); leitura de status de sincronizacao. |
| `reconcile-payments` | (ausente no config.toml — default true) | A | P1* | src/components/finance/ConciliacaoAsaasPanel.tsx; src/pages/super-admin/tabs/AuditoriaTab.tsx | JA NO AR com allowlist (deploy v39, 21/11) — repo so registra o codigo. CRON_SECRET ou service key; dinheiro. |
| `register-push-device` | (ausente no config.toml — default true) | A | P2* | src/lib/pushRegistration.ts | JA NO AR com allowlist (deploy v50, 21/11) — repo so registra o codigo. JWT (getUser). |
| `sales-coach` | (ausente no config.toml — default true) | A | P2 | src/components/SalesCoachPanel.tsx (via externalFunctionUrl) | ATENCAO: sem auth de entrada visivel no repo (usa LOVABLE_API_KEY so para fora). Antes de aplicar a allowlist, confirmar se o painel manda JWT e se a funcao valida — se nao validar, o buraco nao e o CORS. |
| `send-push` | (ausente no config.toml — default true) | A | P2* | src/components/DebugOverlay.tsx; src/lib/firebase.ts; edges: admin-broadcast-push, weekly-platform-report, auto-charge-physical-fees; cron (migration 20260418) | JA NO AR com allowlist (deploy v57, 21/11) — repo so registra o codigo. JWT (getUser). |
| `send-whatsapp-otp` | (ausente no config.toml — default true) | A | P3 | sem chamador neste repo (legado do fluxo OTP; so citado em comentario de claim-send-otp/claim-verify-otp) | JWT (getUser). O fluxo atual de OTP do guest usa claim-send-otp/claim-verify-otp — verificar se esta ainda e usada antes de gastar lote nela. |
| `store-whatsapp-sync-status` | (ausente no config.toml — default true) | A | P2* | src/components/WhatsAppSetup.tsx (+Teste) | JA NO AR com allowlist (deploy v23, 21/11) — repo so registra o codigo. |
| `subscribe-plan-payment` | (ausente no config.toml — default true) | A | P1* | src/components/TrialExpiredGuard.tsx | JA NO AR com allowlist (deploy v59, 21/11) — repo so registra o codigo. JWT (getUser); dinheiro. |
| `upload-asaas-documents` | (ausente no config.toml — default true) | A | P2 | sem chamador neste repo | JWT (getUser); upload de documentos para o Asaas. |
| `verify-whatsapp-otp` | (ausente no config.toml — default true) | A | P3 | sem chamador neste repo (legado do fluxo OTP; so citado em comentario de claim-send-otp/claim-verify-otp) | JWT (getUser). Mesmo aviso de send-whatsapp-otp: confirmar uso antes de gastar lote. |
| `whatsapp-diag` | true | A | P2 | sem chamador neste repo | JWT + role admin/super_admin; verify_jwt=true ja. |
| `zapi-send-message` | (ausente no config.toml — default true) | A | P3 | sem chamador neste repo | JWT via getClaims(token). |
| `asaas-health` | (ausente no config.toml — default true) | B | — | cron (CRON_SECRET) | Servico de saude do Asaas; CORS irrelevante. |
| `auto-charge-physical-fees` | (ausente no config.toml — default true) | B | — | cron do repasse (CRON_SECRET); chama send-push | Politica canonica de repasse (30 dias); CORS irrelevante. |
| `auto-finalize-orders` | (ausente no config.toml — default true) | B | — | cron (service key ou admin da plataforma) | Auto-finalize de pedidos parados; CORS irrelevante. |
| `auto-payout-cron` | (ausente no config.toml — default true) | B | — | cron (CRON_SECRET); chama platform-whatsapp-send e admin-payout-store | Dinheiro (payout automatico); CORS irrelevante. |
| `auto-withdraw-subaccounts` | false | B | — | cron (migration 20260429; CRON_SECRET) | verify_jwt=false; CORS irrelevante. |
| `billing-reminders` | false | B | — | cron (CRON_SECRET ou service key) | verify_jwt=false; CORS irrelevante. |
| `check-essencial-upgrade` | (ausente no config.toml — default true) | B | — | edge: e2e-dynamic-upgrade-flow; CRON_SECRET | Upgrade automatico p/ Essencial; CORS irrelevante. |
| `daily-finance-digest` | (ausente no config.toml — default true) | B | — | sem chamador neste repo | FLAG: sem checagem de entrada visivel no repo (usa service_role para fora). Antes de fechar como 'cron', confirmar o agendamento e a auth — se for chamado sem secret, e achado, nao CORS. |
| `e2e-dynamic-upgrade-flow` | (ausente no config.toml — default true) | B | — | e2e/08-plano-dinamico-ciclo-completo.spec.ts; E2E_ADMIN_SECRET | Teste E2E; CORS irrelevante. |
| `e2e-monthly-flow` | (ausente no config.toml — default true) | B | — | sem chamador (E2E_ADMIN_SECRET) | Teste E2E; CORS irrelevante. |
| `e2e-pix-flow` | (ausente no config.toml — default true) | B | — | sem chamador (CRON_SECRET + E2E_ADMIN_SECRET) | Teste E2E; CORS irrelevante. |
| `evolution-keepalive` | false | B | — | paineis de admin + cron da sentinela (segundo triagem 21/11) | verify_jwt=false. O DEPLOYADO (v36) ja tem AUTH v2 (service key / x-cron-secret / JWT admin) — o repo esta desatualizado; nada de CORS aqui sem conferir deployado vs repo. |
| `evolution-repair-webhooks` | (ausente no config.toml — default true) | B | — | sem chamador neste repo | EVOLUTION_WEBHOOK_TOKEN (x-internal-token ou ?token=); CORS irrelevante. |
| `import-ricburguer-menu` | (ausente no config.toml — default true) | B | — | sem chamador neste repo (seed manual) | FLAG: sem auth de entrada visivel; uso manual pontual. Considerar remover ou trancar, nao aplicar CORS. |
| `order-status-whatsapp` | false | B | — | sem chamador neste repo | CRON_SECRET ou service key ou token interno; verify_jwt=false; CORS irrelevante. |
| `partner-payout-cron` | (ausente no config.toml — default true) | B | — | cron (CRON_SECRET) | Dinheiro (payout de parceiros); CORS irrelevante. |
| `pix-direto-cron` | (ausente no config.toml — default true) | B | — | sem chamador real (so o proprio index.test.ts) | FLAG: cron por comentario no fonte, mas sem CRON_SECRET visivel — confirmar agendamento e auth antes de fechar. |
| `pix-direto-notify` | (ausente no config.toml — default true) | B | — | edge: guest-pix-proof-upload | Edge-to-edge; CORS irrelevante. |
| `platform-whatsapp-send` | false | B | — | edges: admin-payout-store, auto-payout-cron, send-whatsapp-otp | Fechado 21/11 (CRON_SECRET ou service key ou JWT admin); verify_jwt=false; CORS irrelevante. |
| `print-agent` | (ausente no config.toml — default true) | B | — | programa Windows ItaSuperAgente (externo) | Token proprio de agente (pareamento 6 digitos, hash SHA-256); nao e navegador — CORS irrelevante. |
| `run-asaas-health` | (ausente no config.toml — default true) | B | — | sem chamador neste repo (gatilho manual/servico) | Dispara asaas-health; CORS irrelevante. |
| `run-asaas-repair-webhook` | (ausente no config.toml — default true) | B | — | sem chamador neste repo (gatilho manual/servico) | Dispara reparo do webhook Asaas; CORS irrelevante. |
| `run-sandbox-tests` | (ausente no config.toml — default true) | B | — | sem chamador neste repo | CRON_SECRET + E2E_ADMIN_SECRET; CORS irrelevante. |
| `seed-ricburguer-demo` | (ausente no config.toml — default true) | B | — | sem chamador neste repo (seed manual) | FLAG: sem auth de entrada visivel; uso manual pontual. Considerar remover ou trancar, nao aplicar CORS. |
| `seed-test-accounts` | (ausente no config.toml — default true) | B | — | sem chamador neste repo (seed manual); chama create-asaas-subaccount | JWT (getUser) + service_role; CORS irrelevante. |
| `setup-app-releases-bucket` | (ausente no config.toml — default true) | B | — | sem chamador neste repo (setup manual) | FLAG: sem auth de entrada visivel; uso pontual. Considerar remover ou trancar, nao aplicar CORS. |
| `vercel-audit` | (ausente no config.toml — default true) | B | — | sem chamador neste repo (manual) | FLAG: sem auth de entrada visivel (usa VERCEL_API_TOKEN so para fora). Considerar remover ou trancar, nao aplicar CORS. |
| `weekly-platform-report` | (ausente no config.toml — default true) | B | — | cron (migration 20260418); chama send-push | Relatorio semanal; CORS irrelevante. |
| `whatsapp-bot-handler` | (ausente no config.toml — default true) | B | — | edges: evolution-webhook, evolution-webhook-teste | Edge-to-edge (EVOLUTION_WEBHOOK_TOKEN); CORS irrelevante. |
| `woovi-sandbox-monthly-billing` | (ausente no config.toml — default true) | B | — | sem chamador neste repo | x-woovi-sandbox-secret obrigatorio; so lojas is_test=true; ambiente sandbox; CORS irrelevante. |
| `woovi-sandbox-weekly-repasse` | (ausente no config.toml — default true) | B | — | sem chamador neste repo | x-woovi-sandbox-secret obrigatorio (mesmo padrao da irma); ambiente sandbox; CORS irrelevante. |
| `zapi-send-internal` | false | B | — | cron (migration 20260417; Bearer service_role) | verify_jwt=false; CORS irrelevante. |
| `abacatepay-webhook` | (ausente no config.toml — default true) | C | — | provedor AbacatePay (webhook) | webhookSecret na query (?webhookSecret=); fail-closed sem secret. CORS irrelevante (provedor nao e navegador). |
| `asaas-webhook` | false | C | — | provedor Asaas (webhook); edges de teste/reparo | header asaas-access-token vs secret; 401 sem/errado. Fechado 21/11. verify_jwt=false; CORS irrelevante. |
| `evolution-webhook` | false | C | — | Evolution API (webhook); edges: evolution-keepalive, evolution-qr-code, evolution-repair-webhooks | EVOLUTION_WEBHOOK_TOKEN; verify_jwt=false; CORS irrelevante. |
| `evolution-webhook-teste` | false | C | — | Evolution API instancia de teste (webhook) | EVOLUTION_WEBHOOK_TOKEN; verify_jwt=false; CORS irrelevante. |
| `meta-webhook` | false | C | — | Meta (webhook) | HMAC X-Hub-Signature-256 obrigatoria; verify_jwt=false; CORS irrelevante. |
| `mp-return` | (ausente no config.toml — default true) | C | — | redirect de retorno do Mercado Pago (navegador do cliente, sem fetch) | Pagina de retorno com redirect; fluxo legado do Mercado Pago. CORS irrelevante — nao ha chamada XHR para ela. |
| `og-store` | (ausente no config.toml — default true) | C | — | crawlers/redes sociais (meta tags OG) | Leitura publica (nome/foto de lojas ativas, via anon key); por desenho. CORS irrelevante. |
| `rss-blog` | (ausente no config.toml — default true) | C | — | leitores/feed RSS | Leitura publica (posts publicados); por desenho. CORS irrelevante. |
| `sitemap-blog` | (ausente no config.toml — default true) | C | — | crawlers de busca | Leitura publica (sitemap XML); por desenho. CORS irrelevante. |
| `woovi-sandbox-webhook` | (ausente no config.toml — default true) | C | — | Woovi sandbox (webhook) | Assinatura RSA (x-webhook-signature) com chave publica; ambiente sandbox; CORS irrelevante. |
| `woovi-webhook` | false | C | — | Woovi (webhook) | Assinatura HMAC/RSA (verifyWooviSignature); fallback removido 21/11. verify_jwt=false; CORS irrelevante. |
| `zapi-webhook` | false | C | — | Z-API (webhook) | Token na query (?token=); fail-closed sem secret. verify_jwt=false; CORS irrelevante. |
| `auto-deactivate-stores` | (ausente no config.toml — default true) | D | — | sem chamador | Deprecated: responde JSON estatico ('use auto-charge-physical-fees'); nao toca dado nenhum. Candidato a remocao, nao a CORS. |
| `check-balance-restrictions` | false | D | — | sem chamador | Stub depreciado: responde JSON estatico (classe D da triagem 21/11). verify_jwt=false. Candidato a remocao, nao a CORS. |
| `create-mp-preference` | (ausente no config.toml — default true) | D | — | sem chamador | Deprecated: responde 410 ('use payment-router'); nao executa nada. Candidato a remocao, nao a CORS. |
| `create-withdrawal-request` | (ausente no config.toml — default true) | D | — | sem chamador | Desativada: responde 410 (saque de motoboy e legado). Candidato a remocao, nao a CORS. |
| `mercadopago-webhook` | (ausente no config.toml — default true) | D | — | sem chamador | Deprecated: so responde ack ('use Asaas'); nao processa nada. Candidato a remocao, nao a CORS. |
| `finance-reconcile-snapshot` | (ausente no config.toml — default true) | NM | — | src/components/finance/ConciliacaoAsaasPanel.tsx | NAO MEXER — codigo deployado desconhecido/divergente do repo (triagem 21/11). Investigacao propria fora do escopo deste lote. |
| `kds` | false | NM | — | src/pages/KdsPage.tsx; SettingsTab (+Reorg/Teste) | NAO MEXER — fonte do repo desatualizada vs deployado (v43 ja com allowlist no ar). Nunca redeployar do repo. |
| `terms-compliance-check` | (ausente no config.toml — default true) | NM | — | src/pages/super-admin/tabs/AuditoriaTab.tsx | NAO MEXER — codigo deployado desconhecido (v3 anomalo; a triagem 21/11 achou o deployado igual a sync-to-external). Investigacao propria fora do escopo deste lote. |

## Não mexer — código deployado desconhecido/divergente do repo

| Função | Motivo |
|---|---|
| `kds` | Fonte do repo desatualizada; o deployado (v43) já tem allowlist no ar. Nunca redeployar do repo — regrediria o CEP opcional e o AUTH. |
| `resolve-delivery-address` | **Não está nesta lista** (já tem allowlist no repo), mas registra-se aqui o veto: fonte do repo desatualizada; o deployado é a versão de 06/11 com CEP opcional. Nunca redeployar do repo. |
| `terms-compliance-check` | Código deployado desconhecido (v3 anômalo: o deployado capturado em 21/11 era igual a `sync-to-external`). Tem `exec_sql` com interpolação (item 6). Investigação própria antes de qualquer toque. |
| `finance-reconcile-snapshot` | Código deployado desconhecido (só 3 KB capturados em 21/11, `finance-reconcile-snapshot-3.ts`); a função ainda responde `*` ao vivo. Investigação própria antes de qualquer toque. |

## Já com allowlist no repo (12 — fora desta triagem)

`admin-broadcast-push`, `claim-guest-account`, `claim-send-otp`, `guest-lookup`,
`guest-order-status`, `guest-pix-proof-upload`, `monthly-billing`, `parse-menu-pdf`,
`public-store-catalog`, `quote-delivery`, `resolve-delivery-address`, `sync-to-external`.
(Lote 1: `monthly-billing` — PR #817. Lote 2: 8 funções — PR #820. Pré-existentes:
`quote-delivery`, `resolve-delivery-address`, `sync-to-external`.)

## Sem nenhum header CORS (10 — fora desta triagem)

`asaas-fees-report`, `asaas-repair-webhook`, `calculate-delivery-distance`,
`disable-asaas-notifications`, `e2e-mint-session`, `fix-asaas-webhook`,
`official-whatsapp-send`, `respond-essencial-upgrade`, `store-platform-fee-pix`,
`whatsapp-send-worker`. Sem `Access-Control-Allow-Origin` o navegador já bloqueia a
leitura cross-origin — na prática já estão fechadas para o navegador. Não entram no
trabalho de allowlist; se alguma precisar ser chamada do navegador um dia, aí sim ganha
o padrão (e não o `*`).

## Achados fora do escopo (registrados, não investigados)

- `src/components/RepasseHistory.tsx` chama `repasse-manual-charge` via
  `externalFunctionUrl` — **essa função não existe** em `supabase/functions/` na base.
  Ou o botão está quebrado, ou a função vive em outro projeto. Não é CORS; é para o
  próximo lote de repasse/inventário olhar.
- `sales-coach` não tem auth de entrada visível no repo e é chamada do painel do
  super-admin — se o painel não manda JWT válido e a função não valida, o problema é
  de auth, não de CORS. Confirmar antes de aplicar a allowlist.
- `daily-finance-digest` e `pix-direto-cron` não mostram checagem de entrada no repo;
  se forem cron sem secret, são achados de auth (mesma família dos achados 1 e 2 da
  triagem 21/11), não de CORS.

## Caveats da triagem

- Chamadores varridos por 4 padrões completos (`invoke`, `functions/v1`,
  `externalFunctionUrl`, `callClaimFunction`) com `incomplete_results: false`. A busca
  por nome de cada slug, feita como checagem extra, bateu no rate limit da API de
  busca do GitHub nos últimos 6 slugs (`platform-whatsapp-sync-status`,
  `zapi-send-message`, `cancel-order-refund`, `pix-direto-confirm`, `pix-direto-refuse`,
  `create-pix-payment`) — a classificação desses 6 apoia-se nas 4 varreduras completas
  acima, não na busca por nome. Nada foi inferido além disso.
- Vereditos lidos só no repo. Antes de aplicar qualquer allowlist, conferir deployado
  vs repo função por função — o repo pode estar atrás (lição do `evolution-keepalive`,
  do `kds` e do `resolve-delivery-address`).
- Nenhuma sonda ao vivo foi feita neste lote (triagem por código, sem deploy e sem
  probe). As afirmações "já no ar com allowlist" apoiam-se nas capturas deployadas
  de 21/11 em `~/workspace/auditoria-40-itens/*-cors-v*.ts` — re-sondar no lote de
  aplicação.
- A origem do app Capacitor ainda não está confirmada na lista de `ALLOWED_ORIGINS`
  (pendência herdada da triagem 21/11).
