import { Observe } from 'expo-observe';
import {
  __resetObserveForTests,
  OBSERVE_FILTERED_PARAMS,
  observeReporter,
  setupObserve,
} from '~/utils/observe';
import {
  __resetErrorReportingForTests,
  getErrorReporter,
  reportError,
} from '~/utils/errorReporting';

const mockObserve = Observe as unknown as {
  configure: jest.Mock;
  reportError: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  __resetObserveForTests();
  __resetErrorReportingForTests();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('setupObserve (D4)', () => {
  it('desactiva el handler global de Observe y filtra los parámetros de auth', () => {
    setupObserve();
    expect(mockObserve.configure).toHaveBeenCalledTimes(1);
    const config = mockObserve.configure.mock.calls[0][0];
    expect(config.errorHandlingEnabled).toBe(false);
    expect(config.integrations['expo-router'].filteredParams).toEqual(OBSERVE_FILTERED_PARAMS);
    expect(OBSERVE_FILTERED_PARAMS).toEqual(
      expect.arrayContaining(['access_token', 'refresh_token'])
    );
  });

  it('es idempotente', () => {
    setupObserve();
    setupObserve();
    expect(mockObserve.configure).toHaveBeenCalledTimes(1);
  });

  it('usa Observe como destino de reportError', () => {
    setupObserve();
    expect(getErrorReporter()).toBe(observeReporter);
  });

  it('si configure falla, la app sigue con el reporte por consola', () => {
    mockObserve.configure.mockImplementationOnce(() => {
      throw new Error('configure después de montar');
    });
    expect(() => setupObserve()).not.toThrow();
    expect(getErrorReporter()).not.toBe(observeReporter);
  });
});

describe('observeReporter', () => {
  it('envía el error ya limpio de datos personales y con el origen en el mensaje', () => {
    setupObserve();
    reportError(new Error('fallo para ana@example.com'), { source: 'global', fatal: true });

    expect(mockObserve.reportError).toHaveBeenCalledTimes(1);
    const sent: Error = mockObserve.reportError.mock.calls[0][0];
    expect(sent.message).toBe('[global:fatal] fallo para [email]');
    expect(sent.message).not.toContain('example.com');
  });

  it('los errores manuales llevan la etiqueta manual', () => {
    setupObserve();
    reportError('algo raro');
    expect(mockObserve.reportError.mock.calls[0][0].message).toBe('[manual] algo raro');
  });
});
