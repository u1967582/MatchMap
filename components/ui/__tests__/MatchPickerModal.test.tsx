import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import MatchPickerModal from '../MatchPickerModal';
import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';

jest.mock('~/utils/supabase');
jest.mock('../HorizontalDateScroller', () => () => null);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

it('si falla la carga muestra error con reintento, no «no hay partidos»', async () => {
  (supabase.from as jest.Mock).mockImplementation(() =>
    createQueryBuilderMock({ data: null, error: { message: 'Network request failed' } })
  );
  await render(<MatchPickerModal visible onClose={jest.fn()} onSelectMatch={jest.fn()} />);
  await waitFor(() => expect(screen.getByText('No se pudieron cargar los partidos')).toBeTruthy());
  expect(screen.queryByText('No hay partidos programados para esta fecha')).toBeNull();
});
