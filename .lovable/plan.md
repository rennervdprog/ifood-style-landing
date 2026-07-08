# Plano: Auditar Super Admin, mapear função real de cada aba e corrigir divergências

Antes de sair corrigindo texto por texto, precisamos primeiro **entender e documentar o que cada aba realmente faz** — porque hoje há sub-abas com propósitos parecidos mostrando números diferentes, e sem esse mapa qualquer "correção" vira remendo.

O plano tem 3 fases: **Mapear → Padronizar → Corrigir**.

---

## Fase 1 — Mapa funcional do Super Admin (entregável: 1 documento)

Objetivo: para cada aba e sub-aba do painel Super Admin, responder em 1 linha:
- **O que ela faz** (propósito real de negócio)
- **De onde lê os dados** (tabela/RPC/edge function)
- **Quem é o "dono" da informação** (fonte da verdade)
- **Sobreposição** com outras abas (se existir)

Abas a mapear (baseado no que já vimos no código):

```text
Super Admin
├── Dashboard / Visão Geral
├── Lojas (AdminPlanManager + card de loja)
├── Planos
│   ├── Lojas
│   ├── Templates
│   └── A Receber
├── Financeiro
│   ├── Visão Geral
│   ├── A Receber
│   ├── Histórico Repasses
│   ├── Pagamentos/Split
│   └── Saques
├── Cidades
├── Jurídico
├── Auditoria
├── Debug Loja
└── Sync External
```

Saída dessa fase: arquivo `docs/super-admin-map.md` com uma tabela do tipo:

| Aba | Sub-aba | Função | Fonte de dados | Sobreposição |
|-----|---------|--------|----------------|--------------|
| Planos | A Receber | Mensalidade a cobrar do mês | `store_plans` (fixed+supporter) | ⚠️ igual à "Financeiro > A Receber"? |
| Financeiro | A Receber | Repasses de comissão/entrega pendentes | `orders.repasse_pendente` | ⚠️ ver acima |
| ... | ... | ... | ... | ... |

Só depois desse mapa a gente decide: **fundir**, **renomear** ou **manter separado com escopo claro**.

---

## Fase 2 — Regras de padronização (entregável: constantes + memória)

Com o mapa em mãos, fixar as regras que hoje divergem:

1. **Nomenclatura única de planos** (uma fonte só):
   - `fixed` → "Essencial"
   - `supporter` → "Apoiador"
   - `autonomy` → "Autonomia"
   - `commission_only` → "Só Comissão"
   - `hybrid` → "Híbrido"
   Centralizar em `src/lib/plansInfo.ts` (já existe) e remover strings soltas ("Fixo Mensal", "Comissão", etc.) dos componentes.

2. **Regra de exibição VIP** (uma só, para todo card/lista):
   - Sempre mostrar o **valor real** (mesmo quando é `R$ 0` ou `0%`).
   - Quando `isVip = true`, adicionar badge "VIP" ao lado do valor.
   - Nunca esconder linha por ser zero.

3. **Regra de filtro de listas vs KPI**:
   - KPI e lista **precisam usar o mesmo filtro**. Se KPI conta 4 lojas pagantes, a lista mostra as 4 (mesmo que uma esteja com valor 0 por VIP).
   - Documentar o filtro em um helper único (`isPagante(store)`).

4. **Fonte única para VIP**: `useStorePlan` já expõe `isVip` + `vipDiffs`. Toda tela do Super Admin passa a consumir daqui (não recalcular localmente).

---

## Fase 3 — Correções pontuais (baseadas nas divergências já vistas)

Só depois do mapa e das regras, aplicar:

1. **Card de loja (AdminPlanManager)** — nunca esconder linha de taxa quando VIP zerou; mostrar `R$ 0,00` + badge VIP.
2. **Badge "Fixo Mensal"** — trocar por nome real do plano (`plansInfo.label`) + valor real (mesmo se 0).
3. **KPI "Visão Geral" do Financeiro** — alinhar filtro com a lista abaixo (mesma função `isPagante`).
4. **Textos de plano** — remover variantes ("Comissão" vs "Só Comissão", "Fixo" vs "Essencial") e usar `plansInfo.label` em todo canto.
5. **Sub-abas duplicadas** (definido pelo mapa): fundir ou renomear com escopo claro no título (ex: "A Receber (Mensalidade)" vs "A Receber (Repasse de Pedidos)").

Bump de versão: `1.11.95` → `1.11.96` em `src/lib/appVersion.ts`, `src/pages/PerfilPage.tsx` e `android/app/build.gradle` (versionCode +1).

---

## Detalhes técnicos

**Arquivos que serão lidos na Fase 1** (só leitura, gera o `.md`):
- `src/pages/SuperAdminDashboardV2.tsx`
- `src/pages/admin/tabs/*` e `src/pages/super-admin/tabs/*`
- `src/components/AdminPlanManager.tsx`, `PlanosTab.tsx`, `FinanceCenter.tsx`
- `src/components/AdminFixedPlanReceivables.tsx`

**Fase 2 e 3** editam código; Fase 1 é só documentação.

## Fora do escopo
- Não mexer em edge functions (já validadas na auditoria anterior).
- Não mudar schema do banco.
- Não redesenhar layout — só corrigir textos, valores e agrupamento de abas.

---

**Confirma que eu começo pela Fase 1 (mapa em `docs/super-admin-map.md`) antes de qualquer código?**
