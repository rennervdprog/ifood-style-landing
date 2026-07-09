## Objetivo
Transformar o **PDV** em módulo pago separado (R$ 49,00/mês) para lojas **novas**, sem quebrar nada nas lojas atuais. **WhatsApp Automático continua gratuito** pra todo mundo (fora do escopo de módulo pago).

---

## Regras de negócio

### Lojas novas (criadas após a data de corte da migration)
- PDV vem **desativado** por padrão.
- Botão/aba do PDV vira **upsell** ("Ative o PDV — R$ 49/mês").
- Contratação libera imediatamente; cobrança proporcional na primeira fatura.

### Lojas antigas (grandfathered — todas existentes na data da migration)
- Recebem flag `legacy_pdv = true` na migration.
- Mantêm o comportamento atual: PDV liberado com regra de **R$ 1/pedido**.
- Não veem tela de contratação nem upsell.

### Super Admin (VIP)
- Pode forçar `enabled = true` com `price_override = 0` (PDV grátis pra loja específica).
- Pode ativar/desativar/alterar preço por loja a qualquer momento.

### Plano Autonomia
- Segue regra padrão: se for loja nova, PDV é add-on pago.

---

## Alterações técnicas

### 1. Banco (migration no Supabase externo `qkjhguziuchqsbxzruea`)
- Nova tabela `plan_addons` (catálogo global): `id, code ('pdv'), name, monthly_price, is_active`.
  - Seed: `('pdv', 'PDV', 49.00, true)`.
- Nova tabela `store_addons` (contratações por loja): `store_id, addon_code, enabled, price_override, activated_at, cancels_at, created_by`.
- Coluna nova em `stores`: `legacy_pdv boolean default false`.
- Migration inicial: `UPDATE stores SET legacy_pdv = true WHERE created_at < now()`.
- Nova entrada em `admin_settings`: `addons_module_enabled = false` (feature flag).
- GRANTs + RLS: leitura pelo dono da loja; escrita só via edge function com service role.

### 2. Helper central
- `src/lib/storeAddons.ts` (novo): `hasPdvAccess(storeId)` retorna `{ enabled, source: 'legacy' | 'addon' | 'vip' | 'none', pricePerOrder }`.
- Hook `useStoreAddons(storeId)` com React Query.

### 3. Edge functions
- `manage-store-addon` (nova, service role): ativa/cancela add-on, calcula proporcional, grava em `store_addons`.
- `monthly-billing`: soma add-ons ativos na fatura mensal do Asaas (linha separada "PDV — R$ 49,00").
- PDV atual (`pdv-*`): adicionar guard `hasPdvAccess()` — se `none`, retorna 403.

### 4. Frontend
- `src/pages/PdvPage.tsx` + entrada no menu admin: se `hasPdvAccess().enabled === false`, mostrar tela de upsell com CTA "Ativar PDV — R$ 49/mês".
- Aba **Meu Plano** (`StoreSubscription.tsx`): nova seção "Módulos" listando add-ons contratados, preço, botão cancelar. Lojas legacy veem badge "PDV incluso (condição antiga)".
- **Super Admin → AdminPlanManager**: nova aba/seção "Add-ons" com toggle enabled + campo `price_override` + badge "Legacy" nas lojas antigas.
- **Landing `StoreDirectory.tsx`**: adicionar bloco/menção do PDV como módulo opcional R$ 49/mês na seção de planos (junto ao CTA "Seja um lojista"). Atualizar copy pra deixar claro que PDV é add-on, não incluso no plano base.
- **`PlansComparisonTable.tsx`**: adicionar linha "PDV (módulo opcional)" mostrando "+ R$ 49/mês" em todas as colunas, com nota de rodapé explicando que lojas antigas mantêm R$ 1/pedido.
- **`PlanosPage.tsx`**: card separado "Módulos adicionais" abaixo dos planos, destacando PDV R$ 49/mês.

### 5. Termos e privacidade
- Adicionar cláusula curta em `TermosDeUso.tsx` sobre módulos opcionais e cobrança proporcional.

### 6. Feature flag
- Toda a UI de contratação/upsell lê `addons_module_enabled`. Enquanto `false`, nada aparece pro lojista nem na landing (permite deploy silencioso e ativação depois).

### 7. Versão
- Incrementar patch em `src/lib/appVersion.ts` e `android/app/build.gradle` (versionName + versionCode) ao final.

---

## Fluxos-chave

- **Ativação:** lojista clica "Ativar PDV" → `manage-store-addon` grava `enabled=true`, `activated_at=now()`, calcula proporcional (R$ 49 × dias_restantes/dias_do_mês) → adiciona à próxima fatura Asaas → libera PDV imediatamente.
- **Cancelamento:** lojista clica "Cancelar" → `cancels_at = fim do ciclo atual` → PDV segue ativo até o fim do mês pago → não renova.
- **VIP:** super admin define `price_override = 0` → cobrança zera, PDV continua ativo.
- **Legacy:** `legacy_pdv = true` → `hasPdvAccess` retorna `{ enabled: true, source: 'legacy', pricePerOrder: 1 }` → PDV funciona igual hoje, sem cobrança mensal.

---

## Fora de escopo
- WhatsApp Automático (continua gratuito — nenhuma alteração).
- Plano base (Essencial/Crescimento/Comissão/Apoiador/Autonomia) — inalterado.
- Comissão de pedidos delivery.
- Regra R$ 1/pedido das lojas legacy.
- Migração do Evolution API.

---

## Verificação
- Loja nova de teste: PDV bloqueado até contratar; após ativar, libera e aparece na fatura.
- Loja legacy: PDV funciona igual hoje, sem upsell, sem cobrança mensal extra.
- VIP com `price_override = 0`: PDV ativo, fatura sem linha PDV.
- Feature flag `false`: nada aparece pro lojista nem na landing (`StoreDirectory`, `PlanosPage`).
- Landing `StoreDirectory` mostra o módulo PDV corretamente quando flag `true`.
