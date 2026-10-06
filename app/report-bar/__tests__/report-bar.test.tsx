import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

jest.mock('~/utils/supabase');
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('~/components/ds', () => {
  const actual = jest.requireActual('~/components/ds');
  return {
    ...actual,
    toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), supabaseError: jest.fn() },
  };
});

import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import ReportBarScreen from '~/app/report-bar/[barId]';

const mockedSupabase = supabase as any;
// eslint-disable-next-line react-hooks/rules-of-hooks
const mockedRouter = useRouter();

let insertBuilder: any;

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({ barId: 'bar-1' });
  insertBuilder = createQueryBuilderMock({ data: null, error: null });
  mockedSupabase.from.mockImplementation((table: string) =>
    table === 'bars'
      ? createQueryBuilderMock({ data: { id: 'bar-1', name: 'Bar Pepe', city: 'Barcelona' }, error: null })
      : insertBuilder
  );
});

async function renderScreen() {
  await render(<ReportBarScreen />);
  await waitFor(() => expect(screen.getByText('Bar Pepe')).toBeTruthy());
}

describe('ReportBarScreen', () => {
  it('los motivos coinciden con el CHECK bar_reports_reason_check de la base de datos', async () => {
    await renderScreen();
    // Si se añade un motivo en la app hay que añadirlo también al CHECK (y viceversa)
    [
      'Información incorrecta',
      'Ha cerrado',
      'Ubicación incorrecta',
      'Fotos incorrectas',
      'No tienen televisión',
      'No aparece el partido en la televisión',
      'Otro',
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });

  it('envía el reporte con motivo y mensaje recortado', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    await renderScreen();

    await fireEvent.press(screen.getByText('Ha cerrado'));
    await fireEvent.changeText(screen.getByPlaceholderText('Describe qué información está mal...'), '  Cerró en agosto  ');
    await fireEvent.press(screen.getByText('Enviar reporte'));

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      bar_id: 'bar-1',
      reporter_id: 'u1',
      reason: 'cerrado',
      message: 'Cerró en agosto',
    });
    expect(toast.success).toHaveBeenCalled();
    expect(mockedRouter.back).toHaveBeenCalled();
  });

  it('mensaje vacío se guarda como null', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    await renderScreen();
    await fireEvent.press(screen.getByText('Otro'));
    await fireEvent.press(screen.getByText('Enviar reporte'));
    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());
    expect(insertBuilder.insert.mock.calls[0][0].message).toBeNull();
  });

  it('sin sesión no envía y avisa', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Otro'));
    await fireEvent.press(screen.getByText('Enviar reporte'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Debes iniciar sesión'));
    expect(insertBuilder.insert).not.toHaveBeenCalled();
  });

  it('si la base de datos rechaza el reporte, muestra el error y no navega', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    insertBuilder = createQueryBuilderMock({ data: null, error: { message: 'rls' } });
    await renderScreen();
    await fireEvent.press(screen.getByText('Otro'));
    await fireEvent.press(screen.getByText('Enviar reporte'));
    await waitFor(() => expect(toast.supabaseError).toHaveBeenCalled());
    expect(mockedRouter.back).not.toHaveBeenCalled();
  });
});
