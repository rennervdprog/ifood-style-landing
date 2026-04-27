# Project Memory

## Core
**Banco principal = Supabase EXTERNO ref `qkjhguziuchqsbxzruea`**. Lovable Cloud foi DESCONTINUADO neste projeto — não usar para dados de negócio. Todo cadastro/lojista/pedido vive no banco externo via secrets `EXTERNAL_SUPABASE_URL` e `EXTERNAL_SUPABASE_SERVICE_KEY`. Para debugar dados, sempre consultar o banco externo (não o Cloud).

A cada alteração de código, incrementar automaticamente o patch da versão em DOIS lugares (manter sincronizados):
1. `src/pages/PerfilPage.tsx` — texto "ItaSuper vX.Y.Z"
2. `android/app/build.gradle` — `versionName "X.Y.Z"` E também incrementar `versionCode` (inteiro +1) para evitar precisar desinstalar/reinstalar o APK no celular.
Sempre informar ao usuário a nova versão após a mudança.

A cada alteração de código, também revisar oportunidades de otimização para manter o app fluido: lazy-loading de rotas/componentes pesados, memoização (useMemo/useCallback/React.memo) onde houver re-render real, queries Supabase enxutas (select específico, limit, índices), imagens otimizadas (webp/lazy), e remover código/imports não usados. Aplicar só quando fizer diferença real e mencionar brevemente ao usuário.

## Memories
- [Banco externo principal](mem://external-database) — Ref `qkjhguziuchqsbxzruea`, secrets EXTERNAL_SUPABASE_URL/SERVICE_KEY, regras de uso vs Lovable Cloud descontinuado
