/**
 * EAS Observe (decisión D4, área 08): métricas de arranque y navegación y
 * errores de producción.
 *
 * Los errores siguen pasando por `utils/errorReporting`, que limpia emails,
 * tokens e ids antes de enviarlos. Por eso se desactiva el handler global
 * propio de Observe (`errorHandlingEnabled: false`): si no, los errores no
 * capturados llegarían dos veces y sin limpiar.
 */
import { Observe } from 'expo-observe';
import { consoleReporter, setErrorReporter, type ErrorReporter } from './errorReporting';

/**
 * Parámetros de ruta que nunca deben salir del dispositivo. Los de auth llegan
 * en los deep links de Supabase (`auth/callback`, `auth/reset-password`).
 */
export const OBSERVE_FILTERED_PARAMS = [
  'access_token',
  'refresh_token',
  'token',
  'token_hash',
  'code',
  'email',
];

export const observeReporter: ErrorReporter = {
  captureError(error, context) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) consoleReporter.captureError(error, context);

    // `Observe.reportError` no admite atributos: el origen va como prefijo del
    // mensaje para poder filtrar en el panel (p. ej. «[global:fatal]»).
    const tag = `${context.source ?? 'manual'}${context.fatal ? ':fatal' : ''}`;
    const tagged = new Error(`[${tag}] ${error.message}`);
    tagged.name = error.name;
    if (error.stack) tagged.stack = error.stack;
    Observe.reportError(tagged);
  },
};

let configured = false;

/** Se llama una vez, a nivel de módulo en `app/_layout.tsx`, antes de montar pantallas. */
export function setupObserve(): void {
  if (configured) return;
  configured = true;

  try {
    Observe.configure({
      errorHandlingEnabled: false,
      integrations: {
        'expo-router': { filteredParams: OBSERVE_FILTERED_PARAMS },
      },
    });
    setErrorReporter(observeReporter);
  } catch (error) {
    // Sin Observe la app sigue funcionando con el reporte por consola.
    consoleReporter.captureError(
      error instanceof Error ? error : new Error(String(error)),
      { source: 'manual', extra: { step: 'setupObserve' } }
    );
  }
}

/** Solo para tests. */
export function __resetObserveForTests(): void {
  configured = false;
}
