export type AdListRow<T> =
  | { kind: 'item'; key: string; data: T }
  | { kind: 'ad'; key: string };

/**
 * Inserta una fila de anuncio cada `interval` elementos. Si la lista tiene
 * menos elementos que `interval` (no llega a completar ni un grupo), añade
 * una única fila de anuncio al final en su lugar.
 */
export function interleaveWithAds<T>(
  items: T[],
  getKey: (item: T) => string,
  interval: number = 3
): AdListRow<T>[] {
  const rows: AdListRow<T>[] = [];

  items.forEach((item, index) => {
    rows.push({ kind: 'item', key: getKey(item), data: item });
    const position = index + 1;
    if (position % interval === 0) {
      rows.push({ kind: 'ad', key: `ad-${position}` });
    }
  });

  if (items.length > 0 && items.length < interval) {
    rows.push({ kind: 'ad', key: 'ad-end' });
  }

  return rows;
}
