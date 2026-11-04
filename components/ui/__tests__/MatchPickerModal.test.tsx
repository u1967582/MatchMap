import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('~/utils/supabase');
jest.mock('../HorizontalDateScroller', () => () => null);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import MatchPickerModal from '~/components/ui/MatchPickerModal';

const mockedSupabase = supabase as any;

const MATCH = {
  id: 'm1',
  date: '2026-11-04',
  time: '21:00:00',
  home_team_id: 't1',
  away_team_id: 't2',
  competition_id: 1,
  status: 'scheduled',
};

function mockTables(matchesResult: { data: any; error: any }) {
  mockedSupabase.from.mockImplementation((table: string) => {
    if (table === 'matches') return createQueryBuilderMock(matchesResult);
    if (table === 'teams') {
      return createQueryBuilderMock({
        data: [
          { id: 't1', name: 'Local FC', gender: 'male', logo_url: null },
          { id: 't2', name: 'Visitante CF', gender: 'male', logo_url: null },
        ],
        error: null,
      });
    }
    return createQueryBuilderMock({ data: [{ id: 1, name: 'Liga', gender: 'male' }], error: null });
  });
}

beforeEach(() => jest.clearAllMocks());

describe('MatchPickerModal (auditoría 12)', () => {
  it('si falla la carga muestra error con reintento, no «no hay partidos»', async () => {
    mockTables({ data: null, error: { message: 'Network request failed' } });

    await render(<MatchPickerModal visible onClose={jest.fn()} onSelectMatch={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('No se pudieron cargar los partidos')).toBeTruthy());
    expect(screen.queryByText('No hay partidos programados para esta fecha')).toBeNull();

    // Reintentar con red ya disponible carga los partidos
    mockTables({ data: [MATCH], error: null });
    await fireEvent.press(screen.getByText('Reintentar'));
    await waitFor(() => expect(screen.getByText('Local FC')).toBeTruthy());
    expect(screen.queryByText('No se pudieron cargar los partidos')).toBeNull();
  });
});
