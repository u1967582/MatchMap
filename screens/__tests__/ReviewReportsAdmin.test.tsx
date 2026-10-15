/* eslint-disable import/first -- los jest.mock van antes de importar los módulos mockeados */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('~/utils/supabase');
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
import ReviewReportsAdminScreen from '~/app/review-reports-admin';

const mockedSupabase = supabase as any;

const REPORTS = [
  {
    id: 'rep1',
    review_id: 'r1',
    reason: 'ofensivo',
    message: 'Insulta',
    review_comment: 'Texto ofensivo',
    created_at: '2026-10-15T10:00:00Z',
    bar: { id: 'b1', name: 'Bar Pepe' },
  },
  {
    id: 'rep2',
    review_id: 'r1',
    reason: 'acoso',
    message: null,
    review_comment: 'Texto ofensivo (2)',
    created_at: '2026-10-15T11:00:00Z',
    bar: { id: 'b1', name: 'Bar Pepe' },
  },
  {
    id: 'rep3',
    review_id: 'r2',
    reason: 'spam',
    message: null,
    review_comment: 'Compra aquí',
    created_at: '2026-10-15T12:00:00Z',
    bar: null,
  },
];

let reportsResult: any;

beforeEach(() => {
  jest.clearAllMocks();
  reportsResult = { data: REPORTS, error: null };
  mockedSupabase.from.mockImplementation(() => createQueryBuilderMock(reportsResult));
  mockedSupabase.rpc.mockResolvedValue({ data: null, error: null });
});

describe('ReviewReportsAdminScreen', () => {
  it('lista los reportes pendientes con motivo, bar y texto de la reseña', async () => {
    await render(<ReviewReportsAdminScreen />);

    await waitFor(() => expect(screen.getByText('“Texto ofensivo”')).toBeTruthy());
    expect(screen.getByText('Lenguaje ofensivo o de odio')).toBeTruthy();
    expect(screen.getAllByText('Bar Pepe')).toHaveLength(2);
    expect(screen.getByText('Comentario del usuario: Insulta')).toBeTruthy();
  });

  it('eliminar la reseña pide confirmación, llama a la RPC y quita todos sus reportes', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<ReviewReportsAdminScreen />);
    await waitFor(() => expect(screen.getByText('“Texto ofensivo”')).toBeTruthy());

    await fireEvent.press(screen.getAllByText('Eliminar reseña')[0]);
    expect(mockedSupabase.rpc).not.toHaveBeenCalled();
    await (alertSpy.mock.calls[0][2] as any[]).find((b) => b.text === 'Eliminar').onPress();

    await waitFor(() =>
      expect(mockedSupabase.rpc).toHaveBeenCalledWith('admin_resolve_review_report', {
        p_report_id: 'rep1',
        p_action: 'remove_review',
        p_notes: null,
      })
    );
    await waitFor(() => expect(screen.queryByText('“Texto ofensivo (2)”')).toBeNull());
    expect(screen.getByText('“Compra aquí”')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('Reseña eliminada');
    alertSpy.mockRestore();
  });

  it('descartar solo quita ese reporte', async () => {
    await render(<ReviewReportsAdminScreen />);
    await waitFor(() => expect(screen.getByText('“Compra aquí”')).toBeTruthy());

    await fireEvent.press(screen.getAllByText('Descartar')[2]);

    await waitFor(() => expect(screen.queryByText('“Compra aquí”')).toBeNull());
    expect(mockedSupabase.rpc.mock.calls[0][1]).toMatchObject({
      p_report_id: 'rep3',
      p_action: 'dismiss',
    });
    expect(screen.getByText('“Texto ofensivo”')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith('Reporte descartado');
  });

  it('si la RPC falla muestra el error y mantiene el reporte', async () => {
    mockedSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'not authorized' } });
    await render(<ReviewReportsAdminScreen />);
    await waitFor(() => expect(screen.getByText('“Compra aquí”')).toBeTruthy());

    await fireEvent.press(screen.getAllByText('Descartar')[2]);

    await waitFor(() => expect(toast.supabaseError).toHaveBeenCalled());
    expect(screen.getByText('“Compra aquí”')).toBeTruthy();
  });

  it('sin reportes muestra el estado vacío', async () => {
    reportsResult = { data: [], error: null };
    await render(<ReviewReportsAdminScreen />);
    await waitFor(() => expect(screen.getByText('No hay reseñas reportadas')).toBeTruthy());
  });

  it('si falla la carga muestra error con Reintentar', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    reportsResult = { data: null, error: { message: 'offline' } };
    await render(<ReviewReportsAdminScreen />);
    await waitFor(() =>
      expect(screen.getByText('No se pudieron cargar los reportes')).toBeTruthy()
    );

    reportsResult = { data: REPORTS, error: null };
    await fireEvent.press(screen.getByText('Reintentar'));
    await waitFor(() => expect(screen.getByText('“Texto ofensivo”')).toBeTruthy());
    (console.error as jest.Mock).mockRestore();
  });
});
