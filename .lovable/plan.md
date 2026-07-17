# Como o add-on PDV reflete hoje + o que falta para cancelamento

## 1. O que já existe (auditado no código)

### Backend (Supabase externo)
- **`plan_addons`** — catálogo global. Hoje só tem `pdv` a R$ 49,00/mês.
- **`store_addons`** — contratação por loja (`enabled`, `price_override`, `activated_at`, `cancels_at`, `first_charge_done`).
- **`stores.legacy_pdv`** — todas as lojas criadas antes da mudança receberam `true` (mantêm PDV incluso pela regra antiga R$ 1/venda).
- **`admin_settings.addons_module_enabled`** — feature flag global. Foi inserida com valor `false`, então **a UI de add-on está escondida do lojista até hoje**.

### Edge functions
- `manage-store-addon` — ações `activate`, `cancel`, `admin_set` (super admin). Valida dono da loja ou admin.
- `monthly-billing` — já lê `store_addons`, calcula proporcional na 1ª cobrança, soma ao boleto/PIX mensal, marca `first_charge_done`.

### Frontend
- `useStorePdvAccess` decide a origem do acesso: `legacy | addon | vip | pdv_only | none`.
- `useAddonsFlag` esconde tudo se `addons_module_enabled=false`.
- `StoreAddonsPanel` (aba Meu Plano) — mostra o cartão PDV, botão **Ativar** e botão **Cancelar** (só aparece se `source==="addon"` e sem `cancels_at`).
- `AdminStoreAddonsPanel` (super admin) — permite forçar `enabled` e `price_override` (VIP grátis = 0).
- `PdvPage` bloqueia entrada no PDV quando `!pdvAccess.enabled` (mostra upsell).

### Como reflete no app HOJE (resumo honesto)
| Situação da loja | O que ela vê | O que é cobrado |
|---|---|---|
| Legacy (todas antigas) | PDV liberado, sem cartão de add-on | R$ 1/venda no PDV, sem mensalidade extra |
| Nova loja delivery (pós-migração) | Se flag global = false: **NADA** (upsell nem aparece). Se true: cartão "Ativar PDV R$ 49" | Nada, até ativar |
| Add-on ativo | Badge "Ativo" + botão Cancelar | R$ 49/mês somado ao boleto do plano (proporcional na 1ª) |
| VIP (override 0) | Badge "VIP grátis" | R$ 0 |
| `pdv_only` | PDV liberado, sem cartão de add-on | R$ 69/mês do plano |

**Conclusão:** o encanamento está pronto, mas como `addons_module_enabled=false` e toda loja atual é `legacy_pdv=true`, na prática **nenhum lojista real está pagando add-on nem enxergando o cartão hoje**.

## 2. Cancelamento self-service — o que já existe e o que falta

### Já funciona
- Botão **Cancelar** no `StoreAddonsPanel` chama `manage-store-addon` com `action=cancel`.
- Backend agenda `cancels_at = 1º dia do mês seguinte` (mantém acesso até o fim do ciclo pago).
- `useStorePdvAccess` já expõe `cancelsAt` e o badge "Cancela em dd/mm/aaaa" aparece.
- `monthly-billing` não cobra ciclo seguinte porque a próxima execução vê `cancels_at` no passado (precisa confirmar — ver item de correção abaixo).

### O que falta / risco encontrado
1. **`monthly-billing` não filtra `cancels_at`** ao somar add-ons — se a data já passou, ainda pode cobrar. Precisa adicionar `if (sa.cancels_at && new Date(sa.cancels_at) <= now) continue;` e desativar (`enabled=false`) na virada do mês.
2. **Não há "reativar antes do fim do ciclo"** — se o lojista cancelou por engano, hoje só um admin desfaz. Adicionar botão **Reativar** quando `enabled=true && cancels_at!=null`, limpando `cancels_at`.
3. **Confirmação de cancelamento** — hoje é 1 clique. Adicionar `AlertDialog` explicando "acesso vai até dd/mm, sem cobrança no próximo ciclo".
4. **Feature flag ainda false** — nenhum lojista vê nada. Decidir se liga globalmente ou só pra lojas não-legacy.
5. **Histórico** — não há log de quem ativou/cancelou. Aproveitar `admin_logs` para registrar as ações.

## 3. Plano de execução proposto

**Fase 1 — Correções críticas (backend)**
- Ajustar `monthly-billing`: pular add-ons com `cancels_at <= now` e marcar `enabled=false` + `cancels_at=null` na virada.
- Registrar `admin_logs` em cada `activate`/`cancel`/`admin_set`.

**Fase 2 — UX de cancelamento**
- `AlertDialog` de confirmação no `StoreAddonsPanel` antes de cancelar.
- Botão **Reativar** quando há `cancels_at` agendado (nova action `reactivate` na edge function, apenas limpa `cancels_at`).
- Texto mais claro: "Você mantém acesso até dd/mm. Nenhuma cobrança será feita no próximo ciclo."

**Fase 3 — Rollout controlado**
- Ligar `addons_module_enabled=true` apenas para lojas `legacy_pdv=false` (via check adicional no hook `useAddonsFlag`, recebendo `storeId`).
- Manter legacy invisível — elas continuam na regra R$ 1/venda até decidirem migrar.

**Fase 4 — Bump de versão + smoke E2E**
- Playwright: login lojista não-legacy → ativa PDV → cancela → confirma badge → reativa → confirma remoção do badge.
- Bump `appVersion.ts` + `build.gradle` conforme regra de memória.

## Detalhes técnicos
- `manage-store-addon`: adicionar branch `action === "reactivate"` que valida `owner_id`/admin e faz `update store_addons set cancels_at=null where store_id=? and addon_code=? and enabled=true`.
- `monthly-billing` (linhas ~275-295): dentro do loop de `storeAddons`, se `sa.cancels_at && new Date(sa.cancels_at) <= referenceDate`, dar `continue` e enfileirar `update store_addons set enabled=false, cancels_at=null`.
- `useStorePdvAccess`: expor também `canReactivate = enabled && !!cancelsAt`.
- Não mexer em `client.ts`, `types.ts`, `.env` (regras do projeto).

Quer que eu execute todas as 4 fases de uma vez ou prefere aprovar fase por fase?
