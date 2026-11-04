/**
 * Reporte de errores con adaptador intercambiable.
 *
 * La herramienta de monitorización (Sentry / EAS Observe / Crashlytics) aún no
 * está decidida (docs/audit, decisión D4). Este módulo es el único punto por el
 * que la app reporta errores: cuando se elija la herramienta basta con llamar a
 * `setErrorReporter()` al arrancar con un adaptador que la use, sin tocar el
 * resto del código.
 *
 * Todo lo que sale por aquí pasa antes por `scrubPersonalData` para que no
 * viajen emails, tokens ni ids de usuario completos.
 */

export type ErrorSource = 'boundary' | 'global' | 'promise' | 'manual';

export interface ErrorContext {
  /** De dónde viene el error (error boundary, handler global, promesa…). */
  source?: ErrorSource;
  /** El error ha cerrado la app (handler global con isFatal). */
  fatal?: boolean;
  /** Datos extra para depurar. Se limpian de datos personales antes de enviarse. */
  extra?: Record<string, unknown>;
}

export interface ErrorReporter {
  captureError(error: Error, context: ErrorContext): void;
}

/** Adaptador por defecto: solo escribe en consola (no envía nada fuera del dispositivo). */
export const consoleReporter: ErrorReporter = {
  captureError(error, context) {
    console.error(
      `[errorReporting] ${context.source ?? 'manual'}${context.fatal ? ' (fatal)' : ''}:`,
      error.message,
      context.extra ?? ''
    );
  },
};

let reporter: ErrorReporter = consoleReporter;

export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
}

export function getErrorReporter(): ErrorReporter {
  return reporter;
}

// --- Limpieza de datos personales -------------------------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// JWT (access/refresh tokens de Supabase, anon key…)
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
// Tokens de push de Expo
const EXPO_PUSH_TOKEN_RE = /ExponentPushToken\[[^\]]+\]/g;
// Parámetros de URL con credenciales (deep links de auth)
const TOKEN_PARAM_RE = /((?:access|refresh)_token|token|code)=([^&#\s]+)/gi;
// UUID completos (ids de usuario de Supabase): se deja el prefijo para poder correlacionar
const UUID_RE = /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const SENSITIVE_KEY_RE = /(email|password|token|secret|authorization|cookie|phone)/i;

export function scrubString(value: string): string {
  return value
    .replace(EMAIL_RE, '[email]')
    .replace(JWT_RE, '[token]')
    .replace(EXPO_PUSH_TOKEN_RE, '[push-token]')
    .replace(TOKEN_PARAM_RE, '$1=[redacted]')
    .replace(UUID_RE, '$1-…');
}

export function scrubPersonalData(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 5) return '[…]';
  if (Array.isArray(value)) return value.map((item) => scrubPersonalData(item, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_RE.test(key) ? '[redacted]' : scrubPersonalData(item, depth + 1);
  }
  return result;
}

/** Convierte cualquier valor lanzado en un Error con mensaje y stack sin datos personales. */
export function toSafeError(value: unknown): Error {
  const original =
    value instanceof Error
      ? value
      : new Error(typeof value === 'string' ? value : safeStringify(value));

  const safe = new Error(scrubString(original.message));
  safe.name = original.name;
  if (original.stack) safe.stack = scrubString(original.stack);
  return safe;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// --- API pública ------------------------------------------------------------------

export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    const safeContext: ErrorContext = {
      source: context.source ?? 'manual',
      fatal: context.fatal ?? false,
      ...(context.extra
        ? { extra: scrubPersonalData(context.extra) as Record<string, unknown> }
        : {}),
    };
    reporter.captureError(toSafeError(error), safeContext);
  } catch {
    // El reporte nunca debe provocar otro error.
  }
}

// --- Handlers globales ------------------------------------------------------------

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

interface HermesLike {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, rejection: unknown) => void;
    onHandled: (id: number) => void;
  }) => void;
}

let installed = false;

/**
 * Registra los errores JS no capturados y las promesas rechazadas sin `catch`.
 * Mantiene el handler anterior de React Native (pantalla roja en desarrollo,
 * cierre controlado en producción). Idempotente.
 */
export function installGlobalErrorHandlers(
  env: {
    errorUtils?: ErrorUtilsLike;
    hermes?: HermesLike;
    isDev?: boolean;
  } = {}
): void {
  if (installed) return;
  installed = true;

  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike; HermesInternal?: HermesLike };
  const errorUtils = env.errorUtils ?? g.ErrorUtils;
  const hermes = env.hermes ?? g.HermesInternal;
  const isDev = env.isDev ?? (typeof __DEV__ !== 'undefined' && __DEV__);

  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      reportError(error, { source: 'global', fatal: !!isFatal });
      previous?.(error, isFatal);
    });
  }

  // En desarrollo React Native ya avisa de las promesas sin catch (LogBox);
  // sustituir su tracker lo ocultaría. En producción no hay nadie escuchando.
  if (!isDev && hermes?.enablePromiseRejectionTracker) {
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (_id, rejection) => reportError(rejection, { source: 'promise' }),
      onHandled: () => {},
    });
  }
}

/** Solo para tests. */
export function __resetErrorReportingForTests(): void {
  installed = false;
  reporter = consoleReporter;
}
