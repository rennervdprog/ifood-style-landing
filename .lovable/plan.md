## Objetivo

Adicionar um **bot de menu guiado** (sem IA) na Evolution API, mantendo tudo que já existe hoje (envio de notificações de pedido, respostas automáticas). Lojista escolhe no painel se quer ligar/desligar o bot e configura mensagens/gatilhos.

---

## O que muda para o cliente final

Cliente manda "oi", "cardápio", "pedido" (ou qualquer palavra-chave configurada) no WhatsApp da loja → bot responde com menu interativo → cliente navega por listas/botões nativos do WhatsApp → bot monta pedido → cria no sistema igual a um pedido feito pelo app.

Se cliente digitar qualquer coisa fora do fluxo (ex: "quero falar com atendente"), o bot para e o lojista assume manualmente.

---

## Fluxo do bot (máquina de estados, zero IA)

```text
[gatilho: cliente manda mensagem]
      ↓
"Olá! Bem-vindo à {loja}. O que deseja?"
[Botões: Ver cardápio | Falar com atendente]
      ↓ Ver cardápio
[Lista: categorias do cardápio]
      ↓ escolhe categoria
[Lista: produtos da categoria com preço]
      ↓ escolhe produto
   (se tiver adicionais obrigatórios → Lista de adicionais)
      ↓
[Botões: Adicionar mais itens | Finalizar pedido]
      ↓ Finalizar
[Botões: Delivery | Retirada]
      ↓ Delivery → pede endereço em texto (CEP ou "rua, número, bairro")
      ↓ Retirada → pula endereço
[Botões: Pix | Dinheiro | Cartão na entrega]
      ↓ Pix → gera Pix Direto (usa fluxo já existente)
      ↓
[Resumo do pedido + total]
[Botões: Confirmar | Cancelar]
      ↓ Confirmar → cria pedido no sistema → aparece no painel do lojista
```

Timeout de sessão: **15 minutos sem resposta** → sessão zera, próxima mensagem começa do início.

---

## Painel do lojista — nova aba "Bot WhatsApp"

Dentro de **Admin → Configurações → WhatsApp** (onde já tem Evolution), adicionar seção "Bot de Menu Guiado":

- **Toggle:** Ativar bot automático (on/off)
- **Palavras-gatilho:** campo de tags — padrão: `oi, olá, cardápio, menu, pedido, quero pedir`
- **Mensagem de boas-vindas:** texto customizável com `{loja}` e `{cliente}` como variáveis
- **Horário de funcionamento do bot:** usa `opening_hours` já existente OU horário próprio
- **Fora do horário:** mensagem customizável ("Estamos fechados, abrimos às 18h")
- **Palavra de escape:** cliente digita "atendente" / "humano" → bot para e notifica lojista
- **Método de pagamento aceito no bot:** checkboxes (Pix, Dinheiro, Cartão) — apenas os que a loja aceita
- **Preview:** botão "Testar bot" que simula fluxo no próprio painel

---

## Backend

### Nova tabela `whatsapp_bot_config` (por loja)

```sql
CREATE TABLE public.whatsapp_bot_config (
  store_id uuid PRIMARY KEY,
  enabled boolean DEFAULT false,
  trigger_keywords text[] DEFAULT ARRAY['oi','olá','cardápio','menu','pedido'],
  welcome_message text,
  offline_message text,
  escape_keywords text[] DEFAULT ARRAY['atendente','humano','pessoa'],
  accepted_payment_methods text[] DEFAULT ARRAY['pix','cash','card'],
  use_store_hours boolean DEFAULT true,
  custom_hours jsonb,
  updated_at timestamptz DEFAULT now()
);
```

### Nova tabela `whatsapp_bot_sessions` (estado por cliente/telefone)

```sql
CREATE TABLE public.whatsapp_bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  phone text NOT NULL,
  current_step text NOT NULL, -- 'welcome' | 'category' | 'product' | 'addon' | 'address' | 'payment' | 'confirm'
  cart jsonb DEFAULT '[]'::jsonb,
  context jsonb DEFAULT '{}'::jsonb, -- endereço parcial, categoria escolhida, etc.
  last_message_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '15 minutes',
  UNIQUE(store_id, phone)
);
```

### Nova edge function `evolution-webhook-inbound`

- Recebe webhook `MESSAGES_UPSERT` da Evolution
- Ignora mensagens do próprio bot (`fromMe: true`)
- Carrega `whatsapp_bot_config` da loja pelo `instance_name`
- Se bot desligado ou fora de horário → não faz nada (lojista responde manual)
- Se palavra-escape detectada → deleta sessão + envia "Um atendente já vai te responder"
- Carrega/cria sessão em `whatsapp_bot_sessions`
- Baseado em `current_step`, chama Evolution `/message/sendList` ou `/message/sendButtons` com próxima pergunta
- No passo `confirm`, cria pedido em `orders` + `order_items` (mesmo formato do checkout web) e limpa sessão

### Cron `whatsapp-bot-cleanup` (a cada 5 min)

Deleta sessões expiradas (`expires_at < now()`).

---

## O que NÃO muda (mantido igual)

- `evolution-send-message` (notificações de pedido) — continua igual
- `platform-whatsapp-send` (mensagens da plataforma) — continua igual
- Fluxo de auto-reply existente — continua, mas se bot estiver ligado, ele tem prioridade
- Todo anti-ban, throttling, dedupe já implementados — o bot novo usa a mesma função `evolution-send-message` para enviar, então herda toda proteção

---

## Detalhes técnicos

**Limites da Evolution / WhatsApp:**
- List Messages: até 10 itens por seção → se categoria tiver mais de 10 produtos, paginar ("Ver mais")
- Button Messages: máx 3 botões — usado só em confirmações binárias/ternárias
- Só funciona dentro da janela de 24h após cliente enviar mensagem (não é problema, bot só responde a mensagens recebidas)

**Endereço:** parseamento simples por regex (procura número + palavra "rua/av") — se não bater, pede em partes: "Qual seu CEP?" → "Número?" → "Complemento?" (usa `saved_addresses` se cliente já tem cadastro)

**Cliente sem cadastro:** cria perfil guest usando telefone como identificador (mesmo padrão de `GuestCheckoutPage`)

**Pix Direto no bot:** reusa `pix-direto-create` já existente, envia QR Code como imagem + copia-e-cola

**Arquivos novos:**
- `supabase/functions/evolution-webhook-inbound/index.ts`
- `supabase/functions/whatsapp-bot-cleanup/index.ts`
- `src/pages/admin/tabs/WhatsAppBotConfig.tsx` (nova sub-aba dentro de SettingsTab)
- Migration com as 2 tabelas

**Arquivos alterados:**
- `src/pages/admin/tabs/SettingsTab.tsx` — adicionar seção "Bot Menu Guiado"
- `supabase/config.toml` — registrar cron do cleanup
- `src/lib/appVersion.ts` + `android/app/build.gradle` — bump versão

---

## Fases de entrega

1. **Fase 1 (MVP):** Tabelas + edge function do webhook + fluxo até "Confirmar pedido" só com Pix + painel básico (liga/desliga + palavras-gatilho)
2. **Fase 2:** Adicionais/opcionais de produto, Dinheiro/Cartão, horário customizado
3. **Fase 3:** Templates de mensagem customizáveis, analytics (quantos pedidos vieram do bot), integração com cupons

Confirma esse escopo? Prefere que eu já implemente a Fase 1 completa ou quebra em pedaços menores?