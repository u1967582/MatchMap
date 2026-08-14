jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import {
  trackBarEvent,
  trackBarProximity,
  fetchBarStatsSummary,
  fetchBarStatsDaily,
  fetchBarStatsRangeStart,
} from '~/services/barAnalytics';

const mockedRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('trackBarEvent', () => {
  it('llama a fn_track_bar_event con el bar_id y event_type cuando no es el owner', () => {
    trackBarEvent('bar-1', 'profile_view', false);

    expect(mockedRpc).toHaveBeenCalledWith('fn_track_bar_event', {
      p_bar_id: 'bar-1',
      p_event_type: 'profile_view',
    });
  });

  it('no llama a la RPC si isOwner es true', () => {
    trackBarEvent('bar-1', 'menu_view', true);

    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it('no llama a la RPC si no hay barId', () => {
    trackBarEvent(undefined, 'contact_click_phone', false);
    trackBarEvent(null, 'contact_click_phone', false);
    trackBarEvent('', 'contact_click_phone', false);

    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it('funciona para cada tipo de evento soportado', () => {
    const eventTypes = [
      'profile_view',
      'menu_view',
      'contact_click_phone',
      'contact_click_address',
      'contact_click_website',
    ] as const;

    eventTypes.forEach((eventType) => trackBarEvent('bar-1', eventType, false));

    eventTypes.forEach((eventType) => {
      expect(mockedRpc).toHaveBeenCalledWith('fn_track_bar_event', {
        p_bar_id: 'bar-1',
        p_event_type: eventType,
      });
    });
  });

  it('loguea el error pero no lanza si la RPC falla', async () => {
    mockedRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    expect(() => trackBarEvent('bar-1', 'profile_view', false)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(console.error).toHaveBeenCalledWith(
      'Error tracking profile_view:',
      { message: 'boom' }
    );
  });

  it('no loguea nada si la RPC no devuelve error', async () => {
    mockedRpc.mockResolvedValueOnce({ data: null, error: null });

    trackBarEvent('bar-1', 'profile_view', false);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('trackBarProximity', () => {
  it('llama a fn_track_bar_proximity solo con el bar_id (nunca coordenadas)', () => {
    trackBarProximity('bar-1');

    expect(mockedRpc).toHaveBeenCalledWith('fn_track_bar_proximity', { p_bar_id: 'bar-1' });
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc.mock.calls[0][1]).not.toHaveProperty('latitude');
    expect(mockedRpc.mock.calls[0][1]).not.toHaveProperty('longitude');
  });

  it('no llama a la RPC si no hay barId', () => {
    trackBarProximity(undefined);
    trackBarProximity(null);
    trackBarProximity('');

    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it('loguea el error pero no lanza si la RPC falla', async () => {
    mockedRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    expect(() => trackBarProximity('bar-1')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(console.error).toHaveBeenCalledWith('Error tracking proximity:', { message: 'boom' });
  });
});

describe('fetchBarStatsSummary', () => {
  it('llama a fn_get_bar_stats_summary con el bar_id y los días exactos', () => {
    fetchBarStatsSummary('bar-1', 30);

    expect(mockedRpc).toHaveBeenCalledWith('fn_get_bar_stats_summary', { p_bar_id: 'bar-1', p_days: 30 });
  });
});

describe('fetchBarStatsDaily', () => {
  it('llama a fn_get_bar_stats_daily con el bar_id y los días exactos', () => {
    fetchBarStatsDaily('bar-1', 90);

    expect(mockedRpc).toHaveBeenCalledWith('fn_get_bar_stats_daily', { p_bar_id: 'bar-1', p_days: 90 });
  });
});

describe('fetchBarStatsRangeStart', () => {
  it('llama a fn_get_bar_stats_range_start con el bar_id', () => {
    fetchBarStatsRangeStart('bar-1');

    expect(mockedRpc).toHaveBeenCalledWith('fn_get_bar_stats_range_start', { p_bar_id: 'bar-1' });
  });
});
