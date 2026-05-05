# Project Memory

## Core
A cada alteração de código, incrementar automaticamente o patch da versão em DOIS lugares (manter sincronizados):
1. `src/pages/PerfilPage.tsx` — texto "ItaSuper vX.Y.Z"
2. `android/app/build.gradle` — `versionName "X.Y.Z"` E também incrementar `versionCode` (inteiro +1) para evitar precisar desinstalar/reinstalar o APK no celular.
Sempre informar ao usuário a nova versão após a mudança.

A cada alteração de código, também revisar oportunidades de otimização para manter o app fluido: lazy-loading de rotas/componentes pesados, memoização (useMemo/useCallback/React.memo) onde houver re-render real, queries Supabase enxutas (select específico, limit, índices), imagens otimizadas (webp/lazy), e remover código/imports não usados. Aplicar só quando fizer diferença real e mencionar brevemente ao usuário.

NUNCA usar Fast Visual Edit. Sempre usar o motor completo de IA com raciocínio profundo, mesmo em mudanças aparentemente simples de UI.

Ao falar com o usuário, referir-se ao backend como "Supabase" (ou "banco/backend"). NUNCA usar o termo "Lovable Cloud".

## Memories
- [Sem Fast Visual Edit](mem://preferences/no-fast-visual-edit.md) — Preferência: nunca usar edições visuais rápidas
- [Nomenclatura do backend](mem://preferences/backend-naming.md) — Chamar backend de Supabase, não Lovable Cloud
