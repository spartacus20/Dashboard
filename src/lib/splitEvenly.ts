// Reparte `items` en `parts` grupos de tamaño lo más parejo posible, preservando el
// orden original. Cuando no divide exacto, los primeros grupos reciben el elemento extra.
// Extraído de BatchCallingTab para reutilizarlo en campañas programadas multi-parte.
export function splitEvenly<T>(items: T[], parts: number): T[][] {
  if (parts <= 1) return [items];
  const result: T[][] = [];
  const base = Math.floor(items.length / parts);
  let remainder = items.length % parts;
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const size = base + (remainder > 0 ? 1 : 0);
    result.push(items.slice(start, start + size));
    start += size;
    if (remainder > 0) remainder--;
  }
  return result;
}
