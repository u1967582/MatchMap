/* eslint-disable import/first -- los jest.mock van antes de importar los módulos mockeados */
jest.mock('~/utils/supabase');

import { supabase } from '~/utils/supabase';
import { createQueryBuilderMock } from '~/test-utils/mockSupabase';
import {
  REVIEW_REPORT_REASONS,
  blockUser,
  fetchBlockedUserIds,
  fetchHiddenReviewFilters,
  fetchPendingReviewReports,
  fetchReportedReviewIds,
  filterHiddenReviews,
  removeResolvedReports,
  reportReview,
  resolveReviewReport,
  reviewReportReasonLabel,
} from '~/services/moderation';

const mockedFrom = supabase.from as jest.Mock;
const mockedRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedFrom.mockImplementation(() => createQueryBuilderMock());
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('REVIEW_REPORT_REASONS', () => {
  it('coincide con el CHECK review_reports_reason_check de la migración', () => {
    expect(REVIEW_REPORT_REASONS.map((r) => r.value).sort()).toEqual(
      ['acoso', 'datos_personales', 'falso', 'ofensivo', 'otro', 'spam'].sort()
    );
  });

  it('reviewReportReasonLabel devuelve la etiqueta o el valor si no se conoce', () => {
    expect(reviewReportReasonLabel('spam')).toBe('Spam o publicidad');
    expect(reviewReportReasonLabel('desconocido')).toBe('desconocido');
  });
});

describe('reportReview', () => {
  it('inserta solo los campos del usuario, con el mensaje recortado y limitado a 500', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    const result = await reportReview({
      reviewId: 'r1',
      reporterId: 'u1',
      reason: 'ofensivo',
      message: `  ${'a'.repeat(600)}  `,
    });

    expect(result).toEqual({ ok: true });
    expect(mockedFrom).toHaveBeenCalledWith('review_reports');
    const payload = builder.insert.mock.calls[0][0];
    expect(payload).toEqual({
      review_id: 'r1',
      reporter_id: 'u1',
      reason: 'ofensivo',
      message: 'a'.repeat(500),
    });
    // El estado y el contexto los pone el trigger: el cliente no los envía
    expect(payload).not.toHaveProperty('status');
  });

  it('un mensaje vacío se guarda como null', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await reportReview({ reviewId: 'r1', reporterId: 'u1', reason: 'spam', message: '   ' });

    expect(builder.insert.mock.calls[0][0].message).toBeNull();
  });

  it('un reporte repetido (23505) se marca como duplicado', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { code: '23505', message: 'duplicate' } })
    );

    const result = await reportReview({ reviewId: 'r1', reporterId: 'u1', reason: 'spam' });

    expect(result).toMatchObject({ ok: false, duplicate: true });
  });

  it('cualquier otro error se devuelve sin duplicate', async () => {
    const error = { code: '42501', message: 'rls' };
    mockedFrom.mockReturnValueOnce(createQueryBuilderMock({ data: null, error }));

    const result = await reportReview({ reviewId: 'r1', reporterId: 'u1', reason: 'spam' });

    expect(result).toEqual({ ok: false, error });
  });
});

describe('blockUser', () => {
  it('inserta el bloqueo', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    expect(await blockUser('u1', 'u2')).toEqual({ ok: true });
    expect(mockedFrom).toHaveBeenCalledWith('user_blocks');
    expect(builder.insert).toHaveBeenCalledWith({ blocker_id: 'u1', blocked_id: 'u2' });
  });

  it.each([
    ['', 'u2'],
    ['u1', ''],
    ['u1', 'u1'],
  ])('rechaza sin llamar a Supabase un bloqueo no válido (%s → %s)', async (a, b) => {
    const result = await blockUser(a, b);
    expect(result.ok).toBe(false);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('un bloqueo repetido (23505) se marca como duplicado', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { code: '23505' } })
    );
    expect(await blockUser('u1', 'u2')).toMatchObject({ ok: false, duplicate: true });
  });
});

