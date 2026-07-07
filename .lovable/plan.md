## Diagnóstico (causa raiz confirmada)

Rodei o preflight CORS real que o navegador envia:

```
OPTIONS /functions/v1/evolution-qr-code
Access-Control-Request-Headers: authorization, content-type, apikey, x-client-info, sentry-trace, baggage
```

Resposta do servidor:
```
access-control-allow-headers: authorization, x-client-info, apikey, content-type
```

Faltam `sentry-trace` e `baggage` na allow-list. Como o Sentry (que está ativo no app) injeta esses headers em toda chamada `supabase.functions.invoke(...)`, **o navegador bloqueia a requisição antes de sair** — resultando exatamente no erro do console:

```
TypeError: Failed to fetch (qkjhguziuchqsbxzruea.supabase.co)
FunctionsFetchError: Failed to send a request to the Edge Function
```

Por isso o toast mostra "Erro ao gerar QR Code. Verifique a configuração do servidor." sem detalhe (não é FunctionsHttpError, é FunctionsFetchError = preflight barrado).

O QR que aparece na tela e dá "não foi possível conectar esse dispositivo" é o QR **antigo** persistido em `store_whatsapp_config.qr_code` de tentativas anteriores — já expirou (QR do WhatsApp vive ~60s). Como o "Recarregar" está quebrado pelo CORS, nunca chega um QR novo. Confirmei via `whatsapp-diag` que o Evolution na Hostinger está **saudável** e devolve `base64+code` normalmente.

## Correções (2 arquivos + limpeza do QR travado)

### 1) `supabase/functions/evolution-qr-code/index.ts`
Trocar o objeto `corsHeaders` local por:
```
"Access-Control-Allow-Headers":
  "authorization, x-client-info, apikey, content-type, sentry-trace, baggage"
```
e garantir que TODAS as respostas (inclusive erros 401/403/404/500) incluam esses headers (já fazem via `json(...)`).

### 2) `supabase/functions/evolution-keepalive/index.ts`
Mesma correção — o network log já mostra este endpoint também com "Failed to fetch" pelo mesmo motivo.

### 3) Varredura preventiva das demais functions do WhatsApp/Evolution
Fazer o mesmo ajuste em `whatsapp-diag`, `evolution-webhook`, `evolution-send-message` (qualquer uma chamada pelo navegador do lojista). Server-to-server (webhook do Evolution) não precisa, mas o custo é zero.

### 4) Redeploy no backend externo
Rodar `node scripts/deploy-external.mjs evolution-qr-code evolution-keepalive whatsapp-diag evolution-send-message` para publicar no projeto `qkjhguziuchqsbxzruea`.

### 5) Limpar o QR travado da Pastelão Carioca
`UPDATE store_whatsapp_config SET qr_code=NULL, status='disconnected' WHERE store_id='b97f3a1a-d558-41e5-b8a2-ebd65b5381b4'` no banco externo — força a UI a esconder o QR expirado até o próximo clique gerar um novo.

### 6) Verificação pós-deploy
- `curl -X OPTIONS ... -H "Access-Control-Request-Headers: sentry-trace,baggage"` → deve listar os dois headers em `access-control-allow-headers`.
- Pedir para o lojista clicar em "Recarregar QR Code" e escanear em <60s.
- Confirmar via `whatsapp-diag` que `connectionStatus` vira `open`.

## Bump de versão
`1.11.83` → `1.11.84` em `src/lib/appVersion.ts`, `src/pages/PerfilPage.tsx` e `android/app/build.gradle` (versionCode 837 → 838).

## Segurança
Nenhum impacto: adicionar `sentry-trace` e `baggage` só permite que headers de tracing passem no preflight — não altera autenticação (continua exigindo Bearer JWT) nem RLS. Nenhuma nova superfície de ataque.

## Escopo NÃO incluído
- Não vou mexer no fluxo do Evolution (VPS Hostinger está OK conforme diag).
- Não vou refatorar o polling do QR (funciona depois da correção CORS).
