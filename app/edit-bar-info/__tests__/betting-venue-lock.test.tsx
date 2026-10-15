import 'react-native-gesture-handler/jestSetup';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

// jest.mock se eleva por encima de los imports (babel-jest), así que estos
// módulos ya reciben los mocks de abajo.
import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import EditBarInfoScreen from '~/app/edit-bar-info/[barId]';

jest.mock('~/utils/supabase');
jest.mock('~/components/ds', () => {
  const actual = jest.requireActual('~/components/ds');
  return {
    ...actual,
    toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), supabaseError: jest.fn() },
  };
});

const mockedSupabase = supabase as any;
const OWNER = { id: 'owner-1' };

function mockBar(isBettingVenue: boolean) {
  mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: OWNER }, error: null });
  mockedSupabase.from.mockImplementation((table: string) =>
    table === 'bars'
      ? createQueryBuilderMock({
          data: {
            id: 'bar-1',
            name: 'Bar Pepe',
            address: 'c/ Mayor 1',
            city: 'Girona',
            owner_id: OWNER.id,
            is_betting_venue: isBettingVenue,
          },
          error: null,
        })
      : createQueryBuilderMock({ data: [], error: null })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({ barId: 'bar-1' });
});

// trg_bars_protect_privileged_columns (auditoría 01) no deja al propietario
// desmarcar is_betting_venue: la pantalla tiene que bloquear el switch en vez
// de dejarle intentarlo y fallar al guardar.
describe('EditBarInfoScreen - local de apuestas', () => {
  it('bloquea el switch si el bar ya está marcado como local de apuestas', async () => {
    mockBar(true);
    await render(<EditBarInfoScreen />);

    const toggle = await waitFor(() => screen.getByTestId('betting-venue-switch'));
    expect(toggle.props.disabled).toBe(true);
    expect(toggle.props.value).toBe(true);
    expect(screen.getByText(/Para desmarcarlo, escríbenos/)).toBeTruthy();
  });

  it('deja marcarlo si todavía no lo está', async () => {
    mockBar(false);
    await render(<EditBarInfoScreen />);

    const toggle = await waitFor(() => screen.getByTestId('betting-venue-switch'));
    expect(toggle.props.disabled).toBeFalsy();
    expect(screen.queryByText(/Para desmarcarlo, escríbenos/)).toBeNull();
  });
});
