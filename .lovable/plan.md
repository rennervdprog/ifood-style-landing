# Plano: "Comissão só após GMV" explícito em toda a jornada do revendedor

## Objetivo
Nenhum revendedor deve descobrir depois que a mensalidade só cai quando a loja passa do GMV gratuito. Essa regra tem que aparecer em toda tela onde ele vê ganhos, indicações ou material de divulgação.

## Fonte da verdade (única)
Criar `src/lib/resellerEarnings.ts` exportando:
- `FREE_GMV = { essencial: 5000, autonomia: 2500 }` (R$)
- `BOUNTY_CENTS = 5000` (R$ 50 após 20 pedidos)
- `RECURRING_RATE = 0.20`
- Helpers: `formatFreeGmvLine()`, `getReferralEarningStage(store)` → `"pre_bounty" | "bounty_paid_free_tier" | "earning_recurring"`

Todos os textos e badges consomem daqui — zero string solta.

## Telas a atualizar

**1. Landing `/seja-revendedor`**
Card "Como você ganha" ganha 3 passos numerados explícitos:
1. Bounty de R$ 50 após as 20 primeiras vendas da loja
2. **Loja em fase gratuita → R$ 0 de recorrente** (Essencial até R$ 5k GMV / Autonomia até R$ 2,5k)
3. Loja passou do GMV → 20% da mensalidade, todo mês

Adicionar FAQ: "Quando começo a receber a mensalidade?"

**2. Cadastro `/reseller-auth`**
Checkbox de termos com linha explícita:
> "Entendi que a comissão recorrente de 20% só é paga a partir do mês em que a loja indicada passa do GMV gratuito e começa a pagar mensalidade."

**3. Dashboard do revendedor (`ResellerHome` / bento)**
- Card "Saldo pendente" com tooltip (ícone info): "Só entra saldo quando a loja indicada passa do GMV gratuito."
- Novo mini-card "Aguardando ativação": conta lojas com `referral_status='active'` mas ainda em fase gratuita.

**4. Lista de indicações (`ResellerIndicacoes`)**
Cada card de loja mostra badge de estágio (do `getReferralEarningStage`):
- 🟡 "Pré-bounty — X/20 pedidos"
- 🔵 "Bounty pago · fase gratuita (faltam R$ Y de GMV)"
- 🟢 "Gerando recorrente · R$ Z/mês"

Barra de progresso do GMV até o teto gratuito quando estágio = fase gratuita.

**5. Tela de link/QR de divulgação**
Abaixo do link, linha fixa em cinza:
> "Você recebe 20% da mensalidade a partir do mês em que a loja passar de R$ 5.000 (Essencial) ou R$ 2.500 (Autonomia) em vendas."

**6. Perfil do revendedor (`ResellerPerfil`)**
Seção "Como funciona meu ganho" com os 3 estágios + link pros termos.

**7. Materiais/copy prontos pra compartilhar**
Se houver aba de "Materiais", incluir versão curta pronta pra WhatsApp já com a regra dentro do texto (não em asterisco).

## Backend (dashboard RPC)
`reseller_get_dashboard` já retorna `gmv_60d_cents` e `plan_type` por loja — adicionar no retorno:
- `free_gmv_cents` (do template do plano)
- `earning_stage` calculado no SQL
Assim o front não recalcula regra de negócio.

## Fora de escopo
- Mudar valores/regra de comissão
- Redesign visual completo (só adicionar os elementos explicativos nos layouts existentes)

## Detalhes técnicos
- Arquivo novo: `src/lib/resellerEarnings.ts`
- Editar: `SejaRevendedor.tsx`, `ResellerAuth.tsx`, `revendedor/ResellerHome.tsx`, `revendedor/ResellerIndicacoes.tsx`, `revendedor/ResellerPerfil.tsx`, `useResellerDashboard.ts`
- Edge function oneshot para atualizar `reseller_get_dashboard` retornando `earning_stage` + `free_gmv_cents`
- Bump v1.25.48 + versionCode 10011
