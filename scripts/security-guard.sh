#!/usr/bin/env bash
# Item 36 — guarda de segurança do CI (auditoria de 40 itens, 23/11/2026).
#
# Falha o CI se o DIFF do PR introduzir um destes padrões:
#   - exec_sql (chamada RPC de SQL cru — ver item 6)
#   - Access-Control-Allow-Origin: "*" (CORS aberto — ver item 9)
#   - verify_jwt = false (edge sem JWT — ver item 9)
#
# Escopo: SOMENTE linhas ADICIONADAS no diff contra a base. A main atual já
# contém esses padrões em vários arquivos; o guard não pode falhar no que
# já existe. Arquivos de documentação (*.md) e este próprio script são
# excluídos da varredura: a doc cita os padrões como texto, e este script
# os contém nas suas expressões de busca.
#
# Uso: bash scripts/security-guard.sh [<base-ref>]
#   base-ref: SHA/ref da base (PR: github.event.pull_request.base.sha;
#   push: github.event.before). Sem argumento, usa origin/main; se a base
#   for inválida ou zerada, usa HEAD~1.
set -euo pipefail

BASE="${1:-origin/main}"
if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ]; then
  BASE="HEAD~1"
fi

# Base precisa existir no clone (o workflow usa fetch-depth: 0).
if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "security-guard: base '$BASE' não encontrada; usando HEAD~1." >&2
  BASE="HEAD~1"
fi

DIFF="$(git diff "$BASE" -- . ':!scripts/security-guard.sh' ':!*.md')"
# Só linhas adicionadas (o cabeçalho '+++ b/arquivo' não conta).
ADDED="$(printf '%s\n' "$DIFF" | grep '^+' | grep -v '^+++' || true)"

FAIL=0
check() { # $1 = nome legível, $2 = regex (grep -E)
  local name="$1" pattern="$2"
  if printf '%s\n' "$ADDED" | grep -Eq "$pattern"; then
    echo "security-guard: BLOQUEADO — padrão proibido introduzido no diff: $name"
    printf '%s\n' "$ADDED" | grep -E "$pattern" | head -20 | sed 's/^/  + /'
    FAIL=1
  fi
}

check "exec_sql" 'exec_sql'
check 'Access-Control-Allow-Origin: "*"' "Access-Control-Allow-Origin[\"']?[[:space:]]*[:,][[:space:]]*[\"']\\*[\"']"
check "verify_jwt = false" 'verify_jwt[[:space:]]*=[[:space:]]*false'

if [ "$FAIL" -ne 0 ]; then
  echo "security-guard: FAIL — remova os padrões acima do diff ou justifique a exceção no corpo do PR."
  exit 1
fi
echo "security-guard: OK — nenhum padrão proibido introduzido no diff."
