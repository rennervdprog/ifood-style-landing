# Plano — WhatsApp Plataforma 100% Profissional

Objetivo: transformar a aba **WhatsApp Plataforma** (Super Admin) num painel real de operação, com histórico de envios (mensalidades, repasses, avisos), métricas e controles funcionando de verdade — não só um botão de conectar.

## 1. Reorganização visual da aba (UI)

Layout em 4 sub-abas dentro de "WhatsApp Plataforma":

```text
[ Conexão ] [ Histórico ] [ Templates ] [ Configurações ]
```

- **Conexão**: card grande com status (conectado/desconectado), número, última atividade, botões QR / Conectar por número / Sincronizar / Desconectar. Já existe — só reorganizar num card único.
- **Histórico**: nova aba — tabela de todos os envios (ver seção 2).
- **Templates**: editor dos textos usados nos disparos automáticos (mensalidade, repasse, boas-vindas, atraso).
- **Configurações**: número de suporte, avisos ativos, limites diários, janela de envio (horário comercial), coffee break.

## 2. Histórico de envios (o pedido central)

Fonte: tabela `platform_whatsapp_send_log` que já existe no Supabase externo.

Adicionar na UI:
- Tabela paginada com filtros: **categoria** (mensalidade / repasse / boas-vindas / atraso / manual), **status** (enviado / falhou / bloqueado por limite), **loja**, **período**.
- Colunas: data/hora, loja, telefone (mascarado), categoria, preview da mensagem, status, botão "reenviar".
- Cards de métrica no topo: enviados hoje / semana / mês, taxa de sucesso, próximo horário liberado (respeitando anti-ban).
- Exportar CSV.

Ajustes no backend:
- Garantir que `billing-reminders`, `subscribe-plan-payment` (cobrança gerada), `repasse-*` e qualquer envio manual gravem sempre em `platform_whatsapp_send_log` com `category` preenchido.
- RPC `list_platform_wa_log(filters, page)` com paginação server-side.

## 3. Disparos automáticos ligados de verdade

- **Mensalidade gerada** → template "Nova cobrança R$ X — vence em DD/MM, link: …".
- **Mensalidade vencendo (D-2, D0, D+1, D+3, D+7)** → já existe cron `billing-reminders`; revisar textos e cadência, e forçar log.
- **Repasse liberado** (semanal) → template "Seu repasse de R$ X foi transferido para sua conta Asaas".
- **Repasse pendente** (sexta) → aviso do valor previsto.
- **Essencial atingiu 80% dos R$ 5k** → aviso preventivo de upgrade.
- **WhatsApp da loja desconectou** → aviso ao lojista pelo WhatsApp da plataforma.

Cada evento vira uma função pequena que chama `platform-whatsapp-send` com `category` e `template_key`.

## 4. Templates editáveis

Nova tabela `platform_whatsapp_templates(key, title, body, variables[], active)` no Supabase externo. Editor simples na aba Templates com preview e placeholders (`{{loja}}`, `{{valor}}`, `{{vencimento}}`, `{{link}}`).
`platform-whatsapp-send` passa a resolver template pelo `key` em vez de string hardcoded.

## 5. Envio manual / broadcast controlado

- Campo "enviar para uma loja" (busca por nome) com preview do template.
- Broadcast segmentado: "todas as lojas do plano Essencial", "todas com mensalidade em atraso", etc. — sempre respeitando os limites anti-ban (log-normal delay + limite diário) já implementados em `platform-whatsapp-send`.

## 6. Saúde e anti-ban visíveis

Card "Saúde do chip" com: idade do chip, mensagens hoje / limite, próximo horário permitido, últimos erros da Evolution. Botão "pausar disparos 1h / 24h" (flag em `platform_whatsapp_config`).

## 7. Entregáveis técnicos (resumo)

- Frontend: refatorar `PlatformWhatsAppTab.tsx` em 4 sub-abas + novos componentes `WhatsAppHistoryTable`, `WhatsAppTemplatesEditor`, `WhatsAppHealthCard`, `WhatsAppManualSend`.
- Backend externo:
  - Tabela `platform_whatsapp_templates` + seed dos templates atuais.
  - RPC `list_platform_wa_log` e `wa_stats_summary`.
  - Ajustar `platform-whatsapp-send` para ler template por `key` e sempre gravar `category`.
  - Garantir logs em todos os call sites (billing, repasse, alerts).
- Cron novo: `repasse-reminders` (sexta) se ainda não existir.

## 8. Ordem de execução sugerida

1. Sub-abas + card de conexão reorganizado (baixo risco).
2. Tabela `platform_whatsapp_templates` + editor + refactor do `send` para usar templates.
3. RPC de histórico + aba Histórico com filtros e métricas.
4. Envio manual + broadcast segmentado.
5. Card de saúde do chip + pausar disparos.
6. Novos eventos automáticos (repasse liberado, essencial 80%, wa da loja caiu).

Cada etapa incrementa versão e é testável isoladamente.