describe('fetchBlockedUserIds / fetchReportedReviewIds', () => {
  it('sin usuario devuelve [] sin consultar', async () => {
    expect(await fetchBlockedUserIds(null)).toEqual([]);
    expect(await fetchReportedReviewIds(null)).toEqual([]);
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('devuelve los ids bloqueados del usuario', async () => {
    const builder = createQueryBuilderMock({
      data: [{ blocked_id: 'u2' }, { blocked_id: 'u3' }],
      error: null,
    });
    mockedFrom.mockReturnValueOnce(builder);

    expect(await fetchBlockedUserIds('u1')).toEqual(['u2', 'u3']);
    expect(builder.eq).toHaveBeenCalledWith('blocker_id', 'u1');
  });

  it('devuelve los ids de reseñas reportadas, ignorando las ya borradas (null)', async () => {
    const builder = createQueryBuilderMock({
      data: [{ review_id: 'r1' }, { review_id: null }, { review_id: 'r2' }],
      error: null,
    });
    mockedFrom.mockReturnValueOnce(builder);

    expect(await fetchReportedReviewIds('u1')).toEqual(['r1', 'r2']);
    expect(builder.eq).toHaveBeenCalledWith('reporter_id', 'u1');
  });

  it('si Supabase falla devuelve [] para no romper la ficha del bar', async () => {
    mockedFrom.mockReturnValue(createQueryBuilderMock({ data: null, error: { message: 'boom' } }));
    expect(await fetchBlockedUserIds('u1')).toEqual([]);
    expect(await fetchReportedReviewIds('u1')).toEqual([]);
  });

  it('si la consulta lanza devuelve []', async () => {
    mockedFrom.mockImplementation(() => {
      throw new Error('offline');
    });
    expect(await fetchBlockedUserIds('u1')).toEqual([]);
    expect(await fetchReportedReviewIds('u1')).toEqual([]);
  });

  it('fetchHiddenReviewFilters combina ambas consultas', async () => {
    mockedFrom.mockImplementation((table: string) =>
      table === 'user_blocks'
        ? createQueryBuilderMock({ data: [{ blocked_id: 'u2' }], error: null })
        : createQueryBuilderMock({ data: [{ review_id: 'r9' }], error: null })
    );

    expect(await fetchHiddenReviewFilters('u1')).toEqual({
      blockedUserIds: ['u2'],
      reportedReviewIds: ['r9'],
    });
  });
});

describe('filterHiddenReviews', () => {
  const reviews = [
    { id: 'r1', user_id: 'u2' },
    { id: 'r2', user_id: 'u3' },
    { id: 'r3', user_id: null }, // reseña de Google
    { id: 'r4', user_id: 'u4' },
  ];

  it('oculta las reseñas de usuarios bloqueados y las ya reportadas', () => {
    expect(filterHiddenReviews(reviews, ['u2'], ['r4']).map((r) => r.id)).toEqual(['r2', 'r3']);
  });

  it('sin bloqueos ni reportes devuelve todas', () => {
    expect(filterHiddenReviews(reviews, [], [])).toHaveLength(4);
  });

  it('una reseña de Google (sin user_id) se puede ocultar si se reportó', () => {
    expect(filterHiddenReviews(reviews, [], ['r3']).map((r) => r.id)).toEqual(['r1', 'r2', 'r4']);
  });
});

describe('admin: fetchPendingReviewReports', () => {
  it('pide los pendientes del más antiguo al más reciente y normaliza el bar', async () => {
    const builder = createQueryBuilderMock({
      data: [
        {
          id: 'rep1',
          review_id: 'r1',
          reason: 'spam',
          message: null,
          review_comment: 'texto',
          created_at: '2026-10-15T10:00:00Z',
          bar: [{ id: 'b1', name: 'Bar Pepe' }],
        },
        {
          id: 'rep2',
          review_id: null,
          reason: 'otro',
          message: 'hola',
          review_comment: null,
          created_at: '2026-10-15T11:00:00Z',
          bar: null,
        },
      ],
      error: null,
    });
    mockedFrom.mockReturnValueOnce(builder);

    const reports = await fetchPendingReviewReports();

    expect(mockedFrom).toHaveBeenCalledWith('review_reports');
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(reports[0].bar).toEqual({ id: 'b1', name: 'Bar Pepe' });
    expect(reports[1].bar).toBeNull();
  });

  it('lanza si Supabase falla (la pantalla muestra Reintentar)', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );
    await expect(fetchPendingReviewReports()).rejects.toEqual({ message: 'boom' });
  });
});

describe('admin: resolveReviewReport', () => {
  it('llama a la RPC con la acción y las notas recortadas', async () => {
    mockedRpc.mockResolvedValueOnce({ data: null, error: null });

    expect(await resolveReviewReport('rep1', 'remove_review', '  insultos  ')).toEqual({
      ok: true,
    });
    expect(mockedRpc).toHaveBeenCalledWith('admin_resolve_review_report', {
      p_report_id: 'rep1',
      p_action: 'remove_review',
      p_notes: 'insultos',
    });
  });

  it('sin notas envía null y propaga el error de la RPC', async () => {
    const error = { code: '42501', message: 'not authorized' };
    mockedRpc.mockResolvedValueOnce({ data: null, error });

    expect(await resolveReviewReport('rep1', 'dismiss')).toEqual({ ok: false, error });
    expect(mockedRpc.mock.calls[0][1].p_notes).toBeNull();
  });
});

describe('admin: removeResolvedReports', () => {
  const pending = [
    { id: 'rep1', review_id: 'r1' },
    { id: 'rep2', review_id: 'r1' },
    { id: 'rep3', review_id: 'r2' },
    { id: 'rep4', review_id: null },
  ];

  it('al descartar solo quita ese reporte', () => {
    expect(removeResolvedReports(pending, pending[0], 'dismiss').map((r) => r.id)).toEqual([
      'rep2',
      'rep3',
      'rep4',
    ]);
  });

  it('al eliminar la reseña quita todos los reportes de esa reseña', () => {
    expect(removeResolvedReports(pending, pending[0], 'remove_review').map((r) => r.id)).toEqual([
      'rep3',
      'rep4',
    ]);
  });

  it('un reporte de una reseña ya borrada (null) no arrastra a otros', () => {
    expect(removeResolvedReports(pending, pending[3], 'remove_review').map((r) => r.id)).toEqual([
      'rep1',
      'rep2',
      'rep3',
    ]);
  });
});
