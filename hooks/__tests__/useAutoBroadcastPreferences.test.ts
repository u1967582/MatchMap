import { renderHook, waitFor, act } from '@testing-library/react-native';
import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { useAutoBroadcastPreferences } from '~/hooks/useAutoBroadcastPreferences';

const mockedFrom = supabase.from as jest.Mock;
const mockedRpc = supabase.rpc as jest.Mock;
const mockedGetUser = supabase.auth.getUser as jest.Mock;

// El hook hace, en este orden: from('competitions'), y en paralelo
// from('bar_selected_competitions') + from('bar_selected_teams').
function mockEmptyLoad() {
  mockedFrom
    .mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }))
    .mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }))
    .mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAutoBroadcastPreferences', () => {
  it('con forceAdminRpc=true, save() usa fn_sync_bar_preferences_admin sin consultar el rol del usuario', async () => {
    mockEmptyLoad();

    const { result } = await renderHook(() => useAutoBroadcastPreferences({ barId: 'bar-1', forceAdminRpc: true }));

    await waitFor(() => expect(result.current.loadingComps).toBe(false));
    expect(mockedGetUser).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.save();
    });

    expect(mockedRpc).toHaveBeenCalledWith(
      'fn_sync_bar_preferences_admin',
      expect.objectContaining({ _bar_id: 'bar-1' }),
    );
  });

  it('sin forceAdminRpc, usa fn_sync_bar_preferences para un usuario no admin', async () => {
    mockEmptyLoad();
    mockedGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: { is_super_user: false }, error: null }));

    const { result } = await renderHook(() => useAutoBroadcastPreferences({ barId: 'bar-1' }));

    await waitFor(() => expect(result.current.loadingComps).toBe(false));

    await act(async () => {
      await result.current.save();
    });

    expect(mockedRpc).toHaveBeenCalledWith(
      'fn_sync_bar_preferences',
      expect.objectContaining({ _bar_id: 'bar-1' }),
    );
  });

  it('deriva hasAutomation/hasSelection de las preferencias ya guardadas', async () => {
    mockedFrom
      .mockReturnValueOnce(createQueryBuilderMock({ data: [{ id: 1, name: 'Liga', gender: null }], error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: [{ competition_id: 1 }], error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));

    const { result } = await renderHook(() => useAutoBroadcastPreferences({ barId: 'bar-1', forceAdminRpc: true }));

    await waitFor(() => expect(result.current.loadingComps).toBe(false));

    expect(result.current.hasAutomation).toBe(true);
    expect(result.current.hasSelection).toBe(true);
    expect(result.current.selectedCompetitions).toEqual({ '1': true });
  });

  it('hasChanges es true al desmarcar la única competición guardada, aunque hasSelection quede en false', async () => {
    mockedFrom
      .mockReturnValueOnce(createQueryBuilderMock({ data: [{ id: 1, name: 'Liga', gender: null }], error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: [{ competition_id: 1 }], error: null }))
      .mockReturnValueOnce(createQueryBuilderMock({ data: [], error: null }));

    const { result } = await renderHook(() => useAutoBroadcastPreferences({ barId: 'bar-1', forceAdminRpc: true }));
    await waitFor(() => expect(result.current.loadingComps).toBe(false));

    expect(result.current.hasChanges).toBe(false);

    await act(async () => {
      result.current.toggleCompetitionSelected(1);
    });

    expect(result.current.hasSelection).toBe(false);
    expect(result.current.hasChanges).toBe(true);
  });

  it('toggleTeamSelected añade y quita la clave teamId|competitionId', async () => {
    mockEmptyLoad();

    const { result } = await renderHook(() => useAutoBroadcastPreferences({ barId: 'bar-1', forceAdminRpc: true }));
    await waitFor(() => expect(result.current.loadingComps).toBe(false));

    await act(async () => {
      result.current.toggleTeamSelected(1, 'team-a');
    });
    expect(result.current.selectedTeams.has('team-a|1')).toBe(true);

    await act(async () => {
      result.current.toggleTeamSelected(1, 'team-a');
    });
    expect(result.current.selectedTeams.has('team-a|1')).toBe(false);
  });
});
