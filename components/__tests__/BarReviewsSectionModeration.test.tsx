/* eslint-disable import/first -- los jest.mock van antes de importar los módulos mockeados */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

jest.mock('~/utils/supabase');
jest.mock('~/components/ds', () => {
  const actual = jest.requireActual('~/components/ds');
  return { ...actual, toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } };
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
import BarReviewsSection from '~/components/BarReviewsSection';

const mockedSupabase = supabase as any;
// eslint-disable-next-line react-hooks/rules-of-hooks
const mockedRouter = useRouter();

const review = (id: string, userId: string | null, username: string, comment: string) => ({
  id,
  user_id: userId,
  rating: 4,
  comment,
  created_at: '2026-10-10T00:00:00Z',
  likes: 0,
  is_google_review: false,
  google_author_name: null,
  user: { username, profile_image_url: '' },
});

const REVIEWS = [
  review('r-me', 'me', 'yo', 'Mi reseña'),
  review('r-ana', 'ana', 'ana', 'Reseña de Ana'),
  review('r-troll', 'troll', 'troll', 'Reseña del troll'),
  review('r-reported', 'luis', 'luis', 'Reseña ya reportada'),
];

let blocksBuilder: any;
let reviewsResult: any;

function mockTables(overrides: Record<string, any> = {}) {
  mockedSupabase.from.mockImplementation((table: string) => {
    if (overrides[table]) return overrides[table];
    switch (table) {
      case 'reviews':
        return createQueryBuilderMock(reviewsResult);
      case 'bars':
        return createQueryBuilderMock({ data: { rating: 4, review_count: 4 }, error: null });
      case 'user_blocks':
        return createQueryBuilderMock({ data: [{ blocked_id: 'troll' }], error: null });
      case 'review_reports':
        return createQueryBuilderMock({ data: [{ review_id: 'r-reported' }], error: null });
      default:
        return createQueryBuilderMock();
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIsGuest.mockResolvedValue(false);
  mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'me' } }, error: null });
  reviewsResult = { data: REVIEWS, error: null };
  blocksBuilder = createQueryBuilderMock({ data: null, error: null });
  mockTables();
});

describe('BarReviewsSection · moderación (Apple 1.2)', () => {
  it('oculta las reseñas de usuarios bloqueados y las que ya he reportado', async () => {
    await render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => expect(screen.getByText('Reseña de Ana')).toBeTruthy());
    expect(screen.getByText('Mi reseña')).toBeTruthy();
    expect(screen.queryByText('Reseña del troll')).toBeNull();
    expect(screen.queryByText('Reseña ya reportada')).toBeNull();
  });

  it('solo las reseñas ajenas tienen botón de opciones', async () => {
    await render(<BarReviewsSection barId="bar-1" />);
    await waitFor(() => expect(screen.getByText('Reseña de Ana')).toBeTruthy());

    // 2 visibles: la mía (sin opciones) y la de Ana
    expect(screen.getAllByLabelText('Opciones de la reseña')).toHaveLength(1);
  });

  it('"Reportar reseña" abre la pantalla de reporte', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<BarReviewsSection barId="bar-1" />);
    await waitFor(() => expect(screen.getByText('Reseña de Ana')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Opciones de la reseña'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    const buttons = alertSpy.mock.calls[0][2] as any[];
    buttons.find((b) => b.text === 'Reportar reseña').onPress();
    expect(mockedRouter.push).toHaveBeenCalledWith('/report-review/r-ana');
    alertSpy.mockRestore();
  });

  it('bloquear a un usuario lo guarda y oculta sus reseñas', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // Sin bloqueos previos; el mismo builder sirve para la carga y el insert
    blocksBuilder = createQueryBuilderMock({ data: [], error: null });
    mockTables({ user_blocks: blocksBuilder });

    await render(<BarReviewsSection barId="bar-1" />);
    await waitFor(() => expect(screen.getByText('Reseña de Ana')).toBeTruthy());

    await fireEvent.press(screen.getAllByLabelText('Opciones de la reseña')[0]);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const options = alertSpy.mock.calls[0][2] as any[];
    options.find((b) => b.text === 'Bloquear a este usuario').onPress();

    // Confirmación
    expect(alertSpy).toHaveBeenCalledTimes(2);
    const confirm = (alertSpy.mock.calls[1][2] as any[]).find((b) => b.text === 'Bloquear');
    await confirm.onPress();

    await waitFor(() =>
      expect(blocksBuilder.insert).toHaveBeenCalledWith({ blocker_id: 'me', blocked_id: 'ana' })
    );
    await waitFor(() => expect(screen.queryByText('Reseña de Ana')).toBeNull());
    expect(toast.success).toHaveBeenCalledWith('Usuario bloqueado', 'Ya no verás sus reseñas');
    alertSpy.mockRestore();
  });

  it('un invitado ve el aviso de registro en lugar de las opciones', async () => {
    mockGetIsGuest.mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<BarReviewsSection barId="bar-1" />);
    await waitFor(() => expect(screen.getByText('Reseña de Ana')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Opciones de la reseña'));

    await waitFor(() => expect(mockShowGuestLoginAlert).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('si fallan las reseñas muestra error con Reintentar y recarga', async () => {
    reviewsResult = { data: null, error: { message: 'offline' } };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => expect(screen.getByText('No se pudieron cargar las reseñas')).toBeTruthy());

    reviewsResult = { data: REVIEWS, error: null };
    await fireEvent.press(screen.getByText('Reintentar'));

    await waitFor(() => expect(screen.getByText('Reseña de Ana')).toBeTruthy());
    (console.error as jest.Mock).mockRestore();
  });
});
