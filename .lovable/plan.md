# Plano: Taxa da plataforma R$ 2,00 → R$ 0,99

Reduzir a taxa fixa que a plataforma soma na entrega dos planos **Essencial**, **Apoiador** e **Comissão** de R$ 2,00 para **R$ 0,99**. Autonomia continua sem acréscimo (zero). Aplicável a **pedidos novos**; lojas com saldo pendente acumulado a R$ 2,00 mantêm o valor histórico até quitação.

## Escopo da mudança

### 1. Fonte de verdade (banco)
- `admin_settings.delivery_fee_config.platform_split`: `2` → `0.99`

### 2. Código (fallbacks e defaults)
- `src/lib/deliveryFee.ts` — fallback `?? 2.0` → `?? 0.99`
- `src/lib/plansInfo.ts` — 4 ocorrências `deliveryFee: 2` → `0.99` (fixed, apoiador, comissão, hybrid)
- `supabase/functions/confirm-order-payment/index.ts` — `let platformSplit = 2` → `0.99`

### 3. Textos de UI
- `src/pages/Index.tsx` — 3 menções (card Essencial, card Autonomia, FAQ)
- `src/pages/StoreDirectory.tsx` — 6 menções (comparativo, FAQ, seção "R$2 a mais", card de preço R$ 2,00)
- `src/pages/CadastroLojista.tsx` — 2 menções (`+R$2`, texto explicativo)
- `src/lib/plansInfo.ts` — string `"Sem taxa de R$2 da plataforma"` + descrição longa

### 4. Termos de Uso (`src/pages/TermosDeUso.tsx`)
- Cláusula planos Essencial, Autonomia, Apoiador, Comissão (4 linhas)
- Cláusula 8.2 (métodos físicos, gatilho de R$ 30 continua igual)
- Cláusula 9.4 (taxa de entrega)
- Adicionar nota de versão: "Vigência a partir de {data}. Pedidos e saldos anteriores permanecem em R$ 2,00 até quitação."

### 5. Edge functions e admin
- `supabase/functions/auto-charge-physical-fees/index.ts` — descrição da cobrança e comentários
- `src/pages/super-admin/tabs/HistoricoRepassesTab.tsx` — label `R$2/entrega` → `R$0,99/entrega`
- `src/pages/super-admin/tabs/AReceberTab.tsx` — mesma label

### 6. Versão e comunicação
- Bump `PerfilPage.tsx` + `android/app/build.gradle` (versionName + versionCode)
- Nota curta no changelog do super-admin (opcional)

## Fora de escopo
- Não alterar `store_balances.repasse_pendente` já acumulado (respeita valor histórico do pedido)
- Não alterar taxa PIX Online (R$ 1,99) nem taxa PDV (R$ 1,00)
- Não alterar Autonomia (continua zero)
- Não alterar gatilhos de upgrade (R$ 5.000 Essencial / R$ 2.500 Autonomia) nem mensalidades

## Ordem de execução
1. Migração `admin_settings` (update do JSON)
2. Batch de edições de código + textos (parallel)
3. Bump de versão
4. Verificação: build + preview do landing e termos
