-- Mensagem apagada no WhatsApp continua salva (recurso em TESTE, 29/10/2026)
--
-- Pedido do Renner: o lojista quer saber se o atendente apaga mensagens.
-- O conteúdo já fica gravado em whatsapp_inbound_log na chegada (in/out) e
-- apagar no WhatsApp NÃO apaga do registro. O que faltava:
--   1. guardar o ID da mensagem do WhatsApp (key.id) em cada registro —
--      sem ele não dá pra saber QUAL mensagem foi apagada;
--   2. marcar deleted_at quando chega o evento de "apagar para todos"
--      (protocolMessage REVOKE), sem remover o texto;
--   3. a tela de conversas exibe o selo "Apagada" ao lado da mensagem.
--
-- Esta migration é SÓ ADITIVA: duas colunas nullable + um índice.
-- Nenhuma linha existente é alterada; mensagens antigas (sem wa_message_id)
-- simplesmente nunca casam com um revoke — comportamento esperado.
-- O webhook de produção (evolution-webhook) NÃO foi alterado por este
-- passo: quem escreve as colunas novas é a cópia de teste
-- evolution-webhook-teste, até a publicação ser autorizada à parte.

ALTER TABLE public.whatsapp_inbound_log
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_inbound_log_store_wa_message_idx
  ON public.whatsapp_inbound_log (store_id, wa_message_id);
