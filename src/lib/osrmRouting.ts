/**
 * OSRM routing helper (Fase 1 do plano de rota otimizada).
 *
 * Usa o servidor público gratuito `router.project-osrm.org` para calcular
 * distâncias e tempos reais por ruas (não em linha reta). Retorna uma matriz
 * que pode ser usada por algoritmos TSP locais (2-opt) para reordenar as
 * paradas.
 *
 * Limites do servidor público:
 *  - Sem chave de API, sem custos.
 *  - ~25 pontos por requisição /table.
 *  - Rate limit "fair use" — usamos cache em sessionStorage para reduzir
 *    chamadas repetidas.
 *
 * Se a requisição falhar (sem internet, rate limit, etc.) o caller deve
 * cair de volta para o cálculo Haversine local — nada quebra.
 */

export type Coord = [number, number]; // [lat, lng]

const OSRM_BASE = "https://router.project-osrm.org";
const CACHE_PREFIX = "osrm_matrix_v1:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h

interface CachedMatrix {
  durations: number[][];
  distances: number[][];
  ts: number;
}

function cacheKey(coords: Coord[]): string {
  // Arredonda para 5 casas (~1.1m) para aumentar hit-rate
  const k = coords.map(([la, ln]) => `${la.toFixed(5)},${ln.toFixed(5)}`).join(";");
  return `${CACHE_PREFIX}${k}`;
}

function readCache(key: string): CachedMatrix | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMatrix;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, m: Omit<CachedMatrix, "ts">) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...m, ts: Date.now() }));
  } catch {
    // sessionStorage cheio — ignora
  }
}

/**
 * Busca a matriz de durações (s) e distâncias (m) entre todas as paradas.
 * `coords[0]` é tipicamente o ponto de partida (loja).
 */
export async function fetchOsrmMatrix(coords: Coord[]): Promise<{ durations: number[][]; distances: number[][] } | null> {
  if (coords.length < 2 || coords.length > 25) return null;

  const key = cacheKey(coords);
  const cached = readCache(key);
  if (cached) return { durations: cached.durations, distances: cached.distances };

  // OSRM espera lng,lat (não lat,lng)
  const points = coords.map(([la, ln]) => `${ln},${la}`).join(";");
  const url = `${OSRM_BASE}/table/v1/driving/${points}?annotations=duration,distance`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.code !== "Ok" || !data?.durations) return null;
    const durations: number[][] = data.durations;
    const distances: number[][] = data.distances;
    writeCache(key, { durations, distances });
    return { durations, distances };
  } catch {
    return null;
  }
}

/**
 * 2-opt baseado em matriz de durações (ou distâncias). Otimiza uma
 * sequência que começa SEMPRE no índice 0 (a loja). Retorna a nova ordem
 * dos índices `1..n-1`.
 */
function twoOptOnMatrix(matrix: number[][], startIdx = 0): number[] {
  const n = matrix.length;
  if (n <= 3) return Array.from({ length: n - 1 }, (_, i) => i + 1);

  // Nearest-neighbor inicial
  const order: number[] = [];
  const remaining = new Set<number>();
  for (let i = 0; i < n; i++) if (i !== startIdx) remaining.add(i);
  let cur = startIdx;
  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;
    remaining.forEach((idx) => {
      const d = matrix[cur][idx];
      if (d < bestDist) { bestDist = d; bestIdx = idx; }
    });
    order.push(bestIdx);
    remaining.delete(bestIdx);
    cur = bestIdx;
  }

  // 2-opt
  const pathCost = (path: number[]) => {
    let total = matrix[startIdx][path[0]];
    for (let i = 0; i < path.length - 1; i++) total += matrix[path[i]][path[i + 1]];
    return total;
  };

  let improved = true;
  let iters = 0;
  while (improved && iters < 80) {
    improved = false;
    iters++;
    const baseCost = pathCost(order);
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const next = [...order];
        const seg = next.slice(i, j + 1).reverse();
        next.splice(i, j - i + 1, ...seg);
        if (pathCost(next) < baseCost - 0.5) {
          for (let k = 0; k < next.length; k++) order[k] = next[k];
          improved = true;
        }
      }
    }
  }

  return order;
}

export interface OsrmOptimizeResult {
  /** Nova ordem (excluindo a loja de partida no índice 0). */
  order: number[];
  /** Distância total da rota em km (sem voltar à loja). */
  totalKm: number;
  /** Duração total em minutos. */
  totalMin: number;
}

/**
 * Otimiza uma rota com até 24 paradas a partir de uma loja.
 * Retorna `null` se OSRM falhar — chame o fallback haversine nesse caso.
 */
export async function optimizeRouteOsrm(store: Coord, stops: Coord[]): Promise<OsrmOptimizeResult | null> {
  if (stops.length === 0) return { order: [], totalKm: 0, totalMin: 0 };
  if (stops.length === 1) return { order: [0], totalKm: 0, totalMin: 0 };

  const coords = [store, ...stops];
  const matrix = await fetchOsrmMatrix(coords);
  if (!matrix) return null;

  const order = twoOptOnMatrix(matrix.durations, 0);

  // Calcula totais a partir da matriz de distâncias
  let totalM = matrix.distances[0][order[0]];
  let totalS = matrix.durations[0][order[0]];
  for (let i = 0; i < order.length - 1; i++) {
    totalM += matrix.distances[order[i]][order[i + 1]];
    totalS += matrix.durations[order[i]][order[i + 1]];
  }

  // Subtrai 1 porque os índices retornados são da matriz completa (com loja em 0)
  return {
    order: order.map((idx) => idx - 1),
    totalKm: totalM / 1000,
    totalMin: totalS / 60,
  };
}
