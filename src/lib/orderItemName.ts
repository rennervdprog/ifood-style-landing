/**
 * Detects multi-flavor pizza orders from addons and returns proper display name.
 * Multi-flavor items have addons prefixed with a fraction symbol: "½ ", "⅓ " or "¼ ".
 */
const FRACTION_PREFIXES = ["½ ", "⅓ ", "¼ "];

export function getOrderItemDisplayName(
  item: { products?: { name: string } | null; addons?: any[] | any | null }
): string {
  let raw = item.addons;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = []; }
  }
  const addons = Array.isArray(raw) ? raw : [];

  for (const prefix of FRACTION_PREFIXES) {
    const matches = addons.filter(
      (a: any) => typeof a?.name === "string" && a.name.startsWith(prefix)
    );
    if (matches.length >= 2 && matches.length <= 4) {
      const names = matches.map((a: any) => a.name.slice(prefix.length));
      const title = matches.length === 2 ? "Pizza Meio a Meio" : `Pizza ${matches.length} Sabores`;
      return `${title}: ${names.join(" / ")}`;
    }
  }

  return item.products?.name || "Item";
}
