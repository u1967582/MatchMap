import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('~/utils/supabase');

import { createQueryBuilderMock } from '../../test-utils/mockSupabase';
import { supabase } from '~/utils/supabase';
import BarReviewsSection from '~/components/BarReviewsSection';

const mockedFrom = supabase.from as jest.Mock;

// 8 reseñas: 3 de Google (más recientes que las de la app, para probar
// que la prioridad de app-primero gana a la fecha) y 5 de la app.
const REVIEWS = [
  { id: 'g1', rating: 5, comment: 'Google review 1', created_at: '2026-08-10T00:00:00Z', likes: 0, is_google_review: true, google_author_name: 'Google User 1', user: null },
  { id: 'g2', rating: 4, comment: 'Google review 2', created_at: '2026-08-09T00:00:00Z', likes: 0, is_google_review: true, google_author_name: 'Google User 2', user: null },
  { id: 'g3', rating: 3, comment: 'Google review 3', created_at: '2026-08-08T00:00:00Z', likes: 0, is_google_review: true, google_author_name: 'Google User 3', user: null },
  { id: 'a1', rating: 5, comment: 'App review 1', created_at: '2026-08-01T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user1', profile_image_url: '' } },
  { id: 'a2', rating: 4, comment: 'App review 2', created_at: '2026-08-02T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user2', profile_image_url: '' } },
  { id: 'a3', rating: 3, comment: 'App review 3', created_at: '2026-08-03T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user3', profile_image_url: '' } },
  { id: 'a4', rating: 2, comment: 'App review 4', created_at: '2026-08-04T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user4', profile_image_url: '' } },
  { id: 'a5', rating: 1, comment: 'App review 5', created_at: '2026-08-05T00:00:00Z', likes: 0, is_google_review: false, google_author_name: null, user: { username: 'user5', profile_image_url: '' } },
];

// Orden esperado tras la prioridad (app primero, por fecha desc dentro de
// cada grupo; luego Google, por fecha desc): a5, a4, a3, a2, a1, g1, g2, g3
const EXPECTED_ORDER = ['App review 5', 'App review 4', 'App review 3', 'App review 2', 'App review 1', 'Google review 1', 'Google review 2', 'Google review 3'];

const mockFetch = (reviews: any[]) => {
  mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: reviews, error: null }));
  mockedFrom.mockReturnValueOnce(
    createQueryBuilderMock({ data: { rating: 0, review_count: reviews.length }, error: null })
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BarReviewsSection - paginación', () => {
  it('muestra solo las primeras 5 reseñas, priorizando las de la app sobre las de Google', async () => {
    mockFetch(REVIEWS);
    const { getByText, queryByText } = await render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => {
      EXPECTED_ORDER.slice(0, 5).forEach((comment) => {
        expect(getByText(comment)).toBeTruthy();
      });
    });

    EXPECTED_ORDER.slice(5).forEach((comment) => {
      expect(queryByText(comment)).toBeNull();
    });
  });

  it('el botón "Cargar más reseñas" revela 5 reseñas adicionales y luego desaparece', async () => {
    mockFetch(REVIEWS);
    const { getByText, queryByText } = await render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => expect(getByText('Cargar más reseñas')).toBeTruthy());

    fireEvent.press(getByText('Cargar más reseñas'));

    await waitFor(() => {
      EXPECTED_ORDER.forEach((comment) => {
        expect(getByText(comment)).toBeTruthy();
      });
    });

    expect(queryByText('Cargar más reseñas')).toBeNull();
  });

  it('no muestra el botón "Cargar más reseñas" si hay 5 reseñas o menos', async () => {
    mockFetch(REVIEWS.slice(0, 5));
    const { getByText, queryByText } = await render(<BarReviewsSection barId="bar-1" />);

    await waitFor(() => expect(getByText('App review 1')).toBeTruthy());

    expect(queryByText('Cargar más reseñas')).toBeNull();
  });
});
