# Plano — Cobrança PIX de repasse (piso R$ 150 + cobranças separadas)

## O que muda

### 1. Piso mínimo para gerar PIX: R$ 30 → **R$ 150**
Hoje o cron semanal gera uma cobrança PIX sempre que o saldo pendente atinge R$ 30. Vai passar a só gerar quando o saldo do ciclo for **≥ R$ 150**. Abaixo disso, acumula para a próxima segunda.

### 2. Cobrança por **ciclo**, não por saldo total
Cada rodada semanal gera **uma cobrança PIX independente** com o valor acumulado **naquele ciclo** — não soma com cobranças anteriores em aberto.

Exemplo do usuário:
- Segunda A: saldo pendente do ciclo = **R$ 237** → gera PIX #1 de R$ 237.
- Lojista não paga.
- Segunda B: novo saldo acumulado no ciclo = **R$ 120** → gera PIX #2 **separado** de R$ 120 (não vira R$ 357).
- Painel do lojista mostra as duas cobranças lado a lado, com data de vencimento própria.

Isso evita a confusão de "por que a cobrança mudou de valor?" e mantém rastreabilidade (uma cobrança = um ciclo).

### 3. Regra de bloqueio continua igual
- Total pendente **≥ R$ 500** → loja bloqueada (independentemente de quantas cobranças em aberto).
- Prazo de 30 dias sem quitar → suspensão.

## Alterações técnicas

**Backend (Supabase externo)**
- Edge function do cron semanal (`weekly-repasse-charge` / equivalente): trocar constante `MIN_CHARGE_BRL` de 30 → **150**.
- Ajustar lógica de agregação: passar a somar apenas o delta acumulado **desde a última cobrança emitida** (usar `platform_fee_accruals.charged_at IS NULL` ou coluna equivalente para marcar o que já entrou em cobrança).
- Ao gerar PIX, marcar os accruals daquele lote com o `charge_id` retornado, para o próximo ciclo não pegá-los de novo.

**Frontend (`RepassePendingCharges.tsx` + `RepasseSection.tsx`)**
- Listar **todas** as cobranças em aberto (não só a mais recente), ordenadas por data.
- Total pendente = soma de todas as cobranças abertas + saldo em acúmulo ainda não cobrado.
- Texto informativo: "cobranças abaixo de R$ 150 são acumuladas para a próxima segunda-feira".

**Regras (`src/lib/repasseRules.ts`)**
- Adicionar `MIN_CHARGE_BRL: 150`.
- Ajustar copy do `RepasseAlert` e `PlatformFeeExplainerCard`.

## Fora do escopo
- Não muda regra de comissão do Essencial (mensalidade continua como está).
- Não muda taxa de 0,99 por pedido nem split de entrega.
- Não altera lógica de VIP / lifetime free.

## Versão
Bump para `1.26.14` (`src/lib/appVersion.ts` + `android/app/build.gradle`).

Confirma que posso implementar?
