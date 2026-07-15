# Regra nova: upgrade obrigatório após atingir o limite

Hoje: se o lojista recusa o upgrade, a loja continua grátis pra sempre.
Nova regra (Essencial e Autonomia): ao bater o GMV do plano (R$ 5.000 / R$ 2.500 em 60 dias), a mensalidade passa a ser devida. Recusar o upgrade **inativa a loja** até o lojista aceitar. Não existe mais "voltar ao grátis" depois de cruzar o limite.

## 1. Termos de Uso (`src/pages/TermosDeUso.tsx`)

Reescrever a cláusula 6.2 (upgrade dinâmico) deixando explícito:
- Grátis apenas até R$ 5.000 (Essencial) / R$ 2.500 (Autonomia) em 60 dias.
- Ao atingir, mensalidade fica devida com 30 dias de aviso prévio.
- Aceitar → cobrança gerada no vencimento.
- Recusar → **loja é suspensa (inativada) até o aceite**. Não existe reversão ao plano gratuito.
- O status "gratuito" é uma janela inicial de adesão, não um plano permanente.

Bump de versão do documento + registro em `legal_document_changes`.

## 2. Lógica no backend externo

### 2a. RPC `respond_essencial_upgrade` (função existente)
Quando `_response = 'refused'`:
- Gravar `essencial_upgrade_response = 'refused'` + `essencial_upgrade_response_at = now()` (mantém).
- **Novo:** `UPDATE public.stores SET status = 'inativo' WHERE id = _store_id`.
- Logar `action = 'store_suspended_upgrade_refused'` em `admin_logs`.

### 2b. RPC `respond_essencial_upgrade` — caminho `accepted`
- Ativar a mensalidade imediatamente: `monthly_fee = 180` (fixed) ou `239.90` (autonomy).
- Se a loja estava inativada por recusa anterior, reativar: `stores.status = 'ativo'`.
- Limpar `essencial_upgrade_response` pra permitir o fluxo normal de cobrança.

### 2c. Cron `check-essencial-upgrade`
- Remover o `skipped: user_refused_upgrade` que hoje ignora a loja pra sempre.
- Se `response = 'refused'` e `stores.status = 'ativo'` (ex.: admin reativou manualmente), reaplicar suspensão.
- Se `response = null` e prazo (`essencial_upgrade_scheduled_at`) vencido sem resposta: tratar como recusa implícita → suspender.

### 2d. Enforcement no front do lojista
- Guard já existente de `stores.status !== 'ativo'` cobre bloqueio do admin/cardápio; garantir que a tela mostre um card claro:
  > "Sua loja está suspensa. Você ultrapassou R$ 5.000 em vendas e precisa aceitar o plano Essencial (R$ 180/mês) para reativar."
- Botão "Aceitar e reativar" chamando a mesma RPC com `accepted`.

## 3. Componente `EssencialProgressCard.tsx`
- Reescrever o estado "refused": em vez de "Nenhuma cobrança será feita", mostrar aviso vermelho "Loja suspensa — aceite para reativar" + botão "Aceitar upgrade".
- Estado "scheduled" ganha texto: "Ao recusar, a loja será suspensa até você aceitar."

## 4. Migração de dados existentes
- Nenhuma loja hoje está com `response = 'refused'` de verdade (só o teste do Duda lanches). Não precisa migração destrutiva.
- Reset do teste do Duda incluído na oneshot de cleanup.

## Detalhes técnicos

Uma migration única no externo (via `oneshot-*` como já fazemos) contendo:
1. `CREATE OR REPLACE FUNCTION respond_essencial_upgrade` com a nova lógica (suspende / reativa / ativa mensalidade).
2. Ajuste no `check-essencial-upgrade` (edge function) removendo o short-circuit de `refused`.
3. Frontend: `EssencialProgressCard.tsx` + copy nos Termos.

Depois: bump de versão (patch), redeploy das functions afetadas.
