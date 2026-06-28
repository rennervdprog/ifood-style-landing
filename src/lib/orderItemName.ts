/**
 * Multi-flavor (meio a meio) detection helpers for pizza / pastel / etc.
 * Multi-flavor items carry addons whose names start with a fraction prefix:
 * "½ ", "⅓ " or "¼ ".
 */
const FRACTION_PREFIXES = ["½ ", "⅓ ", "¼ "];

type ItemLike = { products?: { name: string } | null; addons?: any[] | any | null };

function parseAddons(item: ItemLike): any[] {
  let raw = item.addons;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  return Array.isArray(raw) ? raw : [];
}

function detectFractionMatches(addons: any[]): { prefix: string; matches: any[] } | null {
  for (const prefix of FRACTION_PREFIXES) {
    const matches = addons.filter(
      (a: any) => typeof a?.name === "string" && a.name.startsWith(prefix),
    );
    if (matches.length >= 2 && matches.length <= 4) return { prefix, matches };
  }
  return null;
}

/** Detecta o "tipo" do produto multi-sabor (Pizza, Pastel, etc.). */
function detectKind(item: ItemLike, addons: any[]): string {
  const haystacks = [
    item.products?.name || "",
    ...addons.map((a) => (typeof a?.name === "string" ? a.name : "")),
  ].join(" ").toLowerCase();
  if (haystacks.includes("pastel")) return "Pastel";
  if (haystacks.includes("esfiha")) return "Esfiha";
  if (haystacks.includes("calzone")) return "Calzone";
  return "Pizza";
}

/**
 * Retorna apenas o título (ex.: "Pastel Meio a Meio", "Pizza 3 Sabores").
 * Os sabores em si devem ser renderizados separadamente via `getOrderItemFlavors`
 * para ficar legível na térmica.
 */
export function getOrderItemDisplayName(item: ItemLike): string {
  const addons = parseAddons(item);
  const detected = detectFractionMatches(addons);
  if (!detected) return item.products?.name || "Item";

  const kind = detectKind(item, addons);
  const n = detected.matches.length;
  return n === 2 ? `${kind} Meio a Meio` : `${kind} ${n} Sabores`;
}

/**
 * Quando o item for multi-sabor, retorna a lista de sabores com a fração
 * (ex.: ["½ Carne", "½ Cheddar"]). Caso contrário, lista vazia.
 */
export function getOrderItemFlavors(item: ItemLike): string[] {
  const addons = parseAddons(item);
  const detected = detectFractionMatches(addons);
  if (!detected) return [];
  return detected.matches.map((a: any) => {
    const clean = String(a.name).slice(detected.prefix.length).replace(/^pastel\s*-\s*/i, "").replace(/^pizza\s*-\s*/i, "").trim();
    return `${detected.prefix.trim()} ${clean}`;
  });
}

/** Conjunto de nomes de addons que são frações (para suprimir da lista de opcionais). */
export function getFractionAddonNames(item: ItemLike): Set<string> {
  const addons = parseAddons(item);
  const detected = detectFractionMatches(addons);
  if (!detected) return new Set();
  return new Set(detected.matches.map((a: any) => String(a.name)));
}
