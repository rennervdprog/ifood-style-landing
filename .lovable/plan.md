# Plano WhatsApp ItaSuper — bot como "placa", não atendente

## Princípio
O WhatsApp do lojista é a porta de entrada; o cardápio é o destino. O bot só precisa **converter mensagem em clique**. Quanto menos ele fala, mais o chip dura.

---

## Fase 1 — Parar o sangramento (P0, esta semana)

**Backend (`evolution-send-message` + Supabase externo)**

1. **Fix warm-up**: `Math.max(80, dailyLimitForAge)` → `Math.min` para `auto_reply` respeitar 20/50/100 por fase.
2. **Lock anti-duplicata da saudação**: unique index parcial em `whatsapp_send_log(store_id, phone, kind)` para janela de 60s + `INSERT … ON CONFLICT DO NOTHING` antes de disparar. Fim das 6 msgs em 8s.
3. **Self-heal do status**: quando Evolution retorna 200, `UPDATE store_whatsapp_config SET status='connected'`.
4. **Coffee break também no `auto_reply`**: pausa 5-15min a cada 10 envios (hoje só `manual`).
5. **Dedupe da saudação: 1h → 24h** (`dedupeWindowSec` em `auto_reply`).

**Índices SQL (Supabase externo `qkjhguziuchqsbxzruea`)**
- `whatsapp_send_log(store_id, phone, sent_at desc)`
- unique parcial `(store_id, phone, kind)` where `sent_at > now() - interval '60s'`

---

## Fase 2 — Uma saudação, sempre a mesma (P1)

**Backend (`evolution-webhook` / handler de auto-reply)**

1. **Uma mensagem única e imutável** por cliente por dia:
   > "Olá! 👋 Cardápio, preços e status da *{storeName}* aqui: {link}\n\n{status_horario}\n\n_Responda PARAR para não receber._"
2. **Zero intent detection.** Remove regex de "cardápio/oi/sim/quero". Qualquer inbound = mesma resposta (1x/24h).
3. **Silêncio após o link.** Se já enviou saudação nas últimas 24h para aquele número, o bot **não responde nada** — nem `menu`, nem "posso ajudar". Corta o loop bot↔cliente.
4. **Skip primeiro contato**: número sem histórico só recebe saudação na **2ª msg em 10min**. Curioso/engano/spam nem gera envio.
5. **Confirmação de pedido substitui saudação**: se o número tem pedido ativo no dia, marca `greeted_today=true` e pula qualquer auto-reply — cliente só recebe transacional.
6. **Opt-out global**: qualquer msg contendo "parar/sair/pare/remover" grava `opt_out=true` em `whatsapp_send_log` (nova coluna ou tabela `whatsapp_optouts`); consulta obrigatória antes de qualquer `auto_reply`.

**Templates transacionais (`templates.ts`)**
- Manter os 5 templates atuais (preparando, pronto, saiu, entregue, cancelado).
- Adicionar **rodapé opt-out** só na primeira msg de um pedido: "_Responda PARAR para não receber._"

---

## Fase 3 — UI do painel WhatsApp (mesma janela)

**`WhatsAppNotifications.tsx` — reescrever a seção "Resposta automática"**
- Trocar copy atual (que promete "5 saudações rotativas + link após 2s") por:
  > "Quando um cliente manda mensagem, o bot envia **uma vez por dia** uma saudação com o link do seu cardápio e o status (aberto/fechado). Se o cliente insistir, o bot fica em silêncio — o atendimento fica com você."
- Remover a caixa "Modo anti-bloqueio ativo" mentirosa (o modo passa a ser o padrão real).
- Adicionar bullets curtos: "1 saudação por cliente / 24h · Silêncio após o link · Respeita PARAR · Pula clientes com pedido do dia".

**Novo card "Saúde do chip" (topo da aba Conexão)**
- Dias conectado, envios hoje / limite da fase (20 semana 1 · 50 semana 2 · 100 semana 3-4 · 150 mês 2 · 200 mês 3+).
- Barra de progresso: verde <70% · amarelo 70-90% · vermelho >90%.
- Última desconexão + botão "Reconectar (novo QR)" quando `status != connected`.
- Taxa de opt-out (últimos 30 dias).

**`WhatsAppTemplates.tsx`** — sem mudança estrutural, só ajustar a copy do banner azul topo para reforçar que **templates só são enviados em eventos de pedido**, nunca em resposta a msg do cliente.

**Nova aba (opcional, futuro) "Histórico"** — placeholder por enquanto, alimentada quando `whatsapp_messages` for populada.

---

## Fase 4 — Observabilidade (paralelo à Fase 2)

- Popular `whatsapp_messages` (in + out) no `evolution-webhook` e no `evolution-send-message`.
- Coluna `skip_reason` em `whatsapp_send_log` com valores: `dedupe_24h`, `first_contact`, `opt_out`, `daily_limit`, `has_active_order`, `outside_hours`. Lojista entende por que uma msg não saiu.

---

## Fase 5 — Escala (só quando precisar, P3)

- Rotação de instância por loja quando volume real > 150/dia consistente.
- **Cloud API oficial** como upgrade pago (BSP: Z-API Cloud, Take Blip, Gupshup). Migração do número existente exige deslogar do WhatsApp app + verificação CNPJ + downtime de horas — só oferecer para lojas que realmente precisam.

---

## O que NÃO vamos fazer
- IA gerando resposta livre para cada msg do cliente.
- Broadcast/promoção pelo Baileys.
- Menu "digite 1 para…" no auto-reply.
- Múltiplas saudações rotativas fingindo ser humano (não engana e queima chip).

---

## Volume esperado (Cantinho da Silvia)
- Hoje: 72 msgs/dia, 97% saudação → trajetória de ban em 2-4 semanas.
- Com o plano: ~30-50 msgs/dia (1 saudação por número único + 2-3 transacionais por pedido real) → chip vive meses.

---

## Ordem de deploy
1. **Deploy 1 (esta semana)**: Fase 1 completa (backend + índices).
2. **Deploy 2 (3-5 dias depois, após ver métricas)**: Fase 2 (uma-msg + silêncio) + Fase 3 (UI do painel) + Fase 4 (observabilidade).
3. **Fase 5**: sob demanda, loja a loja.

---

## Detalhes técnicos
- Todas as mudanças de dados em **Supabase externo `qkjhguziuchqsbxzruea`** (não Lovable Cloud).
- Migração via `scripts/*.sql` executada pelo caminho já usado no projeto.
- Edge functions afetadas: `evolution-send-message`, `evolution-webhook`, `zapi-webhook` (paridade).
- Nenhuma mudança em `orderNotifications.ts` (transacional continua igual).
- Bump de versão do app conforme regra do projeto ao final do Deploy 2 (Perfil + `build.gradle`).

---

## Segurança (checagem obrigatória ao final)
- Confirmar que `whatsapp_send_log` e `whatsapp_messages` continuam com RLS restrito ao `store_id` do lojista + service role.
- Rodar `security--run_security_scan` após o Deploy 2.
