import {
  UserFacingError,
  userFacingErrorMessage,
  NETWORK_ERROR_MESSAGE,
  PERMISSION_ERROR_MESSAGE,
} from '~/utils/userFacingError';

const FALLBACK = 'No se pudo completar el registro. Inténtalo de nuevo.';

describe('userFacingErrorMessage (auditoría 12-H6)', () => {
  it.each([
    [{ code: '42501', message: 'new row violates row-level security policy for table "bars"' }, PERMISSION_ERROR_MESSAGE],
    [{ code: 'P0001', message: 'claim not found or already reviewed' }, 'Esta solicitud ya fue revisada'],
    [{ code: 'P0001', message: 'Only super admins can use this function' }, PERMISSION_ERROR_MESSAGE],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "bars_pkey"' }, 'Ya existe un registro igual'],
    [{ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 'Ya no existe o se ha borrado'],
    [new TypeError('Network request failed'), NETWORK_ERROR_MESSAGE],
    [{ code: '22P02', message: 'invalid input syntax for type uuid: "x"' }, FALLBACK],
    [new Error('Fetch failed with status: 500'), NETWORK_ERROR_MESSAGE],
    [null, FALLBACK],
  ])('%p → %p', (error, expected) => {
    expect(userFacingErrorMessage(error, FALLBACK)).toBe(expected);
  });

  it('nunca devuelve el texto en inglés de Supabase', () => {
    const text = userFacingErrorMessage({ message: 'value too long for type character varying(50)' }, FALLBACK);
    expect(text).toBe(FALLBACK);
  });

  it('muestra el mensaje de un UserFacingError', () => {
    expect(userFacingErrorMessage(new UserFacingError('2 de 5 imágenes de bar no se pudieron subir'), FALLBACK)).toBe(
      '2 de 5 imágenes de bar no se pudieron subir'
    );
  });
});
