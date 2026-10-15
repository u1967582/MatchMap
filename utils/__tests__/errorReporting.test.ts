import {
  __resetErrorReportingForTests,
  consoleReporter,
  getErrorReporter,
  installGlobalErrorHandlers,
  reportError,
  scrubPersonalData,
  scrubString,
  setErrorReporter,
  toSafeError,
  type ErrorReporter,
} from '~/utils/errorReporting';

const USER_ID = '3f1c2a9e-1b2c-4d5e-8f90-a1b2c3d4e5f6';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJh';

function createReporter() {
  const captureError = jest.fn();
  const reporter: ErrorReporter = { captureError };
  return { reporter, captureError };
}

describe('errorReporting', () => {
  beforeEach(() => {
    __resetErrorReportingForTests();
  });

  describe('scrubString', () => {
    it('oculta emails', () => {
      expect(scrubString('fallo para ana.perez+test@example.com al guardar')).toBe(
        'fallo para [email] al guardar'
      );
    });

    it('oculta JWT y tokens de push', () => {
      expect(scrubString(`bearer ${JWT}`)).toBe('bearer [token]');
      expect(scrubString('token ExponentPushToken[abc123XYZ]')).toBe('token [push-token]');
    });

    it('oculta credenciales en parámetros de URL de deep links', () => {
      const url = 'matchmap://auth/callback#access_token=abc&refresh_token=def&type=recovery';
      expect(scrubString(url)).toBe(
        'matchmap://auth/callback#access_token=[redacted]&refresh_token=[redacted]&type=recovery'
      );
    });

    it('acorta los UUID de usuario dejando solo el prefijo', () => {
      expect(scrubString(`user ${USER_ID} sin perfil`)).toBe('user 3f1c2a9e-… sin perfil');
    });

    it('no modifica textos sin datos personales', () => {
      expect(scrubString('Network request failed')).toBe('Network request failed');
    });
  });

  describe('scrubPersonalData', () => {
    it('redacta claves sensibles y limpia valores anidados', () => {
      const result = scrubPersonalData({
        email: 'a@b.com',
        password: 'secreto',
        accessToken: 'x',
        barId: 42,
        nested: { note: `contactar con a@b.com (${USER_ID})`, list: ['c@d.es', 1] },
      });

      expect(result).toEqual({
        email: '[redacted]',
        password: '[redacted]',
        accessToken: '[redacted]',
        barId: 42,
        nested: { note: 'contactar con [email] (3f1c2a9e-…)', list: ['[email]', 1] },
      });
    });

    it('corta objetos demasiado profundos o circulares', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => scrubPersonalData(circular)).not.toThrow();
    });
  });

  describe('toSafeError', () => {
    it('limpia mensaje y stack de un Error', () => {
      const original = new TypeError('no existe el usuario a@b.com');
      const safe = toSafeError(original);

      expect(safe).toBeInstanceOf(Error);
      expect(safe.name).toBe('TypeError');
      expect(safe.message).toBe('no existe el usuario [email]');
      expect(safe.stack).not.toContain('a@b.com');
    });

    it('convierte valores que no son Error', () => {
      expect(toSafeError('texto').message).toBe('texto');
      expect(toSafeError({ code: 'PGRST116' }).message).toBe('{"code":"PGRST116"}');
      expect(toSafeError(undefined).message).toBe('undefined');
    });
  });

  describe('reportError', () => {
    it('usa el adaptador por defecto (consola) si no se configura otro', () => {
      expect(getErrorReporter()).toBe(consoleReporter);
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      reportError(new Error('boom'));
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('envía al adaptador configurado un error y un contexto sin datos personales', () => {
      const { reporter, captureError } = createReporter();
      setErrorReporter(reporter);

      reportError(new Error(`fallo de ${USER_ID}`), {
        source: 'boundary',
        extra: { email: 'a@b.com', step: 'perfil' },
      });

      expect(captureError).toHaveBeenCalledTimes(1);
      const [error, context] = captureError.mock.calls[0];
      expect(error.message).toBe('fallo de 3f1c2a9e-…');
      expect(context).toEqual({
        source: 'boundary',
        fatal: false,
        extra: { email: '[redacted]', step: 'perfil' },
      });
    });

    it('nunca lanza aunque el adaptador falle', () => {
      setErrorReporter({
        captureError: () => {
          throw new Error('adaptador roto');
        },
      });
      expect(() => reportError(new Error('x'))).not.toThrow();
    });
  });

  describe('installGlobalErrorHandlers', () => {
    function createErrorUtils() {
      const previous = jest.fn();
      let handler: (error: unknown, isFatal?: boolean) => void = previous;
      return {
        previous,
        errorUtils: {
          getGlobalHandler: () => handler,
          setGlobalHandler: jest.fn((next) => {
            handler = next;
          }),
        },
        trigger: (error: unknown, isFatal?: boolean) => handler(error, isFatal),
      };
    }

    it('reporta los errores globales y mantiene el handler anterior', () => {
      const { reporter, captureError } = createReporter();
      setErrorReporter(reporter);
      const { errorUtils, previous, trigger } = createErrorUtils();

      installGlobalErrorHandlers({ errorUtils, isDev: true });
      const error = new Error('crash');
      trigger(error, true);

      expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'crash' }), {
        source: 'global',
        fatal: true,
      });
      expect(previous).toHaveBeenCalledWith(error, true);
    });

    it('es idempotente', () => {
      const { errorUtils } = createErrorUtils();
      installGlobalErrorHandlers({ errorUtils, isDev: true });
      installGlobalErrorHandlers({ errorUtils, isDev: true });
      expect(errorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
    });

    it('en producción registra las promesas rechazadas sin catch', () => {
      const { reporter, captureError } = createReporter();
      setErrorReporter(reporter);
      const enablePromiseRejectionTracker = jest.fn();

      installGlobalErrorHandlers({ hermes: { enablePromiseRejectionTracker }, isDev: false });

      expect(enablePromiseRejectionTracker).toHaveBeenCalledWith(
        expect.objectContaining({ allRejections: true })
      );
      const { onUnhandled } = enablePromiseRejectionTracker.mock.calls[0][0];
      onUnhandled(1, new Error('promesa'));
      expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'promesa' }), {
        source: 'promise',
        fatal: false,
      });
    });

    it('en desarrollo no sustituye el tracker de promesas de React Native', () => {
      const enablePromiseRejectionTracker = jest.fn();
      installGlobalErrorHandlers({ hermes: { enablePromiseRejectionTracker }, isDev: true });
      expect(enablePromiseRejectionTracker).not.toHaveBeenCalled();
    });
  });
});
