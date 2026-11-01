// Favoritos de lojas — persistência LOCAL (mesma lógica do app KMP,
// FavoriteStoresRepository: guarda só os ids no aparelho, sem conta).
const KEY = "itasuper-favorite-stores";

export function loadFavoriteStores(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteStore(storeId: string): string[] {
  const current = loadFavoriteStores();
  const next = current.includes(storeId)
    ? current.filter((id) => id !== storeId)
    : [...current, storeId];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sem storage disponível (modo privado etc.): o favorito vale só na sessão.
  }
  return next;
}
