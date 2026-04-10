/**
 * Detects half-half pizza orders from addons and returns proper display name.
 * Half-half items have addons like "½ Sabor1" and "½ Sabor2".
 */
export function getOrderItemDisplayName(
  item: { products?: { name: string } | null; addons?: any[] | any | null }
): string {
  const addons = Array.isArray(item.addons) ? item.addons : [];
  const halfAddons = addons.filter((a: any) => typeof a?.name === "string" && a.name.startsWith("½ "));

  if (halfAddons.length === 2) {
    const name1 = halfAddons[0].name.replace("½ ", "");
    const name2 = halfAddons[1].name.replace("½ ", "");
    return `Pizza Meio a Meio: ${name1} / ${name2}`;
  }

  return item.products?.name || "Item";
}
