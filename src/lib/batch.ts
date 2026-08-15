export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("O tamanho do lote deve ser um inteiro positivo.");
  }

  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push([...items.slice(index, index + size)]);
  }
  return batches;
}
