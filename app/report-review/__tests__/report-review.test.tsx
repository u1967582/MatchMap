/* eslint-disable import/first -- los jest.mock van antes de importar los módulos mockeados */
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
const mockGetIsGuest = jest.fn();
const mockShowGuestLoginAlert = jest.fn();
jest.mock('~/utils/auth', () => ({
  getIsGuest: () => mockGetIsGuest(),
  showGuestLoginAlert: (...args: any[]) => mockShowGuestLoginAlert(...args),
}));

import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import ReportReviewScreen from '~/app/report-review/[reviewId]';

const mockedSupabase = supabase as any;
// eslint-disable-next-line react-hooks/rules-of-hooks
const mockedRouter = useRouter();

let insertBuilder: any;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIsGuest.mockResolvedValue(false);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ reviewId: 'rev-1' });
  mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  insertBuilder = createQueryBuilderMock({ data: null, error: null });
  mockedSupabase.from.mockImplementation((table: string) =>
    table === 'reviews'
      ? createQueryBuilderMock({
          data: { id: 'rev-1', comment: 'Texto ofensivo', rating: 1 },
          error: null,
        })
      : insertBuilder
  );
});

async function renderScreen() {
  await render(<ReportReviewScreen />);
  await waitFor(() => expect(screen.getByText('“Texto ofensivo”')).toBeTruthy());
}

describe('ReportReviewScreen', () => {
  it('muestra todos los motivos del CHECK review_reports_reason_check', async () => {
    await renderScreen();
    [
      'Lenguaje ofensivo o de odio',
      'Acoso o amenazas',
      'Spam o publicidad',
      'Reseña falsa o engañosa',
      'Datos personales de alguien',
      'Otro',
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });

  it('envía el reporte con motivo y mensaje recortado y vuelve atrás', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('Acoso o amenazas'));
    await fireEvent.changeText(
      screen.getByPlaceholderText('Explica por qué debemos revisar esta reseña...'),
      '  Insulta al camarero  '
    );
    await fireEvent.press(screen.getByText('Enviar reporte'));

    await waitFor(() => expect(insertBuilder.insert).toHaveBeenCalled());
    expect(mockedSupabase.from).toHaveBeenCalledWith('review_reports');
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      review_id: 'rev-1',
      reporter_id: 'u1',
      reason: 'acoso',
      message: 'Insulta al camarero',
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Gracias, revisaremos la reseña',
      expect.stringContaining('24 horas')
    );
    expect(mockedRouter.back).toHaveBeenCalled();
  });

  it('si ya la había reportado lo trata como éxito', async () => {
    insertBuilder = createQueryBuilderMock({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Spam o publicidad'));
    await fireEvent.press(screen.getByText('Enviar reporte'));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Ya habías reportado esta reseña',
        expect.any(String)
      )
    );
    expect(mockedRouter.back).toHaveBeenCalled();
  });

  it('si falla muestra el error y no sale de la pantalla', async () => {
    insertBuilder = createQueryBuilderMock({
      data: null,
      error: { code: '42501', message: 'rls' },
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Spam o publicidad'));
    await fireEvent.press(screen.getByText('Enviar reporte'));

    await waitFor(() => expect(toast.supabaseError).toHaveBeenCalled());
    expect(mockedRouter.back).not.toHaveBeenCalled();
  });

  it('un invitado ve el aviso de registro y no se envía nada', async () => {
    mockGetIsGuest.mockResolvedValue(true);
    await renderScreen();

    await fireEvent.press(screen.getByText('Otro'));
    await fireEvent.press(screen.getByText('Enviar reporte'));

    await waitFor(() => expect(mockShowGuestLoginAlert).toHaveBeenCalled());
    expect(insertBuilder.insert).not.toHaveBeenCalled();
  });
});
