import { checkEventLimit } from '~/lib/matchSelectionLimits';

describe('checkEventLimit', () => {
  it('nunca excede el límite en plan unlimited', () => {
    const result = checkEventLimit({
      capabilities: { events_limit: 'unlimited' },
      currentCount: 1000,
      selectedCount: 50,
    });
    expect(result).toEqual({ exceeds: false, maxEvents: null, remaining: Infinity });
  });

  it('no excede el límite si currentCount + selectedCount es menor que el máximo', () => {
    const result = checkEventLimit({
      capabilities: { events_limit: 3 },
      currentCount: 1,
      selectedCount: 1,
    });
    expect(result.exceeds).toBe(false);
    expect(result.maxEvents).toBe(3);
    expect(result.remaining).toBe(2);
  });

  it('no excede el límite justo en el borde (currentCount + selectedCount === maxEvents)', () => {
    const result = checkEventLimit({
      capabilities: { events_limit: 3 },
      currentCount: 2,
      selectedCount: 1,
    });
    expect(result.exceeds).toBe(false);
  });

  it('excede el límite si currentCount + selectedCount supera el máximo', () => {
    const result = checkEventLimit({
      capabilities: { events_limit: 3 },
      currentCount: 2,
      selectedCount: 2,
    });
    expect(result.exceeds).toBe(true);
    expect(result.maxEvents).toBe(3);
    expect(result.remaining).toBe(1);
  });

  it('remaining nunca es negativo aunque currentCount ya supere el máximo', () => {
    const result = checkEventLimit({
      capabilities: { events_limit: 3 },
      currentCount: 10,
      selectedCount: 1,
    });
    expect(result.exceeds).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
