# Plano: Profissionalização da aba WhatsApp

Hoje o `WhatsAppSetup.tsx` (480 linhas) mistura status, guia, QR, toggles, auto-resposta e templates num scroll único. Falta hierarquia visual, feedback em tempo real e o lojista se perde entre "o que precisa fazer agora" vs "configurações avançadas".

## Diagnóstico atual

- Status, QR e configurações empilhados sem prioridade — lojista desconectado vê toggles antes de conectar.
- Templates de mensagem ficam escondidos num accordion, sem preview real do WhatsApp.
- Sem indicador "última mensagem enviada" / "saúde do número" (envios hoje, limite diário, banimento risk).
- Sem teste rápido ("enviar mensagem de teste pro meu número").
- QR Code não atualiza sozinho — precisa clicar em "Verificar conexão".
- Guia passo a passo é texto cru, sem ilustração.

## Fase 1 — Arquitetura em abas internas (Wizard + Settings)

Quebrar a tela em 3 abas dentro da própria aba WhatsApp:

```text
[ Conexão ] [ Notificações ] [ Mensagens ]
```

- **Conexão**: status grande + QR + guia ilustrado + botão "Enviar teste".
- **Notificações**: toggles por etapa + auto-resposta + horários de silêncio (futuro).
- **Mensagens**: editor de templates com preview tipo bolha de WhatsApp ao lado.

Divisão em componentes:
- `WhatsAppSetup.tsx` → orquestrador (carrega config, troca aba).
- `WhatsAppConnection.tsx`
- `WhatsAppNotifications.tsx`
- `WhatsAppTemplates.tsx`
- `WhatsAppHealthCard.tsx` (compartilhado)

## Fase 2 — Card de Status Profissional

Substituir a barrinha atual por um card-hero com:

- Avatar verde do WhatsApp + nome da loja + número conectado mascarado (+55 14 99687-****).
- Pill de status animado (Conectado / Conectando / Desconectado / Número divergente).
- Métricas em linha: "Mensagens hoje: 14 / 50", "Última msg: há 2min", "Conectado há 8 dias".
- Botão primário contextual: muda entre "Gerar QR Code" / "Enviar teste" / "Reconectar".

## Fase 3 — Polling automático do QR + onboarding visual

- Quando QR está visível, fazer polling a cada 3s no status (sem precisar clicar "Verificar").
- Auto-fechar QR e mostrar confete + toast "Conectado!" quando virar `connected`.
- Guia passo a passo com mini-screenshots reais do WhatsApp (4 imagens) em carrossel, não emoji.
- Countdown visual dos 60s de expiração do QR.

## Fase 4 — Editor de Mensagens com Preview

- Lista das 5 mensagens (aceito, pronto, saiu, entregue, cancelado) como cards.
- Ao abrir: split view — esquerda editor com chips clicáveis das variáveis (`{clientName}`, `{pin}`, etc), direita bolha verde estilo WhatsApp renderizando o resultado com dados de exemplo.
- Botão "Restaurar padrão" por mensagem.
- Botão "Enviar pra mim" testando o template no próprio número do lojista.
- Validação: avisa se removeu `{pin}` da mensagem de entrega.

## Fase 5 — Saúde do número (anti-banimento)

Card visual com:
- Barra de progresso "Envios hoje: 14/50".
- Etapa de aquecimento atual ("Semana 2 de 4 — limite 50/dia").
- Histórico simples: últimos 10 envios (status, cliente, hora) lidos de logs.
- Alerta amarelo se taxa de erro > 10% nos últimos envios.

## Detalhes técnicos

- Reusar `store_whatsapp_config` + `message_templates` (sem mudança de schema na fase 1–4).
- Fase 5 precisa de tabela `whatsapp_message_log` (id, store_id, to, template_key, status, sent_at) — adicionar com GRANTs e RLS por `store_id`.
- Polling do QR: `setInterval` 3s com cleanup, parar quando `status === 'connected'` ou componente desmontar.
- Preview da bolha: componente puro renderizando markdown leve do WhatsApp (`*bold*`, quebras de linha).
- Edge function nova: `whatsapp-send-test` — recebe `{ store_id, template_key }`, envia pelo Evolution pro próprio número conectado.
- Mobile: abas viram seletor horizontal com scroll-snap; cards mantêm densidade.
- Manter compatibilidade total com webhook e `orderNotifications.ts` (nenhuma assinatura muda).

## Ordem sugerida de execução

1. Fase 1 (split de arquivos) — base limpa sem mudar UX.
2. Fase 2 (card status) + Fase 3 (polling QR) — ganho visual imediato.
3. Fase 4 (editor com preview) — maior valor pro lojista.
4. Fase 5 (saúde) — depende de log novo.

Posso começar pela Fase 1+2 juntas (mesma PR) ou já mergulhar direto na Fase 4 se preferir o ganho visual primeiro. Qual prefere?
