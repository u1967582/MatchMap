import {
  computeBoostWindow,
  computeEndAt,
  getActionForEvent,
  getBoostBarIdAttribute,
  getPlanFromProductId,
  getTransactionId,
  isSupabaseUserId,
} from '../../supabase/functions/revenuecat-webhook/logic';

const BAR_ID = '3f2b6c1e-8a4d-4b5e-9c7f-1a2b3c4d5e6f';

describe('revenuecat-webhook logic - getActionForEvent', () => {
  it('activa el boost con NON_RENEWING_PURCHASE (compras sin renovación)', () => {
    expect(getActionForEvent('NON_RENEWING_PURCHASE')).toBe('activate');
  });

  it('activa también con INITIAL_PURCHASE y RENEWAL', () => {
    expect(getActionForEvent('INITIAL_PURCHASE')).toBe('activate');
    expect(getActionForEvent('RENEWAL')).toBe('activate');
  });

  it('expira con EXPIRATION y cancela con CANCELLATION o REFUND', () => {
    expect(getActionForEvent('EXPIRATION')).toBe('expire');
    expect(getActionForEvent('CANCELLATION')).toBe('cancel');
    expect(getActionForEvent('REFUND')).toBe('cancel');
  });

  it('ignora eventos no relacionados (TEST, BILLING_ISSUE...)', () => {
    expect(getActionForEvent('TEST')).toBe('ignore');
    expect(getActionForEvent('BILLING_ISSUE')).toBe('ignore');
  });
});

describe('revenuecat-webhook logic - getPlanFromProductId', () => {
  it('mapea los productos v2 y futuros sufijos', () => {
    expect(getPlanFromProductId('boost_7d_v2')).toBe('7d');
    expect(getPlanFromProductId('boost_1m_v2')).toBe('1m');
    expect(getPlanFromProductId('boost_1y_v3')).toBe('1y');
  });

  it('devuelve null para productos desconocidos o vacíos', () => {
    expect(getPlanFromProductId('lifetime')).toBeNull();
    expect(getPlanFromProductId(null)).toBeNull();
  });
});

describe('revenuecat-webhook logic - getTransactionId', () => {
  it('prioriza transaction_id (lo que guarda el cliente)', () => {
    expect(
      getTransactionId({ type: 'X', transaction_id: 'tx_new', original_transaction_id: 'tx_orig' })
    ).toBe('tx_new');
  });

  it('usa original_transaction_id como fallback', () => {
    expect(getTransactionId({ type: 'X', original_transaction_id: 'tx_orig' })).toBe('tx_orig');
  });

  it('devuelve null si no hay ninguno', () => {
    expect(getTransactionId({ type: 'X' })).toBeNull();
  });
});

describe('revenuecat-webhook logic - getBoostBarIdAttribute', () => {
  it('lee el bar del atributo boost_bar_id', () => {
    expect(
      getBoostBarIdAttribute({
        type: 'X',
        subscriber_attributes: { boost_bar_id: { value: BAR_ID } },
      })
    ).toBe(BAR_ID);
  });

  it('descarta valores que no son uuid o ausentes', () => {
    expect(
      getBoostBarIdAttribute({ type: 'X', subscriber_attributes: { boost_bar_id: { value: 'x' } } })
    ).toBeNull();
    expect(getBoostBarIdAttribute({ type: 'X' })).toBeNull();
  });
});

describe('revenuecat-webhook logic - isSupabaseUserId', () => {
  it('distingue uuids de Supabase de ids anónimos de RevenueCat', () => {
    expect(isSupabaseUserId(BAR_ID)).toBe(true);
    expect(isSupabaseUserId('$RCAnonymousID:abc123')).toBe(false);
    expect(isSupabaseUserId(undefined)).toBe(false);
  });
});

describe('revenuecat-webhook logic - ventana del boost', () => {
  const now = new Date('2026-10-06T12:00:00.000Z');

  it('calcula end_at según el plan (nunca null)', () => {
    expect(computeEndAt('7d', now).toISOString()).toBe('2026-10-13T12:00:00.000Z');
    expect(computeEndAt('1m', now).toISOString()).toBe('2026-11-06T12:00:00.000Z');
    expect(computeEndAt('1y', now).toISOString()).toBe('2027-10-06T12:00:00.000Z');
  });

  it('empieza ahora si no hay boost activo', () => {
    const { startAt, endAt } = computeBoostWindow('7d', now, null);
    expect(startAt.toISOString()).toBe(now.toISOString());
    expect(endAt.toISOString()).toBe('2026-10-13T12:00:00.000Z');
  });

  it('encadena tras un boost activo que aún no ha terminado', () => {
    const { startAt, endAt } = computeBoostWindow('7d', now, '2026-10-10T12:00:00.000Z');
    expect(startAt.toISOString()).toBe('2026-10-10T12:00:00.000Z');
    expect(endAt.toISOString()).toBe('2026-10-17T12:00:00.000Z');
  });

  it('ignora un end_at ya pasado', () => {
    const { startAt } = computeBoostWindow('1m', now, '2026-10-01T00:00:00.000Z');
    expect(startAt.toISOString()).toBe(now.toISOString());
  });
});
