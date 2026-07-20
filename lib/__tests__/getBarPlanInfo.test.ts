import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { getBarPlanInfo, getBarTierAndCapabilities } from '~/lib/getBarPlanInfo';
import { CAP_BY_TIER } from '~/lib/planCapabilities';

const mockedFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getBarPlanInfo', () => {
  it('devuelve plan Gratuito si no hay suscripción activa', async () => {
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));

    const result = await getBarPlanInfo('bar-1');

    expect(result).toEqual({ plan_type: 'free', name: 'Gratuito' });
  });

  it('devuelve plan Gratuito si la consulta falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    const result = await getBarPlanInfo('bar-1');

    expect(result).toEqual({ plan_type: 'free', name: 'Gratuito' });
  });

  it('mapea el plan_type de la suscripción activa a su etiqueta en español', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: [{ plan_type: 'pro_yearly', status: 'active' }], error: null })
    );

    const result = await getBarPlanInfo('bar-1');

    expect(result).toEqual({ plan_type: 'pro_yearly', name: 'Pro Anual' });
  });

  it('devuelve "Desconocido" para un plan_type no mapeado', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({
        data: [{ plan_type: 'legacy_plan', status: 'active' }],
        error: null,
      })
    );

    const result = await getBarPlanInfo('bar-1');

    expect(result).toEqual({ plan_type: 'legacy_plan', name: 'Desconocido' });
  });

  it('consulta la tabla subscriptions filtrando por bar_id y status=active, ordenando por más reciente', async () => {
    const builder = createQueryBuilderMock({ data: [], error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await getBarPlanInfo('bar-42');

    expect(mockedFrom).toHaveBeenCalledWith('subscriptions');
    expect(builder.eq).toHaveBeenCalledWith('bar_id', 'bar-42');
    expect(builder.eq).toHaveBeenCalledWith('status', 'active');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
  });
});

describe('getBarTierAndCapabilities', () => {
  it('devuelve siempre tier "pro" independientemente del barId (comportamiento actual simplificado)', async () => {
    const result = await getBarTierAndCapabilities('cualquier-bar-id');
    expect(result.tier).toBe('pro');
    expect(result.capabilities).toEqual(CAP_BY_TIER.pro);
  });

  it('no consulta a Supabase', async () => {
    await getBarTierAndCapabilities('otro-bar-id');
    expect(mockedFrom).not.toHaveBeenCalled();
  });
});
