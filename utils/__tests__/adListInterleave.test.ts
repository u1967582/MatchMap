import { interleaveWithAds } from '~/utils/adListInterleave';

describe('interleaveWithAds', () => {
  const getKey = (item: { id: string }) => item.id;

  it('devuelve [] si la lista está vacía', () => {
    expect(interleaveWithAds([], getKey)).toEqual([]);
  });

  it('inserta un anuncio al final si hay menos elementos que el intervalo', () => {
    const items = [{ id: 'a' }, { id: 'b' }];

    const result = interleaveWithAds(items, getKey, 3);

    expect(result).toEqual([
      { kind: 'item', key: 'a', data: { id: 'a' } },
      { kind: 'item', key: 'b', data: { id: 'b' } },
      { kind: 'ad', key: 'ad-end' },
    ]);
  });

  it('inserta un anuncio cada `interval` elementos exactos, sin anuncio final extra', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = interleaveWithAds(items, getKey, 3);

    expect(result).toEqual([
      { kind: 'item', key: 'a', data: { id: 'a' } },
      { kind: 'item', key: 'b', data: { id: 'b' } },
      { kind: 'item', key: 'c', data: { id: 'c' } },
      { kind: 'ad', key: 'ad-3' },
    ]);
  });

  it('inserta varios anuncios intercalados para listas más largas que el intervalo', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }, { id: 'g' }];

    const result = interleaveWithAds(items, getKey, 3);

    const adRows = result.filter((row) => row.kind === 'ad');
    expect(adRows.map((row) => row.key)).toEqual(['ad-3', 'ad-6']);
    expect(result).toHaveLength(items.length + adRows.length);
  });

  it('usa 3 como intervalo por defecto', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = interleaveWithAds(items, getKey);

    expect(result[result.length - 1]).toEqual({ kind: 'ad', key: 'ad-3' });
  });

  it('no genera claves de anuncio duplicadas', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `item-${i}` }));

    const result = interleaveWithAds(items, getKey, 4);
    const adKeys = result.filter((row) => row.kind === 'ad').map((row) => row.key);

    expect(new Set(adKeys).size).toBe(adKeys.length);
  });
});
