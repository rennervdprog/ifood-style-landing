# Migração de Cobranças de Plataforma para Woovi/OpenPix

**Data da implementação:** 14 de agosto de 2026

**Autor:** Manus AI

**Escopo:** mensalidades e cobranças de taxas acumuladas da plataforma ao lojista. Este escopo **não** inclui transferências da plataforma para lojistas ou entregadores.

## Modelo financeiro confirmado

O repasse semanal representa uma **cobrança da plataforma ao lojista**. A cobrança consolida taxas de entrega e, conforme o plano, comissões físicas e valores pendentes do PDV. A plataforma gera um PIX; o saldo somente é baixado após confirmação assíncrona do pagamento pela Woovi.

| Etapa | Implementação após a migração |
|---|---|
| Emissão de mensalidade recorrente | `monthly-billing` cria cobrança PIX Woovi |
| Assinatura inicial de plano | `subscribe-plan-payment` cria cobrança PIX Woovi |
| Taxa semanal acumulada | `auto-charge-physical-fees` cria cobrança PIX Woovi |
| Comissão emitida manualmente | `generate-commission-charge` cria cobrança PIX Woovi |
| Alertas e pagamentos centralizados | `payment-router` exige gateway `WOOVI` |
| Liquidação | `woovi-webhook` localiza a transação por `correlationID` ou identificador e confirma a baixa de forma idempotente |

A Woovi documenta a criação de cobrança com `POST /api/v1/charge`, usando `correlationID` como referência de conciliação e valores em centavos. A integração usa o identificador da cobrança e o código PIX retornados pelo provedor.[1]

## Proteções implementadas

A rotina semanal agora grava uma referência `#REP-...` em `financial_transactions` e envia exatamente essa referência no `correlationID` da Woovi. O webhook encontra a transação por essa referência e só então atualiza o saldo pendente. Essa correção elimina a divergência anterior, em que o identificador do provedor era usado como referência local.

A mensalidade mantém reserva atômica de tentativa. O parâmetro `force` pode superar o filtro de vencimento em chamada administrativa, mas não supera a reserva concorrente. O modo `dry_run` foi reforçado para não registrar transações, não consumir crédito, não desativar add-ons e não alterar `last_billing_attempt_at`.

| Proteção | Resultado |
|---|---|
| Fallback automático para Asaas/AbacatePay nos caminhos migrados | Removido dos caminhos de emissão novos |
| Chamada financeira sem credencial | Bloqueada com HTTP 401 |
| Webhook recebido fora de ordem | Evento de expiração não rebaixa transação já paga |
| Conciliação da taxa semanal | Referência Woovi e identificador do provedor são persistidos separadamente |
| Publicação | Seis funções compiladas e foram publicadas em produção |

## Validações realizadas

Foram publicadas com estado `ACTIVE` as funções `monthly-billing`, `auto-charge-physical-fees`, `subscribe-plan-payment`, `generate-commission-charge`, `payment-router` e `woovi-webhook`. A publicação do provedor valida a compilação no runtime das funções.

Foram realizadas chamadas negativas de autorização às rotinas `monthly-billing` e `auto-charge-physical-fees`; ambas retornaram HTTP 401 sem credencial. O build de produção do frontend foi concluído com sucesso. Uma consulta somente leitura após a publicação não encontrou transações criadas durante a implantação.

> Nenhum PIX, cobrança, transferência ou baixa financeira foi disparado manualmente durante a migração.

## Pendência controlada de homologação

A prova de ponta a ponta com uma cobrança Woovi real não foi executada, porque ela criaria um PIX de produção. A primeira execução automática deve ser acompanhada para confirmar: aceitação do segredo do cron, criação do PIX Woovi, recepção do webhook assinado e baixa idempotente do saldo.

O código agora aceita `CRON_SECRET` e, para compatibilidade com os agendamentos existentes, `EXTERNAL_CRON_SECRET`. Isso corrige a divergência identificada entre o segredo usado pelo agendamento e o segredo aceito pelas funções. A ativação ou disparo manual do cron não foi feito nesta implementação.

## Resíduos legados

Algumas funções e integrações Asaas permanecem implantadas apenas para suporte histórico e não fazem parte das novas rotas de emissão migradas. Elas devem ser desativadas somente após confirmar que não há cobranças pendentes, webhooks em trânsito ou interfaces ainda vinculadas a elas.

## Referências

[1]: https://developers.woovi.com/en/api "Woovi API Reference — Charge API e autenticação por AppID"
