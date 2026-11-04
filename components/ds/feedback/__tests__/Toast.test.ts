jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));

import ToastLib from 'react-native-toast-message';
import { toast } from '~/components/ds/feedback/Toast';

const show = ToastLib.show as jest.Mock;

beforeEach(() => show.mockClear());

describe('toast.supabaseError (auditoría 12-H6)', () => {
  it('no enseña el mensaje técnico en inglés de Supabase', () => {
    toast.supabaseError({ code: '22P02', message: 'invalid input syntax for type uuid' }, 'No se pudo guardar');
    expect(show).toHaveBeenCalledWith({ type: 'error', text1: 'No se pudo guardar', text2: 'Inténtalo de nuevo' });
  });

  it('traduce un error de RLS', () => {
    toast.supabaseError(
      { code: '42501', message: 'new row violates row-level security policy' },
      'No se pudo guardar'
    );
    expect(show).toHaveBeenCalledWith({
      type: 'error',
      text1: 'No se pudo guardar',
      text2: 'No tienes permiso para hacer esto',
    });
  });
});
