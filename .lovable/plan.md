# Correção: Realtime WhatsApp + número correto conectado

## Problemas confirmados

1. **Realtime não replica na tela**
   - As tabelas `store_whatsapp_config` e `platform_whatsapp_config` provavelmente **não estão na publicação `supabase_realtime`** e/ou não têm `REPLICA IDENTITY FULL`.
   - Sem isso, `postgres_changes` (que `WhatsAppSetup.tsx` já assina) nunca dispara — a UI só atualiza no polling de 3s ou ao reabrir a aba.
   - Sintoma: aparece "Conectado" só depois de mexer na tela / recarregar.

2. **Número errado no card "Conectado"**
   - O webhook (`evolution-webhook`) grava `phone_number = data.wuid || data.number || data.owner`.
   - No fluxo de **pairing code** o Evolution devolve o número **digitado**, não o real que pareou. E em `connection.update` o `wuid` chega vazio ou desatualizado quando trocamos de chip.
   - `store-whatsapp-sync-status` já busca o `ownerJid` real via `/instance/fetchInstances` — mas isso só roda quando o usuário abre a aba. O webhook (que dispara em tempo real) não faz esse fetch.

## Correções

### 1. Habilitar Realtime nas tabelas de config (migration)

```sql
ALTER TABLE public.store_whatsapp_config REPLICA IDENTITY FULL;
ALTER TABLE public.platform_whatsapp_config REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_whatsapp_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_whatsapp_config;
```
(idempotente — checa antes se já existe)

### 2. Webhook busca o número real via fetchInstances

Em `supabase/functions/evolution-webhook/index.ts`, quando `state === 'open'`:
- Chamar `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=<inst>` com `apikey`.
- Extrair `ownerJid` (fallbacks: `instance.owner`, `owner`) e usar como `phone_number` — não confiar em `data.wuid`.
- Se o número diferir do salvo (`phoneChanged`) → resetar `connected_at = now()` e limpar `qr_code`.
- Aplicar a mesma lógica no bloco de `platform_whatsapp_config` (linhas 152-179).

### 3. Front — cobrir gap de rede/aba oculta

Em `src/components/WhatsAppSetup.tsx`:
- Ao voltar a aba (`visibilitychange = 'visible'`) → chamar `store-whatsapp-sync-status` + `loadConfig`.
- Ao reconectar o socket do realtime (`SUBSCRIBED` após `CHANNEL_ERROR`) → forçar `loadConfig` uma vez para pegar o que foi perdido offline.

Mesmo tratamento em `PlatformWhatsAppTab.tsx` (super admin) usando `platform-whatsapp-sync-status`.

### 4. UI já pronta

`WhatsAppStatusCard` e `WhatsAppConnection` já mostram `phone_number` e `connected_at` do `config` — assim que o realtime disparar com dados corretos, a tela atualiza sozinha. Nada a mexer em UI.

## Detalhes técnicos

- **Migration** roda via `supabase--migration` (aprovação do usuário).
- **Edge function** re-deploy: `evolution-webhook`.
- Fetch dentro do webhook tem timeout de 4s (`AbortController`) para não segurar resposta do Evolution.
- Bump de versão para `1.14.14` (build 949) em `src/lib/appVersion.ts` + `android/app/build.gradle`.
- Log breve `[evolution-webhook] ownerJid resolved` para auditoria futura.

## Como validar

1. Desconectar o WhatsApp no celular → card muda para "Desconectado" em < 2s sem recarregar.
2. Reconectar com **outro** número via pairing code → aparece o número **real** que pareou (não o digitado) e "há 0m".
3. `admin_logs` recebe eventos `connection_update_ownerjid` com o JID resolvido.
