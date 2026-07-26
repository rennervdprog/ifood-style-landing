
# Desativar bloqueio de "conta acessada em outro dispositivo"

Hoje o sistema tem `user_active_devices` com **UNIQUE (user_id)**, e ao logar em outro aparelho o `register_device_login` sobrescreve o device — o app antigo, ao chamar `check_device_active`, recebe `false` e é deslogado com o toast "Sua conta foi acessada em outro dispositivo".

No cliente o `evaluateDeviceTracking` já retorna `false` (o polling não roda), mas o toast/logout ainda dispara em outros pontos e a estrutura continua ativa no banco. Vamos remover de vez.

## Mudanças

### 1. `src/contexts/AuthContext.tsx`
- Remover `registerDevice`, `checkDeviceStillActive`, `startDeviceCheck`, `stopDeviceCheck`, `evaluateDeviceTracking`, `deviceCheckRef`, `shouldTrackDeviceRef`, `DEVICE_CHECK_INTERVAL`.
- Remover chamadas em `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED` e no `visibilitychange`.
- Remover import de `getDeviceId` se ninguém mais usar aqui.
- Nunca mais mostrar o toast "Sua conta foi acessada em outro dispositivo".

### 2. Migration no Supabase externo
- Trocar `register_device_login` por um no-op que só retorna `{registered:true}` (mantém a assinatura pra não quebrar clientes antigos com APK velho).
- Trocar `check_device_active` por função que sempre retorna `true` (APKs antigos param de deslogar sozinhos).
- Remover constraint `UNIQUE (user_id)` de `user_active_devices` (permite N linhas por usuário) — ou simplesmente parar de inserir. Preferência: dropar a UNIQUE pra não estourar erro em quem ainda chama a RPC antiga.
- Opcional: `TRUNCATE public.user_active_devices` pra limpar registros órfãos.

### 3. Sem mudança de versão do banco de tokens/refresh
- Não mexer em `authStorage`, `refreshSession`, JWT expiry — só o "kick out" está sendo removido. A sessão continua persistindo normalmente.

## Resultado
- Cliente, lojista, motoboy, admin: podem estar logados em **quantos aparelhos quiserem simultaneamente**.
- APKs antigos (que ainda chamam `check_device_active`) recebem `true` e não deslogam mais.
- Nenhum toast de "outro dispositivo".

## Fora de escopo
- Não vou remover a tabela `user_active_devices` (fica intacta, só sem constraint) pra evitar quebrar migrations futuras que a referenciem.
- Auditoria de segurança: multi-sessão simultânea é padrão do Supabase; risco = se um refresh token vazar, todas as sessões continuam válidas. Se quiser reforço extra depois, dá pra adicionar biometria/PIN local por dispositivo (fase 2).

Bumps: `1.26.18` em `PerfilPage.tsx` + `versionName/versionCode` no `build.gradle`.
