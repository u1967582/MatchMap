import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

jest.mock('~/utils/supabase');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: any) => <Text testID={`icon-${name}`}>{name}</Text> };
});
const mockCreateReview = jest.fn();
const mockUpdateReview = jest.fn();
const mockGetUserReview = jest.fn();
jest.mock('~/hooks/useReviews', () => ({
  useReviews: () => ({
    createReview: mockCreateReview,
    updateReview: mockUpdateReview,
    getUserReview: mockGetUserReview,
  }),
}));
jest.mock('~/components/ds', () => {
  const actual = jest.requireActual('~/components/ds');
  return { ...actual, toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } };
});

import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import WriteReviewScreen from '~/app/write-review/[barId]';

const mockedSupabase = supabase as any;
// eslint-disable-next-line react-hooks/rules-of-hooks
const mockedRouter = useRouter();
const PLACEHOLDER = 'Comparte detalles sobre tu visita: ambiente, atención, bebidas, música...';

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({ barId: 'bar-1' });
  mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  mockedSupabase.from.mockReturnValue(
    createQueryBuilderMock({ data: { id: 'bar-1', name: 'Bar Pepe', bar_images: [] }, error: null })
  );
  mockGetUserReview.mockResolvedValue(null);
});

async function renderScreen() {
  await render(<WriteReviewScreen />);
  await waitFor(() => expect(screen.getByText('Bar Pepe')).toBeTruthy());
}

const pressStar = async (n: number) => {
  // Las estrellas se renderizan en orden; pulsamos la n-ésima
  const stars = [
    ...screen.queryAllByTestId('icon-star-outline'),
    ...screen.queryAllByTestId('icon-star'),
  ];
  expect(stars.length).toBe(5);
  await fireEvent.press(screen.queryAllByTestId(/icon-star/)[n - 1]);
};

describe('WriteReviewScreen', () => {
  it('publica una reseña nueva con rating y comentario recortado', async () => {
    mockCreateReview.mockResolvedValueOnce(true);
    await renderScreen();

    await pressStar(4);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '  Muy buen ambiente  ');
    await fireEvent.press(screen.getByText('Publicar'));

    await waitFor(() =>
      expect(mockCreateReview).toHaveBeenCalledWith('bar-1', 'u1', 4, 'Muy buen ambiente')
    );
    expect(toast.success).toHaveBeenCalledWith('Reseña publicada');
    expect(mockedRouter.back).toHaveBeenCalled();
  });

  it('si ya existe reseña, la precarga y la actualiza', async () => {
    mockGetUserReview.mockResolvedValueOnce({ id: 'rev-1', rating: 2, comment: 'Regular' });
    mockUpdateReview.mockResolvedValueOnce(true);
    await renderScreen();

    await waitFor(() => expect(screen.getByDisplayValue('Regular')).toBeTruthy());
    await fireEvent.press(screen.getByText('Actualizar'));

    await waitFor(() => expect(mockUpdateReview).toHaveBeenCalledWith('rev-1', 2, 'Regular'));
    expect(mockCreateReview).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Reseña actualizada');
  });

  it('no publica sin valoración o sin comentario', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'Texto');
    await fireEvent.press(screen.getByText('Publicar'));
    await pressStar(5);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '   ');
    await fireEvent.press(screen.getByText('Publicar'));
    expect(mockCreateReview).not.toHaveBeenCalled();
  });

  it('si falla, muestra error y no navega', async () => {
    mockCreateReview.mockResolvedValueOnce(false);
    await renderScreen();
    await pressStar(3);
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'Bien');
    await fireEvent.press(screen.getByText('Publicar'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockedRouter.back).not.toHaveBeenCalled();
  });
});
