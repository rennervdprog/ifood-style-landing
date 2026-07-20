"""
Smoke E2E Pizzaria — verifica que o atalho "Monte a Pizza" no PDV é ativado
para lojas com store_type='pizzeria' (não só category='pizzas'), e que os
módulos-chave estão presentes.
"""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[2].parent

required = [
    "src/components/PizzaHalfHalfModal.tsx",
    "src/pages/PdvPage.tsx",
    "src/types/pizza.ts",
]
missing = [p for p in required if not (ROOT / p).exists()]
if missing:
    print("FALTAM:", missing); sys.exit(1)

src = (ROOT / "src/pages/PdvPage.tsx").read_text()
# isPizzaria precisa cobrir tanto categoria antiga quanto store_type novo
m = re.search(r"const isPizzaria =([^;]+);", src)
if not m:
    print("isPizzaria não encontrado"); sys.exit(1)
expr = m.group(1)
assert 'category === "pizzas"' in expr, "faltou fallback de category"
assert 'store_type === "pizzeria"' in expr, "faltou store_type pizzeria"
assert "pizzaHalfEnabled = isPizzaria" in src, "shortcut meia-a-meia não ligado"
print("OK — Pizzaria: shortcut meia-a-meia ativa para store_type=pizzeria")
