# 08 · Estabilidad, calidad y monitorización

**Prioridad:** 🟠 · **Ejecución:** ☁️ (+ 👤 crear cuenta según D4) · **Rama:** `audit/08-estabilidad-calidad`

## Objetivo
Que la app no se cierre sola, que cuando algo falle lo sepamos, y que el código pase todas las comprobaciones.

## Checklist
- [ ] `npm run typecheck`, `npm run lint` (0 errores; bajar los 235 warnings con `--fix`, HALLAZGOS #18) y `npm run test:all` en verde.
- [ ] **Error boundary** global en `app/_layout.tsx` con pantalla de «algo ha fallado» y botón de reintentar; errores no capturados de promesas registrados.
- [ ] **Monitorización (HALLAZGOS #15, D4):** integrar la herramienta elegida con source maps de EAS, entorno `production`/`preview`, sin datos personales en los eventos.
- [ ] **Logs (HALLAZGOS #17):** `console.error/warn` sin emails, tokens ni IDs de usuario completos. `transform-remove-console` activo en producción.
- [ ] **Dependencias:** `npx expo-doctor` 18/18, `npm audit --omit=dev` sin vulnerabilidades altas/críticas en runtime.
- [ ] **Variables de entorno:** la app arranca con un error claro (no crash) si falta alguna `EXPO_PUBLIC_*`.
- [ ] **Memoria/fugas:** suscripciones de Supabase Realtime, listeners de ubicación y timers se limpian al desmontar (buscar `subscribe(`, `watchPosition`, `setInterval` sin cleanup).
- [ ] **Cobertura:** los módulos críticos (auth, pagos, favoritos, reseñas, registro de bar) con tests; reportar `npm run test:coverage` en el fichero.

## Criterios de aceptación
- Un error forzado en un build `preview` aparece en la herramienta de monitorización con stack legible.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=08, nombre=estabilidad-calidad]
Específico del área: no integres la herramienta de monitorización hasta que D4 esté respondida en el
README; si no lo está, deja preparado el error boundary y la función de reporte con un adaptador.
Busca efectos sin cleanup y logs con datos personales. Aplica eslint --fix solo a warnings seguros y
en un commit separado.
```
