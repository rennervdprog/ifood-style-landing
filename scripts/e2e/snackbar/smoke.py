"""
Smoke E2E do fluxo Lanches (snack_bar) — valida o split de impressão via testes unitários
de thermalPrint (o único caminho reproduzível offline) e verifica que os arquivos-chave
da Fase 1 existem no repositório.
"""
import subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2].parent

required = [
    "src/pages/pdv/snackbar/SnackBarCombosBar.tsx",
    "src/pages/pdv/snackbar/SnackBarComboBuilderDialog.tsx",
    "src/pages/pdv/snackbar/SnackBarCombosManager.tsx",
    "src/lib/thermalPrint.ts",
]
missing = [p for p in required if not (ROOT / p).exists()]
if missing:
    print("FALTAM:", missing); sys.exit(1)
print("OK — arquivos Fase 1 presentes")

r = subprocess.run(
    ["bunx", "vitest", "run", "src/lib/__tests__/thermalPrint.test.ts"],
    cwd=ROOT, capture_output=True, text=True,
)
print(r.stdout[-2000:]); print(r.stderr[-500:])
sys.exit(r.returncode)